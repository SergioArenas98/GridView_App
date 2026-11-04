// Types for capture.mjs (used by the TypeScript tests).
export declare const jolpicaOrigin: string;
export declare const userAgent: string;
export declare const minimumSpacingMs: number;
export declare const defaultSpacingMs: number;
export declare const requestTimeoutMs: number;
export declare const maxResponseBytes: number;
export declare const maxRequestsPerCapture: number;
export declare const batchCaptureOffsetMs: number;
export declare const seasonResources: readonly (readonly [string, string])[];

export type Transport = (url: string, init: RequestInit) => Promise<Response>;

export interface Anchor {
  readonly round: number;
  readonly start: string;
}

export interface RefusalDiagnostics {
  readonly server: 'cloudflare' | 'other' | null;
  readonly cfRay: string | null;
  readonly cfCacheStatus: string | null;
  readonly contentType: string | null;
  readonly retryAfterRaw: string | null;
}

export interface CaptureResponse {
  readonly url: string;
  readonly status: 200;
  readonly contentType: string;
  readonly file: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface CaptureManifest {
  readonly kind: 'gridview-jolpica-capture';
  readonly schemaVersion: 1;
  readonly season: number;
  readonly observedAt: string;
  readonly classificationRounds: number[];
  readonly responses: CaptureResponse[];
}

export interface Failure {
  readonly ok: false;
  readonly failure: string;
  readonly url?: string;
  readonly status?: number;
  readonly retryAfter?: string | null;
  readonly diagnostics?: RefusalDiagnostics;
  readonly requestsSent?: number;
}

export type CaptureResult =
  | {
      readonly ok: true;
      readonly requestsSent: number;
      readonly anchors: Anchor[];
      readonly manifest: CaptureManifest;
      readonly bodies: Map<string, Uint8Array>;
    }
  | (Failure & { readonly requestsSent: number });

export type ProbeResult =
  | {
      readonly ok: true;
      readonly url: string;
      readonly sha256: string;
      readonly complete: boolean;
      readonly requestsSent: 1;
    }
  | (Failure & { readonly requestsSent: 1 });

export declare function seasonUrl(season: number, path: string): string;
export declare function resultsUrl(season: number, round: number): string;
export declare function resultsFile(round: number): string;
export declare function calendarAnchors(calendar: unknown): Anchor[] | null;
export declare function eligibleRounds(
  anchors: readonly Anchor[],
  at: Date,
): number[];
export declare function parseRetryAfter(
  value: string | null,
  at: Date,
): string | null;
export declare function refusalDiagnostics(
  headers: Headers,
): RefusalDiagnostics;
export declare function getOnce(
  transport: Transport,
  url: string,
  now: () => Date,
): Promise<
  | {
      ok: true;
      url: string;
      contentType: string;
      bytes: Uint8Array;
      json: unknown;
      sha256: string;
    }
  | Failure
>;
export declare const realSleep: (ms: number) => Promise<void>;
export declare function probeRound(options: {
  transport: Transport;
  season: number;
  round: number;
  now?: () => Date;
}): Promise<ProbeResult>;
export declare function captureSeason(options: {
  transport: Transport;
  season: number;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  spacingMs?: number;
  maxRequests?: number;
}): Promise<CaptureResult>;
