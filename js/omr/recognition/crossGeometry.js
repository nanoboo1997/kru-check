import { deleteMats } from '../core/memory.js';
import { cleanTableInk, matMean } from '../preprocessing/tableInk.js';

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function countBranches(canvas, cx, cy, radius, minimumArea) {
  const width = canvas.cols;
  const height = canvas.rows;
  const visited = new Uint8Array(width * height);
  let count = 0;
  for (let sy = 0; sy < height; sy += 1) {
    for (let sx = 0; sx < width; sx += 1) {
      const start = sy * width + sx;
      if (visited[start] || !canvas.ucharAt(sy, sx) || (sx - cx) ** 2 + (sy - cy) ** 2 <= radius ** 2) continue;
      const queue = [[sx, sy]];
      visited[start] = 1;
      let area = 0;
      while (queue.length) {
        const [x, y] = queue.pop();
        area += 1;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (!dx && !dy) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const index = ny * width + nx;
            if (visited[index] || !canvas.ucharAt(ny, nx) || (nx - cx) ** 2 + (ny - cy) ** 2 <= radius ** 2) continue;
            visited[index] = 1;
            queue.push([nx, ny]);
          }
        }
      }
      if (area >= minimumArea) count += 1;
    }
  }
  return count;
}

export function flexibleCrossGeometry(cv, ink) {
  const height = ink.rows;
  const width = ink.cols;
  if (Math.min(height, width) < 4) return { score: 0, center: null, angles: [] };
  const canvas = new cv.Mat();
  const near = new cv.Mat();
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  try {
    cv.resize(ink, canvas, new cv.Size(31, 31), 0, 0, cv.INTER_NEAREST);
    cv.dilate(canvas, near, kernel);
    const angles = Array.from({ length: 18 }, (_, index) => index * 10 * Math.PI / 180);
    const distances = Array.from({ length: 8 }, (_, index) => index + 4);
    let best = 0;
    let bestCenter = null;
    let bestAngles = [];
    for (let cy = 7; cy < 24; cy += 2) {
      for (let cx = 7; cx < 24; cx += 2) {
        const armsBySign = [-1, 1].map((sign) => angles.map((angle) => {
          const values = distances.map((distance) => {
            const x = Math.round(cx + sign * Math.cos(angle) * distance);
            const y = Math.round(cy + sign * Math.sin(angle) * distance);
            return x >= 0 && y >= 0 && x < 31 && y < 31 ? Number(near.ucharAt(y, x) > 0) : 0;
          });
          return Math.max(mean(values.slice(0, 4)), mean(values));
        }));
        const lines = armsBySign[0].map((value, index) => Math.min(value, armsBySign[1][index]));
        for (let first = 0; first < 18; first += 1) {
          for (let second = first + 3; second < Math.min(first + 16, 18); second += 1) {
            const value = Math.min(lines[first], lines[second]);
            if (value <= best) continue;
            let branches = false;
            for (const radius of [4, 6, 8]) {
              if (countBranches(canvas, cx, cy, radius, 4) >= 4) {
                branches = true;
                break;
              }
            }
            if (branches) {
              best = value;
              bestCenter = [((cx + 0.5) / 31) * width, ((cy + 0.5) / 31) * height];
              bestAngles = [first * 10, second * 10];
            }
          }
        }
      }
    }
    return { score: best, center: bestCenter, angles: bestAngles };
  } finally {
    deleteMats(canvas, near, kernel);
  }
}

function dilateArray31(source) {
  const output = new Uint8Array(31 * 31);
  for (let y = 0; y < 31; y += 1) {
    for (let x = 0; x < 31; x += 1) {
      let on = 0;
      for (let dy = -1; dy <= 1 && !on; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < 31 && ny < 31 && source[ny * 31 + nx]) {
            on = 1;
            break;
          }
        }
      }
      output[y * 31 + x] = on;
    }
  }
  return output;
}

