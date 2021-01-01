var dbPromised = idb.open("football", 1, upgradeDb => {
    if (!upgradeDb.objectStoreNames.contains("teams")) {
        var teamObjectStore = upgradeDb.createObjectStore("teams", {
            keyPath: "id"
        });
        teamObjectStore.createIndex("teams", "teams", { unique: false });
    }
});



function saveFavorite(team) {
    return new Promise((resolve, reject) => {
        dbPromised
            .then(db => {
                tx = db.transaction("teams", "readwrite");
                var store = tx.objectStore("teams");
                return store.add(team);
            })
            .then(_ => {
                resolve(tx.complete);
                M.toast({ html: 'Tim berhasil di simpan.' })
            })
            .catch(e => {
                console.log(e);
                M.toast({ html: 'Tim gagal di simpan.' })
            });
    });
}

function deleteFavorite(team) {
    return new Promise((resolve, reject) => {
        dbPromised
            .then(db => {
                tx = db.transaction("teams", "readwrite");
                var store = tx.objectStore("teams");
                return store.delete(team.id);
            })
            .then(_ => {
                resolve(tx.complete);
                M.toast({ html: 'Tim berhasil dihapus.' })
            })
            .catch(e => {
                console.log(e);
                M.toast({ html: 'Tim gagal dihapus.' })
            });
    });
}

function getAll() {
    return new Promise((resolve, reject) => {
        dbPromised
            .then(db => {
                var tx = db.transaction("teams", "readonly");
                var store = tx.objectStore("teams");
                return store.getAll();
            })
            .then(teams => {
                resolve(teams);
            });
    });
}

function getById(id) {
    return new Promise((resolve, reject) => {
        dbPromised
            .then(db => {
                var tx = db.transaction("teams", "readwrite");
                var store = tx.objectStore("teams");
                return store.get(parseInt(id));
            })
            .then(teams => {
                if (teams != undefined) {
                    resolve(teams);
                } else {
                    reject("kosong");
                }
            })
    });
}

function cekAdaData(id) {
    return new Promise((resolve, reject) => {
        dbPromised
            .then(db => {
                var tx = db.transaction("teams", "readwrite");
                var store = tx.objectStore("teams");
                return store.get(parseInt(id));
            })
            .then(teams => {
                if (teams != undefined) {
                    resolve(true);
                } else {
                    reject(false);
                }
            })
    });
}