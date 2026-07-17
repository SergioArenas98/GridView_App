import 'dart:async';
import 'package:flutter/scheduler.dart';
import 'package:gridview/routes/bottom_navigator_bar.dart';
import 'package:gridview/services/ad_provider.dart';
import 'package:gridview/services/grand_prix_provider.dart';
import 'package:gridview/themes/theme_provider.dart';
import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';
import 'package:provider/provider.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  bool _hasError = false;
  String? _errorMessage;
  int _retryCount = 0;
  static const int _maxRetries = 3;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      _initializeApp();
    });
  }

  Future<void> _initializeApp() async {
    try {
      // Cargar tema (ligero, se mantiene en el hilo principal)
      await Provider.of<ThemeProvider>(context, listen: false).loadThemeFromPrefs();

      // Cargar anuncios y datos en el hilo principal
      await _loadHeavyTasks();

      // Navegar a la página principal
      if (mounted) {
        SchedulerBinding.instance.addPostFrameCallback((_) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => const BottomNavigatorBar()),
          );
        });
      }
    } catch (e) {
      if (_retryCount < _maxRetries) {
        _retryCount++;
        await Future.delayed(const Duration(seconds: 2));
        _initializeApp();
      } else {
        setState(() {
          _hasError = true;
          _errorMessage = e.toString().contains('HiveError')
              ? 'Error initializing cache. Please try again.'
              : 'Error loading data: $e';
        });
      }
    }
  }

  Future<void> _loadHeavyTasks() async {
    final adProvider = Provider.of<AdProvider>(context, listen: false);
    final grandPrixProvider = Provider.of<GrandPrixProvider>(context, listen: false);
    
    // 1. Carga crítica (GP)
    await grandPrixProvider.fetchGrandsPrix();
    
    // 2. Anuncios prioritarios
    await adProvider.initializeAds(pageIds: ['standings']);
    
    // 3. Carga en segundo plano (no esperamos)
    adProvider.loadRemainingAdsInBackground();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const SizedBox(height: 50),
            Image.asset(
              'assets/images/logo/logo_gridview.png',
              width: 350,
              height: 350,
            ),
            if (_hasError)
              Column(
                children: [
                  Text(
                    _errorMessage ?? 'Error loading data',
                    style: const TextStyle(color: Colors.red),
                  ),
                  const SizedBox(height: 15),
                  ElevatedButton(
                    onPressed: () {
                      setState(() {
                        _hasError = false;
                        _retryCount = 0;
                      });
                      _initializeApp();
                    },
                    child: const Text('Retry'),
                  ),
                ],
              )
            else
              Padding(
                padding: EdgeInsets.only(right: 60),
                child: Lottie.asset(
                  'assets/animations/wheel.json',
                  width: 350,
                  height: 350,
                  fit: BoxFit.contain,
                ),
              ),
          ],
        ),
      ),
    );
  }
}