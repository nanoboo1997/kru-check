import { deleteMats } from '../core/memory.js';

export function removeSmallComponents(cv, binary, minimumArea = 3) {
  const labels = new cv.Mat();
  const stats = new cv.Mat();
  const centroids = new cv.Mat();
  const clean = cv.Mat.zeros(binary.rows, binary.cols, cv.CV_8U);
  try {
    const count = cv.connectedComponentsWithStats(binary, labels, stats, centroids, 8, cv.CV_32S);
    for (let component = 1; component < count; component += 1) {
      const area = stats.intAt(component, cv.CC_STAT_AREA);
      if (area < minimumArea) continue;
      for (let y = 0; y < labels.rows; y += 1) {
        for (let x = 0; x < labels.cols; x += 1) {
          if (labels.intAt(y, x) === component) clean.ucharPtr(y, x)[0] = 1;
        }
      }
    }
    return clean;
  } finally {
    deleteMats(labels, stats, centroids);
  }
}

/** Remove long printed cell edges while preserving disconnected pen strokes. */
export function cleanTableInk(cv, patch, threshold = 210) {
  const ink = new cv.Mat();
  const vertical = new cv.Mat();
  const horizontal = new cv.Mat();
  const rules = new cv.Mat();
  const union = new cv.Mat();
  const ph = patch.rows;
  const pw = patch.cols;
  const verticalKernel = cv.Mat.ones(Math.max(8, Math.floor(ph * 0.7)), 1, cv.CV_8U);
  const horizontalKernel = cv.Mat.ones(1, Math.max(8, Math.floor(pw * 0.7)), cv.CV_8U);
  const dilateKernel = cv.Mat.ones(3, 3, cv.CV_8U);
  try {
    cv.threshold(patch, ink, threshold - 1, 1, cv.THRESH_BINARY_INV);
    cv.morphologyEx(ink, vertical, cv.MORPH_OPEN, verticalKernel);
    cv.morphologyEx(ink, horizontal, cv.MORPH_OPEN, horizontalKernel);
    const edgeX = Math.max(2, Math.floor(pw * 0.16));
    const edgeY = Math.max(2, Math.floor(ph * 0.16));
    for (let y = 0; y < ph; y += 1) {
      for (let x = edgeX; x < pw - edgeX; x += 1) vertical.ucharPtr(y, x)[0] = 0;
    }
    for (let y = edgeY; y < ph - edgeY; y += 1) {
      for (let x = 0; x < pw; x += 1) horizontal.ucharPtr(y, x)[0] = 0;
    }
    cv.bitwise_or(vertical, horizontal, union);
    cv.dilate(union, rules, dilateKernel);
    for (let y = 0; y < ph; y += 1) {
      for (let x = 0; x < pw; x += 1) {
        if (rules.ucharAt(y, x)) ink.ucharPtr(y, x)[0] = 0;
      }
    }
    return removeSmallComponents(cv, ink, 3);
  } finally {
    deleteMats(ink, vertical, horizontal, rules, union, verticalKernel, horizontalKernel, dilateKernel);
  }
}

export function binaryBounds(mat) {
  let left = mat.cols;
  let top = mat.rows;
  let right = -1;
  let bottom = -1;
  let area = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = 0; y < mat.rows; y += 1) {
    for (let x = 0; x < mat.cols; x += 1) {
      if (!mat.ucharAt(y, x)) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      area += 1;
      sumX += x;
      sumY += y;
    }
  }
  if (!area) return null;
  return {
    x: left,
    y: top,
    width: right - left + 1,
    height: bottom - top + 1,
    area,
    center: [sumX / area, sumY / area],
  };
}

export function componentCount(cv, binary) {
  const labels = new cv.Mat();
  try {
    return Math.max(0, cv.connectedComponents(binary, labels, 8, cv.CV_32S) - 1);
  } finally {
    deleteMats(labels);
  }
}

export function matMean(binary) {
  return cvCount(binary) / Math.max(1, binary.rows * binary.cols);
}

export function cvCount(binary) {
  let count = 0;
  for (let y = 0; y < binary.rows; y += 1) {
    for (let x = 0; x < binary.cols; x += 1) if (binary.ucharAt(y, x)) count += 1;
  }
  return count;
}
