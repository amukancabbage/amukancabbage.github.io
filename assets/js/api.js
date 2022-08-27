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

function createButton(data) {

  let buttonConfig = '';
  if (data.result) {
    if (data.message == "Bisa absen") {
      console.log(data);
      buttonConfig = `
        <a class="btn waves-effect waves-light" onclick="click_checkin()">Masuk</a>
        <a class="btn waves-effect waves-light blue-grey darken-1" onclick="M.toast({ html: 'Belum Masuk' })">Pulang</a>
      `;
    } else if (data.message == "Sudah checkout") {
      buttonConfig = `
        <a class="btn waves-effect waves-light blue-grey darken-1" onclick="M.toast({ html: 'Sudah Pulang' })">Masuk</a>
        <a class="btn waves-effect waves-light blue-grey darken-1" onclick="M.toast({ html: 'Sudah Pulang' })">Pulang</a>
      `;
    } else {
      buttonConfig = `
        <input type="hidden" value="`+ data.message + `" id="id_absensi" />
        <a class="btn waves-effect waves-light blue-grey darken-1" onclick="M.toast({ html: 'Sudah Masuk' })">Masuk</a>
        <a class="btn waves-effect waves-light" onclick="click_checkout()">Pulang</a>
      `;
    }
  } else {
    buttonConfig = `
      <p>`+ data.message + `</p>`;
  }


  return buttonConfig;
}

function createForm(data) {


  let formConfig = '';
  if (data.message == "Access granted.") {
    formConfig = `
        <input type="hidden" value="`+ data.data.id + `" id="idPengguna"/>
      `;
  } else {
    formConfig = `
        <input type="hidden" value="" />
      `;
  }



  return formConfig;
}

function createLoading() {
  let loading = `
  <div class="progress">
    <div class="indeterminate"></div>
  </div>`;
  return loading;
}

async function getCheckedInStatus(jwt) {
  let loginUrl = "https://hadir.lldikti11.or.id/api/absensi/get_valid_day.php";

  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(jwt)
  };
  const response = await fetch(loginUrl, requestOptions)
    .then(async response => {
      const data = await response.json();
      // console.log(data);
      document.getElementById("checkedInStatus").innerHTML = createButton(data);

      return Promise.resolve(data);
    })
    .catch(error => {
      console.log(error);
      return Promise.reject(new Error(error));
    });
}

async function click_checkin() {
  const data = loadDataFromStorage();
  if (data == null) {
    M.toast({ html: 'Sam Ting Wong Che Kin' })
  } else {
    await checkin(data.aksiberkah_jwt)
      .catch(error => {
        M.toast({ html: error.message });
      });
  }
  await getCheckedInStatus({ jwt: data.aksiberkah_jwt })
}

async function click_checkout() {
  const data = loadDataFromStorage();
  if (data == null) {
    M.toast({ html: 'Sam Ting Wong Che Kot' })
  } else {
    await checkout(data.aksiberkah_jwt);
    await getCheckedInStatus({ jwt: data.aksiberkah_jwt })
  }
}

async function checkin(jwt) {
  let checkinUrl = "https://hadir.lldikti11.or.id/api/absensi/checkin.php";
  var today = new Date();
  var checkin = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
  let ipIn = 0;
  let idPengguna = document.getElementById("idPengguna").value;

  let sendPost = {
    jwt: jwt,
    checkin: checkin,
    ipIn: ipIn,
    idPengguna: idPengguna
  };

  document.getElementById("checkedInStatus").innerHTML = createLoading();

  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sendPost)
  };
  const response = await fetch(checkinUrl, requestOptions)
    .then(async response => {
      const data = await response.json();
      if (data.result)
        M.toast({ html: 'Check in berhasil' })
      else
        M.toast({ html: 'Check in gagal' })
      return Promise.resolve(data);
    })
    .catch(error => {
      M.toast({ html: 'Somting wong' })
      // console.error('There was an error!', error);
      return Promise.reject(data);
    });
}

async function checkout(jwt) {
  let checkinUrl = "https://hadir.lldikti11.or.id/api/absensi/checkout.php";


  var today = new Date();
  var checkout = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
  let ipOut = 0;
  let id = document.getElementById("id_absensi").value;

  let sendPost = {
    jwt: jwt,
    checkout: checkout,
    ipOut: ipOut,
    id: id
  };

  document.getElementById("checkedInStatus").innerHTML = createLoading();

  console.log(sendPost);
  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sendPost)
  };
  const response = await fetch(checkinUrl, requestOptions)
    .then(async response => {
      const data = await response.json();
      if (data.result)
        M.toast({ html: 'Check out berhasil' })
      else
        M.toast({ html: 'Check out gagal' })
    })
    .catch(error => {
      console.log(error);
      this.errorMessage = error;
      console.error('There was an error!', error);
    });
}

async function getValidateToken(jwt) {

  let validateUrl = "https://singkron.lldikti11.or.id/api/pengguna/validate-token.php";

  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(jwt)
  };
  const response = await fetch(validateUrl, requestOptions)
    .then(async response => {
      const data = await response.json();
      // console.log(data);
      document.getElementById("inputForm").innerHTML = createForm(data);
    })
    .catch(error => {
      console.log(error);
      this.errorMessage = error;
      console.error('There was an error!', error);
    });

}

async function getBulanan(jwt) {

  let url = "https://hadir.lldikti11.or.id/api/absensi/read_bulan.php";

  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(jwt)
  };
  const response = await fetch(url, requestOptions)
    .then(async response => {
      const data = await response.json();
      console.log(data);
      let list = "";
      data.records.forEach(datum => {
        list += createBulananCard(datum.checkin, datum.checkout, datum.hari, datum.tanggal, datum.opsi);
      });
      document.getElementById("bulanan_list").innerHTML = list;
    })
    .catch(error => {
      console.log(error);
      this.errorMessage = error;
      console.error('There was an error!', error);
    });

}

function createBulananCard(checkin, checkout, hari, tanggal, opsi) {

  let jam = checkin === null && checkout === null ? `<p>${opsi}</p>` : `<p>Checkin: ${checkin}</p><p>Checkout: ${checkout}</p>`;

  let warna = jam === "<p>Libur</p>" ? " red" : "";

  warna = jam === "<p>Tidak Hadir</p>" ? " yellow" : warna;

  let card = `<div class="card${warna}">
            <div class="card-content">
                <span class="card-title">${tanggal}</span>
                <p>Hari: ${hari}</p>
                ${jam}
            </div>
        </div>`;

  return card;
}


async function getIp() {

  let validateUrl = "https://jsonip.com/";

  const requestOptions = {
    method: "GET"
  };
  const response = await fetch(validateUrl, requestOptions)
    .then(async response => {
      const data = await response.json();
      console.log(data);
      document.getElementById("inputIp").innerHTML = `
        <input type="hidden" value="`+ data.ip + `" id="inputIP"/>
      `
    })
    .catch(error => {
      console.log(error);
      this.errorMessage = error;
      console.error('There was an error!', error);
    });

}