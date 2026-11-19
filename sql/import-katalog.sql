-- Impor katalog awal dari data.js. Jalankan SEKALI di SQL Editor SETELAH schema.sql.
insert into categories(id,name,descr,sort) values
('undangan-web','Undangan Web','Daftar seluruh tema website pernikahan, demo online, form doa ucapan tamu, dan integrasi maps.',0),
('undangan-video','Undangan Video','Video animasi gerak vertikal sinematik resolusi tinggi 1080p untuk status WA dan konten Instagram.',1),
('undangan-fisik','Undangan Fisik','Koleksi kertas Jasmine, Kraft, Art Carton, Linen, harga lebih hemat mulai 100 lembar.',2),
('umkm','Paket UMKM','Stiker kemasan kiss-cut, kartu ucapan, dan nota usaha.',3),
('jasa-desain','Jasa Desain','Desain undangan, label, dan kemasan sesuai kebutuhan Anda.',4)
on conflict (id) do nothing;
insert into products(cat,name,title,price_label,descr,demo,tag,home,sort) values
('undangan-web','Rustic','Tema Rustic Floral Warm','Rp 75.000 / link','Tone earth color elegan, ornamen bunga kering, countdown, maps interaktif, dan pemutar audio otomatis.','undangan-web/demo/rustic/','',true,0),
('undangan-web','Modern','Tema Modern Editorial Minimalis','Rp 75.000 / link','Gaya majalah estetik hitam putih yang menonjolkan foto prewedding dengan kesan luxury berkelas.','undangan-web/demo/modern/','',true,1),
('undangan-web','Adat','Tema Adat','Rp 75.000 / link','Ornamen adat, bisa disesuaikan dengan daerah.','','Baru',false,2),
('undangan-video','Reels Floral','Video Animasi Teaser Reels (9:16)','Rp 50.000 / video','Durasi 30–45 detik resolusi 1080p jernih, pas untuk status WhatsApp, TikTok, dan Instagram Reels.','','',true,3),
('undangan-video','Reels Minimal','Reels Minimal','Rp 50.000 / video','Teks bergerak, musik pilihan Anda.','','',false,4),
('undangan-fisik','Jasmine','Softcover Jasmine 210gsm Glitter','Rp 1.650 / lembar (min. 100)','Kertas bertekstur kerlip halus berkilau, dicetak warna pekat dengan finishing lipat rapi tanpa sobek.','','',true,5),
('undangan-fisik','Art Carton','Art Carton 260gsm','Rp 1.650 / lembar (min. 100)','Kertas tebal halus dengan cetak warna tajam dan hasil rapi.','','Baru',false,6),
('undangan-fisik','Linen','Linen','Rp 1.650 / lembar (min. 100)','Serat kain, hangat saat disentuh.','','',false,7),
('undangan-fisik','Kraft','Vintage Kraft Samson & Tali Rami','Rp 1.650 / lembar (min. 100)','Konsep natural rustic menggunakan kertas kraft cokelat tebal berpadu ikatan tali goni otentik.','','',true,8),
('jasa-desain','Desain Undangan Custom','Desain Undangan Custom','Hubungi kami','Desain khusus sesuai tema dan warna acara Anda.','','',false,9),
('jasa-desain','Desain Label & Kemasan','Desain Label & Kemasan','Hubungi kami','Label produk dan kemasan untuk usaha Anda.','','',false,10),
('umkm','Stiker Label Kiss-Cut','Stiker Label Kemasan Kiss-Cut Presisi','mulai Rp 600 / pcs (min. 100)','Sudah terpotong bulat/kotak rapi, tinggal kupas dan tempel.','','',true,11),
('umkm','Kartu Ucapan','Kartu Ucapan','mulai Rp 1.500 / pcs','Untuk toko online dan hampers.','','',false,12),
('umkm','Nota Usaha','Nota Usaha','mulai Rp 25.000 / buku','Rangkap 2 atau 3, kop usaha Anda.','','',false,13);
