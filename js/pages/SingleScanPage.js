/* Single Photo Offline: camera/file -> browser OMR -> IndexedDB result/review. */
import { classSelectHTML, studentSelectHTML, examSelectHTML } from '../components/selectors.js';
import { cameraViewportHTML, openCamera, closeCamera, captureCameraPhoto } from '../components/CameraViewport.js';
import { persistSinglePhotoResult } from '../services/singlePhotoService.js';

const CLASS_SESSION_KEY = 'kc-single-photo-class';
const STAGES = {
  preparing: 'กำลังเตรียมภาพ...',
  finding: 'กำลังหากระดาษ...',
  reading: 'กำลังอ่านคำตอบ...',
  scoring: 'กำลังคำนวณคะแนน...',
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function friendlyError(error) {
  const text = String(error?.message || error || '');
  if (/marker|reference|corner|จุดอ้างอิง/i.test(text)) return 'พบจุดอ้างอิงไม่ครบ กรุณาถ่ายให้เห็นกระดาษทั้งใบ';
  if (/memory|allocation|32 ล้าน|ใหญ่เกิน/i.test(text)) return 'หน่วยความจำไม่เพียงพอ กรุณาลองภาพที่เล็กลง';
  if (/เฉลย/i.test(text)) return text;
  if (/ภาพ|decode|read|size/i.test(text)) return 'ภาพไม่ชัดพอ หรือไม่สามารถอ่านคำตอบได้';
  return 'ไม่สามารถอ่านคำตอบได้';
}

function resultHTML(result, { studentName, className, examName }) {
  const percent = result.fullScore ? Math.round((result.score / result.fullScore) * 10000) / 100 : 0;
  const answers = result.answers.map((answer, index) => {
    const multiple = result.answerSelections[index].length > 1;
    return `<span class="answer-chip ${multiple ? 'answer-chip--review' : ''}">${index + 1}. ${answer || (multiple ? 'หลายคำตอบ' : 'ไม่ตอบ')}</span>`;
  }).join('');
  return `<div class="card single-result">
    <div class="card-title">✓ บันทึกผลตรวจแล้ว</div>
    <div class="kv"><span>นักเรียน</span><b>${escapeHtml(studentName)}</b></div>
    <div class="kv"><span>ห้อง</span><b>${escapeHtml(className)}</b></div>
    <div class="kv"><span>ข้อสอบ</span><b>${escapeHtml(examName)}</b></div>
    <div class="score-big">${result.score} / ${result.fullScore} <small>คะแนน</small></div>
    <div class="kv"><span>ร้อยละ</span><b>${percent}%</b></div>
    <div class="kv"><span>ต้องตรวจทาน</span><b>${result.reviewCount} ข้อ</b></div>
    ${result.reviewCount ? '<a class="btn btn--secondary btn--block" href="#/review" style="margin-top:12px;">ไปรอตรวจทาน</a>' : ''}
    <details style="margin-top:12px;"><summary>ดูคำตอบรายข้อ</summary><div class="answer-grid">${answers}</div></details>
    <div class="small muted" style="margin-top:10px;">ถอดรหัส ${Math.round(result.performance?.decodeMs || 0)} ms · OMR ${Math.round(result.performance?.omrMs || 0)} ms · รวม ${Math.round(result.performance?.totalMs || 0)} ms</div>
  </div>`;
}

export async function render({ repos }) {
  const classes = await repos.classes.list();
  const exams = await repos.exams.list();
  let selectedClass = '';
  try { selectedClass = sessionStorage.getItem(CLASS_SESSION_KEY) || ''; } catch { /* ignore */ }
  if (!classes.some((row) => row.id === selectedClass)) selectedClass = '';
  const students = selectedClass ? await repos.students.listByClass(selectedClass) : [];
  return `
  <div class="page-title"><h1>ตรวจข้อสอบ</h1></div>
  <p class="page-sub">ถ่ายกระดาษคำตอบทีละใบ — ตรวจและเก็บผลในเครื่อง</p>
  <div class="card stack">
    ${classSelectHTML(classes, selectedClass)}
    <div id="student-slot">${studentSelectHTML(students)}</div>
    ${examSelectHTML(exams)}
  </div>
  <div class="section">ภาพกระดาษคำตอบ</div>
  <div id="cam-slot">${cameraViewportHTML('cam-single')}</div>
  <div class="btn-row" style="margin-top:12px;">
    <button class="btn btn--secondary" id="btn-open-cam">เปิดกล้อง</button>
    <button class="btn" id="btn-capture" hidden>ถ่ายภาพ</button>
    <label class="btn btn--secondary" style="cursor:pointer;">เลือกรูปจากเครื่อง
      <input type="file" id="file-pick" accept="image/jpeg,image/png" hidden />
    </label>
  </div>
  <div id="photo-preview" style="margin-top:12px;"></div>
  <div style="margin-top:16px;"><button class="btn btn--block" id="btn-process">ประมวลผลกระดาษคำตอบ</button></div>
  <div id="omr-status" aria-live="polite"></div>`;
}

export async function bind(root, { repos, store }) {
  const classSel = root.querySelector('#f-class');
  const studentSlot = root.querySelector('#student-slot');
  const camSlot = root.querySelector('#cam-slot');
  const status = root.querySelector('#omr-status');
  const processButton = root.querySelector('#btn-process');
  const captureButton = root.querySelector('#btn-capture');
  let opened = false;
  let processing = false;
  let pickedImage = null;
  let previewUrl = null;
  let imageRevision = 0;
  let lastSavedSignature = null;

  const showImage = (blob) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(blob);
    root.querySelector('#photo-preview').innerHTML = `<div class="card"><div class="card-title">รูปที่เลือก</div><img src="${previewUrl}" alt="ภาพกระดาษคำตอบ" style="width:100%;border-radius:12px;margin-top:8px;" /></div>`;
    pickedImage = blob;
    imageRevision += 1;
  };

  classSel.addEventListener('change', async () => {
    const classId = classSel.value;
    try { sessionStorage.setItem(CLASS_SESSION_KEY, classId); } catch { /* ignore */ }
    const students = classId ? await repos.students.listByClass(classId) : [];
    studentSlot.innerHTML = studentSelectHTML(students);
  });
  root.querySelector('#btn-open-cam').addEventListener('click', async (event) => {
    if (!opened) {
      opened = await openCamera(camSlot);
      event.currentTarget.textContent = opened ? 'ปิดกล้อง' : 'เปิดกล้อง';
      captureButton.hidden = !opened;
    } else {
      closeCamera(camSlot); opened = false; captureButton.hidden = true;
      event.currentTarget.textContent = 'เปิดกล้อง';
    }
  });
  captureButton.addEventListener('click', async () => {
    try { showImage(await captureCameraPhoto(camSlot)); }
    catch (error) { status.innerHTML = `<div class="dev-note"><strong>ถ่ายภาพไม่สำเร็จ</strong>${escapeHtml(error.message)}</div>`; }
  });
  root.querySelector('#file-pick').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      status.innerHTML = '<div class="dev-note"><strong>ไฟล์นี้ยังไม่รองรับ</strong>กรุณาเลือก JPEG หรือ PNG</div>';
      return;
    }
    showImage(file);
  });

  processButton.addEventListener('click', async () => {
    if (processing) return;
    const classId = classSel.value;
    const studentValue = root.querySelector('#f-student')?.value || '';
    const examId = root.querySelector('#f-exam').value;
    if (!classId || !examId || !pickedImage) {
      const missing = !classId ? 'ห้องเรียน' : !examId ? 'ข้อสอบ' : 'ภาพกระดาษคำตอบ';
      status.innerHTML = `<div class="dev-note"><strong>ยังไม่ครบ</strong>กรุณาเลือก${missing}ก่อน</div>`;
      return;
    }
    const saveSignature = `${imageRevision}:${classId}:${studentValue}:${examId}`;
    if (lastSavedSignature === saveSignature) {
      status.insertAdjacentHTML('afterbegin', '<div class="dev-note"><strong>บันทึกภาพนี้แล้ว</strong>กรุณาถ่ายหรือเลือกรูปใหม่ก่อนตรวจอีกครั้ง</div>');
      return;
    }
    processing = true;
    processButton.disabled = true;
    const resultId = `result-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
    try {
      const [exam, answerKey, cls, student] = await Promise.all([
        repos.exams.get(examId), repos.answerKeys.getByExam(examId), repos.classes.get(classId),
        studentValue && studentValue !== '__unknown__' ? repos.students.get(studentValue) : null,
      ]);
      if (!exam || !answerKey) throw new Error('ไม่พบข้อสอบหรือเฉลยในเครื่อง');
      if (student && student.classId !== classId) throw new Error('นักเรียนไม่อยู่ในห้องที่เลือก');
      const omrResult = await store.omr.processAnswerSheet(pickedImage, {
        count: exam.questionCount, maximum: exam.fullScore, answerKey: answerKey.answers,
        legacy: exam.questionCount === 40, captureNormalizedImage: true,
        onStage: (stage) => { status.innerHTML = `<div class="processing-state"><span class="spinner"></span><strong>${STAGES[stage]}</strong></div>`; },
      });
      status.innerHTML = `<div class="processing-state"><span class="spinner"></span><strong>${STAGES.scoring}</strong></div>`;
      const saved = await persistSinglePhotoResult({
        repos, resultId, omrResult, exam, answerKey, classId,
        studentId: student?.id || null, syncState: 'pending',
      });
      lastSavedSignature = saveSignature;
      status.innerHTML = resultHTML(saved.result, {
        studentName: student ? `${student.no}. ${student.firstName} ${student.lastName}` : 'ไม่ระบุนักเรียน',
        className: cls?.name || '—', examName: exam.name,
      }) + `<div class="offline-save-note">${navigator.onLine ? 'บันทึกในเครื่องแล้ว · รอซิงก์' : 'กำลังใช้งานแบบออฟไลน์ · ผลตรวจจะถูกซิงก์เมื่อกลับมาออนไลน์'}</div>`;
      store.emit('connectivity');
    } catch (error) {
      console.error('[Single Photo Offline] processing failed', error);
      status.innerHTML = `<div class="dev-note"><strong>ตรวจไม่สำเร็จ</strong>${escapeHtml(friendlyError(error))}</div>`;
    } finally {
      processing = false;
      processButton.disabled = false;
    }
  });

  return () => {
    closeCamera(camSlot);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    pickedImage = null;
  };
}
