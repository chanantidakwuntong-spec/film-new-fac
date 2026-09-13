/**
 * Service Worker สำหรับระบบวิเคราะห์ฟิล์มกะหล่ำปลีม่วง
 * ช่วยให้เว็บแอปพลิเคชันทำงานได้แบบออฟไลน์ และติดตั้งเป็นแอปลงบนมือถือได้ถาวร
 */

const CACHE_NAME = 'cabbage-film-analyzer-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/js/app.js',
  './assets/js/storage.js',
  './assets/js/chart-manager.js',
  './assets/icons/icon.svg',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];

// ติดตั้ง Service Worker และบันทึกไฟล์ลงแคช
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell assets');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] Cache addAll partial warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// เคลียร์แคชเวอร์ชันเก่าเมื่อมีการอัปเดต
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ตรวจสอบและดึงข้อมูลจากแคชเมื่อไม่มีอินเทอร์เน็ต
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // ข้ามการแคชสำหรับ API endpoint เพื่อให้ข้อมูลประวัติสดใหม่อยู่เสมอเมื่อมีเน็ต
  if (requestUrl.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ status: 'offline', message: 'โหมดออฟไลน์: กำลังใช้งานข้อมูลในเครื่อง' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // สำหรับไฟล์ทั่วไป: Cache First, fallback to Network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
