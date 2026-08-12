const CACHE_NAME = 'memorabet-solo-v32';

const LOCAL_ASSETS = [
  './',
  './index.html',
  './privacidad.html',
  './style.css',
  './main.js',
  './audio.js',
  './constants.js',
  './firebase-service.js',
  './game.js',
  './i18n.js',
  './state.js',
  './ui.js',
  './utils.js',
  './manifest.webmanifest',
  './assets/logo.png',
  './assets/mobile-loading.png',
  './assets/mobile-start-background.png',
  './assets/ies-logo.png',
  './assets/casino-background.png',
  './assets/ucm-classroom-background.png',
  './assets/favicon-16.png',
  './assets/favicon-32.png',
  './assets/app-icon-192.png',
  './assets/app-icon-512.png',
  './assets/animals/vaca.png',
  './assets/animals/zorro.png',
  './assets/animals/gato.png',
  './assets/animals/pollo.png',
  './assets/animals/raton.png',
  './assets/animals/leon.png',
  './assets/animals/rana.png',
  './assets/animals/perro.png',
  './assets/avatars/avatar-01.png',
  './assets/card-backs/ucm-statistics-default.png',
  './assets/sounds/casino-vip-7.mp3',
  './assets/sounds/we-will-empty-this-casino.mp3',
  './assets/sounds/casino-vip-1.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(LOCAL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if(request.method !== 'GET') return;

  const url = new URL(request.url);
  if(url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if(response && response.ok){
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
