document.addEventListener("DOMContentLoaded", _ => {

    let login_form = document.getElementById("login");
    setCookie("jwt", "");

    login_form.onsubmit = _ => {
        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;

        var obj = { username: username, password: password };

        loginRequest(obj);

        return false;
    }

    const loginRequest = async (loginObject) => {
        try {
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(loginObject)
            };

            const response = await fetch(`https://singkron.lldikti11.or.id/api/pengguna/login.php`, options)
            const responseJson = await response.json();
            M.toast({ html: responseJson.message })
            if (responseJson.message == "Successful login.") {
                let saved = { aksiberkah_jwt: responseJson.jwt }
                saveData(saved)
                window.location.href = "main.html";
            }
        } catch (error) {
            console.log(error);
        }
    }
});