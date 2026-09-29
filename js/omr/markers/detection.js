import { combinations, distance, ordered, polygonArea, validatePoints } from '../geometry/points.js';
import { deleteMats } from '../core/memory.js';

function contourCenter(cv, contour) {
  const moments = cv.moments(contour, false);
  if (!moments.m00) return null;
  return [moments.m10 / moments.m00, moments.m01 / moments.m00];
}

export function markerCandidates(cv, rgbaOrGray) {
  const gray = new cv.Mat();
  const bw = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const candidates = [];
  try {
    if (rgbaOrGray.channels() === 1) rgbaOrGray.copyTo(gray);
    else cv.cvtColor(rgbaOrGray, gray, cv.COLOR_RGBA2GRAY);
    cv.adaptiveThreshold(gray, bw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 121, 12);
    cv.findContours(bw, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    const areaImage = gray.rows * gray.cols;
    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index);
      let poly = null;
      let mask = null;
      let filled = null;
      let single = null;
      try {
        const area = cv.contourArea(contour, false);
        if (!(areaImage * 0.00016 < area && area < areaImage * 0.008)) continue;
        poly = new cv.Mat();
        cv.approxPolyDP(contour, poly, 0.035 * cv.arcLength(contour, true), true);
        if (poly.rows !== 4 || !cv.isContourConvex(poly)) continue;
        const rectangle = cv.minAreaRect(contour);
        const width = rectangle.size.width;
        const height = rectangle.size.height;
        if (!height || !(0.60 < width / height && width / height < 1.65) || area / (width * height) < 0.84) continue;
        mask = cv.Mat.zeros(gray.rows, gray.cols, cv.CV_8U);
        single = new cv.MatVector();
        single.push_back(poly);
        cv.drawContours(mask, single, 0, new cv.Scalar(255), -1);
        filled = new cv.Mat();
        cv.bitwise_and(bw, mask, filled);
        const maskCount = cv.countNonZero(mask);
        if (!maskCount || cv.countNonZero(filled) / maskCount < 0.83) continue;
        const center = contourCenter(cv, contour);
        if (center && candidates.every((candidate) => distance(center, candidate.center) > 12)) {
          candidates.push({ area, center });
        }
      } finally {
        deleteMats(contour, poly, mask, filled, single);
      }
    }
    return candidates.sort((a, b) => b.area - a.area).slice(0, 16);
  } finally {
    deleteMats(gray, bw, contours, hierarchy);
  }
}

export function findMarkers(cv, image) {
  const candidates = markerCandidates(cv, image);
  let best = null;
  let largest = 0;
  for (const group of combinations(candidates, 4)) {
    const areas = group.map((candidate) => candidate.area);
    if (Math.max(...areas) / Math.min(...areas) > 3) continue;
    const points = ordered(group.map((candidate) => candidate.center));
    try {
      validatePoints(points, image.cols, image.rows);
    } catch {
      continue;
    }
    const area = polygonArea(points);
    if (area > largest) {
      largest = area;
      best = points;
    }
  }
  if (!best) throw new Error('ไม่พบจุดอ้างอิงครบ 4 มุม ถ่ายให้เห็นทั้งแผ่น หรือเลือกจุดอ้างอิงด้วยมือ');
  return best;
}

export function recoveredQuadScore(points, width, height) {
  try {
    validatePoints(points, width, height);
  } catch {
    return null;
  }
  const top = distance(points[1], points[0]);
  const right = distance(points[2], points[1]);
  const bottom = distance(points[2], points[3]);
  const left = distance(points[3], points[0]);
  if (Math.min(top, right, bottom, left) <= 0) return null;
  const ratio = ((top + bottom) / 2) / ((left + right) / 2);
  if (!(0.40 < ratio && ratio < 1.0)) return null;
  if (![top / bottom, left / right].every((value) => 0.48 < value && value < 2.1)) return null;
  const area = polygonArea(points);
  if (!(width * height * 0.12 < area && area < width * height * 0.96)) return null;
  return area * (1 - Math.min(0.45, Math.abs(ratio - 0.675)));
}

export function threeMarkerEstimates(cv, image) {
  const candidates = markerCandidates(cv, image);
  const estimates = [];
  for (const group of combinations(candidates, 3)) {
    const areas = group.map((item) => item.area);
    if (Math.max(...areas) / Math.min(...areas) > 2.5) continue;
    const detected = group.map((item) => item.center);
    for (let opposite = 0; opposite < 3; opposite += 1) {
      const adjacent = [0, 1, 2].filter((index) => index !== opposite);
      const virtual = [
        detected[adjacent[0]][0] + detected[adjacent[1]][0] - detected[opposite][0],
        detected[adjacent[0]][1] + detected[adjacent[1]][1] - detected[opposite][1],
      ];
      const quad = ordered([...detected, virtual]);
      const score = recoveredQuadScore(quad, image.cols, image.rows);
      if (score === null) continue;
      const missing = quad.reduce((best, point, index) => (distance(point, virtual) < distance(quad[best], virtual) ? index : best), 0);
      const mapped = new Set(detected.map((point) => quad.reduce((best, corner, index) => (
        distance(corner, point) < distance(quad[best], point) ? index : best
      ), 0)));
      if (mapped.size !== 3 || mapped.has(missing)) continue;
      estimates.push({ score, points: quad, missing });
    }
  }
  estimates.sort((a, b) => b.score - a.score);
  const unique = [];
  for (const estimate of estimates) {
    const duplicate = unique.some((other) => (
      estimate.points.reduce((sum, point, index) => sum + distance(point, other.points[index]), 0) / 4 < 8
    ));
    if (!duplicate) unique.push(estimate);
  }
  return unique;
}
