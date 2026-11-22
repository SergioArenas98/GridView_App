import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// Development-only specimens of the Primer V2 editorial rows (Step 55B.3).
///
/// Data comes from the approved prototype fixtures (GP Detail results and
/// states, Standings index and states, Calendar Stage 1 and the LT-14
/// completed-row specimen); English and Spanish words are the prototypes'
/// and the app's existing ones. Rows that no approved fixture shows are
/// grouped under "Development examples" with artificial names ("Grand Prix
/// A", "A Driver"), never real competitors. Rows render full width, as on a
/// screen; nothing here is used by a production screen.
class PrimerEditorialRowsSection extends StatelessWidget {
  const PrimerEditorialRowsSection({super.key, this.spanish = false});

  final bool spanish;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: <Widget>[
      const PrimerRowsCaption('Grand Prix results rows'),
      PrimerResultRowsSpecimen(spanish: spanish),
      const PrimerRowsCaption('Standings leader card and ranking rows'),
      PrimerStandingsRowsSpecimen(spanish: spanish),
      const PrimerRowsCaption('Calendar race rows'),
      PrimerRaceRowsSpecimen(spanish: spanish),
    ],
  );
}

/// A gallery caption in `text.accent`, inset by the gutter.
class PrimerRowsCaption extends StatelessWidget {
  const PrimerRowsCaption(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(
      GvPrimerLayout.gutter,
      20,
      GvPrimerLayout.gutter,
      8,
    ),
    child: Text(
      text,
      style: GvPrimerTypography.archivo(
        size: 13,
        weight: 700,
      ).copyWith(color: GvPrimerSurface.of(context).roles.text.accent),
    ),
  );
}

void _noop() {}

/// GP classification: the results fixture (winner, P2, DNF), the states
/// fixture (Lapped, DNF, DNS, DSQ, DNQ, unknown finish; duplicate positions
/// with unresolved team names) and one development example without a team
/// line.
class PrimerResultRowsSpecimen extends StatelessWidget {
  const PrimerResultRowsSpecimen({
    super.key,
    this.spanish = false,
    this.states = true,
    this.main = true,
  });

  final bool spanish;

  /// Adds the states-fixture rows and the development example.
  final bool states;

  /// Shows the approved main fixture rows (off: edge states only).
  final bool main;

