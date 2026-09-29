import { MARKER_TARGETS, SHEET_HEIGHT, SHEET_WIDTH } from '../constants.js';
import { cyclic, distance, validatePoints } from '../geometry/points.js';
import { deleteMats } from '../core/memory.js';
import { findMarkers, threeMarkerEstimates } from '../markers/detection.js';
import { answerGeometry } from './tableGeometry.js';

export class LegacyMarkerRecoveryError extends Error {
  constructor(message, points = null, missingIndex = null) {
    super(message);
    this.name = 'LegacyMarkerRecoveryError';
    this.points = points;
    this.missingIndex = missingIndex;
  }
}

function pointMat(cv, points) {
  return cv.matFromArray(4, 1, cv.CV_32FC2, points.flat());
}

function normalizedGray(cv, rgba) {
  const gray = new cv.Mat();
  const background = new cv.Mat();
  const normalized = new cv.Mat();
  try {
    if (rgba.channels() === 1) rgba.copyTo(gray);
    else cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, background, new cv.Size(0, 0), 21, 21, cv.BORDER_DEFAULT);
    cv.divide(gray, background, normalized, 255);
    return normalized;
  } finally {
    deleteMats(gray, background);
  }
}

function orientationScore(normalized) {
  let dark = 0;
  let total = 0;
  for (let y = 112; y < 129; y += 1) {
    for (let x = 62; x < 79; x += 1) {
      if (normalized.ucharAt(y, x) < 120) dark += 1;
      total += 1;
    }
  }
  return dark / total;
}

export function rectificationCandidates(cv, image, points) {
  const candidates = [];
  for (let rotation = 0; rotation < 4; rotation += 1) {
    const corners = cyclic(points, rotation).map((point) => [...point]);
    const source = pointMat(cv, corners);
    const target = pointMat(cv, MARKER_TARGETS);
    const transform = cv.getPerspectiveTransform(source, target);
    const warped = new cv.Mat();
    let normalized = null;
    try {
      cv.warpPerspective(image, warped, transform, new cv.Size(SHEET_WIDTH, SHEET_HEIGHT), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(255, 255, 255, 255));
      normalized = normalizedGray(cv, warped);
      candidates.push({ score: orientationScore(normalized), warped, normalized, corners });
    } catch (error) {
      deleteMats(warped, normalized);
      throw error;
    } finally {
      deleteMats(source, target, transform);
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function discardCandidates(candidates, keep = []) {
  const retained = new Set(keep);
  for (const candidate of candidates) {
    if (!retained.has(candidate)) deleteMats(candidate.warped, candidate.normalized);
  }
}

export function legacyTableAlignments(cv, image, points) {
  const candidates = rectificationCandidates(cv, image, points);
  const plausible = [];
  for (const candidate of candidates) {
    try {
      const { layout, boxes } = answerGeometry(cv, candidate.normalized, 40, null, true);
      if (layout !== 'table40') continue;
      const flat = boxes.flat();
      const left = Math.min(...flat.map((box) => box[0]));
      const top = Math.min(...flat.map((box) => box[1]));
      const right = Math.max(...flat.map((box) => box[2]));
      const bottom = Math.max(...flat.map((box) => box[3]));
      if (right - left >= SHEET_WIDTH * 0.65 && bottom - top >= SHEET_HEIGHT * 0.12 && (top + bottom) / 2 < SHEET_HEIGHT * 0.50) {
        plausible.push(candidate);
      }
    } catch {
      // Not the unique legacy-table orientation.
    }
  }
  discardCandidates(candidates, plausible);
  return plausible;
}

export function rectify(cv, image, points = null) {
  const markerPoints = points || findMarkers(cv, image);
  validatePoints(markerPoints, image.cols, image.rows);
  const candidates = rectificationCandidates(cv, image, markerPoints);
  const best = candidates[0];
  if (best.score < 0.55) {
    discardCandidates(candidates);
    throw new Error('ไม่พบจุดบอกทิศทางใต้สี่เหลี่ยมมุมซ้ายบน แม้ลองหมุนภาพครบแล้ว กรุณาถ่ายให้เห็นจุดดำครบ ใช้ฟอร์มที่เพิ่มจุดสแกนแล้ว หรือเลือกกลางจุดอ้างอิง 4 มุมด้วยมือ');
  }
  if (candidates[1].score >= 0.55) {
    discardCandidates(candidates);
    throw new Error('จุดบอกทิศทางกำกวม กรุณาตรวจว่าจุดดำไม่ทับข้อความ และถ่ายให้เห็นกระดาษชัดทั้งแผ่น');
  }
  discardCandidates(candidates, [best]);
  return best;
}

export function recoverLegacyMarkers(cv, image) {
  const estimates = threeMarkerEstimates(cv, image);
  const solutions = [];
  for (const estimate of estimates) {
    const alignments = legacyTableAlignments(cv, image, estimate.points);
    if (alignments.length !== 1) {
      discardCandidates(alignments);
      continue;
    }
    const result = alignments[0];
    const virtual = estimate.points[estimate.missing];
    const missing = result.corners.reduce((best, point, index) => (
      distance(point, virtual) < distance(result.corners[best], virtual) ? index : best
    ), 0);
    solutions.push({ ...result, recoveryScore: estimate.score, missing });
  }
  if (solutions.length === 1) return solutions[0];
  if (solutions.length > 1) {
    const first = solutions[0];
    solutions.forEach((solution) => deleteMats(solution.warped, solution.normalized));
    throw new LegacyMarkerRecoveryError(
      'พบจุดอ้างอิง 3 จาก 4 จุด แต่ตำแหน่งมุมที่หายยังกำกวม กรุณาแตะตำแหน่ง marker เสมือนเพื่อยืนยันหรือแก้ไข',
      first.corners,
      first.missing,
    );
  }
  if (estimates.length) {
    throw new LegacyMarkerRecoveryError(
      'พบจุดอ้างอิง 3 จาก 4 จุด กรุณาแตะตำแหน่ง marker เสมือนเพื่อยืนยันหรือแก้ไข',
      estimates[0].points,
      estimates[0].missing,
    );
  }
  throw new Error('ไม่พบจุดอ้างอิงครบ 3 มุม กรุณาใช้การเลือกจุดอ้างอิงด้วยมือ');
}

export function rectifyLegacy(cv, image, points = null) {
  try {
    return { ...rectify(cv, image, points), method: 'legacy-4-marker' };
  } catch (error) {
    if (!points && String(error.message).includes('ไม่พบจุดอ้างอิงครบ 4 มุม')) {
      return { ...recoverLegacyMarkers(cv, image), method: '3-marker-recovery' };
    }
    if (!String(error.message).includes('จุดบอกทิศทาง')) throw error;
  }
  const markerPoints = points || findMarkers(cv, image);
  validatePoints(markerPoints, image.cols, image.rows);
  const plausible = legacyTableAlignments(cv, image, markerPoints);
  if (plausible.length === 1) return { ...plausible[0], method: 'legacy-table-orientation' };
  if (plausible.length > 1) {
    discardCandidates(plausible);
    throw new Error('ทิศทางกระดาษแบบเก่ายังกำกวม กรุณาหมุนให้หัวกระดาษอยู่ด้านบน แล้วถ่ายใหม่ให้เห็นทั้งแผ่น');
  }
  if (!points) return { ...recoverLegacyMarkers(cv, image), method: '3-marker-recovery' };
  throw new Error('ยังยืนยันทิศทางกระดาษแบบเก่าไม่ได้ กรุณาถ่ายใหม่ให้เห็น marker 4 มุมและตาราง 40 ข้อครบชัดเจน');
}
