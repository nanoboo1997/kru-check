import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { isConvex, ordered, polygonArea, validatePoints } from '../js/omr/geometry/points.js';
import { BrowserOmrService, OMR_STATUS } from '../js/services/omrService.js';
import { deleteMats, usingMat } from '../js/omr/core/memory.js';
import { calculateLocalScore, persistSinglePhotoResult, resolveLocalReview } from '../js/services/singlePhotoService.js';
import { config } from '../js/config.js';

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

function memoryRepos() {
  const tables = { results: new Map(), reviews: new Map(), keys: new Map(), sync: [] };
  const base = (name) => ({
    get: async (id) => tables[name].get(id) || null,
    save: async (row) => { tables[name].set(row.id, structuredClone(row)); return row; },
    list: async () => [...tables[name].values()].map((row) => structuredClone(row)),
  });
  const results = base('results');
  const reviews = base('reviews');
  return {
    tables,
    repos: {
      results,
      reviews: {
        ...reviews,
        listByResult: async (id) => (await reviews.list()).filter((row) => row.resultId === id),
        pending: async () => (await reviews.list()).filter((row) => row.status === 'pending'),
      },
      answerKeys: { getByExam: async (id) => tables.keys.get(id) || null },
      sync: { enqueue: async (row) => { tables.sync.push(row); return row; } },
    },
  };
}

test('phase 2 uses IndexedDB instead of transient mock results', () => {
  assert.equal(config.dataMode, 'indexeddb');
});

test('local scoring follows the selected exam key and supports scaled full scores', () => {
  assert.equal(calculateLocalScore([[0], [1], [], [3]], ['ก', 'ข', 'ค', 'ง'], 10), 7.5);
  assert.throws(() => calculateLocalScore([[0]], ['ก', 'ข'], 2), /เฉลยไม่ครบ/);
});

test('single-photo persistence is idempotent and creates only question-level reviews', async () => {
  const { repos, tables } = memoryRepos();
  const exam = { id: 'e1', questionCount: 4, fullScore: 8 };
  const answerKey = { examId: 'e1', answers: ['ก', 'ข', 'ค', 'ง'] };
  tables.keys.set('e1', answerKey);
  const omrResult = {
    answerSelections: [[0], [1], [1, 2], [3]], uncertain: [2], answers: ['ก', 'ข', null, 'ง'],
    reviewItems: [{ questionNo: 3, candidates: ['ข', 'ค'], reason: 'multiple' }], overlayData: [],
  };
  const first = await persistSinglePhotoResult({ repos, resultId: 'r1', omrResult, exam, answerKey, classId: 'c1' });
  const second = await persistSinglePhotoResult({ repos, resultId: 'r1', omrResult, exam, answerKey, classId: 'c1' });
  assert.equal(first.result.score, 6);
  assert.equal(first.reviewItems.length, 1);
  assert.equal(second.duplicate, true);
  assert.equal(tables.results.size, 1);
  assert.equal(tables.reviews.size, 1);
  assert.equal(tables.sync.length, 1);
});

test('confirming a local review recalculates and persists the parent result', async () => {
  const { repos, tables } = memoryRepos();
  tables.keys.set('e1', { examId: 'e1', answers: ['ก', 'ข'] });
  tables.results.set('r1', { id: 'r1', examId: 'e1', fullScore: 2, answerSelections: [[0], []], answers: ['ก', null], reviewStatus: 'pending' });
  tables.reviews.set('v1', { id: 'v1', resultId: 'r1', examId: 'e1', questionNo: 2, status: 'pending' });
  const resolved = await resolveLocalReview({ repos, reviewId: 'v1', choice: 'ข', resolvedAt: '2026-01-01T00:00:00Z' });
  assert.equal(resolved.result.score, 2);
  assert.equal(resolved.result.reviewStatus, 'done');
  assert.deepEqual(resolved.result.answerSelections[1], [1]);
  assert.equal((await repos.reviews.get('v1')).status, 'done');
});

test('service worker cache covers the complete application JavaScript and offline OMR assets', async () => {
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const required = [
    'js/main.js', 'js/pages/SingleScanPage.js', 'js/pages/ReviewQueuePage.js',
    'js/services/singlePhotoService.js', 'js/core/db.js', 'vendor/opencv/opencv.js',
    'vendor/opencv/opencv.wasm', 'accepted-marks.json', 'css/components.css', 'icons/icon-192.png',
  ];
  for (const asset of required) assert.ok(sw.includes(asset), asset);
  assert.match(sw, /OFFLINE_READY_STATUS/);
});

test('single-photo page keeps processing local and exposes all honest progress stages', async () => {
  const source = await readFile(new URL('../js/pages/SingleScanPage.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|127\.0\.0\.1|localhost|cloudflare/i);
  for (const text of ['กำลังเตรียมภาพ', 'กำลังหากระดาษ', 'กำลังอ่านคำตอบ', 'กำลังคำนวณคะแนน']) {
    assert.ok(source.includes(text), text);
  }
});
