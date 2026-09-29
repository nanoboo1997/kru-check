/* ============================================================
 * Kru Check — selectors: ClassSelector / StudentSelector / ExamSelector
 * ใช้ <select> ธรรมดา — touch target 44px+, ทำงานออฟไลน์ได้
 * ============================================================ */

export function classSelectHTML(classes, selectedId = '', id = 'f-class') {
  const opts = [`<option value="">— เลือกห้องเรียน —</option>`]
    .concat(classes.map((c) => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.name}</option>`))
    .join('');
  return `<div class="field"><label for="${id}">ห้องเรียน</label><select class="select" id="${id}">${opts}</select></div>`;
}

/**
 * dropdown นักเรียนแสดงเฉพาะนักเรียนในห้องที่เลือก
 * includeUnknown = true → มีตัวเลือก "ไม่ระบุนักเรียน"
 */
export function studentSelectHTML(students, selectedId = '', id = 'f-student', includeUnknown = true) {
  const unknown = includeUnknown ? `<option value="__unknown__">ไม่ระบุนักเรียน</option>` : '';
  const opts = [`<option value="">— เลือกนักเรียน —</option>`, unknown]
    .concat(students.map((s) => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${s.no}. ${s.firstName} ${s.lastName}</option>`))
    .join('');
  return `<div class="field"><label for="${id}">นักเรียน</label><select class="select" id="${id}">${opts}</select></div>`;
}

export function examSelectHTML(exams, selectedId = '', id = 'f-exam') {
  const opts = [`<option value="">— เลือกข้อสอบ —</option>`]
    .concat(exams.map((e) => `<option value="${e.id}" ${e.id === selectedId ? 'selected' : ''}>${e.name} (${e.questionCount} ข้อ)</option>`))
    .join('');
  return `<div class="field"><label for="${id}">ข้อสอบ</label><select class="select" id="${id}">${opts}</select></div>`;
}
