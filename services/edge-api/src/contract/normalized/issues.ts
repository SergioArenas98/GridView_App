/**
 * The issue vocabulary and the bounded collector every normalized validator
 * writes into.
 *
 * An issue says **where** and **what kind**, never **what**. The value that
 * failed is provider-controlled text of unbounded length, and this result is
 * carried by a coordination contribution, so including it would put upstream
 * content somewhere the whole package is built to keep it out of. The same
 * reasoning covers an unrecognised *property name*: an additive key an adapter
 * invented is provider-controlled just as its value is, so a closed-shape
 * failure reports the object's own path and its kind and stops there.
 */

import type { ValidationIssue } from '../validation';

export const contractIssueCodes = [
  /** A property the contract declares is not an own data property. */
  'missing',
  /** An own property the contract does not declare. */
  'unknown-property',
  /** The wrong JavaScript type for the declared field. */
  'type',
  /** `null` where the contract does not permit it. */
  'null',
  /** A string outside a closed enumerated vocabulary. */
  'enum',
  /** A `Slug` or `GridViewId` that is not the contract's identifier grammar. */
  'identifier',
  /** A string outside a declared pattern that is not an identifier. */
  'pattern',
  /** A number that is not a safe integer where one is required. */
  'integer',
  /** A number that is not finite. */
  'number',
  /** A numeric value outside a bound the contract states. */
  'range',
  /** Not an RFC 3339 date-time. */
  'timestamp',
  /** Not a calendar date. */
  'date',
  /** Not an absolute `http`/`https` URL. */
  'uri',
  /** A collection longer than the traversal bound. */
  'too-many-items',
  /** The value could not be read without running code it supplied. */
  'unreadable',
  /** The bounded issue budget was reached; earlier issues still stand. */
  'issue-limit',
] as const;

export type ContractIssueCode = (typeof contractIssueCodes)[number];

/**
 * One contract failure.
 *
 * Extends the existing `ValidationIssue`, so a `ContractIssue[]` is usable
 * anywhere the established representation already is, and adds the closed
 * `code` a caller can branch on without parsing prose.
 */
export interface ContractIssue extends ValidationIssue {
  readonly code: ContractIssueCode;
}

/**
 * The most elements any single collection may carry.
 *
 * Derived from the data, not invented: the largest collections a real season
 * produces are a calendar of roughly two dozen rounds, a grid of roughly two
 * dozen drivers, a classification with one entry per starter and a handful of
 * media variants. A cap of 1000 is more than an order of magnitude above every
 * one of those, so it cannot reject contract-valid season data, while still
 * bounding traversal for a hostile payload.
 *
 * There is deliberately **no depth bound**. The schema is finite and
 * non-recursive - the deepest declared path is
 * `media[i].variants.hero.url` - and nothing here recurses into a value the
 * contract does not declare, so traversal depth is bounded statically rather
 * than by a runtime counter that would have to be guessed.
 */
export const maxCollectionLength = 1000;

/** The most issues one validation may report before it stops collecting. */
export const maxContractIssues = 200;

const messages: Record<ContractIssueCode, string> = {
  missing: 'required property is absent',
  'unknown-property': 'undeclared property',
  type: 'wrong type',
  null: 'must not be null',
  enum: 'not a member of the vocabulary',
  identifier: 'not a canonical identifier',
  pattern: 'does not match the declared pattern',
  integer: 'must be a safe integer',
  number: 'must be a finite number',
  range: 'outside the declared bound',
  timestamp: 'not an ISO-8601 date-time',
  date: 'not an ISO-8601 date',
  uri: 'not an absolute http(s) URL',
  'too-many-items': 'collection exceeds the traversal bound',
  unreadable: 'value could not be read',
  'issue-limit': 'issue limit reached; validation stopped',
};

/**
 * A bounded accumulator, owned by exactly one `validate` call.
 *
 * Mutable by design and deliberately not shared: it is created inside a
 * validator, filled during that one traversal and frozen into a `readonly`
 * array on the way out, so nothing observable outside the call is ever
 * mutated.
 */
export class IssueCollector {
  private readonly collected: ContractIssue[] = [];
  private stopped = false;

  /** Whether the budget is spent and traversal may stop early. */
  get full(): boolean {
    return this.stopped;
  }

  add(path: string, code: ContractIssueCode): void {
    if (this.stopped) return;
    if (this.collected.length >= maxContractIssues) {
      this.collected.push({
        path,
        code: 'issue-limit',
        message: messages['issue-limit'],
      });
      this.stopped = true;
      return;
    }
    this.collected.push({ path, code, message: messages[code] });
  }

  issues(): readonly ContractIssue[] {
    return this.collected;
  }
}

/** Runs one validator over its own collector and returns the bounded result. */
export function collect(
  path: string,
  validate: (collector: IssueCollector) => void,
): readonly ContractIssue[] {
  const collector = new IssueCollector();
  try {
    validate(collector);
  } catch {
    // The last line of containment. Every trap this package touches is already
    // guarded individually; this exists so "a validator never throws for a
    // hostile value" is true by construction rather than by having enumerated
    // every trap correctly. The thrown value is never inspected or logged.
    return [{ path, code: 'unreadable', message: messages.unreadable }];
  }
  return collector.issues();
}
