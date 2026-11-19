// Luyện thanh điệu bằng hình: đo cao độ (F0, thuật toán YIN) của bản ghi và giọng mẫu, vẽ chồng lên khuôn thanh chuẩn
// và tính độ giống giọng mẫu. Chạy hoàn toàn trên trình duyệt, không gửi âm thanh đi đâu.
// Không tự "chấm đúng/sai thanh" từng âm tiết: thử trên giọng mẫu bản ngữ, cách đó chỉ đúng khoảng 1/4 nên dễ gây hiểu lầm.
// Điểm giống giọng mẫu phân biệt được cùng thanh (≈59) với khác thanh (≈40) trên giọng mẫu của khoá học.
const RATE = 16000;
const TONE_MARKS = {'̄': 1, '́': 2, '̌': 3, '̀': 4};
// Khuôn thanh theo thang 5 bậc của Triệu Nguyên Nhiệm: 1 = 55, 2 = 35, 3 = 214, 4 = 51.
const SHAPES = {1: [5, 5, 5], 2: [3, 4, 5], 3: [2, 1, 4], 4: [5, 3, 1], 5: [3, 3, 3]};

function toneOf(syllable) {
 for (const c of String(syllable).normalize('NFD')) if (TONE_MARKS[c]) return TONE_MARKS[c];
 return 5;
}

// Thanh mong đợi của từng âm tiết, có tính biến điệu: 3+3 → 2+3, 不 trước thanh 4 → 2, 一 linh hoạt.
export function toneTargets(zh, syllables) {
 const chars = [...String(zh ?? '')].filter(c => /\p{Script=Han}/u.test(c));
 if (!syllables.length || syllables.length !== chars.length) return [];
 const tones = syllables.map(toneOf);
 return tones.map((t, i) => {
  const next = tones[i + 1];
  if (chars[i] === '一') return {tone: t, accept: [1, 2, 4]};
  if (chars[i] === '不') return {tone: next === 4 ? 2 : 4, accept: next === 4 ? [2] : [4, 2]};
  if (t === 3 && next === 3) return {tone: 2, accept: [2, 3]};
  return {tone: t, accept: t === 5 ? [1, 2, 3, 4, 5] : [t]};
 });
}

async function decode(arrayBuffer) {
 const Engine = window.AudioContext ?? window.webkitAudioContext;
 const ctx = new Engine();
 try {
  const audio = await ctx.decodeAudioData(arrayBuffer);
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(audio.duration * RATE)), RATE);
  const source = offline.createBufferSource();
  source.buffer = audio; source.connect(offline.destination); source.start();
  return (await offline.startRendering()).getChannelData(0);
 } finally { ctx.close?.(); }
}

// F0 theo khung 40 ms, bước 10 ms, bằng tự tương quan chuẩn hoá trong khoảng 70–450 Hz.
function pitchTrack(samples) {
 const win = 640, hop = 160, minLag = Math.floor(RATE / 450), maxLag = Math.ceil(RATE / 70);
 let peak = 0;
 for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
 const frames = [];
 for (let start = 0; start + win + maxLag < samples.length; start += hop) {
  let energy = 0;
  for (let i = start; i < start + win; i++) energy += samples[i] * samples[i];
  const rms = Math.sqrt(energy / win);
  if (rms < Math.max(.01, peak * .06)) { frames.push(null); continue; }
  // YIN (de Cheveigné & Kawahara 2002): hiệu bình phương chuẩn hoá luỹ kế, lấy chu kỳ đầu tiên dưới ngưỡng.
  const d = new Float32Array(maxLag + 2);
  let running = 0;
  d[0] = 1;
  for (let lag = 1; lag <= maxLag + 1; lag++) {
   let sum = 0;
   for (let i = start; i < start + win; i++) { const diff = samples[i] - samples[i + lag]; sum += diff * diff; }
   running += sum;
   d[lag] = running ? sum * lag / running : 1;
  }
  let lag = -1;
  for (let k = minLag; k <= maxLag; k++) {
   if (d[k] < .15) { while (k + 1 <= maxLag && d[k + 1] < d[k]) k++; lag = k; break; }
  }
  if (lag < 0) { frames.push(null); continue; }
  const a = d[lag - 1], b = d[lag], c = d[lag + 1], shift = (a - c) / (2 * (a - 2 * b + c) || 1);
  frames.push(RATE / (lag + Math.max(-.5, Math.min(.5, shift))));
 }
 return frames;
}