  @override
  Widget build(BuildContext context) {
    final bool es = spanish;
    final String pts = 'pts';
    final String finished = es ? 'Finalizó' : 'Finished';
    String points(String n) => es ? '$n Puntos' : '$n Points';
    String openTeam(String team) =>
        es ? 'Abrir el equipo $team' : 'Open team $team';
    final String unknown = es ? 'Estado desconocido' : 'Status unknown';
    final String lapped = es ? 'Doblado' : 'Lapped';
    final String laps = es ? '+2 vueltas' : '+2 laps';
    final String teamFallback = es
        ? 'Nombre del equipo no disponible'
        : 'Team name unavailable';
    final List<Widget> rows = <Widget>[
      if (main) ...<Widget>[
        GvPrimerResultRow(
          position: '1',
          driverName: 'Max Verstappen',
          winner: true,
          winnerLabel: es ? 'Ganador' : 'Winner',
          teamName: 'Red Bull Racing',
          teamSemanticLabel: openTeam('Red Bull Racing'),
          onOpenTeam: _noop,
          points: '25',
          pointsUnit: pts,
          timing: '1:15:12.345',
          semanticLabel:
              '1, Max Verstappen, Red Bull Racing, $finished, ${points('25')}, '
              '1:15:12.345, ${es ? 'Ganador' : 'Winner'}',
          onOpen: _noop,
          dividerAbove: false,
        ),
        GvPrimerResultRow(
          position: '2',
          driverName: 'Lando Norris',
          teamName: 'McLaren',
          teamSemanticLabel: openTeam('McLaren'),
          onOpenTeam: _noop,
          points: '18',
          pointsUnit: pts,
          timing: '+3.210',
          semanticLabel:
              '2, Lando Norris, McLaren, $finished, ${points('18')}, +3.210',
          onOpen: _noop,
        ),
        GvPrimerResultRow(
          position: '—',
          driverName: 'Charles Leclerc',
          teamName: 'Ferrari',
          teamSemanticLabel: openTeam('Ferrari'),
          onOpenTeam: _noop,
          statuses: const <GvPrimerStatusLabel>[
            GvPrimerStatusLabel('DNF', GvPrimerChipKind.known),
          ],
          semanticLabel: 'Charles Leclerc, Ferrari, DNF',
          onOpen: _noop,
        ),
      ],
      if (states) ...<Widget>[
        GvPrimerResultRow(
          position: '15',
          driverName: 'A Driver',
          teamName: 'A Team',
          teamSemanticLabel: openTeam('A Team'),
          onOpenTeam: _noop,
          timing: laps,
          statuses: <GvPrimerStatusLabel>[
            GvPrimerStatusLabel(lapped, GvPrimerChipKind.known),
          ],
          semanticLabel: '15, A Driver, A Team, $lapped, $laps',
          onOpen: _noop,
        ),
        for (final (String letter, String word) in <(String, String)>[
          ('B', 'DNF'),
          ('C', 'DNS'),
          ('D', 'DSQ'),
          ('E', 'DNQ'),
        ])
          GvPrimerResultRow(
            position: '—',
            driverName: '$letter Driver',
            teamName: '$letter Team',
            teamSemanticLabel: openTeam('$letter Team'),
            onOpenTeam: _noop,
            statuses: <GvPrimerStatusLabel>[
              GvPrimerStatusLabel(word, GvPrimerChipKind.known),
            ],
            semanticLabel: '$letter Driver, $letter Team, $word',
            onOpen: _noop,
          ),
        GvPrimerResultRow(
          position: '—',
          driverName: 'F Driver',
          teamName: 'F Team',
          teamSemanticLabel: openTeam('F Team'),
          onOpenTeam: _noop,
          // VS-1: an unknown finish is dashed (the pilot's solid outline is
          // superseded).
          statuses: <GvPrimerStatusLabel>[
            GvPrimerStatusLabel(unknown, GvPrimerChipKind.unknown),
          ],
          semanticLabel: 'F Driver, F Team, $unknown',
          onOpen: _noop,
        ),
        GvPrimerResultRow(
          position: '3',
          driverName: 'A Driver',
          teamName: teamFallback,
          teamNameIsFallback: true,
          teamSemanticLabel: es ? 'Abrir el equipo' : 'Open team',
          onOpenTeam: _noop,
          semanticLabel: '3, A Driver, $teamFallback, $finished',
          onOpen: _noop,
        ),
        const PrimerRowsCaption('Development example: no team line, no values'),
        GvPrimerResultRow(
          position: '—',
          driverName: 'G Driver',
          semanticLabel: 'G Driver',
          onOpen: _noop,
          dividerAbove: false,
        ),
      ],
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: rows,
    );
  }
}

/// Standings: the index fixture (leader, ranked rows), the states fixture
/// (unranked row above the confirmed leader, tied leaders, provisional row
/// marker without a dagger, unresolved name) and one development example
/// without points.
class PrimerStandingsRowsSpecimen extends StatelessWidget {
  const PrimerStandingsRowsSpecimen({
    super.key,
    this.spanish = false,
    this.states = true,
    this.main = true,
  });

  final bool spanish;
  final bool states;

  /// Shows the approved main fixture rows (off: edge states only).
  final bool main;

