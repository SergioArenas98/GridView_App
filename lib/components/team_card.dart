import 'package:flutter/material.dart';
import 'package:gridview/models/team.dart';
import 'package:gridview/pages/team_page.dart';
import 'package:gridview/routes/custom_page_transitions.dart';
import 'package:gridview/utils/constants.dart';

class TeamCard extends StatelessWidget {
  final Team team;

  const TeamCard({super.key, required this.team});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 15),
      child: GestureDetector(
        onTap: () {
          Navigator.push(
            context,
            CustomPageTransitions.slideFromRight(TeamPage(team: team)),
          );
        },
        child: Container(
          padding: const EdgeInsets.only(left: 20),
          height: 80,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Color(int.parse(team.color)),
                Color(int.parse(team.color)).withAlpha((0.6 * 255).toInt()),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withAlpha((0.2 * 255).toInt()),
                blurRadius: 8,
                spreadRadius: 5,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: Stack(
            children: [
              Row(
                children: [
                  Align(
                    alignment: Alignment.center,
                    child: Image.asset(
                      teamLogosPath + team.logoImg,
                      width: 50,
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(left: 25),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          team.teamShortName == "Red Bull Racing"
                              ? "Red Bull"
                              : team.teamShortName,
                          style: mainText.copyWith(
                              color: Colors.black, fontSize: 19),
                          softWrap: true,
                        ),
                        SizedBox(height: 5),
                        Text(
                          team.powerUnit,
                          style: secondaryText,
                        ),
                      ],
                    ),
                  ),
                  Spacer(), // This will push content to the left
                ],
              ),
              Positioned(
                // Now properly inside Stack
                right: 0,
                top: 0,
                bottom: 0,
                child: ClipPath(
                  child: ShaderMask(
                    blendMode: BlendMode.dstIn,
                    shaderCallback: (Rect bounds) {
                      return LinearGradient(
                        colors: [
                          Colors.transparent,
                          Colors.white.withAlpha((0.3 * 255).toInt()),
                          Colors.white.withAlpha((0.8 * 255).toInt()),
                          Colors.white,
                        ],
                        stops: [0.0, 0.3, 0.6, 1.0],
                        begin: Alignment(-1, 0.7),
                        end: Alignment(0.3, 1.0),
                      ).createShader(bounds);
                    },
                    child: Container(
                      width: 120,
                      decoration: BoxDecoration(
                        border: Border(
                          left: BorderSide(
                            color: Colors.black,
                            width: 1,
                          ),
                        ),
                      ),
                      child: Image.asset(
                        flagsPath + team.flagImg,
                        width: 110,
                        height: double.infinity,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
