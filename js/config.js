/* ============================================================
 * Kru Check — app configuration
 *
 * ไฟล์นี้คือจุดตั้งค่าเดียวของแอป (single source of truth)
 * - dataMode: 'mock' = ใช้ Mock repository (ค่าเริ่มต้นสำหรับทดลอง UI)
 *             'indexeddb' = ใช้ IndexedDB จริง (Codex เปิดเมื่อพร้อม)
 * - gas: placeholder สำหรับ Google Apps Script endpoint ในอนาคต
 *         **ห้าม hard-code URL จริงที่นี่จนกว่าจะมี backend จริง**
 * - omr: provider จะเป็น 'js' | 'wasm' เมื่อ Codex เชื่อม OMR จริง
 * ============================================================ */
export const config = {
  appName: 'Kru Check',
  tagline: 'ตรวจข้อสอบง่าย แม่นยำ และรวดเร็ว',
  version: '0.1.0',

  /** โหมด data layer: 'mock' | 'indexeddb' */
  dataMode: 'mock',

  /** Google Apps Script — backend/sync ในอนาคต (ยังไม่ตั้งค่า) */
  gas: {
    endpoint: null, // TODO(Codex): ใส่ Web App URL ของ GAS เมื่อ deploy แล้ว
    apiKey: null,
  },

  /** OMR engine — OpenCV.js/WASM ทำงานบนอุปกรณ์ ไม่เรียก server */
  omr: {
    provider: 'wasm',
  },

  /** คะแนนผ่านเกณฑ์เริ่มต้น (ร้อยละ) */
  passThreshold: 50,
};
