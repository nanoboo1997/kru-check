/* ============================================================
 * Kru Check — auth service (interface + dev mock)
 *
 * หมายเหตุสำคัญ: MockAuthService เป็นของจำลองสำหรับทดลอง UI
 * เท่านั้น — ไม่ใช่ระบบยืนยันตัวตนจริง ไม่ปลอดภัยจริง
 * ระบบจริงในอนาคต: GAS authentication (Codex เชื่อมต่อ)
 * ============================================================ */

export class AuthService {
  constructor(repos) { this.repos = repos; }
  async login(email, password) { throw new Error('not implemented'); }
  async register(email, password, name) { throw new Error('not implemented'); }
  async forgotPassword(email) { throw new Error('not implemented'); }
}

/** Dev mock: รับอีเมลใด ๆ แล้วคืนครูตัวอย่าง (ไม่มีการตรวจรหัสผ่านจริง) */
export class MockAuthService extends AuthService {
  async login(email) {
    if (!email || !String(email).includes('@')) {
      throw new Error('กรุณากรอกอีเมลให้ถูกต้อง');
    }
    const teachers = await this.repos.teachers.list();
    let teacher = teachers.find((t) => t.email === email);
    if (!teacher) {
      const name = String(email).split('@')[0] || 'คุณครู';
      teacher = { id: 't-' + Date.now(), name, email };
      await this.repos.teachers.save(teacher);
    }
    return teacher;
  }
  async register(email, password, name) {
    const teacher = { id: 't-' + Date.now(), name: name || 'คุณครู', email };
    await this.repos.teachers.save(teacher);
    return teacher;
  }
  async forgotPassword(email) {
    // mock: แจ้งว่าส่งลิงก์แล้ว (ไม่มีการส่งจริง)
    return { sent: true, email };
  }
}

/**
 * Adapter สำหรับ GAS authentication (อนาคต)
 * TODO(Codex): ยิง request ไปยัง config.gas.endpoint action=login ฯลฯ
 */
export class GasAuthAdapter extends AuthService {
  async login() { throw new Error('GAS authentication ยังไม่ implement'); }
  async register() { throw new Error('GAS authentication ยังไม่ implement'); }
  async forgotPassword() { throw new Error('GAS authentication ยังไม่ implement'); }
}
