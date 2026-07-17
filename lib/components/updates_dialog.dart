import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gridview/l10n/app_localizations.dart';
import 'package:gridview/utils/constants.dart';

class UpdatesDialog {
  static Future<void> show(BuildContext context) async {
    try {
      // Cargar el JSON desde los assets
      final jsonString = await rootBundle.loadString('assets/data/updates.json');
      final data = jsonDecode(jsonString);
      
      // Formatear las actualizaciones
      final updates = _formatUpdates(data['updates']);

      // Mostrar el diálogo
      if (context.mounted) {
        _showDialog(context, updates);
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error loading updates: ${e.toString()}'),
          ),
        );
      }
    }
  }

  static List<String> _formatUpdates(List<dynamic> updatesData) {
    final List<String> result = [];
    
    for (final update in updatesData) {
      // Añadir línea de versión
      result.add("${update['version']} (${update['date']})");
      
      // Añadir todos los cambios
      for (final change in update['changes']) {
        result.add("- $change");
      }
      
      // Añadir línea vacía entre versiones
      result.add("");
    }
    
    // Eliminar la última línea vacía si existe
    if (result.isNotEmpty && result.last.isEmpty) {
      result.removeLast();
    }
    
    return result;
  }

  static void _showDialog(BuildContext context, List<String> updates) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Center(
          child: Text(
            AppLocalizations.of(context)!.latestDevelopments,
            style: mainTitle.copyWith(color: Colors.red),
          ),
        ),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: updates.map((update) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Text(
                  update,
                  style: TextStyle(
                    color: Theme.of(context).textTheme.bodyMedium?.color,
                    fontSize: update.startsWith("v") ? 17.0 : 15.0,
                    fontWeight: update.startsWith("v") 
                        ? FontWeight.bold 
                        : FontWeight.normal,
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              AppLocalizations.of(context)!.close,
              style: mainText.copyWith(color: Colors.red),
            ),
          ),
        ],
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        backgroundColor: Theme.of(context).cardColor,
      ),
    );
  }
}