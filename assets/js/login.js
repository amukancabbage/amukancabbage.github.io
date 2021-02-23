document.addEventListener("DOMContentLoaded", _ => {

    let login_form = document.getElementById("login");

    login_form.onsubmit = _ => {
        let username = document.getElementById("username").value;
        let password = document.getElementById("password").value;

        var obj = { username: username, password: password };
        var form_data = JSON.stringify(obj);
        console.log(obj);
        const data = created(obj);

        return false;
    }

    async function created(obj) {
        let loginUrl = "https://singkron.lldikti11.or.id/api/pengguna/login.php";

        const requestOptions = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(obj)
        };
        const response = await fetch(loginUrl, requestOptions)
            .then(async response => {
                const data = await response.json();
                console.log(data);

                if (!response.ok) {
                    const error = (data && data.message) || response.status;
                    return Promise.reject(error);
                }else{
                    if (data.message == "Successful login."){
                        setCookie("jwt", data);
                        window.location.href = "index.html";
                    }else{
                        M.toast({ html: data.message })
                    }
                    
                }

                this.postId = data.id;
            })
            .catch(error => {
                this.errorMessage = error;
                console.error('There was an error!', error);
            });
    }

});