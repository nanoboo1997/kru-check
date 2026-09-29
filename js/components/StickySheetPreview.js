/* ============================================================
 * Kru Check — StickySheetPreview component
 *
 * ภาพกระดาษคำตอบอ้างอิง + overlay อยู่ใน "visual stage เดียวกัน"
 * (.sheet-stage__zoom) — ซูม/แพนขยับพร้อมกันเสมอ
 * บนมือถือ: เลื่อนลงแล้วกลายเป็น sticky preview ด้านบน
 *
 * overlay marks: [{ x, y, w, h, state }] หน่วย % ของภาพ
 *  state: green | red | yellow | purple | orange(current)
 * ============================================================ */

export function stickySheetPreviewHTML({ imageUrl, questionNo, marks = [], zoom = 1 } = {}) {
  const marksHTML = marks.map((m) =>
    `<span class="mark mark--${m.state}" style="left:${m.x}%;top:${m.y}%;width:${m.w}%;height:${m.h}%;"></span>`
  ).join('');
  return `
  <div class="sheet-stage">
    <div class="sheet-stage__sticky" data-sheet-sticky>
      <div class="sheet-caption" data-sheet-caption>กำลังตรวจข้อ ${questionNo ?? '—'}</div>
      <div class="sheet-stage__viewport" data-sheet-viewport>
        <div class="sheet-stage__zoom" data-sheet-zoom style="transform:scale(${zoom});">
          <img class="sheet" src="${imageUrl}" alt="กระดาษคำตอบอ้างอิง" draggable="false" />
          <div class="sheet-overlay" data-sheet-overlay>${marksHTML}</div>
        </div>
      </div>
      <div class="sheet-toolbar">
        <button class="btn btn--secondary btn--sm" data-sheet-zoom-out>ย่อ</button>
        <button class="btn btn--secondary btn--sm" data-sheet-zoom-in>ขยาย</button>
        <button class="btn btn--ghost btn--sm" data-sheet-toggle>ซ่อนภาพ</button>
      </div>
    </div>
  </div>`;
}

export function bindStickySheet(root, { imageUrl, marks = [] } = {}) {
  let zoom = 1;
  let hidden = false;
  const zoomEl = root.querySelector('[data-sheet-zoom]');
  const viewport = root.querySelector('[data-sheet-viewport]');
  const toggleBtn = root.querySelector('[data-sheet-toggle]');

  root.querySelector('[data-sheet-zoom-in]').addEventListener('click', () => {
    zoom = Math.min(3, +(zoom + 0.25).toFixed(2));
    zoomEl.style.transform = `scale(${zoom})`;
  });
  root.querySelector('[data-sheet-zoom-out]').addEventListener('click', () => {
    zoom = Math.max(1, +(zoom - 0.25).toFixed(2));
    zoomEl.style.transform = `scale(${zoom})`;
  });
  toggleBtn.addEventListener('click', () => {
    hidden = !hidden;
    viewport.style.display = hidden ? 'none' : 'block';
    toggleBtn.textContent = hidden ? 'แสดงภาพ' : 'ซ่อนภาพ';
  });
  return {
    setQuestion(no, nextMarks = marks) {
      const cap = root.querySelector('[data-sheet-caption]');
      if (cap) cap.textContent = `กำลังตรวจข้อ ${no}`;
      const ov = root.querySelector('[data-sheet-overlay]');
      if (ov) {
        ov.innerHTML = nextMarks.map((m) =>
          `<span class="mark mark--${m.state}" style="left:${m.x}%;top:${m.y}%;width:${m.w}%;height:${m.h}%;"></span>`
        ).join('');
      }
    },
  };
}

/** คำอธิบายสี overlay (legend) */
export function overlayLegendHTML() {
  const items = [
    ['#2fa968', 'ตอบถูก'],
    ['#d64545', 'ตอบผิด'],
    ['#d9931c', 'ไม่มั่นใจ'],
    ['#8b5cf6', 'หลายคำตอบ/แก้คำตอบ'],
    ['#f97316', 'ข้อปัจจุบัน'],
  ];
  return `<div class="legend">${items.map(([c, t]) => `<span><i style="background:${c};"></i>${t}</span>`).join('')}</div>`;
}
