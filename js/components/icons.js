/* Kru Check — inline SVG icons (เรียบง่าย, ไม่ใช้ลายไทย) */
const wrap = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const icons = {
  home: wrap('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>'),
  scan: wrap('<path d="M3 8V5a2 2 0 0 1 2-2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2h-3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M4 12h16"/>'),
  camera: wrap('<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="14" r="3.5"/>'),
  classroom: wrap('<path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-4h6v4"/><path d="M12 8v3"/>'),
  exam: wrap('<path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"/><path d="M14 2v6h6"/><path d="M9 13h7M9 17h7"/>'),
  result: wrap('<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-8"/><path d="M22 20H2"/>'),
  review: wrap('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  chart: wrap('<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>'),
  more: wrap('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'),
  offline: wrap('<path d="M5 12a7 7 0 0 1 12-4.9"/><path d="M8.5 12a3.5 3.5 0 0 1 6-2.4"/><circle cx="12" cy="14.5" r="1.4" fill="currentColor"/><path d="m3 3 18 18"/>'),
  settings: wrap('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2Z"/>'),
  check: wrap('<path d="m4 12.5 5 5L20 6.5"/>'),
  logout: wrap('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>'),
  back: wrap('<path d="m14 6-6 6 6 6"/>'),
  download: wrap('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>'),
  upload: wrap('<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M4 21h16"/>'),
  refresh: wrap('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>'),
  user: wrap('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/>'),
  users: wrap('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1.2-3.4 4-5 6.5-5s5.3 1.6 6.5 5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M17.5 15.4c2 .7 3.4 2.2 4 4.6"/>'),
  plus: wrap('<path d="M12 5v14M5 12h14"/>'),
  x: wrap('<path d="M6 6l12 12M18 6 6 18"/>'),
  play: wrap('<path d="M7 4.5v15l12-7.5Z"/>'),
  stop: wrap('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
  skip: wrap('<path d="M5 5v14l8-7Z"/><path d="M17 5v14"/>'),
  eye: wrap('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'),
};
