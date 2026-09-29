/* ============================================================
 * Kru Check — OMR interface (สำหรับ Codex เชื่อม OMR จริง)
 *
 * กฎเหล็ก:
 *  - ห้าม implement fake recognition ที่แกล้งตรวจข้อสอบได้
 *  - การตรวจต้องเกิดบนอุปกรณ์ (JS/WASM) — ไม่ส่งภาพขึ้น server
 *  - จนกว่า OMR จริงจะถูกเชื่อมและผ่าน parity test กับ OMR เดิม
 *    ห้ามอ้างว่าแอปตรวจข้อสอบได้
 *
 * Contract ที่ Codex ต้อง implement:
 *   processAnswerSheet(image) -> Promise<OmrResult>
 *
 * OmrResult = {
 *   answers:   ['ก'|'ข'|'ค'|'ง'|null, ...], // null = ไม่ตอบ
 *   score:     number,
 *   reviewItems: [{ questionNo, imageUrl, candidates, reason }],
 *   alignment: { method: 'legacy-4-marker' | '3-marker-recovery' | ... },
 *   overlayData: [{ questionNo, x, y, w, h, state:
 *                    'green'|'red'|'yellow'|'purple'|'orange' }],
 * }
 *
 * overlay state (ตามสเปก):
 *  green  = ตอบถูก     red    = ตอบผิด
 *  yellow = ไม่มั่นใจ  purple = หลายคำตอบ / แก้คำตอบ
 *  orange = ข้อปัจจุบัน (current question)
 * ============================================================ */

export const OMR_STATUS = {
  NOT_CONNECTED: 'not-connected',
  READY: 'ready',
};

import { initializeBrowserOmr, processAnswerSheetLocal } from '../omr/core/engine.js';

/** Error ที่บอกชัดเจนว่า OMR ยังไม่ได้เชื่อม (ไม่ใช่ผลตรวจจริง) */
export class OMRNotImplementedError extends Error {
  constructor() {
    super('OMR ยังไม่ได้เชื่อมต่อ — ส่วนนี้รอ Codex เชื่อม JavaScript/WASM OMR จริง');
    this.name = 'OMRNotImplementedError';
    this.code = 'OMR_NOT_CONNECTED';
  }
}

export class OmrService {
  constructor() {
    this.status = OMR_STATUS.NOT_CONNECTED;
    this.engineInfo = null; // Codex ใส่ { provider: 'wasm', version } เมื่อพร้อม
  }

  /**
   * ประมวลผลภาพกระดาษคำตอบ 1 ใบ (single photo)
   * @param {Blob|HTMLImageElement|HTMLCanvasElement} image
   * @returns {Promise<OmrResult>}
   */
  async processAnswerSheet(image) {
    throw new OMRNotImplementedError();
  }

  /**
   * CONTINUOUS_OMR_PROCESSOR — สำหรับโหมดสแกนต่อเนื่อง
   * รับเฟรมจากกล้องแล้วคืนสถานะ: 'searching' | 'found' | 'hold' |
   * 'processing' | 'done' | 'remove-paper' พร้อม OmrResult เมื่อเสร็จ
   */
  async processFrame(frame) {
    throw new OMRNotImplementedError();
  }
}

/** Dev implementation ปัจจุบัน: โยน error ชัดเจน ไม่แกล้งตรวจ */
export class DevOmrService extends OmrService {
  get devNotice() {
    return {
      title: 'โหมดพัฒนา — ยังไม่ได้เชื่อม OMR',
      body: 'ปุ่มนี้จะเรียก processAnswerSheet(image) เมื่อ Codex เชื่อม JavaScript/WASM OMR จริงแล้ว ตอนนี้ยังไม่มีการตรวจข้อสอบเกิดขึ้น',
    };
  }
}

/** Production browser implementation. It never sends the image over a network. */
export class BrowserOmrService extends OmrService {
  constructor() {
    super();
    this.engineInfo = { provider: 'opencv.js-wasm', version: '4.4.0', offline: true };
  }

  async initialize() {
    await initializeBrowserOmr();
    this.status = OMR_STATUS.READY;
    return this.engineInfo;
  }

  async processAnswerSheet(image, options = {}) {
    const result = await processAnswerSheetLocal(image, options);
    this.status = OMR_STATUS.READY;
    return result;
  }

  async processFrame() {
    throw new OMRNotImplementedError();
  }

  get devNotice() {
    return {
      title: 'Browser OMR พร้อมทดสอบ Phase 1',
      body: 'การตรวจรูปเดี่ยวทำงานในเครื่องแล้ว ส่วนสแกนต่อเนื่องยังไม่อยู่ใน Phase นี้',
    };
  }
}

/**
 * ข้อกำหนด OMR ในอนาคต (checklist สำหรับ Codex — ไม่ใช่โค้ด):
 *  - marker detection / perspective correction
 *  - Legacy 4-marker / 3-marker recovery
 *  - X Recognition V2 / thin-faint X / neighboring X spillover
 *  - changed answer / scribble → Review Queue
 *  - QR (ระบุตัวนักเรียน/ข้อสอบ)
 */
export const FUTURE_OMR_REQUIREMENTS = [
  'marker-detection',
  'perspective-correction',
  'legacy-4-marker',
  '3-marker-recovery',
  'x-recognition-v2',
  'thin-faint-x',
  'neighboring-x-spillover',
  'changed-answer',
  'scribble',
  'review-queue',
  'qr',
];
