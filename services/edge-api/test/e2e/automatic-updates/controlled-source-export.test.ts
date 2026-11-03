/**
 * Writes one phase of the controlled source of the deployed staging
 * demonstration (release gate AU-3, ADR 0028 D10; runbook §8.2) as a
 * `wrangler kv bulk put` file.
 *
 * Skipped unless asked for. From `services/edge-api`:
 *
 *   GRIDVIEW_CONTROLLED_SOURCE_OUT=<file outside the repository>
 *   GRIDVIEW_CONTROLLED_RACE_START=<RFC 3339 instant, minute 00, in 2026>
 *   GRIDVIEW_CONTROLLED_PHASE=<result | correction>
 *   npx vitest run test/e2e/automatic-updates/controlled-source-export.test.ts
 *
 * `result` writes every document. `correction` writes only the documents that
 * differ from the `result` phase, which is all the advance has to load.
 *
 * It builds the same documents the in-process demonstration plays
 * (`controlled-source.test.ts`), checks them with the transport's own
 * decoder, and writes `[{ key, value }]` with each value a JSON string. It
 * reads nothing from and sends nothing to Cloudflare or a provider; loading
 * the file into the demonstration Worker's namespace is a separately
 * authorized step of the runbook.
 */

import { writeFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { decodeControlledDocument } from '../../../src/providers/controlled/source';
import {
  controlledRounds,
  controlledSeasonDocuments,
  demonstrationPhases,
  shiftedRaceStart,
  type DemonstrationPhase,
} from './controlled-season';

const out = process.env.GRIDVIEW_CONTROLLED_SOURCE_OUT;
const raceStart = process.env.GRIDVIEW_CONTROLLED_RACE_START;
const phase = process.env.GRIDVIEW_CONTROLLED_PHASE;

describe.skipIf(out === undefined)('the controlled source export', () => {
  it('writes one bulk-put entry per document', async () => {
    expect(raceStart, 'GRIDVIEW_CONTROLLED_RACE_START').toBeDefined();
    const at = Date.parse(raceStart!);
    expect(new Date(at).toISOString()).toBe(raceStart);
    expect(['result', 'correction'], 'GRIDVIEW_CONTROLLED_PHASE').toContain(
      phase,
    );
    const phases = demonstrationPhases(raceStart!);
    const options = phases[phase as DemonstrationPhase];
    // The whole shifted season must stay inside 2026.
    const rounds = controlledRounds();
    for (const round of [rounds[0]!, rounds.at(-1)!]) {
      expect(
        shiftedRaceStart(options, round).slice(0, 4),
        `round ${round}`,
      ).toBe('2026');
    }
    const documents = await controlledSeasonDocuments(options);
    const loaded =
      phase === 'correction'
        ? await controlledSeasonDocuments(phases.result)
        : new Map<string, unknown>();
    const entries = [...documents]
      .filter(
        ([key, document]) =>
          JSON.stringify(document) !== JSON.stringify(loaded.get(key)),
      )
      .map(([key, document]) => {
        expect(decodeControlledDocument(document), key).not.toBeNull();
        return { key, value: JSON.stringify(document) };
      });
    writeFileSync(out!, `${JSON.stringify(entries, null, 2)}\n`);
    expect(entries.length).toBe(phase === 'result' ? documents.size : 1);
  });
});
