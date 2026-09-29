/* Kru Check — Login page (UI/architecture ก่อน — ยังไม่มี auth จริง) */
import { config } from '../config.js';

export async function render() {
  return `
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-logo">✓</div>
      <h1 class="login-title">${config.appName}</h1>
      <p class="login-tagline">${config.tagline}</p>
      <div class="card">
        <div class="field">
          <label for="login-email">อีเมล</label>
          <input class="input" id="login-email" type="email" inputmode="email"
                 placeholder="teacher@example.com" autocomplete="username" />
        </div>
        <div class="field">
          <label for="login-pass">รหัสผ่าน</label>
          <input class="input" id="login-pass" type="password"
                 placeholder="••••••••" autocomplete="current-password" />
        </div>
        <div class="dev-note"><strong>โหมดพัฒนา</strong>หน้านี้เป็น UI/โครงสถาปัตยกรรมก่อน — ยังไม่มีระบบยืนยันตัวตนจริง กรอกอีเมลใด ๆ ก็เข้าได้ รอเชื่อม GAS authentication ภายหลัง</div>
        <div id="login-msg"></div>
        <button class="btn btn--block" id="btn-login">เข้าสู่ระบบ</button>
        <div class="btn-row" style="margin-top:10px;">
          <button class="btn btn--secondary" id="btn-register">สมัครสมาชิก</button>
          <button class="btn btn--ghost" id="btn-forgot">ลืมรหัสผ่าน</button>
        </div>
      </div>
      <p class="center small muted" style="margin-top:16px;">เวอร์ชัน ${config.version} · ทำงานออฟไลน์ได้</p>
    </div>
  </div>`;
}

export async function bind(root, { store, navigate }) {
  const msg = (t, ok = false) => {
    root.querySelector('#login-msg').innerHTML = t
      ? `<div class="dev-note" style="${ok ? 'border-color:var(--success);background:var(--success-soft);color:var(--success);' : ''}">${t}</div>` : '';
  };
  root.querySelector('#btn-login').addEventListener('click', async () => {
    const email = root.querySelector('#login-email').value.trim();
    try {
      await store.login(email);
      navigate('dashboard');
    } catch (err) {
      msg(err.message);
    }
  });
  root.querySelector('#login-pass').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') root.querySelector('#btn-login').click();
  });
  root.querySelector('#btn-register').addEventListener('click', async () => {
    const email = root.querySelector('#login-email').value.trim();
    try {
      const t = await store.auth.register(email, '', 'คุณครู');
      await store.login(t.email);
      navigate('dashboard');
    } catch (err) { msg(err.message); }
  });
  root.querySelector('#btn-forgot').addEventListener('click', async () => {
    const email = root.querySelector('#login-email').value.trim() || 'teacher@example.com';
    await store.auth.forgotPassword(email);
    msg(`(โหมดพัฒนา) ถ้ามีระบบจริง จะส่งลิงก์รีเซ็ตรหัสผ่านไปที่ ${email}`, true);
  });
}
