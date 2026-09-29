/* ============================================================
 * Kru Check — SyncStatus component
 * แสดงสถานะ: 🟢 ซิงก์แล้ว / 🟡 รอซิงก์ / 🔴 ออฟไลน์
 * ============================================================ */
import { store } from '../core/store.js';

const LABEL = {
  synced: ['🟢', 'ซิงก์แล้ว', 'sync-pill--synced'],
  pending: ['🟡', 'รอซิงก์', 'sync-pill--pending'],
  offline: ['🔴', 'ออฟไลน์', 'sync-pill--offline'],
  error: ['🔴', 'ซิงก์ผิดพลาด', 'sync-pill--offline'],
};

export async function getSyncState() {
  try {
    return await store.sync.getStatus();
  } catch {
    return 'error';
  }
}

export function syncPillHTML(state) {
  const [emoji, text, cls] = LABEL[state] || LABEL.error;
  return `<span class="sync-pill ${cls}" data-sync-pill><span>${emoji}</span><span>${text}</span></span>`;
}

/** รีเฟรช pill ทุกตัวในหน้า (เรียกเมื่อ connectivity เปลี่ยน) */
export async function refreshSyncPills(root = document) {
  const state = await getSyncState();
  root.querySelectorAll('[data-sync-pill]').forEach((el) => {
    const tmp = document.createElement('span');
    tmp.innerHTML = syncPillHTML(state);
    el.replaceWith(tmp.firstChild);
  });
  return state;
}
