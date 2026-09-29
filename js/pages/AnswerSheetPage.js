/* ============================================================
 * Kru Check — กระดาษคำตอบ / QR รายบุคคล
 * เตรียม UI สำหรับสร้าง/ดาวน์โหลด/พิมพ์ — รอ Codex เชื่อมของจริง
 * (รวม cryptographic QR signing ในอนาคต)
 * ============================================================ */
export async function render({ repos, params, query }) {
  const exam = await repos.exams.get(params.id);
  if (!exam) return `<div class="empty">ไม่พบข้อสอบ</div>`;
  const tab = query.get('tab') === 'qr' ? 'qr' : 'sheet';
  return `
  <a class="back-link" href="#/exams/${exam.id}">‹ ${exam.name}</a>
  <div class="page-title"><h1>${tab === 'qr' ? 'QR รายบุคคล' : 'กระดาษคำตอบ'}</h1></div>
  <p class="page-sub">${exam.name} · ${exam.questionCount} ข้อ</p>

  <div class="tabs">
    <a class="tab ${tab === 'sheet' ? 'tab--active' : ''}" style="display:grid;place-items:center;text-decoration:none;" href="#/exams/${exam.id}/sheet">กระดาษคำตอบ</a>
    <a class="tab ${tab === 'qr' ? 'tab--active' : ''}" style="display:grid;place-items:center;text-decoration:none;" href="#/exams/${exam.id}/sheet?tab=qr">QR รายบุคคล</a>
  </div>

  ${tab === 'sheet' ? `
  <div class="card stack">
    <div class="field"><label>จำนวนข้อ</label>
      <select class="select" id="sh-count">
        ${[20, 40, 60].map((n) => `<option value="${n}" ${n === exam.questionCount ? 'selected' : ''}>${n} ข้อ</option>`).join('')}
        <option value="${exam.questionCount}">${exam.questionCount} ข้อ (ตามข้อสอบ)</option>
      </select></div>
    <label class="checkbox-row"><input type="checkbox" id="sh-qr" /> ใส่ QR ระบุข้อสอบบนกระดาษ</label>
  </div>` : `
  <div class="card stack">
    <div class="field"><label>ห้องเรียน</label><select class="select" id="sh-class"><option>— เลือกห้อง —</option></select></div>
    <p class="small muted">สร้างกระดาษคำตอบที่มี QR ระบุตัวนักเรียนรายบุคคล พร้อมลายเซ็นดิจิทัล (cryptographic signing)</p>
  </div>`}

  <div class="dev-note"><strong>โหมดพัฒนา — ยังไม่สร้างกระดาษจริง</strong>
  ปุ่มด้านล่างจะเรียก AnswerSheetService เมื่อ Codex เชื่อมระบบสร้างกระดาษคำตอบ + QR signing จริงแล้ว</div>

  <div class="btn-row">
    <button class="btn btn--secondary" id="btn-dl">ดาวน์โหลด</button>
    <button class="btn btn--secondary" id="btn-print">พิมพ์</button>
  </div>
  <div id="sheet-msg"></div>`;
}

export async function bind(root, { repos, params, query, store }) {
  if (query.get('tab') === 'qr') {
    const classes = await repos.classes.list();
    root.querySelector('#sh-class').innerHTML =
      `<option value="">— เลือกห้อง —</option>` + classes.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
  }
  const dev = store.answerSheet.devNotice;
  const showDev = () => {
    root.querySelector('#sheet-msg').innerHTML =
      `<div class="dev-note"><strong>${dev.title}</strong>${dev.body}</div>`;
  };
  root.querySelector('#btn-dl').addEventListener('click', showDev);
  root.querySelector('#btn-print').addEventListener('click', showDev);
}
