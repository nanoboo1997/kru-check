/* ============================================================
 * Kru Check — app store (in-memory session + dependency wiring)
 *
 * เป็นจุดเดียวที่ประกอบร่าง:
 *  repositories (mock | indexeddb)  +  services (auth/omr/sync/...)
 * หน้า pages ทั้งหมดรับ ctx มาจากที่นี่ — ไม่ import repository ตรง ๆ
 * ทำให้ Codex สลับ implementation ได้โดยไม่แตะ UI
 * ============================================================ */
import { config } from '../config.js';
import { createRepositories } from '../repositories/factory.js';
import { MockAuthService } from '../services/authService.js';
import { BrowserOmrService } from '../services/omrService.js';
import { OfflineOnlySyncService, GasSyncAdapter } from './sync.js';
import { BackupService } from '../services/backupService.js';
import { DevAnswerSheetService } from '../services/answerSheetService.js';
import { ensureOfflineTestSeed } from '../repositories/offlineSeed.js';

const SESSION_KEY = 'kc-session';

class AppStore {
  constructor() {
    this.repos = null;
    this.auth = null;
    this.omr = null;
    this.sync = null;
    this.backup = null;
    this.answerSheet = null;
    this.currentUser = null;
    this.listeners = new Set();
  }

  async init() {
    this.repos = createRepositories(config.dataMode);
    this.auth = new MockAuthService(this.repos);
    this.omr = new BrowserOmrService();
    // Phase 2 keeps operations pending locally until a real GAS endpoint exists.
    this.sync = config.gas.endpoint ? new GasSyncAdapter(this.repos) : new OfflineOnlySyncService(this.repos);
    this.backup = new BackupService(this.repos);
    this.answerSheet = new DevAnswerSheetService();
    this.offlineReady = false;

    if (config.dataMode === 'indexeddb') await ensureOfflineTestSeed(this.repos);

    // คืน session เดิม (ถ้ามี) — เก็บแค่ id ครู ไม่เก็บรหัสผ่าน
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const { teacherId } = JSON.parse(raw);
        const teacher = await this.repos.teachers.get(teacherId);
        if (teacher) this.currentUser = teacher;
      }
    } catch { /* ignore */ }

    // ติดตามสถานะออนไลน์/ออฟไลน์ แล้วแจ้ง listeners (sync pill, banner)
    window.addEventListener('online', () => this.emit('connectivity'));
    window.addEventListener('offline', () => this.emit('connectivity'));
  }

  async login(email) {
    const teacher = await this.auth.login(email);
    this.currentUser = teacher;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ teacherId: teacher.id }));
    } catch { /* ignore */ }
    return teacher;
  }

  logout() {
    this.currentUser = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    this.emit('auth');
  }

  setOfflineReady(ready) {
    this.offlineReady = Boolean(ready);
    this.emit('offline-ready');
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(topic) { this.listeners.forEach((fn) => { try { fn(topic); } catch {} }); }
}

export const store = new AppStore();
