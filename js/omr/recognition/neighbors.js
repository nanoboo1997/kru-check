import { MARK } from '../constants.js';
import { deleteMats } from '../core/memory.js';
import { removeSmallComponents } from '../preprocessing/tableInk.js';
import { angleDistance, flexibleCrossGeometry } from './crossGeometry.js';

function sharedCellEdge(first, second, tolerance = 6) {
  const [al, at, ar, ab] = first;
  const [bl, bt, br, bb] = second;
  const overlapY = Math.max(0, Math.min(ab, bb) - Math.max(at, bt));
  const overlapX = Math.max(0, Math.min(ar, br) - Math.max(al, bl));
  if (overlapY >= Math.min(ab - at, bb - bt) * 0.55) {
    if (Math.abs(ar - bl) <= tolerance) return ['right', 'left'];
    if (Math.abs(br - al) <= tolerance) return ['left', 'right'];
  }
  if (overlapX >= Math.min(ar - al, br - bl) * 0.55) {
    if (Math.abs(ab - bt) <= tolerance) return ['bottom', 'top'];
    if (Math.abs(bb - at) <= tolerance) return ['top', 'bottom'];
  }
  if (Math.abs(ar - bl) <= tolerance && Math.abs(ab - bt) <= tolerance) return ['bottom_right', 'top_left'];
  if (Math.abs(al - br) <= tolerance && Math.abs(ab - bt) <= tolerance) return ['bottom_left', 'top_right'];
  if (Math.abs(ar - bl) <= tolerance && Math.abs(at - bb) <= tolerance) return ['top_right', 'bottom_left'];
  if (Math.abs(al - br) <= tolerance && Math.abs(at - bb) <= tolerance) return ['top_left', 'bottom_right'];
  return null;
}

function touchesFacingSide(detail, side, tolerance = 2) {
  if (!detail.bbox) return false;
  const [x, y, width, height] = detail.bbox;
  const [patchHeight, patchWidth] = detail.patchShape;
  const contacts = {
    left: x <= tolerance,
    right: x + width >= patchWidth - tolerance,
    top: y <= tolerance,
    bottom: y + height >= patchHeight - tolerance,
  };
  return side.split('_').every((part) => contacts[part]);
}

function globalInkCenter(detail, box) {
  return [box[0] + 3 + detail.inkCenter[0], box[1] + 3 + detail.inkCenter[1]];
}

function crossIsInterior(detail, margin = 3) {
  if (!detail.crossCenter) return false;
  const [x, y] = detail.crossCenter;
  const [height, width] = detail.patchShape;
  return margin < x && x < width - margin && margin < y && y < height - margin;
}

function crossNearSide(detail, box, side, tolerance = 8) {
  let near;
  if (detail.crossCenter) {
    const [x, y] = detail.crossCenter;
    const [height, width] = detail.patchShape;
    near = { left: x <= tolerance, right: width - x <= tolerance, top: y <= tolerance, bottom: height - y <= tolerance };
  } else if (detail.contextCrossCenter) {
    const [x, y] = detail.contextCrossCenter;
    const [left, top, right, bottom] = box;
    near = { left: x - left <= tolerance, right: right - x <= tolerance, top: y - top <= tolerance, bottom: bottom - y <= tolerance };
  } else return false;
  return side.split('_').every((part) => near[part]);
}

function shallowBorderTail(detail, side) {
  const [, , width, height] = detail.bbox;
  const [patchHeight, patchWidth] = detail.patchShape;
  const shallow = {
    left: width <= Math.max(5, patchWidth * 0.18),
    right: width <= Math.max(5, patchWidth * 0.18),
    top: height <= Math.max(5, patchHeight * 0.24),
    bottom: height <= Math.max(5, patchHeight * 0.24),
  };
  return side.split('_').every((part) => shallow[part]);
}

function neighboringXOwnsStroke(suspect, suspectBox, suspectSide, owner, ownerBox, ownerSide) {
  if (![MARK.SINGLE_LINE, MARK.UNCERTAIN, MARK.CLEAR_X].includes(suspect.state)) return false;
  if (owner.state !== MARK.CLEAR_X) return false;
  if ((suspect.structuralXEvidence ?? suspect.rawXEvidence ?? 0) >= 0.35 && crossIsInterior(suspect)) return false;
  if ((suspect.components ?? 9) > 2 || (suspect.area ?? 0) > (owner.area ?? 0) * 0.72) return false;
  const suspectTolerance = suspectSide.includes('_') ? 10 : 2;
  const ownerTolerance = ownerSide.includes('_') ? 6 : 4;
  if (!touchesFacingSide(suspect, suspectSide, suspectTolerance)) return false;
  if (!touchesFacingSide(owner, ownerSide, ownerTolerance)) return false;
  if (shallowBorderTail(suspect, suspectSide)
      && (suspect.area ?? 0) <= (owner.area ?? 0) * 0.45
      && crossNearSide(owner, ownerBox, ownerSide)) return true;
  const ownerAngles = owner.strokeAngles || [];
  let suspectAngles = suspect.strokeAngles || [];
  if (!suspectAngles.length && suspect.principalAngle !== null && suspect.principalAngle !== undefined) suspectAngles = [suspect.principalAngle];
  if (ownerAngles.length < 2 || !suspectAngles.length || !crossIsInterior(owner, 2)) return false;
  const ownerCenter = owner.crossCenter
    ? [ownerBox[0] + 3 + owner.crossCenter[0], ownerBox[1] + 3 + owner.crossCenter[1]]
    : globalInkCenter(owner, ownerBox);
  const suspectCenter = globalInkCenter(suspect, suspectBox);
  const dx = suspectCenter[0] - ownerCenter[0];
  const dy = suspectCenter[1] - ownerCenter[1];
  if (Math.hypot(dx, dy) < 1) return false;
  const direction = ((Math.atan2(dy, dx) * 180 / Math.PI + 180) % 180);
  const matching = ownerAngles.filter((angle) => angleDistance(angle, direction) <= 22);
  return matching.some((angle) => angleDistance(angle, suspectAngles[0]) <= 18);
}

