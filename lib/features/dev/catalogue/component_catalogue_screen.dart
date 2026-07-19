import 'package:flutter/material.dart';

import '../../../app/environment/app_environment.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../core/widgets/widgets.dart';

/// A development-only gallery of every shared design-system component and its
/// states. It is never part of a production build: [open] refuses to navigate
/// in production, and the only entry point (the shell) hides its button there.
class ComponentCatalogueScreen extends StatefulWidget {
  const ComponentCatalogueScreen({super.key});

  /// Pushes the catalogue, but only outside production.
  static void open(BuildContext context) {
    if (AppEnvironment.current.isProduction) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const ComponentCatalogueScreen()),
    );
  }

  @override
  State<ComponentCatalogueScreen> createState() =>
      _ComponentCatalogueScreenState();
}

class _ComponentCatalogueScreenState extends State<ComponentCatalogueScreen> {
  int _segment = 0;
  int _navIndex = 0;

  static const String _longEn =
      'A very long English label that should wrap or ellipsize cleanly without '
      'overflowing its container on narrow phones.';
  static const String _longEs =
      'Una etiqueta en español muy larga que debe ajustarse o recortarse con '
      'claridad sin desbordar su contenedor en teléfonos estrechos.';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const GvAppBar(title: 'Component catalogue'),
      body: ListView(
        padding: const EdgeInsets.all(GvSpacing.lg),
        children: <Widget>[
          _Section(
            title: 'Buttons',
            child: Wrap(
              spacing: GvSpacing.sm,
              runSpacing: GvSpacing.sm,
              children: <Widget>[
                GvPrimaryButton(label: 'Primary', onPressed: () {}),
                const GvPrimaryButton(label: 'Disabled'),
                const GvPrimaryButton(label: 'Loading', isLoading: true),
                GvSecondaryButton(label: 'Secondary', onPressed: () {}),
                GvIconButton(
                  icon: Icons.settings_outlined,
                  semanticLabel: 'Settings',
                  onPressed: () {},
                ),
              ],
            ),
          ),
          _Section(
            title: 'Segmented control',
            child: GvSegmentedControl(
              segments: const <String>['Drivers', 'Constructors'],
              selectedIndex: _segment,
              onChanged: (int i) => setState(() => _segment = i),
            ),
          ),
          _Section(
            title: 'Status chips',
            child: Wrap(
              spacing: GvSpacing.xs,
              runSpacing: GvSpacing.xs,
              children: const <Widget>[
                GvStatusChip(label: 'Upcoming', tone: GvStatusTone.info),
                GvStatusChip(label: 'Live', tone: GvStatusTone.live),
                GvStatusChip(label: 'Completed', tone: GvStatusTone.success),
                GvStatusChip(label: 'Postponed', tone: GvStatusTone.warning),
                GvStatusChip(label: 'Scheduled'),
              ],
            ),
          ),
          _Section(
            title: 'Bottom navigation',
            child: GvBottomNav(
              selectedIndex: _navIndex,
              onSelect: (int i) => setState(() => _navIndex = i),
              items: const <GvBottomNavItem>[
                GvBottomNavItem(icon: Icons.home_outlined, label: 'Home'),
                GvBottomNavItem(
                  icon: Icons.calendar_month_outlined,
                  label: 'Calendar',
                ),
                GvBottomNavItem(
                  icon: Icons.emoji_events_outlined,
                  label: 'Standings',
                ),
                GvBottomNavItem(icon: Icons.explore_outlined, label: 'Explore'),
              ],
            ),
          ),
          _Section(
            title: 'Cards',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                const GvHeroCard(
                  child: Align(
                    alignment: Alignment.bottomLeft,
                    child: Text(
                      'Next Grand Prix',
                      style: GvTypography.pageTitle,
                    ),
                  ),
                ),
                const SizedBox(height: GvSpacing.sm),
                Row(
                  children: const <Widget>[
                    Expanded(
                      child: GvDataCard(
                        label: 'Points',
                        value: '210.5',
                        caption: 'Leader',
                      ),
                    ),
                    SizedBox(width: GvSpacing.sm),
                    Expanded(
                      child: GvDataCard(label: 'Wins', value: '6'),
                    ),
                  ],
                ),
                const SizedBox(height: GvSpacing.sm),
                GvContentCard(
                  onTap: () {},
                  child: const Text(
                    'Standard content card',
                    style: GvTypography.bodyL,
                  ),
                ),
              ],
            ),
          ),
          _Section(
            title: 'Rows',
            child: Column(
              children: <Widget>[
                const GvSessionRow(name: 'Race', time: '15:00'),
                const GvStandingsRow(
                  position: '1',
                  name: 'Max Verstappen',
                  team: 'Red Bull',
                  points: '210.5',
                  isLeader: true,
                ),
                const GvDriverRow(
                  name: 'Charles Leclerc',
                  team: 'Ferrari',
                  number: '16',
                ),
                const GvTeamRow(
                  name: 'McLaren',
                  subtitle: 'Woking, United Kingdom',
                  accentColor: Color(0xFFFF8000),
                ),
                const GvCircuitRow(name: 'Monza', location: 'Italy'),
                const GvResultRow(
                  position: '2',
                  driverName: 'Lando Norris',
                  team: 'McLaren',
                  timeOrGap: '+3.456',
                  accentColor: Color(0xFFFF8000),
                ),
              ],
            ),
          ),
          _Section(
            title: 'Team accents (representative)',
            child: Column(
              children: const <Widget>[
                GvTeamRow(name: 'Ferrari', accentColor: Color(0xFFE8002D)),
                GvTeamRow(name: 'Mercedes', accentColor: Color(0xFF00A19C)),
                GvTeamRow(name: 'Red Bull', accentColor: Color(0xFF1E41FF)),
              ],
            ),
          ),
          _Section(
            title: 'Loading (skeletons)',
            child: Column(
              children: const <Widget>[
                GvSkeletonCard(),
                SizedBox(height: GvSpacing.sm),
                GvSkeletonBlock(width: 180),
              ],
            ),
          ),
          _Section(
            title: 'Empty / error / offline states',
            child: Column(
              children: <Widget>[
                const SizedBox(
                  height: 180,
                  child: GvEmptyState(
                    title: 'No results yet',
                    message: 'Results appear once the session is complete.',
                  ),
                ),
                SizedBox(
                  height: 200,
                  child: GvErrorState(
                    title: 'Something went wrong',
                    message: 'We could not load this content.',
                    retryLabel: 'Retry',
                    onRetry: () {},
                  ),
                ),
                const GvOfflineNotice(
                  message: 'Showing saved data. Last updated a while ago.',
                ),
              ],
            ),
          ),
          _Section(
            title: 'Image placeholder',
            child: const SizedBox(
              width: 120,
              child: GvImagePlaceholder(
                aspectRatio: 1,
                semanticLabel: 'Driver portrait',
              ),
            ),
          ),
          _Section(
            title: 'Reserved advertisement container',
            child: const GvAdContainer(),
          ),
          _Section(
            title: 'Long text (English / Spanish)',
            child: Column(
              children: const <Widget>[
                GvContentCard(child: Text(_longEn, style: GvTypography.bodyM)),
                SizedBox(height: GvSpacing.sm),
                GvContentCard(child: Text(_longEs, style: GvTypography.bodyM)),
              ],
            ),
          ),
          _Section(
            title: 'Large text scaling (x1.8)',
            child: MediaQuery.withClampedTextScaling(
              minScaleFactor: 1.8,
              maxScaleFactor: 1.8,
              child: const GvStandingsRow(
                position: '1',
                name: 'Max Verstappen',
                team: 'Red Bull',
                points: '210.5',
              ),
            ),
          ),
          _Section(
            title: 'Narrow phone width (320)',
            child: const Center(
              child: SizedBox(
                width: GvLayout.narrowPhoneWidth,
                child: GvStandingsRow(
                  position: '1',
                  name: 'A driver with a long enough name to test wrapping',
                  team: 'A constructor name that is also fairly long',
                  points: '210.5',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: GvSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          GvSectionHeader(title: title),
          const SizedBox(height: GvSpacing.sm),
          child,
        ],
      ),
    );
  }
}
