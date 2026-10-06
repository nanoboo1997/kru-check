/* ============================================================
 * Kru Check — CameraViewport component
 * ช่องมองกล้องสำหรับสแกน — กว้าง ~90-96% ของพื้นที่ใช้งาน
 * มีกรอบนำสายตาให้เห็น A4 ทั้งใบพร้อม margin รอบกระดาษ
 * ============================================================ */

export function cameraViewportHTML(id = 'camera') {
  return `
  <div class="camera" id="${id}" style="width:min(96%, 520px);margin:0 auto;">
    <div class="camera__idle" data-cam-idle>
      <div style="font-size:40px;">📷</div>
      <div><strong>กล้องยังไม่เปิด</strong></div>
      <div class="small">กด “เปิดกล้อง” แล้วถือกระดาษให้อยู่ในกรอบ</div>
    </div>
    <video data-cam-video playsinline muted style="display:none;"></video>
    <div class="camera__frame"></div>
    <div class="camera__hint" data-cam-hint>จัดกระดาษ A4 ให้อยู่ในกรอบสี่เหลี่ยม</div>
  </div>`;
}

/**
 * พยายามเปิดกล้องหลัง (environment) — ถ้าไม่ได้ให้แสดงข้อความสุภาพ
 * @returns {Promise<boolean>} true ถ้าเปิดสำเร็จ
 */
export async function openCamera(root) {
  const video = root.querySelector('[data-cam-video]');
  const idle = root.querySelector('[data-cam-idle]');
  const hint = root.querySelector('[data-cam-hint]');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 2560 } },
      audio: false,
    });
    video.srcObject = stream;
    video.style.display = 'block';
    idle.style.display = 'none';
    await video.play();
    root._stream = stream;
    return true;
  } catch (err) {
    hint.textContent = 'เปิดกล้องไม่ได้ในตอนนี้ (' + (err?.name || 'error') + ') — ยังถ่ายรูปจากเครื่องได้';
    return false;
  }
}

export function closeCamera(root) {
  const stream = root._stream;
  if (stream) stream.getTracks().forEach((t) => t.stop());
  const video = root.querySelector('[data-cam-video]');
  const idle = root.querySelector('[data-cam-idle]');
  if (video) { video.style.display = 'none'; video.srcObject = null; }
  if (idle) idle.style.display = 'flex';
  root._stream = null;
}

/** Capture one still frame locally. Nothing is uploaded. */
export async function captureCameraPhoto(root) {
  const video = root.querySelector('[data-cam-video]');
  if (!video || !video.videoWidth || !video.videoHeight) throw new Error('กล้องยังไม่พร้อม กรุณารอสักครู่');
  const maxSide = 2400;
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  canvas.width = 1;
  canvas.height = 1;
  if (!blob) throw new Error('ไม่สามารถบันทึกภาพจากกล้องได้');
  return blob;
}