export function removeNeighboringXTails(details, boxes) {
  const cells = boxes.flatMap((group, question) => group.map((box, choice) => ({ question, choice, box, detail: details[question][choice] })));
  for (const cell of cells) {
    if (![MARK.SINGLE_LINE, MARK.UNCERTAIN, MARK.CLEAR_X].includes(cell.detail.state)) continue;
    const owners = [];
    for (const other of cells) {
      const edge = sharedCellEdge(cell.box, other.box);
      if (edge && neighboringXOwnsStroke(cell.detail, cell.box, edge[0], other.detail, other.box, edge[1])) {
        owners.push([other.question, other.choice]);
      }
    }
    if (owners.length === 1) {
      cell.detail.state = MARK.CLEAR_BLANK;
      cell.detail.reason = null;
      cell.detail.neighborContamination = true;
    }
  }
}

export function promoteUniqueThinX(details) {
  for (const row of details) {
    const candidates = row.filter((item) => item.thinXEvidence >= 0.80 && [MARK.SINGLE_LINE, MARK.UNCERTAIN].includes(item.state));
    if (candidates.length !== 1) continue;
    const candidate = candidates[0];
    if (row.some((item) => item !== candidate && item.state !== MARK.CLEAR_BLANK)) continue;
    const center = candidate.thinCrossCenter;
    if (!center) continue;
    const [height, width] = candidate.patchShape || [0, 0];
    const centered = width && height && center[0] / width >= 0.28 && center[0] / width <= 0.72
      && center[1] / height >= 0.28 && center[1] / height <= 0.72;
    const shortestSpan = candidate.thinShortestArmSpan || 0;
    if (shortestSpan < 5 && !(shortestSpan >= 3 && centered)) continue;
    candidate.state = MARK.CLEAR_X;
    candidate.reason = null;
    candidate.xEvidence = Math.max(candidate.xEvidence || 0, candidate.thinXEvidence);
    candidate.structuralXEvidence = Math.max(candidate.structuralXEvidence || 0, candidate.thinXEvidence);
    candidate.crossCenter = center;
    candidate.crossAngles = candidate.thinCrossAngles || [];
    candidate.thinRecovered = true;
  }
}

export function addContextualTableX(cv, normalized, details, boxes) {
  const ink = new cv.Mat();
  try {
    cv.threshold(normalized, ink, 209, 1, cv.THRESH_BINARY_INV);
    for (const group of boxes) {
      for (const [left, top, right, bottom] of group) {
        for (let y = Math.max(0, top - 1); y < Math.min(ink.rows, top + 2); y += 1) {
          for (let x = left; x <= right && x < ink.cols; x += 1) if (x >= 0) ink.ucharPtr(y, x)[0] = 0;
        }
        for (let y = Math.max(0, bottom - 1); y < Math.min(ink.rows, bottom + 2); y += 1) {
          for (let x = left; x <= right && x < ink.cols; x += 1) if (x >= 0) ink.ucharPtr(y, x)[0] = 0;
        }
        for (let y = top; y <= bottom && y < ink.rows; y += 1) {
          if (y < 0) continue;
          for (let x = Math.max(0, left - 1); x < Math.min(ink.cols, left + 2); x += 1) ink.ucharPtr(y, x)[0] = 0;
          for (let x = Math.max(0, right - 1); x < Math.min(ink.cols, right + 2); x += 1) ink.ucharPtr(y, x)[0] = 0;
        }
      }
    }
    for (let question = 0; question < boxes.length; question += 1) {
      for (let choice = 0; choice < 4; choice += 1) {
        const [left, top, right, bottom] = boxes[question][choice];
        const detail = details[question][choice];
        if ([MARK.CLEAR_BLANK, MARK.ABNORMAL_DARK].includes(detail.state)) continue;
        if (detail.state === MARK.CLEAR_X && !detail.touchesBorder) continue;
        const pad = Math.max(8, Math.round(Math.min(right - left, bottom - top) * 0.35));
        const x1 = Math.max(0, left - pad);
        const y1 = Math.max(0, top - pad);
        const x2 = Math.min(ink.cols, right + pad);
        const y2 = Math.min(ink.rows, bottom + pad);
        const context = ink.roi(new cv.Rect(x1, y1, x2 - x1, y2 - y1));
        const clean = removeSmallComponents(cv, context, 3);
        try {
          const result = flexibleCrossGeometry(cv, clean);
          if (result.score < 0.80 || !result.center) continue;
          const gx = x1 + result.center[0];
          const gy = y1 + result.center[1];
          if (!(left + 2 < gx && gx < right - 2 && top + 2 < gy && gy < bottom - 2)) continue;
          detail.state = MARK.CLEAR_X;
          detail.reason = null;
          detail.structuralXEvidence = Math.max(detail.structuralXEvidence || 0, result.score);
          detail.contextXEvidence = result.score;
          detail.contextCrossCenter = [gx, gy];
          detail.contextCrossAngles = result.angles;
        } finally {
          deleteMats(context, clean);
        }
      }
    }
  } finally {
    deleteMats(ink);
  }
}
