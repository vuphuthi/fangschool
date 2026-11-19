// Phản hồi tức thì khi trả lời: âm thanh ngắn (tự tổng hợp, không cần tệp), rung nhẹ trên điện thoại,
// pháo giấy khi đạt mốc. Tắt được bằng nút loa trong màn làm bài; lựa chọn lưu trên thiết bị.
let context;
const KEY = 'fangschool-feedback-sound';
export const soundOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
export function toggleSound() {
 const next = !soundOn();
 try { localStorage.setItem(KEY, next ? 'on' : 'off'); } catch {}
 return next;
}

function engine() {
 const Engine = window.AudioContext ?? window.webkitAudioContext;
 if (!Engine) return null;
 context ??= new Engine();
 if (context.state === 'suspended') context.resume().catch(() => {});
 return context;
}

function tone(ctx, freq, start, length, type = 'sine', volume = .12) {
 const osc = ctx.createOscillator(), gain = ctx.createGain();
 osc.type = type; osc.frequency.setValueAtTime(freq, start);
 gain.gain.setValueAtTime(0, start);
 gain.gain.linearRampToValueAtTime(volume, start + .012);
 gain.gain.exponentialRampToValueAtTime(.0001, start + length);
 osc.connect(gain).connect(ctx.destination);
 osc.start(start); osc.stop(start + length + .02);
}

// ok: hai nốt đi lên · combo: ba nốt sáng · bad: một nốt trầm ngắn · done: hợp âm kết thúc buổi học.
export function play(kind) {
 if (!soundOn()) return;
 const ctx = engine();
 if (!ctx) return;
 const t = ctx.currentTime + .01;
 if (kind === 'ok') { tone(ctx, 784, t, .14); tone(ctx, 1175, t + .08, .2); }
 else if (kind === 'combo') { tone(ctx, 784, t, .12); tone(ctx, 988, t + .07, .12); tone(ctx, 1319, t + .14, .26); }
 else if (kind === 'bad') { tone(ctx, 220, t, .22, 'triangle', .14); }
 else if (kind === 'flip') { tone(ctx, 660, t, .07, 'sine', .06); }
 else if (kind === 'done') { [523, 659, 784, 1047].forEach((f, i) => tone(ctx, f, t + i * .09, .5, 'sine', .09)); }
}

export function buzz(kind) {
 if (!soundOn() || !navigator.vibrate) return;
 try { navigator.vibrate(kind === 'bad' ? [40, 40, 40] : 18); } catch {}
}

// Pháo giấy nhẹ bằng CSS, tự dọn sau 1,6 giây; bỏ qua khi người dùng bật giảm chuyển động.
export function confetti(target = document.body, pieces = 26) {
 if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
 const box = document.createElement('div');
 box.className = 'confetti';
 box.setAttribute('aria-hidden', 'true');
 const colors = ['#1f8a5b', '#f2b84b', '#e5604d', '#4b7bec', '#9b6dd6'];
 for (let i = 0; i < pieces; i++) {
  const p = document.createElement('i');
  p.style.setProperty('--x', (Math.random() * 2 - 1).toFixed(2));
  p.style.setProperty('--d', (Math.random() * .25).toFixed(2) + 's');
  p.style.setProperty('--r', Math.round(Math.random() * 720 - 360) + 'deg');
  p.style.background = colors[i % colors.length];
  p.style.left = (35 + Math.random() * 30) + '%';
  box.append(p);
 }
 target.append(box);
 setTimeout(() => box.remove(), 1700);
}

// Đếm số từ tăng dần cho các con số trên biên lai buổi học.
export function countUp(root = document) {
 if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
 for (const el of root.querySelectorAll('[data-count]')) {
  const to = Number(el.dataset.count), from = Number(el.dataset.from ?? 0), prefix = el.dataset.prefix ?? '';
  if (!Number.isFinite(to) || to === from) continue;
  const start = performance.now(), length = 900;
  const step = now => {
   const k = Math.min(1, (now - start) / length), eased = 1 - (1 - k) ** 3;
   el.textContent = prefix + Math.round(from + (to - from) * eased).toLocaleString('vi-VN');
   if (k < 1) requestAnimationFrame(step);
  };
  el.textContent = prefix + from.toLocaleString('vi-VN');
  requestAnimationFrame(step);
 }
}
