document.addEventListener("DOMContentLoaded", _ => {

    let jwt = getCookie('jwt');
    if (jwt != "") {
        console.log(jwt);
    } else {
        let link = "login.html";
        window.open(link);
        console.log(link);

        window.location.href = link;
        // let xhttp = new XMLHttpRequest();
        // xhttp.onreadystatechange = function () {
        //     if (this.readyState == 4) {
        //         let content = document.querySelector("#body-html");
        //         if (this.status == 200) {
        //             content.innerHTML = xhttp.responseText;
        //         } else if (this.status == 404) {
        //             content.innerHTML = "<p>Halaman tidak ditemukan.</p>";
        //         } else {
        //             content.innerHTML = "<p>Ups.. halaman tidak dapat diakses.</p>";
        //         }
        //     }
        // };
        // xhttp.open("GET", "pages/login.html", true);
        // xhttp.send();
    }
});