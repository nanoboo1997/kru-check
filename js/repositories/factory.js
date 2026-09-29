/* ============================================================
 * Kru Check — repository factory
 * เลือก implementation ตาม config.dataMode โดย UI ไม่ต้องรู้
 * ============================================================ */
import {
  MockTeacherRepository, MockClassRepository, MockStudentRepository,
  MockExamRepository, MockAnswerKeyRepository, MockResultRepository,
  MockReviewRepository, MockSyncRepository,
} from './mockRepositories.js';
import {
  IDBTeacherRepository, IDBClassRepository, IDBStudentRepository,
  IDBExamRepository, IDBAnswerKeyRepository, IDBResultRepository,
  IDBReviewRepository, IDBSyncRepository,
} from './idbRepositories.js';

export function createRepositories(mode = 'mock') {
  if (mode === 'indexeddb') {
    return {
      teachers: new IDBTeacherRepository(),
      classes: new IDBClassRepository(),
      students: new IDBStudentRepository(),
      exams: new IDBExamRepository(),
      answerKeys: new IDBAnswerKeyRepository(),
      results: new IDBResultRepository(),
      reviews: new IDBReviewRepository(),
      sync: new IDBSyncRepository(),
    };
  }
  // default: mock (สำหรับทดลอง UI)
  return {
    teachers: new MockTeacherRepository(),
    classes: new MockClassRepository(),
    students: new MockStudentRepository(),
    exams: new MockExamRepository(),
    answerKeys: new MockAnswerKeyRepository(),
    results: new MockResultRepository(),
    reviews: new MockReviewRepository(),
    sync: new MockSyncRepository(),
  };
}
