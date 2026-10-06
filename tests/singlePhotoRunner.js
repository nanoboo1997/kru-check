import { createRepositories } from '../js/repositories/factory.js';
import { DB_NAME } from '../js/core/db.js';
import { BrowserOmrService } from '../js/services/omrService.js';
import { resolveLocalReview } from '../js/services/singlePhotoService.js';
import { render as renderSinglePhoto, bind as bindSinglePhoto } from '../js/pages/SingleScanPage.js';

const PASS = 'kc-phase2-first-pass';
const output = document.getElementById('results');

async function waitForController() {
  if (navigator.serviceWorker.controller) return;
  await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
}

async function offlineReady() {
  const registration = await navigator.serviceWorker.register('../sw.js', { scope: '../' });
  await navigator.serviceWorker.ready;
  await waitForController();
  const worker = registration.active;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => resolve(event.data?.ready === true);
    worker.postMessage({ type: 'CHECK_OFFLINE_READY' }, [channel.port2]);
  });
}

function deleteDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('test database deletion blocked'));
  });
}

async function waitUntil(check, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Single Photo UI integration timed out');
}

async function firstPass() {
  await deleteDatabase();
  const repos = createRepositories('indexeddb');
  const exam = { id: 'e20', name: 'Phase 2 Integration', questionCount: 20, fullScore: 20 };
  const key = { id: 'k20', examId: 'e20', answers: Array.from({ length: 20 }, (_, index) => ['ก', 'ข', 'ค', 'ง'][index % 4]) };
  await repos.classes.save({ id: 'c1', name: 'ห้องทดสอบ' });
  await repos.students.save({ id: 's1', classId: 'c1', no: 1, code: 'TEST001', firstName: 'นักเรียน', lastName: 'ทดสอบ' });
  await repos.exams.save(exam);
  await repos.answerKeys.save(key);
  const root = document.createElement('main');
  root.innerHTML = await renderSinglePhoto({ repos });
  document.body.append(root);
  const cleanup = await bindSinglePhoto(root, { repos, store: { omr: new BrowserOmrService(), emit() {} } });
  root.querySelector('#f-class').value = 'c1';
  root.querySelector('#f-class').dispatchEvent(new Event('change'));
  await waitUntil(() => root.querySelector('#f-student option[value="s1"]'));
  root.querySelector('#f-student').value = 's1';
  root.querySelector('#f-exam').value = 'e20';
  const blob = await fetch('./fixtures/crossed-20.png').then((response) => response.blob());
  const file = new File([blob], 'crossed-20.png', { type: 'image/png' });
  const input = root.querySelector('#file-pick');
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new Event('change'));
  const processButton = root.querySelector('#btn-process');
  processButton.click();
  processButton.click(); // deliberate double tap: only one result may be saved
  const first = await waitUntil(async () => (await repos.results.list())[0] || null);
  processButton.click(); // retry after success without a new photo must also be ignored
  await new Promise((resolve) => setTimeout(resolve, 300));
  const allResults = await repos.results.list();
  const pending = await repos.reviews.pending();
  cleanup();
  const ready = await offlineReady();
  const cache = await caches.open('phase2-test-harness');
  await cache.addAll(['./single-photo.html', './singlePhotoRunner.js']);
  sessionStorage.setItem(PASS, JSON.stringify({
    ready, resultId: first.id, score: first.score, reviewCount: pending.length,
    duplicatePrevented: allResults.length === 1, performance: first.performance,
  }));
  window.__BROWSER_TEST_OFFLINE_REQUEST__ = true;
  output.textContent = 'requesting offline reload';
}

async function secondPass() {
  const before = JSON.parse(sessionStorage.getItem(PASS));
  const repos = createRepositories('indexeddb');
  const results = await repos.results.list();
  const pending = await repos.reviews.pending();
  const stored = await repos.results.get(before.resultId);
  if (pending.length) await resolveLocalReview({ repos, reviewId: pending[0].id, choice: 'ค' });
  const updated = await repos.results.get(before.resultId);
  const syncRows = await repos.sync.pending();
  const result = {
    phase: 'single-photo-offline', offlineReload: navigator.onLine === false,
    offlineAssetsReady: before.ready, resultPersisted: results.length === 1,
    normalizedImagePersisted: stored.normalizedImageBlob instanceof Blob,
    reviewPersisted: pending.length === before.reviewCount,
    reviewResolved: !pending.length || (await repos.reviews.get(pending[0].id)).status === 'done',
    scoreRecalculated: updated.score !== null, duplicatePrevented: before.duplicatePrevented && results.length === 1,
    syncPending: syncRows.length >= 1, performance: before.performance,
  };
  window.__PARITY_RESULT__ = result;
  output.textContent = JSON.stringify(result);
}

(sessionStorage.getItem(PASS) ? secondPass() : firstPass()).catch((error) => {
  window.__PARITY_RESULT__ = { fatal: error.message, stack: error.stack };
  output.textContent = JSON.stringify(window.__PARITY_RESULT__);
});
