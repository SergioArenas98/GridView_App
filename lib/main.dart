import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:gridview/l10n/app_localizations.dart';
import 'package:gridview/pages/splash_page.dart';
import 'package:gridview/services/ad_provider.dart';
import 'package:gridview/services/language_provider.dart';
import 'package:gridview/services/grand_prix_provider.dart';
import 'package:gridview/services/api_service.dart';
import 'package:gridview/themes/dark_mode.dart';
import 'package:gridview/themes/light_mode.dart';
import 'package:gridview/themes/theme_provider.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:path_provider/path_provider.dart';
import 'package:hive_flutter/hive_flutter.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Inicializar Hive con un directorio específico
  try {
    final appDocumentDir = await getApplicationDocumentsDirectory();
    await Hive.initFlutter(appDocumentDir.path);
    await Hive.openBox('cache');
  } catch (e) {
    debugPrint('Error initializing Hive: $e');
  }

  // Configuración del tema
  final prefs = await SharedPreferences.getInstance();
  final isDarkMode = prefs.getBool("isDarkMode") ?? false;
  final initialTheme = isDarkMode ? darkTheme : lightTheme;

  // Configuración del idioma
  final languageProvider = LanguageProvider();
  await languageProvider.loadLocale();

  // AdMob
  await MobileAds.instance.initialize();
  
  final apiService = ApiService();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (context) => ThemeProvider(initialTheme)),
        ChangeNotifierProvider(create: (context) => AdProvider()),
        ChangeNotifierProvider.value(value: languageProvider),
        Provider.value(value: apiService),
        ChangeNotifierProvider(
          create: (context) => GrandPrixProvider(context.read<ApiService>()),
        ),
      ],
      child: const MainApp(),
    ),
  );
}

class MainApp extends StatelessWidget {
  const MainApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: const SplashPage(),
      theme: Provider.of<ThemeProvider>(context).themeData,
      locale: Provider.of<LanguageProvider>(context).locale,
      supportedLocales: const [
        Locale('en'),
        Locale('es'),
        Locale('it'),
        Locale('pt'),
        Locale('fr'),
        Locale('de'),
        Locale('ca'),
      ],
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    );
  }
}