/**
 * Production genesis: bringing a season with **no earlier release** into the
 * sequencer
 * ([ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D12, "Amendment (2026-10-20): production genesis"; owner decision O-16).
 *
 * D12's migration seeds the sequencer from an existing legacy release. A
 * season that never had one - every production season - has nothing to seed.
 * Genesis is the separate, authenticated operator act for that case:
 *
 * ```
 * gate (genesis:<season>, production or staging, sequencer, reachable port)
 *   -> explicit confirmation
 *   -> the sequencer's own answer (a retry is decided here)
 *   -> no legacy active or previous pointer for the season
 *   -> commitGenesis: `genesis`, no version, no baseline, no floor
 * ```
 *
 * ## What genesis does not do
 *
 * It publishes nothing and writes no Workers KV key. Public reads of the
 * season stay unavailable while it is `genesis`. Its first release is an
 * ordinary guarded publication against the empty predecessor the sequencer
 * reports; that commit is what makes the season `active`, with no previous
 * version, so there is still nothing to roll back to.
 *
 * ## Why the legacy check cannot race a legacy release
 *
 * The same `genesis:<season>` control that permits this operation closes the
 * season's legacy publication and rollback admission in this Worker
 * (`CutoverPausedPublicationCommands`), so no legacy release can appear between
 * the pointer read and the sequencer write. The sequencer independently refuses
 * any season it holds state for.
 */

import type { Logger } from '../../logging/logger';
import type { EnvironmentName, RuntimeConfig } from '../../config/environment';
import type { SnapshotStorage } from '../../storage/types';
import type { PublicationAuthority } from '../authority';
import { encodeUtf8, utf8ByteLength } from '../canonical/ordering';
import {
  genesisFingerprintPrefix,
  type SeasonAuthority,
} from '../sequencer/model';
import type { SeasonPublicationSequencerPort } from '../sequencer/port';
import { isAuditReference } from './checkpoint';
import type { CutoverControl } from './control';
import { cutoverGate, type CutoverGateRefusal } from './gate';

/** The fingerprint derivation's own version tag. */
export const genesisFingerprintFormatVersion = 'gv-genesis/1';

/**
 * The prefix every genesis fingerprint carries, as the sequencer reserves it
 * (`genesisFingerprintPrefix`). Never `cutover1:`.
 */
export const genesisFingerprintAlgorithm = genesisFingerprintPrefix.slice(
  0,
  -1,
);

/** One operator genesis request, already decoded. */
export interface SeasonGenesisCommand {
  readonly season: number;
  /** A bounded operator label naming this genesis, e.g. a change reference. */
  readonly genesisIdentity: string;
  /** Must be the literal `true`; anything else is not a confirmation. */
  readonly confirmGenesis: boolean;
}

/** Why a genesis failed after the gate allowed it. Closed. */
export const seasonGenesisFailures = [
  /** The request carried no explicit confirmation. */
  'genesis-not-confirmed',
  /** The genesis identity is not a bounded operator reference. */
  'invalid-genesis-identity',
  /** The sequencer's authority lookup could not be resolved. */
  'authority-unreadable',
  /**
   * The sequencer holds state for this season that this genesis did not
   * create: a seed, a release, or a genesis under another identity.
   */
  'sequencer-state-present',
  /** A legacy active or previous pointer could not be read. */
  'legacy-state-unreadable',
  /** The season has a legacy release: it is a migration, not a genesis. */
  'legacy-release-present',
  /** The sequencer refused the genesis for another bounded reason. */
  'genesis-rejected',
  /**
   * The answer was lost and one authority read did not show this genesis.
   * Nothing is known to have been written; the request may be retried.
   */
  'genesis-unconfirmed',
] as const;

export type SeasonGenesisFailure = (typeof seasonGenesisFailures)[number];

/** The safe operator receipt. Never an operation token or a storage key. */
export interface SeasonGenesisReceipt {
  readonly season: number;
  /**
   * `created` - this request wrote the genesis record.
   * `already-genesis` / `already-active` - this genesis already exists; nothing
   * was written. `active` means its first release has since committed.
   * `reconciled` - the sequencer's answer was lost, and one authority read
   * shows this genesis in place.
   */
  readonly outcome:
    'created' | 'already-genesis' | 'already-active' | 'reconciled';
  readonly cutoverState: 'genesis' | 'active';
  readonly genesisFingerprint: string;
}

export type SeasonGenesisResult =
  | { readonly kind: 'genesis'; readonly receipt: SeasonGenesisReceipt }
  | { readonly kind: 'refused'; readonly refusal: CutoverGateRefusal }
  | { readonly kind: 'failed'; readonly failure: SeasonGenesisFailure };

export interface SeasonGenesisDeps {
  readonly config: RuntimeConfig;
  readonly authority: PublicationAuthority;
  readonly storage: SnapshotStorage;
  readonly logger: Logger;
}

export class SeasonGenesisService {
  private readonly control: CutoverControl;
  private readonly environment: EnvironmentName;
  private readonly authority: PublicationAuthority;
  private readonly storage: SnapshotStorage;
  private readonly logger: Logger;

  constructor(deps: SeasonGenesisDeps) {
    this.control = deps.config.publicationCutoverControl;
    this.environment = deps.config.environment;
    this.authority = deps.authority;
    this.storage = deps.storage;
    this.logger = deps.logger;
  }

