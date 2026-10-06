/* ============================================================
 * Kru Check — IndexedDB layer (local database)
 *
 * - เก็บข้อมูลทั้งหมดบนอุปกรณ์ (offline-first)
 * - หน้า UI ทั้งหมด "ห้าม" เรียก indexedDB ตรง ๆ
 *   ให้เรียกผ่าน repository layer (js/repositories/*) เท่านั้น
 * - Schema ตรงกับ architecture ที่ออกแบบไว้:
 *   Teachers / Classes / Students / Exams / Answer Keys /
 *   Results / Review Queue / Sync Queue
 * ============================================================ */

export const DB_NAME = 'kru-check-db';
const DB_VERSION = 1;

/** store name -> [options, indexes] */
const SCHEMA = {
  teachers: [{ keyPath: 'id' }, []],
  classes: [{ keyPath: 'id' }, []],
  students: [{ keyPath: 'id' }, [['classId', 'classId', { unique: false }]]],
  exams: [{ keyPath: 'id' }, []],
  answerKeys: [{ keyPath: 'id' }, [['examId', 'examId', { unique: true }]]],
  results: [
    { keyPath: 'id' },
    [
      ['examId', 'examId', { unique: false }],
      ['studentId', 'studentId', { unique: false }],
      ['classId', 'classId', { unique: false }],
      ['updatedAt', 'updatedAt', { unique: false }],
    ],
  ],
  reviewQueue: [
    { keyPath: 'id' },
    [
      ['resultId', 'resultId', { unique: false }],
      ['status', 'status', { unique: false }],
    ],
  ],
  // คิวงานรอซิงก์ขึ้น cloud (GAS) เมื่อกลับมาออนไลน์
  syncQueue: [{ keyPath: 'id', autoIncrement: true }, [['status', 'status', { unique: false }]]],
  // key-value สำหรับ lastSync, deviceId ฯลฯ
  meta: [{ keyPath: 'key' }, []],
};

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('เบราว์เซอร์นี้ไม่รองรับ IndexedDB'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, [opts, indexes]] of Object.entries(SCHEMA)) {
        if (db.objectStoreNames.contains(name)) continue;
        const store = db.createObjectStore(name, opts);
        for (const [idxName, keyPath, idxOpts] of indexes) {
          store.createIndex(idxName, keyPath, idxOpts);
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** Generic async wrapper รอบ object store หนึ่งตัว */
export class IDBStore {
  constructor(storeName) {
    this.storeName = storeName;
  }
  async _tx(mode, fn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, mode);
      const store = tx.objectStore(this.storeName);
      let request;
      let result;
      try {
        request = fn(store);
      } catch (err) {
        reject(err);
        return;
      }
      if (request) {
        request.onsuccess = () => { result = request.result ?? null; };
        request.onerror = () => reject(request.error);
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  list() {
    return this._tx('readonly', (s) => s.getAll());
  }
  get(id) {
    return this._tx('readonly', (s) => s.get(id));
  }
  put(item) {
    return this._tx('readwrite', (s) => s.put(item));
  }
  add(item) {
    return this._tx('readwrite', (s) => s.add(item));
  }
  remove(id) {
    return this._tx('readwrite', (s) => s.delete(id)).then(() => true);
  }
  clear() {
    return this._tx('readwrite', (s) => s.clear()).then(() => true);
  }
  byIndex(indexName, value) {
    return this._tx('readonly', (s) => s.index(indexName).getAll(value));
  }
}

/** ประมาณพื้นที่จัดเก็บที่ใช้ไป (หน้า "ข้อมูลออฟไลน์") */
export async function estimateStorage() {
  try {
    if (navigator.storage?.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usage, quota };
    }
  } catch {
    /* ignore */
  }
  return { usage: 0, quota: 0 };
}
