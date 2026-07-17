import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:gridview/l10n/app_localizations.dart';
import 'package:gridview/models/driver.dart';
import 'package:gridview/services/ad_provider.dart';
import 'package:gridview/utils/constants.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class DriverPage extends StatelessWidget {
  final Driver driver;

  const DriverPage({
    super.key,
    required this.driver,
  });

  @override
  Widget build(BuildContext context) {
    final bannerAd = Provider.of<AdProvider>(context).getBannerAd('driverPage');

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(
          driver.driverFullName,
          style: mainTitle,
        ),
        backgroundColor: Theme.of(context).primaryColor,
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            Stack(
              children: [
                Container(
                  width: double.infinity,
                  height: 220,
                  decoration: BoxDecoration(
                    image: DecorationImage(
                      image: AssetImage(flagsPath + driver.flagImagePath),
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                Center(
                  child: Image.asset(
                    driversPath + driver.driverImg,
                    height: 220,
                    fit: BoxFit.cover,
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(top: 20, bottom: 20, left: 25, right: 25),
              child: Row(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        driver.driverFullName,
                        style: firstTitle.copyWith(color: Theme.of(context).textTheme.bodyLarge?.color, fontSize: 24),
                        softWrap: true,
                      ),
                      SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.start,
                        children: [
                          Text(
                            driver.nameAbbreviation,
                            style: secondaryTitle.copyWith(color: Theme.of(context).textTheme.bodyMedium?.color, fontSize: 20),
                            textAlign: TextAlign.center,
                          ),
                          SizedBox(width: 20),
                          if (driver.carNumber != null && driver.carNumber != 0)
                          Text(
                            '${driver.carNumber}',
                            style: secondaryTitle.copyWith(color: Theme.of(context).textTheme.bodyMedium?.color, fontSize: 20),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),                   
                    ],
                  ),
                  Expanded(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        SizedBox(
                          width: 70,
                          height: 70,
                          child: Image.asset(
                            teamLogosPath + driver.teamLogo,
                            fit: BoxFit.contain,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(left: 15, right: 15, bottom: 15),
              child: Column(
                children: [
                  _buildInfoCard(context, AppLocalizations.of(context)!.country,
                      driver.country),
                  _buildInfoCard(
                      context,
                      AppLocalizations.of(context)!.dateOfBirth,
                      driver.dateOfBirth),
                  _buildInfoCard(
                      context,
                      AppLocalizations.of(context)!.placeOfBirth,
                      driver.placeOfBirth),
                  _buildInfoCard(
                      context,
                      AppLocalizations.of(context)!.worldChampionships,
                      driver.worldChampionships.toString()),
                  _buildInfoCard(
                      context,
                      AppLocalizations.of(context)!.totalPodiums,
                      driver.podiums ?? "N/A"),
                  _buildInfoCard(
                      context,
                      AppLocalizations.of(context)!.totalPoints,
                      driver.points ?? "N/A"),
                  _buildInfoCard(
                      context,
                      AppLocalizations.of(context)!.totalGrandPrix,
                      driver.grandsPrix ?? "N/A"),
                  _buildInfoCard(
                      context,
                      AppLocalizations.of(context)!.highestRaceFinish,
                      driver.highestRaceFinish ?? "N/A"),
                  _buildInfoCard(
                      context,
                      AppLocalizations.of(context)!.highestGridPosition,
                      driver.highestGridPosition ?? "N/A"),
                  SizedBox(height: 25),
                ],
              ),
            ),
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
