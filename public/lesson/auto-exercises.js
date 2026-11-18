// Sinh bài tập từ chính câu hội thoại của bài, không cần soạn thêm hay dùng AI:
// - Điền từ: che một từ vựng của bài trong câu thoại, chọn từ đúng trong 4 lựa chọn (luyện đọc hiểu).
// - Sắp xếp câu: chia câu thoại thành các cụm từ, xếp lại đúng thứ tự (luyện trật tự câu).
// Mã câu được tạo từ nội dung câu nên cố định giữa các lần mở, để lịch ôn và mức nắm bài theo dõi được.

const HAN = /\p{Script=Han}/u;
const PUNCT = /[\p{P}\s]/u;
const hanCount = text => [...String(text)].filter(char => HAN.test(char)).length;
const stripPunct = text => String(text).replace(/[\p{P}\s]/gu, '');

function hash(text) {
 let h = 2166136261;
 for (const char of String(text)) h = Math.imul(h ^ char.codePointAt(0), 16777619) >>> 0;
 return h.toString(36);
}
// Chọn ổn định theo hạt giống (không đổi giữa các lần mở trang).
function seeded(items, seed, count) {
 return [...items].map((item, i) => [hash(seed + ':' + i + ':' + item), item]).sort((a, b) => a[0] < b[0] ? -1 : 1).slice(0, count).map(([, item]) => item);
}

// Tách câu thành cụm theo từ dài nhất có trong từ điển; chữ lẻ đứng riêng, dấu câu dính vào cụm trước.
function chunk(sentence, words, maxLength) {
 const chars = [...stripPunct(sentence)], out = [];
 for (let i = 0; i < chars.length;) {
  let size = Math.min(maxLength, chars.length - i);
  while (size > 1 && !words.has(chars.slice(i, i + size).join(''))) size--;
  out.push(chars.slice(i, i + size).join(''));
  i += size;
 }
 // Gộp các chữ lẻ đứng liền nhau để cụm không quá vụn (tối đa 2 chữ một cụm gộp).
 const merged = [];
 for (const piece of out) {
  const last = merged.at(-1);
  if (last && [...piece].length === 1 && [...last].length === 1 && !words.has(piece)) merged[merged.length - 1] = last + piece;
  else merged.push(piece);
 }
 return merged;
}

export function autoExercises(lesson, {dictionary, courseVocab}) {
 if (!lesson?.dialogues?.length || !lesson.vocab?.length) return [];
 const words = new Set([...dictionary].filter(word => HAN.test(word)));
 const maxLength = Math.max(1, ...[...words].map(word => [...word].length));
 const lessonWords = [...new Set(lesson.vocab.map(w => w.zh).filter(zh => zh && HAN.test(zh) && !PUNCT.test(zh)))];
 const pool = [...new Set([...lessonWords, ...courseVocab.filter(zh => zh && HAN.test(zh) && !PUNCT.test(zh))])];
 const seen = new Set(), cloze = [], order = [];
 const utterances = lesson.dialogues.flatMap(d => d.utterances ?? []).filter(u => u.zh && !seen.has(u.zh) && seen.add(u.zh));

 for (const u of utterances) {
  const length = hanCount(u.zh);
  const meaning = u.vi?.trim() ? '\nNghĩa: ' + u.vi.trim() : '';
  // Điền từ: từ dài nhất của bài có trong câu (nhưng không phải cả câu).
  const target = lessonWords.filter(w => u.zh.includes(w) && hanCount(w) < length).sort((a, b) => [...b].length - [...a].length)[0];
  if (target && length >= 3 && cloze.length < 12) {
   const size = [...target].length;
   const distractors = seeded(pool.filter(w => w !== target && !u.zh.includes(w) && Math.abs([...w].length - size) <= 1), u.zh, 3);
   if (distractors.length === 3) cloze.push({
    id: 'auto-' + lesson.n + '-cloze-' + hash(u.zh), lesson: lesson.n, origin: 'auto', mode: 'cloze', kind: 3, skill: 'reading', level: 'Tự sinh',
    prompt: 'Chọn từ điền vào chỗ trống (câu trong hội thoại của bài).\n' + u.zh.replace(target, '___') + meaning,
    options: [target, ...distractors], answers: [target], zh: u.zh, pinyin: u.pinyin ?? '', vi: u.vi ?? '',
    explanation: 'Câu đầy đủ trong hội thoại: ' + u.zh,
   });
  }
  // Sắp xếp câu: câu vừa phải, chia được 3–7 cụm, các cụm không trùng nhau.
  if (length >= 5 && length <= 20 && order.length < 10) {
   const pieces = chunk(u.zh, words, maxLength);
   if (pieces.length >= 3 && pieces.length <= 7 && new Set(pieces).size === pieces.length) order.push({
    id: 'auto-' + lesson.n + '-order-' + hash(u.zh), lesson: lesson.n, origin: 'auto', mode: 'order', kind: 1, skill: 'grammar', level: 'Tự sinh',
    prompt: 'Sắp xếp các cụm từ thành câu đúng (câu trong hội thoại của bài).' + meaning,
    order: pieces, answers: [stripPunct(u.zh)], zh: u.zh, pinyin: u.pinyin ?? '', vi: u.vi ?? '',
    explanation: 'Câu gốc trong hội thoại: ' + u.zh,
   });
  }
 }
 return [...cloze, ...order];
}
