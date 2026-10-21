/**
 * Release gate AU-3, app half: the Flutter data layer refreshes from the
 * automatic Worker over real HTTP (ADR 0028 D10).
 *
 * A local server on 127.0.0.1 serves the stage's **public** routes from the
 * real Worker (staging configuration plus the activation delta, controlled
 * Jolpica data) and one control route the Dart test uses between launches:
 * `POST /__e2e/advance?to=<instant>` runs the Worker's scheduled handler at
 * minute 17 of every hour up to that instant. Nothing else changes the
 * Worker's state: no admin route exists on the server, and the stage refuses
 * one anyway.
 *
 * Opt-in, because it needs Flutter: `GRIDVIEW_E2E_APP=1 npx vitest run
 * test/e2e/automatic-updates/app-gate.test.ts`. It then runs
 * `flutter test test/e2e/automatic_update_app_gate_test.dart` from the
 * repository root and requires it to pass.
 */

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AutomaticUpdateStage,
  HOUR,
  MINUTE,
  PRE_SEASON,
  anchorOf,
  later,
} from './stage';

const enabled = process.env.GRIDVIEW_E2E_APP === '1';
const repositoryRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  '..',
);

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});

beforeEach(() => {
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  expect(globalFetch).not.toHaveBeenCalled();
});

/** The next minute-17 instant strictly after `at`. */
function nextTick(at: number): number {
  const hour = Math.floor(at / HOUR) * HOUR + 17 * MINUTE;
  return hour > at ? hour : hour + HOUR;
}

async function handle(
  stage: AutomaticUpdateStage,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const json = (status: number, body: unknown) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(body));
  };
  if (url.pathname === '/__e2e/state' && request.method === 'GET') {
    json(200, {
      now: stage.clock.now().toISOString(),
      raceStart: anchorOf(1).toISOString(),
      releases: stage.releases().length,
    });
    return;
  }
  if (url.pathname === '/__e2e/advance' && request.method === 'POST') {
    const to = Date.parse(url.searchParams.get('to') ?? '');
    if (Number.isNaN(to)) return json(400, { error: 'to' });
    for (let at = nextTick(stage.clock.now().getTime()); at <= to; at += HOUR) {
      await stage.tick(new Date(at).toISOString());
    }
    json(200, {
      now: stage.clock.now().toISOString(),
      releases: stage.releases().length,
    });
    return;
  }
  if (!url.pathname.startsWith('/v1/') || request.method !== 'GET') {
    json(404, { error: 'not-served' });
    return;
  }
  const headers: Record<string, string> = {};
  for (const name of ['accept', 'if-none-match', 'x-request-id']) {
    const value = request.headers[name];
    if (typeof value === 'string') headers[name] = value;
  }
  const answer = await stage.fetch(`${url.pathname}${url.search}`, { headers });
  const out: Record<string, string> = {};
  answer.headers.forEach((value, name) => (out[name] = value));
  response.writeHead(answer.status, out);
  response.end(
    answer.status === 304 ? undefined : Buffer.from(await answer.arrayBuffer()),
  );
}

function flutterTest(
  baseUrl: string,
): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      'flutter',
      [
        'test',
        'test/e2e/automatic_update_app_gate_test.dart',
        `--dart-define=GRIDVIEW_E2E_BASE_URL=${baseUrl}`,
        '-r',
        'expanded',
      ],
      { cwd: repositoryRoot, shell: process.platform === 'win32' },
    );
    let output = '';
    child.stdout.on('data', (chunk) => (output += String(chunk)));
    child.stderr.on('data', (chunk) => (output += String(chunk)));
    child.on('close', (code) => resolve({ code, output }));
  });
}

describe.skipIf(!enabled)(
  'the app refreshes from the automatic Worker (gate AU-3, app half)',
  () => {
    it(
      'passes the Flutter data-layer gate with no admin request',
      async () => {
        const stage = await AutomaticUpdateStage.create('staging');
        stage.source
          .available(1, later(anchorOf(1).toISOString(), 2 * HOUR), 'A')
          .available(1, later(anchorOf(1).toISOString(), 8 * HOUR), 'B');
        await stage.tick(PRE_SEASON);
        await stage.tick(later(PRE_SEASON, HOUR));

        const server = createServer((request, response) => {
          handle(stage, request, response).catch((error: unknown) => {
            response.writeHead(500);
            response.end(String(error));
          });
        });
        await new Promise<void>((resolve) =>
          server.listen(0, '127.0.0.1', resolve),
        );
        const { port } = server.address() as AddressInfo;
        try {
          const run = await flutterTest(`http://127.0.0.1:${port}`);
          if (process.env.GRIDVIEW_E2E_APP_OUTPUT) {
            writeFileSync(process.env.GRIDVIEW_E2E_APP_OUTPUT, run.output);
          }
          // Ran, not skipped: one passing test and no skipped one.
          expect(run.output).toMatch(/\+1: All tests passed!/);
          expect(run.output).not.toMatch(/~\d+/);
          expect(run.code).toBe(0);
        } finally {
          await new Promise<void>((resolve) => server.close(() => resolve()));
        }

        expect(stage.workerRequests.length).toBeGreaterThan(0);
        expect(
          stage.workerRequests.every((path) => path.startsWith('/v1/')),
        ).toBe(true);
        expect(stage.releases().length).toBeGreaterThanOrEqual(3);
      },
      10 * 60 * 1000,
    );
  },
);
