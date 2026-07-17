import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:gridview/components/circuit_info.dart';
import 'package:gridview/components/session_card.dart';
import 'package:gridview/l10n/app_localizations.dart';
import 'package:gridview/models/grand_prix.dart';
import 'package:gridview/models/session.dart';
import 'package:flutter/material.dart';
import 'package:gridview/services/ad_provider.dart';
import 'package:gridview/utils/constants.dart';
import 'package:provider/provider.dart';

class GrandPrixPage extends StatefulWidget {
  final GrandPrix grandPrix;

  const GrandPrixPage({
    super.key,
    required this.grandPrix,
  });

  @override
  GrandPrixPageState createState() => GrandPrixPageState();
}

class GrandPrixPageState extends State<GrandPrixPage> {

  String _translateEventType(String eventType, BuildContext context) {
    switch (eventType) {
      case "Race Weekend":
        return AppLocalizations.of(context)!.raceWeekend;
      case "Sprint Weekend":
        return AppLocalizations.of(context)!.sprintWeekend;
      default:
        return eventType;
    }
  }

  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bannerAd = Provider.of<AdProvider>(context).getBannerAd('grandprixPage');
    List<String> categoryOrder = ["F1", "F2", "F3", "F1 Academy"];
    List<String> sortedCategories = widget.grandPrix.categories
        .map((category) => category.name)
        .where((name) => categoryOrder.contains(name))
        .toList()
      ..sort((a, b) =>
          categoryOrder.indexOf(a).compareTo(categoryOrder.indexOf(b)));

    // Agrupar sesiones por fecha
    Map<String, List<Session>> sessionsByDate = {};
    for (var session in widget.grandPrix.sessions) {
      String date = session.startTime.split("T")[0];
      if (sessionsByDate[date] == null) {
        sessionsByDate[date] = [];
      }
      sessionsByDate[date]!.add(session);
    }

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(
          widget.grandPrix.shortName,
          style: mainTitle,
        ),
      ),
      body: Stack(
        children: [
          SingleChildScrollView(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.only(left: 15, right: 15, top: 15),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.grandPrix.fullName,
                        style: firstTitle.copyWith(color: Theme.of(context).textTheme.bodyLarge?.color),
                      ),
                      SizedBox(height: 10),
                      if (widget.grandPrix.eventType == "Race Weekend" || widget.grandPrix.eventType == "Sprint Weekend")
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  '${AppLocalizations.of(context)!.race} ${widget.grandPrix.number} / ${GrandPrix.getGrandPrixCountBySeason(widget.grandPrix.season)}',
                                  style: secondaryTitle,
                                ),
                                if (widget.grandPrix.eventType == "Sprint Weekend")
                                  Text(
                                    " (${_translateEventType(widget.grandPrix.eventType, context)})",
                                    style: secondaryTitle.copyWith(color: Colors.yellow),
                                  ),
                              ],
                            ),
                            SizedBox(height: 12),
                            if (sortedCategories.isNotEmpty)
                              Wrap(
                                spacing: 8.0,
                                runSpacing: 8.0,
                                children: sortedCategories.map((category) {
                                  return Container(
                                    padding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: Colors.green.shade200,
                                      borderRadius: BorderRadius.circular(5),
                                    ),
                                    child: Text(
                                      category,
                                      style: selectorText,
                                    ),
                                  );
                                }).toList(),
                              ),
                          ],
                        ),
                      SizedBox(height: 20),
                      // Agrupar y mostrar las sesiones por día
                      ListView.builder(
                        shrinkWrap: true,
                        physics: NeverScrollableScrollPhysics(),
                        itemCount: sessionsByDate.keys.length,
                        itemBuilder: (context, index) {
                          String date = sessionsByDate.keys.elementAt(index);
                          List<Session> sessionsForDay = sessionsByDate[date]!;

                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Mostrar la fecha (día)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 20),
                                child: Row(
                                  children: [
                                    Text(
                                      Session.formatLocalizedDay(sessionsForDay[0].startTime, context),
                                      style: secondaryTitle.copyWith(fontSize: 18, fontWeight: FontWeight.bold),
                                    ),
                                    SizedBox(width: 15),
                                    Text(
                                      Session.formatLocalizedDate(sessionsForDay[0].startTime, context),
                                      style: secondaryText.copyWith(color: Theme.of(context).textTheme.bodyMedium?.color, fontSize: 14),
                                    ),
                                  ],
                                ),
                              ),
                              // Mostrar las sesiones para este día
                              ListView.builder(
                                shrinkWrap: true,
                                physics: NeverScrollableScrollPhysics(),
                                itemCount: sessionsForDay.length,
                                itemBuilder: (context, sessionIndex) {
                                  Session session = sessionsForDay[sessionIndex];
                                  session.sessionStatus();
                                  
                                  return SessionCard(
                                    session: sessionsForDay[sessionIndex],
                                    context: context,
                                  );
                                },
                              ),
                            ],
                          );
                        },
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 15),
                  child: Text(
                    widget.grandPrix.circuit.circuitName,
                    textAlign: TextAlign.center,
                    style: firstTitle.copyWith(color: Theme.of(context).textTheme.bodyLarge?.color),
                  )
                ),
                SizedBox(height: 5),
                CircuitInfo(circuit: widget.grandPrix.circuit),
              ],
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
    );
  }
}
