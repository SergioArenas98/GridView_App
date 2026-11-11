import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { test } from 'node:test';
import { loadConfig } from '../src/config.mjs';
import { close, get, listen, token } from './support.mjs';

const main = fileURLToPath(new URL('../src/main.mjs', import.meta.url));
// Block real HTTPS in child processes as well as in the in-process fixtures.
const childArgs = [
  '--import',
  new URL('./support.mjs', import.meta.url).href,
  main,
];

test('systemd-style secret files accept one newline; oversized, absent or malformed secrets fail safely', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'gridview-jolpica-test-'));
  const file = join(dir, 'token');
  t.after(() => {
    unlinkSync(file);
    rmdirSync(dir);
  });
  writeFileSync(file, token + '\n');
  assert.equal(loadConfig({ JOLPICA_PROXY_TOKEN_FILE: file }).token, token);
  writeFileSync(file, token + '\r\n');
  assert.equal(loadConfig({ JOLPICA_PROXY_TOKEN_FILE: file }).token, token);
  for (const value of [token + '\n\n', 'x'.repeat(131), 'bad secret']) {
    writeFileSync(file, value);
    assert.throws(
      () => loadConfig({ JOLPICA_PROXY_TOKEN_FILE: file }),
      /^Error: Invalid proxy configuration\.$/,
    );
  }
  assert.throws(
    () => loadConfig({ JOLPICA_PROXY_TOKEN_FILE: join(dir, 'absent') }),
    /^Error: Invalid proxy configuration\.$/,
  );
});

test('the executable fails closed without leaking malformed credentials', () => {
  const result = spawnSync(process.execPath, childArgs, {
    env: {
      ...process.env,
      JOLPICA_PROXY_TOKEN: 'private-secret',
      JOLPICA_PROXY_TOKEN_FILE: '',
    },
    encoding: 'utf8',
    timeout: 5000,
    windowsHide: true,
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.trim(), '{"event":"configuration_error"}');
});

test('standalone executable starts with an external token file, serves only local health, and stops', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'gridview-jolpica-test-'));
  const file = join(dir, 'token');
  writeFileSync(file, token);
  const reservation = http.createServer();
  const port = await listen(reservation);
  await close(reservation);
  const env = {
    ...process.env,
    JOLPICA_PROXY_TOKEN_FILE: file,
    JOLPICA_PROXY_PORT: String(port),
  };
  delete env.JOLPICA_PROXY_TOKEN;
  const child = spawn(process.execPath, childArgs, {
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  const exited = once(child, 'exit');
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
    unlinkSync(file);
    rmdirSync(dir);
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('local startup timeout')),
      5000,
    );
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.includes('"ready"')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  assert.equal(
    (await get(port, { path: '/healthz', headers: { Authorization: '' } }))
      .status,
    200,
  );
  assert.equal(readFileSync(file, 'utf8'), token);
  assert.ok(!stdout.includes(token));
  assert.equal(stderr, '');
  child.kill('SIGTERM');
  await exited;
  // Windows terminates Node directly; Linux CI also exercises the signal handler.
  if (process.platform !== 'win32') assert.match(stdout, /"stopped"/);
});
