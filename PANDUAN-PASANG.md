# Pemasangan GitHub Pages + Google Drive

Paket ini dipersiapkan untuk `https://github.com/dika-81/pelayanan-surat-pgsd-serang`.

Database yang digunakan adalah spreadsheet Anda: [buka Google Sheet](https://docs.google.com/spreadsheets/d/1ec-bUYgI15BczrsNces1CQlpxj-CyM-d6r79lu1bcG4/edit).
Kode sudah menunjuk ID tersebut. Pemasangan menggunakan spreadsheet yang ada dan folder induknya; tidak membuat spreadsheet pengganti atau memindahkan file.

## 1. Buat backend di akun pemilik Google Drive

1. Buka [Google Sheet database Anda](https://docs.google.com/spreadsheets/d/1ec-bUYgI15BczrsNces1CQlpxj-CyM-d6r79lu1bcG4/edit) dengan akun Google pemilik atau editor yang memiliki akses tulis ke folder Drive-nya.
2. Pilih **Extensions / Ekstensi > Apps Script**, beri nama proyek **Pelayanan Surat PGSD Serang**. Dengan cara ini proyek skrip mudah ditemukan dari spreadsheet yang sama.
3. Cara paling ringkas: isi file `Code.gs` dengan seluruh isi **`apps-script/Code-satu-file.txt`** dari paket ini. File ini sudah memuat jembatan HTML; Anda tidak perlu membuat file Bridge terpisah.
4. Alternatif untuk pengembang: gunakan `apps-script/Code.gs`, lalu buat file HTML bernama `Bridge` dan isi dengan `apps-script/Bridge.html`. Pilih salah satu cara, jangan memasukkan kedua versi kode sekaligus.
5. Buka **Project Settings**, nyalakan **Show appsscript.json manifest file in editor**. Kembali ke editor, isi `appsscript.json` sesuai berkas paket. Ini menetapkan zona waktu Jakarta serta izin Sheets dan Drive.
6. Di **Project Settings > Script Properties**, tambahkan:

| Property | Nilai |
| --- | --- |
| `SPREADSHEET_ID` | `1ec-bUYgI15BczrsNces1CQlpxj-CyM-d6r79lu1bcG4` (sudah menjadi nilai bawaan kode; isikan untuk memperjelas konfigurasi) |
| `ADMIN_USERNAME` | `kaprodi` atau nama admin pilihan Anda |
| `ADMIN_PASSWORD` | Password unik minimal 16 karakter, buat sendiri; jangan kirimkan melalui chat |
| `KAPRODI_PIN` | PIN rahasia pilihan Anda, 6–12 digit |
| `ALLOWED_ORIGINS` | `https://dika-81.github.io,https://andikaarisetyawan.com,https://www.andikaarisetyawan.com,https://layanan.andikaarisetyawan.com` |
| `SITE_URL` | `https://dika-81.github.io/pelayanan-surat-pgsd-serang/` |

`ALLOWED_ORIGINS` berisi origin saja: tanpa path dan tanpa slash terakhir. Jangan memakai `*`. Daftarkan hanya alamat yang Anda kuasai.

7. Kembali ke editor. Pilih fungsi **setupPortal_** di pemilih fungsi, lalu **Run**. Akun pemilik perlu memberikan persetujuan akses Sheets/Drive sendiri. Jika kebijakan akun kampus melarang akses yang diminta atau publikasi anonim, gunakan akun Google yang mengizinkan atau minta pengaturan dari pengelola akun.
8. Lihat **Execution log**. Sistem memakai Google Sheet di atas, menambahkan tab **Pengajuan** dan **Audit**, serta membuat subfolder **Surat Final** dan **Aset Privat** di folder yang sama dengan spreadsheet. Tab lain beserta isinya tetap dipertahankan. Link ditampilkan di log. Tidak perlu membuat kolom secara manual. Pemasangan yang dijalankan ulang memakai tab dan subfolder yang sudah ada.
9. Setelah berhasil, properti `ADMIN_PASSWORD` dan `KAPRODI_PIN` dihapus otomatis dan diganti hash. Jangan menghapus `SERVER_SECRET`, `PASSWORD_SALT`, atau ID penyimpanan yang dibuat otomatis.

Jika ingin menampilkan spesimen seperti web lama, unggah **spesimen-bertanda-air.png** dari paket aset privat ke folder **Aset Privat**. Jangan menaruh gambar tanda tangan asli di GitHub, dan jangan membagikan folder Drive ke publik. Tanpa spesimen, pengajuan, PDF, dan data verifikasi tetap berfungsi.

Jika akses folder induk spreadsheet tidak tersedia, kode akan berhenti dengan petunjuk untuk mengisi `ROOT_FOLDER_ID`. Isi dengan bagian ID dari URL folder `https://drive.google.com/drive/folders/ID_FOLDER`, lalu jalankan pemasangan kembali. Ini berbeda dari ID spreadsheet.

## 2. Publikasikan Apps Script

1. **Deploy > New deployment > Select type > Web app**.
2. **Execute as: Me** (akun pemilik Drive).
3. **Who has access: Anyone** agar mahasiswa dapat memakai formulir tanpa izin Drive. Keamanan aksi admin tetap diperiksa dengan login dan PIN di server.
4. Klik **Deploy**; pemilik akun menyetujui permintaan izin bila diminta.
5. Salin **Web app URL** yang berakhir `/exec`, bukan `/dev`.
6. Edit `docs/config.js` dalam paket/repo dan isi:

```js
window.SURAT_CONFIG = Object.freeze({
  apiUrl: "https://script.google.com/macros/s/ID_DEPLOYMENT_ANDA/exec",
  siteUrl: "https://dika-81.github.io/pelayanan-surat-pgsd-serang/",
  pyodideUrl: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/",
  reportlabVersion: "4.4.1"
});
```

Alamat `/exec` boleh ada dalam repositori. Password, PIN, `SERVER_SECRET`, dan token Google tidak boleh dimasukkan ke `config.js`.

## 3. Unggah kode ke GitHub dan aktifkan Pages

1. Ekstrak **SIAP-UPLOAD-GITHUB.zip**.
2. Buka repositori `dika-81/pelayanan-surat-pgsd-serang`. Jika sudah berisi proyek lain, periksa isinya dahulu agar tidak menimpa pekerjaan yang masih digunakan.
3. **Add file > Upload files**, unggah isi hasil ekstraksi dengan struktur folder tetap. Folder `docs` harus ada langsung di akar repositori, bukan di dalam folder pembungkus lain. GitHub tidak mengekstrak ZIP yang diunggah sebagai satu file.
4. Commit perubahan ke branch `main`.
5. **Settings > Pages > Build and deployment > Source: GitHub Actions**.
6. Buka **Actions > Publikasikan portal surat**, tunggu berhasil. Jika workflow tidak terpicu setelah memilih sumber Pages, gunakan **Run workflow**.
7. Alamatnya: `https://dika-81.github.io/pelayanan-surat-pgsd-serang/`.

Alternatif tanpa workflow: pilih **Deploy from a branch > main > /docs**, lalu **Save**. Jika menggunakan cara ini, hapus/nonaktifkan workflow `pages.yml` agar tidak ada dua jalur deployment yang berjalan bersamaan.

## 4. Periksa satu pengajuan contoh

1. Buka alamat GitHub Pages. Pemberitahuan “layanan sedang disiapkan” harus sudah hilang setelah `apiUrl` terisi.
2. Kirim Surat A menggunakan data contoh. Simpan kode tracking. Pastikan satu baris baru muncul di sheet Pengajuan.
3. Buka Login Admin dan gunakan kredensial yang Anda simpan di akun Google.
4. Isi nomor surat dan PIN, klik TTD. Pada penggunaan pertama, tunggu unduhan pembuat PDF selesai. Jangan menutup tab sampai muncul pesan bahwa surat tersimpan di Drive.
5. Pastikan PDF ada di folder **Surat Final**, status di Sheets menjadi **Ditandatangani**, dan tombol unduhan mahasiswa bekerja.
6. Buka halaman verifikasi dan periksa spesimen, nama pejabat, serta hash.
7. Ulangi dengan Surat B perorangan dan kelompok. Anggota kelompok juga harus menemukan riwayat melalui NIM-nya.

Gunakan data contoh terlebih dahulu. Contoh PDF lokal di paket pemeriksaan bukan surat operasional dan tidak dimasukkan ke GitHub.

## 5. Tautkan dari andikaarisetyawan.com

Cara paling sederhana adalah menambahkan kartu/tombol **Layanan Surat Mahasiswa PGSD** pada situs utama, dengan tujuan alamat GitHub Pages di atas.

Jika ingin alamat `layanan.andikaarisetyawan.com`:

1. Atur **Settings > Pages > Custom domain** pada repo ini menjadi `layanan.andikaarisetyawan.com`.
2. Pada penyedia DNS domain, buat CNAME **layanan → dika-81.github.io**. Target DNS tidak memakai `https://` atau nama repositori.
3. Tunggu verifikasi DNS dan sertifikat, lalu aktifkan **Enforce HTTPS**.
4. Pastikan origin `https://layanan.andikaarisetyawan.com` masih ada dalam `ALLOWED_ORIGINS` Apps Script.
5. Ubah `siteUrl` pada `config.js` dan `SITE_URL` pada Script Properties menjadi `https://layanan.andikaarisetyawan.com/`.

Situs profil di domain utama tidak perlu dipindahkan.

## Pembaruan dan masalah umum

- **Kode Apps Script diubah:** simpan lalu **Deploy > Manage deployments > Edit > New version > Deploy**. Menyimpan editor saja belum memperbarui web app produksi. Pertahankan deployment yang sama agar URL `/exec` tidak berubah.
- **Koneksi menunggu terus:** periksa URL `/exec`, akses **Anyone**, daftar origin yang tepat, kebijakan Workspace, serta pemblokiran iframe oleh browser. Jangan mengatasi dengan `mode: no-cors`; aplikasi memakai iframe dan `google.script.run` agar keberhasilan penyimpanan dapat diketahui.
- **PDF pertama lambat:** browser kaprodi sedang mengunduh Pyodide dan ReportLab. Mahasiswa tidak perlu melakukan ini. Jika gagal, ulangi dengan nomor surat yang sama; pengajuan tidak akan ditandai selesai sebelum PDF tersimpan.
- **Sesi admin habis:** login kembali. Cache sesi Google dapat dibersihkan sebelum batas dua jam.
- **Mengganti password/PIN:** isi `ADMIN_PASSWORD`/`KAPRODI_PIN` baru di Script Properties, jalankan `rotateCredentials_` dari editor. Password minimal 16 karakter; PIN 6–12 digit. Sesi lama otomatis dibatalkan.
- **Pengajuan lama:** database SQLite dan PDF dari komputer lama belum dipindahkan; lakukan migrasi privat terpisah bila diperlukan.
- **Cadangan:** salin spreadsheet dan folder Surat Final secara berkala. Jangan mengganti nama header sheet Pengajuan.

Dokumentasi: [Web apps Apps Script](https://developers.google.com/apps-script/guides/web), [batas layanan](https://developers.google.com/apps-script/guides/services/quotas), [custom domain GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).
