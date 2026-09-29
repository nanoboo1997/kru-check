/* ============================================================
 * Kru Check — Mock repositories (in-memory)
 * ใช้สำหรับทดลอง UI เท่านั้น — ถอดออกได้โดยไม่แตะ pages
 * ============================================================ */
import {
  ClassRepository, StudentRepository, ExamRepository, AnswerKeyRepository,
  ResultRepository, ReviewRepository, TeacherRepository, SyncRepository,
} from './interfaces.js';
import { buildMockData } from './mockData.js';

const seed = buildMockData();
const clone = (v) => JSON.parse(JSON.stringify(v));

class MockBase {
  constructor(rows) { this.rows = clone(rows); }
  async list() { return clone(this.rows); }
  async get(id) { return clone(this.rows.find((r) => r.id === id) ?? null); }
  async save(item) {
    const i = this.rows.findIndex((r) => r.id === item.id);
    const copy = clone(item);
    if (i >= 0) this.rows[i] = copy; else this.rows.push(copy);
    return clone(copy);
  }
  async remove(id) { this.rows = this.rows.filter((r) => r.id !== id); }
}

export class MockTeacherRepository extends TeacherRepository {
  constructor() { super(); this.base = new MockBase(seed.teachers); }
  list() { return this.base.list(); }
  get(id) { return this.base.get(id); }
  save(i) { return this.base.save(i); }
  remove(id) { return this.base.remove(id); }
}

export class MockClassRepository extends ClassRepository {
  constructor() { super(); this.base = new MockBase(seed.classes); }
  list() { return this.base.list(); }
  get(id) { return this.base.get(id); }
  save(i) { return this.base.save(i); }
  remove(id) { return this.base.remove(id); }
}

export class MockStudentRepository extends StudentRepository {
  constructor() { super(); this.base = new MockBase(seed.students); }
  list() { return this.base.list(); }
  get(id) { return this.base.get(id); }
  save(i) { return this.base.save(i); }
  remove(id) { return this.base.remove(id); }
  async listByClass(classId) {
    return clone(this.base.rows.filter((s) => s.classId === classId).sort((a, b) => a.no - b.no));
  }
}

export class MockExamRepository extends ExamRepository {
  constructor() { super(); this.base = new MockBase(seed.exams); }
  list() { return this.base.list(); }
  get(id) { return this.base.get(id); }
  save(i) { return this.base.save(i); }
  remove(id) { return this.base.remove(id); }
}

export class MockAnswerKeyRepository extends AnswerKeyRepository {
  constructor() { super(); this.base = new MockBase(seed.answerKeys); }
  list() { return this.base.list(); }
  get(id) { return this.base.get(id); }
  save(i) { return this.base.save(i); }
  remove(id) { return this.base.remove(id); }
  async getByExam(examId) {
    return clone(this.base.rows.find((k) => k.examId === examId) ?? null);
  }
}

export class MockResultRepository extends ResultRepository {
  constructor() { super(); this.base = new MockBase(seed.results); }
  list() { return this.base.list(); }
  get(id) { return this.base.get(id); }
  save(i) { return this.base.save(i); }
  remove(id) { return this.base.remove(id); }
  async listByExam(examId) {
    return clone(this.base.rows.filter((r) => r.examId === examId));
  }
  async query({ classId, examId, date, reviewStatus } = {}) {
    return clone(this.base.rows.filter((r) => {
      if (classId && r.classId !== classId) return false;
      if (examId && r.examId !== examId) return false;
      if (reviewStatus && r.reviewStatus !== reviewStatus) return false;
      if (date && !String(r.createdAt).startsWith(date)) return false;
      return true;
    }));
  }
}

export class MockReviewRepository extends ReviewRepository {
  constructor() { super(); this.base = new MockBase(seed.reviewQueue); }
  list() { return this.base.list(); }
  get(id) { return this.base.get(id); }
  save(i) { return this.base.save(i); }
  remove(id) { return this.base.remove(id); }
  async pending() { return clone(this.base.rows.filter((r) => r.status === 'pending')); }
  async listByResult(resultId) {
    return clone(this.base.rows.filter((r) => r.resultId === resultId));
  }
}

export class MockSyncRepository extends SyncRepository {
  constructor() {
    super();
    this.ops = clone(seed.syncQueue).map((o, i) => ({ id: i + 1, ...o }));
    this.meta = {};
    this.nextId = this.ops.length + 1;
  }
  async enqueue(op) {
    const row = { id: this.nextId++, status: 'pending', attempts: 0, createdAt: new Date().toISOString(), ...op };
    this.ops.push(row);
    return clone(row);
  }
  async pending() { return clone(this.ops.filter((o) => o.status === 'pending')); }
  async failed() { return clone(this.ops.filter((o) => o.status === 'failed')); }
  async markDone(id) { const o = this.ops.find((x) => x.id === id); if (o) o.status = 'done'; }
  async markFailed(id, error) {
    const o = this.ops.find((x) => x.id === id);
    if (o) { o.status = 'failed'; o.attempts += 1; o.error = String(error); }
  }
  async requeue(id) {
    const o = this.ops.find((x) => x.id === id);
    if (o) { o.status = 'pending'; o.attempts = 0; delete o.error; }
  }
  async getMeta(key) { return this.meta[key] ?? null; }
  async setMeta(key, value) { this.meta[key] = value; }
}
