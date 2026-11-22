/**
 * Point-in-time recovery access for GridView's SQLite-backed Durable Objects
 * (U11 G5 recovery; Cloudflare "SQLite-backed Durable Object Storage" PITR).
 *
 * Cloudflare exposes PITR only inside an object, through `ctx.storage`:
 * `getCurrentBookmark()`, `getBookmarkForTime(t)` (last 30 days) and
 * `onNextSessionRestoreBookmark(b)`, which takes effect when the object next
 * restarts (`ctx.abort()`). Restores are reversible: scheduling one returns a
 * bookmark for the point immediately before it. The API is not available in
 * local development, so `pitr-unsupported` is a normal local answer.
 *
 * Objects reach this only through `recoveryObjectPath`, which only the
 * operator recovery route forwards to. Reading a bookmark changes nothing.
 * Scheduling a restore requires the exact current bookmark (an optimistic
 * check against a moved head) and is gated by the Worker route.
 */

export const recoveryObjectPath = '/__gridview/recovery';
export const recoveryCommands = [
  'bookmark',
  'bookmark-for-time',
  'schedule-restore',
  'restart',
] as const;
export type RecoveryCommand = (typeof recoveryCommands)[number];

const retentionMs = 30 * 24 * 60 * 60 * 1000;
const bookmarkPattern = /^[A-Za-z0-9-]{8,256}$/;

interface PitrStorage {
  getCurrentBookmark?: () => Promise<string>;
  getBookmarkForTime?: (timestamp: number) => Promise<string>;
  onNextSessionRestoreBookmark?: (bookmark: string) => Promise<string>;
}

/** The raw Durable Object state, as Cloudflare passes it to a constructor. */
export interface RecoveryHost {
  readonly storage: PitrStorage;
  abort?: (reason?: string) => void;
}

export interface RecoveryRequest {
  readonly command: RecoveryCommand;
  readonly at?: string;
  readonly bookmark?: string;
  readonly expectedCurrentBookmark?: string;
}

const allowedFields: Record<RecoveryCommand, readonly string[]> = {
  bookmark: ['command'],
  'bookmark-for-time': ['command', 'at'],
  'schedule-restore': ['command', 'bookmark', 'expectedCurrentBookmark'],
  restart: ['command'],
};

/** Closed decoding: exact fields per command; anything else is refused. */
export function decodeRecoveryRequest(value: unknown): RecoveryRequest | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return null;
  const record = value as Record<string, unknown>;
  const command = record.command;
  if (!recoveryCommands.includes(command as RecoveryCommand)) return null;
  const fields = allowedFields[command as RecoveryCommand];
  const keys = Object.keys(record);
  if (keys.length !== fields.length || !keys.every((k) => fields.includes(k)))
    return null;
  if (command === 'bookmark-for-time') {
    if (typeof record.at !== 'string') return null;
    const at = Date.parse(record.at);
    if (!Number.isFinite(at) || new Date(at).toISOString() !== record.at)
      return null;
  }
  if (command === 'schedule-restore') {
    for (const k of ['bookmark', 'expectedCurrentBookmark'])
      if (
        typeof record[k] !== 'string' ||
        !bookmarkPattern.test(record[k] as string)
      )
        return null;
  }
  return record as unknown as RecoveryRequest;
}

function reply(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

/** Handles one recovery command inside a Durable Object. */
export async function handleRecoveryCommand(
  request: Request,
  host: RecoveryHost,
  now: () => number = Date.now,
): Promise<Response> {
  if (request.method !== 'POST')
    return reply({ error: 'method-not-allowed' }, 405);
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return reply({ error: 'invalid-request' }, 400);
  }
  const command = decodeRecoveryRequest(parsed);
  if (!command) return reply({ error: 'invalid-request' }, 400);
  const storage = host.storage;
  try {
    switch (command.command) {
      case 'bookmark': {
        if (typeof storage.getCurrentBookmark !== 'function')
          return reply({ error: 'pitr-unsupported' }, 501);
        return reply({ bookmark: await storage.getCurrentBookmark() }, 200);
      }
      case 'bookmark-for-time': {
        if (typeof storage.getBookmarkForTime !== 'function')
          return reply({ error: 'pitr-unsupported' }, 501);
        const at = Date.parse(command.at!);
        if (at > now() || now() - at > retentionMs)
          return reply({ error: 'outside-retention' }, 400);
        return reply(
          { at: command.at, bookmark: await storage.getBookmarkForTime(at) },
          200,
        );
      }
      case 'schedule-restore': {
        if (
          typeof storage.getCurrentBookmark !== 'function' ||
          typeof storage.onNextSessionRestoreBookmark !== 'function'
        )
          return reply({ error: 'pitr-unsupported' }, 501);
        const current = await storage.getCurrentBookmark();
        if (current !== command.expectedCurrentBookmark)
          return reply({ error: 'bookmark-moved', current }, 409);
        const undoBookmark = await storage.onNextSessionRestoreBookmark(
          command.bookmark!,
        );
        return reply(
          {
            scheduled: command.bookmark,
            scheduledFrom: current,
            undoBookmark,
            effective: 'after restart',
          },
          200,
        );
      }
      case 'restart': {
        if (typeof host.abort !== 'function')
          return reply({ error: 'pitr-unsupported' }, 501);
        host.abort('gridview operator recovery restart');
        return reply({ restarted: true }, 200);
      }
    }
  } catch {
    // A storage failure never reads as success, and raw errors never cross.
    return reply({ error: 'recovery-unavailable' }, 500);
  }
}
