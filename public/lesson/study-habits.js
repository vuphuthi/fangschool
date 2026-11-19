// Thói quen học: mục tiêu phút/ngày, chuỗi ngày, ôn thẻ lặp lại ngắt quãng, nhịp học 16 tuần, dự đoán điểm.
// Dữ liệu nằm trong state.study = {goal, days:{'YYYY-MM-DD':phút}, srs:{wordId:{due,step,at}}} và được đồng bộ cùng tiến độ.

export const goalChoices = [10, 20, 30];
export const DAY = 86_400_000;
const dayLimit = 400, srsLimit = 5000;

export const dayKey = (time = Date.now()) => {
 const d = new Date(time);
 return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const startOfDay = (time = Date.now()) => { const d = new Date(time); d.setHours(0, 0, 0, 0); return d.getTime(); };
const shiftDay = (time, n) => { const d = new Date(time); d.setDate(d.getDate() + n); return d.getTime(); };

export function blankStudy() { return {goal: 20, days: {}, srs: {}, plan: blankPlan()}; }

// Lộ trình thi: ngày thi (YYYY-MM-DD hoặc "") và các lần kiểm tra 5 phút {at, total, max, kind: p|w}.
export const blankPlan = () => ({exam: '', checks: []});
const checkLimit = 60;
function cleanPlan(p) {
 const exam = typeof p?.exam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.exam) ? p.exam : '';
 const checks = (Array.isArray(p?.checks) ? p.checks : [])
  .filter(c => c && Number.isSafeInteger(c.at) && c.at > 0 && [200, 300].includes(c.max) && Number.isInteger(c.total) && c.total >= 0 && c.total <= c.max && ['p', 'w'].includes(c.kind))
  .map(({at, total, max, kind}) => ({at, total, max, kind}))
  .sort((a, b) => a.at - b.at).slice(-checkLimit);
 return {exam, checks};
}

export function ensureStudy(state) {
 const s = state.study && typeof state.study === 'object' ? state.study : {};
 state.study = {
  goal: goalChoices.includes(s.goal) ? s.goal : 20,
  days: s.days && typeof s.days === 'object' ? s.days : {},
  srs: s.srs && typeof s.srs === 'object' ? s.srs : {},
  plan: cleanPlan(s.plan),
 };
 return state.study;
}

function mergePlan(remote, local, base) {
 const r = cleanPlan(remote), l = cleanPlan(local), b = cleanPlan(base);
 const checks = new Map([...r.checks, ...l.checks].map(c => [c.at, c]));
 return cleanPlan({exam: l.exam !== b.exam ? l.exam : r.exam, checks: [...checks.values()]});
}

function trim(map, limit, score) {
 const entries = Object.entries(map);
 if (entries.length <= limit) return map;
 return Object.fromEntries(entries.sort((a, b) => score(b) - score(a)).slice(0, limit));
}

// Gộp bản trên máy chủ và bản trên thiết bị: phút lấy giá trị lớn hơn, thẻ lấy lần chấm mới nhất.
export function mergeStudy(remote, local, base) {
 const r = remote ?? blankStudy(), l = local ?? blankStudy(), b = base ?? blankStudy();
 const days = {...r.days};
 for (const [key, value] of Object.entries(l.days ?? {})) days[key] = Math.max(value, days[key] ?? 0);
 const srs = {...r.srs};
 for (const [key, value] of Object.entries(l.srs ?? {})) if (!srs[key] || value.at > srs[key].at) srs[key] = value;
 return {
  goal: l.goal !== b.goal ? l.goal : r.goal ?? l.goal,
  days: trim(days, dayLimit, ([key]) => Date.parse(key)),
  srs: trim(srs, srsLimit, ([, value]) => value.at),
  plan: mergePlan(r.plan, l.plan, b.plan),
 };
}

export function addMinute(state, time = Date.now()) {
 const study = ensureStudy(state), key = dayKey(time);
 study.days[key] = Math.min(1440, (study.days[key] ?? 0) + 1);
 study.days = trim(study.days, dayLimit, ([k]) => Date.parse(k));
 return study.days[key];
}

// Mỗi ngày có phút học, câu trả lời hoặc bài kiểm tra đều tính là ngày hoạt động.
export function activity(state) {
 const map = new Map();
 const bump = (key, minutes, answers) => {
  const row = map.get(key) ?? {minutes: 0, answers: 0};
  row.minutes += minutes; row.answers += answers; map.set(key, row);
 };
 for (const [key, minutes] of Object.entries(ensureStudy(state).days)) if (minutes > 0) bump(key, minutes, 0);
 for (const a of state.attempts ?? []) if (a?.at) bump(dayKey(a.at), 0, 1);
 for (const h of state.history ?? []) if (h?.at) bump(dayKey(h.at), 0, h.count ?? 1);
 return map;
}

