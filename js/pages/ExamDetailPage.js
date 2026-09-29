/* Kru Check — รายละเอียดข้อสอบ + actions */
import { fmtDate } from '../components/ResultCard.js';

export async function render({ repos, params }) {
  const exam = await repos.exams.get(params.id);
  if (!exam) return `<div class="empty">ไม่พบข้อสอบ</div>`;
  const key = await repos.answerKeys.getByExam(exam.id);
  const keyed = key ? key.answers.filter(Boolean).length : 0;
  return `
  <a class="back-link" href="#/exams">‹ ข้อสอบ</a>
  <div class="page-title"><h1>${exam.name}</h1></div>
  <p class="page-sub">${exam.questionCount} ข้อ · คะแนนเต็ม ${exam.fullScore} · สร้าง ${fmtDate(exam.createdAt)}</p>

  <div class="card" style="margin-bottom:12px;">
    <div class="kv"><span>เฉลยที่กรอกแล้ว</span><b>${keyed} / ${exam.questionCount} ข้อ</b></div>
    <div class="progress" style="margin-top:8px;"><i style="width:${Math.round((keyed / exam.questionCount) * 100)}%;"></i></div>
  </div>

  <div class="stack">
    <a class="btn btn--secondary btn--block" href="#/exams/${exam.id}/key">แก้ไขเฉลย</a>
    <a class="btn btn--secondary btn--block" href="#/exams/${exam.id}/sheet">กระดาษคำตอบ</a>
    <a class="btn btn--secondary btn--block" href="#/exams/${exam.id}/sheet?tab=qr">QR รายบุคคล</a>
    <a class="btn btn--block" href="#/results?exam=${exam.id}">ดูผลสอบ</a>
  </div>`;
}