export function acceptedMarkEvidence(cv, crop, templates) {
  const candidateMat = new cv.Mat();
  try {
    cv.resize(crop, candidateMat, new cv.Size(31, 31), 0, 0, cv.INTER_NEAREST);
    const candidate = Uint8Array.from(candidateMat.data, (value) => Number(value > 0));
    const near = dilateArray31(candidate);
    let best = 0;
    for (const template of templates) {
      const around = dilateArray31(template);
      let precisionNumerator = 0;
      let precisionDenominator = 0;
      let recallNumerator = 0;
      let recallDenominator = 0;
      let intersection = 0;
      let union = 0;
      for (let index = 0; index < candidate.length; index += 1) {
        if (candidate[index]) {
          precisionDenominator += 1;
          precisionNumerator += around[index];
        }
        if (template[index]) {
          recallDenominator += 1;
          recallNumerator += near[index];
        }
        if (candidate[index] && template[index]) intersection += 1;
        if (candidate[index] || template[index]) union += 1;
      }
      const precision = precisionNumerator / Math.max(1, precisionDenominator);
      const recall = recallNumerator / Math.max(1, recallDenominator);
      const overlap = intersection / Math.max(1, union);
      if (Math.min(precision, recall) >= 0.9 && overlap >= 0.55) best = Math.max(best, 0.85);
    }
    return best;
  } finally {
    deleteMats(candidateMat);
  }
}

export function angleDistance(first, second) {
  return Math.abs(((first - second + 90) % 180 + 180) % 180 - 90);
}

export function strokeSegments(cv, ink) {
  const binary = new cv.Mat();
  const lines = new cv.Mat();
  try {
    ink.convertTo(binary, cv.CV_8U, 255);
    cv.HoughLinesP(binary, lines, 1, Math.PI / 180, 5, 5, 3);
    const segments = [];
    for (let index = 0; index + 3 < lines.data32S.length; index += 4) {
      const [x1, y1, x2, y2] = lines.data32S.slice(index, index + 4);
      const dx = x2 - x1;
      const dy = y2 - y1;
      segments.push({ angle: ((Math.atan2(dy, dx) * 180 / Math.PI + 180) % 180), length: Math.hypot(dx, dy) });
    }
    return segments.sort((a, b) => b.length - a.length);
  } finally {
    deleteMats(binary, lines);
  }
}

export function mainStrokeAngles(cv, ink) {
  const segments = strokeSegments(cv, ink);
  if (!segments.length) return [];
  const first = segments[0].angle;
  const other = segments.find((segment) => angleDistance(segment.angle, first) > 25);
  return other ? [first, other.angle] : [first];
}

function lineSpan(values) {
  let span = 0;
  for (const value of values) {
    if (value) span += 1;
    else if (span >= 2) break;
  }
  return span;
}

