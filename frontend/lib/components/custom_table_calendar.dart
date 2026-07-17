import 'package:flutter/material.dart';
import 'package:gridview/utils/constants.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:gridview/models/session.dart';

class CustomTableCalendar extends StatelessWidget {
  final DateTime today;
  final DateTime firstDay;
  final DateTime lastDay;
  final Map<DateTime, List<Session>> sessionDates;
  final Function(DateTime, DateTime) onDaySelected;
  final DateTime selectedDay;

  const CustomTableCalendar({
    super.key,
    required this.today,
    required this.firstDay,
    required this.lastDay,
    required this.sessionDates,
    required this.onDaySelected,
    required this.selectedDay,
  });

  @override
  Widget build(BuildContext context) {
    return TableCalendar(
      locale: Localizations.localeOf(context).toString(),
      focusedDay: today,
      firstDay: firstDay,
      lastDay: lastDay,
      calendarFormat: CalendarFormat.month,
      rowHeight: 80,
      availableGestures: AvailableGestures.all,
      headerStyle: HeaderStyle(
        formatButtonVisible: false,
        titleCentered: true,
        titleTextStyle: TextStyle(
          fontFamily: 'F1Regular',
          fontSize: 16,
          fontWeight: FontWeight.bold,
          color: Theme.of(context).textTheme.bodyLarge?.color,
        ),
        titleTextFormatter: (date, locale) => 
            Session.formatLocalizedMonthYear(date.toString(), context),
      ),
      daysOfWeekStyle: DaysOfWeekStyle(
        weekdayStyle: sessionStatusText.copyWith(
          color: Theme.of(context).textTheme.bodyLarge?.color),
        weekendStyle: sessionStatusText.copyWith(
          color: Theme.of(context).textTheme.bodyLarge?.color),
      ),
      calendarStyle: CalendarStyle(
        todayTextStyle: const TextStyle(
          fontFamily: 'F1Regular',
          fontSize: 16,
          color: Colors.white,
        ),
        selectedTextStyle: const TextStyle(
          fontFamily: 'F1Regular',
          fontSize: 16,
          color: Colors.white,
        ),
        todayDecoration: const BoxDecoration(
          color: Colors.blue,
          shape: BoxShape.circle,
        ),
        selectedDecoration: const BoxDecoration(
          color: Colors.orange,
          shape: BoxShape.circle,
        ),
        weekendTextStyle: const TextStyle(
          fontFamily: 'F1Regular',
          fontSize: 16,
          color: Colors.grey,
        ),
        defaultTextStyle: TextStyle(
          fontFamily: 'F1Regular',
          fontSize: 16,
          color: Theme.of(context).textTheme.bodyLarge?.color,
        ),
        outsideTextStyle: const TextStyle(
          fontFamily: 'F1Regular',
          fontSize: 16,
          color: Color.fromARGB(73, 158, 158, 158),
        ),
      ),
      onDaySelected: onDaySelected,
      startingDayOfWeek: StartingDayOfWeek.monday,
      selectedDayPredicate: (day) => isSameDay(day, selectedDay),
      calendarBuilders: CalendarBuilders(
        markerBuilder: (context, date, events) {
          if (sessionDates.containsKey(DateTime(date.year, date.month, date.day))) {
            return Positioned(
              bottom: 2,
              left: 8,
              right: 8,
              child: Container(
                height: 6,
                decoration: BoxDecoration(
                  color: Colors.red,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            );
          }
          return null;
        },
      ),
    );
  }
}