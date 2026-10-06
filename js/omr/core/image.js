import { deleteMats } from './memory.js';

const MAX_SIDE = 2400;
const MAX_PIXELS = 32_000_000;

async function blobToDrawable(blob) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(blob, { imageOrientation: 'from-image' });
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sourceSize(source) {
  return [
    source.naturalWidth || source.videoWidth || source.width,
    source.naturalHeight || source.videoHeight || source.height,
  ];
}

function makeCanvas(width, height) {
  // OpenCV.js 4.4 imread accepts an HTMLCanvasElement, but not the
  // OffscreenCanvas that modern Chrome/Safari may expose on the main thread.
  // Keep decoding local while supplying the element type this runtime expects.
  if (typeof document === 'undefined') {
    throw new Error('การอ่านภาพ OMR ต้องทำงานในหน้าต่าง Browser');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Convert a normalized OpenCV Mat to a compact local JPEG for review UI. */
export async function matToReviewBlob(cv, mat, { quality = 0.82 } = {}) {
  const canvas = makeCanvas(mat.cols, mat.rows);
  cv.imshow(canvas, mat);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      canvas.width = 1;
      canvas.height = 1;
      if (blob) resolve(blob);
      else reject(new Error('ไม่สามารถเตรียมภาพสำหรับตรวจทานได้'));
    }, 'image/jpeg', quality);
  });
}

/** Decode Blob/image/canvas locally and return an RGBA cv.Mat, capped like Python. */
export async function imageSourceToMat(cv, source) {
  if (!source) throw new Error('กรุณาเลือกรูปกระดาษคำตอบ');
  const ownedDrawable = source instanceof Blob ? await blobToDrawable(source) : null;
  const drawable = ownedDrawable || source;
  const [originalWidth, originalHeight] = sourceSize(drawable);
  if (!originalWidth || !originalHeight) throw new Error('อ่านขนาดภาพไม่ได้');
  if (originalWidth * originalHeight > MAX_PIXELS) {
    ownedDrawable?.close?.();
    throw new Error('ภาพใหญ่เกิน 32 ล้านพิกเซล กรุณาลดขนาดภาพ');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(originalWidth, originalHeight));
  const width = Math.max(1, Math.round(originalWidth * scale));
  const height = Math.max(1, Math.round(originalHeight * scale));
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(drawable, 0, 0, width, height);
  ownedDrawable?.close?.();
  let rgba = null;
  try {
    rgba = cv.imread(canvas);
    canvas.width = 1;
    canvas.height = 1;
    return rgba;
  } catch (error) {
    canvas.width = 1;
    canvas.height = 1;
    deleteMats(rgba);
    throw new Error(`อ่านภาพไม่ได้: ${error?.message || error}`);
  }
}
