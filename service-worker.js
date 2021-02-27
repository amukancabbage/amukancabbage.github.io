importScripts('https://storage.googleapis.com/workbox-cdn/releases/3.6.3/workbox-sw.js');

if (workbox) {
    workbox.precaching.precacheAndRoute([
        { url: "/", revision: '3' },
        { url: "/nav.html", revision: '3' },
        { url: "/index.html", revision: '3' },
        { url: "/team.html", revision: '3' },
        { url: "/pages/home.html", revision: '3' },
        { url: "/pages/favorite.html", revision: '3' },
        { url: "/assets/vendor/materialize/css/materialize.min.css", revision: '3' },
        { url: "/assets/vendor/materialize/js/materialize.min.js", revision: '3' },
        { url: "/assets/vendor/jakearchibald/js/idb.js", revision: '3' },
        { url: "/assets/js/api.js", revision: '3' },
        { url: "/assets/js/auth.js", revision: '3' },
        { url: "/assets/js/db.js", revision: '3' },
        { url: "/assets/js/lib.js", revision: '3' },
        { url: "/assets/js/login.js", revision: '3' },
        { url: "/assets/js/nav.js", revision: '3' },
        { url: "/service-worker-register.js", revision: '3' },
        { url: "/favicon.ico", revision: '3' },
        { url: "/manifest.json", revision: '3' },
        { url: "https://fonts.googleapis.com/icon?family=Material+Icons", revision: '3' },
        { url: "https://fonts.gstatic.com/s/materialicons/v55/flUhRq6tzZclQEJ-Vdg-IuiaDsNcIhQ8tQ.woff2", revision: '3' },
        { url: "https://unpkg.com/snarkdown@1.0.2/dist/snarkdown.umd.js", revision: '3' },
        { url: "/assets/image/dikbud-192x192.png", revision: '3' },
        { url: "/assets/image/seriea-icon-400x400.png", revision: '3' },
        { url: "/assets/image/seriea-icon-512x512.png", revision: '3' }
    ], {
        ignoreUrlParametersMatching: [/.*/]
    });

    workbox.routing.registerRoute(
        new RegExp('https://api.football-data.org/v2/'),
        workbox.strategies.staleWhileRevalidate()
    );

    workbox.routing.registerRoute(
        new RegExp('/pages/'),
        workbox.strategies.staleWhileRevalidate({
            cacheName: 'pages',
        })
    );

    workbox.routing.registerRoute(
        /.*(?:png|gif|jpg|jpeg|svg)$/,
        workbox.strategies.cacheFirst({
            cacheName: 'image',
            plugins: [
                new workbox.cacheableResponse.Plugin({
                    statuses: [0, 200]
                }),
                new workbox.expiration.Plugin({
                    maxEntries: 100,
                    maxAgeSeconds: 30 * 24 * 60 * 60,
                }),
            ]
        })
    );

    workbox.routing.registerRoute(
        /\.(?:js)$/,
        workbox.strategies.cacheFirst({
            cacheName: 'js',
        })
    );

} else
    console.log(`Workbox gagal dimuat`);

self.addEventListener('push', event => {
    let body;
    if (event.data) {
        body = event.data.text();
    } else {
        body = 'Push message no payload';
    }
    let options = {
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
