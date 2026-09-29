import { LETTERS, SHEET_HEIGHT, SHEET_WIDTH } from '../constants.js';
import { loadOpenCv, OPENCV_RUNTIME } from './opencvRuntime.js';
import { imageSourceToMat } from './image.js';
import { deleteMats } from './memory.js';
import { loadAcceptedMarks } from '../templates/acceptedMarks.js';
import { rectify, rectifyLegacy } from '../alignment/rectify.js';
import { gradeAnswers, readAnswerDetails } from '../recognition/readAnswers.js';

let initializedAt = null;
let initializationMs = null;

function answerBox(boxes, question) {
  const group = boxes[question];
  const left = Math.min(...group.map((box) => box[0]));
  const top = Math.min(...group.map((box) => box[1]));
  const right = Math.max(...group.map((box) => box[2]));
  const bottom = Math.max(...group.map((box) => box[3]));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

function buildOverlay(result, key, statuses) {
  return result.boxes.map((_, question) => {
    let state;
    if (result.uncertain.includes(question)) state = result.answers[question].length > 1 ? 'purple' : 'yellow';
    else if (result.answers[question].length > 1) state = 'purple';
    else if (key) state = statuses[question] === 'correct' ? 'green' : statuses[question] === 'wrong' ? 'red' : 'yellow';
    else state = result.answers[question].length === 1 ? 'green' : 'yellow';
    return { questionNo: question + 1, ...answerBox(result.boxes, question), state };
  });
}

export async function initializeBrowserOmr() {
  if (initializedAt) return { cv: await loadOpenCv(), templates: await loadAcceptedMarks(), initializationMs };
  const started = performance.now();
  const [cv, templates] = await Promise.all([loadOpenCv(), loadAcceptedMarks()]);
  initializationMs = performance.now() - started;
  initializedAt = Date.now();
  return { cv, templates, initializationMs };
}

/** Process one already-acquired image entirely in this browser. */
export async function processAnswerSheetLocal(image, options = {}) {
  const started = performance.now();
  const { cv, templates } = await initializeBrowserOmr();
  const count = Number(options.count || 40);
  const legacy = options.legacy !== false && count === 40;
  const source = await imageSourceToMat(cv, image);
  let alignment = null;
  try {
    alignment = legacy ? rectifyLegacy(cv, source, options.points || null) : rectify(cv, source, options.points || null);
    const result = readAnswerDetails(cv, alignment.normalized, count, templates, {
      profile: options.profile || null,
      allowLegacyTable: legacy,
    });
    const key = Array.isArray(options.answerKey)
      ? options.answerKey.map((value) => typeof value === 'string' ? LETTERS.indexOf(value) : Number(value))
      : null;
    const grading = key?.length === count ? gradeAnswers(result.answers, key, Number(options.maximum ?? count)) : null;
    const reviewItems = result.uncertain.map((question) => ({
      questionNo: question + 1,
      imageUrl: null,
      candidates: result.answers[question].map((choice) => LETTERS[choice]),
      reason: result.reasons[question],
    }));
    const processingMs = performance.now() - started;
    return {
      answers: result.answers.map((selected) => selected.length === 1 ? LETTERS[selected[0]] : null),
      answerSelections: result.answers,
      score: grading?.score ?? null,
      grading,
      reviewItems,
      uncertain: result.uncertain,
      reviewReasons: result.reasons,
      measurements: result.measurements,
      classifications: result.classifications,
      layout: result.layout,
      alignment: {
        method: alignment.method || (legacy ? 'legacy-4-marker' : '4-marker'),
        points: alignment.corners,
        missingIndex: alignment.missing ?? null,
        normalizedWidth: SHEET_WIDTH,
        normalizedHeight: SHEET_HEIGHT,
      },
      overlayData: buildOverlay(result, key, grading?.statuses || null),
      answerBoxes: result.boxes,
      diagnostics: options.diagnostics ? result.details : undefined,
      performance: { initializationMs, processingMs },
      engine: { provider: 'opencv.js-wasm', version: OPENCV_RUNTIME.version, offline: true },
    };
  } finally {
    deleteMats(source, alignment?.warped, alignment?.normalized);
  }
}

export { readAnswerDetails } from '../recognition/readAnswers.js';
export { rectify, rectifyLegacy, recoverLegacyMarkers } from '../alignment/rectify.js';
