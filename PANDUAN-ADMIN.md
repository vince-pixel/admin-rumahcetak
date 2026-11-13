# Panduan Panel Admin Rumah Cetak (Tahap 1)

Isi paket: login + verifikasi 2 langkah, Dashboard, Pesanan, Produk (termasuk unggah foto), Ulasan, Backup.
Belum ada: Rekap Keuangan, Promo & Paket, Editor Website, Galeri (Tahap 2 dan 3).
Panel ini belum saya uji dengan Supabase asli, hanya dengan simulasi. Uji pertama dengan akun Anda.

## 1. Buat proyek Supabase
1. Daftar di supabase.com, klik **New project**, pilih wilayah **Singapore**, simpan kata sandi database.
2. **SQL Editor → New query**, tempel seluruh `sql/schema.sql`, klik **Run**.
3. Tempel `sql/import-katalog.sql`, **Run** (mengisi kategori dan produk dari data.js, cukup sekali).

## 2. Buat akun admin (satu-satunya)
1. **Authentication → Users → Add user**, isi email dan kata sandi kuat, centang Auto Confirm.
2. **Authentication → Sign In / Providers → Email**: matikan **Allow new users to sign up**. Ini mencegah orang lain mendaftar.
3. Di SQL Editor jalankan (ganti emailnya):
   `insert into admins select id from auth.users where email = 'EMAIL_ANDA';`
4. **Authentication → Multi-Factor**: pastikan TOTP aktif. Saat pertama login, panel menampilkan kode QR; pindai dengan Google Authenticator atau Authy.

## 3. Hubungkan panel
1. **Project Settings → API**: salin **Project URL** dan kunci **anon / publishable**.
2. Isi `assets/config.js`. Jangan pernah memakai kunci `service_role`.
3. Buat repo GitHub baru `rumah-cetak-admin`, unggah **isi** zip ini (bukan zip-nya), lalu Settings → Pages → main / root.
4. DNS: buat record **CNAME** `admin` mengarah ke `vince-pixel.github.io`. File `CNAME` sudah berisi `admin.rumahcetak.my.id`. Centang Enforce HTTPS setelah aktif.
5. Di Supabase **Authentication → URL Configuration**, isi Site URL dengan `https://admin.rumahcetak.my.id`.

## 4. Hubungkan web utama (rumahcetak-v9)
Di `assets/data.js` isi `sb:{url:"…",key:"…"}` dengan Project URL dan kunci anon yang sama, lalu unggah ke repo web utama.
- Lacak Pesanan, ulasan, rating, dan "terjual" kini dibaca dari Supabase. Apps Script (Code.gs) tidak dipakai lagi.
- Katalog (kategori dan produk) dibaca dari panel. Jika layanan gagal, web memakai isi data.js sebagai cadangan.
- Setelah Anda mengubah produk di panel, pengunjung yang membuka web melihat versi baru; halaman dimuat ulang satu kali otomatis.
- Harga di kalkulator, paket bundling, dan bar promo masih dari data.js (Tahap 2).

## 5. Pemakaian sehari-hari
- **Pesanan baru**: klik + Pesanan, kode acak dibuat otomatis, isi data, simpan. Klik **Salin pesan WhatsApp** lalu kirim ke klien.
- **Ubah tahap**: Ubah → pilih Tahap. Isian resi/kurir muncul di tahap Dikirim; link muncul di tahap Link aktif / Siap diunduh.
- **Ulasan**: klien hanya bisa mengulas pesanan berstatus Selesai, satu kode satu ulasan. Tinjau di menu Ulasan, lalu Tampilkan atau Tolak.
- **Nama produk di pesanan harus sama dengan nama di katalog** agar rating dan "terjual" terhubung.
- **Foto produk**: dikompres otomatis (maks. 1280 px) lalu disimpan di Supabase Storage.

## Keamanan
- Hanya akun di tabel `admins` yang bisa membaca atau mengubah pesanan, ulasan, dan keuangan. Alamat subdomain bukan pengaman, aturan di database yang mengunci.
- Pengunjung web utama hanya bisa memanggil tiga fungsi: lacak satu kode, baca ulasan tampil, kirim ulasan. Nama, WA, harga, dan modal tidak pernah keluar.
- Kode lacak 6+ karakter acak; jangan pakai kode yang mudah ditebak.

## Hal yang perlu diperhatikan
- Paket gratis Supabase menjeda proyek setelah 7 hari tanpa aktivitas, dan tidak punya backup otomatis. Unduh **Backup** seminggu sekali. Cek ulang kuota dan aturan terbaru di halaman harga Supabase.
- Data lama di Google Sheets tidak terimpor otomatis. Untuk sedikit pesanan, input ulang lewat panel.

---
# Tahap 2: Keuangan, Promo & Paket

## Pasang (sekali)
Di Supabase SQL Editor jalankan berurutan: `sql/schema-tahap2.sql`, lalu `sql/import-tahap2.sql` (mengisi promo, paket bundling, dan aturan harga dari web lama). Unggah panel v2 dan web v10 ke repo masing-masing. Tanpa SQL ini menu Keuangan dan Promo & Paket hanya menampilkan petunjuk.

