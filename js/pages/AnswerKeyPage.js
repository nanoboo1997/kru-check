/* ============================================================
 * Kru Check — แก้ไขเฉลย (answer key editor)
 * กริดคำตอบ generic ตามจำนวนข้อจริงของข้อสอบ (ไม่ผูก 40 ข้อ)
 * ============================================================ */
const CHOICES = ['ก', 'ข', 'ค', 'ง'];

export async function render({ repos, params }) {
  const exam = await repos.exams.get(params.id);
  if (!exam) return `<div class="empty">ไม่พบข้อสอบ</div>`;
  const key = (await repos.answerKeys.getByExam(exam.id)) || { id: `ak-${exam.id}`, examId: exam.id, answers: [] };
  const answers = Array.from({ length: exam.questionCount }, (_, i) => key.answers[i] || null);

  const cells = answers.map((a, i) => `
    <div class="card" style="padding:10px;text-align:center;" data-q="${i}">
      <div style="font-weight:800;margin-bottom:6px;">${i + 1}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        ${CHOICES.map((c) => `
          <button class="choice ${a === c ? 'choice--picked' : ''}" data-qpick="${i}" data-c="${c}"
                  style="min-height:44px;font-size:16px;">${c}</button>`).join('')}
      </div>
    </div>`).join('');

  return `
  <a class="back-link" href="#/exams/${exam.id}">‹ ${exam.name}</a>
  <div class="page-title"><h1>แก้ไขเฉลย</h1></div>
  <p class="page-sub">${exam.questionCount} ข้อ — แตะตัวเลือกเพื่อกำหนดเฉลยแต่ละข้อ</p>
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;" id="key-grid">${cells}</div>
  <div style="position:sticky;bottom:calc(84px + var(--sab));margin-top:16px;">
    <button class="btn btn--block" id="btn-save-key">บันทึกเฉลย</button>
  </div>
  <div id="key-msg"></div>`;
}

export async function bind(root, { repos, params, store, navigate }) {
  const picks = {};
  root.querySelectorAll('[data-qpick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const q = btn.dataset.qpick;
      picks[q] = btn.dataset.c;
      root.querySelectorAll(`[data-qpick="${q}"]`).forEach((b) =>
        b.classList.toggle('choice--picked', b === btn));
    });
  });
  // เติมค่าเดิมลง picks
  root.querySelectorAll('.choice--picked[data-qpick]').forEach((b) => { picks[b.dataset.qpick] = b.dataset.c; });

  root.querySelector('#btn-save-key').addEventListener('click', async () => {
    const exam = await repos.exams.get(params.id);
    const prev = (await repos.answerKeys.getByExam(exam.id)) || { id: `ak-${exam.id}`, examId: exam.id, answers: [] };
    const answers = Array.from({ length: exam.questionCount }, (_, i) =>
      picks[i] ?? prev.answers[i] ?? null);
    await repos.answerKeys.save({ id: prev.id, examId: exam.id, answers });
    await repos.sync.enqueue({ type: 'upsert', store: 'answerKeys', payload: { id: prev.id } });
    root.querySelector('#key-msg').innerHTML =
      `<div class="dev-note" style="border-color:var(--success);background:var(--success-soft);color:var(--success);"><strong>บันทึกแล้ว</strong>เฉลยถูกเก็บในเครื่อง${navigator.onLine ? '' : ' (ออฟไลน์อยู่ — จะซิงก์เมื่อกลับมาออนไลน์)'}</div>`;
    store.emit('connectivity');
    setTimeout(() => navigate(`exams/${exam.id}`), 900);
  });
}
