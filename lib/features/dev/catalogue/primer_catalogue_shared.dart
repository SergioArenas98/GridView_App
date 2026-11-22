import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import 'primer_catalogue_rows.dart';

/// Development-only specimens of the Step 55B.4 shared components.
///
/// Words are the app's existing English and Spanish strings (ARB, read only)
/// or the approved prototype fixtures (Driver and Team Detail, GP Detail).
/// The N-2 combined notice uses the approved wording, which is not in the
/// ARB files yet. Team colours are the representative XT-3 fixture colours.
/// Nothing here is used by a production screen.
class PrimerSharedComponentsSection extends StatelessWidget {
  const PrimerSharedComponentsSection({super.key, this.spanish = false});

  final bool spanish;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: <Widget>[
      const PrimerRowsCaption('Section title'),
      PrimerSectionTitleSpecimen(spanish: spanish),
      const PrimerRowsCaption('Notices (VS-4 causes, N-2 combined)'),
      PrimerNoticeSpecimen(spanish: spanish),
      const PrimerRowsCaption('Facts and championship stat strip'),
      PrimerFactsSpecimen(spanish: spanish),
      const PrimerRowsCaption('Team-colour marks (XT-3)'),
      const PrimerTeamMarkSpecimen(),
      const PrimerRowsCaption('Arrow discs and the retry button'),
      PrimerActionSpecimen(spanish: spanish),
      const PrimerRowsCaption('Empty and error blocks, loading'),
      PrimerStatesSpecimen(spanish: spanish),
    ],
  );
}

const EdgeInsets _gutter = EdgeInsets.symmetric(
  horizontal: GvPrimerLayout.gutter,
);

/// A full-width block on the Light Graphite band scope (Dark roles in both
/// themes), as the GP heading band.
class _GraphiteBand extends StatelessWidget {
  const _GraphiteBand({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => GvPrimerSurface(
    kind: GvPrimerSurfaceKind.graphiteBand,
    child: Builder(
      builder: (BuildContext context) => ColoredBox(
        color: GvPrimerSurface.of(context).roles.surface.band,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            GvPrimerLayout.gutter,
            12,
            GvPrimerLayout.gutter,
            14,
          ),
          child: child,
        ),
      ),
    ),
  );
}

class PrimerSectionTitleSpecimen extends StatelessWidget {
  const PrimerSectionTitleSpecimen({super.key, this.spanish = false});

  final bool spanish;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: <Widget>[
      Padding(
        padding: _gutter,
        child: GvPrimerSectionTitle(spanish ? 'Sesiones' : 'Sessions'),
      ),
      const SizedBox(height: 12),
      Padding(
        padding: _gutter,
        child: GvPrimerSectionTitle(
          spanish
              ? 'Development example: Clasificación del campeonato de '
                    'constructores'
              : 'Development example: Constructors championship standings',
        ),
      ),
      const SizedBox(height: 12),
      _GraphiteBand(
        child: GvPrimerSectionTitle(
          spanish ? 'Resultados de la carrera' : 'Race results',
        ),
      ),
    ],
  );
}

class PrimerNoticeSpecimen extends StatelessWidget {
  const PrimerNoticeSpecimen({super.key, this.spanish = false});

  final bool spanish;

