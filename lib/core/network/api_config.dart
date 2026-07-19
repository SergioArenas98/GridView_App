import '../../app/environment/app_environment.dart';

/// Networking configuration for the GridView remote API boundary.
///
/// The base URL is supplied at build time with
/// `--dart-define=API_BASE_URL=...`. There is no hardcoded production endpoint
/// in source: a production build without an explicit base URL is a
/// configuration error rather than a silent fallback.
class ApiConfig {
  const ApiConfig({
    required this.baseUrl,
    this.connectTimeout = const Duration(seconds: 5),
    this.receiveTimeout = const Duration(seconds: 10),
    this.sendTimeout = const Duration(seconds: 5),
  });

  final String baseUrl;
  final Duration connectTimeout;
  final Duration receiveTimeout;
  final Duration sendTimeout;

  /// Whether a usable HTTP base URL is configured.
  bool get hasBaseUrl => baseUrl.trim().isNotEmpty;

  static const String _baseUrlDefine = String.fromEnvironment('API_BASE_URL');

  /// Resolves configuration for [environment] from `--dart-define` values.
  factory ApiConfig.forEnvironment(AppEnvironment environment) =>
      ApiConfig(baseUrl: _baseUrlDefine.trim());
}
