const CACHE_NAME = 'ime-friendly-pwa-v26';
const OFFLINE_URL = 'offline.html';

const PRECACHE_URLS = [
    'index.html',
    'ouverture.html',
    'reseau.html',
    'blog.html',
    'outils.html',
    'detail-outil.html',
    'profil.html',
    'teams.html',
    'admin-gestion.html',
    'contact.html',
    'messagerie.html',
    'ressources.html',
    OFFLINE_URL,
    'style.css',
    'style-ouverture.css',
    'style-reseau.css',
    'style-blog.css',
    'style-outils.css',
    'style-profil.css',
    'style-teams.css',
    'style-admin.css',
    'style-contact.css',
    'style-messagerie.css',
    'style-messages.css',
    'style-ressources.css',
    'style-accessibility.css',
    'manifest.webmanifest',
    'images/pwa/icon-192.svg',
    'images/pwa/icon-512.svg',
    'images/ressources/cra-lorraine.png',
    'images/ressources/ars-grand-est.jpg',
    'images/ressources/enfant-different.png',
    'images/ressources/handicap-gouv.jpg',
    'images/ressources/handisport.png',
    'images/ressources/autisme-info-service.png',
    'images/ressources/larche-france.png',
    'images/ressources/10doigts.png',
    'images/ressources/ime-le-point-du-jour.png',
    'js/data-store.js',
    'js/supabase-client.js',
    'js/supabase-sync.js',
    'js/auth.js',
    'js/index.js',
    'js/ouverture.js',
    'js/resources-data.js',
    'js/ressources.js',
    'js/accessibility.js',
    'js/reseau.js',
    'js/blog.js',
    'js/outils.js',
    'js/detail-outil.js',
    'js/profil.js',
    'js/teams.js',
    'js/admin-gestion.js',
    'js/contact.js',
    'js/messaging-core.js',
    'js/user-favorites.js',
    'js/activity-notifications.js',
    'js/messages-widget.js',
    'js/messagerie.js',
    'js/pwa-init.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys
                .filter((key) => key !== CACHE_NAME)
                .map((key) => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const fresh = await fetch(request);
                const cache = await caches.open(CACHE_NAME);
                cache.put(request, fresh.clone());
                return fresh;
            } catch (error) {
                const cached = await caches.match(request);
                if (cached) return cached;
                return caches.match(OFFLINE_URL);
            }
        })());
        return;
    }

    const isStyleOrScript = ['style', 'script', 'worker'].includes(request.destination);
    const isImageOrFont = ['image', 'font'].includes(request.destination);

    // Pour eviter les anciennes versions visuelles en dev/usage normal:
    // CSS/JS en "network first" puis fallback cache.
    if (isStyleOrScript) {
        event.respondWith((async () => {
            try {
                const fresh = await fetch(request);
                const cache = await caches.open(CACHE_NAME);
                cache.put(request, fresh.clone());
                return fresh;
            } catch (error) {
                const cached = await caches.match(request);
                if (cached) return cached;
                return new Response('', { status: 503, statusText: 'Offline' });
            }
        })());
        return;
    }

    // Images/polices en "cache first" pour garder de bonnes performances.
    if (isImageOrFont) {
        event.respondWith((async () => {
            const cached = await caches.match(request);
            if (cached) return cached;

            try {
                const fresh = await fetch(request);
                const cache = await caches.open(CACHE_NAME);
                cache.put(request, fresh.clone());
                return fresh;
            } catch (error) {
                return new Response('', { status: 503, statusText: 'Offline' });
            }
        })());
    }
});
