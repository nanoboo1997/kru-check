/* ============================================================
 * Kru Check — รายละเอียดห้องเรียน
 * เลขที่ / รหัสนักเรียน / ชื่อ / นามสกุล
 * เพิ่มนักเรียน / Import / เลือกทั้งหมด / ลบที่เลือก
 * ============================================================ */
export async function render({ repos, params }) {
  const cls = await repos.classes.get(params.id);
  if (!cls) return `<div class="empty">ไม่พบห้องเรียน</div>`;
  const students = await repos.students.listByClass(params.id);
  const rows = students.map((s) => `
    <tr data-row="${s.id}">
      <td><input type="checkbox" data-check="${s.id}" style="width:20px;height:20px;accent-color:var(--primary);" /></td>
      <td>${s.no}</td><td>${s.code}</td><td>${s.firstName}</td><td>${s.lastName}</td>
    </tr>`).join('');
  return `
  <a class="back-link" href="#/classrooms">‹ ห้องเรียน</a>
  <div class="page-title"><h1>${cls.name}</h1></div>
  <p class="page-sub">นักเรียน ${students.length} คน</p>

  <div class="btn-row" style="margin-bottom:12px;">
    <button class="btn btn--secondary btn--sm" id="btn-add-student">เพิ่มนักเรียน</button>
    <label class="btn btn--secondary btn--sm" style="cursor:pointer;">Import
      <input type="file" id="file-import" accept=".csv,.json" hidden />
    </label>
    <button class="btn btn--ghost btn--sm" id="btn-select-all">เลือกทั้งหมด</button>
    <button class="btn btn--danger btn--sm" id="btn-delete-sel">ลบที่เลือก</button>
  </div>
  <div id="add-form-slot"></div>
  <div id="import-msg"></div>

  <div class="table-wrap">
    <table class="data">
      <thead><tr><th></th><th>เลขที่</th><th>รหัส</th><th>ชื่อ</th><th>นามสกุล</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="center muted">ยังไม่มีนักเรียนในห้องนี้</td></tr>'}</tbody>
    </table>
  </div>`;
}

export async function bind(root, { repos, params, navigate }) {
  const classId = params.id;

  root.querySelector('#btn-add-student').addEventListener('click', () => {
    const slot = root.querySelector('#add-form-slot');
    if (slot.innerHTML) { slot.innerHTML = ''; return; }
    slot.innerHTML = `
      <div class="card" style="margin-bottom:12px;">
        <div class="field"><label>ชื่อ</label><input class="input" id="ns-first" placeholder="ชื่อ" /></div>
        <div class="field"><label>นามสกุล</label><input class="input" id="ns-last" placeholder="นามสกุล" /></div>
        <button class="btn btn--block" id="ns-save">บันทึก</button>
      </div>`;
    root.querySelector('#ns-save').addEventListener('click', async () => {
      const firstName = root.querySelector('#ns-first').value.trim();
      const lastName = root.querySelector('#ns-last').value.trim();
      if (!firstName) return;
      const existing = await repos.students.listByClass(classId);
      const no = existing.length + 1;
      const student = {
        id: `st-${classId}-${Date.now()}`, classId, no,
        code: `S${classId.replace('c', '')}${String(no).padStart(2, '0')}`,
        firstName, lastName: lastName || '—',
      };
      await repos.students.save(student);
      await repos.sync.enqueue({ type: 'upsert', store: 'students', payload: { id: student.id } });
      navigate(`classrooms/${classId}`);
    });
  });

  root.querySelector('#file-import').addEventListener('change', () => {
    root.querySelector('#import-msg').innerHTML = `
      <div class="dev-note"><strong>Import รายชื่อ</strong>รองรับไฟล์ CSV/JSON — โครงสร้างพร้อมแล้ว
      รอ Codex ต่อ parser จริง (ตอนนี้ยังไม่นำเข้าข้อมูล)</div>`;
  });

  root.querySelector('#btn-select-all').addEventListener('click', () => {
    const boxes = [...root.querySelectorAll('[data-check]')];
    const allOn = boxes.every((b) => b.checked);
    boxes.forEach((b) => (b.checked = !allOn));
  });

  root.querySelector('#btn-delete-sel').addEventListener('click', async () => {
    const ids = [...root.querySelectorAll('[data-check]:checked')].map((b) => b.dataset.check);
    if (!ids.length) return;
    if (!confirm(`ลบนักเรียน ${ids.length} คนที่เลือก?`)) return;
    for (const id of ids) {
      await repos.students.remove(id);
      await repos.sync.enqueue({ type: 'delete', store: 'students', payload: { id } });
    }
    navigate(`classrooms/${classId}`);
  });
}
