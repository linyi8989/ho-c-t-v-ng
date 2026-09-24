import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createDiagnosticsService } from './service';

const serverSource = readFileSync(new URL('../../../server.ts', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('./router.ts', import.meta.url), 'utf8');

test('diagnostic endpoints keep their URLs and diagnostic-secret middleware', () => {
  assert.match(serverSource, /createDiagnosticsRouter/);
  assert.doesNotMatch(serverSource, /app\.get\("\/api\/(?:auth\/debug|diagnostics\/storage)"/);
  assert.match(routerSource, /router\.get\("\/auth\/debug", options\.requireDiagnosticAccess/);
  assert.match(routerSource, /router\.get\("\/diagnostics\/storage", options\.requireDiagnosticAccess/);
});

test('diagnostic service preserves response fields without exposing storage details itself', async () => {
  const service = createDiagnosticsService({
    repository: {
      async countProbeUsers() { return 2; },
      async getStorageDiagnostics() { return { backend: 'sqlite', ready: true }; },
    } as any,
  });
  assert.deepEqual(await service.getAuthDebug(), {
    success: true,
    docsCount: 2,
    storageReady: true,
  });
  assert.deepEqual(await service.getStorageDiagnostics(), { backend: 'sqlite', ready: true });
});
