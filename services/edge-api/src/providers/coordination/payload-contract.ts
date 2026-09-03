/**
 * Deep normalized-contract validation of a coordinated candidate.
 *
 * **Why the coordinator and not only the adapter.** An adapter is the component
 * that *normalizes* provider data, and it is still responsible for doing that
 * correctly. It is not a component that can *vouch* for the result: it is the
 * one boundary in this package whose output is untrusted by construction, which
 * is why the coordinator already re-parses its outcome shape, derives its job
 * category, refuses to take its word on an attempt, and detaches its payload
 * rather than holding its reference. Contract conformance is the same kind of
 * claim, and it is checked the same way - once, here, on the value that will
 * actually be published.
 *
 * **Why not at publication.** A document reaching the publisher has already
 * been assembled from candidates. Validating there would report a failure after
 * selection, assembly and generation have all consumed the value, would attach
 * it to a season rather than to the source contribution that produced it, and
 * would put the contract in a second place it could drift from. Here the
 * failure lands on the one contribution that caused it, and the healthy
 * fallback for that resource is still free to carry the resource.
 *
 * The result is a **bounded, redacted** issue list: structural paths and closed
 * codes only, never a value, a key name or an upstream token, so it is safe to
 * carry inside a coordination contribution.
 */

import {
  arrayOf,
  circuitCheck,
  collect,
  constructorCheck,
  constructorSeasonEntryCheck,
  constructorStandingCheck,
  driverCheck,
  driverSeasonEntryCheck,
  driverStandingCheck,
  grandPrixCheck,
  objectOf,
  raceResultCheck,
  sessionCheck,
  type Check,
  type ContractIssue,
  type Field,
} from '../../contract/normalized';
import type { CoordinatedPayload } from './resource';

/**
 * The payload wrapper is closed too.
 *
 * The wrapper itself is not published - assembly reads its named collections -
 * but leaving it open would mean the one object an adapter fully controls is
 * the one object nothing checks. `kind` is validated by
 * `payloadMatchesResource` before this runs, so it is declared here only so it
 * is not reported as undeclared.
 */
const kindOnly: Check = () => {};

function wrapper(...fields: readonly Field[]): Check {
  return objectOf([{ key: 'kind', check: kindOnly }, ...fields]);
}

const checks: Record<CoordinatedPayload['kind'], Check> = {
  'season-calendar': wrapper({ key: 'events', check: arrayOf(grandPrixCheck) }),
  'season-participants': wrapper(
    { key: 'drivers', check: arrayOf(driverCheck) },
    { key: 'constructors', check: arrayOf(constructorCheck) },
    { key: 'driverEntries', check: arrayOf(driverSeasonEntryCheck) },
    { key: 'constructorEntries', check: arrayOf(constructorSeasonEntryCheck) },
  ),
  'season-circuits': wrapper({ key: 'circuits', check: arrayOf(circuitCheck) }),
  'driver-standings': wrapper({
    key: 'standings',
    check: arrayOf(driverStandingCheck),
  }),
  'constructor-standings': wrapper({
    key: 'standings',
    check: arrayOf(constructorStandingCheck),
  }),
  'event-schedule': wrapper(
    // `round` is bound to the request by `payloadMatchesResource`; its value
    // rule still belongs to the contract.
    {
      key: 'round',
      check: (value, path, collector) => {
        if (
          typeof value !== 'number' ||
          !Number.isSafeInteger(value) ||
          value < 1
        ) {
          collector.add(path, value === null ? 'null' : 'range');
        }
      },
    },
    { key: 'sessions', check: arrayOf(sessionCheck) },
  ),
  'session-classification': wrapper({ key: 'result', check: raceResultCheck }),
};

/**
 * Validates one candidate payload against the normalized public contract.
 *
 * Total over the payload vocabulary: a new variant without a table is a
 * compile error rather than an unvalidated branch.
 */
export function validateCoordinatedPayload(
  payload: CoordinatedPayload,
  path = 'payload',
): readonly ContractIssue[] {
  const check = checks[payload.kind];
  return collect(path, (collector) => check(payload, path, collector));
}
