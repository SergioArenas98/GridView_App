import 'package:gridview/models/grand_prix.dart';
import 'package:gridview/models/session.dart';
import 'package:gridview/pages/grand_prix_page.dart';
import 'package:gridview/utils/constants.dart';
import 'package:flutter/material.dart';

class GrandPrixList extends StatelessWidget {
  final GrandPrix grandPrix;

  const GrandPrixList({
    super.key,
    required this.grandPrix,
  });

  @override
  Widget build(BuildContext context) {
    final Map<String, String> eventsLogos = {
      "Sprint Weekend": "sprint.png",
      "Testing": "testing.png",
    };

    final session = grandPrix.sessions.isNotEmpty
        ? grandPrix.sessions.firstWhere(
            (session) => session.sessionName == 'Carrera',
            orElse: () => grandPrix.sessions.first,
          )
        : null;

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
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 10),
        child: Column(
          children: [
            if (session != null)
              Padding(
                padding: const EdgeInsets.only(left: 20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.start,
                  children: [
                    Text(
                      Session.formatFullLocalizedDate(session.startTime, context),
                      style: secondaryTitle,
                    ),
                  ],
                ),
              ),
            Divider(
              indent: 10,
              endIndent: 200,
              color: Theme.of(context).textTheme.bodyLarge?.color,
              thickness: 0.5,
            ),
            SizedBox(height: 5),
            Row(
              children: [
                Expanded(
                  child: Stack(
                    children: [
                      // Imagen del circuito
                      Container(
                        height: 230,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(2),
                          border: Border.all(
                            color: Color(0xFFD50000),
                            width: 2,
                          ),
                          image: DecorationImage(
                            image: AssetImage(
                              circuitsPath + grandPrix.circuit.circuitImagePath,
                            ),
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                      if (eventsLogos.containsKey(grandPrix.eventType))
                        Positioned(
                          left: 20,
                          child: Container(
                            width: 50,
                            height: 35,
                            padding: const EdgeInsets.all(5),
                            decoration: BoxDecoration(
                              color: Colors.yellowAccent.withAlpha((0.7 * 255).toInt()),
                              borderRadius: BorderRadius.only(
                                bottomLeft: Radius.circular(5),
                                bottomRight: Radius.circular(5),
                              ),
                            ),
                            child: Center(
                              child: Text(
                                grandPrix.eventType == "Testing"
                                    ? "Test"
                                    : grandPrix.eventType == "Sprint Weekend"
                                        ? "Sprint"
                                        : grandPrix.eventType,
                                style: raceWeekendText,
                              ),
                            ),
                          ),
                        ),
                      Positioned(
                        right: 0,
                        bottom: 10,
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.7),
                            borderRadius: BorderRadius.only(
                              bottomLeft: Radius.circular(5),
                              topLeft: Radius.circular(5),
                            ),
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          child: Row(
                            children: [
                              ClipRRect(
                                borderRadius: const BorderRadius.all(Radius.circular(2)),
                                child: Image.asset(
                                  flagsPath + grandPrix.flagImagePath,
                                  width: 22,
                                  height: 15,
                                  fit: BoxFit.cover,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                grandPrix.shortName,
                                style: mainText.copyWith(color: Colors.black),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