  @override
  Widget build(BuildContext context) {
    final List<(GvPrimerNoticeCause, String)> notices =
        <(GvPrimerNoticeCause, String)>[
          (
            GvPrimerNoticeCause.failure,
            spanish
                ? 'No se pudo actualizar — mostrando datos guardados.'
                : "Couldn't refresh — showing saved data.",
          ),
          (
            GvPrimerNoticeCause.stale,
            spanish
                ? 'Estos datos pueden estar desactualizados — mostrando la '
                      'última versión guardada.'
                : 'This data may be out of date — showing the last saved '
                      'version.',
          ),
          (
            GvPrimerNoticeCause.incomplete,
            spanish
                ? 'Parte de la información no está disponible'
                : 'Some information is unavailable',
          ),
          // N-2 combined wording (approved; ARB implementation pending, D8).
          (
            GvPrimerNoticeCause.failure,
            spanish
                ? 'No se pudo actualizar. Los datos guardados pueden estar '
                      'desactualizados.'
                : "Couldn't refresh. Saved data may be out of date.",
          ),
        ];
    return Padding(
      padding: _gutter,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          for (final (GvPrimerNoticeCause cause, String text) in notices) ...[
            GvPrimerNotice(cause: cause, message: text),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class PrimerFactsSpecimen extends StatelessWidget {
  const PrimerFactsSpecimen({super.key, this.spanish = false});

  final bool spanish;

  @override
  Widget build(BuildContext context) {
    final bool es = spanish;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        // Driver Detail profile facts (fixture), one unavailable value.
        Padding(
          padding: _gutter,
          child: GvPrimerFactGrid(
            children: <Widget>[
              GvPrimerFact(
                label: es ? 'Fecha de nacimiento' : 'Date of birth',
                value: es ? '30 sept 1997' : 'Sep 30, 1997',
              ),
              GvPrimerFact(
                label: es ? 'Lugar de nacimiento' : 'Place of birth',
                value: 'Hasselt, Belgium',
              ),
              GvPrimerFact(
                label: es ? 'Dorsal permanente' : 'Permanent number',
                value: '33',
              ),
              GvPrimerFact(
                label: 'Development example',
                value: es ? 'No disponible' : 'Not available',
                unavailable: true,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // GP heading fact rail (fixture) on the Graphite band scope.
        _GraphiteBand(
          child: GvPrimerFactGrid(
            minEm: 10,
            rowGap: 10,
            children: <Widget>[
              GvPrimerFact(
                label: es ? 'Fechas' : 'Dates',
                value: es ? '10 jul – dom, 12 jul' : 'Jul 10 – Sun, Jul 12',
                size: GvPrimerFactSize.compact,
              ),
              GvPrimerFact(
                label: es ? 'Ubicación' : 'Location',
                value: 'Monza, Italy',
                size: GvPrimerFactSize.compact,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // Team Detail championship strip (fixture).
        Padding(
          padding: _gutter,
          child: GvPrimerStatStrip(
            stats: <GvPrimerStat>[
              GvPrimerStat(
                label: es ? 'Posición' : 'Position',
                value: '6',
                kind: GvPrimerStatKind.lead,
              ),
              GvPrimerStat(label: es ? 'Puntos' : 'Points', value: '22'),
              GvPrimerStat(label: es ? 'Victorias' : 'Wins', value: '0'),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // Driver Detail championship (fixture, Driver geometry).
        Padding(
          padding: _gutter,
          child: GvPrimerStatStrip(
            style: GvPrimerStatStripStyle.driver,
            stats: <GvPrimerStat>[
              GvPrimerStat(
                label: es ? 'Posición' : 'Position',
                value: '2',
                kind: GvPrimerStatKind.lead,
              ),
              GvPrimerStat(
                label: es ? 'Puntos' : 'Points',
                value: es ? '402,5' : '402.5',
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // Unranked: the word in place of the lead figure.
        Padding(
          padding: _gutter,
          child: GvPrimerStatStrip(
            stats: <GvPrimerStat>[
              GvPrimerStat(
                label: es ? 'Posición' : 'Position',
                value: es ? 'Sin clasificar' : 'Unranked',
                kind: GvPrimerStatKind.word,
              ),
              GvPrimerStat(label: es ? 'Puntos' : 'Points', value: '0'),
            ],
          ),
        ),
      ],
    );
  }
}

class PrimerTeamMarkSpecimen extends StatelessWidget {
  const PrimerTeamMarkSpecimen({super.key});

  static const List<Color> colours = <Color>[
    Color(0xFF1E41FF),
    Color(0xFFFF8000),
    Color(0xFF0093CC),
  ];

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    Widget group(Color surface) => ColoredBox(
      color: surface,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          GvPrimerLayout.gutter + 8,
          12,
          GvPrimerLayout.gutter,
          12,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            for (final Color c in colours) ...<Widget>[
              Row(
                children: <Widget>[
                  GvPrimerTeamMark(
                    shape: GvPrimerTeamShape.tick,
                    color: c,
                    surface: surface,
                    length: 40,
                  ),
                  const SizedBox(width: 20),
                  GvPrimerTeamMark(
                    shape: GvPrimerTeamShape.seam,
                    color: c,
                    surface: surface,
                    length: 40,
                  ),
                  const SizedBox(width: 20),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: <Widget>[
                        FractionallySizedBox(
                          widthFactor: 0.46,
                          child: GvPrimerTeamMark(
                            shape: GvPrimerTeamShape.pinstripe,
                            color: c,
                            surface: surface,
                          ),
                        ),
                        const SizedBox(height: 4),
                        GvPrimerTeamMark(
                          shape: GvPrimerTeamShape.bar,
                          color: c,
                          surface: surface,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
            ],
          ],
        ),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[group(roles.surface.page), group(roles.surface.band)],
    );
  }
}

class PrimerActionSpecimen extends StatelessWidget {
  const PrimerActionSpecimen({super.key, this.spanish = false});

  final bool spanish;

  @override
  Widget build(BuildContext context) => Padding(
    padding: _gutter,
    child: Wrap(
      spacing: 16,
      runSpacing: 12,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: <Widget>[
        const GvPrimerArrowDisc(),
        const GvPrimerArrowDisc(size: 36),
        GvPrimerButton(
          label: spanish ? 'Reintentar' : 'Try again',
          onPressed: () {},
        ),
      ],
    ),
  );
}

class PrimerStatesSpecimen extends StatelessWidget {
  const PrimerStatesSpecimen({super.key, this.spanish = false});

  final bool spanish;

  @override
  Widget build(BuildContext context) {
    final bool es = spanish;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        GvPrimerEmptyState(
          size: GvPrimerEmptySize.list,
          icon: Icons.person_search_outlined,
          title: es ? 'Todavía no hay pilotos' : 'No drivers yet',
          message: es
              ? 'Esta temporada aún no tiene pilotos publicados. Aparecerán '
                    'aquí en cuanto los haya.'
              : 'This season has no drivers listed yet. They will appear here '
                    'as soon as they do.',
        ),
        GvPrimerEmptyState(
          glyph: GvPrimerGlyph.alert,
          title: es ? 'Temporada no disponible' : 'Season unavailable',
          message: es
              ? 'GridView no ha podido determinar qué temporada mostrar. '
                    'Comprueba tu conexión e inténtalo de nuevo.'
              : 'GridView could not determine which season to show. Check '
                    'your connection and try again.',
          action: GvPrimerButton(
            label: es ? 'Reintentar' : 'Try again',
            onPressed: () {},
          ),
        ),
        GvPrimerLoading(
          semanticLabel: es ? 'Cargando' : 'Loading',
          child: const Padding(
            padding: _gutter,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                GvPrimerSkeleton(height: 18, width: 140, radius: 4),
                SizedBox(height: 14),
                GvPrimerSkeleton(height: 72),
                SizedBox(height: 8),
                GvPrimerSkeleton(height: 72),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
