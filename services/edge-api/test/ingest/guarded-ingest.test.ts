/**
 * The guarded staging ingest, end to end through the real sequenced
 * publication service over both sequencer transports: the in-process
 * sequencer and the Durable Object client with a serialized transport.
 *
 * Batches are made by the real offline generator from synthetic recorded
 * captures. The active predecessor is the synthetic season at rounds 1-2, so
 * a batch at rounds 1-3 is a superset of it and passes D14/D15.
 */

import { describe, expect, it } from 'vitest';

import dataSources from '../../../../content/attribution/data-sources.json';

import type { SeasonBatchIngestOutcome } from '../../src/ingest/service';
import type { ProviderSeasonSource } from '../../src/providers/formula-one-provider';
import type { SeasonPublicationSequencerPort } from '../../src/publication/sequencer';
import { SequencedPublicationService } from '../../src/publication/sequenced/service';
import { generateSnapshotSet } from '../../src/snapshots/generator';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import {
  portWith,
  recording,
  sequencedContext,
  sequencerTransports,
  type SequencedContext,
  type SequencerTransport,
} from '../publication/sequenced/support';
import {
  BATCH_OBSERVED_AT,
  copy,
  impossibleInstantBatch,
  ingestContext,
  ingestFor,
  ingestOnce,
  PREDECESSOR_OBSERVED_AT,
  reanchored,
  SEASON,
  SEED_VERSION,
  submissionFor,
  syntheticBatch,
  type Batch,
  type Json,
} from './support';

type Publication = Extract<
  SeasonBatchIngestOutcome,
  { readonly outcome: 'publication' }
>;

function publication(outcome: SeasonBatchIngestOutcome): Publication {
  if (outcome.outcome !== 'publication') {
    throw new Error(`not a publication: ${JSON.stringify(outcome)}`);
  }
  return outcome;
}

/** Ground truth from the coordinator's own state, never through a fault. */
async function activeVersion(ctx: SequencedContext): Promise<string> {
  const authority = await ctx.coordinator.readAuthority(SEASON);
  if (authority.cutoverState !== 'active') throw new Error('not active');
  return authority.activeVersion;
}

async function versions(ctx: SequencedContext): Promise<string[]> {
  return ctx.storage.listVersions(SEASON);
}

function serviceWith(
  ctx: SequencedContext,
  port: SeasonPublicationSequencerPort,
): SequencedPublicationService {
  return new SequencedPublicationService({
    port,
    fallback: ctx.legacy,
    storage: ctx.storage,
    validator: runtimeSnapshotValidator,
    purger: ctx.purger,
    logger: ctx.logger,
    clock: ctx.clock,
    purgeOrigin: 'https://api.gridview.local',
  });
}

/** A document's data without Home's sequencer-assigned freshness instant. */
function withoutObservedAt(data: unknown): unknown {
  const value = copy(data) as { freshness?: Record<string, unknown> };
  if (value?.freshness) delete value.freshness.sourceUpdatedAt;
  return value;
}

/** Every provider-derived identifier the batch carries. */
function providerIdentifiers(batch: Batch): string[] {
  const source = batch.artifact.source as unknown as ProviderSeasonSource;
  return [
    ...source.drivers.map((driver) => driver.id),
    ...source.constructors.map((constructor) => constructor.id),
    ...source.circuits.map((circuit) => circuit.id),
  ];
}

