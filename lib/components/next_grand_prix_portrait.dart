import 'package:gridview/models/grand_prix.dart';
import 'package:gridview/models/session.dart';
import 'package:gridview/pages/grand_prix_page.dart';
import 'package:gridview/utils/constants.dart';
import 'package:flutter/material.dart';

class NextGrandPrixPortrait extends StatelessWidget {
  final GrandPrix grandPrix;

  const NextGrandPrixPortrait({
    super.key,
    required this.grandPrix,
  });

  @override
  Widget build(BuildContext context) {
    Session? session;

    List<String> categoryOrder = ["F1", "F2", "F3", "F1 Academy"];
    List<String> sortedCategories = grandPrix.categories
        .map((category) => category.name)
        .where((name) => categoryOrder.contains(name))
        .toList()
      ..sort((a, b) =>
          categoryOrder.indexOf(a).compareTo(categoryOrder.indexOf(b)));

    for (var currentSession in grandPrix.sessions) {
      if ((currentSession.sessionName == 'Race' ||
              currentSession.sessionName.contains('Testing')) &&
          session == null) {
        session = currentSession;
      }
    }

    String date = session?.startTime ?? 'N/A';

    return GestureDetector(
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
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha((0.4 * 255).toInt()),
              blurRadius: 10,
              spreadRadius: 1,
              offset: Offset(0, 5),
            ),
          ],
        ),
        child: Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
              child: Image.asset(
                circuitsPath + grandPrix.circuit.circuitImagePath,
                fit: BoxFit.cover,
                width: double.infinity,
                height: MediaQuery.of(context).size.height * 0.45,
              ),
            ),
            Positioned.fill(
              bottom: 0,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.black.withAlpha((0.8 * 255).toInt()),
                    ],
                    stops: [0.30, 1.0],
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: 20,
              left: 15,
              right: 0,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    grandPrix.shortName,
                    style: titleNextGP,
                  ),
                  Divider(
                    color: Colors.white,
                    thickness: 2,
                    indent: 0,
                    endIndent: 200,
                  ),
                  SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            Session.formatFullLocalizedDate(date, context),
                            style: textNextGP,
                          ),
                          SizedBox(height: 4),
                          Text(
                            '${session != null ? Session.convertUtcToLocal(session.startTime) : 'N/A'} - ${session != null ? Session.convertUtcToLocal(session.endTime) : 'N/A'}',
                            style: textNextGP,
                          ),
                          SizedBox(height: 5),
                          Wrap(
                            spacing: 8.0,
                            runSpacing: 8.0,
                            children: sortedCategories.map((category) {
                              return Container(
                                padding: EdgeInsets.symmetric(horizontal: 10, vertical: 5),
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
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
