/* ============================================================
 * Kru Check — ScanStatus component
 * สถานะกล้องโหมดสแกนต่อเนื่อง (ข้อความตามสเปก)
 * ============================================================ */

export const SCAN_STATES = {
  idle: ['พร้อมสแกน', ''],
  searching: ['กำลังหากระดาษ', 'status-pill--search'],
  found: ['พบกระดาษแล้ว', 'status-pill--found'],
  hold: ['ถือไว้นิดเดียว', 'status-pill--busy'],
  processing: ['กำลังตรวจ...', 'status-pill--busy'],
  done: ['ตรวจแล้ว', 'status-pill--found'],
  remove: ['นำกระดาษแผ่นเดิมออก', 'status-pill--search'],
  stopped: ['หยุดสแกนแล้ว', ''],
};

export function scanStatusHTML(state = 'idle', id = 'scan-status') {
  const [text, cls] = SCAN_STATES[state] || SCAN_STATES.idle;
  return `<div class="center" style="margin:10px 0;">
    <span class="status-pill ${cls}" id="${id}" data-scan-state="${state}">
      <span class="dot"></span><span data-scan-text>${text}</span>
    </span></div>`;
}

export function setScanState(root, state, id = 'scan-status') {
  const el = root.querySelector('#' + id) || root.querySelector('[data-scan-state]');
  if (!el) return;
  const [text, cls] = SCAN_STATES[state] || SCAN_STATES.idle;
  el.className = 'status-pill ' + cls;
  el.dataset.scanState = state;
  const t = el.querySelector('[data-scan-text]');
  if (t) t.textContent = text;
}
