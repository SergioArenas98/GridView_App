// Types for submit.mjs (used by the TypeScript tests).
import type { Transport } from './capture.mjs';

export declare const allowedOrigins: readonly string[];
export declare const cutoverStatusPath: string;
export declare const ingestPath: string;
export declare const maxAnswerBytes: number;
export declare const ingestTimeoutMs: number;
export declare const statusTimeoutMs: number;

export declare function readActiveVersion(options: {
  transport: Transport;
  origin: string;
  token: string | undefined;
  season: number;
}): Promise<
  | { ok: true; activeVersion: string }
  | { ok: false; failure: string; status?: number }
>;

export type IngestAnswer =
  | { outcome: 'applied'; version: string }
  | {
      outcome: 'refused';
      status: number;
      stage: string | null;
      reason: string | null;
      publication: string | null;
    }
  | { outcome: 'ambiguous'; reason: string; status?: number }
  | { outcome: 'refused-locally'; reason: string };

export declare function submitIngest(options: {
  transport: Transport;
  origin: string;
  token: string | undefined;
  bodyText: string;
}): Promise<IngestAnswer>;
