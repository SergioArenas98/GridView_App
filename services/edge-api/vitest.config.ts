import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'test/**/*.test.mjs'],
    // The identity catalog and workerd-backed tests (SQLite Durable Objects,
    // corpus reads from pinned commits) take several seconds each and exceed
    // the 5 s default when the suite runs in parallel on CI. Every recorded
    // acceptance run used 30 s.
    testTimeout: 30_000,
  },
});
