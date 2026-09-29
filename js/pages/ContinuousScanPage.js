/* ============================================================
 * Kru Check — สแกนต่อเนื่อง (continuous scan)
 * ออกแบบสำหรับ iPhone portrait: กล้องใหญ่ ~90-96% ความกว้าง
 * เห็น A4 ทั้งใบพร้อม margin — โหมดนักเรียน 3 แบบ
 * ============================================================ */
import { classSelectHTML, examSelectHTML } from '../components/selectors.js';
import { cameraViewportHTML, openCamera, closeCamera } from '../components/CameraViewport.js';
import { scanStatusHTML, setScanState } from '../components/ScanStatus.js';

const MODES = [
  { id: 'picked', label: 'เลือกนักเรียนก่อนสแกน' },
  { id: 'ordered', label: 'สแกนตามลำดับรายชื่อ' },
  { id: 'unlinked', label: 'ยังไม่ผูกนักเรียน' },
];

export async function render({ repos }) {
  const classes = await repos.classes.list();
  const exams = await repos.exams.list();
  const tabs = MODES.map((m, i) =>
    `<button class="tab ${i === 0 ? 'tab--active' : ''}" data-mode="${m.id}">${m.label}</button>`).join('');
  return `
  <div class="page-title"><h1>สแกนต่อเนื่อง</h1></div>
  <p class="page-sub">วางกระดาษทีละใบ ระบบตรวจให้ต่อเนื่องโดยไม่ต้องกดทีละครั้ง</p>

  <div class="tabs" id="mode-tabs">${tabs}</div>

  <div class="card stack">
    ${classSelectHTML(classes, '', 'f-class-c')}
    ${examSelectHTML(exams, '', 'f-exam-c')}
    <div id="mode-student-slot"></div>
  </div>

  <div class="student-mode-note" id="queue-note" style="display:none;">
    <span>คนปัจจุบัน: <b id="q-current">—</b></span>
    <span>คนถัดไป: <b id="q-next">—</b></span>
  </div>

  <div class="section">กล้องสแกน</div>
  <div id="cam-slot-c">${cameraViewportHTML('cam-cont')}</div>
  ${scanStatusHTML('idle')}
  <div class="scan-counter"><span>ตรวจแล้ว</span><b id="scan-count">0</b><span>แผ่น</span></div>

  <div class="btn-row">
    <button class="btn" id="btn-start-scan">เริ่มสแกน</button>
    <button class="btn btn--secondary" id="btn-stop-scan" disabled>หยุดสแกน</button>
  </div>
  <div class="btn-row" style="margin-top:10px;">
    <button class="btn btn--secondary" id="btn-skip">ข้ามนักเรียน</button>
    <button class="btn btn--secondary" id="btn-pick-student">เลือกนักเรียน</button>
  </div>
  <div id="cont-status"></div>`;
}

export async function bind(root, { repos, store }) {
  let mode = 'picked';
  let students = [];
  let orderIdx = 0;
  let count = 0;
  let scanning = false;
  const camSlot = root.querySelector('#cam-slot-c');

  const slot = root.querySelector('#mode-student-slot');
  const note = root.querySelector('#queue-note');

  async function loadStudents() {
    const classId = root.querySelector('#f-class-c').value;
    students = classId ? await repos.students.listByClass(classId) : [];
    orderIdx = 0;
    renderModeUI();
  }

  function renderModeUI() {
    if (mode === 'picked') {
      const opts = [`<option value="">— เลือกนักเรียน —</option>`,
        `<option value="__unknown__">ไม่ระบุนักเรียน</option>`]
        .concat(students.map((s) => `<option value="${s.id}">${s.no}. ${s.firstName} ${s.lastName}</option>`)).join('');
      slot.innerHTML = `<div class="field"><label for="f-student-c">นักเรียนที่จะสแกน</label><select class="select" id="f-student-c">${opts}</select></div>`;
      note.style.display = 'none';
    } else if (mode === 'ordered') {
      slot.innerHTML = '';
      note.style.display = 'flex';
      updateQueueNote();
    } else {
      slot.innerHTML = `<div class="dev-note" style="margin:0;"><strong>โหมดยังไม่ผูกนักเรียน</strong>สแกนเก็บผลไว้ก่อน แล้วค่อยจับคู่กับรายชื่อภายหลัง</div>`;
      note.style.display = 'none';
    }
  }

  function updateQueueNote() {
    const cur = students[orderIdx];
    const nxt = students[orderIdx + 1];
    root.querySelector('#q-current').textContent = cur ? `${cur.no}. ${cur.firstName} ${cur.lastName}` : '—';
    root.querySelector('#q-next').textContent = nxt ? `${nxt.no}. ${nxt.firstName} ${nxt.lastName}` : '—';
  }

  root.querySelector('#mode-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    mode = btn.dataset.mode;
    root.querySelectorAll('#mode-tabs .tab').forEach((t) => t.classList.toggle('tab--active', t === btn));
    renderModeUI();
  });
  root.querySelector('#f-class-c').addEventListener('change', loadStudents);

  root.querySelector('#btn-start-scan').addEventListener('click', async () => {
    if (!root.querySelector('#f-class-c').value || !root.querySelector('#f-exam-c').value) {
      root.querySelector('#cont-status').innerHTML =
        `<div class="dev-note"><strong>ยังไม่ครบ</strong>กรุณาเลือกห้องเรียนและข้อสอบก่อนเริ่มสแกน</div>`;
      return;
    }
    const ok = await openCamera(camSlot);
    scanning = true;
    root.querySelector('#btn-start-scan').disabled = true;
    root.querySelector('#btn-stop-scan').disabled = false;
    setScanState(root, ok ? 'searching' : 'idle');
    // CONTINUOUS_OMR_PROCESSOR — จุดที่ Codex เชื่อม OMR จริง (processFrame)
    // ตอนนี้ยังไม่ implement: แสดงสถานะ dev ชัดเจน ไม่แกล้งตรวจ
    try {
      await store.omr.processFrame(null);
    } catch (err) {
      root.querySelector('#cont-status').innerHTML = `
        <div class="dev-note"><strong>โหมดพัฒนา — ยังไม่ได้เชื่อม OMR</strong>
        เมื่อ Codex เชื่อม <code>CONTINUOUS_OMR_PROCESSOR</code> (JS/WASM) แล้ว สถานะจะเปลี่ยนตามจริง:
        กำลังหากระดาษ → พบกระดาษแล้ว → ถือไว้นิดเดียว → กำลังตรวจ... → ตรวจแล้ว → นำกระดาษแผ่นเดิมออก</div>`;
    }
  });

  root.querySelector('#btn-stop-scan').addEventListener('click', () => {
    scanning = false;
    closeCamera(camSlot);
    setScanState(root, 'stopped');
    root.querySelector('#btn-start-scan').disabled = false;
    root.querySelector('#btn-stop-scan').disabled = true;
  });

  root.querySelector('#btn-skip').addEventListener('click', () => {
    if (mode === 'ordered' && students.length) {
      orderIdx = Math.min(orderIdx + 1, students.length - 1);
      updateQueueNote();
    }
  });

  root.querySelector('#btn-pick-student').addEventListener('click', () => {
    // กลับไปโหมดเลือกนักเรียนก่อนสแกน
    root.querySelector('[data-mode="picked"]').click();
    root.querySelector('#mode-student-slot').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // ตัวนับสำหรับ demo flow (ไม่เกี่ยวกับผล OMR จริง)
  root._bumpCount = () => {
    count += 1;
    root.querySelector('#scan-count').textContent = count;
  };
}
