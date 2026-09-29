import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { isConvex, ordered, polygonArea, validatePoints } from '../js/omr/geometry/points.js';
import { BrowserOmrService, OMR_STATUS } from '../js/services/omrService.js';
import { deleteMats, usingMat } from '../js/omr/core/memory.js';

test('corner ordering and validation match the normalized sheet convention', () => {
  const points = ordered([[930, 1344], [70, 70], [70, 1344], [930, 70]]);
  assert.deepEqual(points, [[70, 70], [930, 70], [930, 1344], [70, 1344]]);
  assert.equal(isConvex(points), true);
  assert.equal(polygonArea(points), 860 * 1274);
  assert.doesNotThrow(() => validatePoints(points, 1000, 1414));
  assert.throws(() => validatePoints(points.slice(0, 3), 1000, 1414));
});

test('browser service advertises a local wasm engine but leaves continuous scan out of phase 1', async () => {
  const service = new BrowserOmrService();
  assert.equal(service.status, OMR_STATUS.NOT_CONNECTED);
  assert.equal(service.engineInfo.offline, true);
  await assert.rejects(() => service.processFrame(null), { code: 'OMR_NOT_CONNECTED' });
});

test('browser OMR modules contain no server OMR dependency', async () => {
  const files = [
    '../js/omr/core/engine.js', '../js/omr/core/image.js', '../js/omr/core/opencvRuntime.js',
    '../js/omr/alignment/rectify.js', '../js/omr/recognition/readAnswers.js',
  ];
  for (const relative of files) {
    const source = await readFile(new URL(relative, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /(?:localhost|127\.0\.0\.1|cloudflare|\/api\/|fetch\(['"]https?:)/i, relative);
  }
});

test('service worker explicitly precaches every essential OMR runtime asset', async () => {
  const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  for (const asset of ['vendor/opencv/opencv.js', 'accepted-marks.json', 'omr/core/engine.js', 'omr/recognition/classify.js']) {
    assert.ok(source.includes(asset), asset);
  }
});

test('accepted-mark browser export contains only the deterministic numerical masks', async () => {
  const payload = JSON.parse(await readFile(new URL('../js/omr/templates/accepted-marks.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(payload).sort(), ['data', 'encoding', 'shape', 'source']);
  assert.equal(payload.source, 'accepted_marks.npz:masks');
  assert.deepEqual(payload.shape, [17, 31, 31]);
  assert.equal(Buffer.from(payload.data, 'base64').length, 17 * 31 * 31);
});

test('OpenCV Mat cleanup is best-effort and also runs when recognition throws', () => {
  const calls = [];
  const first = { delete: () => calls.push('first') };
  const broken = { delete: () => { calls.push('broken'); throw new Error('already deleted'); } };
  const last = { delete: () => calls.push('last') };
  deleteMats(first, [broken, last]);
  assert.deepEqual(calls, ['first', 'broken', 'last']);

  const owned = { delete: () => calls.push('owned') };
  assert.throws(() => usingMat(owned, () => { throw new Error('recognition failed'); }), /recognition failed/);
  assert.equal(calls.at(-1), 'owned');
});

test('parity manifest covers standard, shadow, thin-X, changed-answer and 3-marker cases', async () => {
  const reference = JSON.parse(await readFile(new URL('./python-reference.json', import.meta.url), 'utf8'));
  const fixtures = new Set(reference.cases.map((item) => item.fixture));
  for (const name of [
    'crossed-20.png',
    'crossed-shadow-20.jpg',
    'real-thin-x-table-sanitized.png',
    'real-q28-cancelled-change-sanitized.jpg',
    'legacy-three-marker-iphone-sanitized.jpg',
  ]) assert.ok(fixtures.has(name), name);
  assert.equal(reference.cases.reduce((sum, item) => sum + item.count, 0), 260);
});
