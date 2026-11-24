export const uuidPattern: RegExp;
export const hashPattern: RegExp;
export const mutationNames: string[];
export function operationFamily(operation: string): string;
export const reasons: readonly string[];
export function check(ok: unknown, path?: string): asserts ok;
export function object(
  v: unknown,
  keys: string[],
  path?: string,
): asserts v is Record<string, unknown>;
export function text(v: unknown, max?: number): asserts v is string;
export function hash(v: unknown): void;
export function uuid(v: unknown): void;
export function integer(v: unknown, min?: number, max?: number): void;
export function slug(v: unknown): void;
export interface Mutation {
  schemaVersion: 1;
  installationId: string;
  operationId: string;
  expectedActiveRevisionId: string | null;
  expectedActivationSequence: number;
  reason: string;
  payload: Record<string, unknown>;
}
export function validateMutation(v: unknown, operation: string): Mutation;
