import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:gridview/l10n/app_localizations.dart';
import 'package:gridview/services/ad_provider.dart';
import 'package:gridview/services/api_service.dart';
import 'package:gridview/utils/constants.dart';
import 'package:flutter/material.dart';
import 'package:gridview/models/driver.dart';
import 'package:gridview/models/team.dart';
import 'package:provider/provider.dart';
import 'package:gridview/components/driver_card.dart';
import 'package:gridview/components/team_card.dart';

class DriverListPage extends StatefulWidget {
  const DriverListPage({super.key});

  @override
  DriverListPageState createState() => DriverListPageState();
}

class DriverListPageState extends State<DriverListPage> {
  TextEditingController searchController = TextEditingController();
  List<Driver> drivers = [];
  List<Team> teams = [];
  List<String> roles = ['Starting', 'Reserve'];
  String _selectedRole = 'Starting';
  List<Driver> _filteredDrivers = [];
  bool isLoading = true;

  // Define el orden de los equipos
  List<String> teamOrder = [
    'McLaren',
    'Ferrari',
    'Red Bull Racing',
    'Mercedes',
    'Aston Martin',
    'Alpine',
    'Haas',
    'Racing Bulls',
    'Williams',
    'Kick Sauber',
  ];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      List<Team>? loadedTeams = ApiService().teams!;
      List<Driver> loadedDrivers = [];

      // Extraemos todos los pilotos de cada equipo
      for (var team in loadedTeams) {
        loadedDrivers.addAll(team.drivers);
      }

      if (mounted) {
        setState(() {
          loadedTeams.sort((a, b) {
            int indexA = teamOrder.indexOf(a.teamShortName);
            int indexB = teamOrder.indexOf(b.teamShortName);
            return indexA.compareTo(indexB);
          });

          teams = loadedTeams;
          drivers = loadedDrivers;
          _filterDrivers();
          isLoading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          drivers = [];
          teams = [];
          isLoading = false;
        });
      }
    }
  }

  void _filterDrivers() {
    setState(() {
      _filteredDrivers = drivers.where((driver) {
        bool matchesSearch = driver.driverName.toLowerCase().contains(searchController.text.toLowerCase()) || driver.driverSurname.toLowerCase().contains(searchController.text.toLowerCase());

        // Filtrar por rol
        bool matchesRole = driver.role == _selectedRole;

        return matchesSearch && matchesRole;
      }).toList();
      // Ordenar los pilotos por su número de piloto (driverNumber)
      _filteredDrivers
          .sort((a, b) => (a.carNumber ?? 0).compareTo(b.carNumber ?? 0));
    });
  }

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bannerAd = Provider.of<AdProvider>(context).getBannerAd('listPage');

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            AppLocalizations.of(context)!.driversTeams,
            style: mainTitle,
          ),
          centerTitle: true,
          bottom: TabBar(
            indicatorColor: Theme.of(context).appBarTheme.backgroundColor,
            labelStyle: tapBarSelected.copyWith(color: Theme.of(context).textTheme.bodyLarge?.color),
            unselectedLabelStyle: tapBarUnselected.copyWith(color: Theme.of(context).textTheme.bodyLarge?.color),
            tabs: [
              Tab(text: AppLocalizations.of(context)!.drivers),
              Tab(text: AppLocalizations.of(context)!.teams),
            ],
          ),
        ),
        body: isLoading
            ? Center(child: CircularProgressIndicator())
            : TabBarView(
                children: [
                  // Mostrar pilotos
                  Column(
                    children: [
                      // Filtro de rol de piloto
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Wrap(
                          spacing: 12,
                          children: roles.map((role) {
                            return ChoiceChip(
                              label: Text(
                                role,
                                style: selectorText.copyWith(color: Theme.of(context).textTheme.bodyLarge?.color),
                              ),
                              selected: _selectedRole == role,
                              onSelected: (_) {
                                setState(() {
                                  _selectedRole = role;
                                  _filterDrivers();
                                });
                              },
                              selectedColor: Theme.of(context).bottomNavigationBarTheme.selectedItemColor,
                              backgroundColor: Theme.of(context).bottomNavigationBarTheme.unselectedItemColor,
                            );
                          }).toList(),
                        ),
                      ),
                      // Lista de pilotos filtrados
                      Expanded(
                        child: ListView.builder(
                          itemCount: _filteredDrivers.length,
                          itemBuilder: (context, index) {
                            return DriverCard(driver: _filteredDrivers[index]);
                          },
                        ),
                      ),
                    ],
                  ),
                  // Mostrar equipos
                  ListView.builder(
                    itemCount: teams.length,
                    itemBuilder: (context, index) {
                      return TeamCard(team: teams[index]);
                    },
                  ),
                ],
              ),
              bottomNavigationBar: bannerAd != null
                  ? SizedBox(
                      height: bannerAd.size.height.toDouble(),
                      width: bannerAd.size.width.toDouble(),
                      child: AdWidget(ad: bannerAd),
                    )
                  : null,
      ),
    );
  }
}
