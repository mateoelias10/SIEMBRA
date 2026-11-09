/* Control de Siembra — copia local para trabajar sin señal.
   Al actualizar la app: subí el nuevo index.html y cambiá este número de versión.

   REGLA DE ORO: la app abre SIEMPRE desde la copia guardada, nunca espera a la red.
   En el campo el problema no es quedarse sin señal —ahí el pedido falla rápido y
   la copia entra enseguida— sino tener una rayita que no mueve datos: el pedido
   no falla, queda colgado, y una app que espera a la red se queda en blanco.
   Por eso primero abrimos, y recién después buscamos si hay versión nueva. */

const VERSION = 'control-siembra-v27';
const ARCHIVOS = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    /* index.html es obligatorio: sin él no hay app */
    await c.add('index.html');
    /* el resto va uno por uno; que falte un ícono no puede dejarte sin app */
    await Promise.all(ARCHIVOS
      .filter(a => a !== 'index.html')
      .map(a => c.add(a).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* busca la versión nueva por atrás, sin hacer esperar a nadie */
async function refrescar(req) {
  try {
    const r = await fetch(req, { cache: 'no-store' });
    if (r && r.ok) {
      const c = await caches.open(VERSION);
      await c.put('index.html', r.clone());
    }
  } catch (e) { /* sin señal: seguimos con la copia que tenemos */ }
}

const SIN_COPIA = '<!doctype html><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<p style="font:16px -apple-system,sans-serif;padding:24px;line-height:1.5">' +
  'Todavía no hay copia guardada en este teléfono.<br>Abrí la app una vez con señal y después funciona sin.</p>';

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  const esPagina = req.mode === 'navigate' || req.destination === 'document';

  if (esPagina) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const hit = (await c.match('index.html')) || (await c.match('./'));
      if (hit) {
        e.waitUntil(refrescar(req));   /* abre ya; la versión nueva queda para la próxima */
        return hit;
      }
      try {
        const r = await fetch(req);
        if (r && r.ok) c.put('index.html', r.clone());
        return r;
      } catch (err) {
        return new Response(SIN_COPIA, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  /* íconos y demás: primero la copia guardada */
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r && r.ok) {
        const c = await caches.open(VERSION);
        c.put(req, r.clone());
      }
      return r;
    } catch (err) {
      return new Response('', { status: 504 });
    }
  })());
});
