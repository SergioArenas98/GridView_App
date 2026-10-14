/**
 * `meta.generatedAt` as the logical publication instant, through the
 * two-phase protocol (ADR 0025 D4, amended 2026-10-14).
 *
 * Every committed release - ordinary or rollback-republication - carries one
 * instant on all of its documents, the content manifest and Home's embedded
 * freshness included, strictly later than the release it replaced. It comes
 * from the clock and the active release only; a refusal or a failed candidate
 * writes nothing and moves no floor.
 */

import { describe, expect, it } from 'vitest';

import { handlePublicRequest } from '../../../src/public/router';
import type { PublicationAuthority } from '../../../src/publication/authority';
import { SequencedPublicationService } from '../../../src/publication/sequenced/service';
import { readStoredInventory } from '../../../src/publication/version-inventory';
import { FixedClock, type Clock } from '../../../src/runtime/clock';
import { MemorySnapshotStorage } from '../../../src/storage/local';
import type {
  SnapshotDocumentName,
  SnapshotStorage,
  StoredSnapshot,
} from '../../../src/storage/types';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import {
  SEASON,
  SEED_HIGH_WATER_MARK,
  SEED_VERSION,
  SidecarReadFailingStorage,
  generatedSet,
  recording,
  sequencedContext,
  sequencerTransports,
  type SequencedContext,
  type SequencerTransport,
} from './support';

/** The fixed clock every context seeds its release at. */
const SEED_INSTANT = '2026-07-20T12:00:00.000Z';
const ONE_MS_AFTER_SEED = '2026-07-20T12:00:00.001Z';

const at = (instant: string) => new FixedClock(new Date(instant));

async function laterSet(clock: FixedClock, contentVersion = '2026.07.20.2') {
  return generatedSet(clock, 'ignored-by-sequencer', {
    sourceUpdatedAt: '2026-07-20T00:00:00.000Z',
    contentVersion,
  });
}

function serviceAt(
  ctx: SequencedContext,
  clock: Clock,
  storage: SnapshotStorage = ctx.storage,
  port = ctx.port,
): SequencedPublicationService {
  return new SequencedPublicationService({
    port,
    fallback: ctx.legacy,
    storage,
    validator: runtimeSnapshotValidator,
    purger: ctx.purger,
    logger: ctx.logger,
    clock,
    purgeOrigin: 'https://api.gridview.local',
  });
}

async function releaseDocuments(
  storage: SnapshotStorage,
  version: string,
): Promise<StoredSnapshot[]> {
  const inventory = await readStoredInventory(storage, SEASON, version);
  if (inventory.kind !== 'documents') throw new Error('no inventory');
  const documents: StoredSnapshot[] = [];
  for (const name of inventory.documents) {
    const document = await storage.readVersionedDocument(SEASON, version, name);
    if (!document) throw new Error(`missing ${name}`);
    documents.push(document);
  }
  return documents;
}

function named(
  documents: readonly StoredSnapshot[],
  name: SnapshotDocumentName,
): StoredSnapshot {
  const found = documents.find((document) => document.documentName === name);
  if (!found) throw new Error(`no ${name}`);
  return found;
}

/** Every instant the release serves is exactly `instant`, intervals kept. */
function expectOneInstant(
  documents: readonly StoredSnapshot[],
  instant: string,
): void {
  const millis = Date.parse(instant);
  for (const document of documents) {
    const name = document.documentName;
    expect(document.meta.generatedAt, name).toBe(instant);
    const interval = Date.parse(document.meta.staleAfter) - millis;
    expect(interval, name).toBe(
      name === 'content:manifest' ? 3600_000 : 900_000,
    );
  }
  const freshness = (
    named(documents, 'home').data as { freshness: Record<string, unknown> }
  ).freshness;
  expect(freshness.generatedAt).toBe(instant);
  expect(freshness.staleAfter).toBe(named(documents, 'home').meta.staleAfter);
  // The bootstrap embeds its own copy of Home, freshness included.
  const bootstrap = named(documents, 'bootstrap');
  const nested = (
    bootstrap.data as { home: { freshness: Record<string, unknown> } }
  ).home.freshness;
  expect(nested.generatedAt).toBe(instant);
  expect(nested.staleAfter).toBe(bootstrap.meta.staleAfter);
}

