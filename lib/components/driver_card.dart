import 'package:flutter/material.dart';
import 'package:gridview/models/driver.dart';
import 'package:gridview/pages/driver_page.dart';
import 'package:gridview/routes/custom_page_transitions.dart';
import 'package:gridview/utils/constants.dart';

class DriverCard extends StatelessWidget {
  final Driver driver;

  const DriverCard({super.key, required this.driver});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 15),
      child: GestureDetector(
        onTap: () {
          Navigator.push(
            context,
            CustomPageTransitions.slideFromRight(DriverPage(driver: driver)),
          );
        },
        child: Container(
          height: 80,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Color(int.parse(driver.teamColor)),
                Color(int.parse(driver.teamColor)).withAlpha((0.6 * 255).toInt()),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withAlpha(51),
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
                  Image.asset(
                    driversPath + driver.driverImg,
                    width: 120,
                    height: 120,
                  ),
                  Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        driver.driverName,
                        style: secondaryText.copyWith(color: Colors.black),
                      ),
                      Text(
                        driver.driverSurname,
                        style: mainText.copyWith(color: Colors.black, fontSize: 20),
                      ),
                    ],
                  ),
                  Spacer(),
                ],
              ),
              Positioned(
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
                          left: BorderSide(color: Colors.black, width: 1),
                        ),
                      ),
                      child: Image.asset(
                        flagsPath + driver.flagImagePath,
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