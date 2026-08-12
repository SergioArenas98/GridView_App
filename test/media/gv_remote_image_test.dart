import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/media/media_image_loader.dart';
import 'package:gridview/core/media/media_load_outcome.dart';
import 'package:gridview/core/media/media_loader_scope.dart';
import 'package:gridview/core/theme/gridview_theme.dart';
import 'package:gridview/core/widgets/gv_image_placeholder.dart';
import 'package:gridview/core/widgets/gv_remote_image.dart';

import '../support/media_fixtures.dart';
import '../support/synthetic_png.dart';

const MediaImageRequest _request = MediaImageRequest(
  url: 'https://media.gridview.invalid/media/drivers/x/v1/thumbnail.webp',
  cacheKey: 'x|v1|thumbnail|https://media.gridview.invalid/a.webp',
);

Widget _host({
  required MediaImageLoader? loader,
  MediaImageRequest? request = _request,
  double aspectRatio = 1,
  double width = 120,
  bool decorative = false,
  String? semanticLabel,
  ThemeData? theme,
  double textScale = 1,
  bool disableAnimations = false,
  Size size = const Size(400, 800),
}) {
  final Widget image = GvRemoteImage(
    request: request,
    aspectRatio: aspectRatio,
    logicalWidth: width,
    decorative: decorative,
    semanticLabel: semanticLabel,
  );
  return MaterialApp(
    theme: theme ?? buildGridViewDarkTheme(),
    home: MediaQuery(
      data: MediaQueryData(
        size: size,
        textScaler: TextScaler.linear(textScale),
        disableAnimations: disableAnimations,
      ),
      child: Scaffold(
        body: Center(
          child: SizedBox(
            width: width,
            child: loader == null
                ? image
                : MediaLoaderScope(loader: loader, child: image),
          ),
        ),
      ),
    ),
  );
}

/// A loader whose answers never arrive, so the loading state can be observed.
class _PendingLoader implements MediaImageLoader {
  @override
  Future<File?> cached(MediaImageRequest request) => Completer<File?>().future;

  @override
  Future<MediaLoadOutcome> load(MediaImageRequest request) =>
      Completer<MediaLoadOutcome>().future;
}

Future<void> _settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 200));
}

