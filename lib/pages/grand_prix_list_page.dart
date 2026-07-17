import 'package:flutter/material.dart';
import 'package:flutter/services.dart'; // Para HapticFeedback
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:gridview/components/grand_prix_list.dart';
import 'package:gridview/l10n/app_localizations.dart';
import 'package:gridview/models/grand_prix.dart';
import 'package:gridview/services/ad_provider.dart';
import 'package:gridview/services/grand_prix_provider.dart';
import 'package:gridview/utils/constants.dart';
import 'package:provider/provider.dart';
import 'calendar_page.dart';

class GrandPrixListPage extends StatefulWidget {
  const GrandPrixListPage({super.key});

  @override
  GrandPrixListPageState createState() => GrandPrixListPageState();
}

class GrandPrixListPageState extends State<GrandPrixListPage> {
  final TextEditingController searchController = TextEditingController();
  final List<String> _categories = ["F1", "F2", "F3", "F1 Academy"];
  String _selectedCategory = '';
  List<GrandPrix> _filteredGrandsPrix = [];

  @override
  void initState() {
    super.initState();
    final provider = Provider.of<GrandPrixProvider>(context, listen: false);
    if (provider.grandsPrix == null) {
      provider.fetchGrandsPrix();
    }
    searchController.addListener(_filterGrandsPrix);
  }

  @override
  void dispose() {
    searchController.removeListener(_filterGrandsPrix);
    searchController.dispose();
    super.dispose();
  }

  void _filterGrandsPrix() {
    final provider = Provider.of<GrandPrixProvider>(context, listen: false);
    final allGrandsPrix = provider.grandsPrix ?? [];

    setState(() {
      _filteredGrandsPrix = allGrandsPrix.where((grandPrix) {
        bool matchesSearch = grandPrix.shortName
            .toLowerCase()
            .contains(searchController.text.toLowerCase());
        bool matchesCategory = _selectedCategory.isEmpty ||
            grandPrix.categories.any((category) {
              return category.name.toLowerCase() == _selectedCategory.toLowerCase();
            });
        return matchesSearch && matchesCategory;
      }).toList();
    });
  }

  void _selectCategory(String category) {
    setState(() {
      _selectedCategory = _selectedCategory == category ? '' : category;
      _filterGrandsPrix();
    });
  }

  @override
  Widget build(BuildContext context) {
    final bannerAd = Provider.of<AdProvider>(context).getBannerAd('grandprixlistPage');
    final theme = Theme.of(context);
    final provider = Provider.of<GrandPrixProvider>(context);

    // Usa los datos directamente del provider
    final displayList = provider.grandsPrix != null 
        ? _filteredGrandsPrix.isEmpty 
            ? provider.grandsPrix! 
            : _filteredGrandsPrix
        : [];

    return Scaffold(
      appBar: AppBar(
        title: Text(
          "${AppLocalizations.of(context)!.season} ${2025}",
          style: mainTitle.copyWith(color: theme.textTheme.bodyLarge?.color),
        ),
        centerTitle: true,
      ),
      body: Column(
        children: [
          // Barra de búsqueda
          Container(
            margin: const EdgeInsets.only(left: 15, top: 15, right: 15, bottom: 5),
            padding: const EdgeInsets.only(left: 15),
            decoration: BoxDecoration(
              color: theme.bottomNavigationBarTheme.unselectedItemColor,
              borderRadius: BorderRadius.circular(2),
              border: Border.all(
                color: Colors.black,
                width: 1.5,
              ),
            ),
            child: TextField(
              controller: searchController,
              decoration: InputDecoration(
                hintText: "${AppLocalizations.of(context)!.search}...",
                border: InputBorder.none,
                hintStyle: secondaryText.copyWith(
                  color: theme.textTheme.bodyLarge?.color,
                ),
              ),
              style: secondaryTitle.copyWith(
                color: theme.textTheme.bodyLarge?.color,
              ),
            ),
          ),
          
          // Categorías
          Wrap(
            spacing: 12,
            children: _categories.map((category) {
              bool isSelected = _selectedCategory == category;
              return ChoiceChip(
                label: Text(
                  category,
                  style: selectorText.copyWith(
                    color: theme.textTheme.bodyLarge?.color,
                  ),
                ),
                selected: isSelected,
                onSelected: (_) => _selectCategory(category),
                selectedColor: theme.bottomNavigationBarTheme.selectedItemColor,
                backgroundColor: theme.bottomNavigationBarTheme.unselectedItemColor,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(2),
                ),
                side: const BorderSide(
                  color: Colors.black,
                  width: 1,
                ),
              );
            }).toList(),
          ),
          
          const SizedBox(height: 15),
          
          // Lista de Grandes Premios
          Expanded(
            child: provider.isLoading
                ? const Center(child: CircularProgressIndicator())
                : provider.error != null
                    ? Center(child: Text(provider.error!))
                    : displayList.isEmpty
                        ? Center(child: Text(
                            AppLocalizations.of(context)!.noResultsFound,
                            style: secondaryTitle,
                          ))
                        : ListView.builder(
                            itemCount: displayList.length,
                            itemBuilder: (context, index) {
                              final grandPrix = displayList[index];
                              return GrandPrixList(grandPrix: grandPrix);
                            },
                          ),
          ),
        ],
      ),
      // Botón flotante del calendario
      floatingActionButton: FloatingActionButton(
        heroTag: 'calendar_fab',
        backgroundColor: Colors.red[800],
        foregroundColor: Colors.white,
        elevation: 6,
        tooltip: AppLocalizations.of(context)!.calendar,
        onPressed: provider.grandsPrix == null || provider.grandsPrix!.isEmpty
            ? null
            : () {
                HapticFeedback.lightImpact();
                
                if (!mounted) return;
                
                Navigator.push(
                  context,
                  PageRouteBuilder(
                    pageBuilder: (_, __, ___) => const CalendarPage(),
                    transitionsBuilder: (_, animation, __, child) => FadeTransition(opacity: animation, child: child),
                    transitionDuration: const Duration(milliseconds: 100),
                  ),
                );
              },
        child: const Icon(Icons.calendar_month, size: 28),
      ),
      
      // Margen inferior para no solapar con el FAB
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      
      // Banner de publicidad
      bottomNavigationBar: bannerAd != null
          ? SizedBox(
              height: bannerAd.size.height.toDouble(),
              width: bannerAd.size.width.toDouble(),
              child: AdWidget(ad: bannerAd),
            )
          : null,
    );
  }
}