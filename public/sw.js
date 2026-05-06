// ── Tracto Service Worker ─────────────────────────────────────────────────────
// Handles: static cache-first, API network-first, offline fallback, push, notifications

const STATIC_CACHE = 'tracto-static-v1';
const API_CACHE    = 'tracto-api-v1';
const API_TTL_MS   = 30 * 60 * 1000; // 30 min

const STATIC_PRECACHE = [
  '/',
  '/app/dashboard',
  '/tracto-icon.png',
  '/favicon.svg',
];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sem conexão — Tracto</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #080809;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
    }
    .card {
      max-width: 400px;
      width: 100%;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 20px;
      padding: 2rem;
      text-align: center;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; font-weight: 800; color: #fff; margin-bottom: 0.5rem; }
    p { font-size: 0.875rem; color: #64748b; line-height: 1.6; }
    .badge {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 0.5rem 1.25rem;
      background: rgba(236,91,19,0.12);
      border: 1px solid rgba(236,91,19,0.2);
      border-radius: 99px;
      font-size: 0.75rem;
      font-weight: 700;
      color: #ec5b13;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📡</div>
    <h1>Sem conexão</h1>
    <p>Dados em cache disponíveis — reconecte para sincronizar com o servidor Tracto.</p>
    <span class="badge">Modo offline ativo</span>
  </div>
</body>
</html>`;

// ── Install: precache static assets ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(STATIC_PRECACHE).catch(() => {
        // Silently skip assets that fail (e.g. in dev mode)
      })
    )
  );
  // Activate immediately
  self.skipWaiting();
});

// ── Activate: cleanup old caches + claim clients ──────────────────────────────
self.addEventListener('activate', (event) => {
  const VALID = [STATIC_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !VALID.includes(k))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Helper: check if a cached response is still within TTL ──────────────────
function isCacheFresh(cached) {
  if (!cached) return false;
  const dateHeader = cached.headers.get('date');
  if (!dateHeader) return false;
  const cachedAt = new Date(dateHeader).getTime();
  return Date.now() - cachedAt < API_TTL_MS;
}

// ── Helper: is this request targeting an API we want to cache? ───────────────
function isApiRequest(url) {
  return (
    url.hostname.includes('open-meteo.com') ||
    url.pathname.startsWith('/api/')
  );
}

// ── Fetch: strategy dispatch ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and browser-extension requests
  if (event.request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  if (isApiRequest(url)) {
    // ── Network-first with cache fallback (API) ──
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        try {
          const networkResponse = await fetch(event.request.clone());
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          // Network failed → try cache
          const cached = await cache.match(event.request);
          if (cached) return cached;
          // No cache → offline response
          return new Response(OFFLINE_HTML, {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }
      })
    );
    return;
  }

  // ── Cache-first with network fallback (static assets) ──
  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const networkResponse = await fetch(event.request.clone());
        if (networkResponse.ok) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch {
        // Navigation fallback → serve offline page
        if (event.request.mode === 'navigate') {
          return new Response(OFFLINE_HTML, {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }
        // Non-navigation resource missing → transparent error
        return new Response('', { status: 408 });
      }
    })
  );
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', function (event) {
  if (event.data) {
    let payload = { title: 'Tracto', body: 'Nova notificação do sistema.' };

    try {
      if (typeof event.data.json === 'function') {
        payload = event.data.json();
      } else {
        payload.body = event.data.text();
      }
    } catch (e) {
      payload.body = event.data.text();
    }

    const options = {
      body: payload.body,
      icon: '/tracto-icon.png',
      badge: '/tracto-icon.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1,
        url: payload.url || '/',
      },
    };

    event.waitUntil(self.registration.showNotification(payload.title, options));
  }
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
