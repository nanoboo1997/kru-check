/* Single-photo grading persistence. OMR stays in js/omr; this module only
 * validates, saves and recalculates local results/review decisions. */

const LETTERS = ['ก', 'ข', 'ค', 'ง'];

function rounded(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function calculateLocalScore(answerSelections, answerKey, fullScore) {
  if (!Array.isArray(answerSelections) || !Array.isArray(answerKey)
      || answerSelections.length !== answerKey.length || !answerKey.length) {
    throw new Error('เฉลยไม่ครบตามจำนวนข้อสอบ');
  }
  const correct = answerSelections.reduce((sum, selected, index) => {
    const expected = typeof answerKey[index] === 'number' ? answerKey[index] : LETTERS.indexOf(answerKey[index]);
    return sum + (selected.length === 1 && Number(selected[0]) === expected ? 1 : 0);
  }, 0);
  return rounded((correct / answerKey.length) * Number(fullScore));
}

export function reviewChoiceToSelection(choice, previous = []) {
  const index = LETTERS.indexOf(choice);
  if (index >= 0) return [index];
  if (choice === 'ไม่ตอบ') return [];
  if (choice === 'หลายคำตอบ') return previous.length > 1 ? [...previous] : [];
  throw new Error('ตัวเลือกตรวจทานไม่ถูกต้อง');
}

export async function persistSinglePhotoResult({
  repos, resultId, omrResult, exam, answerKey, classId, studentId = null,
  createdAt = new Date().toISOString(), syncState = 'pending',
}) {
  if (!resultId || !repos || !omrResult || !exam || !answerKey) throw new Error('ข้อมูลผลตรวจไม่ครบ');
  const existing = await repos.results.get(resultId);
  if (existing) return { result: existing, reviewItems: await repos.reviews.listByResult(resultId), duplicate: true };
  if (!Array.isArray(answerKey.answers) || answerKey.answers.length !== exam.questionCount) {
    throw new Error('เฉลยไม่ครบตามจำนวนข้อสอบ');
  }
  const selections = omrResult.answerSelections.map((row) => [...row]);
  const score = calculateLocalScore(selections, answerKey.answers, exam.fullScore);
  const uncertain = new Set(omrResult.uncertain || []);
  const result = {
    id: resultId,
    source: 'single-photo-browser',
    examId: exam.id,
    classId,
    studentId: studentId || null,
    answers: selections.map((row) => row.length === 1 ? LETTERS[row[0]] : null),
    answerSelections: selections,
    score,
    fullScore: Number(exam.fullScore),
    questionCount: Number(exam.questionCount),
    reviewStatus: uncertain.size ? 'pending' : 'none',
    reviewCount: uncertain.size,
    alignment: omrResult.alignment,
    overlayData: omrResult.overlayData || [],
    normalizedImageBlob: omrResult.normalizedImageBlob || null,
    performance: omrResult.performance || null,
    syncState,
    createdAt,
    updatedAt: createdAt,
  };
  const reviewItems = (omrResult.reviewItems || []).map((item) => ({
    id: `review-${resultId}-${item.questionNo}`,
    resultId,
    examId: exam.id,
    classId,
    studentId: studentId || null,
    questionNo: item.questionNo,
    candidates: item.candidates || [],
    reason: item.reason || 'uncertain',
    status: 'pending',
    resolvedAs: null,
    createdAt,
    updatedAt: createdAt,
  }));
  await repos.results.save(result);
  for (const item of reviewItems) await repos.reviews.save(item);
  await repos.sync.enqueue({
    type: 'upsert', store: 'results', payload: { id: result.id }, operationId: `result:${result.id}`,
  });
  return { result, reviewItems, duplicate: false };
}

export async function resolveLocalReview({ repos, reviewId, choice, resolvedAt = new Date().toISOString() }) {
  const item = await repos.reviews.get(reviewId);
  if (!item || item.status !== 'pending') throw new Error('ไม่พบรายการรอตรวจทานนี้');
  const [result, answerKey] = await Promise.all([
    repos.results.get(item.resultId), repos.answerKeys.getByExam(item.examId),
  ]);
  if (!result || !answerKey) throw new Error('ไม่พบผลตรวจหรือเฉลยของข้อนี้');
  const question = Number(item.questionNo) - 1;
  const selections = result.answerSelections.map((row) => [...row]);
  selections[question] = reviewChoiceToSelection(choice, selections[question]);
  const savedItem = { ...item, status: 'done', resolvedAs: choice, updatedAt: resolvedAt };
  await repos.reviews.save(savedItem);
  const stillPending = (await repos.reviews.listByResult(result.id))
    .filter((row) => row.id !== item.id && row.status === 'pending');
  const savedResult = {
    ...result,
    answers: selections.map((row) => row.length === 1 ? LETTERS[row[0]] : null),
    answerSelections: selections,
    score: calculateLocalScore(selections, answerKey.answers, result.fullScore),
    reviewCount: stillPending.length,
    reviewStatus: stillPending.length ? 'pending' : 'done',
    syncState: 'pending',
    updatedAt: resolvedAt,
  };
  await repos.results.save(savedResult);
  await repos.sync.enqueue({
    type: 'upsert', store: 'reviewQueue', payload: { id: savedItem.id }, operationId: `review:${savedItem.id}:${resolvedAt}`,
  });
  return { result: savedResult, reviewItem: savedItem, remaining: stillPending.length };
}

