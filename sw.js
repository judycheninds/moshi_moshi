self.addEventListener('install', event => {
    console.log('[ServiceWorker] Install');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('[ServiceWorker] Activate');
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
    // Basic pass-through to satisfy PWA criteria
    event.respondWith(
        fetch(event.request).catch(() => {
            return new Response('You are offline.');
        })
    );
});
