/* ============================================================
 * Kru Check — AppShell
 * ประกอบ: header (brand + sync pill) / offline banner /
 *         side nav (desktop) / <main> / bottom nav (mobile)
 * ============================================================ */
import { config } from '../config.js';
import { store } from '../core/store.js';
import { bottomNavHTML, sideNavHTML } from './BottomNav.js';
import { syncPillHTML, getSyncState } from './SyncStatus.js';
import { offlineBannerHTML } from './OfflineBanner.js';

/** active = ชื่อ tab ปัจจุบัน; bare = true สำหรับหน้า login (ไม่มี nav) */
export async function renderShell(active, mainHTML, { bare = false } = {}) {
  const state = bare ? null : await getSyncState();
  const isOffline = state === 'offline';

  if (bare) {
    return `<div class="page page--bare">${mainHTML}</div>`;
  }

  return `
  <div class="app-shell">
    ${sideNavHTML(active)}
    <div class="app-shell__main">
      <header class="app-header">
        <div class="app-header__inner">
          <div class="brand"><span class="brand__logo">✓</span><span>${config.appName}</span></div>
          <div class="header-statuses">
            ${store.offlineReady ? '<span class="offline-ready" data-offline-ready>✓ พร้อมใช้งานออฟไลน์</span>' : ''}
            ${syncPillHTML(state)}
          </div>
        </div>
        ${offlineBannerHTML(isOffline)}
      </header>
      <main class="page" id="view">${mainHTML}</main>
      ${bottomNavHTML(active)}
    </div>
  </div>`;
}

/** ผูก event ระดับ shell: connectivity เปลี่ยน → รีเฟรช pill + banner */
export function bindShell() {
  store.on(async (topic) => {
    if (topic === 'offline-ready') {
      const statuses = document.querySelector('.header-statuses');
      if (!statuses) return;
      statuses.querySelector('[data-offline-ready]')?.remove();
      if (store.offlineReady) statuses.insertAdjacentHTML('afterbegin', '<span class="offline-ready" data-offline-ready>✓ พร้อมใช้งานออฟไลน์</span>');
      return;
    }
    if (topic !== 'connectivity') return;
    const { refreshSyncPills } = await import('./SyncStatus.js');
    const state = await refreshSyncPills(document);
    const header = document.querySelector('.app-header');
    if (!header) return;
    const old = header.querySelector('[data-offline-banner]');
    if (old) old.remove();
    if (state === 'offline') {
      const { offlineBannerHTML } = await import('./OfflineBanner.js');
      header.insertAdjacentHTML('beforeend', offlineBannerHTML(true));
    }
  });
}
