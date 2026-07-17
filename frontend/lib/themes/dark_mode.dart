import 'package:flutter/material.dart';

final ThemeData darkTheme = ThemeData(
  brightness: Brightness.dark,
  primaryColor: Color(0xFF9B0000), // Rojo oscuro
  scaffoldBackgroundColor: Color(0xFF121212), // Negro profundo
  appBarTheme: AppBarTheme(
    backgroundColor: Color(0xFF9B0000), // Rojo oscuro
    foregroundColor: Colors.white,
    elevation: 4,
  ),
  bottomNavigationBarTheme: BottomNavigationBarThemeData(
    backgroundColor: Color(0xFF9B0000), // Rojo oscuro
    selectedItemColor: Color(0xFFD50000),
    unselectedItemColor: Color(0xFF444444), // Gris claro
  ),
  textTheme: TextTheme(
    bodyLarge: TextStyle(color: Colors.white), // Texto principal
    bodyMedium: TextStyle(color: Color(0xFFBBBBBB)), // Texto secundario
  ),
  cardColor: Color(0xFF444444), // Fondo de tarjetas
  dividerColor: Color(0xFF444444), // Separadores
  buttonTheme: ButtonThemeData(
    buttonColor: Color(0xFFD50000), // Botón principal en rojo
  ),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: Color(0xFFD50000), // Botón principal
      foregroundColor: Colors.white,
    ),
  ),
);