export function thinHoughCross(cv, ink, expectedAngles) {
  const empty = { score: 0, center: null, angles: [], arms: [], shortestSpan: 0 };
  if (expectedAngles.length < 2) return empty;
  const canvas = new cv.Mat();
  const input = new cv.Mat();
  const lines = new cv.Mat();
  const near = new cv.Mat();
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  try {
    cv.resize(ink, canvas, new cv.Size(31, 31), 0, 0, cv.INTER_NEAREST);
    canvas.convertTo(input, cv.CV_8U, 255);
    cv.HoughLines(input, lines, 1, Math.PI / 180, 5);
    if (!lines.data32F.length) return empty;
    const unique = [];
    for (let index = 0; index + 1 < lines.data32F.length && unique.length < 24; index += 2) {
      const rho = lines.data32F[index];
      const theta = lines.data32F[index + 1];
      const direction = (theta * 180 / Math.PI + 90) % 180;
      if (unique.some((item) => Math.abs(rho - item.rho) < 2 && angleDistance(direction, item.direction) < 8)) continue;
      unique.push({ rho, theta, direction });
    }
    cv.dilate(canvas, near, kernel);
    const distances = Array.from({ length: 12 }, (_, index) => index + 2);
    let best = empty;
    let bestRank = [0, 0];
    for (let first = 0; first < unique.length; first += 1) {
      for (let second = first + 1; second < unique.length; second += 1) {
        const one = unique[first];
        const two = unique[second];
        const separation = angleDistance(one.direction, two.direction);
        if (separation < 30 || separation > 150) continue;
        const matches = (
          angleDistance(one.direction, expectedAngles[0]) <= 20 && angleDistance(two.direction, expectedAngles[1]) <= 20
        ) || (
          angleDistance(one.direction, expectedAngles[1]) <= 20 && angleDistance(two.direction, expectedAngles[0]) <= 20
        );
        if (!matches) continue;
        const a = Math.cos(one.theta);
        const b = Math.sin(one.theta);
        const c = Math.cos(two.theta);
        const d = Math.sin(two.theta);
        const determinant = a * d - b * c;
        if (Math.abs(determinant) < 0.1) continue;
        const cx = (one.rho * d - b * two.rho) / determinant;
        const cy = (a * two.rho - one.rho * c) / determinant;
        if (cx < 4 || cx > 26 || cy < 4 || cy > 26) continue;
        const arms = [];
        const spans = [];
        for (const direction of [one.direction, two.direction]) {
          const radians = direction * Math.PI / 180;
          for (const sign of [-1, 1]) {
            const values = distances.map((distance) => {
              const x = Math.max(0, Math.min(30, Math.round(cx) + sign * Math.round(distance * Math.cos(radians))));
              const y = Math.max(0, Math.min(30, Math.round(cy) + sign * Math.round(distance * Math.sin(radians))));
              return Number(near.ucharAt(y, x) > 0);
            });
            arms.push(Math.max(mean(values.slice(0, 3)), mean(values)));
            spans.push(lineSpan(values));
          }
        }
        let branches = 0;
        for (const radius of [3, 4, 5]) branches = Math.max(branches, countBranches(canvas, Math.round(cx), Math.round(cy), radius, 2));
        if (branches < 3) continue;
        const sorted = arms.slice().sort((x, y) => y - x);
        const score = Math.min(sorted[2], sorted[3] * 1.8);
        const shortestSpan = Math.min(...spans);
        if (score > bestRank[0] || (score === bestRank[0] && shortestSpan > bestRank[1])) {
          bestRank = [score, shortestSpan];
          best = {
            score,
            center: [(cx / 31) * ink.cols, (cy / 31) * ink.rows],
            angles: [one.direction, two.direction],
            arms,
            shortestSpan,
          };
        }
      }
    }
    return best;
  } finally {
    deleteMats(canvas, input, lines, near, kernel);
  }
}

export function thinCrossRecovery(cv, patch) {
  let best = { score: 0, center: null, angles: [], arms: [], shortestSpan: 0, threshold: null, strokeAngles: [], ratio: 0 };
  let bestRank = [0, 0];
  for (const threshold of [214, 218, 222, 226, 230, 234, 238]) {
    const ink = cleanTableInk(cv, patch, threshold);
    try {
      const ratio = matMean(ink);
      if (ratio < 0.008 || ratio > 0.18) continue;
      const strokeAngles = mainStrokeAngles(cv, ink);
      if (strokeAngles.length < 2 || angleDistance(strokeAngles[0], strokeAngles[1]) < 30 || angleDistance(strokeAngles[0], strokeAngles[1]) > 150) continue;
      const result = thinHoughCross(cv, ink, strokeAngles);
      const rank = [result.score, result.shortestSpan];
      if (rank[0] > bestRank[0] || (rank[0] === bestRank[0] && rank[1] > bestRank[1])) {
        bestRank = rank;
        best = { ...result, threshold, strokeAngles, ratio };
      }
    } finally {
      deleteMats(ink);
    }
  }
  return best;
}

export function orientationClutter(cv, ink) {
  const segments = strokeSegments(cv, ink);
  if (!segments.length) return 0;
  const first = segments[0].angle;
  const second = segments.find((segment) => angleDistance(segment.angle, first) > 25)?.angle;
  if (second === undefined) return 0;
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  const outside = segments.filter((segment) => Math.min(angleDistance(segment.angle, first), angleDistance(segment.angle, second)) > 15)
    .reduce((sum, segment) => sum + segment.length, 0);
  return total ? outside / total : 0;
}
