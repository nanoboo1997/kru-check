export function deleteMats(...values) {
  for (const value of values.flat(Infinity)) {
    if (value && typeof value.delete === 'function') {
      try { value.delete(); } catch { /* best-effort cleanup */ }
    }
  }
}

export function usingMat(mat, fn) {
  try {
    return fn(mat);
  } finally {
    deleteMats(mat);
  }
}