void main() {
  late Directory tmp;
  late File image;

  setUp(() {
    tmp = Directory.systemTemp.createTempSync('gv_remote_image');
    image = writePng(tmp, 'a.png', bandedPng(16, 16));
  });

  tearDown(() {
    if (tmp.existsSync()) tmp.deleteSync(recursive: true);
  });

  group('states all resolve to a stable placeholder or an image', () {
    testWidgets('no media renders the placeholder and requests nothing', (
      WidgetTester tester,
    ) async {
      final FakeMediaImageLoader loader = FakeMediaImageLoader();
      await tester.pumpWidget(_host(loader: loader, request: null));
      await _settle(tester);

      expect(find.byType(GvImagePlaceholder), findsOneWidget);
      expect(find.byKey(GvRemoteImage.noMediaPlaceholderKey), findsOneWidget);
      expect(loader.fetches, isEmpty);
      expect(loader.cacheProbes, isEmpty);
    });

    testWidgets('loading reserves the slot with the placeholder', (
      WidgetTester tester,
    ) async {
      // A loader that never answers, so the in-flight state is observable at
      // all: the fakes elsewhere resolve within the same frame.
      final _PendingLoader loader = _PendingLoader();
      await tester.pumpWidget(_host(loader: loader));
      await tester.pump();
      await tester.pump();

      expect(find.byKey(GvRemoteImage.pendingPlaceholderKey), findsOneWidget);
      expect(find.byType(Image), findsNothing);
      // The slot is already its final size while the bytes are still in flight.
      expect(tester.getSize(find.byType(GvRemoteImage)).width, 120);
    });

    testWidgets('a failure falls back to the placeholder', (
      WidgetTester tester,
    ) async {
      final FakeMediaImageLoader loader = FakeMediaImageLoader(
        failures: <String, MediaFailureKind>{
          _request.cacheKey: MediaFailureKind.network,
        },
      );
      await tester.pumpWidget(_host(loader: loader));
      await _settle(tester);

      expect(find.byKey(GvRemoteImage.failedPlaceholderKey), findsOneWidget);
      expect(find.byType(Image), findsNothing);
    });

    testWidgets('an HTTP failure looks exactly like any other', (
      WidgetTester tester,
    ) async {
      final FakeMediaImageLoader loader = FakeMediaImageLoader(
        failures: <String, MediaFailureKind>{
          _request.cacheKey: MediaFailureKind.http,
        },
      );
      await tester.pumpWidget(_host(loader: loader));
      await _settle(tester);
      expect(find.byKey(GvRemoteImage.failedPlaceholderKey), findsOneWidget);
    });

    testWidgets('cancellation is not a failure and shows no error', (
      WidgetTester tester,
    ) async {
      // Scrolling a row off screen is the expected outcome of ordinary
      // scrolling, so it must never be presented as something going wrong.
      final FakeMediaImageLoader loader = FakeMediaImageLoader(
        cancelled: <String>{_request.cacheKey},
      );
      await tester.pumpWidget(_host(loader: loader));
      await _settle(tester);

      expect(find.byKey(GvRemoteImage.pendingPlaceholderKey), findsOneWidget);
      expect(find.byKey(GvRemoteImage.failedPlaceholderKey), findsNothing);
    });

    testWidgets('a cached file renders without any fetch', (
      WidgetTester tester,
    ) async {
      final FakeMediaImageLoader loader = FakeMediaImageLoader(
        cachedFiles: <String, File>{_request.cacheKey: image},
      );
      await tester.pumpWidget(_host(loader: loader));
      await _settle(tester);

      expect(find.byType(Image), findsOneWidget);
      expect(loader.fetches, isEmpty);
    });

    testWidgets('a fetched file renders', (WidgetTester tester) async {
      final FakeMediaImageLoader loader = FakeMediaImageLoader(
        loadedFiles: <String, File>{_request.cacheKey: image},
      );
      await tester.pumpWidget(_host(loader: loader));
      await _settle(tester);

      expect(find.byType(Image), findsOneWidget);
      expect(loader.fetches, <String>[_request.cacheKey]);
    });

    testWidgets(
      'no loader in scope renders the placeholder and fetches nothing',
      (WidgetTester tester) async {
        // The property that makes an accidental network call in a widget test
        // impossible.
        await tester.pumpWidget(_host(loader: null));
        await _settle(tester);
        expect(find.byType(GvImagePlaceholder), findsOneWidget);
        expect(find.byType(Image), findsNothing);
      },
    );
  });

  group('layout is reserved in every state', () {
    testWidgets('the placeholder holds the exact aspect ratio', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        _host(loader: FakeMediaImageLoader(), aspectRatio: 16 / 9, width: 160),
      );
      await tester.pump();
      final Size size = tester.getSize(find.byType(GvRemoteImage));
      expect(size.width, 160);
      expect(size.height, closeTo(90, 0.5));
    });

    testWidgets('the size does not change when the image arrives', (
      WidgetTester tester,
    ) async {
      final FakeMediaImageLoader loader = FakeMediaImageLoader(
        loadedFiles: <String, File>{_request.cacheKey: image},
      );
      await tester.pumpWidget(
        _host(loader: loader, aspectRatio: 16 / 9, width: 160),
      );
      await tester.pump();
      final Size before = tester.getSize(find.byType(GvRemoteImage));
      await _settle(tester);
      expect(tester.getSize(find.byType(GvRemoteImage)), before);
    });

    testWidgets('the size does not change when the image fails', (
      WidgetTester tester,
    ) async {
      final FakeMediaImageLoader loader = FakeMediaImageLoader(
        failures: <String, MediaFailureKind>{
          _request.cacheKey: MediaFailureKind.network,
        },
      );
      await tester.pumpWidget(
        _host(loader: loader, aspectRatio: 16 / 9, width: 160),
      );
      await tester.pump();
      final Size before = tester.getSize(find.byType(GvRemoteImage));
      await _settle(tester);
      expect(tester.getSize(find.byType(GvRemoteImage)), before);
    });

    testWidgets('holds its slot on a narrow phone at 200% text', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        _host(
          loader: FakeMediaImageLoader(),
          aspectRatio: 1,
          width: 40,
          textScale: 2,
          size: const Size(320, 640),
        ),
      );
      await _settle(tester);
      expect(tester.takeException(), isNull);
      expect(tester.getSize(find.byType(GvRemoteImage)).width, 40);
    });
  });

  group('requests are not duplicated', () {
    testWidgets('a rebuild with the same media does not re-fetch', (
      WidgetTester tester,
    ) async {
      final FakeMediaImageLoader loader = FakeMediaImageLoader(
        loadedFiles: <String, File>{_request.cacheKey: image},
      );
      await tester.pumpWidget(_host(loader: loader));
      await _settle(tester);
      expect(loader.fetches, hasLength(1));

      for (int i = 0; i < 3; i++) {
        await tester.pumpWidget(_host(loader: loader));
        await _settle(tester);
      }
      expect(loader.fetches, hasLength(1));
    });

    testWidgets('a different image does start a new request', (
      WidgetTester tester,
    ) async {
      const MediaImageRequest other = MediaImageRequest(
        url: 'https://media.gridview.invalid/media/drivers/x/v2/thumbnail.webp',
        cacheKey: 'x|v2|thumbnail|https://media.gridview.invalid/b.webp',
      );
      final FakeMediaImageLoader loader = FakeMediaImageLoader(
        loadedFiles: <String, File>{
          _request.cacheKey: image,
          other.cacheKey: image,
        },
      );
      await tester.pumpWidget(_host(loader: loader));
      await _settle(tester);
      await tester.pumpWidget(_host(loader: loader, request: other));
      await _settle(tester);

      expect(loader.fetches, <String>[_request.cacheKey, other.cacheKey]);
    });

    testWidgets('a failure is not retried on rebuild', (
      WidgetTester tester,
    ) async {
      final FakeMediaImageLoader loader = FakeMediaImageLoader(
        failures: <String, MediaFailureKind>{
          _request.cacheKey: MediaFailureKind.network,
        },
      );
      await tester.pumpWidget(_host(loader: loader));
      await _settle(tester);
      await tester.pumpWidget(_host(loader: loader));
      await _settle(tester);

      expect(loader.fetches, hasLength(1));
    });
  });

  group('semantics', () {
    testWidgets('a decorative image is excluded from semantics', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      final FakeMediaImageLoader loader = FakeMediaImageLoader(
        cachedFiles: <String, File>{_request.cacheKey: image},
      );
      await tester.pumpWidget(
        _host(loader: loader, decorative: true, semanticLabel: 'ignored'),
      );
      await _settle(tester);

      expect(find.bySemanticsLabel('ignored'), findsNothing);
      handle.dispose();
    });

    testWidgets('an informative image is announced once, by its label', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      final FakeMediaImageLoader loader = FakeMediaImageLoader(
        cachedFiles: <String, File>{_request.cacheKey: image},
      );
      await tester.pumpWidget(
        _host(loader: loader, semanticLabel: 'Track layout of Test Circuit'),
      );
      await _settle(tester);

      expect(
        find.bySemanticsLabel('Track layout of Test Circuit'),
        findsOneWidget,
      );
      handle.dispose();
    });

    testWidgets('no id, URL or file path reaches semantics', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      final FakeMediaImageLoader loader = FakeMediaImageLoader(
        cachedFiles: <String, File>{_request.cacheKey: image},
      );
      await tester.pumpWidget(
        _host(loader: loader, semanticLabel: 'Track layout of Test Circuit'),
      );
      await _settle(tester);

      // The label is the only thing announced, and it names the circuit. No
      // host, no variant token, no cache key and no file path is reachable.
      expect(
        find.bySemanticsLabel(RegExp('media.gridview.invalid')),
        findsNothing,
      );
      expect(find.bySemanticsLabel(RegExp('thumbnail')), findsNothing);
      expect(
        find.bySemanticsLabel(RegExp(RegExp.escape(_request.cacheKey))),
        findsNothing,
      );
      expect(
        find.bySemanticsLabel(RegExp(RegExp.escape(image.path))),
        findsNothing,
      );
      handle.dispose();
    });

    testWidgets('a failure announces no error text', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      final FakeMediaImageLoader loader = FakeMediaImageLoader(
        failures: <String, MediaFailureKind>{
          _request.cacheKey: MediaFailureKind.http,
        },
      );
      await tester.pumpWidget(_host(loader: loader, decorative: true));
      await _settle(tester);

      expect(tester.takeException(), isNull);
      expect(find.textContaining('rror'), findsNothing);
      handle.dispose();
    });
  });

  group('themes and motion', () {
    testWidgets('the placeholder renders in the light theme', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        _host(loader: FakeMediaImageLoader(), theme: buildGridViewLightTheme()),
      );
      await _settle(tester);
      expect(find.byType(GvImagePlaceholder), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('the placeholder renders in the dark theme', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        _host(loader: FakeMediaImageLoader(), theme: buildGridViewDarkTheme()),
      );
      await _settle(tester);
      expect(find.byType(GvImagePlaceholder), findsOneWidget);
    });

    testWidgets('reduced motion skips the fade entirely', (
      WidgetTester tester,
    ) async {
      final FakeMediaImageLoader loader = FakeMediaImageLoader(
        loadedFiles: <String, File>{_request.cacheKey: image},
      );
      await tester.pumpWidget(_host(loader: loader, disableAnimations: true));
      await _settle(tester);
      expect(find.byType(Opacity), findsNothing);
      expect(find.byType(Image), findsOneWidget);
    });

    testWidgets('a cached hit does not replay a fade', (
      WidgetTester tester,
    ) async {
      // Scrolling back to a row that is already on disk should feel instant.
      final FakeMediaImageLoader loader = FakeMediaImageLoader(
        cachedFiles: <String, File>{_request.cacheKey: image},
      );
      await tester.pumpWidget(_host(loader: loader));
      await _settle(tester);
      expect(find.byType(Opacity), findsNothing);
    });
  });

  group('surrounding content survives a failure', () {
    testWidgets('adjacent text and a button remain usable', (
      WidgetTester tester,
    ) async {
      int taps = 0;
      final FakeMediaImageLoader loader = FakeMediaImageLoader(
        failures: <String, MediaFailureKind>{
          _request.cacheKey: MediaFailureKind.network,
        },
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: buildGridViewDarkTheme(),
          home: MediaLoaderScope(
            loader: loader,
            child: Scaffold(
              body: Column(
                children: <Widget>[
                  const SizedBox(
                    width: 120,
                    child: GvRemoteImage(
                      request: _request,
                      aspectRatio: 1,
                      logicalWidth: 120,
                    ),
                  ),
                  const Text('Max Verstappen'),
                  TextButton(
                    onPressed: () => taps++,
                    child: const Text('Open'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await _settle(tester);

      expect(find.text('Max Verstappen'), findsOneWidget);
      await tester.tap(find.text('Open'));
      expect(taps, 1);
      expect(tester.takeException(), isNull);
    });
  });
}
