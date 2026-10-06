/* Local Review Queue. Confirmations update the saved result and score offline. */
import { stickySheetPreviewHTML, bindStickySheet, overlayLegendHTML } from '../components/StickySheetPreview.js';
import { reviewCardHTML } from '../components/ReviewCard.js';
import { resolveLocalReview } from '../services/singlePhotoService.js';

const SHEET_WIDTH = 1000;
const SHEET_HEIGHT = 1414;

function marksFor(result, questionNo) {
  return (result?.overlayData || []).map((mark) => ({
    x: mark.x / SHEET_WIDTH * 100,
    y: mark.y / SHEET_HEIGHT * 100,
    w: mark.w / SHEET_WIDTH * 100,
    h: mark.h / SHEET_HEIGHT * 100,
    state: mark.questionNo === questionNo ? 'orange' : mark.state,
  }));
}

async function contextFor(repos, item) {
  const result = await repos.results.get(item.resultId);
  return { result, marks: marksFor(result, item.questionNo) };
}

export async function render({ repos }) {
  const pending = await repos.reviews.pending();
  if (!pending.length) return `
    <div class="page-title"><h1>รอตรวจทาน</h1></div>
    <div class="empty"><div style="font-size:40px;">✓</div><p><strong>ไม่มีข้อรอตรวจทาน</strong></p>
    <p class="small">ข้อที่ OMR ไม่มั่นใจจะปรากฏที่นี่</p></div>`;
  const item = pending[0];
  const { marks } = await contextFor(repos, item);
  return `
  <div class="page-title"><h1>รอตรวจทาน</h1></div>
  <p class="page-sub">เหลือ ${pending.length} ข้อที่ต้องการครูช่วยยืนยัน</p>
  <div class="review-layout">
    <div>
      ${stickySheetPreviewHTML({ imageUrl: 'assets/sheet-placeholder.svg', questionNo: item.questionNo, marks })}
      ${overlayLegendHTML()}
    </div>
    <div id="review-card-slot">${reviewCardHTML({ ...item, imageUrl: 'assets/sheet-placeholder.svg' })}</div>
  </div>`;
}

export async function bind(root, { repos, store }) {
  const sticky = bindStickySheet(root);
  const slot = root.querySelector('#review-card-slot');
  if (!slot) return undefined;
  let previewUrl = null;
  let picked = null;
  let currentId = slot.querySelector('[data-review-card]')?.dataset.reviewCard;

  const installImage = async (item) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    const result = await repos.results.get(item.resultId);
    if (result?.normalizedImageBlob instanceof Blob) previewUrl = URL.createObjectURL(result.normalizedImageBlob);
    const url = previewUrl || 'assets/sheet-placeholder.svg';
    sticky.setImage(url);
    const cardImage = slot.querySelector('img');
    if (cardImage) cardImage.src = url;
    sticky.setQuestion(item.questionNo, marksFor(result, item.questionNo));
  };
  const first = await repos.reviews.get(currentId);
  if (first) await installImage(first);

  slot.addEventListener('click', async (event) => {
    const pickButton = event.target.closest('[data-pick]');
    if (pickButton) {
      picked = pickButton.dataset.pick;
      slot.querySelectorAll('[data-pick]').forEach((button) => button.classList.toggle('choice--picked', button === pickButton));
      slot.querySelector('[data-confirm-review]').disabled = false;
      return;
    }
    if (!event.target.closest('[data-confirm-review]') || !picked || !currentId) return;
    const confirmButton = slot.querySelector('[data-confirm-review]');
    confirmButton.disabled = true;
    try {
      await resolveLocalReview({ repos, reviewId: currentId, choice: picked });
      store.emit('connectivity');
      const pending = await repos.reviews.pending();
      if (!pending.length) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
        root.innerHTML = `<div class="page-title"><h1>รอตรวจทาน</h1></div>
          <div class="empty"><div style="font-size:40px;">✓</div><p><strong>ตรวจทานครบทุกข้อแล้ว</strong></p>
          <p class="small">คะแนนถูกคำนวณใหม่และบันทึกในเครื่องแล้ว</p></div>`;
        return;
      }
      const next = pending[0];
      currentId = next.id;
      picked = null;
      slot.innerHTML = reviewCardHTML({ ...next, imageUrl: 'assets/sheet-placeholder.svg' });
      await installImage(next);
      const subtitle = root.querySelector('.page-sub');
      if (subtitle) subtitle.textContent = `เหลือ ${pending.length} ข้อที่ต้องการครูช่วยยืนยัน`;
    } catch (error) {
      console.error('[Review Queue Offline] confirmation failed', error);
      confirmButton.disabled = false;
      confirmButton.insertAdjacentHTML('afterend', `<div class="dev-note">บันทึกคำยืนยันไม่สำเร็จ</div>`);
    }
  });
  return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
}
