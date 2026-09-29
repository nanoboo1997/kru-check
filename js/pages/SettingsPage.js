/* ============================================================
 * Kru Check — ตั้งค่า
 * ============================================================ */
import { config } from '../config.js';
import { icons } from '../components/icons.js';

export async function render({ store }) {
  const gas = config.gas.endpoint ? 'ตั้งค่าแล้ว' : 'ยังไม่ได้ตั้งค่า';
  const row = (title, sub, action = '') => `
    <div class="setting-row"><div>${title}<small>${sub}</small></div><div>${action}</div></div>`;

  return `
  <div class="page-title"><h1>ตั้งค่า</h1></div>

  <div class="section">บัญชีครู</div>
  <div class="setting-group">
    ${row(store.currentUser?.name || 'คุณครู', store.currentUser?.email || '', `<span class="badge">โหมดพัฒนา</span>`)}
    ${row('ออกจากระบบ', 'ลบ session ในเครื่องนี้', `<button class="btn btn--danger btn--sm" id="btn-logout">ออก</button>`)}
  </div>

  <div class="section">การซิงก์</div>
  <div class="setting-group">
    ${row('ซิงก์อัตโนมัติเมื่อออนไลน์', 'เปิดอยู่', '')}
    ${row('ลองซิงก์รายการที่ล้มเหลว', 'อยู่ในคิว sync', `<button class="btn btn--secondary btn--sm" id="btn-retry">ลองใหม่</button>`)}
  </div>

  <div class="section">ข้อมูลออฟไลน์</div>
  <div class="setting-group">
    <a class="setting-row" href="#/offline" style="text-decoration:none;color:inherit;">
      <div>จัดการข้อมูลออฟไลน์<small>ดูข้อมูลในเครื่อง / ซิงก์ / สำรองข้อมูล</small></div><span>›</span>
    </a>
  </div>

  <div class="section">สำรองข้อมูล</div>
  <div class="setting-group">
    ${row('สำรองข้อมูล', 'ดาวน์โหลด JSON ลงเครื่อง', `<button class="btn btn--secondary btn--sm" id="btn-backup2">สำรอง</button>`)}
  </div>

  <div class="section">Google Apps Script</div>
  <div class="setting-group">
    ${row('Backend endpoint', gas, `<span class="badge badge--warn">รอ Codex</span>`)}
    ${row('หมายเหตุ', 'GAS ทำหน้าที่ sync เท่านั้น — การตรวจเกิดบนอุปกรณ์', '')}
  </div>

  <div class="section">เกี่ยวกับ Kru Check</div>
  <div class="setting-group">
    ${row('เวอร์ชัน', config.version, '')}
    ${row('โหมดข้อมูล', config.dataMode === 'mock' ? 'Mock (ทดลอง UI)' : 'IndexedDB', `<span class="badge">${config.dataMode}</span>`)}
    ${row('OMR engine', config.omr.provider || 'ยังไม่ได้เชื่อม', `<span class="badge badge--warn">รอ Codex</span>`)}
  </div>
  <div id="settings-msg"></div>`;
}

export async function bind(root, { store, navigate }) {
  root.querySelector('#btn-logout').addEventListener('click', () => {
    store.logout();
    navigate('login');
  });
  root.querySelector('#btn-retry').addEventListener('click', async () => {
    const { retried } = await store.sync.retryFailed();
    root.querySelector('#settings-msg').innerHTML =
      `<div class="dev-note" style="border-color:var(--success);background:var(--success-soft);color:var(--success);">นำ ${retried} รายการกลับเข้าคิวซิงก์แล้ว</div>`;
  });
  root.querySelector('#btn-backup2').addEventListener('click', async () => {
    await store.backup.exportBackup();
    root.querySelector('#settings-msg').innerHTML =
      `<div class="dev-note" style="border-color:var(--success);background:var(--success-soft);color:var(--success);">สำรองข้อมูลแล้ว</div>`;
  });
}
