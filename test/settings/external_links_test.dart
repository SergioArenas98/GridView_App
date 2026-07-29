import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/settings/application/external_links.dart';

void main() {
  group('accepted destinations', () {
    test('an https URL is accepted', () {
      final ExternalLink? link = ExternalLink.parse(
        'https://example.org/privacy',
      );
      expect(link, isNotNull);
      expect(link!.kind, ExternalLinkKind.https);
      expect(link.uri.toString(), 'https://example.org/privacy');
    });

    test('a bare email address becomes a mailto destination', () {
      final ExternalLink? link = ExternalLink.parse('support@example.org');
      expect(link, isNotNull);
      expect(link!.kind, ExternalLinkKind.mailto);
      expect(link.uri.scheme, 'mailto');
      expect(link.uri.path, 'support@example.org');
    });

    test('an explicit mailto URI is accepted', () {
      final ExternalLink? link = ExternalLink.parse('mailto:hi@example.org');
      expect(link, isNotNull);
      expect(link!.kind, ExternalLinkKind.mailto);
    });

    test('surrounding whitespace is tolerated', () {
      expect(ExternalLink.parse('  https://example.org  '), isNotNull);
      expect(ExternalLink.parse(' support@example.org '), isNotNull);
    });
  });

  group('rejected destinations', () {
    test('cleartext http is rejected', () {
      expect(ExternalLink.parse('http://example.org'), isNull);
    });

    test('an unsupported scheme is rejected', () {
      for (final String value in <String>[
        'ftp://example.org',
        'javascript:alert(1)',
        'file:///etc/passwd',
        'content://media/external/images/1',
        'data:text/html,<b>x</b>',
        'tel:+34600000000',
        'intent://scan#Intent;scheme=zxing;end',
      ]) {
        expect(ExternalLink.parse(value), isNull, reason: value);
      }
    });

    test('embedded credentials are rejected', () {
      expect(ExternalLink.parse('https://user:pw@example.org'), isNull);
    });

    test('an empty host is rejected', () {
      expect(ExternalLink.parse('https://'), isNull);
      expect(ExternalLink.parse('https:///privacy'), isNull);
    });

    test('a malformed address is rejected rather than half-accepted', () {
      for (final String value in <String>[
        'not an address',
        '@example.org',
        'support@',
        'support@example',
        'a@b@example.org',
        'support example@org',
      ]) {
        expect(ExternalLink.parse(value), isNull, reason: value);
      }
    });

    test('an absent or blank value is simply absent', () {
      expect(ExternalLink.parse(null), isNull);
      expect(ExternalLink.parse(''), isNull);
      expect(ExternalLink.parse('   '), isNull);
    });
  });

  group('configuration', () {
    test('no privacy policy is invented when none is configured', () {
      // The compile-time define is absent in tests, so the policy must be null
      // rather than a fabricated URL.
      expect(ExternalLinkConfig.fromEnvironment().privacyPolicy, isNull);
    });

    test('the support contact resolves to the published address', () {
      final ExternalLink? contact =
          ExternalLinkConfig.fromEnvironment().supportContact;
      expect(contact, isNotNull);
      expect(contact!.kind, ExternalLinkKind.mailto);
    });

    test('a launcher failure is reported rather than thrown', () async {
      final RecordingExternalLinkLauncher launcher =
          RecordingExternalLinkLauncher(succeeds: false);
      final ExternalLink link = ExternalLink.parse('https://example.org')!;

      expect(await launcher.open(link), isFalse);
      expect(launcher.opened, <Uri>[link.uri]);
    });
  });
}