## Keuangan
- Pilih rentang: 7 hari, 15 hari, 30 hari, 6 bulan, 1 tahun, per bulan (pilih bulan), atau per tahun (ketik tahun).
- Omzet dan modal dihitung dari pesanan berstatus **Selesai**, pada tanggal pesanan itu diubah menjadi Selesai. Isi **Harga** dan **Modal** di tiap pesanan, kalau kosong hasilnya Rp 0.
- Laba kotor = omzet − modal. Laba bersih = laba kotor − biaya operasional. Margin = laba bersih ÷ omzet.
- Biaya operasional (bahan, listrik, iklan, ongkir, dan sebagainya) dicatat lewat **+ Biaya**.
- Piutang = harga dikurangi DP untuk pesanan yang belum selesai. Pesanan Selesai dianggap sudah lunas.
- Unduh: **CSV** (bisa dibuka di Excel), **Excel** (.xlsx, memuat pustaka dari internet saat diklik), dan **PDF / Cetak** (di jendela cetak pilih "Simpan sebagai PDF").
- Pesanan yang sudah Selesai sebelum Tahap 2 diberi tanggal selesai dari tanggal terakhir diubah, jadi tanggalnya perkiraan.

## Promo & Paket
- **Bar promo**: nyalakan/matikan, ubah teks, tujuan tombol, dan tanggal mulai/selesai. Di luar tanggal itu bar otomatis hilang. Tebalkan kata dengan **kata**.
- **Aturan harga undangan fisik**: batas minimal, harga hemat, dan harga biasa. Kalkulator, catatan harga, dan FAQ di web ikut berubah. Tulisan harga di kartu paket diganti otomatis hanya jika angkanya sama dengan harga lama. Cek hasilnya di web.
- **Paket bundling**: tambah, ubah, hapus, dan atur urutan. Hanya satu paket boleh bertanda rekomendasi.
- Harga di kartu produk tetap diedit di menu **Produk** (teks bebas).
- Perubahan tampil di web pada kunjungan berikutnya (halaman dimuat ulang otomatis satu kali).

## Troubleshooting: "Akses ditolak, akun ini bukan admin"
Jalankan di SQL Editor Supabase, satu per satu:
1. Pasang aturan baca (wajib; ada di schema.sql terbaru):
   `create policy admin_self on admins for select using (user_id = auth.uid());`
   Jika muncul "policy already exists", abaikan.
2. Cek isi tabel: `select a.user_id, u.email from admins a join auth.users u on u.id = a.user_id;`
   Jika kosong, akun belum didaftarkan. Cek email yang benar: `select id, email from auth.users;`
3. Daftarkan (ganti emailnya persis seperti di daftar langkah 2): `insert into admins select id from auth.users where email = 'EMAIL_ANDA' on conflict do nothing;`
Lalu keluar dan masuk lagi di panel.

---
# Tahap 3: Seller Center, pembayaran, invoice, label otomatis

## Pasang
1. Di Supabase SQL Editor jalankan `sql/schema-tahap3.sql` (sekali). File ini membuat tabel pembayaran, mengubah DP lama menjadi catatan pembayaran, membuat penghitung klik, dan memperbarui statistik web. Pastikan `schema.sql` terbaru dan `schema-tahap2.sql` sudah pernah dijalankan.
2. Unggah panel v3 ke repo panel, dan web v11 ke repo web utama.
3. **Pesanan Selesai lama kini bisa tampil belum lunas** (dulu otomatis dianggap lunas). Catat pembayarannya di panel, atau pakai skrip opsional di bagian bawah `schema-tahap3.sql` untuk mencatat semuanya lunas sekaligus.
4. Buka **Pengaturan**: isi data usaha, rekening/e-wallet, dan catatan invoice. Tanpa rekening, invoice menampilkan "Hubungi kami untuk informasi pembayaran".

## Perbaikan penting
Kolom **Nama produk** dan **Harga paket** sempat tidak tampil sejak Tahap 2 karena id-nya bentrok dengan aturan CSS area cetak. Sudah diperbaiki di v3.

## Pesanan dan produk
- Produk dipilih dari dropdown katalog (atau "Lainnya" untuk mengetik sendiri). Memilih produk otomatis mengisi jenis pesanan.
- Label di kartu produk web: label manual (kolom Label di form produk) selalu menang. Jika kosong: **Terlaris** (3 produk dengan pesanan selesai terbanyak), **Populer** (3 produk paling sering diklik 30 hari terakhir, satu perangkat dihitung sekali per hari), **Baru** (30 hari sejak ditambahkan). Angka klik berupa perkiraan karena bisa dipalsukan.
- Katalog Produk di panel menampilkan Terjual, Klik 30 hari, dan label yang sedang tampil.