/** The one refusal line, with its reason and its closed cause. */
function expectInstantCause(
  ctx: SequencedContext,
  reason: string,
  cause: string,
): void {
  const lines = ctx.logger.events.filter(
    (event) => event.operation === 'publication.instant.rejected',
  );
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatchObject({
    failureCategory: reason,
    publicationInstantCause: cause,
  });
  // Bounded: no instant reaches the line.
  expect(JSON.stringify(lines[0])).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
}

async function activeVersion(ctx: SequencedContext): Promise<string> {
  const authority = await ctx.coordinator.readAuthority(SEASON);
  if (authority.cutoverState !== 'active') throw new Error('not active');
  return authority.activeVersion;
}

describe.each(sequencerTransports)(
  'the publication instant over the %s transport',
  (transport: SequencerTransport) => {
    const context = (storage?: MemorySnapshotStorage) =>
      sequencedContext({ transport, storage });

    describe('ordinary publication', () => {
      it('publishes the generation reading verbatim when it is already later', async () => {
        const ctx = await context();
        const generation = '2026-07-20T12:05:00.000Z';
        const set = await laterSet(at(generation));

        const result = await ctx.service.publish(set);

        expect(result.status).toBe('applied');
        const documents = await releaseDocuments(ctx.storage, result.version);
        expectOneInstant(documents, generation);
        // Byte-for-byte the generated data, apart from Home's
        // sequencer-assigned `sourceUpdatedAt`.
        expect(named(documents, 'calendar').data).toEqual(
          named(set.documents, 'calendar').data,
        );
      });

      it('steps one millisecond past the active release on an equal clock', async () => {
        const ctx = await context();
        const result = await ctx.service.publish(await laterSet(ctx.clock));

        expect(result.status).toBe('applied');
        expectOneInstant(
          await releaseDocuments(ctx.storage, result.version),
          ONE_MS_AFTER_SEED,
        );
      });

      it('steps past the active release on a backwards clock, keeping the generated data', async () => {
        const ctx = await context();
        const set = await laterSet(at('2026-07-20T11:00:00.000Z'));

        const result = await ctx.service.publish(set);

        expect(result.status).toBe('applied');
        const documents = await releaseDocuments(ctx.storage, result.version);
        expectOneInstant(documents, ONE_MS_AFTER_SEED);
        // The season's chronology was resolved at the generation reading and
        // is published unchanged: only the publication fields moved.
        expect(named(documents, 'season').data).toEqual(
          named(set.documents, 'season').data,
        );
      });

      it('orders consecutive publications at one clock reading strictly', async () => {
        const ctx = await context();
        const first = await ctx.service.publish(await laterSet(ctx.clock));
        const second = await ctx.service.publish(
          await laterSet(ctx.clock, '2026.07.20.3'),
        );

        expect(second.status).toBe('applied');
        expect(second.previousVersion).toBe(first.version);
        expectOneInstant(
          await releaseDocuments(ctx.storage, second.version),
          '2026-07-20T12:00:00.002Z',
        );
      });

      it('leaves sourceUpdatedAt and contentVersion to their own rules', async () => {
        const ctx = await context();
        const result = await ctx.service.publish(await laterSet(ctx.clock));
        const documents = await releaseDocuments(ctx.storage, result.version);

        // An unchanged key keeps its seeded observation timestamp; a changed
        // one gets the sequencer's - neither is the publication instant.
        expect(named(documents, 'circuits').meta.sourceUpdatedAt).toBe(
          SEED_HIGH_WATER_MARK,
        );
        expect(named(documents, 'content:manifest').meta.sourceUpdatedAt).toBe(
          SEED_INSTANT,
        );
        for (const document of documents) {
          expect(document.meta.contentVersion).toBe('2026.07.20.2');
        }
      });
    });

    describe('rollback republication', () => {
      it('republishes the target with one instant strictly later than the release it replaces', async () => {
        const ctx = await context();
        const published = await ctx.service.publish(
          await laterSet(at('2026-07-20T12:05:00.000Z')),
        );
        expect(published.status).toBe('applied');

        const rollback = await serviceAt(
          ctx,
          at('2026-07-20T12:10:00.000Z'),
        ).rollback(SEASON, SEED_VERSION);

        expect(rollback.status).toBe('applied');
        const documents = await releaseDocuments(ctx.storage, rollback.version);
        expectOneInstant(documents, '2026-07-20T12:10:00.000Z');
        // The target's own stable data comes back verbatim.
        expect(named(documents, 'calendar').data).toEqual(
          named(ctx.seedSet.documents, 'calendar').data,
        );
      });

      it('steps past the replaced release when the clock is behind it', async () => {
        const ctx = await context();
        const published = await ctx.service.publish(
          await laterSet(at('2026-07-20T12:05:00.000Z')),
        );
        expect(published.status).toBe('applied');

        // The service clock is the seed's: five minutes behind the release.
        const rollback = await ctx.service.rollback(SEASON, SEED_VERSION);

        expect(rollback.status).toBe('applied');
        expectOneInstant(
          await releaseDocuments(ctx.storage, rollback.version),
          '2026-07-20T12:05:00.001Z',
        );
      });
    });

    describe('the served instant', () => {
      it('is the same on the content manifest, Home and a season document', async () => {
        const ctx = await context();
        const result = await ctx.service.publish(await laterSet(ctx.clock));
        expect(result.status).toBe('applied');
        const authority: PublicationAuthority = {
          mode: 'sequencer',
          port: ctx.port,
        };

        const served: unknown[] = [];
        for (const path of [
          '/v1/content/manifest',
          '/v1/home',
          '/v1/seasons/2026/calendar',
        ]) {
          const response = await handlePublicRequest(
            new Request(`https://api.gridview.local${path}`),
            ctx.storage,
            'req',
            authority,
          );
          expect(response.response.status, path).toBe(200);
          const body = (await response.response.json()) as {
            meta: { generatedAt: string };
            data: { freshness?: { generatedAt: string } };
          };
          served.push(body.meta.generatedAt);
          if (body.data.freshness) served.push(body.data.freshness.generatedAt);
        }
        expect(served).toEqual(Array(4).fill(ONE_MS_AFTER_SEED));
      });
    });

    describe('refusals and failures before the commit', () => {
      it('refuses before prepare when the active release cannot be read', async () => {
        const ctx = await context();
        const storage = new SidecarReadFailingStorage(ctx.storage);
        // A non-results document: the guard reads only results documents,
        // so this reaches the instant step.
        storage.hiddenDocuments.add(`${SEED_VERSION}|circuits`);
        const { port, calls } = recording(ctx.port);
        const versionsBefore = await ctx.storage.listVersions(SEASON);

        const result = await serviceAt(ctx, ctx.clock, storage, port).publish(
          await laterSet(ctx.clock),
        );

        expect(result).toMatchObject({
          status: 'failed',
          reason: 'publication-instant-unavailable',
          previousVersion: SEED_VERSION,
        });
        expectInstantCause(
          ctx,
          'publication-instant-unavailable',
          'active-release-unreadable',
        );
        expect(calls).toEqual(['readAuthority']);
        expect(await ctx.storage.listVersions(SEASON)).toEqual(versionsBefore);
        expect(await activeVersion(ctx)).toBe(SEED_VERSION);
      });

      it('refuses before prepare when the active release carries an unusable instant', async () => {
        const ctx = await context();
        const drivers = await ctx.storage.readVersionedDocument(
          SEASON,
          SEED_VERSION,
          'drivers',
        );
        if (!drivers) throw new Error('no drivers');
        await ctx.storage.writeVersionedDocument(SEASON, SEED_VERSION, {
          ...drivers,
          meta: { ...drivers.meta, generatedAt: 'not-an-instant' },
        });
        const { port, calls } = recording(ctx.port);

        const result = await serviceAt(
          ctx,
          ctx.clock,
          ctx.storage,
          port,
        ).publish(await laterSet(ctx.clock));

        expect(result).toMatchObject({
          status: 'failed',
          reason: 'publication-instant-invalid',
        });
        expectInstantCause(
          ctx,
          'publication-instant-invalid',
          'active-instant-invalid',
        );
        expect(calls).toEqual(['readAuthority']);
        expect(await activeVersion(ctx)).toBe(SEED_VERSION);
      });

      it('refuses before prepare when the required step is exhausted', async () => {
        const ctx = await context();
        const home = await ctx.storage.readVersionedDocument(
          SEASON,
          SEED_VERSION,
          'home',
        );
        if (!home) throw new Error('no home');
        await ctx.storage.writeVersionedDocument(SEASON, SEED_VERSION, {
          ...home,
          meta: { ...home.meta, generatedAt: '9999-12-31T23:59:59.999Z' },
        });
        const { port, calls } = recording(ctx.port);

        const result = await serviceAt(
          ctx,
          ctx.clock,
          ctx.storage,
          port,
        ).publish(await laterSet(ctx.clock));

        expect(result).toMatchObject({
          status: 'failed',
          reason: 'publication-instant-exhausted',
        });
        expectInstantCause(ctx, 'publication-instant-exhausted', 'year-range');
        expect(calls).toEqual(['readAuthority']);
      });

      it('refuses a candidate whose documents disagree on their generation instant', async () => {
        const ctx = await context();
        const set = await laterSet(ctx.clock);
        const drifted = {
          ...set,
          documents: set.documents.map((document) =>
            document.documentName === 'circuits'
              ? {
                  ...document,
                  meta: {
                    ...document.meta,
                    generatedAt: '2026-07-20T12:00:00.500Z',
                  },
                }
              : document,
          ),
        };
        const { port, calls } = recording(ctx.port);

        const result = await serviceAt(
          ctx,
          ctx.clock,
          ctx.storage,
          port,
        ).publish(drifted);

        expect(result).toMatchObject({
          status: 'failed',
          reason: 'publication-instant-invalid',
        });
        expectInstantCause(
          ctx,
          'publication-instant-invalid',
          'candidate-not-uniform',
        );
        expect(calls).toEqual(['readAuthority']);
      });

      it('a failed candidate advances no floor: the next one starts from the release still active', async () => {
        const inner = new MemorySnapshotStorage();
        const ctx = await context(inner);
        inner.setWriteFailure((key) => key.includes(':calendar'));
        const failedRun = await ctx.service.publish(
          await laterSet(at('2026-07-20T12:30:00.000Z')),
        );
        expect(failedRun).toMatchObject({
          status: 'failed',
          reason: 'storage-write',
        });
        expect(await activeVersion(ctx)).toBe(SEED_VERSION);

        inner.setWriteFailure(null);
        const next = await ctx.service.publish(await laterSet(ctx.clock));

        expect(next.status).toBe('applied');
        // Seed + 1 ms, not the failed candidate's 12:30 + 1 ms.
        expectOneInstant(
          await releaseDocuments(ctx.storage, next.version),
          ONE_MS_AFTER_SEED,
        );
      });
    });

    describe('existing releases', () => {
      it('publishes past a pre-rule release whose documents carry different instants', async () => {
        const ctx = await context();
        // A release committed before the rule: one document carries a later
        // instant than the rest, so the floor is that one, not the manifest's.
        const round = await ctx.storage.readVersionedDocument(
          SEASON,
          SEED_VERSION,
          'grand-prix:13',
        );
        if (!round) throw new Error('no round');
        await ctx.storage.writeVersionedDocument(SEASON, SEED_VERSION, {
          ...round,
          meta: { ...round.meta, generatedAt: '2026-07-20T12:07:00.000Z' },
        });

        const result = await ctx.service.publish(
          await laterSet(at('2026-07-20T12:05:00.000Z')),
        );

        expect(result.status).toBe('applied');
        expectOneInstant(
          await releaseDocuments(ctx.storage, result.version),
          '2026-07-20T12:07:00.001Z',
        );
      });
    });
  },
);
