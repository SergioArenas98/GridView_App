import 'package:gridview/components/next_grand_prix_portrait.dart';
import 'package:gridview/l10n/app_localizations.dart';
import 'package:gridview/models/grand_prix.dart';
import 'package:gridview/models/session.dart';
import 'package:gridview/pages/grand_prix_page.dart';
import 'package:gridview/services/grand_prix_provider.dart';
import 'package:gridview/utils/constants.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  HomePageState createState() => HomePageState();
}

class HomePageState extends State<HomePage> {
  @override
  void initState() {
    super.initState();
    // Cargar datos si no están ya cargados
    Provider.of<GrandPrixProvider>(context, listen: false).fetchGrandsPrix();
  }

  (GrandPrix?, List<GrandPrix>) _filterGrandsPrix(List<GrandPrix> grandsPrix) {
    if (grandsPrix.isEmpty) return (null, []);

    final now = DateTime.now();
    final upcoming = grandsPrix.where((gp) => gp.sessions.any((session) => DateTime.parse(session.endTime).isAfter(now))).toList();

    if (upcoming.isEmpty) return (null, []);

    final nextGrandPrix = upcoming.reduce((a, b) =>
        DateTime.parse(a.sessions.first.endTime).isBefore(DateTime.parse(b.sessions.first.endTime)) ? a : b);

    final upcomingGrandsPrix = upcoming
        .where((gp) => DateTime.parse(gp.sessions.first.endTime).isAfter(DateTime.parse(nextGrandPrix.sessions.first.endTime)))
        .toList();

    return (nextGrandPrix, upcomingGrandsPrix);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Consumer<GrandPrixProvider>(
        builder: (context, grandPrixProvider, child) {
          if (grandPrixProvider.isLoading) {
            return const Center(child: CircularProgressIndicator.adaptive());
          } else if (grandPrixProvider.error != null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(grandPrixProvider.error!),
                  const SizedBox(height: 10),
                  ElevatedButton(
                    onPressed: () {
                      grandPrixProvider.clearError();
                      grandPrixProvider.fetchGrandsPrix();
                    },
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          } else if (grandPrixProvider.grandsPrix == null || grandPrixProvider.grandsPrix!.isEmpty) {
            return const Center(child: Text("No grand prix available"));
          }

          final (nextGrandPrix, upcomingGrandsPrix) = _filterGrandsPrix(grandPrixProvider.grandsPrix!);

          if (nextGrandPrix == null) {
            return const Center(child: Text("No upcoming grand prix"));
          }

          return ListView(
            children: [
              NextGrandPrixPortrait(grandPrix: nextGrandPrix),
              const SizedBox(height: 5),
              Padding(
                padding: const EdgeInsets.only(left: 20, top: 10, right: 15),
                child: Text(
                  AppLocalizations.of(context)!.upcoming,
                  style: upComingTitle.copyWith(color: Theme.of(context).textTheme.bodyLarge?.color),
                ),
              ),
              Divider(
                color: Theme.of(context).textTheme.bodyLarge?.color,
                thickness: 1,
                indent: 15,
                endIndent: 255,
              ),
              _listHorizontalUpcomingGrandsPrix(upcomingGrandsPrix),
            ],
          );
        },
      ),
    );
  }

  Widget _listHorizontalUpcomingGrandsPrix(List<GrandPrix> grandsPrix) {
    List<Widget> cards = grandsPrix.map((gp) => _buildItemUpcomingGrandsPrix(gp)).toList();
    cards.add(const SizedBox(width: 10));

    return SizedBox(
      width: MediaQuery.of(context).size.width,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: cards,
        ),
      ),
    );
  }

  Widget _buildItemUpcomingGrandsPrix(GrandPrix grandPrix) {
    final String circuitImagePath = grandPrix.circuit.circuitImagePath;
    final session = grandPrix.sessions.firstWhere(
      (session) => session.sessionName == 'Race',
    );

    List<String> categoryOrder = ["F1", "F2", "F3", "F1 Academy"];
    List<String> sortedCategories = grandPrix.categories
        .map((category) => category.name)
        .where((name) => categoryOrder.contains(name))
        .toList()
      ..sort((a, b) =>
          categoryOrder.indexOf(a).compareTo(categoryOrder.indexOf(b)));

    return InkWell(
      onTap: () {
        Navigator.push(context, PageRouteBuilder(pageBuilder: (context, animation, secondaryAnimation) {
          return GrandPrixPage(grandPrix: grandPrix);
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
      child: Container(
        width: MediaQuery.of(context).size.width * 0.6,
        height: MediaQuery.of(context).size.height * 0.37,
        margin: const EdgeInsets.only(left: 10.0),
        child: Card(
          color: Theme.of(context).cardColor,
          elevation: 2,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              ClipRRect(
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(6.0),
                  topRight: Radius.circular(6.0),
                ),
                child: Image.asset(
                  circuitsPath + circuitImagePath,
                  width: MediaQuery.of(context).size.width * 0.7,
                  height: MediaQuery.of(context).size.height / 6,
                  fit: BoxFit.cover,
                ),
              ),
              ListTile(
                title: Text(
                  grandPrix.shortName,
                  style: firstTitle.copyWith(fontSize: 17),
                ),
                subtitle: Container(
                  margin: EdgeInsets.only(top: 5),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(2),
                        child: Container(
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: Colors.black,
                              width: 1,
                            ),
                          ),
                          child: Image.asset(
                            flagsPath + grandPrix.flagImagePath,
                            width: 22,
                            height: 15,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        grandPrix.country == "United States of America"
                            ? "USA"
                            : grandPrix.country == "United Arab Emirates"
                                ? "UAE"
                                : grandPrix.country,
                        style: secondaryText.copyWith(
                          color: Theme.of(context).textTheme.bodyMedium?.color,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(left: 15, top: 0, bottom: 15),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.calendar_month_outlined,
                          color: Theme.of(context).primaryColor,
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          Session.formatFullLocalizedDate(session.startTime, context),
                          overflow: TextOverflow.ellipsis,
                          maxLines: 1,
                          style: secondaryText.copyWith(color: Theme.of(context).textTheme.bodyMedium?.color),
                        ),
                      ],
                    ),
                    SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(
                          Icons.watch_later_outlined,
                          color: Theme.of(context).primaryColor,
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${Session.convertUtcToLocal(session.startTime)} - ${Session.convertUtcToLocal(session.endTime)}',
                          style: secondaryText.copyWith(color: Theme.of(context).textTheme.bodyMedium?.color),
                        ),
                      ],
                    ),
                    SizedBox(height: 10),
                    if (sortedCategories.isNotEmpty)
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: sortedCategories.map((category) {
                          return Container(
                            padding: EdgeInsets.symmetric(horizontal: 5, vertical: 2),
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
              ),
            ],
          ),
        ),
      ),
    );
  }
}
