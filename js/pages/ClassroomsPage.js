/* Kru Check — ห้องเรียน (classroom cards) */
export async function render({ repos }) {
  const [classes, students] = await Promise.all([repos.classes.list(), repos.students.list()]);
  const countBy = {};
  students.forEach((s) => { countBy[s.classId] = (countBy[s.classId] || 0) + 1; });
  const cards = classes.map((c) => `
    <a class="card card--tap" href="#/classrooms/${c.id}" style="text-decoration:none;color:inherit;display:block;margin-bottom:12px;">
      <div class="card-title" style="font-size:20px;">${c.name}</div>
      <div class="card-sub">นักเรียน ${countBy[c.id] || 0} คน</div>
    </a>`).join('');
  return `
  <div class="page-title"><h1>ห้องเรียน</h1></div>
  <p class="page-sub">แตะที่ห้องเพื่อดูรายชื่อนักเรียน</p>
  ${cards || '<div class="empty">ยังไม่มีห้องเรียน</div>'}`;
}
