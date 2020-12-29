var dbPromised = idb.open("standings", 1, function (upgradeDb) {
    var articlesObjectStore = upgradeDb.createObjectStore("standings", {
        keyPath: "ID"
    });
    articlesObjectStore.createIndex("team.name", "team.name", { unique: false });
});