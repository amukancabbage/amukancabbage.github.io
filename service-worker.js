const CACHE_NAME = "001";
var urlsToCache = [
    "/",
    "/nav.html",
    "/index.html",
    "/team.html",
    "/pages/home.html",
    "/pages/about.html",
    "/pages/contact.html",
    "/assets/vendor/materialize/css/materialize.min.css",
    "/assets/vendor/materialize/js/materialize.min.js",
    "/assets/js/nav.js",
    "/assets/js/api.js",
    "/assets/image/juve512x512.png"
];

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener("fetch", function (event) {
    var base_url_football = "https://api.football-data.org/v2/";
    if (event.request.url.indexOf(base_url_football) > -1) {
        event.respondWith(
            caches.open(CACHE_NAME).then(function (cache) {
                return fetch(event.request).then(function (response) {
                    cache.put(event.request.url, response.clone());
                    return response;
                })
            })
        );
    } else {
        event.respondWith(
            caches.match(event.request, { ignoreSearch: true }).then(function (response) {
                return response || fetch(event.request);
            })
        )
    }
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames.map(function (cacheName) {
                    if (cacheName != CACHE_NAME) {
                        console.log("ServiceWorker: cache " + cacheName + " dihapus");
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
