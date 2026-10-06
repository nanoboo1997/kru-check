/* ============================================================
 * Kru Check — ข้อมูลออฟไลน์
 * ข้อมูลในเครื่อง / รายการรอซิงก์ / ซิงก์ล่าสุด / พื้นที่โดยประมาณ
 * ============================================================ */
import { estimateStorage } from '../core/db.js';
import { fmtDate } from '../components/ResultCard.js';
import { syncPillHTML, getSyncState } from '../components/SyncStatus.js';

const fmtMB = (b) => (b / 1048576).toFixed(1) + ' MB';

export async function render({ repos, store }) {
  const [classes, students, exams, results, reviews, pending, lastSync, storage] = await Promise.all([
    repos.classes.list(), repos.students.list(), repos.exams.list(),
    repos.results.list(), repos.reviews.list(),
    repos.sync.pending(), store.sync.getLastSync(), estimateStorage(),
  ]);
  const state = await getSyncState();

  const pendingRows = pending.map((p) => `
    <div class="kv"><span>${p.store} · ${p.type}</span><span class="badge badge--warn">รอซิงก์</span></div>`).join('');

  return `
  <div class="page-title"><h1>ข้อมูลออฟไลน์</h1></div>
  <p class="page-sub">ทุกอย่างเก็บในเครื่องก่อน — ซิงก์ขึ้น cloud เมื่อมีอินเทอร์เน็ต</p>

  <div class="card" style="margin-bottom:12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <b>สถานะการซิงก์</b>${syncPillHTML(state)}
    </div>
    <div class="kv"><span>ซิงก์ล่าสุด</span><span class="muted">${lastSync ? fmtDate(lastSync) : 'ยังไม่เคยซิงก์'}</span></div>
    <div class="kv"><span>พื้นที่ใช้โดยประมาณ</span><b>${fmtMB(storage.usage)}${storage.quota ? ' / ' + fmtMB(storage.quota) : ''}</b></div>
  </div>

  <div class="section">ข้อมูลที่อยู่ในเครื่อง</div>
  <div class="stat-grid">
    <div class="stat"><b>${classes.length}</b><span>ห้องเรียน</span></div>
    <div class="stat"><b>${students.length}</b><span>นักเรียน</span></div>
    <div class="stat"><b>${exams.length}</b><span>ข้อสอบ</span></div>
    <div class="stat"><b>${results.length}</b><span>ผลตรวจ</span></div>
  </div>
  <div class="card" style="margin-top:12px;">
    <div class="kv"><span>คิวรอตรวจทาน</span><b>${reviews.filter((r) => r.status === 'pending').length} ข้อ</b></div>
    <div class="kv"><span>รายการรอซิงก์</span><b>${pending.length} รายการ</b></div>
  </div>

  ${pending.length ? `
  <div class="section">รายการรอซิงก์</div>
  <div class="card">${pendingRows}</div>` : ''}

  <div class="section">จัดการ</div>
  <div class="stack">
    <button class="btn btn--block" id="btn-sync-now">ซิงก์ตอนนี้</button>
    <button class="btn btn--secondary btn--block" id="btn-backup">สำรองข้อมูล</button>
    <label class="btn btn--secondary btn--block" style="cursor:pointer;">นำเข้าข้อมูลสำรอง
      <input type="file" id="file-restore" accept="application/json" hidden /></label>
  </div>
  <div id="offline-msg"></div>`;
}

export async function bind(root, { repos, store, navigate }) {
  const say = (html) => { root.querySelector('#offline-msg').innerHTML = html; };

  root.querySelector('#btn-sync-now').addEventListener('click', async () => {
    say(`<div class="dev-note"><strong>กำลังซิงก์…</strong></div>`);
    const res = await store.sync.syncNow();
    if (!res.ok) {
      const text = res.reason === 'not-configured'
        ? 'ยังไม่ได้เชื่อมระบบ Cloud — ข้อมูลยังเก็บอยู่ในเครื่องครบ'
        : 'กำลังใช้งานแบบออฟไลน์ — ผลตรวจจะถูกซิงก์เมื่อกลับมาออนไลน์';
      say(`<div class="dev-note"><strong>ยังไม่ได้ซิงก์</strong>${text}</div>`);
    } else {
      say(`<div class="dev-note" style="border-color:var(--success);background:var(--success-soft);color:var(--success);"><strong>ซิงก์แล้ว</strong>ดันข้อมูล ${res.pushed} รายการ</div>`);
      setTimeout(() => navigate('offline'), 900);
    }
  });

  root.querySelector('#btn-backup').addEventListener('click', async () => {
    await store.backup.exportBackup();
    say(`<div class="dev-note" style="border-color:var(--success);background:var(--success-soft);color:var(--success);"><strong>สำรองข้อมูลแล้ว</strong>ไฟล์ถูกดาวน์โหลดลงเครื่อง</div>`);
  });

  root.querySelector('#file-restore').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const sum = await store.backup.importBackup(f);
      say(`<div class="dev-note" style="border-color:var(--success);background:var(--success-soft);color:var(--success);"><strong>นำเข้าข้อมูลแล้ว</strong>ห้อง ${sum.classes} · นักเรียน ${sum.students} · ข้อสอบ ${sum.exams} · ผลตรวจ ${sum.results}</div>`);
    } catch (err) {
      say(`<div class="dev-note"><strong>นำเข้าไม่สำเร็จ</strong>${err.message}</div>`);
    }
  });
}
