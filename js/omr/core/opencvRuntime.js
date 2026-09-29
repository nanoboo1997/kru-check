const RUNTIME_URL = new URL('../../../vendor/opencv/opencv.js', import.meta.url).href;

let runtimePromise = null;

function readyRuntime(value) {
  if (!value || typeof value.Mat !== 'function') return null;
  // Emscripten exposes cv.then(). Resolving a native Promise with that object
  // makes Promise resolution assimilate the thenable recursively forever.
  // Once the runtime is ready the helper is no longer needed, so remove it.
  if (typeof value.then === 'function') {
    try {
      delete value.then;
    } catch {
      value.then = undefined;
    }
  }
  return value;
}

function waitForRuntime(timeoutMs = 30000) {
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const runtime = readyRuntime(globalThis.cv);
      if (runtime) {
        resolve(runtime);
        return;
      }
      if (performance.now() - started >= timeoutMs) {
        reject(new Error('OpenCV.js เริ่มทำงานไม่สำเร็จ'));
        return;
      }
      setTimeout(check, 20);
    };
    check();
  });
}

/** Load the vendored OpenCV.js/WASM runtime exactly once. */
export function loadOpenCv() {
  if (runtimePromise) return runtimePromise;
  runtimePromise = new Promise((resolve, reject) => {
    if (readyRuntime(globalThis.cv)) {
      resolve(globalThis.cv);
      return;
    }
    if (typeof document === 'undefined') {
      reject(new Error('OpenCV.js browser runtime ต้องทำงานใน Browser'));
      return;
    }
    const existing = document.querySelector('script[data-kru-opencv]');
    const script = existing || document.createElement('script');
    const ready = waitForRuntime().then(resolve, reject);
    script.addEventListener('load', () => ready, { once: true });
    script.addEventListener('error', () => reject(new Error('โหลด OpenCV.js ไม่สำเร็จ')), { once: true });
    if (!existing) {
      // This OpenCV build reads the global Module object while the wrapper is
      // evaluated.  Register the callback before appending the script so a fast
      // WASM startup cannot fire onRuntimeInitialized before our load handler.
      const moduleConfig = globalThis.Module || {};
      const previous = moduleConfig.onRuntimeInitialized;
      moduleConfig.onRuntimeInitialized = () => {
        previous?.();
        const runtime = readyRuntime(globalThis.cv);
        if (runtime) resolve(runtime);
      };
      globalThis.Module = moduleConfig;
      script.src = RUNTIME_URL;
      script.async = true;
      script.dataset.kruOpencv = 'true';
      document.head.appendChild(script);
    }
  });
  return runtimePromise;
}

export function resetOpenCvForTests() {
  runtimePromise = null;
}

export const OPENCV_RUNTIME = Object.freeze({
  version: '4.4.0',
  source: 'https://github.com/opencv-js/wasm',
  license: 'MIT wrapper / BSD-3-Clause OpenCV',
  localUrl: RUNTIME_URL,
});
