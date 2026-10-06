/* ============================================================
 * Kru Check — sync architecture
 *
 * หน้าที่ของ sync (อนาคต = Google Apps Script):
 *  - push: ดัน local changes (syncQueue) ขึ้น cloud
 *  - pull: ดึง cloud changes ลงมา
 *  - status / lastSync / conflicts / retry
 *
 * GAS มีหน้าที่เป็น Backend/Sync เท่านั้น —
 * การตรวจข้อสอบ (OMR) ต้องเกิดบนอุปกรณ์เสมอ
 * ============================================================ */

/** สถานะซิงก์: 'synced' | 'pending' | 'offline' | 'error' */
export class SyncService {
  constructor(repos) { this.repos = repos; }
  async push() { throw new Error('not implemented'); }
  async pull() { throw new Error('not implemented'); }
  async syncNow() { throw new Error('not implemented'); }
  async getStatus() { throw new Error('not implemented'); }
  async getLastSync() { throw new Error('not implemented'); }
  async getConflicts() { throw new Error('not implemented'); }
  async retryFailed() { throw new Error('not implemented'); }
  async enqueue(op) { return this.repos.sync.enqueue(op); }
}

/** Mock — จำลองการซิงก์สำหรับทดลอง UI (ไม่มี backend จริง) */
export class MockSyncService extends SyncService {
  async _delay(ms = 600) { return new Promise((r) => setTimeout(r, ms)); }

  async push() {
    await this._delay();
    const pending = await this.repos.sync.pending();
    for (const item of pending) {
      await this.repos.sync.markDone(item.id, 'mock-ack');
    }
    await this.repos.sync.setMeta('lastSync', new Date().toISOString());
    return { pushed: pending.length };
  }
  async pull() {
    await this._delay(400);
    await this.repos.sync.setMeta('lastSync', new Date().toISOString());
    return { pulled: 0 };
  }
  async syncNow() {
    if (!navigator.onLine) return { ok: false, reason: 'offline' };
    const { pushed } = await this.push();
    await this.pull();
    return { ok: true, pushed };
  }
  async getStatus() {
    if (!navigator.onLine) return 'offline';
    const pending = await this.repos.sync.pending();
    return pending.length > 0 ? 'pending' : 'synced';
  }
  async getLastSync() { return this.repos.sync.getMeta('lastSync'); }
  async getConflicts() { return []; } // mock: ไม่มี conflict
  async retryFailed() {
    const failed = await this.repos.sync.failed();
    for (const item of failed) await this.repos.sync.requeue(item.id);
    return { retried: failed.length };
  }
}

/** Phase 2: retain every operation locally until a real backend exists. */
export class OfflineOnlySyncService extends SyncService {
  async push() { return { pushed: 0, configured: false }; }
  async pull() { return { pulled: 0, configured: false }; }
  async syncNow() { return { ok: false, reason: navigator.onLine ? 'not-configured' : 'offline' }; }
  async getStatus() {
    if (!navigator.onLine) return 'offline';
    return (await this.repos.sync.pending()).length ? 'pending' : 'synced';
  }
  async getLastSync() { return this.repos.sync.getMeta('lastSync'); }
  async getConflicts() { return []; }
  async retryFailed() { return { retried: 0 }; }
}

/**
 * Adapter สำหรับ Google Apps Script (อนาคต)
 * TODO(Codex): implement โดยยิง HTTP ไปยัง config.gas.endpoint
 *  - ใช้ fetch POST { action, payload } ตาม contract ที่ตกลงกับ GAS
 *  - ห้าม hard-code URL — อ่านจาก config.gas.endpoint เท่านั้น
 */
export class GasSyncAdapter extends SyncService {
  _assertConfigured() {
    if (!this.constructor.endpoint) {
      throw new Error('GAS endpoint ยังไม่ได้ตั้งค่า (config.gas.endpoint)');
    }
  }
  static get endpoint() {
    // อ่านผ่าน dynamic import เพื่อไม่ผูก config ตอน load
    return null; // TODO(Codex): return config.gas.endpoint
  }
  async push() { this._assertConfigured(); throw new Error('GAS sync ยังไม่ implement'); }
  async pull() { this._assertConfigured(); throw new Error('GAS sync ยังไม่ implement'); }
  async syncNow() { this._assertConfigured(); throw new Error('GAS sync ยังไม่ implement'); }
  async getStatus() { return 'offline'; }
  async getLastSync() { return this.repos.sync.getMeta('lastSync'); }
  async getConflicts() { return []; }
  async retryFailed() { return { retried: 0 }; }
}
