const TEMPLATE_URL = new URL('./accepted-marks.json', import.meta.url);

let templatesPromise = null;

function decodeBase64(value) {
  const binary = atob(value);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) output[index] = binary.charCodeAt(index);
  return output;
}

export async function loadAcceptedMarks() {
  if (!templatesPromise) {
    templatesPromise = fetch(TEMPLATE_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`โหลด accepted marks ไม่สำเร็จ (${response.status})`);
        return response.json();
      })
      .then((payload) => {
        if (payload.encoding !== 'base64-uint8' || payload.shape?.join(',') !== '17,31,31') {
          throw new Error('รูปแบบ accepted marks ไม่ถูกต้อง');
        }
        const data = decodeBase64(payload.data);
        if (data.length !== 17 * 31 * 31) throw new Error('ขนาด accepted marks ไม่ถูกต้อง');
        return Array.from({ length: 17 }, (_, index) => data.subarray(index * 961, (index + 1) * 961));
      });
  }
  return templatesPromise;
}

export function resetAcceptedMarksForTests() {
  templatesPromise = null;
}