  @override
  Widget build(BuildContext context) {
    final bool es = spanish;
    String pts(String n) => es ? '$n puntos' : '$n points';
    String wins(int n) => es
        ? '$n ${n == 1 ? 'victoria' : 'victorias'}'
        : '$n ${n == 1 ? 'win' : 'wins'}';
    final String leader = es ? 'Líder del campeonato' : 'Championship leader';
    final String tied = es
        ? 'Empatado en el liderato del campeonato'
        : 'Tied for the championship lead';
    final String position = es ? 'Posición' : 'Position';
    final String nameFallback = es
        ? 'Nombre no disponible'
        : 'Name unavailable';
    final String unranked = es ? 'Sin clasificar' : 'Unranked';
    final String provisional = 'Provisional';

    Widget ranked(
      int pos,
      String name,
      String? team,
      String points,
      int winCount, {
      bool divider = true,
    }) => GvPrimerStandingsRow(
      position: '$pos',
      name: name,
      details: <String>[?team, wins(winCount)],
      points: points,
      semanticLabel: <String>[
        '$position $pos',
        name,
        ?team,
        pts(points),
        wins(winCount),
      ].join(', '),
      onOpen: _noop,
      dividerAbove: divider,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        if (main) ...<Widget>[
          GvPrimerStandingsRow(
            position: '1',
            name: 'Lando Norris',
            leaderLabel: leader,
            details: <String>['McLaren', wins(3)],
            points: '120',
            pointsUnit: 'pts',
            semanticLabel:
                '$position 1, Lando Norris, McLaren, ${pts('120')}, '
                '${wins(3)}, $leader',
            onOpen: _noop,
          ),
          ranked(2, 'Alexander Albon', null, '64', 1, divider: false),
          ranked(3, 'Fernando Alonso', 'Mercedes', '40', 0),
          ranked(4, 'Andrea Kimi Antonelli', 'Alpine', '7', 0),
          ranked(5, 'Paul Aron', 'Alpine', '7', 0),
        ],
        if (states) ...<Widget>[
          const PrimerRowsCaption(
            'Unranked row above the confirmed leader (delivered order)',
          ),
          GvPrimerStandingsRow(
            position: '—',
            name: 'Unranked Top',
            points: '999',
            // RK-1: "Unranked", never "Position unavailable".
            semanticLabel: '$unranked, Unranked Top, ${pts('999')}',
            onOpen: _noop,
            dividerAbove: false,
          ),
          GvPrimerStandingsRow(
            position: '1',
            name: 'Real Leader',
            leaderLabel: leader,
            points: '10',
            pointsUnit: 'pts',
            semanticLabel: '$position 1, Real Leader, ${pts('10')}, $leader',
            onOpen: _noop,
          ),
          const PrimerRowsCaption('Tied leaders'),
          for (final (String name, bool follows) in <(String, bool)>[
            ('Tied A', false),
            ('Tied B', true),
          ])
            GvPrimerStandingsRow(
              position: '1',
              name: name,
              leaderLabel: tied,
              points: '100',
              pointsUnit: 'pts',
              followsLeader: follows,
              semanticLabel: '$position 1, $name, ${pts('100')}, $tied',
              onOpen: _noop,
            ),
          const PrimerRowsCaption('Provisional row marker (word only, VS-3)'),
          GvPrimerStandingsRow(
            position: '1',
            name: 'Row A',
            leaderLabel: leader,
            statuses: <GvPrimerStatusLabel>[
              GvPrimerStatusLabel(provisional, GvPrimerChipKind.known),
            ],
            points: '10',
            pointsUnit: 'pts',
            semanticLabel:
                '$position 1, Row A, ${pts('10')}, $leader, $provisional',
            onOpen: _noop,
          ),
          GvPrimerStandingsRow(
            position: '2',
            name: 'Row B',
            points: '5',
            semanticLabel: '$position 2, Row B, ${pts('5')}',
            onOpen: _noop,
            dividerAbove: false,
          ),
          GvPrimerStandingsRow(
            position: '3',
            name: 'Row C',
            statuses: <GvPrimerStatusLabel>[
              GvPrimerStatusLabel(provisional, GvPrimerChipKind.known),
            ],
            points: '4',
            semanticLabel: '$position 3, Row C, ${pts('4')}, $provisional',
            onOpen: _noop,
          ),
          const PrimerRowsCaption('Unresolved name'),
          GvPrimerStandingsRow(
            position: '1',
            name: nameFallback,
            nameIsFallback: true,
            leaderLabel: leader,
            points: '25',
            pointsUnit: 'pts',
            semanticLabel: '$position 1, $nameFallback, ${pts('25')}, $leader',
            onOpen: _noop,
          ),
          const PrimerRowsCaption('Development example: points unavailable'),
          GvPrimerStandingsRow(
            position: '7',
            name: 'G Driver',
            details: const <String>['G Team'],
            semanticLabel: '$position 7, G Driver, G Team',
            onOpen: _noop,
            dividerAbove: false,
          ),
        ],
      ],
    );
  }
}

