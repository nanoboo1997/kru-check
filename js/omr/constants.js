export const SHEET_WIDTH = 1000;
export const SHEET_HEIGHT = 1414;
export const MARKER_TARGETS = [
  [70, 70],
  [930, 70],
  [930, 1344],
  [70, 1344],
];

export const LETTERS = ['ก', 'ข', 'ค', 'ง'];

export const MARK = Object.freeze({
  CLEAR_X: 'clear_x',
  CLEAR_BLANK: 'clear_blank',
  SINGLE_LINE: 'single_line_or_tick',
  ABNORMAL_DARK: 'abnormal_dark_mark',
  UNCERTAIN: 'uncertain',
});

export const REVIEW_REASON = Object.freeze({
  UNCLEAR_X: 'กากบาทไม่ชัด',
  MULTIPLE: 'พบเครื่องหมายมากกว่าหนึ่งช่อง',
  ABNORMAL_DARK: 'พบรอยเข้มผิดปกติ',
  POSSIBLE_MARK: 'พบเส้น/รอยที่อาจเป็นคำตอบ',
});
