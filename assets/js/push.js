let webPush = require('web-push');
const vapidKeys = {
    "publicKey": "BAUixQTEf3yhmS_A4UCT6Mjcl78WMfskYRyxHC939LFXghnLzKLAyFUiJ7SLw22ZoDIa7_OxivYWZkd1UgyPC_U",
    "privateKey": "rK0BX7Xc0rOFe5x8rXyKhaydgs_lMrQWP9ESJvSNRuY"
};


webPush.setVapidDetails(
    'mailto:mirza.yogy@gmail.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
)
let pushSubscription = {
    "endpoint": "https://fcm.googleapis.com/fcm/send/f0einbwNKPU:APA91bFyFTmruDFE0sE7fNhFF8owgTlMvtPg8jnPBx5N8wK5PcWLCND5l_O_U79JqH5cYONS3cmQ9c8EvbmsprgmvUQUO09OEGPGG7eyFsCFP1MQZyMSIA8Q-zPQpgVILyeiPMKsujpG",
    "keys": {
        "p256dh": "BNgI3oh8U+3Il0xVGEgwzDpPTXffQhD2sv38SyVHZDUswFSiDZlMKAHBlegFHSlPtQ4Cgo1hZwXIIbR0X3fhdow=",
        "auth": "f9as4WAe0NFC9AHNWi6YtQ=="
    }
};
let payload = 'Selamat! Aplikasi Anda sudah dapat menerima push notifikasi!';
let options = {
    gcmAPIKey: '1015820604484',
    TTL: 60
};
webPush.sendNotification(
    pushSubscription,
    payload,
    options
);