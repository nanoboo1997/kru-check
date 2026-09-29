/* ============================================================
 * Kru Check — IndexedDB repositories (production data layer)
 *
 * เปิดใช้งานโดยตั้ง config.dataMode = 'indexeddb'
 * implement interface เดียวกับ mock — หน้า UI ไม่ต้องเปลี่ยน
 * ============================================================ */
import {
  ClassRepository, StudentRepository, ExamRepository, AnswerKeyRepository,
  ResultRepository, ReviewRepository, TeacherRepository, SyncRepository,
} from './interfaces.js';
import { IDBStore } from '../core/db.js';

class IDBBase {
  constructor(storeName) { this.store = new IDBStore(storeName); }
  list() { return this.store.list(); }
  get(id) { return this.store.get(id); }
  save(item) { return this.store.put(item); }
  remove(id) { return this.store.remove(id); }
}

export class IDBTeacherRepository extends TeacherRepository {
  constructor() { super(); this.base = new IDBBase('teachers'); }
  list() { return this.base.list(); }
  get(id) { return this.base.get(id); }
  save(i) { return this.base.save(i); }
  remove(id) { return this.base.remove(id); }
}

export class IDBClassRepository extends ClassRepository {
  constructor() { super(); this.base = new IDBBase('classes'); }
  list() { return this.base.list(); }
  get(id) { return this.base.get(id); }
  save(i) { return this.base.save(i); }
  remove(id) { return this.base.remove(id); }
}

export class IDBStudentRepository extends StudentRepository {
  constructor() { super(); this.base = new IDBBase('students'); }
  list() { return this.base.list(); }
  get(id) { return this.base.get(id); }
  save(i) { return this.base.save(i); }
  remove(id) { return this.base.remove(id); }
  listByClass(classId) { return this.base.store.byIndex('classId', classId); }
}

export class IDBExamRepository extends ExamRepository {
  constructor() { super(); this.base = new IDBBase('exams'); }
  list() { return this.base.list(); }
  get(id) { return this.base.get(id); }
  save(i) { return this.base.save(i); }
  remove(id) { return this.base.remove(id); }
}

export class IDBAnswerKeyRepository extends AnswerKeyRepository {
  constructor() { super(); this.base = new IDBBase('answerKeys'); }
  list() { return this.base.list(); }
  get(id) { return this.base.get(id); }
  save(i) { return this.base.save(i); }
  remove(id) { return this.base.remove(id); }
  async getByExam(examId) {
    const rows = await this.base.store.byIndex('examId', examId);
    return rows[0] ?? null;
  }
}

export class IDBResultRepository extends ResultRepository {
  constructor() { super(); this.base = new IDBBase('results'); }
  list() { return this.base.list(); }
  get(id) { return this.base.get(id); }
  save(i) { return this.base.save(i); }
  remove(id) { return this.base.remove(id); }
  listByExam(examId) { return this.base.store.byIndex('examId', examId); }
  async query({ classId, examId, date, reviewStatus } = {}) {
    // เลือก index ที่เจาะจงที่สุดก่อน แล้วกรองที่เหลือใน memory
    let rows = examId
      ? await this.base.store.byIndex('examId', examId)
      : await this.base.list();
    return rows.filter((r) => {
      if (classId && r.classId !== classId) return false;
      if (reviewStatus && r.reviewStatus !== reviewStatus) return false;
      if (date && !String(r.createdAt).startsWith(date)) return false;
      return true;
    });
  }
}

export class IDBReviewRepository extends ReviewRepository {
  constructor() { super(); this.base = new IDBBase('reviewQueue'); }
  list() { return this.base.list(); }
  get(id) { return this.base.get(id); }
  save(i) { return this.base.save(i); }
  remove(id) { return this.base.remove(id); }
  pending() { return this.base.store.byIndex('status', 'pending'); }
  listByResult(resultId) { return this.base.store.byIndex('resultId', resultId); }
}

export class IDBSyncRepository extends SyncRepository {
  constructor() { super(); this.ops = new IDBStore('syncQueue'); this.metaStore = new IDBStore('meta'); }
  enqueue(op) {
    return this.ops.add({ status: 'pending', attempts: 0, createdAt: new Date().toISOString(), ...op });
  }
  pending() { return this.ops.byIndex('status', 'pending'); }
  failed() { return this.ops.byIndex('status', 'failed'); }
  async markDone(id) {
    const o = await this.ops.get(id);
    if (o) await this.ops.put({ ...o, status: 'done' });
  }
  async markFailed(id, error) {
    const o = await this.ops.get(id);
    if (o) await this.ops.put({ ...o, status: 'failed', attempts: (o.attempts || 0) + 1, error: String(error) });
  }
  async requeue(id) {
    const o = await this.ops.get(id);
    if (o) { const { error, ...rest } = o; await this.ops.put({ ...rest, status: 'pending', attempts: 0 }); }
  }
  async getMeta(key) { const row = await this.metaStore.get(key); return row ? row.value : null; }
  async setMeta(key, value) { await this.metaStore.put({ key, value }); }
}
