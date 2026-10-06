/* Kru Check Phase 2 offline app shell. Cache version couples UI + OMR + WASM. */
const CACHE_NAME = 'kru-check-v3-single-photo-offline';
const OFFLINE_ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './css/tokens.css', './css/base.css', './css/components.css', './css/pages.css',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './assets/sheet-placeholder.svg',
  './js/config.js', './js/main.js',
  './js/components/AppShell.js', './js/components/BottomNav.js', './js/components/CameraViewport.js',
  './js/components/OfflineBanner.js', './js/components/ResultCard.js', './js/components/ReviewCard.js',
  './js/components/ScanStatus.js', './js/components/StickySheetPreview.js', './js/components/SyncStatus.js',
  './js/components/icons.js', './js/components/selectors.js',
  './js/core/db.js', './js/core/router.js', './js/core/store.js', './js/core/sync.js',
  './js/pages/AnalysisPage.js', './js/pages/AnswerKeyPage.js', './js/pages/AnswerSheetPage.js',
  './js/pages/ClassroomDetailPage.js', './js/pages/ClassroomsPage.js', './js/pages/ContinuousScanPage.js',
  './js/pages/DashboardPage.js', './js/pages/ExamDetailPage.js', './js/pages/ExamsPage.js',
  './js/pages/LoginPage.js', './js/pages/MorePage.js', './js/pages/OfflineDataPage.js',
  './js/pages/ResultsPage.js', './js/pages/ReviewQueuePage.js', './js/pages/SettingsPage.js',
  './js/pages/SingleScanPage.js',
  './js/repositories/factory.js', './js/repositories/idbRepositories.js', './js/repositories/interfaces.js',
  './js/repositories/mockData.js', './js/repositories/mockRepositories.js', './js/repositories/offlineSeed.js',
  './js/services/answerSheetService.js', './js/services/authService.js', './js/services/backupService.js',
  './js/services/omrService.js', './js/services/singlePhotoService.js',
  './js/omr/constants.js', './js/omr/core/engine.js', './js/omr/core/image.js',
  './js/omr/core/memory.js', './js/omr/core/opencvRuntime.js', './js/omr/geometry/points.js',
  './js/omr/markers/detection.js', './js/omr/alignment/rectify.js', './js/omr/alignment/tableGeometry.js',
  './js/omr/preprocessing/tableInk.js', './js/omr/recognition/crossGeometry.js',
  './js/omr/recognition/classify.js', './js/omr/recognition/neighbors.js',
  './js/omr/recognition/readAnswers.js', './js/omr/templates/acceptedMarks.js',
  './js/omr/templates/accepted-marks.json',
  './vendor/opencv/opencv.js', './vendor/opencv/opencv.wasm',
];

async function offlineAssetsReady() {
  const cache = await caches.open(CACHE_NAME);
  const matches = await Promise.all(OFFLINE_ASSETS.map((asset) => cache.match(asset)));
  return matches.every(Boolean);
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CHECK_OFFLINE_READY') return;
  event.waitUntil(offlineAssetsReady().then((ready) => {
    event.ports[0]?.postMessage({ type: 'OFFLINE_READY_STATUS', ready, cacheName: CACHE_NAME });
  }).catch(() => event.ports[0]?.postMessage({ type: 'OFFLINE_READY_STATUS', ready: false, cacheName: CACHE_NAME })));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      if (response?.status === 200) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    }).catch(() => request.mode === 'navigate' ? caches.match('./index.html') : caches.match(request));
  }));
});
