// Service worker FangSchool: mở nhanh nhờ lưu tệp tĩnh (JS/CSS/icon) và nhận thông báo nhắc học.
// Không lưu dữ liệu riêng của học viên (API, học liệu, audio đều cần đăng nhập và đi thẳng tới máy chủ).
const STATIC = 'fangschool-static-v2';
const STATIC_PATH = /^\/(lesson\/.+\.(js|css)|build\/.+|icons\/.+|(style|design|access)\.css|request\.js|manifest\.webmanifest)$/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
 for (const key of await caches.keys()) if (key !== STATIC) await caches.delete(key);
 await self.clients.claim();
})()));

self.addEventListener('fetch', event => {
 const request = event.request, url = new URL(request.url);
 if (request.method !== 'GET' || url.origin !== location.origin) return;
 if (request.mode === 'navigate') {
  event.respondWith(fetch(request).catch(() => new Response(
   '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FangSchool</title>' +
   '<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f4f7f5;color:#0f241e;text-align:center;padding:16px">' +
   '<div><div style="font-size:56px">学</div><h1 style="font-size:20px">Chưa có kết nối mạng</h1><p>Kết nối lại rồi mở FangSchool để học tiếp. Tiến độ trên máy vẫn được giữ.</p>' +
   '<button onclick="location.reload()" style="padding:10px 18px;border-radius:12px;border:0;background:#13684c;color:#fff;font-weight:600">Thử lại</button></div>',
   {headers: {'Content-Type': 'text/html; charset=utf-8'}})));
  return;
 }
 if (!STATIC_PATH.test(url.pathname)) return;
 // Tệp có phiên bản trong URL (?v=… hoặc /build/ băm tên) không đổi nội dung: trả bản đã lưu ngay, cập nhật nền.
 // Tệp không có phiên bản (vd. request.js, study-common.js được import trần) phải lấy bản mới từ mạng trước,
 // nếu không trang mới có thể chạy chung với module cũ sau khi cập nhật; bản lưu chỉ dùng khi mất mạng.
 const versioned = url.searchParams.has('v') || url.pathname.startsWith('/build/');
 event.respondWith((async () => {
  const cache = await caches.open(STATIC);
  const network = fetch(request).then(response => {
   if (response.ok && response.type === 'basic') cache.put(request, response.clone()).catch(() => {});
   return response;
  });
  if (!versioned) return network.catch(async () => (await cache.match(request)) ?? Response.error());
  const cached = await cache.match(request);
  if (cached) { event.waitUntil(network.catch(() => {})); return cached; }
  return network;
 })());
});

self.addEventListener('message', event => {
 if (event.data === 'logout') event.waitUntil(caches.delete(STATIC));
});

self.addEventListener('push', event => {
 let data = {};
 try { data = event.data?.json() ?? {}; } catch { data = {body: event.data?.text()}; }
 event.waitUntil(self.registration.showNotification(data.title || 'FangSchool', {
  body: data.body || 'Đến giờ học 10 phút rồi!',
  icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', lang: 'vi',
  tag: data.tag || 'fangschool', renotify: true, data: {url: data.url || '/'},
 }));
});

self.addEventListener('notificationclick', event => {
 event.notification.close();
 const target = new URL(event.notification.data?.url || '/', location.origin).href;
 event.waitUntil((async () => {
  for (const client of await self.clients.matchAll({type: 'window', includeUncontrolled: true})) {
   if (new URL(client.url).origin === location.origin) {
    await client.focus();
    if ('navigate' in client) await client.navigate(target).catch(() => {});
    return;
   }
  }
  await self.clients.openWindow(target);
 })());
});