## Pembayaran, tagihan, invoice
- **DP** saat membuat pesanan menjadi pembayaran pertama. Pembayaran lain dicatat lewat tombol **Pembayaran** di form pesanan, atau **Bayar** di Tagihan & Invoice.
- **Piutang = harga − total pembayaran**, termasuk untuk pesanan Selesai. Tidak ada lagi lunas otomatis.
- **Tagihan & Invoice** (submenu Pesanan): daftar pesanan belum lunas beserta umur tagihan, dan filter yang sudah selesai atau masih berjalan.
- **Invoice** berupa PDF berlogo. Caption WhatsApp menyesuaikan kondisi (belum bayar, sudah DP, selesai belum lunas, lunas) dan bisa diedit. Tombol **Bagikan** membuka WhatsApp dengan PDF terlampir di HP; di komputer PDF diunduh lalu WhatsApp dibuka dengan caption terisi, dan PDF dilampirkan manual.
- Huruf di PDF memakai font standar (serif tebal dan sans), bukan font web.
- Notifikasi (ikon lonceng): pesanan lewat tenggat atau jatuh tempo 2 hari, selesai tapi belum lunas, dan ulasan menunggu.

## Keuangan
Ditambah **Kas masuk** (pembayaran yang dicatat di periode itu) dan **Piutang** (semua pesanan yang belum lunas). Grafik menampilkan omzet, laba bersih, dan garis kas masuk. Omzet tetap dihitung dari pesanan Selesai.

## Segera hadir
Editor Website dan Galeri Portofolio (tahap berikutnya). Perubahan tampilan akan disimpan di Supabase, tanpa token GitHub.

---
# Tahap 4: Aturan harga, Galeri, Editor Website

Tanpa token GitHub. Semua perubahan disimpan di Supabase, dan web utama membacanya.

## Pasang
1. Supabase SQL Editor: jalankan `sql/schema-tahap4.sql` (sekali). Opsional: `sql/import-tahap4.sql` untuk mengisi daftar layanan kalkulator dari data.js (tanpa ini panel memakai daftar bawaan yang sama).
2. Unggah panel v4 ke repo panel dan web v12 ke repo web utama.
3. Di `assets/data.js` web utama, pastikan `adminOrigins` berisi alamat panel Anda persis (bawaan: `https://admin.rumahcetak.my.id`). Ini yang membuat pratinjau langsung hanya menerima kiriman dari panel Anda.

## Aturan harga (menu Promo & Paket)
Mengganti bagian "aturan harga undangan fisik". Sekarang mengatur semua layanan di kalkulator web:
- Undangan fisik: batas minimal hemat, harga hemat, harga biasa (seperti sebelumnya).
- Daftar layanan: nama, jenis (Undangan fisik bertingkat / Per pcs dengan minimal pesan / Harga tetap), harga, minimal pesan, tanda "Undangan web", urutan, tambah dan hapus.
- Tambahan undangan web (Rp) untuk kotak centang di kalkulator.
- Menyimpan juga memperbarui harga di kartu paket jika angkanya sama dengan harga lama. Cek hasilnya di web.
- Catatan di bawah kalkulator (mis. "Sudah termasuk potong presisi") belum bisa diedit dari panel.

## Galeri Portofolio
Unggah banyak foto sekaligus (dikompres otomatis), isi keterangan, atur urutan, tampilkan atau sembunyikan, dan hapus. Tampil di halaman Galeri web utama. Foto produk dan galeri dari panel kini tampil benar di semua halaman web (sebelumnya hanya di beranda).

## Editor Website
- **Warna:** hijau utama, hijau tua, kuning aksen, latar halaman, latar selang-seling, warna teks. Ada tombol preset dan peringatan jika kontras teks kurang terbaca. Tombol "Bawaan" per warna mengembalikan warna awal.
- **Hero:** lencana, judul, bagian miring, kalimat tebal, deskripsi, teks dua tombol, gambar hero, dan latar (bawaan, warna polos, gradasi, atau gambar dengan lapisan gelap), serta warna teks gelap atau terang.
- **Bagian beranda:** urutan dan tampil atau sembunyi tiap bagian; lebar halaman; posisi gambar hero di desktop; font judul (3 pilihan).
- **Profil usaha:** teks "Tentang" dan halaman Galeri (satu paragraf per baris).
- **Pratinjau langsung** di sebelah form (desktop atau lebar HP). Perubahan terlihat saat Anda mengetik, tanpa menerbitkan.
- **Simpan draf** menyimpan tanpa tayang. **Terbitkan** menayangkan ke web utama dan mencatat satu versi di **Riwayat versi**; "Pakai di draf" memuat versi lama ke editor, lalu tekan Terbitkan untuk menayangkannya lagi.
- Pengunjung melihat versi baru pada kunjungan berikutnya (halaman memuat ulang otomatis sekali).
- Batas: tidak ada CSS/HTML bebas. Urutan bagian mengubah susunan, tetapi warna latar selang-seling mengikuti bungkus tiap bagian, jadi cek hasilnya di pratinjau.
