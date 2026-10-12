/**
 * Deep validation of a submitted, assembled season source.
 *
 * The guarded staging ingest receives a `ProviderSeasonSource` that was
 * assembled offline. It is untrusted input: nothing about it is assumed from
 * the fact that the offline generator ran the same code. Before anything is
 * generated from it, every member must have exactly the source's shape, every
 * entity must pass its ADR 0024 deep validator, every season-scoped entity
 * must belong to the submitted season, and the season must pass the same
 * referential preflight assembly ends with (`validateSeasonReferences`).
 *
 * The answer is one closed reason or `null`. No issue path, value or
 * identifier leaves this module: an issue can quote provider data.
 */

import {
  maxCollectionLength,
  validateCircuit,
  validateConstructor,
  validateConstructorSeasonEntry,
  validateConstructorStanding,
  validateDriver,
  validateDriverSeasonEntry,
  validateDriverStanding,
  validateGrandPrix,
  validateRaceResult,
  type ContractIssue,
} from '../contract/normalized';
import type { ProviderSeasonSource } from '../providers/formula-one-provider';
import { validateSeasonReferences } from '../providers/coordination/season-integrity';

export type SourceRefusal =
  /** Not an object with exactly the source's members and scalar types. */
  | 'source-malformed'
  /** An entity failed its deep validator, or names another season. */
  | 'source-invalid'
  /** The entities are individually valid but do not agree with each other. */
  | 'source-inconsistent';

const sourceKeys = [
  'season',
  'contentVersion',
  'mediaVersion',
  'attributionVersion',
  'sourceUpdatedAt',
  'seasonLabel',
  'calendar',
  'results',
  'drivers',
  'constructors',
  'circuits',
  'driverEntries',
  'constructorEntries',
  'driverStandings',
  'constructorStandings',
] as const;

type Validator = (value: unknown, path: string) => readonly ContractIssue[];

/** Each collection, its deep validator, and whether its rows carry `season`. */
const collections: readonly {
  readonly key: (typeof sourceKeys)[number];
  readonly validate: Validator;
  readonly seasonScoped: boolean;
}[] = [
  { key: 'calendar', validate: validateGrandPrix, seasonScoped: true },
  { key: 'results', validate: validateRaceResult, seasonScoped: true },
  { key: 'drivers', validate: validateDriver, seasonScoped: false },
  { key: 'constructors', validate: validateConstructor, seasonScoped: false },
  { key: 'circuits', validate: validateCircuit, seasonScoped: false },
  {
    key: 'driverEntries',
    validate: validateDriverSeasonEntry,
    seasonScoped: true,
  },
  {
    key: 'constructorEntries',
    validate: validateConstructorSeasonEntry,
    seasonScoped: true,
  },
  {
    key: 'driverStandings',
    validate: validateDriverStanding,
    seasonScoped: true,
  },
  {
    key: 'constructorStandings',
    validate: validateConstructorStanding,
    seasonScoped: true,
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const present = Object.keys(value);
  return (
    present.length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function hasScalarShape(value: Record<string, unknown>): boolean {
  return (
    Number.isSafeInteger(value.season) &&
    typeof value.contentVersion === 'string' &&
    isNullableString(value.mediaVersion) &&
    isNullableString(value.attributionVersion) &&
    typeof value.sourceUpdatedAt === 'string' &&
    isNullableString(value.seasonLabel)
  );
}

/**
 * Validates `value` as the assembled source of `season`, or names the first
 * closed reason it is refused for.
 */
export function sourceRefusal(
  value: unknown,
  season: number,
): SourceRefusal | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, sourceKeys) ||
    !hasScalarShape(value)
  ) {
    return 'source-malformed';
  }
  for (const { key } of collections) {
    const rows = value[key];
    if (!Array.isArray(rows) || rows.length > maxCollectionLength) {
      return 'source-malformed';
    }
  }
  if (value.season !== season) return 'source-invalid';
  for (const { key, validate, seasonScoped } of collections) {
    for (const row of value[key] as unknown[]) {
      if (validate(row, key).length > 0) return 'source-invalid';
      if (seasonScoped && (row as { season?: unknown }).season !== season) {
        return 'source-invalid';
      }
    }
  }
  const relations = validateSeasonReferences(
    value as unknown as ProviderSeasonSource,
  );
  return relations.length > 0 ? 'source-inconsistent' : null;
}
