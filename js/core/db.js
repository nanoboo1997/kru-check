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

const DB_NAME = 'kru-check-db';
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
      let result;
      try {
        result = fn(store);
      } catch (err) {
        reject(err);
        return;
      }
      tx.oncomplete = () => resolve(result?.value);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  _req(store, method, ...args) {
    return new Promise((resolve, reject) => {
      const rq = store[method](...args);
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
  }
  list() {
    return this._tx('readonly', (s) => {
      const out = { value: null };
      this._req(s, 'getAll').then((v) => (out.value = v));
      return out;
    });
  }
  get(id) {
    return this._tx('readonly', (s) => {
      const out = { value: null };
      this._req(s, 'get', id).then((v) => (out.value = v ?? null));
      return out;
    });
  }
  put(item) {
    return this._tx('readwrite', (s) => {
      const out = { value: null };
      this._req(s, 'put', item).then((v) => (out.value = v));
      return out;
    });
  }
  add(item) {
    return this._tx('readwrite', (s) => {
      const out = { value: null };
      this._req(s, 'add', item).then((v) => (out.value = v));
      return out;
    });
  }
  remove(id) {
    return this._tx('readwrite', (s) => {
      const out = { value: null };
      this._req(s, 'delete', id).then(() => (out.value = true));
      return out;
    });
  }
  clear() {
    return this._tx('readwrite', (s) => {
      const out = { value: null };
      this._req(s, 'clear').then(() => (out.value = true));
      return out;
    });
  }
  byIndex(indexName, value) {
    return this._tx('readonly', (s) => {
      const out = { value: null };
      const idx = s.index(indexName);
      this._req(idx, 'getAll', value).then((v) => (out.value = v));
      return out;
    });
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
