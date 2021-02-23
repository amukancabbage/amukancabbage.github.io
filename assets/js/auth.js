document.addEventListener("DOMContentLoaded", _ => {

    var jwt = getCookie('jwt');
    console.log(jwt);
    if (jwt != "") {
        window.location.href = "main.html";
    } else {
        window.location.href = "login.html";
    }
});