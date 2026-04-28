/* 공인노무사 기출문제 풀이 — 서비스 워커 (오프라인 캐시)
   캐시 전략:
     - HTML/CSS/JS/manifest: network-first, 실패 시 캐시
     - 데이터(problems.js), 이미지: cache-first (용량 절약)
     - 기타 동일 출처 자원: stale-while-revalidate */
const VERSION = 'cpla-quiz-v17-20260427-keyword-unify-kw-fullsubject-admin-promote-pending-grade-seo-race-fix-free-block-admin-init-brand-fix-expl-enhance-expl-auto02';
const CORE = [
  './',
  './index.html',
  './years.html',
  './subjects.html',
  './exam.html',
  './dashboard.html',
  './manifest.json',
  './css/style.css',
  './js/common.js',
  './images/icon-192.png',
  './images/icon-512.png',
  './images/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(CORE).catch(err => console.warn('[SW] core cache partial', err)))
          .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
          .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only cache same-origin
  if (url.origin !== location.origin) return;
  // ⚠ /api/* 는 절대 캐시하지 않음 (세션·인증·문제 필터 등 실시간 응답 필수)
  if (url.pathname.startsWith('/api/')) return;
  // /data/problems.js' bypass — 무료/비로그인 우회 차단 위해 항상 서버 응답
  if (url.pathname === '/data/problems.js') return;

  const isHTML = req.destination === 'document' || req.headers.get('accept')?.includes('text/html');
  const isData = url.pathname.endsWith('/problems.js') || url.pathname.endsWith('/manifest.json');
  const isImg = req.destination === 'image' || /\.(png|jpe?g|svg|gif|webp)$/i.test(url.pathname);

  if (isHTML) {
    // network-first
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  if (isImg || isData) {
    // cache-first
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
          return res;
        });
      })
    );
    return;
  }

  // Default: stale-while-revalidate
  e.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
