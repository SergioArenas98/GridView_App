import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/data_source_attribution.dart';

/// The repository-owned attribution record, bundled with the app unchanged.
///
/// One file is both what `npm run validate:content` checks and what the app
/// renders, so the two cannot drift.
const String dataSourceAttributionsAsset =
    'content/attribution/data-sources.json';

/// The data-source attribution record, read from the bundled asset.
///
/// A pure local read: it issues no request, so the credit is available offline
/// from the first launch. Overridable in tests.
///
/// The provider already holds the parsed record for the life of the app, so the
/// bundle's own string cache is bypassed: it would only keep a second copy, and
/// a future cached by one widget test would be awaited by the next.
final FutureProvider<DataSourceAttributions> dataSourceAttributionsProvider =
    FutureProvider<DataSourceAttributions>((Ref ref) async {
      final String raw = await rootBundle.loadString(
        dataSourceAttributionsAsset,
        cache: false,
      );
      return DataSourceAttributions.fromJson(jsonDecode(raw));
    });