describe.each(sequencerTransports)(
  'the guarded ingest over the %s transport',
  (transport: SequencerTransport) => {
    let batch: Batch;
    const context = () => ingestContext({ transport });

    /**
     * Loses the answers of the first `lost` finalizes after the sequencer
     * acted on them, and - when `blindAfterFinalize` - every authority read
     * after the first finalize, where this transport would really lose them.
     */
    function lossyService(
      ctx: SequencedContext,
      lost: number,
      blindAfterFinalize: boolean,
    ): SequencedPublicationService {
      let finalizes = 0;
      if (transport === 'durable-object') {
        ctx.transport!.intercept = async (command, run) => {
          if (command === 'finalize') {
            finalizes += 1;
            const response = await run();
            if (finalizes <= lost) throw new Error('finalize answer lost');
            return response;
          }
          if (command === 'read-authority' && blindAfterFinalize) {
            if (finalizes > 0) throw new Error('authority read lost');
          }
          return run();
        };
        return ctx.service;
      }
      return serviceWith(
        ctx,
        portWith(ctx.port, {
          finalize: async (request) => {
            finalizes += 1;
            const answer = await ctx.port.finalize(request);
            if (finalizes <= lost) throw new Error('finalize answer lost');
            return answer;
          },
          readAuthority: async (season) => {
            if (blindAfterFinalize && finalizes > 0) {
              throw new Error('authority read lost');
            }
            return ctx.port.readAuthority(season);
          },
        }),
      );
    }

    it('publishes a verified batch, regenerated at the Worker clock', async () => {
      batch = await syntheticBatch();
      const ctx = await context();
      const before = await versions(ctx);

      const outcome = publication(
        await ingestOnce(
          ingestFor(ctx, ctx.service),
          submissionFor(batch, SEED_VERSION),
        ),
      );

      expect(outcome.publication.status).toBe('applied');
      expect(outcome.publication.previousVersion).toBe(SEED_VERSION);
      expect(await activeVersion(ctx)).toBe(outcome.publication.version);
      expect(await versions(ctx)).toHaveLength(before.length + 1);
      expect(outcome.batch).toEqual({
        manifestSha256: batch.manifestSha256,
        artifactSha256: (batch.manifest.artifact as Json).sha256,
        observedAt: BATCH_OBSERVED_AT,
        expectedActiveVersion: SEED_VERSION,
        documentCount: (batch.artifact.documents as unknown[]).length,
        classifiedRounds: [1, 2, 3],
      });

      // The served data is the source's, generated at the Worker's clock -
      // not the submitted documents, which were generated at the capture.
      const now = ctx.clock.now().toISOString();
      const expected = generateSnapshotSet(
        batch.artifact.source as unknown as ProviderSeasonSource,
        now,
        'expected',
      );
      for (const document of expected.documents) {
        const stored = await ctx.storage.readVersionedDocument(
          SEASON,
          outcome.publication.version,
          document.documentName,
        );
        const name = String(document.documentName);
        expect(stored?.meta.generatedAt, name).toBe(now);
        // `prepare` assigns each key's observation timestamp, which Home
        // mirrors into its freshness block; everything else is generated.
        expect(withoutObservedAt(stored?.data), name).toEqual(
          withoutObservedAt(document.data),
        );
      }
    });

    it('returns and logs no provider data', async () => {
      batch ??= await syntheticBatch();
      const ctx = await context();
      const outcome = await ingestOnce(
        ingestFor(ctx, ctx.service),
        submissionFor(batch, SEED_VERSION),
      );
      const response = JSON.stringify(outcome);
      const logs = JSON.stringify(ctx.logger.events);
      for (const identifier of providerIdentifiers(batch)) {
        expect(response).not.toContain(identifier);
        expect(logs).not.toContain(identifier);
      }
      expect(response).not.toContain('api.jolpi.ca');
      expect(logs).not.toContain('api.jolpi.ca');
      const lines = ctx.logger.events.filter(
        (event) => event.operation === 'season-batch.ingest',
      );
      expect(lines).toHaveLength(1);
      expect(Object.keys(lines[0]!).sort()).toEqual(
        [
          'level',
          'operation',
          'requestId',
          'season',
          'operatorAction',
          'operatorOutcome',
          'publicationStatus',
          'releaseVersion',
        ].sort(),
      );
    });

    it('refuses a retry of a committed batch as stale, minting no duplicate', async () => {
      batch ??= await syntheticBatch();
      const ctx = await context();
      const ingest = ingestFor(ctx, ctx.service);
      const first = publication(
        await ingestOnce(ingest, submissionFor(batch, SEED_VERSION)),
      );
      expect(first.publication.status).toBe('applied');
      const after = await versions(ctx);
      const writes = ctx.storage.writeLog.length;

      const retry = publication(
        await ingestOnce(ingest, submissionFor(batch, SEED_VERSION)),
      );

      expect(retry.publication).toMatchObject({
        status: 'rejected',
        reason: 'guard-predecessor-stale',
        previousVersion: first.publication.version,
      });
      expect(await activeVersion(ctx)).toBe(first.publication.version);
      expect(await versions(ctx)).toEqual(after);
      expect(ctx.storage.writeLog).toHaveLength(writes);
    });

    it('refuses stale authority before reading or writing anything', async () => {
      batch ??= await syntheticBatch();
      const ctx = await context();
      const calls: string[] = [];
      const port = portWith(ctx.port, {
        prepare: (request) => {
          calls.push('prepare');
          return ctx.port.prepare(request);
        },
      });
      const writes = ctx.storage.writeLog.length;

      const outcome = publication(
        await ingestOnce(
          ingestFor(ctx, serviceWith(ctx, port)),
          submissionFor(batch, 'pm1-not-the-active-release'),
        ),
      );

      expect(outcome.publication).toMatchObject({
        status: 'rejected',
        reason: 'guard-predecessor-stale',
        previousVersion: SEED_VERSION,
      });
      expect(calls).toEqual([]);
      expect(ctx.storage.writeLog).toHaveLength(writes);
      expect(await activeVersion(ctx)).toBe(SEED_VERSION);
    });

    it('recovers a lost finalize answer once, then refuses the retry', async () => {
      batch ??= await syntheticBatch();
      const ctx = await context();
      const service = lossyService(ctx, 1, false);

      const outcome = publication(
        await ingestOnce(
          ingestFor(ctx, service),
          submissionFor(batch, SEED_VERSION),
        ),
      );
      expect(outcome.publication.status).toBe('applied');
      expect(await activeVersion(ctx)).toBe(outcome.publication.version);

      if (ctx.transport) ctx.transport.intercept = null;
      const after = await versions(ctx);
      const retry = publication(
        await ingestOnce(
          ingestFor(ctx, ctx.service),
          submissionFor(batch, SEED_VERSION),
        ),
      );
      expect(retry.publication.reason).toBe('guard-predecessor-stale');
      expect(await versions(ctx)).toEqual(after);
    });

    it('never duplicates a commit whose answer and confirmation were both lost', async () => {
      batch ??= await syntheticBatch();
      const ctx = await context();
      const service = lossyService(ctx, 2, true);

      const outcome = publication(
        await ingestOnce(
          ingestFor(ctx, service),
          submissionFor(batch, SEED_VERSION),
        ),
      );
      // Unknown to the caller, but committed on the sequencer.
      expect(outcome.publication).toMatchObject({
        status: 'failed',
        reason: 'sequencer-authority-unavailable',
      });
      const committed = await activeVersion(ctx);
      expect(committed).not.toBe(SEED_VERSION);

      // The operator re-submits the same reviewed submission once.
      if (ctx.transport) ctx.transport.intercept = null;
      const after = await versions(ctx);
      const retry = publication(
        await ingestOnce(
          ingestFor(ctx, ctx.service),
          submissionFor(batch, SEED_VERSION),
        ),
      );
      expect(retry.publication).toMatchObject({
        status: 'rejected',
        reason: 'guard-predecessor-stale',
        previousVersion: committed,
      });
      expect(await activeVersion(ctx)).toBe(committed);
      expect(await versions(ctx)).toEqual(after);
    });

    it('cleans up a failed candidate write, and a retry then publishes once', async () => {
      batch ??= await syntheticBatch();
      const ctx = await context();
      let failures = 0;
      ctx.storage.setWriteFailure((key) => {
        if (failures > 0 || !key.includes('pm1-')) return false;
        failures += 1;
        return true;
      });
      const ingest = ingestFor(ctx, ctx.service);
      const before = await versions(ctx);

      const failed = publication(
        await ingestOnce(ingest, submissionFor(batch, SEED_VERSION)),
      );
      expect(failed.publication.status).toBe('failed');
      expect(await activeVersion(ctx)).toBe(SEED_VERSION);
      expect(await versions(ctx)).toEqual(before);

      const retried = publication(
        await ingestOnce(ingest, submissionFor(batch, SEED_VERSION)),
      );
      expect(retried.publication.status).toBe('applied');
      expect(await activeVersion(ctx)).toBe(retried.publication.version);
      expect(await versions(ctx)).toHaveLength(before.length + 1);
    });

    it('commits at most one of two conflicting submissions', async () => {
      batch ??= await syntheticBatch();
      const other = await syntheticBatch([1, 2, 3], '2026-03-17T12:00:00.000Z');
      const ctx = await context();
      const before = await versions(ctx);

      const outcomes = await Promise.all([
        ingestOnce(
          ingestFor(ctx, ctx.service),
          submissionFor(batch, SEED_VERSION),
        ),
        ingestOnce(
          ingestFor(ctx, ctx.service),
          submissionFor(other, SEED_VERSION),
        ),
      ]);

      const statuses = outcomes.map(
        (outcome) => publication(outcome).publication,
      );
      const applied = statuses.filter((result) => result.status === 'applied');
      expect(applied).toHaveLength(1);
      expect(await activeVersion(ctx)).toBe(applied[0]!.version);
      expect(await versions(ctx)).toHaveLength(before.length + 1);
      const refused = statuses.find((result) => result.status !== 'applied')!;
      expect([
        'guard-predecessor-stale',
        'sequencer-prepare-rejected',
      ]).toContain(refused.reason);
    });

    it('is refused by D14 against a predecessor it does not contain', async () => {
      batch ??= await syntheticBatch();
      // The mock seed's only classified round is 12; the batch stops at 3.
      const ctx = await sequencedContext({
        transport,
        seedOrderingInput: PREDECESSOR_OBSERVED_AT,
      });
      const writes = ctx.storage.writeLog.length;

      const outcome = publication(
        await ingestOnce(
          ingestFor(ctx, ctx.service),
          submissionFor(batch, SEED_VERSION),
        ),
      );

      expect(outcome.publication).toMatchObject({
        status: 'rejected',
        reason: 'guard-round-coverage-regression',
      });
      expect(ctx.storage.writeLog).toHaveLength(writes);
      expect(await activeVersion(ctx)).toBe(SEED_VERSION);
    });

    it('is a benign no-op when older than the committed ordering input', async () => {
      batch ??= await syntheticBatch();
      const ctx = await ingestContext({
        transport,
        seedOrderingInput: '2026-07-10T00:00:00.000Z',
      });
      const before = await versions(ctx);

      const outcome = publication(
        await ingestOnce(
          ingestFor(ctx, ctx.service),
          submissionFor(batch, SEED_VERSION),
        ),
      );

      expect(outcome.publication).toMatchObject({
        status: 'rejected',
        reason: 'older-source-updated-at',
      });
      expect(await activeVersion(ctx)).toBe(SEED_VERSION);
      expect(await versions(ctx)).toEqual(before);
    });

    it('never reaches the legacy authority for a season that is not active', async () => {
      batch ??= await syntheticBatch();
      const ctx = await ingestContext({ transport, cutover: 'seeded' });
      const writes = ctx.storage.writeLog.length;
      const legacyActive = await ctx.storage.getActiveVersion(SEASON);

      const outcome = publication(
        await ingestOnce(
          ingestFor(ctx, ctx.service),
          submissionFor(batch, SEED_VERSION),
        ),
      );

      expect(outcome.publication).toMatchObject({
        status: 'failed',
        reason: 'guard-authority-not-sequenced',
      });
      expect(ctx.storage.writeLog).toHaveLength(writes);
      expect(await ctx.storage.getActiveVersion(SEASON)).toBe(legacyActive);
    });

    it('writes nothing for a batch that fails verification', async () => {
      batch ??= await syntheticBatch();
      const ctx = await context();
      const edited = copy(batch.artifact);
      ((edited.documents as Json[])[0]!.data as Json).tampered = true;
      const tampered = reanchored(batch.manifest, edited);
      const writes = ctx.storage.writeLog.length;

      const outcome = await ingestOnce(
        ingestFor(ctx, ctx.service),
        submissionFor(tampered, SEED_VERSION),
      );

      expect(outcome).toEqual({
        outcome: 'refused',
        stage: 'verification',
        reason: 'document-digest-mismatch',
      });
      expect(ctx.storage.writeLog).toHaveLength(writes);
      expect(await activeVersion(ctx)).toBe(SEED_VERSION);
    });

    it('refuses an impossible capture instant before any sequencer call or write', async () => {
      const impossible = await impossibleInstantBatch();
      const ctx = await context();
      const { port, calls } = recording(ctx.port);
      const writes = ctx.storage.writeLog.length;

      const outcome = await ingestOnce(
        ingestFor(ctx, serviceWith(ctx, port)),
        submissionFor(impossible, SEED_VERSION),
      );

      expect(outcome).toEqual({
        outcome: 'refused',
        stage: 'verification',
        reason: 'manifest-malformed',
      });
      expect(calls).toEqual([]);
      expect(ctx.storage.writeLog).toHaveLength(writes);
      expect(await activeVersion(ctx)).toBe(SEED_VERSION);
    });
  },
);

