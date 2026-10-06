/* Sanitized Phase 2 starter data. It contains no real teacher/student/result. */

const LETTERS = ['ก', 'ข', 'ค', 'ง'];

export async function ensureOfflineTestSeed(repos) {
  const alreadySeeded = await repos.sync.getMeta('phase2SafeSeed');
  if (alreadySeeded) return false;
  const [classes, exams] = await Promise.all([repos.classes.list(), repos.exams.list()]);
  if (!classes.length) {
    await repos.classes.save({ id: 'demo-c41', name: 'ห้องทดลอง ม.4/1', teacherId: null, source: 'safe-test-seed' });
    await repos.students.save({ id: 'demo-st-1', classId: 'demo-c41', no: 1, code: 'DEMO001', firstName: 'นักเรียน', lastName: 'ทดสอบ', source: 'safe-test-seed' });
    await repos.students.save({ id: 'demo-st-2', classId: 'demo-c41', no: 2, code: 'DEMO002', firstName: 'ตัวอย่าง', lastName: 'ออฟไลน์', source: 'safe-test-seed' });
  }
  if (!exams.length) {
    for (const count of [20, 40]) {
      const exam = {
        id: `demo-exam-${count}`, name: `ข้อสอบทดลอง ${count} ข้อ`, questionCount: count,
        fullScore: count, source: 'safe-test-seed', createdAt: '2026-01-01T00:00:00.000Z',
      };
      await repos.exams.save(exam);
      await repos.answerKeys.save({
        id: `demo-key-${count}`, examId: exam.id,
        answers: Array.from({ length: count }, (_, index) => LETTERS[index % 4]), source: 'safe-test-seed',
      });
    }
  }
  await repos.sync.setMeta('phase2SafeSeed', { version: 1, createdAt: new Date().toISOString() });
  return true;
}
