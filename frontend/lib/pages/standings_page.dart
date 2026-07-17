import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:gridview/l10n/app_localizations.dart';
import 'package:gridview/models/driver.dart';
import 'package:gridview/models/team.dart';
import 'package:gridview/pages/driver_page.dart';
import 'package:gridview/pages/team_page.dart';
import 'package:gridview/services/ad_provider.dart';
import 'package:gridview/services/api_service.dart';
import 'package:gridview/utils/constants.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class StandingsPage extends StatefulWidget {
  const StandingsPage({super.key});

  @override
  StandingsPageState createState() => StandingsPageState();
}

class StandingsPageState extends State<StandingsPage> {
  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    // Obtener datos directamente desde ApiService
    List<Driver> drivers = ApiService().drivers ?? [];
    List<Team> teams = ApiService().teams ?? [];
    final bannerAd = Provider.of<AdProvider>(context).getBannerAd('standings');

    // Filtrar y ordenar pilotos
    drivers = drivers.where((driver) {
      return driver.standingPosition != null && driver.standingPosition! > 0;
    }).toList()
      ..sort((a, b) =>
          (a.standingPosition ?? 0).compareTo(b.standingPosition ?? 0));

    // Ordenar equipos
    teams = teams.toList()
      ..sort((a, b) =>
          (a.standingPosition ?? 0).compareTo(b.standingPosition ?? 0));

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title:
              Text(AppLocalizations.of(context)!.standings, style: mainTitle),
          centerTitle: true,
          bottom: TabBar(
            indicatorColor: Theme.of(context).appBarTheme.backgroundColor,
            labelStyle: tapBarSelected.copyWith(
                color: Theme.of(context).textTheme.bodyLarge?.color),
            unselectedLabelStyle: tapBarUnselected.copyWith(
                color: Theme.of(context).textTheme.bodyLarge?.color),
            tabs: [
              Tab(
                text: AppLocalizations.of(context)!.drivers,
              ),
              Tab(
                text: AppLocalizations.of(context)!.teams,
              ),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            // Mostrar clasificación de pilotos
            Container(
              margin: EdgeInsets.only(top: 10),
              child: ListView.builder(
                itemCount: drivers.length,
                itemBuilder: (context, index) {
                  Driver currentDriver = drivers[index];
                  return Padding(
                    padding:
                        const EdgeInsets.symmetric(vertical: 5, horizontal: 15),
                    child: GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          PageRouteBuilder(
                            pageBuilder: (context, animation, secondaryAnimation) {
                              return DriverPage(driver: currentDriver);
                            },
                            transitionsBuilder: (context, animation, secondaryAnimation, child) {
                              const begin = Offset(1.0, 0.0);
                              const end = Offset.zero;
                              const curve = Curves.easeInOut;

                              var tween = Tween(begin: begin, end: end).chain(CurveTween(curve: curve));
                              var offsetAnimation = animation.drive(tween);

                              return SlideTransition(
                                position: offsetAnimation, child: child);
                            },
                          ),
                        );
                      },
                      child: Stack(
                        children: [
                          Row(
                            children: [
                              // Contenedor para la posición
                              Transform.translate(
                                offset: Offset(-5, 0),
                                child: Container(
                                  width: 55,
                                  height: 60,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: Theme.of(context).cardColor,
                                    borderRadius: BorderRadius.only(
                                      topLeft: Radius.circular(2),
                                      bottomLeft: Radius.circular(2),
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withAlpha(51),
                                        blurRadius: 8,
                                        spreadRadius: 5,
                                        offset: Offset(0, 4),
                                      ),
                                    ],
                                  ),
                                  child: Center(
                                    child: Text(
                                      "${currentDriver.standingPosition}",
                                      style: mainText.copyWith(color: Theme.of(context).textTheme.bodyLarge?.color),
                                    ),
                                  ),
                                ),
                              ),

                              // Contenedor para el nombre y logo (con gradiente)
                              Expanded(
                                child: Container(
                                  height: 60,
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: [
                                        Color(int.parse(currentDriver.teamColor)),
                                        Color(int.parse(currentDriver.teamColor)).withAlpha((0.7 * 255).toInt()),
                                      ],
                                      stops: [0.0, 0.5],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withAlpha(51),
                                        blurRadius: 8,
                                        spreadRadius: 5,
                                        offset: Offset(0, 4),
                                      ),
                                    ],
                                  ),
                                  child: Row(
                                    children: [
                                      SizedBox(width: 45),
                                      SizedBox(
                                        width: 170,
                                        child: Text(
                                          currentDriver.driverFullName,
                                          style: mainText.copyWith(color: Colors.black),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      Image.asset(
                                        teamLogosPath + currentDriver.teamLogo,
                                        width: 50,
                                      ),
                                      SizedBox(width: 20),
                                      Expanded(
                                        child: Container(
                                          alignment: Alignment.center,
                                          padding: EdgeInsets.only(right: 15),
                                          child: Text(
                                            (currentDriver.standingPoints != null ? currentDriver.standingPoints!.toStringAsFixed(currentDriver.standingPoints! % 1 == 0 ? 0 : 1) : '0'),
                                            style: mainText.copyWith(color: Theme.of(context).textTheme.bodyLarge?.color),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),

                          // Imagen del piloto colocada encima
                          Positioned(
                            left: 2, // Ajusta según el diseño
                            top: -5,
                            child: Image.asset(
                              driversPath + currentDriver.driverImg,
                              width: 120,
                              height: 120,
                              fit: BoxFit.cover,
                              alignment: Alignment(0, -0.5),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),

            // Mostrar clasificación de equipos
            // Team standings - redesigned to match drivers style
            Container(
              margin: EdgeInsets.only(top: 10),
              child: ListView.builder(
                itemCount: teams.length,
                itemBuilder: (context, index) {
                  Team currentTeam = teams[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 15),
                    child: GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          PageRouteBuilder(
                            pageBuilder: (context, animation, secondaryAnimation) {
                              return TeamPage(team: currentTeam);
                            },
                            transitionsBuilder: (context, animation, secondaryAnimation, child) {
                              const begin = Offset(1.0, 0.0);
                              const end = Offset.zero;
                              const curve = Curves.easeInOut;

                              var tween = Tween(begin: begin, end: end).chain(CurveTween(curve: curve));
                              var offsetAnimation = animation.drive(tween);

                              return SlideTransition(position: offsetAnimation, child: child);
                            },
                          ),
                        );
                      },
                      child: Stack(
                        children: [
                          Row(
                            children: [
                              // Position container
                              Container(
                                width: 55,
                                height: 60,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: Theme.of(context).cardColor,
                                  borderRadius: BorderRadius.only(
                                    topLeft: Radius.circular(2),
                                    bottomLeft: Radius.circular(2),
                                  ),
                                ),
                                child: Center(
                                  child: Text(
                                    "${currentTeam.standingPosition}",
                                    style: mainText.copyWith(
                                        color: Theme.of(context)
                                            .textTheme
                                            .bodyLarge
                                            ?.color),
                                  ),
                                ),
                              ),

                              // Team name and logo container with gradient
                              Expanded(
                                child: Container(
                                  height: 60,
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: [
                                        Color(int.parse(currentTeam.color)),
                                        Color(int.parse(currentTeam.color)).withAlpha((0.8 * 255).toInt()),
                                      ],
                                      stops: [0.0, 0.8],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      Padding(
                                        padding:
                                            const EdgeInsets.only(left: 20),
                                        child: SizedBox(
                                          width: 160,
                                          child: Text(
                                            currentTeam.teamShortName,
                                            style: mainText.copyWith(
                                                color: Colors.black),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ),
                                      Padding(
                                        padding:
                                            const EdgeInsets.only(left: 20),
                                        child: Image.asset(
                                          teamLogosPath + currentTeam.logoImg,
                                          width: 50,
                                        ),
                                      ),
                                      // Dentro del Row que contiene los elementos del equipo, modifica el Text de los puntos así:
                                      Expanded(
                                        child: Container(
                                          alignment: Alignment.center,
                                          padding: EdgeInsets.only(right: 0),
                                          child: Text(
                                            currentTeam.standingPoints
                                                .toStringAsFixed(
                                                    currentTeam.standingPoints %
                                                                1 ==
                                                            0
                                                        ? 0
                                                        : 1),
                                            style: mainText.copyWith(
                                                color: Theme.of(context)
                                                    .textTheme
                                                    .bodyLarge
                                                    ?.color),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
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
