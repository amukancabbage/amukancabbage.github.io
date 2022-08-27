importScripts('https://storage.googleapis.com/workbox-cdn/releases/3.6.3/workbox-sw.js');

const version = '9';

if (workbox) {
    workbox.precaching.precacheAndRoute([
        { url: "/", revision: version },
        { url: "/nav.html", revision: version },
        { url: "/index.html", revision: version },
        { url: "/team.html", revision: version },
        { url: "/pages/bulanan.html", revision: version },
        { url: "/pages/home.html", revision: version },
        { url: "/pages/kinerja.html", revision: version },
        { url: "/pages/favorite.html", revision: version },
        { url: "/assets/vendor/materialize/css/materialize.min.css", revision: version },
        { url: "/assets/vendor/materialize/js/materialize.min.js", revision: version },
        { url: "/assets/vendor/jakearchibald/js/idb.js", revision: version },
        { url: "/assets/js/api.js", revision: version },
        { url: "/assets/js/auth.js", revision: version },
        { url: "/assets/js/db.js", revision: version },
        { url: "/assets/js/lib.js", revision: version },
        { url: "/assets/js/login.js", revision: version },
        { url: "/assets/js/nav.js", revision: version },
        { url: "/service-worker-register.js", revision: version },
        { url: "/favicon.ico", revision: version },
        { url: "/manifest.json", revision: version },
        { url: "https://fonts.googleapis.com/icon?family=Material+Icons", revision: version },
        { url: "https://fonts.gstatic.com/s/materialicons/v55/flUhRq6tzZclQEJ-Vdg-IuiaDsNcIhQ8tQ.woff2", revision: version },
        { url: "https://unpkg.com/snarkdown@1.0.2/dist/snarkdown.umd.js", revision: version },
        { url: "/assets/image/dikbud-192x192.png", revision: version },
        { url: "/assets/image/seriea-icon-400x400.png", revision: version },
        { url: "/assets/image/seriea-icon-512x512.png", revision: version }
    ], {
        ignoreUrlParametersMatching: [/.*/]
    });

    workbox.routing.registerRoute(
        new RegExp('https://amukancabbage.github.io/'),
        workbox.strategies.networkFirst()
    );

    workbox.routing.registerRoute(
        new RegExp('/pages/'),
        workbox.strategies.networkFirst({
            cacheName: 'pages',
        })
    );

    workbox.routing.registerRoute(
        /.*(?:png|gif|jpg|jpeg|svg)$/,
        workbox.strategies.networkFirst({
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
        workbox.strategies.networkFirst({
            cacheName: 'js',
        })
    );

    workbox.addEventListener('installed', event => {
        if (event.isUpdate) {
            if (confirm(`New content is available!. Click OK to refresh`)) {
                window.location.reload();
            }
        }
    });

    workbox.register();

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