/// Calendar: Calendar Stage 1 rows (unknown status, the next event), the
/// LT-14 completed-row specimen (experimental evidence, XT-2) and
/// development examples for a known upcoming status, a cancellation and a
/// long name with details.
class PrimerRaceRowsSpecimen extends StatelessWidget {
  const PrimerRaceRowsSpecimen({
    super.key,
    this.spanish = false,
    this.states = true,
    this.main = true,
  });

  final bool spanish;
  final bool states;

  /// Shows the approved main fixture rows (off: edge states only).
  final bool main;

  @override
  Widget build(BuildContext context) {
    final bool es = spanish;
    final String round = es ? 'Ronda' : 'Round';
    final String unknown = es ? 'Estado desconocido' : 'Status unknown';
    final String completed = es ? 'Finalizado' : 'Completed';
    final String next = es ? 'Siguiente' : 'Next';

    Widget race(
      int n,
      String name,
      String circuit,
      GvPrimerStatusLabel status, {
      bool divider = true,
      bool highlighted = false,
      String? details,
    }) => GvPrimerRaceRow(
      round: '$n',
      name: name,
      circuit: circuit,
      details: details,
      statuses: <GvPrimerStatusLabel>[status],
      highlighted: highlighted,
      highlightLabel: highlighted ? next : null,
      semanticLabel: <String>[
        if (highlighted) next,
        '$round $n',
        name,
        circuit,
        ?details,
        status.label,
      ].join(', '),
      onOpen: _noop,
      dividerAbove: divider,
    );

    final GvPrimerStatusLabel unknownStatus = GvPrimerStatusLabel(
      unknown,
      GvPrimerChipKind.unknown,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        if (main) ...<Widget>[
          race(
            12,
            'Italian Grand Prix',
            'Autodromo Nazionale Monza',
            GvPrimerStatusLabel(completed, GvPrimerChipKind.completed),
            divider: false,
          ),
          race(
            20,
            'São Paulo Grand Prix',
            'Autódromo José Carlos Pace',
            unknownStatus,
          ),
          race(
            21,
            'Las Vegas Grand Prix',
            'Las Vegas Strip Circuit',
            unknownStatus,
          ),
          race(
            22,
            'Qatar Grand Prix',
            'Lusail International Circuit',
            unknownStatus,
          ),
          race(
            23,
            'Abu Dhabi Grand Prix',
            'Yas Marina Circuit',
            unknownStatus,
            highlighted: true,
            divider: false,
          ),
        ],
        if (states) ...<Widget>[
          const PrimerRowsCaption(
            'Development examples (artificial data): upcoming, cancelled, '
            'long name with details',
          ),
          race(
            1,
            'Grand Prix A',
            'Circuit A',
            GvPrimerStatusLabel(
              es ? 'Próximo' : 'Upcoming',
              GvPrimerChipKind.known,
            ),
            divider: false,
          ),
          race(
            2,
            'Grand Prix B',
            'Circuit B',
            GvPrimerStatusLabel(
              es ? 'Cancelado' : 'Cancelled',
              GvPrimerChipKind.cancelled,
            ),
          ),
          race(
            3,
            es
                ? 'Gran Premio con un nombre localizado excepcionalmente largo'
                : 'Grand Prix with an exceptionally long localized name',
            es
                ? 'Circuito urbano con un nombre igualmente largo'
                : 'Street circuit with an equally long name',
            unknownStatus,
            details: es
                ? 'Localidad, País · 6–8 nov'
                : 'Locality, Country · 6–8 Nov',
          ),
        ],
      ],
    );
  }
}
