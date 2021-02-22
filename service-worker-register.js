// REGISTER SERVICE WORKER
if ("serviceWorker" in navigator) {
    window.addEventListener("load", _ => {
        navigator.serviceWorker
            .register("/service-worker.js")
            .then(_ => {
                console.log("Pendaftaran ServiceWorker berhasil");
            })
            .catch(_ => {
                console.log("Pendaftaran ServiceWorker gagal");
            });
    });
} else {
    console.log("ServiceWorker belum didukung browser ini.");
}

// Periksa fitur Notification API
if ('Notification' in window) {
    Notification.requestPermission().then(result => {
        if (result === "denied") {
            console.log("Fitur notifikasi tidak diijinkan.");
            return;
        } else if (result === "default") {
            console.error("Pengguna menutup kotak dialog permintaan ijin.");
            return;
        }

        navigator.serviceWorker.ready.then(_ => {

            if (('PushManager' in window)) {

                navigator.serviceWorker.ready.then(() => {

                    // const vapidKeys = "BAUixQTEf3yhmS_A4UCT6Mjcl78WMfskYRyxHC939LFXghnLzKLAyFUiJ7SLw22ZoDIa7_OxivYWZkd1UgyPC_U";
                    // navigator.serviceWorker.getRegistration().then(registration => {

                    //     registration.pushManager.subscribe({
                    //         userVisibleOnly: true,
                    //         applicationServerKey: urlBase64ToUint8Array(vapidKeys)
                    //     }).then(subscribe => {
                    //         console.log('Berhasil melakukan subscribe dengan endpoint: ', subscribe.endpoint);
                    //         console.log('Berhasil melakukan subscribe dengan p256dh key: ', btoa(String.fromCharCode.apply(
                    //             null, new Uint8Array(subscribe.getKey('p256dh')))));
                    //         console.log('Berhasil melakukan subscribe dengan auth key: ', btoa(String.fromCharCode.apply(
                    //             null, new Uint8Array(subscribe.getKey('auth')))));
                    //     }).catch(e => {
                    //         console.error('Tidak dapat melakukan subscribe ', e.message);
                    //     });
                    // });
                });
            }
        });
    });
}

// Meminta ijin menggunakan Notification API
function requestPermission() {
    Notification.requestPermission().then(result => {
        if (result === "denied") {
            console.log("Fitur notifikasi tidak diijinkan.");
            return;
        } else if (result === "default") {
            console.error("Pengguna menutup kotak dialog permintaan ijin.");
            return;
        }

        console.log("Fitur notifikasi diijinkan.");
    });
}

function showNotifikasiSederhana() {
    const title = 'Notifikasi Sederhana';
    const options = {
        'body': 'Ini adalah konten notifikasi. \nBisa menggunakan baris baru.',
    }
    if (Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, options);
        });
    } else {
        console.error('FItur notifikasi tidak diijinkan.');
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}