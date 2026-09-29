/* ============================================================
 * Kru Check — ReviewCard component
 * การ์ดตรวจทาน 1 ข้อ: ภาพช่องคำตอบ + ตัวเลือกของครู
 * ============================================================ */

export const REVIEW_CHOICES = ['ก', 'ข', 'ค', 'ง', 'ไม่ตอบ', 'หลายคำตอบ'];

export function reviewCardHTML(item, picked = null) {
  const choices = REVIEW_CHOICES.map((c) => {
    const wide = c === 'ไม่ตอบ' || c === 'หลายคำตอบ' ? 'choice--wide' : '';
    const on = picked === c ? 'choice--picked' : '';
    return `<button class="choice ${wide} ${on}" data-pick="${c}">${c}</button>`;
  }).join('');
  return `
  <div class="card" data-review-card="${item.id}">
    <div class="review-question">ข้อ ${item.questionNo}</div>
    <p class="center small muted">ภาพช่องคำตอบที่ OMR ไม่มั่นใจ</p>
    <div class="center" style="margin:8px 0;">
      <img src="${item.imageUrl}" alt="ภาพช่องคำตอบข้อ ${item.questionNo}"
           style="width:120px;border-radius:12px;border:2px solid var(--line);" />
    </div>
    <div class="choices">${choices}</div>
    <div style="margin-top:14px;">
      <button class="btn btn--block" data-confirm-review ${picked ? '' : 'disabled'}>ยืนยันและข้อต่อไป</button>
    </div>
  </div>`;
}
