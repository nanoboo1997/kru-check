/* ============================================================
 * Kru Check — ผลตรวจ (results + filters)
 * ============================================================ */
import { resultCardHTML } from '../components/ResultCard.js';

export async function render({ repos, query }) {
  const [classes, exams, students] = await Promise.all([
    repos.classes.list(), repos.exams.list(), repos.students.list(),
  ]);
  const f = {
    classId: query.get('class') || '',
    examId: query.get('exam') || '',
    date: query.get('date') || '',
    reviewStatus: query.get('status') || '',
  };
  const results = await repos.results.query(f);
  const sById = Object.fromEntries(students.map((s) => [s.id, s]));
  const cById = Object.fromEntries(classes.map((c) => [c.id, c]));
  const eById = Object.fromEntries(exams.map((e) => [e.id, e]));

  const opt = (list, val, label, getLabel) =>
    [`<option value="">${label}</option>`]
      .concat(list.map((x) => `<option value="${x.id}" ${x.id === val ? 'selected' : ''}>${getLabel(x)}</option>`)).join('');

  const cards = results.map((r) => {
    const s = sById[r.studentId];
    return resultCardHTML(r, {
      studentName: s ? `${s.firstName} ${s.lastName}` : 'ไม่ระบุนักเรียน',
      className: cById[r.classId]?.name || '—',
      examName: eById[r.examId]?.name || '—',
    });
  }).join('');

  return `
  <div class="page-title"><h1>ผลตรวจ</h1></div>
  <p class="page-sub">พบ ${results.length} รายการ</p>

  <div class="card stack" style="margin-bottom:14px;">
    <div class="field"><label>ห้อง</label><select class="select" id="q-class">${opt(classes, f.classId, 'ทุกห้อง', (c) => c.name)}</select></div>
    <div class="field"><label>ข้อสอบ</label><select class="select" id="q-exam">${opt(exams, f.examId, 'ทุกข้อสอบ', (e) => e.name)}</select></div>
    <div class="grid-2">
      <div class="field"><label>วันที่</label><input class="input" type="date" id="q-date" value="${f.date}" /></div>
      <div class="field"><label>สถานะ</label><select class="select" id="q-status">
        <option value="">ทั้งหมด</option>
        <option value="pending" ${f.reviewStatus === 'pending' ? 'selected' : ''}>รอตรวจทาน</option>
        <option value="done" ${f.reviewStatus === 'done' ? 'selected' : ''}>ตรวจทานแล้ว</option>
        <option value="none" ${f.reviewStatus === 'none' ? 'selected' : ''}>ปกติ</option>
      </select></div>
    </div>
    <button class="btn btn--secondary btn--block" id="btn-filter">กรอง</button>
  </div>

  <div class="stack">${cards || '<div class="empty">ไม่พบผลตรวจตามเงื่อนไข</div>'}</div>`;
}

export async function bind(root, { navigate }) {
  root.querySelector('#btn-filter').addEventListener('click', () => {
    const p = new URLSearchParams();
    const v = (id) => root.querySelector(id).value;
    if (v('#q-class')) p.set('class', v('#q-class'));
    if (v('#q-exam')) p.set('exam', v('#q-exam'));
    if (v('#q-date')) p.set('date', v('#q-date'));
    if (v('#q-status')) p.set('status', v('#q-status'));
    navigate('results' + (p.toString() ? '?' + p.toString() : ''));
  });
}
