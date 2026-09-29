/* Kru Check — เพิ่มเติม (more tab) */
import { icons } from '../components/icons.js';

const LINKS = [
  { path: 'scan-continuous', label: 'สแกนต่อเนื่อง', sub: 'ตรวจหลายใบติดกัน', icon: 'camera' },
  { path: 'exams', label: 'ข้อสอบ', sub: 'จัดการข้อสอบ เฉลย กระดาษคำตอบ', icon: 'exam' },
  { path: 'review', label: 'รอตรวจทาน', sub: 'ข้อที่ OMR ไม่มั่นใจ', icon: 'review' },
  { path: 'analysis', label: 'วิเคราะห์ข้อสอบ', sub: 'สถิติรายข้อ', icon: 'chart' },
  { path: 'offline', label: 'ข้อมูลออฟไลน์', sub: 'ซิงก์ สำรองข้อมูล', icon: 'offline' },
  { path: 'settings', label: 'ตั้งค่า', sub: 'บัญชี การซิงก์ เกี่ยวกับ', icon: 'settings' },
];

export async function render() {
  const rows = LINKS.map((l) => `
    <a class="row-item" href="#/${l.path}" style="text-decoration:none;color:inherit;">
      <span class="avatar">${icons[l.icon]}</span>
      <span class="row-item__main">
        <span class="row-item__title">${l.label}</span>
        <span class="row-item__sub" style="display:block;">${l.sub}</span>
      </span>
      <span style="color:var(--faint);">›</span>
    </a>`).join('');
  return `
  <div class="page-title"><h1>เพิ่มเติม</h1></div>
  <div class="stack">${rows}</div>`;
}
