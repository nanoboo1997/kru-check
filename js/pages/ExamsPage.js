/* Kru Check — ข้อสอบ (exam cards) */
import { fmtDate } from '../components/ResultCard.js';

export async function render({ repos }) {
  const exams = await repos.exams.list();
  const cards = exams.map((e) => `
    <a class="card card--tap" href="#/exams/${e.id}" style="text-decoration:none;color:inherit;display:block;margin-bottom:12px;">
      <div class="card-title">${e.name}</div>
      <div class="card-sub">${e.questionCount} ข้อ · คะแนนเต็ม ${e.fullScore} · สร้าง ${fmtDate(e.createdAt)}</div>
    </a>`).join('');
  return `
  <div class="page-title"><h1>ข้อสอบ</h1></div>
  <p class="page-sub">รองรับ 20 / 40 / 60 ข้อ และจำนวนอื่นในอนาคต — ไม่ผูกตายตัวกับ 40 ข้อ</p>
  <button class="btn btn--block" id="btn-new-exam" style="margin-bottom:14px;">สร้างข้อสอบ</button>
  <div id="new-exam-slot"></div>
  ${cards || '<div class="empty">ยังไม่มีข้อสอบ</div>'}`;
}

export async function bind(root, { repos, navigate }) {
  root.querySelector('#btn-new-exam').addEventListener('click', () => {
    const slot = root.querySelector('#new-exam-slot');
    if (slot.innerHTML) { slot.innerHTML = ''; return; }
    slot.innerHTML = `
      <div class="card" style="margin-bottom:14px;">
        <div class="field"><label>ชื่อข้อสอบ</label><input class="input" id="ne-name" placeholder="เช่น สอบกลางภาค วิทยาศาสตร์" /></div>
        <div class="field"><label>จำนวนข้อ</label>
          <select class="select" id="ne-count">
            <option value="20">20 ข้อ</option><option value="40" selected>40 ข้อ</option>
            <option value="60">60 ข้อ</option><option value="custom">กำหนดเอง…</option>
          </select></div>
        <div class="field" id="ne-custom-wrap" style="display:none;"><label>จำนวนข้อ (กำหนดเอง)</label>
          <input class="input" id="ne-custom" type="number" min="1" max="200" value="40" /></div>
        <div class="field"><label>คะแนนเต็ม</label><input class="input" id="ne-full" type="number" min="1" value="40" /></div>
        <button class="btn btn--block" id="ne-save">บันทึกข้อสอบ</button>
      </div>`;
    root.querySelector('#ne-count').addEventListener('change', (e) => {
      root.querySelector('#ne-custom-wrap').style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
    root.querySelector('#ne-save').addEventListener('click', async () => {
      const name = root.querySelector('#ne-name').value.trim();
      if (!name) return;
      const sel = root.querySelector('#ne-count').value;
      const questionCount = sel === 'custom'
        ? Math.max(1, parseInt(root.querySelector('#ne-custom').value, 10) || 40)
        : parseInt(sel, 10);
      const fullScore = parseInt(root.querySelector('#ne-full').value, 10) || questionCount;
      const exam = { id: `e-${Date.now()}`, name, questionCount, fullScore, createdAt: new Date().toISOString() };
      await repos.exams.save(exam);
      await repos.answerKeys.save({ id: `ak-${exam.id}`, examId: exam.id, answers: Array(questionCount).fill('ก') });
      await repos.sync.enqueue({ type: 'upsert', store: 'exams', payload: { id: exam.id } });
      navigate('exams');
    });
  });
}
