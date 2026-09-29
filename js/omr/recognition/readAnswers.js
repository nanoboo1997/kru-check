import { MARK, REVIEW_REASON } from '../constants.js';
import { deleteMats } from '../core/memory.js';
import { answerGeometry } from '../alignment/tableGeometry.js';
import { classifyTableMark, interpretTableMarks } from './classify.js';
import { addContextualTableX, promoteUniqueThinX, removeNeighboringXTails } from './neighbors.js';

function crossEvidence(cv, patch) {
  const ink = cv.Mat.zeros(25, 25, cv.CV_8U);
  const near = new cv.Mat();
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  try {
    for (let y = 0; y < 25; y += 1) {
      for (let x = 0; x < 25; x += 1) {
        if ((x - 12) ** 2 + (y - 12) ** 2 <= 100 && patch.ucharAt(y, x) < 170) ink.ucharPtr(y, x)[0] = 1;
      }
    }
    cv.dilate(ink, near, kernel);
    let best = 0;
    for (const dx of [-2, 0, 2]) {
      for (const dy of [-2, 0, 2]) {
        const diagonals = [[30, 45, 60], [120, 135, 150]].map((angles) => Math.max(...angles.map((angle) => {
          const radians = angle * Math.PI / 180;
          const directionScores = [-1, 1].map((sign) => {
            const values = [];
            for (let distance = 3; distance <= 8; distance += 1) {
              const x = 12 + dx + sign * Math.round(distance * Math.cos(radians));
              const y = 12 + dy + sign * Math.round(distance * Math.sin(radians));
              values.push(Number(near.ucharAt(y, x) > 0));
            }
            return values.reduce((sum, value) => sum + value, 0) / values.length;
          });
          return Math.min(...directionScores);
        })));
        best = Math.max(best, Math.min(...diagonals));
      }
    }
    return best;
  } finally {
    deleteMats(ink, near, kernel);
  }
}

function bubbleDetail(cv, normalized, box) {
  const [left, top, right, bottom] = box;
  const centerX = Math.floor((left + right) / 2);
  const centerY = Math.floor((top + bottom) / 2);
  let dark = 0;
  let total = 0;
  for (let dy = -8; dy <= 8; dy += 1) {
    for (let dx = -8; dx <= 8; dx += 1) {
      if (dx * dx + dy * dy > 64) continue;
      if (normalized.ucharAt(centerY + dy, centerX + dx) < 170) dark += 1;
      total += 1;
    }
  }
  const patch = normalized.roi(new cv.Rect(centerX - 12, centerY - 12, 25, 25));
  try {
    return { ratio: dark / total, cross: crossEvidence(cv, patch) };
  } finally {
    patch.delete();
  }
}

export function readAnswerDetails(cv, normalized, count, templates, options = {}) {
  const { profile = null, allowLegacyTable = false } = options;
  const { layout, boxes } = answerGeometry(cv, normalized, count, profile, allowLegacyTable);
  const answers = [];
  const measurements = [];
  const uncertain = [];
  const reasons = {};
  let tableDetails = null;
  if (layout === 'table40' || layout === 'custom') {
    tableDetails = boxes.map((group) => group.map(([left, top, right, bottom]) => {
      const patch = normalized.roi(new cv.Rect(left + 3, top + 3, right - left - 5, bottom - top - 5));
      try {
        return classifyTableMark(cv, patch, templates);
      } finally {
        patch.delete();
      }
    }));
    addContextualTableX(cv, normalized, tableDetails, boxes);
    promoteUniqueThinX(tableDetails);
    removeNeighboringXTails(tableDetails, boxes);
  }
  for (let question = 0; question < count; question += 1) {
    const ratios = [];
    let selected;
    let reason;
    if (tableDetails) {
      const details = tableDetails[question];
      for (const detail of details) ratios.push(Number(detail.inkRatio.toFixed(3)));
      ({ selected, reason } = interpretTableMarks(details));
    } else {
      const cells = boxes[question].map((box) => bubbleDetail(cv, normalized, box));
      cells.forEach((cell) => ratios.push(Number(cell.ratio.toFixed(3))));
      selected = cells.map((cell, index) => [cell, index])
        .filter(([cell]) => (cell.ratio >= 0.10 && cell.cross >= 0.80) || cell.ratio >= 0.80)
        .map(([, index]) => index);
      const weak = cells.some((cell) => cell.ratio > 0.06 && (cell.cross < 0.99 || cell.ratio < 0.10));
      reason = selected.length > 1 ? REVIEW_REASON.MULTIPLE : (weak ? REVIEW_REASON.UNCLEAR_X : null);
    }
    answers.push(selected);
    measurements.push(ratios);
    if (reason) {
      uncertain.push(question);
      reasons[question] = reason;
    }
  }
  return {
    layout,
    boxes,
    answers,
    measurements,
    uncertain,
    reasons,
    classifications: tableDetails?.map((row) => row.map((detail) => detail.state)) || null,
    details: tableDetails,
  };
}

export function gradeAnswers(answers, key, maximum) {
  const statuses = answers.map((answer, index) => {
    if (!answer.length) return 'blank';
    if (answer.length > 1) return 'multiple';
    return answer[0] === key[index] ? 'correct' : 'wrong';
  });
  const counts = Object.fromEntries(['correct', 'wrong', 'blank', 'multiple'].map((state) => [state, statuses.filter((value) => value === state).length]));
  return { ...counts, score: Math.round((counts.correct / key.length) * maximum * 100) / 100, statuses };
}

export function stateForQuestion(result, question) {
  if (result.uncertain.includes(question)) return result.answers[question].length > 1 ? 'purple' : 'yellow';
  if (result.answers[question].length > 1) return 'purple';
  return null;
}

export { MARK };
