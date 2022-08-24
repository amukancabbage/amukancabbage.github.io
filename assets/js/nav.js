document.addEventListener("DOMContentLoaded", _ => {

    let elems = document.querySelectorAll(".sidenav");
    M.Sidenav.init(elems);
    loadNav();

    function loadNav() {
        let xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4) {
                if (this.status != 200) return;

                document.querySelectorAll(".topnav, .sidenav").forEach(elm => {
                    elm.innerHTML = xhttp.responseText;
                });

                document.querySelectorAll(".sidenav a, .topnav a").forEach(elm => {
                    elm.addEventListener("click", event => {

                        let sidenav = document.querySelector(".sidenav");
                        M.Sidenav.getInstance(sidenav).close();

                        page = event.target.getAttribute("href").substr(1);
                        loadPage(page);
                    });
                });
            }
        };
        xhttp.open("GET", "nav.html", true);
        xhttp.send();
    }

    let page = window.location.hash.substr(1);
    if (page == "") page = "home";
    loadPage(page);

    function loadPage(page) {
        let xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4) {
                let content = document.querySelector("#body-content");
                const data = loadDataFromStorage();
                if (data == null) {
                    window.location.href = "login.html";
                } else {
                    if (page === "home") {
                        getCheckedInStatus({ jwt: data.aksiberkah_jwt });
                        getValidateToken({ jwt: data.aksiberkah_jwt });
                        // getIp();
                    } else if (page === "favorite") {
                        getSavedTeams();
                    } else if (page === "logout") {
                        if(confirm("Yakin logout?")){
                            removeData();
                            window.location.href = "login.html";
                        }
                        window.location.href = "main.html";
                    }
                }



                if (this.status == 200) {
                    content.innerHTML = xhttp.responseText;
                } else if (this.status == 404) {
                    content.innerHTML = "<p>Halaman tidak ditemukan.</p>";
                } else {
                    content.innerHTML = "<p>Ups.. halaman tidak dapat diakses.</p>";
                }
            }
        };
        xhttp.open("GET", "pages/" + page + ".html", true);
        xhttp.send();
    }
});