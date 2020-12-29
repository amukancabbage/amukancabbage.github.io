var base_url = "https://reader-api.dicoding.dev/";
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
function getArticles() {
    fetch(base_url + "articles")
        .then(status)
        .then(json)
        .then(function (data) {
            // Objek/array JavaScript dari response.json() masuk lewat data.
            // Menyusun komponen card artikel secara dinamis
            var articlesHTML = "";
            data.result.forEach(function (article) {
                articlesHTML += `
              <div class="card">
                <a href="./article.html?id=${article.id}">
                  <div class="card-image waves-effect waves-block waves-light">
                    <img src="${article.thumbnail}" />
                  </div>
                </a>
                <div class="card-content">
                  <span class="card-title truncate">${article.title}</span>
                  <p>${article.description}</p>
                </div>
              </div>
            `;
            });
            // Sisipkan komponen card ke dalam elemen dengan id #content
            document.getElementById("articles").innerHTML = articlesHTML;
        })
        .catch(error);
}

function getStandings() {

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
        console.log(data);
        standingsHTML += `
              <tr>
                <td>${data.position}</td>
                <td><img width="25" height="25" src="${data.team.crestUrl}" /><td>
                <td>
                  <a href="./team.html?id=${data.team.id}">
                    ${data.team.name}
                  </a>
                </td>
                <td>${data.points}</td>
              </tr>`;
      });

      standingsHTML += `</tbody></table>`


      // Sisipkan komponen card ke dalam elemen dengan id #content
      document.getElementById("standings").innerHTML = standingsHTML;
    })
    .catch(error);
}

function getTeamById() {
  // Ambil nilai query parameter (?id=)
  var urlParams = new URLSearchParams(window.location.search);
  var idParam = urlParams.get("id");
  fetch(base_url_football + "teams/" + idParam, {
    method: "GET",
    headers: { "X-Auth-Token": "e0e06211977540d3b95c6e043d830a36" }
  })
    .then(status)
    .then(json)
    .then(function (data) {
      // Objek JavaScript dari response.json() masuk lewat variabel data.
      console.log(data);
      // Menyusun komponen card artikel secara dinamis
      var articleHTML = `
              <div class="card">
                <div class="card-image waves-effect waves-block waves-light">
                  <img height="90" src="${data.crestUrl}" />
                </div>
                <div class="card-content">
                  <span class="card-title">${data.name}</span>
                  ${snarkdown(data.address)}
                </div>
              </div>
            `;
      // Sisipkan komponen card ke dalam elemen dengan id #content
      document.getElementById("body-content").innerHTML = articleHTML;
    });
}