/* ============================================================
 * Kru Check — วิเคราะห์ข้อสอบ (item analysis)
 * Summary + ตารางรายข้อ; discrimination ต้องมีข้อมูลพอ
 * ============================================================ */
import { config } from '../config.js';

export async function render({ repos, query }) {
  const exams = await repos.exams.list();
  const examId = query.get('exam') || exams[0]?.id || '';
  const exam = exams.find((e) => e.id === examId);
  const results = examId ? await repos.results.listByExam(examId) : [];
  const key = examId ? await repos.answerKeys.getByExam(examId) : null;

  const examOpts = exams.map((e) =>
    `<option value="${e.id}" ${e.id === examId ? 'selected' : ''}>${e.name}</option>`).join('');

  if (!exam) {
    return `<div class="page-title"><h1>วิเคราะห์ข้อสอบ</h1></div><div class="empty">ยังไม่มีข้อสอบ</div>`;
  }

  let body = '';
  if (!results.length) {
    body = `<div class="empty">ยังไม่มีผลตรวจของข้อสอบชุดนี้</div>`;
  } else {
    const scores = results.map((r) => r.score);
    const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    const max = Math.max(...scores), min = Math.min(...scores);
    const passN = results.filter((r) => (r.score / r.fullScore) * 100 >= config.passThreshold).length;

    // item analysis รายข้อ
    const rows = Array.from({ length: exam.questionCount }, (_, qi) => {
      const counts = { 'ก': 0, 'ข': 0, 'ค': 0, 'ง': 0, 'ไม่ตอบ': 0, 'หลายคำตอบ': 0 };
      results.forEach((r) => {
        const a = r.answers?.[qi];
        if (a && counts[a] !== undefined) counts[a] += 1; else counts['ไม่ตอบ'] += 1;
      });
      const correct = key?.answers[qi];
      const okPct = correct ? Math.round(((counts[correct] || 0) / results.length) * 100) : 0;
      return `<tr><td><b>${qi + 1}</b></td><td>${okPct}%</td>
        <td>${counts['ก']}</td><td>${counts['ข']}</td><td>${counts['ค']}</td><td>${counts['ง']}</td>
        <td>${counts['ไม่ตอบ']}</td><td>${counts['หลายคำตอบ']}</td>
        <td>${okPct >= 70 ? '<span class="badge badge--ok">ง่าย</span>' : okPct >= 40 ? '<span class="badge">พอดี</span>' : '<span class="badge badge--bad">ยาก</span>'}</td></tr>`;
    }).join('');

    body = `
    <div class="section">ภาพรวม (${results.length} คน)</div>
    <div class="stat-grid">
      <div class="stat"><b>${avg}</b><span>คะแนนเฉลี่ย</span></div>
      <div class="stat"><b>${max}</b><span>สูงสุด</span></div>
      <div class="stat"><b>${min}</b><span>ต่ำสุด</span></div>
      <div class="stat"><b>${passN}</b><span>ผ่านเกณฑ์</span></div>
    </div>

    <div class="section">วิเคราะห์รายข้อ</div>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>ข้อ</th><th>ตอบถูก %</th><th>ก</th><th>ข</th><th>ค</th><th>ง</th><th>ไม่ตอบ</th><th>หลายคำตอบ</th><th>สถานะ</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>

    <div class="section">ค่าอำนาจจำแนก (Discrimination)</div>
    ${results.length < 30
      ? `<div class="card"><p class="muted" style="margin:0;">ข้อมูลยังน้อยเกินไป — ต้องการผลตรวจอย่างน้อย 30 ชุดจึงจะคำนวณค่าอำนาจจำแนกได้อย่างน่าเชื่อถือ</p></div>`
      : `<div class="card"><p class="small muted" style="margin:0;">โครงคำนวณ discrimination พร้อม — รอ Codex ต่อสูตรสถิติจริง</p></div>`}`;
  }

  return `
  <div class="page-title"><h1>วิเคราะห์ข้อสอบ</h1></div>
  <div class="field"><label>เลือกข้อสอบ</label>
    <select class="select" id="an-exam">${examOpts}</select></div>
  ${body}`;
}

export async function bind(root, { navigate }) {
  const sel = root.querySelector('#an-exam');
  if (sel) sel.addEventListener('change', () => navigate(`analysis?exam=${sel.value}`));
}
