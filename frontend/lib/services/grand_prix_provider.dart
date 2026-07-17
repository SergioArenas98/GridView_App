import 'package:flutter/material.dart';
import 'package:gridview/models/grand_prix.dart';
import 'package:gridview/services/api_service.dart';

class GrandPrixProvider with ChangeNotifier {
  List<GrandPrix>? _grandsPrix;
  bool _isLoading = false;
  String? _error;

  List<GrandPrix>? get grandsPrix => _grandsPrix;
  bool get isLoading => _isLoading;
  String? get error => _error;

  final ApiService _apiService;

  GrandPrixProvider(this._apiService);

  Future<void> fetchGrandsPrix() async {
    if (_grandsPrix != null) return;

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.fetchAllData();
      _grandsPrix = _apiService.grandsPrix;
      if (_grandsPrix == null || _grandsPrix!.isEmpty) {
        _error = 'No grand prix available';
      }
    } catch (e) {
      _error = 'Error fetching grand prix: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}