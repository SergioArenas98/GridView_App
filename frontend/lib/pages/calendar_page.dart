import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:gridview/components/session_card.dart';
import 'package:gridview/components/custom_table_calendar.dart';
import 'package:gridview/l10n/app_localizations.dart';
import 'package:gridview/models/grand_prix.dart';
import 'package:gridview/models/session.dart';
import 'package:gridview/services/ad_provider.dart';
import 'package:gridview/services/grand_prix_provider.dart';
import 'package:gridview/utils/constants.dart';
import 'package:provider/provider.dart';
import 'package:table_calendar/table_calendar.dart';

class CalendarPage extends StatefulWidget {

  const CalendarPage({
    super.key,
  });

  @override
  State<CalendarPage> createState() => _CalendarPageState();
}

class _CalendarPageState extends State<CalendarPage> {
  DateTime today = DateTime.now();
  List<Session> _selectedDaySessions = [];
  String? _selectedGrandPrixName;

  @override
  void initState() {
    super.initState();
    // Cargar los datos si no están disponibles
    final provider = Provider.of<GrandPrixProvider>(context, listen: false);
    if (provider.grandsPrix == null) {
      provider.fetchGrandsPrix().then((_) {
        _updateSelectedDayData(today);
      });
    } else {
      _updateSelectedDayData(today);
    }
  }

  void _updateSelectedDayData(DateTime day) {
    final grandsPrix = Provider.of<GrandPrixProvider>(context, listen: false).grandsPrix ?? [];
    setState(() {
      today = day;
      _selectedDaySessions = _getSessionsForDay(day, grandsPrix);
      _selectedGrandPrixName = _getGrandPrixForDay(day, grandsPrix);
    });
  }

  List<Session> _getSessionsForDay(DateTime day, List<GrandPrix> grandPrixList) {
    List<Session> sessions = [];
    for (var grandPrix in grandPrixList) {
      for (var session in grandPrix.sessions) {
        if (isSameDay(DateTime.parse(session.startTime), day)) {
          sessions.add(session);
        }
      }
    }
    return sessions;
  }

  String? _getGrandPrixForDay(DateTime day, List<GrandPrix> grandPrixList) {
    for (var grandPrix in grandPrixList) {
      if (grandPrix.sessions.any(
          (session) => isSameDay(DateTime.parse(session.startTime), day))) {
        return grandPrix.shortName;
      }
    }
    return null;
  }

  void _onDaySelected(DateTime day, DateTime focusedDay) {
    _updateSelectedDayData(day);
  }

  @override
  Widget build(BuildContext context) {
    final bannerAd = Provider.of<AdProvider>(context).getBannerAd('calendarPage');
    final provider = Provider.of<GrandPrixProvider>(context);
    
    if (provider.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    
    if (provider.error != null) {
      return Center(child: Text(provider.error!));
    }
    
    if (provider.grandsPrix == null || provider.grandsPrix!.isEmpty) {
      return Center(child: Text(AppLocalizations.of(context)!.noDataAvailable));
    }

    final grandPrixList = provider.grandsPrix!;
    Map<DateTime, List<Session>> sessionDates = {};
    for (var grandPrix in grandPrixList) {
      for (var session in grandPrix.sessions) {
        DateTime date = DateTime.parse(session.startTime);
        DateTime dateOnly = DateTime(date.year, date.month, date.day);
        sessionDates[dateOnly] = [...sessionDates[dateOnly] ?? [], session];
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(
          AppLocalizations.of(context)!.calendar,
          style: mainTitle,
        ),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: CustomTableCalendar(
                today: today,
                firstDay: DateTime.utc(2025, 1, 1),
                lastDay: DateTime.utc(2025, 12, 31),
                sessionDates: sessionDates,
                onDaySelected: _onDaySelected,
                selectedDay: today,
              ),
            ),
            if (_selectedDaySessions.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(left: 15, right: 15, top: 25),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_selectedGrandPrixName != null) ...[
                      Divider(
                        color: Theme.of(context).textTheme.bodyLarge?.color,
                        thickness: 1,
                        endIndent: 180,
                        indent: 180,
                        height: 1,
                      ),
                      Divider(
                        color: Theme.of(context).textTheme.bodyLarge?.color,
                        thickness: 0.4,
                      ),
                      Divider(
                        color: Theme.of(context).textTheme.bodyLarge?.color,
                        thickness: 1,
                        endIndent: 180,
                        indent: 180,
                        height: 1,
                      ),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10, left: 15, top: 15),
                        child: Text(
                          _selectedGrandPrixName!,
                          style: firstTitle.copyWith(
                            color: Theme.of(context).textTheme.bodyLarge?.color),
                        ),
                      ),
                    ],
                    ListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _selectedDaySessions.length,
                      itemBuilder: (context, index) {
                        Session session = _selectedDaySessions[index];
                        session.sessionStatus();

                        return SessionCard(
                          session: session,
                          context: context,
                        );
                      },
                    ),
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