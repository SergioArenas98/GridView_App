import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:gridview/models/driver.dart';
import 'package:gridview/models/grand_prix.dart';
import 'package:gridview/models/team.dart';
import 'package:hive/hive.dart';
import 'package:http/http.dart' as http;

final String baseUrl = "https://f1connectbackend-production.up.railway.app/api";

const Map<String, String> cacheKeys = {
  'grandprix': 'grandprix_cache',
  'drivers': 'drivers_cache',
  'teams': 'teams_cache',
};

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  List<GrandPrix>? grandsPrix;
  List<Driver>? drivers;
  List<Team>? teams;

  Future<void> fetchAllData() async {
    // Evitar recarga si todos los datos ya están disponibles
    if (grandsPrix != null && drivers != null && teams != null) {
      debugPrint('Data already loaded, skipping fetch');
      return;
    }

    Box? box;
    try {
      if (Hive.isBoxOpen('cache')) {
        box = Hive.box('cache');
      } else {
        debugPrint('Hive box "cache" not open. Proceeding without cache.');
      }
    } catch (e) {
      debugPrint('Error accessing Hive box: $e. Proceeding without cache.');
    }

    final now = DateTime.now();
    final lastUpdate = box != null && box.containsKey('last_cache_update')
        ? DateTime.tryParse(box.get('last_cache_update') ?? '')
        : null;

    // Invalidar caché cada 24 horas
    final isCacheInvalid = lastUpdate == null || now.isAfter(lastUpdate.add(const Duration(hours: 24)));

    final fetchTasks = [
      if (grandsPrix == null)
        _fetchAndCache(
          'grandprix',
          '$baseUrl/grandprix/index',
          (data) => grandsPrix = data.map<GrandPrix>((json) => GrandPrix.fromJson(json)).toList(),
          isCacheInvalid,
          box,
        ),
      if (drivers == null)
        _fetchAndCache(
          'drivers',
          '$baseUrl/driver/index',
          (data) => drivers = data.map<Driver>((json) => Driver.fromJson(json)).toList(),
          isCacheInvalid,
          box,
        ),
      if (teams == null)
        _fetchAndCache(
          'teams',
          '$baseUrl/team/index',
          (data) => teams = data.map<Team>((json) => Team.fromJson(json)).toList(),
          isCacheInvalid,
          box,
        ),
    ];

    if (fetchTasks.isEmpty) {
      debugPrint('No fetch tasks needed, all data already loaded');
      return;
    }

    final results = await Future.wait(fetchTasks, eagerError: false);
    final errors = results.whereType<String>().toList();
    if (errors.isNotEmpty) {
      debugPrint('Errors fetching data: ${errors.join(", ")}');
    }

    if (isCacheInvalid && box != null) {
      try {
        await box.put('last_cache_update', now.toIso8601String());
      } catch (e) {
        debugPrint('Error updating last_cache_update: $e');
      }
    }
  }

  Future<dynamic> _fetchAndCache(
    String key,
    String url,
    Function(List<dynamic>) assignData,
    bool isCacheInvalid,
    Box? box,
  ) async {
    const maxRetries = 3;

    if (!isCacheInvalid && box != null && box.containsKey(cacheKeys[key]!)) {
      try {
        final cachedData = box.get(cacheKeys[key]!);
        final jsonData = json.decode(cachedData);
        assignData(jsonData);
        return;
      } catch (e) {
        debugPrint('Error decoding cache for $key: $e');
      }
    }

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        final response = await http.get(Uri.parse(url));
        if (response.statusCode == 200) {
          final decodedBody = utf8.decode(response.bodyBytes);
          if (box != null) {
            try {
              await box.put(cacheKeys[key]!, decodedBody);
            } catch (e) {
              debugPrint('Error caching data for $key: $e');
            }
          }
          final jsonData = json.decode(decodedBody);
          assignData(jsonData);
          return;
        } else {
          debugPrint('Error ${response.statusCode} fetching $key');
        }
      } catch (e) {
        debugPrint('Attempt $attempt failed for $key: $e');
        if (attempt == maxRetries) {
          return 'Error fetching $key: $e';
        }
        await Future.delayed(const Duration(seconds: 1));
      }
    }
  }
}