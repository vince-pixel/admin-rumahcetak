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
