import { initializeBrowserOmr, processAnswerSheetLocal, readAnswerDetails } from '../js/omr/core/engine.js';
import { imageSourceToMat } from '../js/omr/core/image.js';
import { deleteMats } from '../js/omr/core/memory.js';

function same(value, other) {
  return JSON.stringify(value) === JSON.stringify(other);
}

function answerKind(answer, uncertain, question) {
  if (uncertain.includes(question)) return 'review';
  if (!answer.length) return 'blank';
  if (answer.length > 1) return 'multiple';
  return 'selected';
}

async function normalizedCase(blob, reference) {
  const { cv, templates } = await initializeBrowserOmr();
  const rgba = await imageSourceToMat(cv, blob);
  const gray = new cv.Mat();
  try {
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
    const result = readAnswerDetails(cv, gray, reference.count, templates, { allowLegacyTable: true });
    const correct = result.answers.filter((answer, index) => answer.length === 1 && answer[0] === reference.key[index]).length;
    const score = Math.round((correct / reference.count) * reference.maximum * 100) / 100;
    return {
      answerSelections: result.answers,
      uncertain: result.uncertain,
      reviewReasons: result.reasons,
      layout: result.layout,
      score,
      alignment: { method: reference.alignment.method },
      performance: { processingMs: 0 },
    };
  } finally {
    deleteMats(rgba, gray);
  }
}

async function run() {
  window.__PARITY_PROGRESS__ = 'loading-reference';
  const reference = await fetch('./python-reference.json', { cache: 'no-store' }).then((response) => response.json());
  const initialized = performance.now();
  window.__PARITY_PROGRESS__ = 'initializing-opencv';
  const runtime = await initializeBrowserOmr();
  const initializationWallMs = performance.now() - initialized;
  const mismatches = [];
  let totalQuestions = 0;
  let answerMatches = 0;
  let reviewMatches = 0;
  let reasonComparable = 0;
  let reasonMatches = 0;
  let alignmentMismatches = 0;
  let scoreMatches = 0;
  let scoreMismatches = 0;
  let falseConfident = 0;
  const cases = [];
  for (const expected of reference.cases) {
    window.__PARITY_PROGRESS__ = `processing:${expected.fixture}`;
    const blob = await fetch(`./fixtures/${expected.fixture}`, { cache: 'no-store' }).then((response) => response.blob());
    const started = performance.now();
    let actual;
    try {
      actual = expected.normalizedOnly
        ? await normalizedCase(blob, expected)
        : await processAnswerSheetLocal(blob, {
          count: expected.count,
          maximum: expected.maximum,
          answerKey: expected.key,
          legacy: expected.mode === 'legacy',
          diagnostics: true,
        });
    } catch (error) {
      alignmentMismatches += 1;
      mismatches.push({ fixture: expected.fixture, question: null, python: 'aligned', browser: `error: ${error.message}`, likelyCause: 'browser alignment/runtime' });
      cases.push({ fixture: expected.fixture, error: error.message, browserMs: performance.now() - started });
      continue;
    }
    const browserMs = performance.now() - started;
    const scoreMatch = actual.score === expected.score;
    if (scoreMatch) scoreMatches += 1;
    else scoreMismatches += 1;
    for (let question = 0; question < expected.answers.length; question += 1) {
      totalQuestions += 1;
      const pythonAnswer = expected.answers[question];
      const browserAnswer = actual.answerSelections[question];
      const pythonReview = expected.uncertain.includes(question);
      const browserReview = actual.uncertain.includes(question);
      const answerEqual = same(pythonAnswer, browserAnswer);
      if (answerEqual) answerMatches += 1;
      if (pythonReview === browserReview) reviewMatches += 1;
      if (pythonReview || browserReview) {
        reasonComparable += 1;
        if ((expected.reasons[question] || null) === (actual.reviewReasons[question] || null)) reasonMatches += 1;
      }
      const conflictingConfident = !browserReview && browserAnswer.length === 1
        && (pythonReview || (pythonAnswer.length === 1 && pythonAnswer[0] !== browserAnswer[0]));
      if (conflictingConfident) falseConfident += 1;
      if (!answerEqual || pythonReview !== browserReview || ((pythonReview || browserReview)
          && (expected.reasons[question] || null) !== (actual.reviewReasons[question] || null))) {
        mismatches.push({
          fixture: expected.fixture,
          question: question + 1,
          python: { answer: pythonAnswer, state: answerKind(pythonAnswer, expected.uncertain, question), reason: expected.reasons[question] || null },
          browser: {
            answer: browserAnswer,
            state: answerKind(browserAnswer, actual.uncertain, question),
            reason: actual.reviewReasons[question] || null,
            measurements: actual.measurements[question],
            boxes: actual.answerBoxes?.[question] || null,
            diagnostics: actual.diagnostics?.[question] || null,
          },
          likelyCause: !answerEqual ? 'cell recognition/preprocessing difference' : 'review classification difference',
        });
      }
    }
    cases.push({
      fixture: expected.fixture,
      questions: expected.answers.length,
      browserMs: Math.round(browserMs * 100) / 100,
      pythonMs: expected.pythonMs,
      pythonScore: expected.score,
      browserScore: actual.score,
      scoreMatch,
      expectedAlignment: expected.alignment.method,
      browserAlignment: actual.alignment.method,
      reviewQuestions: actual.uncertain.map((value) => value + 1),
    });
    window.__PARITY_PROGRESS__ = `finished:${expected.fixture}`;
  }
  return {
    runtime: { version: '4.4.0', initializationMs: runtime.initializationMs, initializationWallMs },
    images: reference.cases.length,
    totalQuestions,
    answerMatches,
    answerMatchPercent: totalQuestions ? answerMatches / totalQuestions * 100 : 0,
    reviewMatches,
    reviewMatchPercent: totalQuestions ? reviewMatches / totalQuestions * 100 : 0,
    reasonComparable,
    reasonMatches,
    alignmentMismatches,
    scoreMatches,
    scoreMismatches,
    totalMismatches: mismatches.length,
    falseConfidentBrowserAutoGrade: falseConfident,
    cases,
    mismatches,
  };
}

run().then((result) => {
  window.__PARITY_RESULT__ = result;
  document.body.dataset.done = 'true';
  document.getElementById('results').textContent = JSON.stringify(result);
}).catch((error) => {
  const result = { fatal: error.message, stack: error.stack };
  window.__PARITY_RESULT__ = result;
  document.body.dataset.done = 'error';
  document.getElementById('results').textContent = JSON.stringify(result);
});
