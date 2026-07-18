/// Build-time application environment, selected with
/// `--dart-define=APP_ENV=development|staging|production`.
enum AppEnvironment {
  development,
  staging,
  production;

  static const String _dartDefine = String.fromEnvironment('APP_ENV');

  /// Environment of the current build.
  ///
  /// Unknown or missing values fall back to [development] so that a
  /// misconfigured build can never silently behave as production.
  static final AppEnvironment current = parse(_dartDefine);

  /// Parses a `--dart-define` value into an [AppEnvironment].
  static AppEnvironment parse(String value) => switch (value) {
    'production' => production,
    'staging' => staging,
    _ => development,
  };

  bool get isProduction => this == production;

  /// Short technical badge shown in non-production builds.
  String get label => switch (this) {
    development => 'DEV',
    staging => 'STAGING',
    production => 'PRODUCTION',
  };
}
