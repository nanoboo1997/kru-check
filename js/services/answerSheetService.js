/* ============================================================
 * Kru Check — answer sheet / QR service (interface)
 *
 * เตรียม interface สำหรับ:
 *  - สร้างกระดาษคำตอบ (รองรับ 20 / 40 / 60 ข้อ และจำนวนอื่นในอนาคต)
 *  - กระดาษ QR รายบุคคล
 *  - ดาวน์โหลด / พิมพ์
 *
 * ยังไม่ implement cryptographic QR signing —
 * TODO(Codex): เชื่อมระบบสร้างกระดาษจริงภายหลัง
 * ============================================================ */

export class AnswerSheetService {
  /**
   * @param {string} examId
   * @param {{ withQr?: boolean, studentId?: string }} options
   * @returns {Promise<{ htmlUrl: string }>} URL สำหรับ preview/print
   */
  async generateSheet(examId, options = {}) {
    throw new Error('ระบบสร้างกระดาษคำตอบยังไม่ implement — รอ Codex เชื่อม');
  }
  async generatePersonalQrSheets(examId, classId) {
    throw new Error('ระบบสร้างกระดาษ QR รายบุคคลยังไม่ implement — รอ Codex เชื่อม');
  }
}

/** Dev implementation: แสดง dev notice แทนการสร้างของปลอม */
export class DevAnswerSheetService extends AnswerSheetService {
  get devNotice() {
    return {
      title: 'โหมดพัฒนา — ยังไม่สร้างกระดาษจริง',
      body: 'ส่วนนี้รอ Codex เชื่อมระบบสร้างกระดาษคำตอบ + QR จริง (รวม cryptographic signing) ตอนนี้ยังไม่สร้างไฟล์จริง',
    };
  }
  async generateSheet() { throw new Error(this.devNotice.body); }
  async generatePersonalQrSheets() { throw new Error(this.devNotice.body); }
}
