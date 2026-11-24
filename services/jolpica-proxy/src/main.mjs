import { loadConfig } from './config.mjs';
import { createProxyServer } from './server.mjs';

try {
  const config = loadConfig(process.env);
  const server = createProxyServer(config, {
    onFailure: (code) => console.error(JSON.stringify({ event: code })),
  });
  server.on('error', () => {
    console.error('{"event":"server_error"}');
    process.exitCode = 1;
  });
  server.listen(config.port, '127.0.0.1', () =>
    console.info('{"event":"ready"}'),
  );
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close(() => {
      console.info('{"event":"stopped"}');
    });
    server.closeIdleConnections();
    // A bounded graceful shutdown, then close connections (which also cancels
    // upstream requests). systemd's stop timeout is larger than this bound.
    setTimeout(() => server.closeAllConnections(), 9500).unref();
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
} catch {
  console.error('{"event":"configuration_error"}');
  process.exitCode = 1;
}
