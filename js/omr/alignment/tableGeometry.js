import { ordered } from '../geometry/points.js';
import { deleteMats } from '../core/memory.js';

function darkRatio(mat, left, top, right, bottom, threshold) {
  let dark = 0;
  let total = 0;
  const x1 = Math.max(0, left);
  const y1 = Math.max(0, top);
  const x2 = Math.min(mat.cols, right);
  const y2 = Math.min(mat.rows, bottom);
  for (let y = y1; y < y2; y += 1) {
    for (let x = x1; x < x2; x += 1) {
      if (mat.ucharAt(y, x) < threshold) dark += 1;
      total += 1;
    }
  }
  return total ? dark / total : 0;
}

function profileDot(mat, y) {
  let best = 0;
  for (let dy = -8; dy <= 8; dy += 2) {
    for (let dx = -8; dx <= 8; dx += 2) {
      best = Math.max(best, darkRatio(mat, 63 + dx, y + dy - 7, 78 + dx, y + dy + 8, 150));
    }
  }
  return best > 0.6;
}

function axisCounts(mat, axis) {
  const length = axis === 'x' ? mat.cols : mat.rows;
  const other = axis === 'x' ? mat.rows : mat.cols;
  const counts = new Float64Array(length);
  for (let point = 0; point < length; point += 1) {
    let count = 0;
    for (let cross = 0; cross < other; cross += 1) {
      const value = axis === 'x' ? mat.ucharAt(cross, point) : mat.ucharAt(point, cross);
      if (value > 0) count += 1;
    }
    counts[point] = count;
  }
  return counts;
}

function groupedLines(values, threshold) {
  const points = [];
  values.forEach((value, index) => { if (value > threshold) points.push(index); });
  if (!points.length) return [];
  const groups = [[points[0]]];
  for (let index = 1; index < points.length; index += 1) {
    if (points[index] - points[index - 1] > 2) groups.push([]);
    groups[groups.length - 1].push(points[index]);
  }
  return groups.map((group) => Math.round(group.reduce((sum, value) => sum + value, 0) / group.length));
}

function transformBox(cv, inverse, box) {
  const [left, top, right, bottom] = box;
  const source = cv.matFromArray(4, 1, cv.CV_32FC2, [
    left, top, right, top, right, bottom, left, bottom,
  ]);
  const output = new cv.Mat();
  try {
    cv.perspectiveTransform(source, output, inverse);
    const values = Array.from(output.data32F);
    const xs = [values[0], values[2], values[4], values[6]];
    const ys = [values[1], values[3], values[5], values[7]];
    return [Math.round(Math.min(...xs)), Math.round(Math.min(...ys)), Math.round(Math.max(...xs)), Math.round(Math.max(...ys))];
  } finally {
    deleteMats(source, output);
  }
}

function defaultTableSpec() {
  return {
    rows: 12,
    cols: 20,
    mapping: Array.from({ length: 40 }, (_, index) => ({
      row: (index % 10) + 2,
      columns: Array.from({ length: 4 }, (__, choice) => Math.floor(index / 10) * 5 + choice + 1),
    })),
  };
}