const median = values => { const s = [...values].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// Đường cao độ chuẩn hoá: trục x 0..1 trên đoạn có tiếng, trục y = nửa cung so với cao độ trung vị của người nói.
function contour(frames) {
 const voiced = frames.map((f, i) => f && {i, f}).filter(Boolean);
 if (voiced.length < 6) return null;
 // Bỏ bước nhảy quãng tám (lỗi đo thường gặp) bằng cách so với trung vị.
 const mid = median(voiced.map(v => v.f));
 const banded = voiced.filter(v => v.f > mid * .6 && v.f < mid * 1.7);
 // Cắt thành các đoạn liền mạch (không nhảy quá 2,5 nửa cung giữa hai khung kề nhau),
 // bỏ đoạn ngắn hơn 40% đoạn dài nhất: thường là nhiễu lúc bật âm hoặc tắt âm.
 const runs = [];
 for (const v of banded) {
  const run = runs.at(-1), prev = run?.at(-1);
  if (prev && v.i - prev.i <= 3 && Math.abs(12 * Math.log2(v.f / prev.f)) < 2.5) run.push(v); else runs.push([v]);
 }
 const longest = Math.max(0, ...runs.map(r => r.length));
 const clean = runs.filter(r => r.length >= Math.max(3, longest * .4)).flat();
 if (clean.length < 6) return null;
 const first = clean[0].i, last = clean.at(-1).i, span = Math.max(1, last - first);
 const raw = clean.map(v => ({t: (v.i - first) / span, st: 12 * Math.log2(v.f / mid)}));
 // Làm mượt bằng trung vị trượt 5 điểm.
 const points = raw.map((p, k) => ({t: p.t, st: median(raw.slice(Math.max(0, k - 2), k + 3).map(x => x.st))}));
 return {points, hz: Math.round(mid), seconds: (span * 160) / RATE};
}

export async function analyzeBlob(blob) { return contour(pitchTrack(await decode(await blob.arrayBuffer()))); }
export async function analyzeUrl(urls) {
 const list = Array.isArray(urls) ? urls : [urls];
 const parts = await Promise.all(list.map(async url => {
  const response = await fetch(url, {credentials: 'same-origin'});
  if (!response.ok) throw new Error('Chưa tải được giọng mẫu.');
  return decode(await response.arrayBuffer());
 }));
 const length = parts.reduce((n, p) => n + p.length, 0), joined = new Float32Array(length);
 let offset = 0;
 for (const p of parts) { joined.set(p, offset); offset += p.length; }
 return contour(pitchTrack(joined));
}

// Lấy mẫu lại đường cao độ thành n điểm đều nhau trên trục 0..1 (nội suy tuyến tính), bỏ trung bình.
function resample(c, n = 40) {
 const p = c.points, out = [];
 for (let k = 0; k < n; k++) {
  const t = k / (n - 1);
  let j = p.findIndex(q => q.t >= t);
  if (j < 0) j = p.length - 1;
  const a = p[Math.max(0, j - 1)], b = p[j];
  out.push(b.t === a.t ? b.st : a.st + (b.st - a.st) * (t - a.t) / (b.t - a.t));
 }
 const mean = out.reduce((s, v) => s + v, 0) / n;
 return out.map(v => v - mean);
}

// Độ giống giọng mẫu 0–100: kết hợp tương quan dáng đường (lên/xuống cùng lúc) và độ lệch trung bình (nửa cung).
// Cả hai đường đi qua cùng bộ đo nên các nhiễu đo giống nhau phần lớn triệt tiêu.
export function similarity(user, ref) {
 if (!user || !ref) return null;
 const a = resample(user), b = resample(ref), n = a.length;
 const dot = a.reduce((s, v, i) => s + v * b[i], 0);
 const na = Math.sqrt(a.reduce((s, v) => s + v * v, 0)), nb = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
 const r = na && nb ? dot / (na * nb) : 0;
 const rms = Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / n);
 return Math.round(100 * (.6 * Math.max(0, r) + .4 * Math.max(0, 1 - rms / 6)));
}

const path = (points, x, y) => points.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.st).toFixed(1)).join(' ');

// Biểu đồ SVG: khuôn thanh (nét đứt), giọng mẫu (xám), giọng bạn (xanh). Chia cột theo âm tiết.
export function toneChart({user, ref, targets, labels = []}) {
 const W = 560, H = 190, pad = 18, top = 14, bottom = H - 30;
 const x = t => pad + t * (W - 2 * pad), y = st => Math.max(top, Math.min(bottom, (top + bottom) / 2 - st * ((bottom - top) / 18)));
 const n = Math.max(1, targets.length);
 const cols = targets.map((target, i) => {
  const x0 = x(i / n), x1 = x((i + 1) / n), shape = SHAPES[target.tone] ?? SHAPES[5];
  // Bậc 1..5 → nửa cung -6..+6 quanh trung vị.
  const pts = shape.map((level, k) => ({t: (i + (k + .5) / 3 * .9 + .05) / n, st: (level - 3) * 3}));
  return (i ? '<line x1="' + x0.toFixed(1) + '" x2="' + x0.toFixed(1) + '" y1="' + top + '" y2="' + bottom + '" class="tc-sep"/>' : '') +
   '<path d="' + path(pts, x, y) + '" class="tc-shape"/>' +
   '<text x="' + ((x0 + x1) / 2).toFixed(1) + '" y="' + (H - 10) + '" class="tc-label">' + (labels[i] ?? '') + '</text>';
 }).join('');
 return '<svg class="tone-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Đường thanh điệu của bạn so với giọng mẫu">' +
  '<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + y(0) + '" y2="' + y(0) + '" class="tc-mid"/>' + cols +
  (ref ? '<path d="' + path(ref.points, x, y) + '" class="tc-ref"/>' : '') +
  (user ? '<path d="' + path(user.points, x, y) + '" class="tc-user"/>' : '') + '</svg>';
}

// Ghi âm tối đa maxMs mili giây. Trả về {stop, blob: Promise<Blob>}.
export async function record(maxMs = 6000) {
 const stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}});
 const recorder = new MediaRecorder(stream), chunks = [];
 recorder.ondataavailable = e => chunks.push(e.data);
 const blob = new Promise(resolve => {
  recorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); resolve(new Blob(chunks, {type: recorder.mimeType || 'audio/webm'})); };
 });
 recorder.start();
 const timer = setTimeout(() => recorder.state === 'recording' && recorder.stop(), maxMs);
 return {stop() { clearTimeout(timer); if (recorder.state === 'recording') recorder.stop(); }, blob};
}
