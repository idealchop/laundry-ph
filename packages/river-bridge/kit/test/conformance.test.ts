import assert from 'node:assert/strict';
import test from 'node:test';
import { runSelfTest } from '../conformance/checklist';

test('reference verifier passes the prod-key checklist', async () => {
  const checks = await runSelfTest();
  const failed = checks.filter((check) => !check.pass);
  assert.deepEqual(
    failed.map((check) => `${check.name}: ${check.detail}`),
    [],
  );
});
