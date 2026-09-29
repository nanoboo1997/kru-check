import { MARK, REVIEW_REASON } from '../constants.js';
import { deleteMats } from '../core/memory.js';
import { binaryBounds, cleanTableInk, componentCount, matMean } from '../preprocessing/tableInk.js';
import {
  acceptedMarkEvidence,
  flexibleCrossGeometry,
  mainStrokeAngles,
  orientationClutter,
  thinCrossRecovery,
} from './crossGeometry.js';

function covarianceShape(binary) {
  const points = [];
  for (let y = 0; y < binary.rows; y += 1) {
    for (let x = 0; x < binary.cols; x += 1) if (binary.ucharAt(y, x)) points.push([x, y]);
  }
  if (points.length < 2) return { lineRatio: 0, principalAngle: null };
  const meanX = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  let cxx = 0;
  let cyy = 0;
  let cxy = 0;
  for (const [x, y] of points) {
    cxx += (x - meanX) ** 2;
    cyy += (y - meanY) ** 2;
    cxy += (x - meanX) * (y - meanY);
  }
  cxx /= points.length - 1;
  cyy /= points.length - 1;
  cxy /= points.length - 1;
  const trace = cxx + cyy;
  const root = Math.sqrt(Math.max(0, ((cxx - cyy) / 2) ** 2 + cxy ** 2));
  const maximum = trace / 2 + root;
  const minimum = trace / 2 - root;
  const principalAngle = ((0.5 * Math.atan2(2 * cxy, cxx - cyy) * 180 / Math.PI) + 180) % 180;
  return { lineRatio: maximum > 0 ? minimum / maximum : 0, principalAngle };
}

function percentile20(values) {
  if (!values.length) return 255;
  values.sort((a, b) => a - b);
  return values[Math.floor((values.length - 1) * 0.2)];
}

function blankDetail(ratio = 0, area = 0, components = 0) {
  return {
    state: MARK.CLEAR_BLANK,
    xEvidence: 0,
    inkRatio: ratio,
    reason: null,
    area,
    components,
  };
}

export function classifyTableMark(cv, patch, templates) {
  const clean = cleanTableInk(cv, patch);
  let crop = null;
  try {
    const ratio = matMean(clean);
    const bounds = binaryBounds(clean);
    if (!bounds) return blankDetail();
    crop = clean.roi(new cv.Rect(bounds.x, bounds.y, bounds.width, bounds.height));
    const area = bounds.area;
    const components = componentCount(cv, crop);
    const touchesBorder = bounds.x === 0 || bounds.y === 0 || bounds.x + bounds.width === patch.cols || bounds.y + bounds.height === patch.rows;
    if (touchesBorder && Math.min(bounds.width, bounds.height) === 1 && area <= Math.max(bounds.width, bounds.height) + 1) {
      return blankDetail(ratio, area, components);
    }
    if (!(area >= 6 && Math.max(bounds.width, bounds.height) >= 4)) return blankDetail(ratio, area, components);
    const { lineRatio, principalAngle } = covarianceShape(crop);
    const lineLike = lineRatio < 0.12;
    const accepted = acceptedMarkEvidence(cv, crop, templates);
    const structuralResult = lineLike ? { score: 0, center: null, angles: [] } : flexibleCrossGeometry(cv, crop);
    const structural = structuralResult.score;
    const rawScore = Math.max(structural, accepted);
    const occupancy = matMean(crop);
    const clutter = orientationClutter(cv, crop);
    const strokeAngles = mainStrokeAngles(cv, crop);
    const excessive = ratio >= 0.32 || components > 6 || (ratio >= 0.12 && clutter > 0.55);
    const inkValues = [];
    for (let y = 0; y < patch.rows; y += 1) {
      for (let x = 0; x < patch.cols; x += 1) if (clean.ucharAt(y, x)) inkValues.push(patch.ucharAt(y, x));
    }
    const faint = percentile20(inkValues) > 175;
    const thin = excessive || rawScore >= 0.80 || ratio > 0.12
      ? { score: 0, center: null, angles: [], arms: [], shortestSpan: 0, threshold: null, strokeAngles: [], ratio: 0 }
      : thinCrossRecovery(cv, patch);
    let state;
    let reason;
    if (excessive) {
      state = MARK.ABNORMAL_DARK;
      reason = REVIEW_REASON.ABNORMAL_DARK;
    } else if (rawScore >= 0.80) {
      state = MARK.CLEAR_X;
      reason = null;
    } else if (lineLike) {
      state = MARK.SINGLE_LINE;
      reason = REVIEW_REASON.POSSIBLE_MARK;
    } else {
      state = MARK.UNCERTAIN;
      reason = rawScore >= 0.35 ? REVIEW_REASON.UNCLEAR_X : REVIEW_REASON.POSSIBLE_MARK;
    }
    let score = rawScore;
    if (excessive || touchesBorder || faint) score = Math.min(score, 0.85);
    return {
      state,
      xEvidence: score,
      rawXEvidence: rawScore,
      structuralXEvidence: structural,
      acceptedXEvidence: accepted,
      inkRatio: ratio,
      occupancy,
      lineRatio,
      orientationClutter: clutter,
      reason,
      area,
      components,
      touchesBorder,
      bbox: [bounds.x, bounds.y, bounds.width, bounds.height],
      inkCenter: bounds.center,
      patchShape: [patch.rows, patch.cols],
      strokeAngles,
      principalAngle,
      crossCenter: structuralResult.center ? [bounds.x + structuralResult.center[0], bounds.y + structuralResult.center[1]] : null,
      crossAngles: structuralResult.angles,
      thinXEvidence: thin.score,
      thinCrossCenter: thin.center,
      thinCrossAngles: thin.angles,
      thinArmEvidence: thin.arms,
      thinShortestArmSpan: thin.shortestSpan,
      thinThreshold: thin.threshold,
      thinStrokeAngles: thin.strokeAngles,
      thinInkRatio: thin.ratio,
      faint,
    };
  } finally {
    deleteMats(clean, crop);
  }
}

export function interpretTableMarks(details) {
  const selected = details.map((item, index) => [item, index])
    .filter(([item]) => item.state === MARK.CLEAR_X)
    .map(([, index]) => index);
  if (selected.length > 1) return { selected, reason: REVIEW_REASON.MULTIPLE };
  const abnormal = details.find((item) => item.state === MARK.ABNORMAL_DARK);
  if (abnormal) return { selected, reason: REVIEW_REASON.ABNORMAL_DARK };
  const unclear = details.find((item) => item.state === MARK.SINGLE_LINE || item.state === MARK.UNCERTAIN);
  if (unclear) return { selected, reason: unclear.reason || REVIEW_REASON.POSSIBLE_MARK };
  return { selected, reason: null };
}
