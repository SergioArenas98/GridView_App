import 'package:flutter/material.dart';

/* ======== IMAGES FOLDERS ROUTES ======== */

String flagsPath = "assets/images/flags/";
String carsPath = "assets/images/cars/";
String circuitsPath = "assets/images/circuits/";
String driversPath = "assets/images/drivers/";
String logoPath = "assets/images/logo/";
String layoutsPath = "assets/images/layouts/";
String teamLogosPath = "assets/images/team_logos/";

/* ======== TEXT STYLES ======== */
const TextStyle mainTitle = TextStyle(
  fontFamily: 'F1Bold',
  fontSize: 20,
);

/*const TextStyle firstTitle = TextStyle(
  fontFamily: 'F1Wide',
  fontSize: 18,
);*/

const TextStyle firstTitle = TextStyle(
  fontFamily: 'F1Regular',
  fontSize: 22,
  fontWeight: FontWeight.bold,
);

const TextStyle titleNextGP = TextStyle(
  fontFamily: 'F1Regular',
  color: Colors.white,
  fontSize: 26,
  fontWeight: FontWeight.bold,
  shadows: [
    Shadow(
      offset: Offset(1, 1),
      blurRadius: 2,
      color: Colors.black,
    ),
  ],
);

const TextStyle textNextGP = TextStyle(
  fontFamily: 'F1Regular',
  color: Colors.white,
  fontSize: 16,
  shadows: [
    Shadow(
      offset: Offset(1, 1),
      blurRadius: 2,
      color: Colors.black,
    ),
  ],
);

const TextStyle upComingTitle = TextStyle(
  fontFamily: 'F1Regular',
  fontSize: 18,
  fontWeight: FontWeight.bold,
  fontStyle: FontStyle.italic,
);

const TextStyle secondaryTitle = TextStyle(
  fontFamily: 'F1Regular',
  fontSize: 16,
);

const TextStyle mainText = TextStyle(
  fontFamily: 'F1Regular',
  fontSize: 16,
  fontWeight: FontWeight.bold,
);

const TextStyle secondaryText = TextStyle(
  fontFamily: 'F1Regular',
  fontSize: 14,
  color: Colors.black,
);

const TextStyle secondaryTextGrey = TextStyle(
  fontFamily: 'F1Regular',
  fontSize: 14,
);

const TextStyle sessionStatusText = TextStyle(
  fontFamily: 'F1Regular',
  fontSize: 13,
  color: Colors.black,
);

const TextStyle raceWeekendText = TextStyle(
  fontFamily: 'F1Regular',
  fontSize: 11,
  color: Colors.black,
);

const TextStyle selectorText = TextStyle(
  fontFamily: 'F1Regular',
  fontSize: 14,
  color: Colors.black,
);

const TextStyle tapBarSelected = TextStyle(
  fontFamily: 'F1Regular',
  fontSize: 18,
  fontWeight: FontWeight.bold,
  color: Colors.black,
);

const TextStyle tapBarUnselected = TextStyle(
  fontFamily: 'F1Regular',
  fontSize: 14,
  color: Colors.black,
);
