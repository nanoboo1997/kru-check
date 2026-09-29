/* ============================================================
 * Kru Check — bootstrap
 * 1. init store (repositories + services)
 * 2. register service worker (PWA offline)
 * 3. start hash router → render pages ใน AppShell
 * ============================================================ */
import { store } from './core/store.js';
import { Router } from './core/router.js';
import { renderShell, bindShell } from './components/AppShell.js';

const routes = [
  { path: '', tab: 'login', bare: true, public: true, page: () => import('./pages/LoginPage.js') },
  { path: 'login', tab: 'login', bare: true, public: true, page: () => import('./pages/LoginPage.js') },
  { path: 'dashboard', tab: 'dashboard', page: () => import('./pages/DashboardPage.js') },
  { path: 'scan', tab: 'scan', page: () => import('./pages/SingleScanPage.js') },
  { path: 'scan-continuous', tab: 'scan-continuous', page: () => import('./pages/ContinuousScanPage.js') },
  { path: 'classrooms', tab: 'classrooms', page: () => import('./pages/ClassroomsPage.js') },
  { path: 'classrooms/:id', tab: 'classrooms', page: () => import('./pages/ClassroomDetailPage.js') },
  { path: 'exams', tab: 'exams', page: () => import('./pages/ExamsPage.js') },
  { path: 'exams/:id', tab: 'exams', page: () => import('./pages/ExamDetailPage.js') },
  { path: 'exams/:id/key', tab: 'exams', page: () => import('./pages/AnswerKeyPage.js') },
  { path: 'exams/:id/sheet', tab: 'exams', page: () => import('./pages/AnswerSheetPage.js') },
  { path: 'review', tab: 'review', page: () => import('./pages/ReviewQueuePage.js') },
  { path: 'results', tab: 'results', page: () => import('./pages/ResultsPage.js') },
  { path: 'analysis', tab: 'analysis', page: () => import('./pages/AnalysisPage.js') },
  { path: 'offline', tab: 'offline', page: () => import('./pages/OfflineDataPage.js') },
  { path: 'settings', tab: 'settings', page: () => import('./pages/SettingsPage.js') },
  { path: 'more', tab: 'more', page: () => import('./pages/MorePage.js') },
];

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js', { scope: './' });
  } catch (err) {
    console.warn('Service Worker ลงทะเบียนไม่สำเร็จ:', err);
  }
}

async function boot() {
  await store.init();
  await registerSW();

  const router = new Router(routes);
  const app = document.getElementById('app');

  router.onRoute = async ({ route, params, query, segments }) => {
    const path = segments.join('/');
    if (!route) { router.navigate('dashboard'); return; }
    // auth guard
    if (!route.public && !store.currentUser) { router.navigate('login'); return; }
    if (route.public && store.currentUser && (path === '' || path === 'login')) {
      router.navigate('dashboard');
      return;
    }
    const ctx = {
      params, query, store, repos: store.repos,
      navigate: (p) => router.navigate(p),
    };
    const mod = await route.page();
    const mainHTML = await mod.render(ctx);
    app.innerHTML = await renderShell(route.tab, mainHTML, { bare: !!route.bare });
    const view = document.getElementById('view') || app;
    if (typeof mod.bind === 'function') await mod.bind(view, ctx);
    window.scrollTo(0, 0);
  };

  bindShell();
  router.start();
}

boot().catch((err) => {
  document.getElementById('app').innerHTML =
    `<div class="page"><div class="card"><h2>เกิดข้อผิดพลาด</h2><p class="muted">${String(err?.message || err)}</p></div></div>`;
  console.error(err);
});
