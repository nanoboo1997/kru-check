/* ============================================================
 * Kru Check — รอตรวจทาน (review queue)
 * แสดงเฉพาะข้อที่ OMR ไม่มั่นใจ + sticky ภาพอ้างอิงด้านบน
 * ============================================================ */
import { stickySheetPreviewHTML, bindStickySheet, overlayLegendHTML } from '../components/StickySheetPreview.js';
import { reviewCardHTML } from '../components/ReviewCard.js';

/** overlay สมมุติสำหรับ preview (หน่วย % ของภาพ — ขยับพร้อมภาพเสมอ) */
function demoMarks(questionNo) {
  return [
    { x: 18, y: 30, w: 64, h: 8, state: 'green' },
    { x: 18, y: 42, w: 64, h: 8, state: 'red' },
    { x: 18, y: 54, w: 64, h: 8, state: 'yellow' },
    // ข้อปัจจุบัน: orange
    { x: 14, y: 24 + ((questionNo % 10) * 6), w: 72, h: 10, state: 'orange' },
  ];
}

export async function render({ repos }) {
  const pending = await repos.reviews.pending();
  if (!pending.length) {
    return `
    <div class="page-title"><h1>รอตรวจทาน</h1></div>
    <div class="empty"><div style="font-size:40px;">✓</div><p><strong>ไม่มีข้อรอตรวจทาน</strong></p>
    <p class="small">ข้อที่ OMR ไม่มั่นใจจะมาปรากฏที่นี่ให้ครูช่วยยืนยัน</p></div>`;
  }
  const item = pending[0];
  return `
  <div class="page-title"><h1>รอตรวจทาน</h1></div>
  <p class="page-sub">เหลือ ${pending.length} ข้อที่ต้องการครูช่วยยืนยัน</p>

  <div class="review-layout">
    <div>
      ${stickySheetPreviewHTML({ imageUrl: item.imageUrl, questionNo: item.questionNo, marks: demoMarks(item.questionNo) })}
      ${overlayLegendHTML()}
    </div>
    <div id="review-card-slot">${reviewCardHTML(item)}</div>
  </div>`;
}

export async function bind(root, { repos, store }) {
  const sticky = bindStickySheet(root);
  const slot = root.querySelector('#review-card-slot');
  if (!slot) return;

  let picked = null;
  let currentId = slot.querySelector('[data-review-card]')?.dataset.reviewCard;

  slot.addEventListener('click', async (e) => {
    const pickBtn = e.target.closest('[data-pick]');
    if (pickBtn) {
      picked = pickBtn.dataset.pick;
      slot.querySelectorAll('[data-pick]').forEach((b) =>
        b.classList.toggle('choice--picked', b === pickBtn));
      slot.querySelector('[data-confirm-review]').disabled = false;
      return;
    }
    if (e.target.closest('[data-confirm-review]')) {
      if (!picked || !currentId) return;
      // บันทึกผลการตรวจทาน + เข้าคิวซิงก์
      const item = await repos.reviews.get(currentId);
      await repos.reviews.save({ ...item, status: 'done', resolvedAs: picked });
      await repos.sync.enqueue({ type: 'upsert', store: 'reviewQueue', payload: { id: currentId } });
      store.emit('connectivity');

      const pending = await repos.reviews.pending();
      if (!pending.length) {
        root.querySelector('#view, .page').innerHTML = `
          <div class="page-title"><h1>รอตรวจทาน</h1></div>
          <div class="empty"><div style="font-size:40px;">✓</div>
          <p><strong>ตรวจทานครบทุกข้อแล้ว</strong></p></div>`;
        return;
      }
      const next = pending[0];
      currentId = next.id;
      picked = null;
      sticky.setQuestion(next.questionNo, demoMarks(next.questionNo));
      slot.innerHTML = reviewCardHTML(next);
      const sub = root.querySelector('.page-sub');
      if (sub) sub.textContent = `เหลือ ${pending.length} ข้อที่ต้องการครูช่วยยืนยัน`;
    }
  });
}
