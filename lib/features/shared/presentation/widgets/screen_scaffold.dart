import 'package:flutter/material.dart';

import '../../../../app/router/entity_navigation.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';

/// Shared scaffold for GridView screens: a [GvAppBar] plus a body.
///
/// Primary (branch-root) screens pass [showSettingsAction] so Settings is
/// reachable from the app bar. Detail screens get the automatic back button and
/// usually omit the settings action. Bodies manage their own scrolling and
/// bottom padding so nothing is hidden behind the floating navigation.
class GvScreenScaffold extends StatelessWidget {
  const GvScreenScaffold({
    super.key,
    required this.title,
    required this.body,
    this.showSettingsAction = false,
    this.extraActions,
  });

  final String title;
  final Widget body;
  final bool showSettingsAction;
  final List<Widget>? extraActions;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<Widget> actions = <Widget>[
      ...?extraActions,
      if (showSettingsAction)
        GvIconButton(
          icon: Icons.settings_outlined,
          semanticLabel: l10n.settingsOpen,
          onPressed: () => context.openSettings(),
        ),
    ];
    return Scaffold(
      appBar: GvAppBar(title: title, actions: actions.isEmpty ? null : actions),
      body: SafeArea(top: false, child: body),
    );
  }
}
