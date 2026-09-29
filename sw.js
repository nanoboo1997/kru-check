/* Kru Check Service Worker — offline-first app shell cache.
 * หมายเหตุ: ไม่มี backend ของตัวเอง — SW ทำหน้าที่แคชไฟล์ static
 * เพื่อให้เปิดแอปแบบออฟไลน์ได้เท่านั้น
 */
const CACHE_NAME = 'kru-check-v2-browser-omr';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './vendor/opencv/opencv.js',
  './vendor/opencv/opencv.wasm',
  './js/services/omrService.js',
  './js/omr/constants.js',
  './js/omr/core/engine.js',
  './js/omr/core/image.js',
  './js/omr/core/memory.js',
  './js/omr/core/opencvRuntime.js',
  './js/omr/geometry/points.js',
  './js/omr/markers/detection.js',
  './js/omr/alignment/rectify.js',
  './js/omr/alignment/tableGeometry.js',
  './js/omr/preprocessing/tableInk.js',
  './js/omr/recognition/crossGeometry.js',
  './js/omr/recognition/classify.js',
  './js/omr/recognition/neighbors.js',
  './js/omr/recognition/readAnswers.js',
  './js/omr/templates/acceptedMarks.js',
  './js/omr/templates/accepted-marks.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // ข้าม request ที่ไม่ใช่ไฟล์ของแอป (เช่น เรียก API ภายนอกในอนาคต)
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request)
        .then((res) => {
          // แคชเฉพาะ response ที่สำเร็จ เพื่อรองรับออฟไลน์ครั้งถัดไป
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => {
          // ออฟไลน์และไม่มีแคช: ส่งกลับไปหน้า app shell
          if (request.mode === 'navigate') return caches.match('./index.html');
          return caches.match(request);
        });
    })
  );
});
