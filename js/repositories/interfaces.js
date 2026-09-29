/* ============================================================
 * Kru Check — repository interfaces (contract)
 *
 * ทุก repository ต้อง implement method พวกนี้ ไม่ว่าจะเก็บข้อมูล
 * ไว้ที่ไหน (memory mock / IndexedDB / GAS ผ่าน sync)
 * หน้า UI เรียกผ่าน interface นี้เท่านั้น — ห้ามเรียก IndexedDB ตรง
 *
 * Data models:
 *  Teacher   { id, name, email }
 *  Class     { id, name, teacherId }
 *  Student   { id, classId, no, code, firstName, lastName }
 *  Exam      { id, name, questionCount, fullScore, createdAt }
 *  AnswerKey { id, examId, answers: ['ก'|'ข'|'ค'|'ง', ...] }
 *  Result    { id, examId, classId, studentId|null, score, fullScore,
 *              answers, reviewStatus: 'none'|'pending'|'done',
 *              createdAt, updatedAt }
 *  ReviewItem{ id, resultId, examId, questionNo, imageUrl,
 *              candidates: ['ก','ข','ค','ง'], status: 'pending'|'done',
 *              resolvedAs }
 *  SyncOp    { id?, type: 'upsert', store: string, payload, status:
 *              'pending'|'done'|'failed', attempts, error?, createdAt }
 * ============================================================ */

export class BaseRepository {
  async list() { throw new Error('not implemented'); }
  async get(id) { throw new Error('not implemented'); }
  async save(item) { throw new Error('not implemented'); } // upsert
  async remove(id) { throw new Error('not implemented'); }
}

export class ClassRepository extends BaseRepository {}
export class StudentRepository extends BaseRepository {
  async listByClass(classId) { throw new Error('not implemented'); }
}
export class ExamRepository extends BaseRepository {}
export class AnswerKeyRepository extends BaseRepository {
  async getByExam(examId) { throw new Error('not implemented'); }
}
export class ResultRepository extends BaseRepository {
  /** filter: { classId?, examId?, date?, reviewStatus? } */
  async query(filter) { throw new Error('not implemented'); }
  async listByExam(examId) { throw new Error('not implemented'); }
}
export class ReviewRepository extends BaseRepository {
  async pending() { throw new Error('not implemented'); }
  async listByResult(resultId) { throw new Error('not implemented'); }
}
export class TeacherRepository extends BaseRepository {}
export class SyncRepository {
  async enqueue(op) { throw new Error('not implemented'); }
  async pending() { throw new Error('not implemented'); }
  async failed() { throw new Error('not implemented'); }
  async markDone(id, ack) { throw new Error('not implemented'); }
  async markFailed(id, error) { throw new Error('not implemented'); }
  async requeue(id) { throw new Error('not implemented'); }
  async getMeta(key) { throw new Error('not implemented'); }
  async setMeta(key, value) { throw new Error('not implemented'); }
}
