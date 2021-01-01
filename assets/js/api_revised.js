const base_url_football = "https://api.football-data.org/v2/";
const TOKEN = "e0e06211977540d3b95c6e043d830a36";


function status(response) {
    if (response.status !== 200) {
        console.log("Error : " + response.status);

        return Promise.reject(new Error(response.statusText));
    } else {
        return Promise.resolve(response);
    }
}

function json(response) {
    return response.json();
}

function error(error) {
    console.log("Error : " + error);
}

function createTable(data) {

    let tableHTML = `
          <table class="striped">
            <thead>
              <tr>
                <th>Pos</th>
                <th colspan="2">Team</th>
                <th></th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>`;

    data.forEach(function (team) {
        tableHTML += `
                <tr>
                <td>${team.position}</td>
                <td><img alt="Team Logo" width="25" height="25" src="${team.team.crestUrl}" /><td>
                <td>
                  <a href="./team.html?id=${team.team.id}">
                    ${team.team.name}
                  </a>
                </td>
                <td>${team.points}</td>
              </tr>`;
    });

    tableHTML += `</tbody></table>`;
    return tableHTML;
}

function createCard(data) {
    return teamHTML = `
              <div class="card">
                <div class="card-image waves-effect waves-block waves-light">
                  <img alt="Team Logo" height="90" src="${data.crestUrl}" />
                </div>
                <div class="card-content">
                  <span class="card-title">${data.name}</span>
                  ${snarkdown(data.address)}
                </div>
              </div>
            `;
}

function getStandings() {

    if ('caches' in window) {
        caches.match(base_url_football + "competitions/2019/standings").then(function (response) {
            if (response) {
                response.json().then(function (data) {

                    standings = data.standings[0].table;
                    document.getElementById("standings").innerHTML = createTable(standings);

                })
            }
        })
    }

    fetch(base_url_football + "competitions/2019/standings", {
        method: "GET",
        headers: { "X-Auth-Token": TOKEN }
    })
        .then(status)
        .then(json)
        .then(function (data) {

            standings = data.standings[0].table;
            document.getElementById("standings").innerHTML = createTable(standings);

        })
        .catch(error);
}

function getTeamById() {
    return new Promise(function (resolve, reject) {
        // Ambil nilai query parameter (?id=)
        var urlParams = new URLSearchParams(window.location.search);
        var idParam = urlParams.get("id");
        if ("caches" in window) {
            caches.match(base_url_football + "teams/" + idParam).then(function (response) {
                if (response) {
                    response.json().then(function (data) {

                        document.getElementById("body-content").innerHTML = createCard(data);
                        resolve(data);

                    });
                }
            });
        }
        fetch(base_url_football + "teams/" + idParam, {
            method: "GET",
            headers: { "X-Auth-Token": TOKEN }
        })
            .then(status)
            .then(json)
            .then(function (data) {

                document.getElementById("body-content").innerHTML = createCard(data);
                resolve(data);

            });
    });
}

function getSavedTeams() {
    getAll().then(function (standings) {
        var standingsHTML = `<table class="striped">
        <thead>
          <tr>
            <th colspan="2">Team</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
        `;
        standings.forEach(function (data) {
            standingsHTML += `
              <tr>
                <td><img alt="Team Logo" width="25" height="25" src="${data.crestUrl}" /><td>
                <td>
                  <a href="./team.html?id=${data.id}&saved=true">
                    ${data.name}
                  </a>
                </td>
              </tr>`;
        });

        standingsHTML += `</tbody></table>`;
        // Sisipkan komponen card ke dalam elemen dengan id #body-content
        document.getElementById("body-content").innerHTML = standingsHTML;
    });
}

function getSavedTeamById() {
    var urlParams = new URLSearchParams(window.location.search);
    var idParam = urlParams.get("id");
    return new Promise(function (resolve, reject) {
        getById(idParam).then(function (team) {

            document.getElementById("body-content").innerHTML = createCard(team);
            resolve(team);

        });
    });
}