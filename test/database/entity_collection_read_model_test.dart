import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/daos/calendar_dao.dart';
import 'package:gridview/core/database/daos/competitor_dao.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/constructor.dart';
import 'package:gridview/features/shared/domain/entities/driver.dart';
import 'package:gridview/features/shared/domain/entities/entity_profile.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/entities/season_card.dart';
import 'package:gridview/features/shared/domain/entities/season_entry.dart';
import 'package:gridview/features/shared/domain/entities/session.dart';
import 'package:gridview/features/shared/domain/entities/standing.dart';

/// The Explore collection and entity-detail read models, read from a real
/// database.
///
/// These prove what a collection card and a detail profile are allowed to say:
/// an unresolved referential stub never becomes a visible entity, a team is
/// never guessed, mid-season participation is never flattened or duplicated,
/// standings enrichment never reorders an authoritative collection, and no
/// optional value is ever turned into a false zero or a humanised identifier.
void main() {
  late GridViewDatabase db;
  late CompetitorDao competitors;
  late CalendarDao calendar;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    competitors = db.competitorDao;
    calendar = db.calendarDao;
  });
  tearDown(() => db.close());

  const int season = 2026;

  Future<void> seedIdentities() async {
    await competitors.upsertDrivers(<Driver>[
      const Driver(
        id: 'max-verstappen',
        fullName: 'Max Verstappen',
        shortCode: 'VER',
        nationality: 'Dutch',
        permanentNumber: 33,
      ),
      const Driver(id: 'jack-doohan', fullName: 'Jack Doohan'),
      const Driver(id: 'franco-colapinto', fullName: 'Franco Colapinto'),
    ]);
    await competitors.upsertConstructors(<Constructor>[
      const Constructor(
        id: 'red-bull',
        name: 'Red Bull',
        colorPrimary: '#1E41FF',
      ),
      const Constructor(id: 'alpine', name: 'Alpine'),
    ]);
  }

  DriverSeasonEntry entry({
    required String id,
    required String driverId,
    required String constructorId,
    int? raceNumber,
    DriverRole? role = DriverRole.race,
    int? startRound,
    int? endRound,
  }) => DriverSeasonEntry(
    id: id,
    season: season,
    driverId: driverId,
    constructorId: constructorId,
    raceNumber: raceNumber,
    role: role,
    startRound: startRound,
    endRound: endRound,
  );

  group('drivers collection', () {
    test('contains the real current-season identities', () async {
      await seedIdentities();
      await competitors.replaceDriverSeasonEntries(season, <DriverSeasonEntry>[
        entry(
          id: 'e1',
          driverId: 'max-verstappen',
          constructorId: 'red-bull',
          raceNumber: 1,
        ),
      ]);

      final List<SeasonDriverCard> cards = await competitors.seasonDriverCards(
        season,
      );
      expect(cards, hasLength(1));
      expect(cards.single.driverId, 'max-verstappen');
      expect(cards.single.name, 'Max Verstappen');
      expect(cards.single.raceNumber, 1);
      expect(cards.single.orderIndex, 0);
    });

    test('omits a driver whose identity is still an unresolved stub', () async {
      // No identity upsert: the season entry creates a referential stub only.
      await competitors.replaceDriverSeasonEntries(season, <DriverSeasonEntry>[
        entry(id: 'e1', driverId: 'not-synced', constructorId: 'red-bull'),
      ]);

      expect(await competitors.seasonDriverCards(season), isEmpty);
      // The relationship row itself is preserved.
      expect(await competitors.countDriverSeasonEntries(season), 1);
    });

    test(
      'takes the team from the exact season entry, never a standing',
      () async {
        await seedIdentities();
        await competitors
            .replaceDriverSeasonEntries(season, <DriverSeasonEntry>[
              entry(
                id: 'e1',
                driverId: 'max-verstappen',
                constructorId: 'red-bull',
                raceNumber: 1,
              ),
            ]);
        // A standing that names a *different* constructor must not rewrite the
        // participation history.
        await db.standingsDao.replaceDriverStandings(season, <DriverStanding>[
          const DriverStanding(
            season: season,
            driverId: 'max-verstappen',
            constructorId: 'alpine',
            position: 1,
            points: 400,
          ),
        ]);

        final SeasonDriverCard card = (await competitors.seasonDriverCards(
          season,
        )).single;
        expect(card.constructorId, 'red-bull');
        expect(card.teamName, 'Red Bull');
        expect(card.position, 1);
        expect(card.points, 400);
      },
    );

    test(
      'an unresolved constructor contributes no team name or colour',
      () async {
        await seedIdentities();
        await competitors
            .replaceDriverSeasonEntries(season, <DriverSeasonEntry>[
              entry(
                id: 'e1',
                driverId: 'max-verstappen',
                constructorId: 'not-synced-team',
              ),
            ]);

        final SeasonDriverCard card = (await competitors.seasonDriverCards(
          season,
        )).single;
        expect(card.constructorId, 'not-synced-team');
        expect(card.teamName, isNull);
        expect(card.teamColor, isNull);
      },
    );

    test('mid-season participation produces one card, not two', () async {
      await seedIdentities();
      await competitors.replaceDriverSeasonEntries(season, <DriverSeasonEntry>[
        entry(
          id: 'e1',
          driverId: 'franco-colapinto',
          constructorId: 'red-bull',
          raceNumber: 43,
          endRound: 6,
        ),
        entry(
          id: 'e2',
          driverId: 'franco-colapinto',
          constructorId: 'alpine',
          raceNumber: 43,
          startRound: 7,
        ),
      ]);

      final List<SeasonDriverCard> cards = await competitors.seasonDriverCards(
        season,
      );
      expect(cards, hasLength(1));
      expect(cards.single.spanCount, 2);
      expect(cards.single.hasMultipleSpans, isTrue);
      // The relevant span is the open one.
      expect(cards.single.constructorId, 'alpine');
    });

    test('optional values stay null and a confirmed zero survives', () async {
      await seedIdentities();
      await competitors.replaceDriverSeasonEntries(season, <DriverSeasonEntry>[
        entry(id: 'e1', driverId: 'jack-doohan', constructorId: 'alpine'),
      ]);
      await db.standingsDao.replaceDriverStandings(season, <DriverStanding>[
        const DriverStanding(
          season: season,
          driverId: 'jack-doohan',
          points: 0,
        ),
      ]);

      final SeasonDriverCard card = (await competitors.seasonDriverCards(
        season,
      )).single;
      expect(card.raceNumber, isNull);
      expect(card.position, isNull, reason: 'unranked is not zero');
      expect(card.points, 0, reason: 'a confirmed zero keeps its zero');
    });

    test('standings enrichment does not reorder the collection', () async {
      await seedIdentities();
      await competitors.replaceDriverSeasonEntries(season, <DriverSeasonEntry>[
        entry(
          id: 'e1',
          driverId: 'max-verstappen',
          constructorId: 'red-bull',
          raceNumber: 1,
        ),
        entry(
          id: 'e2',
          driverId: 'jack-doohan',
          constructorId: 'alpine',
          raceNumber: 7,
        ),
      ]);
      final List<String> before = (await competitors.seasonDriverCards(
        season,
      )).map((SeasonDriverCard c) => c.driverId).toList();

      // Doohan leads the championship; the roster order must not follow.
      await db.standingsDao.replaceDriverStandings(season, <DriverStanding>[
        const DriverStanding(
          season: season,
          driverId: 'jack-doohan',
          position: 1,
          points: 400,
        ),
        const DriverStanding(
          season: season,
          driverId: 'max-verstappen',
          position: 2,
          points: 300,
        ),
      ]);
      final List<String> after = (await competitors.seasonDriverCards(
        season,
      )).map((SeasonDriverCard c) => c.driverId).toList();

      expect(before, <String>['max-verstappen', 'jack-doohan']);
      expect(after, before, reason: 'the authoritative order is stable');
    });

    test('repeated reads preserve the same order', () async {
      await seedIdentities();
      await competitors.replaceDriverSeasonEntries(season, <DriverSeasonEntry>[
        entry(
          id: 'e1',
          driverId: 'max-verstappen',
          constructorId: 'red-bull',
          raceNumber: 1,
        ),
        entry(id: 'e2', driverId: 'jack-doohan', constructorId: 'alpine'),
        entry(
          id: 'e3',
          driverId: 'franco-colapinto',
          constructorId: 'alpine',
          raceNumber: 43,
        ),
      ]);
      final List<String> first = (await competitors.seasonDriverCards(
        season,
      )).map((SeasonDriverCard c) => c.driverId).toList();
      final List<String> second = (await competitors.seasonDriverCards(
        season,
      )).map((SeasonDriverCard c) => c.driverId).toList();
      expect(second, first);
      // Unnumbered entrants sort last.
      expect(first.last, 'jack-doohan');
    });
  });

  group('teams collection', () {
    Future<void> seedTeams({String? redBullSeasonName}) async {
      await seedIdentities();
      await competitors
          .replaceConstructorSeasonEntries(season, <ConstructorSeasonEntry>[
            ConstructorSeasonEntry(
              id: 'c-rb',
              season: season,
              constructorId: 'red-bull',
              fullName: redBullSeasonName,
              colorPrimary: '#1E41FF',
              powerUnit: 'Honda RBPT',
            ),
            const ConstructorSeasonEntry(
              id: 'c-alp',
              season: season,
              constructorId: 'alpine',
              fullName: 'BWT Alpine Formula One Team',
            ),
          ]);
    }

    test('season branding takes precedence over the stable name', () async {
      await seedTeams(redBullSeasonName: 'Oracle Red Bull Racing');
      final SeasonTeamCard card = (await competitors.seasonTeamCards(
        season,
      )).firstWhere((SeasonTeamCard c) => c.constructorId == 'red-bull');
      expect(card.displayName, 'Oracle Red Bull Racing');
      expect(card.stableName, 'Red Bull');
    });

    test(
      'rebranding preserves the stable id and the collection order',
      () async {
        await seedTeams(redBullSeasonName: 'Oracle Red Bull Racing');
        final List<String> before = (await competitors.seasonTeamCards(
          season,
        )).map((SeasonTeamCard c) => c.constructorId).toList();

        // A new season brand for the same stable identity.
        await competitors
            .replaceConstructorSeasonEntries(season, <ConstructorSeasonEntry>[
              const ConstructorSeasonEntry(
                id: 'c-rb',
                season: season,
                constructorId: 'red-bull',
                fullName: 'Zzz Racing Bulls Team',
              ),
              const ConstructorSeasonEntry(
                id: 'c-alp',
                season: season,
                constructorId: 'alpine',
                fullName: 'BWT Alpine Formula One Team',
              ),
            ]);
        final List<SeasonTeamCard> after = await competitors.seasonTeamCards(
          season,
        );
        expect(
          after.map((SeasonTeamCard c) => c.constructorId).toList(),
          before,
          reason: 'a rebrand never moves the team',
        );
        expect(
          after
              .firstWhere((SeasonTeamCard c) => c.constructorId == 'red-bull')
              .stableName,
          'Red Bull',
        );
      },
    );

    test('omits an unresolved constructor stub', () async {
      await competitors
          .replaceConstructorSeasonEntries(season, <ConstructorSeasonEntry>[
            const ConstructorSeasonEntry(
              id: 'c-x',
              season: season,
              constructorId: 'not-synced',
            ),
          ]);
      expect(await competitors.seasonTeamCards(season), isEmpty);
      expect(await competitors.countConstructorSeasonEntries(season), 1);
    });

    test('the line-up derives from the season participation entries', () async {
      await seedTeams();
      await competitors.replaceDriverSeasonEntries(season, <DriverSeasonEntry>[
        entry(
          id: 'e1',
          driverId: 'jack-doohan',
          constructorId: 'alpine',
          raceNumber: 7,
          endRound: 6,
        ),
        entry(
          id: 'e2',
          driverId: 'franco-colapinto',
          constructorId: 'alpine',
          raceNumber: 43,
          startRound: 7,
        ),
        entry(
          id: 'e3',
          driverId: 'max-verstappen',
          constructorId: 'red-bull',
          raceNumber: 1,
        ),
      ]);

      final SeasonTeamCard alpine = (await competitors.seasonTeamCards(
        season,
      )).firstWhere((SeasonTeamCard c) => c.constructorId == 'alpine');
      expect(
        alpine.lineup.map((TeamLineupMember m) => m.driverId).toList(),
        <String>['jack-doohan', 'franco-colapinto'],
      );
      // Both mid-season spans stay representable rather than being flattened.
      expect(alpine.lineup.first.endRound, 6);
      expect(alpine.lineup.last.startRound, 7);
      expect(
        alpine.lineup.every((TeamLineupMember m) => !m.isFullSeason),
        isTrue,
      );
    });

    test('an unresolved driver stub never becomes a line-up name', () async {
      await seedTeams();
      await competitors.replaceDriverSeasonEntries(season, <DriverSeasonEntry>[
        entry(id: 'e1', driverId: 'not-synced', constructorId: 'alpine'),
      ]);
      final SeasonTeamCard alpine = (await competitors.seasonTeamCards(
        season,
      )).firstWhere((SeasonTeamCard c) => c.constructorId == 'alpine');
      expect(alpine.lineup, isEmpty);
    });
  });

  group('circuits collection', () {
    Future<void> seedCalendarCircuits() async {
      await calendar.upsertCircuits(<Circuit>[
        const Circuit(
          id: 'monza',
          name: 'Autodromo Nazionale Monza',
          locality: 'Monza',
          country: 'Italy',
          lengthMeters: 5793,
        ),
        const Circuit(
          id: 'spa-francorchamps',
          name: 'Circuit de Spa-Francorchamps',
          locality: 'Stavelot',
          country: 'Belgium',
        ),
      ]);
    }

    GrandPrix event({
      required String id,
      required int round,
      required String circuitId,
      required String name,
      int inSeason = season,
    }) => GrandPrix(
      id: id,
      season: inSeason,
      round: round,
      eventSlug: id,
      name: name,
      circuitId: circuitId,
      status: EventStatus.scheduled,
      format: WeekendFormat.standard,
      startDate: '2026-07-10',
      sessions: const <Session>[],
      hasResults: false,
    );

    test('follows the season calendar order, not the circuit name', () async {
      await seedCalendarCircuits();
      await calendar.replaceCalendar(season, <GrandPrix>[
        event(
          id: 'gp-spa',
          round: 3,
          circuitId: 'spa-francorchamps',
          name: 'Belgian Grand Prix',
        ),
        event(
          id: 'gp-monza',
          round: 9,
          circuitId: 'monza',
          name: 'Italian Grand Prix',
        ),
      ], const <Circuit>[]);

      final List<SeasonCircuitCard> cards = await calendar.seasonCircuitCards(
        season,
      );
      expect(
        cards.map((SeasonCircuitCard c) => c.circuitId).toList(),
        <String>['spa-francorchamps', 'monza'],
        reason: 'round order, which is not alphabetical here',
      );
      expect(cards.first.orderIndex, 3);
      expect(cards.last.orderIndex, 9);
    });

    test('the related Grand Prix uses the exact season and round', () async {
      await seedCalendarCircuits();
      await calendar.replaceCalendar(season, <GrandPrix>[
        event(
          id: 'gp-monza',
          round: 9,
          circuitId: 'monza',
          name: 'Italian Grand Prix',
        ),
      ], const <Circuit>[]);

      final SeasonCircuitCard card = (await calendar.seasonCircuitCards(
        season,
      )).single;
      expect(card.relatedGrandPrix!.season, season);
      expect(card.relatedGrandPrix!.round, 9);
      expect(card.relatedGrandPrix!.name, 'Italian Grand Prix');
    });

    test('another season does not contribute circuits or events', () async {
      await seedCalendarCircuits();
      await calendar.replaceCalendar(2025, <GrandPrix>[
        event(
          id: 'gp-monza-2025',
          round: 9,
          circuitId: 'monza',
          name: 'Italian Grand Prix',
          inSeason: 2025,
        ),
      ], const <Circuit>[]);
      expect(await calendar.seasonCircuitCards(season), isEmpty);
      expect(await calendar.seasonCircuitCards(2025), hasLength(1));
    });

    test('omits an unresolved circuit stub', () async {
      await calendar.replaceCalendar(season, <GrandPrix>[
        event(
          id: 'gp-x',
          round: 1,
          circuitId: 'not-synced',
          name: 'Unknown Grand Prix',
        ),
      ], const <Circuit>[]);
      expect(await calendar.seasonCircuitCards(season), isEmpty);
    });
  });

  group('detail profiles', () {
    test(
      'a driver profile carries every participation span in order',
      () async {
        await seedIdentities();
        await competitors
            .replaceDriverSeasonEntries(season, <DriverSeasonEntry>[
              entry(
                id: 'e1',
                driverId: 'franco-colapinto',
                constructorId: 'red-bull',
                endRound: 6,
              ),
              entry(
                id: 'e2',
                driverId: 'franco-colapinto',
                constructorId: 'alpine',
                startRound: 7,
              ),
            ]);

        final DriverProfile profile = (await competitors.driverProfile(
          season,
          'franco-colapinto',
        ))!;
        expect(profile.participations, hasLength(2));
        expect(profile.hasMultipleParticipations, isTrue);
        expect(profile.relevantParticipation!.constructorId, 'alpine');
        expect(profile.participations.last.constructorId, 'red-bull');
      },
    );

    test('a stub never materializes a driver profile', () async {
      await competitors.replaceDriverSeasonEntries(season, <DriverSeasonEntry>[
        entry(id: 'e1', driverId: 'not-synced', constructorId: 'red-bull'),
      ]);
      expect(await competitors.driverProfile(season, 'not-synced'), isNull);
      expect(await competitors.hasResolvedDriver('not-synced'), isFalse);
      // The stub row exists for referential integrity.
      expect(await competitors.countDriver('not-synced'), 1);
    });

    test('a stub never materializes a team profile', () async {
      await competitors
          .replaceConstructorSeasonEntries(season, <ConstructorSeasonEntry>[
            const ConstructorSeasonEntry(
              id: 'c-x',
              season: season,
              constructorId: 'not-synced',
            ),
          ]);
      expect(await competitors.teamProfile(season, 'not-synced'), isNull);
      expect(await competitors.hasResolvedConstructor('not-synced'), isFalse);
      expect(await competitors.countConstructor('not-synced'), 1);
    });

    test('a stub never materializes a circuit profile', () async {
      await calendar.replaceCalendar(season, <GrandPrix>[
        GrandPrix(
          id: 'gp-x',
          season: season,
          round: 1,
          eventSlug: 'gp-x',
          name: 'Unknown Grand Prix',
          circuitId: 'not-synced',
          status: EventStatus.scheduled,
          format: WeekendFormat.standard,
          sessions: const <Session>[],
          hasResults: false,
        ),
      ], const <Circuit>[]);
      expect(await calendar.circuitProfile(season, 'not-synced'), isNull);
      expect(await calendar.hasResolvedCircuit('not-synced'), isFalse);
      expect(await calendar.countCircuit('not-synced'), 1);
    });

    test('a later authoritative upsert resolves the same row', () async {
      await competitors.replaceDriverSeasonEntries(season, <DriverSeasonEntry>[
        entry(id: 'e1', driverId: 'late-driver', constructorId: 'red-bull'),
      ]);
      expect(await competitors.seasonDriverCards(season), isEmpty);

      await competitors.upsertDriverIdentities(<Driver>[
        const Driver(id: 'late-driver', fullName: 'Late Driver'),
      ]);

      final List<SeasonDriverCard> cards = await competitors.seasonDriverCards(
        season,
      );
      expect(cards.single.name, 'Late Driver');
      expect(await competitors.hasResolvedDriver('late-driver'), isTrue);
      // The relationship survived the resolution — nothing was recreated.
      expect(await competitors.countDriverSeasonEntries(season), 1);
    });

    test(
      'a circuit profile selects the season event and resolves the lap-record name',
      () async {
        await calendar.upsertCircuits(<Circuit>[
          const Circuit(
            id: 'spa-francorchamps',
            name: 'Circuit de Spa-Francorchamps',
            lengthMeters: 7004,
            lapRecord: LapRecord(
              driverId: 'max-verstappen',
              time: Duration(minutes: 1, seconds: 46),
              year: 2018,
            ),
          ),
        ]);
        await seedIdentities();
        await calendar.replaceCalendar(season, <GrandPrix>[
          GrandPrix(
            id: 'gp-spa',
            season: season,
            round: 13,
            eventSlug: 'gp-spa',
            name: 'Belgian Grand Prix',
            circuitId: 'spa-francorchamps',
            status: EventStatus.scheduled,
            format: WeekendFormat.sprint,
            sessions: const <Session>[],
            hasResults: false,
          ),
        ], const <Circuit>[]);

        final CircuitProfile profile = (await calendar.circuitProfile(
          season,
          'spa-francorchamps',
        ))!;
        expect(profile.relatedGrandPrix!.round, 13);
        expect(profile.lapRecordDriverName, 'Max Verstappen');
        // Race distance and event lap count are not circuit identity fields.
        expect(profile.circuit.lengthMeters, 7004);
      },
    );

    test(
      'an unresolvable lap-record holder yields no name, never an id',
      () async {
        await calendar.upsertCircuits(<Circuit>[
          const Circuit(
            id: 'monza',
            name: 'Autodromo Nazionale Monza',
            lapRecord: LapRecord(driverId: 'ghost-driver', year: 2004),
          ),
        ]);
        final CircuitProfile profile = (await calendar.circuitProfile(
          season,
          'monza',
        ))!;
        expect(profile.lapRecordDriverName, isNull);
      },
    );

    test(
      'a circuit with no event in the season is still a valid profile',
      () async {
        await calendar.upsertCircuits(<Circuit>[
          const Circuit(id: 'monza', name: 'Autodromo Nazionale Monza'),
        ]);
        final CircuitProfile profile = (await calendar.circuitProfile(
          season,
          'monza',
        ))!;
        expect(profile.relatedGrandPrix, isNull);
        expect(profile.circuit.name, 'Autodromo Nazionale Monza');
      },
    );
  });
}
