# Pelayanan Surat PGSD UPI Kampus Serang

Versi online dari aplikasi Flask lama. Tampilan menggunakan template dan CSS asli. Pembuat PDF Python/ReportLab asli dijalankan di browser kaprodi melalui Pyodide; mahasiswa mengunduh PDF final yang sudah tersimpan di Google Drive.

- **GitHub Pages:** halaman web statis.
- **Google Apps Script:** validasi, login admin, otorisasi PIN, dan akses penyimpanan.
- **Google Sheets di Drive:** pengajuan, kelompok, status, dan metadata surat.
- **Folder Drive privat:** arsip PDF final dan spesimen bertanda air.

Backend sudah dikonfigurasi untuk [Google Sheet database yang Anda tentukan](https://docs.google.com/spreadsheets/d/1ec-bUYgI15BczrsNces1CQlpxj-CyM-d6r79lu1bcG4/edit). Saat fungsi pemasangan dijalankan di akun Google Anda, sistem menambahkan tab `Pengajuan` dan `Audit` serta memakai folder induk spreadsheet untuk subfolder surat. Spreadsheet tidak dipindahkan dan tab lain tidak diubah.

Tidak membutuhkan komputer lokal yang menyala. Tidak ada server Flask, ngrok, atau Render pada versi ini.

## Aktifkan di akun Google dan GitHub

Ikuti [PANDUAN-PASANG.md](PANDUAN-PASANG.md). URL sasaran repositori ini:

`https://dika-81.github.io/pelayanan-surat-pgsd-serang/`

**URL tersebut baru aktif setelah GitHub Pages dinyalakan. Pengajuan baru bekerja setelah Apps Script dipasang dan URL `/exec` diisi di `docs/config.js`.** Repositori tidak menyertakan password, PIN, database mahasiswa, PDF operasional, atau gambar tanda tangan asli.

## Isi paket

| Lokasi | Isi |
| --- | --- |
| `docs/` | Web yang dipublikasikan oleh GitHub Pages |
| `apps-script/Code.gs` | Backend dan fungsi pemasangan |
| `apps-script/Bridge.html` | Jembatan pesan browser–Apps Script |
| `apps-script/appsscript.json` | Zona waktu, runtime, dan cakupan izin |
| `tests/` | Pengujian alur server, koneksi, dan kesamaan template |
| `tools/` | Pratinjau, konversi sumber lama, pemeriksaan, dan pengemasan |

## Pemeriksaan

Node.js 22 atau lebih baru, tanpa instalasi paket npm:

```sh
npm run check
npm test
npm run preview
```

Buka `http://127.0.0.1:8765` untuk melihat tampilan. Pengajuan lokal membutuhkan endpoint Apps Script yang sudah aktif dan origin lokal yang diizinkan; ini bukan server yang dibutuhkan saat web sudah online.

Template asli dikonversi ke AST statis dalam `legacy-templates.js`, lalu dirender tanpa `eval`. Fitur tambahan formulir kelompok menggunakan JavaScript asli. `pdf_generator.py` disalin tanpa perubahan. Dengan contoh data yang sama, tiga jenis PDF telah diperiksa terhadap generator asli pada teks, jumlah halaman, dan piksel hasil render. Pemeriksaan ini memverifikasi generator di Python lokal; pemuatan Pyodide/CDN dan koneksi ke akun Google tetap harus diuji setelah deployment.

## Pengoperasian

- Pengajuan mendapat kode tracking acak; simpan kode tersebut.
- Permintaan yang diulang menggunakan ID yang sama tidak membuat pengajuan ganda.
- Persetujuan belum mengubah status menjadi ditandatangani sebelum PDF berhasil tersimpan.
- Unduhan berasal dari arsip Drive dan diperiksa terhadap SHA-256 yang tersimpan.
- File Drive tidak perlu dibagikan ke publik. Web app mengambil file menggunakan izin pemilik.
- Login/PIN diverifikasi di server. Password/PIN sementara dihapus dari Script Properties setelah diubah menjadi hash ber-pepper.
- Akun admin menggunakan password minimal 16 karakter yang unik. Rahasia dan token admin tidak dimasukkan ke URL atau kode browser.
- Ada pembatasan percobaan login/PIN dan pengajuan, pencatatan audit, validasi input, dan kunci penulisan untuk menghindari tabrakan data.
- Sesi admin berlaku paling lama dua jam dan dapat berakhir lebih cepat jika cache Google dibersihkan.
- Penghapusan pengajuan memindahkan PDF ke Sampah Drive. Operasi ini tetap memerlukan konfirmasi admin di web.
- Riwayat berdasarkan NIM dan halaman verifikasi tetap tersedia seperti versi lama. Jangan membagikan kode tracking ke orang yang tidak berkepentingan.

## Batas dan pemeliharaan

Penggunaan mengikuti kuota Apps Script dan ruang Drive akun pemilik. Pembuatan PDF pertama mengunduh runtime Python dari CDN; hanya diperlukan pada browser kaprodi ketika menyetujui surat. Mahasiswa tidak mengunduh runtime ini untuk mengajukan atau mengunduh surat final. Biarkan tab kaprodi terbuka sampai penyimpanan selesai.

Satu surat maksimal 30 mahasiswa, PDF final maksimal sekitar 3,3 MB. Untuk jumlah pengajuan yang sangat besar, pembacaan Sheets dan tabel dashboard perlu ditambah paginasi. Cadangkan spreadsheet dan folder surat secara berkala melalui fasilitas Drive.

Data dan PDF lama tidak diunggah otomatis. Aplikasi lama dan database aslinya dibiarkan utuh. Jika perlu memindahkan riwayat lama, lakukan migrasi privat terpisah; jangan mengunggah SQLite/PDF mahasiswa ke repositori.

Dokumentasi resmi: [Apps Script web apps](https://developers.google.com/apps-script/guides/web), [kuota](https://developers.google.com/apps-script/guides/services/quotas), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [Pyodide](https://pyodide.org/en/stable/).
