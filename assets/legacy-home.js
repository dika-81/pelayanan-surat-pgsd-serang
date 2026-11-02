/* Perilaku Tambah Mahasiswa dari web asli. */
window.initOriginalHome = function () {

    (function () {
      var pilihanSurat = document.getElementById("jenis-surat");
      var grup = document.getElementById("grup-anggota");
      var daftar = document.getElementById("anggota-list");
      var tombolTambah = document.getElementById("tambah-anggota");
      var jumlahLabel = document.getElementById("grup-jumlah");
      var hintKeperluan = document.getElementById("hint-keperluan");

      if (!pilihanSurat || !grup || !daftar || !tombolTambah) {
        return;
      }

      function suratB() {
        return pilihanSurat.value === "Surat B";
      }

      function perbaruiNomor() {
        var baris = daftar.querySelectorAll(".anggota-item");

        baris.forEach(function (item, index) {
          var nomor = item.querySelector(".anggota-nomor");

          if (nomor) {
            nomor.textContent = "Mahasiswa ke-" + (index + 2);
          }
        });

        if (jumlahLabel) {
          jumlahLabel.textContent = (baris.length + 1) + " mahasiswa";
        }
      }

      function tambahBaris() {
        var item = document.createElement("div");

        item.className = "anggota-item";

        item.innerHTML =
          '<div class="anggota-head">' +
            '<span class="anggota-nomor"></span>' +
            '<button class="danger small anggota-hapus" type="button">Hapus</button>' +
          "</div>" +
          '<div class="anggota-fields">' +
            "<label>Nama Mahasiswa" +
              '<input name="anggota_nama" type="text" placeholder="Nama lengkap">' +
            "</label>" +
            "<label>NIM" +
              '<input name="anggota_nim" type="text" placeholder="Contoh: 22123456">' +
            "</label>" +
            "<label>Semester" +
              '<input name="anggota_semester" type="number" min="1" max="14" placeholder="Contoh: 4">' +
            "</label>" +
          "</div>";

        item
          .querySelector(".anggota-hapus")
          .addEventListener("click", function () {
            item.remove();
            perbaruiNomor();
          });

        daftar.appendChild(item);

        perbaruiNomor();

        var isian = item.querySelector("input");

        if (isian) {
          isian.focus();
        }
      }

      function perbaruiTampilan() {
        var aktif = suratB();

        grup.hidden = !aktif;

        if (hintKeperluan) {
          hintKeperluan.hidden = !aktif;
        }

        if (!aktif) {
          daftar.innerHTML = "";
          perbaruiNomor();
        }
      }

      tombolTambah.addEventListener("click", tambahBaris);

      pilihanSurat.addEventListener("change", perbaruiTampilan);

      perbaruiTampilan();
    })();
  
};
