import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'app.dart';

/// Initializes essential services and global error handling, then runs the
/// application.
///
/// The shell starts fully offline: no network client, Firebase, advertising
/// or backend dependency is initialized here. Those integrations are added in
/// later phases behind this single entry point.
Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    // Crash reporting is integrated in Phase 8 (Firebase tasks).
  };

  PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
    // Forwarded to crash reporting once it exists (Phase 8). Until then the
    // error is surfaced in logs so it is never silently lost.
    debugPrint('Uncaught error: $error\n$stack');
    return true;
  };

  runApp(const GridViewApp());
}
