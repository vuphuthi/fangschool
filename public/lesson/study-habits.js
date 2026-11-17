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

export function blankStudy() { return {goal: 20, days: {}, srs: {}}; }

export function ensureStudy(state) {
 const s = state.study && typeof state.study === 'object' ? state.study : {};
 state.study = {
  goal: goalChoices.includes(s.goal) ? s.goal : 20,
  days: s.days && typeof s.days === 'object' ? s.days : {},
  srs: s.srs && typeof s.srs === 'object' ? s.srs : {},
 };
 return state.study;
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

// Lặp lại ngắt quãng: Quên → 1 ngày, Nhớ mang máng → 3 ngày, Nhớ rõ → 7 → 14 → 30 → 60 ngày.
export function nextStep(card, rating) {
 if (rating === 'hard') return 1;
 if (rating === 'ok') return 3;
 const prev = card?.step ?? 0;
 return prev >= 30 ? 60 : prev >= 14 ? 30 : prev >= 7 ? 14 : 7;
}

export function rateCard(state, wordId, rating, now = Date.now()) {
 const study = ensureStudy(state), prev = study.srs[wordId], step = nextStep(prev, rating);
 const first = (!prev && !state.words?.[wordId]) || (prev?.first && prev.at >= startOfDay(now));
 study.srs[wordId] = {due: shiftDay(startOfDay(now), step), step, at: now, ...(first ? {first: true} : {})};
 study.srs = trim(study.srs, srsLimit, ([, v]) => v.at);
 return step;
}

// Hàng đợi hôm nay: thẻ đến hạn → từ đánh dấu chưa thuộc → tối đa 5 từ mới từ các bài đã học.
export function dueQueue(state, lessons, now = Date.now(), newLimit = 5) {
 const study = ensureStudy(state), endOfToday = startOfDay(now) + DAY;
 const words = lessons.filter(l => l.n < 100).flatMap(l => l.vocab.map((w, i) => ({...w, n: l.n, i})));
 const seen = new Set();
 const pick = w => { if (!w.id || seen.has(w.id)) return false; seen.add(w.id); return true; };
 const due = words.filter(w => study.srs[w.id] && study.srs[w.id].due < endOfToday)
  .sort((a, b) => study.srs[a.id].due - study.srs[b.id].due).filter(pick);
 const unknown = words.filter(w => !study.srs[w.id] && state.words?.[w.id] === 'unknown').filter(pick);
 const today = Object.values(study.srs).filter(c => c.at >= startOfDay(now));
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
