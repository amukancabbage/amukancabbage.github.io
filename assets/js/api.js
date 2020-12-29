var base_url_football = "https://api.football-data.org/v2/";
// Blok kode yang akan di panggil jika fetch berhasil
function status(response) {
    if (response.status !== 200) {
        console.log("Error : " + response.status);
        // Method reject() akan membuat blok catch terpanggil
        return Promise.reject(new Error(response.statusText));
    } else {
        // Mengubah suatu objek menjadi Promise agar bisa "di-then-kan"
        return Promise.resolve(response);
    }
}
// Blok kode untuk memparsing json menjadi array JavaScript
function json(response) {
    return response.json();
}
// Blok kode untuk meng-handle kesalahan di blok catch
function error(error) {
    // Parameter error berasal dari Promise.reject()
    console.log("Error : " + error);
}
// Blok kode untuk melakukan request data json

function getStandings() {

  if ('caches' in window) {
    caches.match(base_url_football + "competitions/2019/standings").then(function (response) {
      if (response) {
        response.json().then(function (data) {
          var standingsHTML = `
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
        
          standings = data.standings[0].table;
          console.log(standings);
          standings.forEach(function (data) {
            standingsHTML += `
                <tr>
                <td>${data.position}</td>
                <td><img alt="Team Logo" width="25" height="25" src="${data.team.crestUrl}" /><td>
                <td>
                  <a href="./team.html?id=${data.team.id}">
                    ${data.team.name}
                  </a>
                </td>
                <td>${data.points}</td>
              </tr>`;
              
          });
          
          standingsHTML += `</tbody></table>`;
          console.log(document.getElementById("standings"));
          document.getElementById("standings").innerHTML = standingsHTML;
        })
      }
    })
    console.log("caches in window");
  }

  fetch(base_url_football + "competitions/2019/standings",{
    method: "GET",
    headers: { "X-Auth-Token": "e0e06211977540d3b95c6e043d830a36" }
  })
    .then(status)
    .then(json)
    .then(function (data) {

      var standingsHTML = `<table class="striped">
        <thead>
          <tr>
            <th>Pos</th>
            <th colspan="2">Team</th>
            <th></th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
        `;
      standings = data.standings[0].table;
      standings.forEach(function (data) {
        standingsHTML += `
              <tr>
                <td>${data.position}</td>
                <td><img alt="Team Logo" width="25" height="25" src="${data.team.crestUrl}" /><td>
                <td>
                  <a href="./team.html?id=${data.team.id}">
                    ${data.team.name}
                  </a>
                </td>
                <td>${data.points}</td>
              </tr>`;
      });

      standingsHTML += `</tbody></table>`;


      // Sisipkan komponen card ke dalam elemen dengan id #content
      document.getElementById("standings").innerHTML = standingsHTML;
      console.log("fetched");

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
            var teamHTML = `
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
            // Sisipkan komponen card ke dalam elemen dengan id #content
            document.getElementById("body-content").innerHTML = teamHTML;
            resolve(data);
          });
        }
      });
    }
    fetch(base_url_football + "teams/" + idParam, {
      method: "GET",
      headers: { "X-Auth-Token": "e0e06211977540d3b95c6e043d830a36" }
    })
      .then(status)
      .then(json)
      .then(function (data) {
        // Objek JavaScript dari response.json() masuk lewat variabel data.
        // console.log(data);
        // Menyusun komponen card artikel secara dinamis
        var teamHTML = `
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
        // Sisipkan komponen card ke dalam elemen dengan id #content
        document.getElementById("body-content").innerHTML = teamHTML;
        resolve(data);
      });
  });


 
  
}