describe('the attribution admission gate (DP-7)', () => {
  const withJolpica = (status: string) => {
    const record = copy(dataSources) as unknown as Json;
    record.sources = (record.sources as Json[]).map((source) =>
      source.sourceId === 'jolpica' ? { ...source, status } : source,
    );
    return record;
  };

  it('refuses a record that does not credit the source as active exactly once', async () => {
    const ctx = await ingestContext();
    const active = withJolpica('active');
    const jolpica = (active.sources as Json[])[0]!;
    for (const record of [
      withJolpica('dormant'),
      { ...active, sources: [] },
      { ...active, sources: [jolpica, jolpica] },
    ]) {
      expect(
        ingestFor(ctx, ctx.service, { attributionRecord: record }).admit(),
      ).toBe('attribution-not-active');
    }
    // Not an attribution record at all: the curated metadata cannot name an
    // attribution version, so the season is refused one step earlier.
    for (const record of [{ ...active, kind: 'media-rights' }, {}]) {
      expect(
        ingestFor(ctx, ctx.service, { attributionRecord: record }).admit(),
      ).toBe('ingest-misconfigured');
    }
  });

  it('admits the committed record, which credits Jolpica as active under data-sources-v2', async () => {
    const ctx = await ingestContext();
    const admitted = ingestFor(ctx, ctx.service, {
      attributionRecord: undefined,
    }).admit();
    if (typeof admitted === 'string') throw new Error(admitted);
    expect(admitted.credit).toEqual({
      active: true,
      attribution: {
        recordVersion: 'data-sources-v2',
        name: 'Jolpica F1',
        sourceUrl: 'https://github.com/jolpica/jolpica-f1',
        licenseName: 'CC BY-NC-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
      },
    });
  });
});
