var dbPromised = idb.open("football", 1, function (upgradeDb) {
    var teamObjectStore2 = upgradeDb.createObjectStore("teams", {
        keyPath: "id"
    });
    teamObjectStore2.createIndex("name", "name", { unique: false });
});

function saveForLater(team) {
    dbPromised
        .then(function (db) {
            var tx = db.transaction("teams", "readwrite");
            var store = tx.objectStore("teams");
            console.log(store);
            store.add(team);
            return tx.complete;
        })
        .then(function () {
            console.log("Artikel berhasil di simpan.");
        });
}