  async genesis(command: SeasonGenesisCommand): Promise<SeasonGenesisResult> {
    const season = command.season;
    const gate = cutoverGate(
      this.control,
      this.environment,
      this.authority,
      season,
      'genesis',
    );
    if (gate.kind === 'refused') {
      this.logger.warn({
        operation: 'publication.cutover.genesis_refused',
        season,
        failureCategory: gate.refusal,
      });
      return { kind: 'refused', refusal: gate.refusal };
    }
    if (command.confirmGenesis !== true) {
      return this.failed(season, 'genesis-not-confirmed');
    }
    if (!isAuditReference(command.genesisIdentity)) {
      return this.failed(season, 'invalid-genesis-identity');
    }
    const port = gate.port;
    const fingerprint = await genesisFingerprint(
      season,
      command.genesisIdentity,
    );

    // The sequencer's own answer first, so a retry after a lost response is
    // decided without reading legacy state again.
    const before = await readAuthority(port, season);
    if (before === null || before.cutoverState === 'unavailable') {
      return this.failed(season, 'authority-unreadable');
    }
    if (before.cutoverState !== 'uninitialized') {
      const existing = existingGenesis(before, fingerprint);
      if (existing === null) {
        return this.failed(season, 'sequencer-state-present');
      }
      return this.succeeded(season, {
        season,
        outcome: existing === 'genesis' ? 'already-genesis' : 'already-active',
        cutoverState: existing,
        genesisFingerprint: fingerprint,
      });
    }

    const legacy = await this.legacyRelease(season);
    if (legacy !== 'none') return this.failed(season, legacy);

    let outcome;
    try {
      outcome = await port.commitGenesis({
        season,
        genesisFingerprint: fingerprint,
      });
    } catch {
      outcome = { outcome: 'uncertain' } as const;
    }
    switch (outcome.outcome) {
      case 'created':
      case 'already-genesis':
      case 'already-active':
        return this.succeeded(season, {
          season,
          outcome: outcome.outcome,
          cutoverState:
            outcome.outcome === 'already-active' ? 'active' : 'genesis',
          genesisFingerprint: fingerprint,
        });
      case 'rejected':
        return this.failed(
          season,
          outcome.reason === 'sequencer-state-present'
            ? 'sequencer-state-present'
            : 'genesis-rejected',
        );
      case 'uncertain': {
        // The write may or may not have committed. One read decides; there is
        // no second write and no loop.
        const after = await readAuthority(port, season);
        const confirmed =
          after === null ? null : existingGenesis(after, fingerprint);
        if (confirmed === null) {
          return this.failed(season, 'genesis-unconfirmed');
        }
        return this.succeeded(season, {
          season,
          outcome: 'reconciled',
          cutoverState: confirmed,
          genesisFingerprint: fingerprint,
        });
      }
    }
  }

  /**
   * Whether the season has a legacy release: either pointer present. A read
   * that fails is never "none".
   */
  private async legacyRelease(
    season: number,
  ): Promise<'none' | 'legacy-release-present' | 'legacy-state-unreadable'> {
    try {
      const active = await this.storage.getActiveVersion(season);
      const previous = await this.storage.getPreviousVersion(season);
      return active === null && previous === null
        ? 'none'
        : 'legacy-release-present';
    } catch {
      return 'legacy-state-unreadable';
    }
  }

  private succeeded(
    season: number,
    receipt: SeasonGenesisReceipt,
  ): SeasonGenesisResult {
    this.logger.info({
      operation: 'publication.cutover.genesis',
      season,
      cutoverState: receipt.cutoverState,
      publicationStatus: receipt.outcome,
    });
    return { kind: 'genesis', receipt };
  }

  private failed(
    season: number,
    failure: SeasonGenesisFailure,
  ): SeasonGenesisResult {
    this.logger.warn({
      operation: 'publication.cutover.genesis_failed',
      season,
      failureCategory: failure,
    });
    return { kind: 'failed', failure };
  }
}

async function readAuthority(
  port: SeasonPublicationSequencerPort,
  season: number,
): Promise<SeasonAuthority | null> {
  try {
    return await port.readAuthority(season);
  } catch {
    return null;
  }
}

/**
 * `genesis` or `active` when the authority is this exact genesis - still
 * without a release, or since published - and `null` for anything else,
 * including a seeded or migrated season and a genesis under another identity.
 */
function existingGenesis(
  authority: SeasonAuthority,
  fingerprint: string,
): 'genesis' | 'active' | null {
  if (
    authority.cutoverState !== 'genesis' &&
    authority.cutoverState !== 'active'
  ) {
    return null;
  }
  return authority.cutoverFingerprint === fingerprint
    ? authority.cutoverState
    : null;
}

/** The framed text a genesis fingerprint digests. */
export function genesisFingerprintText(
  season: number,
  genesisIdentity: string,
): string {
  return [
    genesisFingerprintFormatVersion,
    frame(String(season)),
    frame(genesisIdentity),
  ].join('');
}

/**
 * The deterministic fingerprint for one genesis: `genesis1:<64 hex>`. Its
 * prefix keeps it disjoint from every `cutover1:` seed fingerprint, so a genesis
 * can never be mistaken for, or activated as, a seed.
 */
export async function genesisFingerprint(
  season: number,
  genesisIdentity: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encodeUtf8(
      genesisFingerprintText(season, genesisIdentity),
    ) as unknown as BufferSource,
  );
  let out = '';
  for (const byte of new Uint8Array(digest)) {
    out += byte.toString(16).padStart(2, '0');
  }
  return `${genesisFingerprintAlgorithm}:${out}`;
}

function frame(value: string): string {
  return `|${utf8ByteLength(value)}:${value}`;
}
