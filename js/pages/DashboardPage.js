/* Kru Check — Dashboard */
import { icons } from '../components/icons.js';

const QUICK = [
  { path: 'scan', label: 'ตรวจข้อสอบ', icon: 'scan' },
  { path: 'scan-continuous', label: 'สแกนต่อเนื่อง', icon: 'camera' },
  { path: 'classrooms', label: 'ห้องเรียน', icon: 'classroom' },
  { path: 'exams', label: 'ข้อสอบ', icon: 'exam' },
  { path: 'review', label: 'รอตรวจทาน', icon: 'review' },
  { path: 'analysis', label: 'วิเคราะห์ข้อสอบ', icon: 'chart' },
];

export async function render({ store, repos }) {
  const [students, exams, results, reviews] = await Promise.all([
    repos.students.list(), repos.exams.list(), repos.results.list(), repos.reviews.pending(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = results.filter((r) => String(r.createdAt).startsWith(today)).length;

  const quickHTML = QUICK.map((q) => `
    <a class="quick" href="#/${q.path}">
      <span class="quick__icon">${icons[q.icon]}</span><span>${q.label}</span>
    </a>`).join('');

  return `
  <h1 class="hello">สวัสดี</h1>
  <p class="page-sub">${store.currentUser?.name || 'คุณครู'} · พร้อมตรวจข้อสอบแล้ว</p>

  <div class="section">ทางลัด</div>
  <div class="quick-grid">${quickHTML}</div>

  <div class="section">ภาพรวม</div>
  <div class="stat-grid">
    <div class="stat"><b>${students.length}</b><span>นักเรียน</span></div>
    <div class="stat"><b>${exams.length}</b><span>ข้อสอบ</span></div>
    <div class="stat"><b>${todayCount}</b><span>ตรวจวันนี้</span></div>
    <div class="stat"><b>${reviews.length}</b><span>รอตรวจทาน</span></div>
  </div>

  ${reviews.length ? `
  <div class="section">ต้องทำต่อ</div>
  <a class="row-item" href="#/review" style="text-decoration:none;color:inherit;">
    <span class="avatar">${icons.review}</span>
    <span class="row-item__main">
      <span class="row-item__title">มีข้อรอตรวจทาน ${reviews.length} ข้อ</span>
      <span class="row-item__sub" style="display:block;">OMR ไม่มั่นใจ — ต้องการครูช่วยยืนยัน</span>
    </span>
    <span style="color:var(--faint);">›</span>
  </a>` : ''}`;
}
