/* ============================================================
 * Kru Check — ตรวจข้อสอบ (single photo)
 * ลำดับ: ห้องเรียน → นักเรียน (เฉพาะห้องนั้น + ไม่ระบุนักเรียน)
 *        → ข้อสอบ → เปิดกล้อง/เลือกรูป → ประมวลผล (OMR interface)
 * ============================================================ */
import { classSelectHTML, studentSelectHTML, examSelectHTML } from '../components/selectors.js';
import { cameraViewportHTML, openCamera, closeCamera } from '../components/CameraViewport.js';
import { OMRNotImplementedError } from '../services/omrService.js';

export async function render({ repos }) {
  const classes = await repos.classes.list();
  const exams = await repos.exams.list();
  const notice = repos.omrNote || '';
  return `
  <div class="page-title"><h1>ตรวจข้อสอบ</h1></div>
  <p class="page-sub">ถ่ายกระดาษคำตอบทีละใบ — เลือกห้องก่อน แล้วจึงเลือกนักเรียน</p>

  <div class="card stack">
    ${classSelectHTML(classes)}
    <div id="student-slot">${studentSelectHTML([])}</div>
    ${examSelectHTML(exams)}
  </div>

  <div class="section">ภาพกระดาษคำตอบ</div>
  <div id="cam-slot">${cameraViewportHTML('cam-single')}</div>
  <div class="btn-row" style="margin-top:12px;">
    <button class="btn btn--secondary" id="btn-open-cam">เปิดกล้อง</button>
    <label class="btn btn--secondary" style="cursor:pointer;">เลือกรูปจากเครื่อง
      <input type="file" id="file-pick" accept="image/*" capture="environment" hidden />
    </label>
  </div>
  <div id="photo-preview" style="margin-top:12px;"></div>

  <div style="margin-top:16px;">
    <button class="btn btn--block" id="btn-process">ประมวลผลกระดาษคำตอบ</button>
  </div>
  <div id="omr-status"></div>
  ${notice}`;
}

export async function bind(root, { repos, store }) {
  const classSel = () => root.querySelector('#f-class');
  const studentSlot = root.querySelector('#student-slot');

  // เลือกห้องก่อน → โหลดรายชื่อนักเรียนเฉพาะห้องนั้น
  classSel().addEventListener('change', async () => {
    const classId = classSel().value;
    const students = classId ? await repos.students.listByClass(classId) : [];
    studentSlot.innerHTML = studentSelectHTML(students);
  });

  const camSlot = root.querySelector('#cam-slot');
  let opened = false;
  root.querySelector('#btn-open-cam').addEventListener('click', async (e) => {
    if (!opened) {
      opened = await openCamera(camSlot);
      e.target.textContent = opened ? 'ปิดกล้อง' : 'เปิดกล้อง';
    } else {
      closeCamera(camSlot);
      opened = false;
      e.target.textContent = 'เปิดกล้อง';
    }
  });

  root.querySelector('#file-pick').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    root.querySelector('#photo-preview').innerHTML = `
      <div class="card"><div class="card-title">รูปที่เลือก</div>
      <img src="${url}" alt="ภาพกระดาษคำตอบ" style="width:100%;border-radius:12px;margin-top:8px;" /></div>`;
    root._pickedImage = f;
  });

  root.querySelector('#btn-process').addEventListener('click', async () => {
    const status = root.querySelector('#omr-status');
    if (!classSel().value) {
      status.innerHTML = `<div class="dev-note"><strong>ยังไม่ครบ</strong>กรุณาเลือกห้องเรียนก่อน</div>`;
      return;
    }
    if (!root.querySelector('#f-exam').value) {
      status.innerHTML = `<div class="dev-note"><strong>ยังไม่ครบ</strong>กรุณาเลือกข้อสอบก่อน</div>`;
      return;
    }
    status.innerHTML = `<div class="dev-note"><strong>กำลังเรียก OMR…</strong></div>`;
    try {
      // OMR_PROCESSOR_INTERFACE — Codex เชื่อม JS/WASM OMR จริงที่นี่
      const examId = root.querySelector('#f-exam').value;
      const [exam, answerKey] = await Promise.all([
        repos.exams.get(examId),
        repos.answerKeys.getByExam(examId),
      ]);
      const result = await store.omr.processAnswerSheet(root._pickedImage || null, {
        count: exam.questionCount,
        maximum: exam.fullScore,
        answerKey: answerKey?.answers || null,
        legacy: exam.questionCount === 40,
      });
      status.innerHTML = `<div class="card"><b>ผลตรวจ:</b> ${JSON.stringify(result)}</div>`;
    } catch (err) {
      const dev = store.omr.devNotice;
      status.innerHTML = `
        <div class="dev-note">
          <strong>${dev.title}</strong>${dev.body}
          <div class="small" style="margin-top:6px;">(${err instanceof OMRNotImplementedError ? err.code : err.message})</div>
        </div>`;
    }
  });
}
