var dbPromised = idb.open("football", 1, function (upgradeDb) {
    if (!upgradeDb.objectStoreNames.contains("teams")) {
        var teamObjectStore = upgradeDb.createObjectStore("teams", {
            keyPath: "id"
        });
        teamObjectStore.createIndex("teams", "teams", { unique: false });
    }
});



function saveForLater(team) {
    dbPromised
        .then(function (db) {
            var tx = db.transaction("teams", "readwrite");
            var store = tx.objectStore("teams");
            store.add(team);
            return tx.complete;
        })
        .then(function () {
            console.log("Tim berhasil di simpan.");
        });
}

function getAll() {
    return new Promise(function (resolve, reject) {
        dbPromised
            .then(function (db) {
                var tx = db.transaction("teams", "readonly");
                var store = tx.objectStore("teams");
                return store.getAll();
            })
            .then(function (teams) {
                resolve(teams);
            });
    });
}

function getById(id) {
    return new Promise(function (resolve, reject) {
        dbPromised
            .then(function (db) {
                var tx = db.transaction("teams", "readwrite");
                var store = tx.objectStore("teams");
                return store.get(id);
            })
            .then(function (teams) {
                resolve(teams);
            })
    });
}