export function streak(state, now = Date.now()) {
 const days = activity(state);
 let cursor = startOfDay(now);
 if (!days.has(dayKey(cursor))) cursor = shiftDay(cursor, -1);
 let count = 0;
 while (days.has(dayKey(cursor))) { count++; cursor = shiftDay(cursor, -1); }
 return count;
}

const weekdayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export function lastWeek(state, now = Date.now()) {
 const study = ensureStudy(state), days = activity(state);
 return Array.from({length: 7}, (_, i) => {
  const time = shiftDay(startOfDay(now), i - 6), key = dayKey(time);
  const minutes = study.days[key] ?? 0;
  return {key, label: weekdayLabels[new Date(time).getDay()], today: i === 6,
   state: minutes >= study.goal ? 'done' : days.has(key) ? 'some' : 'none', minutes};
 });
}

export function todayMinutes(state, now = Date.now()) { return ensureStudy(state).days[dayKey(now)] ?? 0; }

// 16 tuần × 7 ngày, cột cuối là tuần hiện tại (bắt đầu từ thứ Hai).
export function heatmap(state, now = Date.now(), weeks = 16) {
 const days = activity(state), today = startOfDay(now);
 const monday = shiftDay(today, -((new Date(today).getDay() + 6) % 7));
 const first = shiftDay(monday, -(weeks - 1) * 7);
 const cells = [];
 for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) {
  const time = shiftDay(first, w * 7 + d), key = dayKey(time), row = days.get(key);
  const score = row ? row.minutes + row.answers * 0.5 : 0;
  cells.push({key, time, week: w, day: d, future: time > today, minutes: row?.minutes ?? 0, answers: row?.answers ?? 0, score});
 }
 const scores = cells.filter(c => c.score > 0).map(c => c.score).sort((a, b) => a - b);
 const q = p => scores[Math.min(scores.length - 1, Math.floor(p * scores.length))] ?? 0;
 const cuts = [q(.25), q(.5), q(.75)];
 for (const c of cells) c.level = c.score <= 0 ? 0 : c.score <= cuts[0] ? 1 : c.score <= cuts[1] ? 2 : c.score <= cuts[2] ? 3 : 4;
 const active = cells.filter(c => c.score > 0 && !c.future);
 return {cells, activeDays: active.length, minutes: active.reduce((n, c) => n + c.minutes, 0), answers: active.reduce((n, c) => n + c.answers, 0)};
}

// Lặp lại ngắt quãng, khoảng ôn tính theo khoảng trước đó:
// Quên → 1 ngày · Nhớ mang máng → ×1,4 (tối thiểu 3 ngày) · Nhớ rõ → ×2,2 (tối thiểu 7 ngày), tối đa 180 ngày.
export const MAX_STEP = 180;
export function nextStep(card, rating) {
 const prev = card?.step ?? 0;
 if (rating === 'hard') return 1;
 if (rating === 'ok') return prev < 3 ? 3 : Math.min(MAX_STEP, Math.round(prev * 1.4));
 return prev < 7 ? 7 : Math.min(MAX_STEP, Math.round(prev * 2.2));
}