export function answerGeometry(cv, normalized, count, profile = null, allowLegacyTable = false) {
  const gridProfile = profileDot(normalized, 180) && profileDot(normalized, 216);
  if (gridProfile || allowLegacyTable) {
    if (profile && count !== profile.count) throw new Error(`กระดาษแบบนี้มี ${profile.count} ข้อ กรุณาเลือกข้อสอบจำนวนข้อเดียวกัน`);
    if (!profile && count !== 40) throw new Error('กระดาษตารางนี้มี 40 ข้อ กรุณาเลือกข้อสอบ 40 ข้อ');
    const specification = profile || defaultTableSpec();
    const ink = new cv.Mat();
    const closeH = new cv.Mat();
    const closeV = new cv.Mat();
    const horizontal = new cv.Mat();
    const vertical = new cv.Mat();
    const combined = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    const kernelCloseH = cv.Mat.ones(1, 5, cv.CV_8U);
    const kernelCloseV = cv.Mat.ones(5, 1, cv.CV_8U);
    const kernelOpenH = cv.Mat.ones(1, 40, cv.CV_8U);
    const kernelOpenV = cv.Mat.ones(40, 1, cv.CV_8U);
    try {
      cv.threshold(normalized, ink, 224, 255, cv.THRESH_BINARY_INV);
      cv.morphologyEx(ink, closeH, cv.MORPH_CLOSE, kernelCloseH);
      cv.morphologyEx(closeH, horizontal, cv.MORPH_OPEN, kernelOpenH);
      cv.morphologyEx(ink, closeV, cv.MORPH_CLOSE, kernelCloseV);
      cv.morphologyEx(closeV, vertical, cv.MORPH_OPEN, kernelOpenV);
      cv.bitwise_or(horizontal, vertical, combined);
      cv.findContours(combined, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      const ranked = [];
      for (let index = 0; index < contours.size(); index += 1) {
        const contour = contours.get(index);
        ranked.push([cv.contourArea(contour, false), index]);
        contour.delete();
      }
      ranked.sort((a, b) => b[0] - a[0]);
      for (const [, contourIndex] of ranked) {
        const contour = contours.get(contourIndex);
        let hull = null;
        let polygon = null;
        let localV = null;
        let localH = null;
        let localInk = null;
        let inverse = null;
        let matrix = null;
        let dilatedV = null;
        let dilatedH = null;
        let bandV = null;
        let bandH = null;
        try {
          const rect = cv.boundingRect(contour);
          const { x, y, width: w, height: h } = rect;
          if (w < 120 || h < 60 || h > 1250) continue;
          hull = new cv.Mat();
          polygon = new cv.Mat();
          cv.convexHull(contour, hull, false, true);
          cv.approxPolyDP(hull, polygon, 0.015 * cv.arcLength(hull, true), true);
          localV = vertical.roi(new cv.Rect(x, y, w, h));
          localH = horizontal.roi(new cv.Rect(x, y, w, h));
          let xs = groupedLines(axisCounts(localV, 'x'), h * 0.65);
          let ys = groupedLines(axisCounts(localH, 'y'), w * 0.60);
          const oldMatches = xs.length === specification.cols + 1 && ys.length === specification.rows + 1;
          if (!oldMatches && polygon.rows === 4 && cv.isContourConvex(polygon)) {
            const raw = Array.from(polygon.data32S);
            const quad = ordered(Array.from({ length: 4 }, (_, index) => [raw[index * 2], raw[index * 2 + 1]]));
            const source = cv.matFromArray(4, 1, cv.CV_32FC2, quad.flat());
            const target = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, w - 1, 0, w - 1, h - 1, 0, h - 1]);
            matrix = cv.getPerspectiveTransform(source, target);
            inverse = cv.getPerspectiveTransform(target, source);
            localInk = new cv.Mat();
            cv.warpPerspective(ink, localInk, matrix, new cv.Size(w, h), cv.INTER_NEAREST, cv.BORDER_CONSTANT, new cv.Scalar(0));
            localH.delete();
            localV.delete();
            localH = new cv.Mat();
            localV = new cv.Mat();
            const openH = cv.Mat.ones(1, 30, cv.CV_8U);
            const openV = cv.Mat.ones(30, 1, cv.CV_8U);
            cv.morphologyEx(localInk, localH, cv.MORPH_OPEN, openH);
            cv.morphologyEx(localInk, localV, cv.MORPH_OPEN, openV);
            deleteMats(source, target, openH, openV);
            xs = groupedLines(axisCounts(localV, 'x'), h * 0.30);
            ys = groupedLines(axisCounts(localH, 'y'), w * 0.55);
            if (xs.length !== specification.cols + 1 || ys.length !== specification.rows + 1) {
              dilatedV = new cv.Mat();
              dilatedH = new cv.Mat();
              bandV = cv.Mat.ones(1, 9, cv.CV_8U);
              bandH = cv.Mat.ones(9, 1, cv.CV_8U);
              cv.dilate(localV, dilatedV, bandV);
              cv.dilate(localH, dilatedH, bandH);
              xs = groupedLines(axisCounts(dilatedV, 'x'), h * 0.45);
              ys = groupedLines(axisCounts(dilatedH, 'y'), w * 0.45);
            }
          }
          if (xs.length !== specification.cols + 1 || ys.length !== specification.rows + 1) continue;
          if (!inverse) {
            xs = xs.map((value) => value + x);
            ys = ys.map((value) => value + y);
          }
          const boxes = specification.mapping.map((entry) => entry.columns.map((column) => {
            const box = [xs[column], ys[entry.row], xs[column + 1], ys[entry.row + 1]];
            return inverse ? transformBox(cv, inverse, box) : box;
          }));
          if (boxes.flat().some(([left, top, right, bottom]) => right - left < 12 || bottom - top < 12)) {
            throw new Error('ช่องคำตอบเล็กเกินไปสำหรับอ่านกากบาทอย่างเชื่อถือได้');
          }
          return { layout: profile ? 'custom' : 'table40', boxes };
        } finally {
          deleteMats(contour, hull, polygon, localV, localH, localInk, inverse, matrix, dilatedV, dilatedH, bandV, bandH);
        }
      }
      throw new Error('อ่านเส้นตารางไม่ตรงกับแบบฟอร์ม กรุณาถ่ายให้ชัดหรือเลือกแบบฟอร์มที่ตรงกับกระดาษ');
    } finally {
      deleteMats(ink, closeH, closeV, horizontal, vertical, combined, contours, hierarchy,
        kernelCloseH, kernelCloseV, kernelOpenH, kernelOpenV);
    }
  }
  if (profile) throw new Error('ไม่พบรหัสจุดอ้างอิงของแบบฟอร์มนำเข้า กรุณาใช้ไฟล์ที่แปลงแล้ว');
  const printedCount = [830, 866, 902].filter((x) => darkRatio(normalized, x - 7, 193, x + 8, 208, 150) > 0.6).length * 20;
  if (printedCount !== count) throw new Error('จำนวนข้อบนกระดาษไม่ตรงกับข้อสอบ หรือหัวกระดาษอ่านไม่ชัด กรุณาใช้แบบฟอร์มจำนวนข้อเดียวกัน');
  const boxes = Array.from({ length: count }, (_, index) => {
    const column = Math.floor(index / 20);
    const row = index % 20;
    return Array.from({ length: 4 }, (__, choice) => {
      const x = 180 + column * 285 + choice * 48;
      const y = 380 + row * 42;
      return [x - 13, y - 13, x + 13, y + 13];
    });
  });
  return { layout: 'bubbles', boxes };
}
