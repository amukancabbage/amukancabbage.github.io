importScripts('https://storage.googleapis.com/workbox-cdn/releases/3.6.3/workbox-sw.js');

if (workbox) {
    workbox.precaching.precacheAndRoute([
        { url: "/", revision: '7' },
        { url: "/nav.html", revision: '7' },
        { url: "/index.html", revision: '7' },
        { url: "/team.html", revision: '7' },
        { url: "/pages/bulanan.html", revision: '7' },
        { url: "/pages/home.html", revision: '7' },
        { url: "/pages/kinerja.html", revision: '7' },
        { url: "/pages/favorite.html", revision: '7' },
        { url: "/assets/vendor/materialize/css/materialize.min.css", revision: '7' },
        { url: "/assets/vendor/materialize/js/materialize.min.js", revision: '7' },
        { url: "/assets/vendor/jakearchibald/js/idb.js", revision: '7' },
        { url: "/assets/js/api.js", revision: '7' },
        { url: "/assets/js/auth.js", revision: '7' },
        { url: "/assets/js/db.js", revision: '7' },
        { url: "/assets/js/lib.js", revision: '7' },
        { url: "/assets/js/login.js", revision: '7' },
        { url: "/assets/js/nav.js", revision: '7' },
        { url: "/service-worker-register.js", revision: '7' },
        { url: "/favicon.ico", revision: '7' },
        { url: "/manifest.json", revision: '7' },
        { url: "https://fonts.googleapis.com/icon?family=Material+Icons", revision: '7' },
        { url: "https://fonts.gstatic.com/s/materialicons/v55/flUhRq6tzZclQEJ-Vdg-IuiaDsNcIhQ8tQ.woff2", revision: '7' },
        { url: "https://unpkg.com/snarkdown@1.0.2/dist/snarkdown.umd.js", revision: '7' },
        { url: "/assets/image/dikbud-192x192.png", revision: '7' },
        { url: "/assets/image/seriea-icon-400x400.png", revision: '7' },
        { url: "/assets/image/seriea-icon-512x512.png", revision: '7' }
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
