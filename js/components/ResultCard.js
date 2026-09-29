/* Kru Check — ResultCard component */
export function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return String(iso); }
}

export function reviewBadge(status) {
  if (status === 'pending') return '<span class="badge badge--warn">รอตรวจทาน</span>';
  if (status === 'done') return '<span class="badge badge--ok">ตรวจทานแล้ว</span>';
  return '<span class="badge">ปกติ</span>';
}

/**
 * การ์ดผลตรวจ 1 ใบ: นักเรียน / ห้อง / ข้อสอบ / คะแนน / ร้อยละ / สถานะ / วันที่
 */
export function resultCardHTML(r, { studentName = 'ไม่ระบุนักเรียน', className = '—', examName = '—' } = {}) {
  const pct = r.fullScore ? Math.round((r.score / r.fullScore) * 100) : 0;
  return `
  <div class="card card--tap" data-result="${r.id}">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
      <div>
        <div class="card-title">${studentName}</div>
        <div class="card-sub">${className} · ${examName}</div>
      </div>
      ${reviewBadge(r.reviewStatus)}
    </div>
    <div class="kv" style="margin-top:8px;"><span>คะแนน</span><b>${r.score} / ${r.fullScore}</b></div>
    <div class="kv"><span>ร้อยละ</span><b>${pct}%</b></div>
    <div class="kv"><span>วันที่ตรวจ</span><span class="muted">${fmtDate(r.createdAt)}</span></div>
    <div class="progress" style="margin-top:8px;"><i style="width:${pct}%;"></i></div>
  </div>`;
}
