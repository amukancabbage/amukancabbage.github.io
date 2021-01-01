const CACHE_NAME = "001";
var urlsToCache = [
    "/",
    "/nav.html",
    "/index.html",
    "/team.html",
    "/pages/home.html",
    "/pages/favorite.html",
    "/assets/vendor/materialize/css/materialize.min.css",
    "/assets/vendor/materialize/js/materialize.min.js",
    "/assets/vendor/jakearchibald/js/idb.js",
    "/assets/js/nav.js",
    "/assets/js/api.js",
    "/assets/js/db.js",
    "/service-worker-register.js",
    "/favicon.ico",
    "/manifest.json",
    "https://fonts.googleapis.com/icon?family=Material+Icons",
    "https://fonts.gstatic.com/s/materialicons/v55/flUhRq6tzZclQEJ-Vdg-IuiaDsNcIhQ8tQ.woff2",
    "https://unpkg.com/snarkdown@1.0.2/dist/snarkdown.umd.js",
    "/assets/image/seriea-apple-icon-192x192.png",
    "/assets/image/seriea-icon-400x400.png",
    "/assets/image/seriea-icon-512x512.png"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener("fetch", event => {
    var base_url_football = "https://api.football-data.org/v2/";
    if (event.request.url.indexOf(base_url_football) > -1) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return fetch(event.request).then(response => {
                    cache.put(event.request.url, response.clone());
                    return response;
                })
            })
        );
    } else {
        event.respondWith(
            caches.match(event.request, { ignoreSearch: true }).then(response => {
                return response || fetch(event.request);
            })
        )
    }
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName != CACHE_NAME) {
                        console.log("ServiceWorker: cache " + cacheName + " dihapus");
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('push', event => {
    var body;
    if (event.data) {
        body = event.data.text();
    } else {
        body = 'Push message no payload';
    }
    var options = {
        body: body,
        icon: 'img/notification.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        }
    };
    event.waitUntil(
        self.registration.showNotification('Push Notification', options)
    );
});
