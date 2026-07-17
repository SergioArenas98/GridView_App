import 'package:flutter/material.dart';
import 'package:gridview/l10n/app_localizations.dart';
import 'package:gridview/models/session.dart';
import 'package:gridview/utils/constants.dart';

class SessionCard extends StatelessWidget {
  final Session session;
  final BuildContext context;

  const SessionCard({
    super.key,
    required this.session,
    required this.context,
  });

  @override
  Widget build(BuildContext context) {
    session.sessionStatus();

    Stream<double> blinkingStream() async* {
      while (true) {
        if (session.isOngoing) {
          yield 1.0;
          await Future.delayed(const Duration(milliseconds: 1200));
          yield 0.3;
          await Future.delayed(const Duration(milliseconds: 1200));
        } else {
          yield 1.0;
          await Future.delayed(const Duration(milliseconds: 1000));
        }
      }
    }

    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            borderRadius: BorderRadius.all(Radius.circular(2)),
            border: Border.all(
              color: Theme.of(context).dividerColor,
              width: 2,
            ),
          ),
          child: Row(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 5, bottom: 8),
                    child: Text(
                      Session.translateSessionName(session.sessionName, context),
                      style: secondaryTitle.copyWith(color: Theme.of(context).textTheme.bodyLarge?.color),
                    ),
                  ),
                  Text(
                    '${Session.convertUtcToLocal(session.startTime)} - ${Session.convertUtcToLocal(session.endTime)}',
                    style: secondaryText.copyWith(color: Theme.of(context).textTheme.bodyMedium?.color),
                  ),
                ],
              ),
              Spacer(),
              Column(
                children: [
                  StreamBuilder<double>(
                    stream: session.isOngoing
                        ? blinkingStream()
                        : Stream.value(1.0),
                    initialData: 1.0,
                    builder: (context, snapshot) {
                      return AnimatedOpacity(
                        opacity: snapshot.data!,
                        duration: Duration(milliseconds: 1500),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                          decoration: BoxDecoration(
                            color: session.isCompleted
                                ? Colors.redAccent
                                : session.isOngoing
                                    ? Colors.green
                                    : Colors.grey,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            session.isCompleted
                                ? AppLocalizations.of(context)!.finished
                                : session.isOngoing
                                    ? AppLocalizations.of(context)!.inProgress
                                    : AppLocalizations.of(context)!.notStarted,
                            style: sessionStatusText.copyWith(fontSize: 12),
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
        SizedBox(height: 20),
      ],
    );
  }
}
