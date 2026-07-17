import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

class AdProvider with ChangeNotifier {
  final Map<String, BannerAd> _bannerAds = {};
  bool _adsInitialized = false;
  bool _isLoading = false;
  String? _lastError;

  Future<void> initializeAds({List<String>? pageIds}) async {
    if (_adsInitialized || _isLoading) return;

    _isLoading = true;
    _lastError = null;
    notifyListeners();

    try {
      final adUnits = {
        'standings': 'ca-app-pub-4763306780710624/8267618237',
        'listPage': 'ca-app-pub-4763306780710624/1331614142',
        'driverPage': 'ca-app-pub-4763306780710624/8550433073',
        'teamPage': 'ca-app-pub-4763306780710624/8304813072',
        'grandprixPage': 'ca-app-pub-4763306780710624/8079659788',
        'calendarPage': 'ca-app-pub-4763306780710624/9249271222',
      };

      // Filtrar solo los pageIds solicitados o cargar todos si no se especifica
      final targetPageIds = pageIds?.where((id) => adUnits.containsKey(id)).toList() ?? adUnits.keys.toList();
      debugPrint('Initializing ads for: $targetPageIds');

      // Cargar anuncios de forma concurrente con manejo de errores granular
      final futures = targetPageIds.map((pageId) => _loadBannerAd(pageId, adUnits[pageId]!));
      final results = await Future.wait(futures, eagerError: false);

      // Verificar si hubo errores
      final errors = results.whereType<String>().toList();
      if (errors.isNotEmpty) {
        _lastError = 'Failed to load some ads: ${errors.join(", ")}';
        debugPrint(_lastError);
      } else {
        debugPrint('All ads loaded successfully');
      }

      _adsInitialized = true;
    } catch (e) {
      _lastError = 'Failed to initialize ads: ${e.toString()}';
      debugPrint(_lastError);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void loadRemainingAdsInBackground() {
    if (_isLoading) return;

    final adUnits = {
      'standings': 'ca-app-pub-4763306780710624/8267618237',
      'listPage': 'ca-app-pub-4763306780710624/1331614142',
      'driverPage': 'ca-app-pub-4763306780710624/8550433073',
      'teamPage': 'ca-app-pub-4763306780710624/8304813072',
      'grandprixPage': 'ca-app-pub-4763306780710624/8079659788',
      'calendarPage': 'ca-app-pub-4763306780710624/9249271222',
      'grandprixlistPage': 'ca-app-pub-4763306780710624/9753702098',
    };

    // Identificar los pageIds que aún no se han cargado
    final remainingPageIds = adUnits.keys.where((pageId) => !_bannerAds.containsKey(pageId)).toList();

    if (remainingPageIds.isEmpty) {
      debugPrint('No remaining ads to load in background');
      return;
    }

    debugPrint('Loading remaining ads in background: $remainingPageIds');

    // Cargar los banners restantes de forma asíncrona
    Future(() async {
      try {
        final futures = remainingPageIds.map((pageId) => _loadBannerAd(pageId, adUnits[pageId]!));
        final results = await Future.wait(futures, eagerError: false);

        // Verificar si hubo errores
        final errors = results.whereType<String>().toList();
        if (errors.isNotEmpty) {
          debugPrint('Background ad loading errors: ${errors.join(", ")}');
        } else {
          debugPrint('All remaining ads loaded successfully in background');
        }
      } catch (e) {
        debugPrint('Error loading remaining ads in background: $e');
      }
    });
  }

  Future<dynamic> _loadBannerAd(String pageId, String adUnitId) async {
    if (_bannerAds.containsKey(pageId)) return;

    try {
      final banner = BannerAd(
        adUnitId: adUnitId,
        request: const AdRequest(),
        size: AdSize.fullBanner,
        listener: BannerAdListener(
          onAdLoaded: (Ad ad) {
            debugPrint('$pageId banner loaded');
          },
          onAdFailedToLoad: (Ad ad, LoadAdError error) {
            debugPrint('$pageId banner failed to load: $error');
            ad.dispose();
            _bannerAds.remove(pageId);
          },
        ),
      );

      await banner.load();
      _bannerAds[pageId] = banner;
    } catch (e) {
      return 'Error loading $pageId: $e';
    }
  }

  BannerAd? getBannerAd(String pageId) {
    return _bannerAds[pageId];
  }

  bool get isLoading => _isLoading;
  bool get isInitialized => _adsInitialized;
  String? get lastError => _lastError;

  @override
  void dispose() {
    for (var ad in _bannerAds.values) {
      ad.dispose();
    }
    _bannerAds.clear();
    super.dispose();
  }
}