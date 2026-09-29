export function ordered(points) {
  const minBy = (fn) => points.reduce((best, point) => (fn(point) < fn(best) ? point : best));
  const maxBy = (fn) => points.reduce((best, point) => (fn(point) > fn(best) ? point : best));
  return [
    [...minBy(([x, y]) => x + y)],
    [...minBy(([x, y]) => y - x)],
    [...maxBy(([x, y]) => x + y)],
    [...maxBy(([x, y]) => y - x)],
  ];
}

export function polygonArea(points) {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    sum += x1 * y2 - y1 * x2;
  }
  return Math.abs(sum) / 2;
}

export function isConvex(points) {
  let sign = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const c = points[(index + 2) % points.length];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) < 1e-6) continue;
    const next = Math.sign(cross);
    if (sign && next !== sign) return false;
    sign = next;
  }
  return Boolean(sign);
}

export function validatePoints(points, width, height) {
  if (!Array.isArray(points) || points.length !== 4 || points.some((p) => p.length !== 2 || p.some((v) => !Number.isFinite(v)))) {
    throw new Error('กรุณาเลือกจุดอ้างอิง 4 จุดให้ครบ');
  }
  if (points.some(([x, y]) => x < 0 || y < 0 || x >= width || y >= height)) {
    throw new Error('จุดอ้างอิงอยู่นอกภาพ');
  }
  if (!isConvex(points) || polygonArea(points) < width * height * 0.12) {
    throw new Error('จุดอ้างอิงไม่ถูกต้อง เลือกกลางสี่เหลี่ยมดำตามลำดับที่ระบุ');
  }
}

export function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function combinations(items, size) {
  const output = [];
  const walk = (start, selected) => {
    if (selected.length === size) {
      output.push(selected.slice());
      return;
    }
    for (let index = start; index <= items.length - (size - selected.length); index += 1) {
      selected.push(items[index]);
      walk(index + 1, selected);
      selected.pop();
    }
  };
  walk(0, []);
  return output;
}

export function cyclic(points, offset) {
  return points.slice(offset).concat(points.slice(0, offset));
}