// Chiều ôn của thẻ, xoay vòng theo mức thuộc để luyện cả nhận diện lẫn nhớ lại:
// read: chữ Hán → nghĩa · listen: nghe → nghĩa · recall: nghĩa → chữ Hán + pinyin.
// Từ mới / đang học chủ yếu đọc; từ đã thuộc chuyển sang nghe và nhớ ngược để kiểm tra thật.
export const CARD_DIRECTIONS = {read: 'Đọc → nghĩa', listen: 'Nghe → nghĩa', recall: 'Nghĩa → chữ Hán'};
export function cardDirection(card, wordId, canListen) {
 const step = card?.step ?? 0;
 const options = step < 3 ? ['read'] : step < 7 ? ['read', 'listen', 'recall'] : ['recall', 'listen', 'recall'];
 const usable = options.filter(d => d !== 'listen' || canListen);
 let hash = 0;
 for (const char of String(wordId) + ':' + (card?.due ?? 0)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
 return usable[hash % usable.length];
}

export function rateCard(state, wordId, rating, now = Date.now()) {
 const study = ensureStudy(state), prev = study.srs[wordId], step = nextStep(prev, rating);
 const first = (!prev && !state.words?.[wordId]) || (prev?.first && prev.at >= startOfDay(now));
 study.srs[wordId] = {due: shiftDay(startOfDay(now), step), step, at: now, ...(first ? {first: true} : {})};
 study.srs = trim(study.srs, srsLimit, ([, v]) => v.at);
 return step;
}

// Trạng thái một từ, lấy từ lịch ôn thẻ (nguồn chính); dấu "Đã thuộc / Chưa thuộc" cũ chỉ dùng khi từ chưa có thẻ.
// known: nhớ rõ (khoảng ôn ≥ 7 ngày) · learning: đang ôn · new: chưa học.
export const KNOWN_STEP = 7;
export function wordStatus(state, id) {
 const card = state.study?.srs?.[id];
 if (card) return card.step >= KNOWN_STEP ? 'known' : 'learning';
 const mark = state.words?.[id];
 return mark === 'known' ? 'known' : mark === 'unknown' ? 'learning' : 'new';
}

// Ôn câu sai theo lịch, lưu trong study.srs với khoá "q:<id câu>" và đúng khuôn thẻ {due, step, at, hits}
// mà máy chủ kiểm tra. Sai → gặp lại ngày mai. Đúng ở một ngày khác → hẹn 3 ngày sau.
// Đúng ở 2 ngày khác nhau (hits = 2) → câu đã vững, rời danh sách câu sai.
export const questionKey = id => 'q:' + id;
export const QUESTION_CLEAR = 2;
export const isQuestionKey = key => key.startsWith('q:');
export function reviewQuestion(state, id, correct, now = Date.now()) {
 if (correct !== true && correct !== false) return null;
 const study = ensureStudy(state), key = questionKey(id), card = study.srs[key];
 if (!correct) study.srs[key] = {due: shiftDay(startOfDay(now), 1), step: 1, at: now, hits: 0};
 else if (card && (card.hits ?? 0) < QUESTION_CLEAR && dayKey(card.at) !== dayKey(now)) {
  const hits = (card.hits ?? 0) + 1;
  study.srs[key] = hits >= QUESTION_CLEAR ? {due: now, step: KNOWN_STEP, at: now, hits} : {due: shiftDay(startOfDay(now), 3), step: 3, at: now, hits};
 }
 study.srs = trim(study.srs, srsLimit, ([, v]) => v.at);
 return study.srs[key] ?? null;
}
export function questionCard(state, id) { return state.study?.srs?.[questionKey(id)] ?? null; }
export const questionActive = card => Boolean(card) && (card.hits ?? 0) < QUESTION_CLEAR;
export const questionDue = (card, now = Date.now()) => questionActive(card) && card.due < startOfDay(now) + DAY;

// Hàng đợi hôm nay: thẻ đến hạn → từ đánh dấu chưa thuộc → tối đa 5 từ mới từ các bài đã học.
export function dueQueue(state, lessons, now = Date.now(), newLimit = 5) {
 const study = ensureStudy(state), endOfToday = startOfDay(now) + DAY;
 const words = lessons.filter(l => l.n < 100).flatMap(l => l.vocab.map((w, i) => ({...w, n: l.n, i})));
 const seen = new Set();
 const pick = w => { if (!w.id || seen.has(w.id)) return false; seen.add(w.id); return true; };
 const due = words.filter(w => study.srs[w.id] && study.srs[w.id].due < endOfToday)
  .sort((a, b) => study.srs[a.id].due - study.srs[b.id].due).filter(pick);
 const unknown = words.filter(w => !study.srs[w.id] && state.words?.[w.id] === 'unknown').filter(pick);
 const today = Object.entries(study.srs).filter(([key, c]) => !isQuestionKey(key) && c.at >= startOfDay(now)).map(([, c]) => c);
 const reviewedToday = today.length;
 const newToday = Math.max(0, newLimit - today.filter(c => c.first).length);
 const fresh = words.filter(w => w.n <= (state.last ?? 1) && !study.srs[w.id] && !state.words?.[w.id]).filter(pick).slice(0, newToday);
 return {cards: [...due, ...unknown, ...fresh], due: due.length + unknown.length, fresh: fresh.length, reviewedToday};
}

// Dự đoán điểm: cấu trúc điểm HSK 2.0 (cấp 1–2: 200 điểm, đạt 120; cấp 3–4: 300 điểm, đạt 180).
const examParts = {
 1: {pass: 120, parts: [['Nghe', 100, ['listen']], ['Đọc', 100, ['reading', 'vocab', 'grammar']]]},
 2: {pass: 120, parts: [['Nghe', 100, ['listen']], ['Đọc', 100, ['reading', 'vocab', 'grammar']]]},
 3: {pass: 180, parts: [['Nghe', 100, ['listen']], ['Đọc', 100, ['reading', 'vocab']], ['Viết', 100, ['grammar']]]},
 4: {pass: 180, parts: [['Nghe', 100, ['listen']], ['Đọc', 100, ['reading', 'vocab']], ['Viết', 100, ['grammar']]]},
};
// Điểm một lần kiểm tra 5 phút: tỷ lệ đúng từng phần (theo kỹ năng) quy về thang điểm HSK của cấp đó.
// Phần chưa có câu nào lấy tỷ lệ trung bình các phần đã có.
export function scoreCheck(course, answers, {getQuestion, lessonSkill}) {
 const plan = examParts[course];
 if (!plan) return null;
 const parts = plan.parts.map(([name, max, skills]) => {
  const rows = answers.filter(a => a && !a.skipped && (a.grade === true || a.grade === false) && skills.includes(lessonSkill(getQuestion(a.id) ?? {})));
  return {name, max, ratio: rows.length ? rows.filter(a => a.grade).length / rows.length : null};
 });
 const known = parts.filter(p => p.ratio !== null);
 if (!known.length) return null;
 const mean = known.reduce((n, p) => n + p.ratio, 0) / known.length;
 const total = Math.round(parts.reduce((n, p) => n + (p.ratio ?? mean) * p.max, 0));
 return {total, max: plan.parts.length * 100, pass: plan.pass, parts: parts.map(p => ({name: p.name, max: p.max, score: p.ratio === null ? null : Math.round(p.ratio * p.max)}))};
}
export const examPass = course => examParts[course] ? {pass: examParts[course].pass, max: examParts[course].parts.length * 100} : null;

const examSectionPart = name => /nghe|听/i.test(name) ? 'Nghe' : /viết|书写|写/i.test(name) ? 'Viết' : 'Đọc';

export function predictScore(state, {course, getQuestion, lessonSkill, recent = 300}) {
 const plan = examParts[course];
 if (!plan) return null;
 const graded = (state.attempts ?? []).filter(a => a.grade === true || a.grade === false).slice(-recent);
 const bySkill = {};
 graded.forEach((a, index) => {
  const q = getQuestion(a.id);
  if (!q) return;
  const weight = 0.5 + index / Math.max(1, graded.length);
  const row = bySkill[lessonSkill(q)] ??= {correct: 0, total: 0, count: 0};
  row.total += weight; row.count++; if (a.grade) row.correct += weight;
 });
 const mock = [...(state.history ?? [])].reverse().find(h => h.examCode && Array.isArray(h.sections));
 const mockParts = {};
 for (const s of mock?.sections ?? []) {
  const part = mockParts[examSectionPart(s.name)] ??= {correct: 0, graded: 0};
  part.correct += s.correct ?? 0; part.graded += s.graded ?? 0;
 }
 const parts = plan.parts.map(([name, max, skills]) => {
  const rows = skills.map(s => bySkill[s]).filter(Boolean);
  const total = rows.reduce((n, r) => n + r.total, 0), count = rows.reduce((n, r) => n + r.count, 0);
  let ratio = total ? rows.reduce((n, r) => n + r.correct, 0) / total : null;
  const m = mockParts[name];
  if (m?.graded) ratio = ratio === null ? m.correct / m.graded : ratio * 0.4 + (m.correct / m.graded) * 0.6;
  return {name, max, count: count + (m?.graded ?? 0), score: ratio === null ? null : Math.round(ratio * max)};
 });
 const known = parts.filter(p => p.score !== null);
 const evidence = parts.reduce((n, p) => n + p.count, 0);
 if (!known.length) return {parts, total: null, max: plan.parts.length * 100, pass: plan.pass, evidence, confidence: 'none', mock: Boolean(mock)};
 const total = Math.round(known.reduce((n, p) => n + p.score, 0) / known.length * parts.length);
 const confidence = known.length < parts.length || evidence < 40 ? 'low' : evidence < 150 && !mock ? 'medium' : 'high';
 return {parts, total, max: parts.length * 100, pass: plan.pass, evidence, confidence, mock: Boolean(mock)};
}
