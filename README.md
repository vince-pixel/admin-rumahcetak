# admin-rumahcetak
## v5 (Seller Center)
- **PDF Rekap Keuangan**: sekarang PDF sungguhan (diunduh langsung, tanpa jendela cetak) dengan kop berlogo dan nama usaha di halaman pertama, header di tiap halaman, serta footer berisi tanggal dan jam cetak, kontak usaha, dan nomor halaman. Data usaha diambil dari menu Pengaturan.
- **Dashboard**: "Sekilas Tampilan Web" bisa digulir dengan mouse; ada tombol "Buka di tab baru".
- **Promo & Paket**: "Tujuan tombol" kini pilihan (menggulir ke bagian web, halaman layanan, WhatsApp dengan pesan otomatis, atau link lain) disertai pratinjau tombol dan keterangan apa yang terjadi saat diklik. Teks tombol hanya mengubah tulisannya.
- **Editor Website**: bagian "Kata klien" kini terpisah dari "Tentang", sehingga posisinya terhadap FAQ bisa diatur (naikkan/turunkan). Ada isian "Link demo utama" untuk tombol demo di hero.
- **Ikon**: semua ikon, logo, dan favicon ada di `assets/icons/` (lihat `assets/icons/ICONS.md`).
- Web utama yang cocok: **v13**. Tidak ada SQL baru. Bila kartu produk di web tampil ganda, jalankan `sql/bersihkan-duplikat.sql` sekali.

Langkah: unggah seluruh isi zip ke repo panel (timpa), hapus `favicon.svg` dan `assets/logo.svg` lama. Lalu di Editor Website tekan Terbitkan sekali supaya web utama memakai urutan bagian terbaru.

## v6 (Tahap 6)
- Harga, satuan, minimal pesan, dan harga hemat per produk di Katalog Produk; foto tambahan per produk.
- Promo & Paket: "Harga promo per produk" (dropdown katalog) menggantikan aturan harga fisik lama.
- Galeri: tambah dari link (thumbnail otomatis) + judul/keterangan/deskripsi.
- Pengaturan: kontak dan profil web utama (WA, telepon, email, alamat, jam, Facebook, Instagram, tagline, Tentang Kami).
- Editor Website: FAQ dan ulasan kini di kolom kanan bagian Tentang, dengan pilihan urutan.
- SQL baru: `sql/schema-tahap6.sql`. Web yang cocok: v14. Lihat bagian Tahap 6 di `PANDUAN-ADMIN.md`.
