import 'package:flutter/material.dart';

final ThemeData lightTheme = ThemeData(
  brightness: Brightness.light,
  primaryColor: Color(0xFFD50000), // Rojo vibrante
  scaffoldBackgroundColor: Color(0xFFFFFFFF), // Blanco puro
  appBarTheme: AppBarTheme(
    backgroundColor: Color(0xFFD50000), // Rojo vibrante
    foregroundColor: Colors.white, // Texto en blanco
    elevation: 4,
  ),
  bottomNavigationBarTheme: BottomNavigationBarThemeData(
    backgroundColor: Color(0xFFD50000), // Rojo vibrante
    selectedItemColor: Color(0xFFD50000),
    unselectedItemColor: Color.fromARGB(255, 165, 165, 165), // Gris oscuro
  ),
  textTheme: TextTheme(
    bodyLarge: TextStyle(color: Colors.black), // Texto principal
    bodyMedium: TextStyle(color: Color(0xFF555555)), // Texto secundario
  ),
  cardColor: Color(0xFFF5F5F5), // Fondo de tarjetas
  dividerColor: Color(0xFFDDDDDD), // Separadores
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
