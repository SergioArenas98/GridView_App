import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:gridview/components/driver_card.dart';
import 'package:gridview/l10n/app_localizations.dart';
import 'package:gridview/services/ad_provider.dart';
import 'package:gridview/utils/constants.dart';
import 'package:flutter/material.dart';
import 'package:gridview/models/team.dart';
import 'package:gridview/models/driver.dart';
import 'package:provider/provider.dart';

class TeamPage extends StatelessWidget {
  final Team team;

  const TeamPage({
    super.key,
    required this.team,
  });

  @override
  Widget build(BuildContext context) {
    // Separar los pilotos en dos listas según su rol
    List<Driver> startingDrivers =
        team.drivers.where((driver) => driver.role == 'Starting').toList();
    List<Driver> reserveDrivers =
        team.drivers.where((driver) => driver.role == 'Reserve').toList();
    final bannerAd = Provider.of<AdProvider>(context).getBannerAd('teamPage');

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(
          team.teamShortName,
          style: mainTitle,
        ),
        backgroundColor: Color(int.parse(team.color)),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            Container(
              color: Color(int.parse(team.color)),
              width: double.infinity,
              child: SizedBox(
                width: 190,
                height: 100,
                child: Padding(
                  padding: const EdgeInsets.only(top: 15, bottom: 15),
                  child: Image.asset(
                    teamLogosPath + team.mainLogoImg,
                    fit: BoxFit.contain,
                  ),
                ),
              ),
            ),
            Container(
              color: Color(int.parse(team.color)),
              width: double.infinity,
              height: 120,
              child: Stack(
                children: [
                  Image.asset(
                    carsPath + team.carImg,
                    fit: BoxFit.cover,
                    width: double.infinity,
                    height: 120,
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(left: 10, right: 10),
              child: Column(
                children: [
                  SizedBox(height: 15),
                  _buildInfoCard(context, AppLocalizations.of(context)!.country,
                      team.country),
                  _buildInfoCard(context, AppLocalizations.of(context)!.base,
                      team.teamBase),
                  _buildInfoCard(
                      context,
                      AppLocalizations.of(context)!.teamPrincipal,
                      team.teamChief),
                  _buildInfoCard(
                      context,
                      AppLocalizations.of(context)!.technicalChief,
                      team.technicalChief),
                  _buildInfoCard(context, AppLocalizations.of(context)!.chassis,
                      team.chassis),
                  _buildInfoCard(context,
                      AppLocalizations.of(context)!.powerUnit, team.powerUnit),
                  _buildInfoCard(
                      context,
                      AppLocalizations.of(context)!.firstEntry,
                      team.teamEntry ?? 'N/A'),
                  _buildInfoCard(
                      context,
                      AppLocalizations.of(context)!.worldChampionships,
                      team.worldChampionships.toString()),
                  _buildInfoCard(
                      context,
                      AppLocalizations.of(context)!.highestRaceFinish,
                      team.highestRaceFinish),
                  _buildInfoCard(
                      context,
                      AppLocalizations.of(context)!.polePositions,
                      team.polePositions),
                  _buildInfoCard(
                      context,
                      AppLocalizations.of(context)!.fastestLaps,
                      team.fastestLaps),
                  SizedBox(height: 25),
                ],
              ),
            ),
            
            // Pilotos principales
            if (startingDrivers.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.only(left: 15),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    AppLocalizations.of(context)!.startingDrivers,
                    style: firstTitle.copyWith(color: Theme.of(context).textTheme.bodyLarge?.color, fontSize: 18),
                  ),
                ),
              ),
              SizedBox(height: 10),
              ListView.builder(
                shrinkWrap: true,
                physics: NeverScrollableScrollPhysics(),
                itemCount: startingDrivers.length,
                itemBuilder: (context, index) {
                  return DriverCard(driver: startingDrivers[index]);
                },
              ),
            ],

            // Pilotos reserva
            if (reserveDrivers.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.only(left: 15),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    AppLocalizations.of(context)!.reserveDrivers,
                    style: firstTitle.copyWith(color: Theme.of(context).textTheme.bodyLarge?.color, fontSize: 18),
                  ),
                ),
              ),
              SizedBox(height: 10),
              ListView.builder(
                shrinkWrap: true,
                physics: NeverScrollableScrollPhysics(),
                itemCount: reserveDrivers.length,
                itemBuilder: (context, index) {
                  return DriverCard(driver: reserveDrivers[index]);
                },
              ),
              SizedBox(height: 10)
            ],
          ],
        ),
      ),
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

Widget _buildInfoCard(BuildContext context, String label, String value) {
  if (value.isEmpty) {
    return SizedBox.shrink();
  }
  return Card(
    color: Theme.of(context).cardColor,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(2)),
    child: SizedBox(
      height: 50,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Row(
          children: [
            Text(
              label,
              style: mainText.copyWith(
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                  color: Theme.of(context).textTheme.bodyLarge?.color),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Text(
                value,
                style: secondaryText.copyWith(
                    color: Theme.of(context).textTheme.bodyMedium?.color),
                softWrap: true,
                textAlign: TextAlign.right,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
