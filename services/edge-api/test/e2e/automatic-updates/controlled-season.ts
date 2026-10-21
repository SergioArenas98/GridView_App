/**
 * The controlled season of the automatic-updates staging demonstration
 * (ADR 0028 D10): the documents `CONTROLLED_PROVIDER_SOURCE = "kv"` serves,
 * keyed exactly as the controlled transport reads them.
 *
 * It is the port tests' synthetic season - every identity curated content,
 * every URL `example.invalid` - with its calendar shifted so that round
 * `raceRound`'s race starts at `raceStart`. Every earlier round is already
 * classified; `raceRound`'s classification appears `availableAfterHours`
 * after its start, and optionally changes to a corrected variant later. Each
 * document holds the versions it passes through, so one load plays the whole
 * weekend with nobody acting during it.
 *
 * The same builder feeds the in-process test of the transport and the file
 * an operator loads with `wrangler kv bulk put` (`controlled-source-export
 * .test.ts`), so what is deployed is what was tested.
 */

import {
  CONTROLLED_SOURCE_KEY_PREFIX,
  type ControlledDocument,
  type ControlledVersion,
} from '../../../src/providers/controlled/source';
import { curatedEventLocators } from '../../providers/jolpica/support';
import {
  HOUR,
  JolpicaServer,
  anchorOf,
  seasonPaths,
  type ResultVariant,
} from '../../sync/coordinated/observation/support';
import { ControlledJolpica } from './stage';

export interface ControlledSeasonOptions {
  /** The round whose race the demonstration watches. */
  readonly raceRound: number;
  /** When that race starts, as an instant. */
  readonly raceStart: string;
  /** How long after the start Jolpica has the result. Defaults to 2 h. */
  readonly availableAfterHours?: number;
  /** A correction Jolpica makes later, if any. */
  readonly correction?: {
    readonly afterHours: number;
    readonly variant: ResultVariant;
  };
}

const EPOCH = '1970-01-01T00:00:00.000Z';
const SEASON_PATH = '/ergast/f1/2026';
const QUERY = '?limit=100';

/** The rounds of the synthetic season: the curated 2026 calendar. */
export function controlledRounds(): number[] {
  return curatedEventLocators().map((locator) => locator.round);
}

/** Every path the coordinated runtime requests, within the season. */
export function controlledPaths(): string[] {
  return [
    ...seasonPaths,
    ...controlledRounds().map((round) => `/${round}/results/`),
  ];
}

/** The controlled source's schedule for `options`. */
export function controlledSchedule(
  options: ControlledSeasonOptions,
): ControlledJolpica {
  const source = new ControlledJolpica();
  for (const round of controlledRounds()) {
    if (round < options.raceRound) source.available(round, EPOCH, 'A');
  }
  const start = Date.parse(options.raceStart);
  source.available(
    options.raceRound,
    new Date(start + (options.availableAfterHours ?? 2) * HOUR).toISOString(),
    'A',
  );
  if (options.correction) {
    source.available(
      options.raceRound,
      new Date(start + options.correction.afterHours * HOUR).toISOString(),
      options.correction.variant,
    );
  }
  return source;
}

/** The race instants of the shifted calendar, by round. */
export function shiftedRaceStart(
  options: ControlledSeasonOptions,
  round: number,
): string {
  const offset =
    Date.parse(options.raceStart) - anchorOf(options.raceRound).getTime();
  return new Date(anchorOf(round).getTime() + offset).toISOString();
}

/** The calendar envelope with every race moved by the season's offset. */
function shiftCalendar(
  body: unknown,
  options: ControlledSeasonOptions,
): unknown {
  const envelope = structuredClone(body) as {
    MRData: {
      RaceTable: { Races: { round: string; date: string; time?: string }[] };
    };
  };
  for (const race of envelope.MRData.RaceTable.Races) {
    const start = shiftedRaceStart(options, Number(race.round));
    race.date = start.slice(0, 10);
    race.time = `${start.slice(11, 19)}Z`;
  }
  return envelope;
}

/**
 * The controlled documents, by KV key. Consecutive identical versions are
 * merged, so a document changes only when what it serves changes.
 */
export async function controlledSeasonDocuments(
  options: ControlledSeasonOptions,
): Promise<Map<string, ControlledDocument>> {
  const schedule = controlledSchedule(options);
  const instants = [
    ...new Set([Date.parse(EPOCH), ...schedule.changeInstants()]),
  ].sort((left, right) => left - right);
  const versions = new Map<string, ControlledVersion[]>();
  for (const at of instants) {
    const server = new JolpicaServer();
    schedule.apply(server, at);
    for (const path of controlledPaths()) {
      const response = await server.transport(
        new Request(`https://api.jolpi.ca${SEASON_PATH}${path}${QUERY}`),
      );
      const raw: unknown = await response.json();
      const body = path === '/races/' ? shiftCalendar(raw, options) : raw;
      const key = `${CONTROLLED_SOURCE_KEY_PREFIX}${SEASON_PATH}${path}${QUERY}`;
      const list = versions.get(key) ?? [];
      const last = list.at(-1);
      if (
        last === undefined ||
        last.status !== response.status ||
        JSON.stringify(last.body) !== JSON.stringify(body)
      ) {
        list.push({
          from: new Date(at).toISOString(),
          status: response.status,
          body,
        });
      }
      versions.set(key, list);
    }
  }
  return new Map(
    [...versions].map(([key, list]) => [
      key,
      { schemaVersion: 1, versions: list },
    ]),
  );
}

/** An in-memory stand-in for the Worker's KV namespace. */
export class MemoryKv {
  readonly values = new Map<string, string>();
  reads = 0;

  load(documents: Map<string, ControlledDocument>): this {
    for (const [key, document] of documents) {
      this.values.set(key, JSON.stringify(document));
    }
    return this;
  }

  async get(key: string, type: 'json'): Promise<unknown> {
    this.reads += 1;
    if (type !== 'json') throw new Error('json only');
    const value = this.values.get(key);
    return value === undefined ? null : (JSON.parse(value) as unknown);
  }
}
