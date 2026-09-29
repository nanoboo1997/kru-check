/* ============================================================
 * Kru Check — MOCK DATA (ข้อมูลสมมุติสำหรับทดลอง UI เท่านั้น)
 *
 * กฎ:
 *  - ห้ามใส่ข้อมูลนักเรียนจริง / รหัสผ่านจริง / API key จริง
 *  - ไฟล์นี้แยกจาก production data layer ชัดเจน
 *    ถอดออกได้ทันทีโดยลบไฟล์นี้ + mockRepositories.js
 *    แล้วสลับ config.dataMode เป็น 'indexeddb'
 * ============================================================ */

const FIRST = ['ก้องเกียรติ','สุดารัตน์','ธนพล','พรทิพย์','วีรภัทร','กัญญารัตน์','อาทิตย์','มณีรัตน์','พงศธร','จิราพร','ณัฐวุฒิ','อรอนงค์','สิทธิชัย','วราภรณ์','ชาญชัย','นฤมล','ปิยะพงษ์','สุภาพร','เกียรติศักดิ์','ดวงใจ'];
const LAST = ['ใจดี','รักเรียน','ทองสุข','ศรีสวัสดิ์','พูลสวัสดิ์','แก้วมณี','สุขสันต์','มีชัย','แสงทอง','บุญนำ','วงศ์สว่าง','เพชรรัตน์','อินทร์แปลง','คงคา','นาคินทร์'];
const CHOICES = ['ก','ข','ค','ง'];

function rng(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

export function buildMockData() {
  const rand = rng(42);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  const teachers = [{ id: 't1', name: 'ครูตัวอย่าง', email: 'teacher@example.com' }];

  const classDefs = [
    { id: 'c41', name: 'ม.4/1', size: 40 },
    { id: 'c42', name: 'ม.4/2', size: 38 },
    { id: 'c43', name: 'ม.4/3', size: 35 },
  ];
  const classes = classDefs.map((c) => ({ id: c.id, name: c.name, teacherId: 't1' }));

  const students = [];
  for (const c of classDefs) {
    const prefix = c.id === 'c41' ? '41' : c.id === 'c42' ? '42' : '43';
    for (let no = 1; no <= c.size; no++) {
      const code = `S${prefix}${String(no).padStart(2, '0')}`;
      students.push({
        id: `st-${c.id}-${no}`,
        classId: c.id,
        no,
        code,
        firstName: pick(FIRST),
        lastName: pick(LAST),
      });
    }
  }

  const exams = [
    { id: 'e1', name: 'สอบกลางภาค วิทยาศาสตร์', questionCount: 40, fullScore: 40, createdAt: '2026-09-10T08:00:00' },
    { id: 'e2', name: 'สอบย่อย คณิตศาสตร์', questionCount: 20, fullScore: 20, createdAt: '2026-09-18T08:00:00' },
    { id: 'e3', name: 'สอบปลายภาค ภาษาไทย', questionCount: 60, fullScore: 60, createdAt: '2026-09-25T08:00:00' },
  ];

  const answerKeys = exams.map((e) => ({
    id: `ak-${e.id}`,
    examId: e.id,
    answers: Array.from({ length: e.questionCount }, () => pick(CHOICES)),
  }));

  // ผลตรวจสมมุติ: นักเรียน 12 คนแรกของ ม.4/1 ในข้อสอบ e1
  const results = [];
  const key1 = answerKeys[0].answers;
  students.filter((s) => s.classId === 'c41').slice(0, 12).forEach((s, i) => {
    const answers = key1.map((k) => (rand() < 0.72 ? k : pick(CHOICES)));
    const score = answers.filter((a, qi) => a === key1[qi]).length;
    results.push({
      id: `r-${s.id}`,
      examId: 'e1',
      classId: 'c41',
      studentId: s.id,
      score,
      fullScore: 40,
      answers,
      reviewStatus: i % 4 === 0 ? 'pending' : 'none',
      createdAt: '2026-09-28T09:00:00',
      updatedAt: '2026-09-28T09:30:00',
    });
  });

  // คิวรอตรวจทานสมมุติ (ข้อที่ OMR ไม่มั่นใจ)
  const reviewQueue = [
    { id: 'rv1', resultId: 'r-st-c41-1', examId: 'e1', questionNo: 28, imageUrl: 'assets/sheet-placeholder.svg', candidates: CHOICES, status: 'pending', resolvedAs: null },
    { id: 'rv2', resultId: 'r-st-c41-1', examId: 'e1', questionNo: 31, imageUrl: 'assets/sheet-placeholder.svg', candidates: CHOICES, status: 'pending', resolvedAs: null },
    { id: 'rv3', resultId: 'r-st-c41-5', examId: 'e1', questionNo: 12, imageUrl: 'assets/sheet-placeholder.svg', candidates: CHOICES, status: 'pending', resolvedAs: null },
  ];

  // รายการรอซิงก์สมมุติ (สำหรับโชว์สถานะ 🟡)
  const syncQueue = [
    { type: 'upsert', store: 'results', payload: { id: 'r-st-c41-2' }, status: 'pending', attempts: 0, createdAt: new Date().toISOString() },
    { type: 'upsert', store: 'students', payload: { id: 'st-c41-40' }, status: 'pending', attempts: 0, createdAt: new Date().toISOString() },
  ];

  return { teachers, classes, students, exams, answerKeys, results, reviewQueue, syncQueue };
}
