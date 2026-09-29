/* Kru Check — BottomNav (iPhone) */
import { icons } from './icons.js';

const ITEMS = [
  { path: 'dashboard', label: 'หน้าหลัก', icon: icons.home },
  { path: 'scan', label: 'ตรวจข้อสอบ', icon: icons.scan },
  { path: 'classrooms', label: 'ห้องเรียน', icon: icons.classroom },
  { path: 'results', label: 'ผลตรวจ', icon: icons.result },
  { path: 'more', label: 'เพิ่มเติม', icon: icons.more },
];

export function bottomNavHTML(active) {
  const links = ITEMS.map((it) => `
    <a class="nav-item ${active === it.path ? 'nav-item--active' : ''}" href="#/${it.path}">
      ${it.icon}<span>${it.label}</span>
    </a>`).join('');
  return `<nav class="bottom-nav" aria-label="เมนูหลัก"><div class="bottom-nav__inner">${links}</div></nav>`;
}

export function sideNavHTML(active) {
  const extra = [
    { path: 'scan-continuous', label: 'สแกนต่อเนื่อง', icon: icons.camera },
    { path: 'exams', label: 'ข้อสอบ', icon: icons.exam },
    { path: 'review', label: 'รอตรวจทาน', icon: icons.review },
    { path: 'analysis', label: 'วิเคราะห์ข้อสอบ', icon: icons.chart },
    { path: 'offline', label: 'ข้อมูลออฟไลน์', icon: icons.offline },
    { path: 'settings', label: 'ตั้งค่า', icon: icons.settings },
  ];
  const all = [...ITEMS.slice(0, 4), ...extra, ITEMS[4]];
  const links = all.map((it) => `
    <a class="${active === it.path ? 'side-active' : ''}" href="#/${it.path}">${it.icon}<span>${it.label}</span></a>`).join('');
  return `<aside class="side-nav" aria-label="เมนูหลัก">
    <div class="brand"><span class="brand__logo">✓</span><span>Kru Check</span></div>
    ${links}
  </aside>`;
}
