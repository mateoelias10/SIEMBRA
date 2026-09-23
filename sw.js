/* Cuentas de campo — copia local para trabajar sin señal.
   Al actualizar la app, subí el nuevo index.html y cambiá este número de versión. */
const VERSION = 'campo-v7';
const ARCHIVOS = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const esPagina = req.mode === 'navigate' || req.destination === 'document';
  if (esPagina) {
    /* con señal trae la última versión; sin señal usa la copia guardada */
    e.respondWith(
      fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(k => k.put('index.html', c)); return r; })
        .catch(() => caches.match('index.html').then(r => r || caches.match('./')))
    );
    return;
  }
  /* íconos, tipografías y demás: primero la copia guardada */
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      const c = r.clone(); caches.open(VERSION).then(k => k.put(req, c)); return r;
    }).catch(() => hit))
  );
});
