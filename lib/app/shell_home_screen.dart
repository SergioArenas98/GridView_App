import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import 'environment/app_environment.dart';

/// Placeholder home screen of the reconstruction shell.
///
/// Replaced by the real navigation shell and Home feature in Phases 3-4.
class ShellHomeScreen extends StatelessWidget {
  const ShellHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AppEnvironment environment = AppEnvironment.current;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.appTitle)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(
                l10n.shellPlaceholderTitle,
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(l10n.shellPlaceholderMessage, textAlign: TextAlign.center),
              if (!environment.isProduction) ...<Widget>[
                const SizedBox(height: 24),
                // Technical environment badge required for non-production
                // builds (TRD section 31.1); intentionally not localized.
                Chip(label: Text(environment.label)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
