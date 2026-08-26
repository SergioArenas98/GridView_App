/**
 * The structured operational signal for an unresolved provider identity.
 *
 * An unmapped entity must be *visible* and must stop the resource. It must
 * never become a guessed GridView ID, an empty result, a row quietly dropped
 * from an otherwise accepted resource, a public provider identifier, an
 * unbounded serialized error or a raw provider payload
 * (Backend Scheme §8.1, ADR 0022).
 *
 * Every field below is either a bounded enum member, an integer, or the exact
 * curated-bounded provider value in one internal diagnostic field. No mapping
 * record, no registry, no upstream object and no thrown exception is ever
 * serialized here.
 */

import type { LogEvent } from '../../logging/logger';
import type { ProviderMappingFailure } from './mapping-registry';

/** Bounded failure category, consistent with the existing logging vocabulary. */
export const PROVIDER_MAPPING_FAILURE_CATEGORY = 'provider_mapping_unresolved';

export const PROVIDER_MAPPING_OPERATION = 'provider.mapping.resolve';

/**
 * Upper bound on the diagnostic provider value.
 *
 * The curated schema already bounds a provider string to 64 characters, so
 * this is a second, independent bound for a value that reaches a log line
 * from anywhere else.
 */
const DIAGNOSTIC_VALUE_MAX_LENGTH = 64;

function boundedDiagnosticValue(value: string | number): string {
  // Defensive: a caller that casts past the types must not be able to reach
  // string methods on a non-string and throw from inside a logging helper.
  const text = typeof value === 'string' ? value : String(value);
  // Truncated by **code point**, so a supplementary character is never split
  // into a lone surrogate that would render as a replacement character in the
  // log stream. The bound matches the curated schema's code-point limit.
  const codePoints = [...text];
  return codePoints.length <= DIAGNOSTIC_VALUE_MAX_LENGTH
    ? text
    : `${codePoints.slice(0, DIAGNOSTIC_VALUE_MAX_LENGTH).join('')}...`;
}

/**
 * Builds the log event for an unresolved provider identity.
 *
 * The result is a plain bounded object. Callers pass it to the existing
 * `Logger`, which is the only writer; this module performs no I/O itself.
 */
export function providerMappingFailureEvent(
  failure: ProviderMappingFailure,
): LogEvent {
  const event: LogEvent = {
    operation: PROVIDER_MAPPING_OPERATION,
    failureCategory: PROVIDER_MAPPING_FAILURE_CATEGORY,
    providerSourceId: failure.source,
    providerMappingEntity: failure.entity,
    providerMappingField: failure.providerField,
    providerMappingFailure: failure.reason,
  };

  // Omitted rather than nulled for a malformed key: there is no season to
  // report, and `season` is a shared bounded integer field in the logger
  // contract that other operations also use.
  if (failure.season !== null) event.season = failure.season;

  // An `invalid-key` failure deliberately carries no provider value. The
  // value that failed validation is exactly the one that must not be echoed,
  // and the bounded `keyProblem` is the whole diagnosis.
  if (failure.providerValue !== null) {
    event.providerMappingValue = boundedDiagnosticValue(failure.providerValue);
  }
  if (failure.keyProblem !== undefined) {
    event.providerMappingKeyProblem = failure.keyProblem;
  }

  return event;
}
