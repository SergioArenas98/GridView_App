import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

/// The only external destinations GridView is allowed to open.
///
/// An allow-list by construction: a link is either a validated `https` URL or a
/// validated `mailto` address, and nothing else can be launched. No URL that
/// arrives in API content is ever opened.
enum ExternalLinkKind { https, mailto }

/// A validated external destination.
class ExternalLink {
  const ExternalLink._(this.uri, this.kind);

  final Uri uri;
  final ExternalLinkKind kind;

  /// Validates a configured value, returning `null` when it is absent, malformed
  /// or not an allowed scheme.
  ///
  /// The rules mirror the media URL policy: `https` only (never cleartext
  /// `http`), a non-empty host, and no embedded credentials.
  static ExternalLink? parse(String? value) {
    if (value == null) return null;
    final String trimmed = value.trim();
    if (trimmed.isEmpty) return null;

    final Uri? uri = Uri.tryParse(trimmed);
    if (uri == null) return null;

    if (uri.scheme == 'https') {
      if (uri.host.isEmpty) return null;
      if (uri.userInfo.isNotEmpty) return null;
      return ExternalLink._(uri, ExternalLinkKind.https);
    }
    if (uri.scheme == 'mailto') {
      return _mailto(uri.path);
    }
    // A bare address is accepted as a mailto target; anything else is rejected.
    if (!trimmed.contains(':')) return _mailto(trimmed);
    return null;
  }

  static ExternalLink? _mailto(String address) {
    final String value = address.trim();
    // Deliberately conservative: exactly one `@`, non-empty local part, and a
    // dotted domain. A configuration mistake must not produce a broken action.
    final RegExp pattern = RegExp(r'^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$');
    if (!pattern.hasMatch(value)) return null;
    return ExternalLink._(
      Uri(scheme: 'mailto', path: value),
      ExternalLinkKind.mailto,
    );
  }
}

/// Opens external destinations. Injected so no test ever launches a browser or
/// an email application.
abstract interface class ExternalLinkLauncher {
  /// Returns whether the destination was opened. A failure is non-fatal.
  Future<bool> open(ExternalLink link);
}

/// The production launcher.
class UrlExternalLinkLauncher implements ExternalLinkLauncher {
  const UrlExternalLinkLauncher();

  @override
  Future<bool> open(ExternalLink link) async {
    try {
      // Both kinds hand off to a real external application (a browser or an
      // email client); GridView never renders external content in-app.
      return await launchUrl(link.uri, mode: LaunchMode.externalApplication);
    } on Object {
      // A missing email client or browser is a normal device state, not a crash.
      return false;
    }
  }
}

/// Records what would have been opened, for tests.
class RecordingExternalLinkLauncher implements ExternalLinkLauncher {
  RecordingExternalLinkLauncher({this.succeeds = true});

  final bool succeeds;
  final List<Uri> opened = <Uri>[];

  @override
  Future<bool> open(ExternalLink link) async {
    opened.add(link.uri);
    return succeeds;
  }
}

/// The public, build-time external configuration.
///
/// Both values are public product configuration — a published policy URL and a
/// published support address — never secrets. An absent or malformed value
/// simply means the corresponding action is not offered.
class ExternalLinkConfig {
  const ExternalLinkConfig({this.privacyPolicy, this.supportContact});

  /// Reads the compile-time configuration.
  ///
  /// The support contact defaults to the address already published in the
  /// application's privacy policy, so the action is never a dead end in a normal
  /// build; the privacy policy URL has no default, because inventing one would
  /// be a false claim that a policy is hosted.
  factory ExternalLinkConfig.fromEnvironment() {
    return ExternalLinkConfig(
      privacyPolicy: ExternalLink.parse(
        const String.fromEnvironment('PRIVACY_POLICY_URL'),
      ),
      supportContact: ExternalLink.parse(
        const String.fromEnvironment(
          'SUPPORT_CONTACT',
          defaultValue: 'gridviewapp1@gmail.com',
        ),
      ),
    );
  }

  final ExternalLink? privacyPolicy;
  final ExternalLink? supportContact;
}

/// The active external-link configuration. Overridable in tests.
final Provider<ExternalLinkConfig> externalLinkConfigProvider =
    Provider<ExternalLinkConfig>(
      (Ref ref) => ExternalLinkConfig.fromEnvironment(),
    );

/// The active external-link launcher. Overridable in tests.
final Provider<ExternalLinkLauncher> externalLinkLauncherProvider =
    Provider<ExternalLinkLauncher>(
      (Ref ref) => const UrlExternalLinkLauncher(),
    );
