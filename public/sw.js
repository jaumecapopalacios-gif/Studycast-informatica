const CACHE = 'estudiocs-v2'; // Subimos a v2 para forzar actualización
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png', // Nuevo ícono para PWA
  '/screenshot-wide.png',   // Nueva captura horizontal
  '/screenshot-narrow.png'  // Nueva captura vertical
];

// 1. Instalar y guardar en caché
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      console.log('Cache abierto, guardando assets...');
      return c.addAll(ASSETS);
    })
  );
  self.skipWaiting(); // Fuerza al SW a activarse de inmediato
});

// 2. Activar y limpiar cachés viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log('Borrando caché antiguo:', k);
          return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Interceptar peticiones (Fetch)
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // NUNCA guardar en caché las llamadas a la API de IA o generación
  if (url.pathname.startsWith('/api/')) {
    return; 
  }

  // Solo manejar peticiones GET
  if (e.request.method !== 'GET') {
    return;
  }

  // Estrategia: Cache First, luego Red (y guardar en caché lo que se descargue)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        return cached;
      }
      
      return fetch(e.request).then(res => {
        // Si la respuesta es válida, clonarla y guardarla
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => {
        // Si falla la red y es una navegación de página, devolver el index.html
        if (e.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
