-- Tahap 6: harga per produk, foto tambahan, galeri via link, pengaturan web utama.
-- Aman dijalankan lebih dari sekali. Jalankan di Supabase > SQL Editor.

-- 1. Produk: satuan, harga, minimal pesan, harga hemat bertingkat per produk, foto tambahan
alter table products
  add column if not exists unit text default 'pcs',
  add column if not exists price numeric default 0,
  add column if not exists min_qty int default 1,
  add column if not exists tier_from int,
  add column if not exists tier_price numeric,
  add column if not exists images jsonb default '[]'::jsonb;

-- 2. Galeri: link, judul, deskripsi
alter table gallery_items
  add column if not exists link text default '',
  add column if not exists title text default '',
  add column if not exists descr text default '';

-- 3. Pengaturan yang boleh dibaca web utama (kontak/profil dan harga promo). Rekening dan data invoice ('biz') TETAP privat.
drop policy if exists pub_set on settings;
create policy pub_set on settings for select
  using (key in ('promo','bundles','fisik','calc','site','prices','contact'));

-- 4. Isi harga awal dari katalog yang sudah ada (hanya produk yang harganya masih 0).
update products set unit='link',  price=75000 where cat='undangan-web'   and coalesce(price,0)=0;
update products set unit='video', price=50000 where cat='undangan-video' and coalesce(price,0)=0;
update products set unit='lembar', price=2000, min_qty=1, tier_from=100, tier_price=1650 where cat='undangan-fisik' and coalesce(price,0)=0;
update products set unit='pcs', price=600,  min_qty=100 where cat='umkm' and name='Stiker Label Kiss-Cut' and coalesce(price,0)=0;
update products set unit='pcs', price=1500, min_qty=100 where cat='umkm' and name='Kartu Ucapan' and coalesce(price,0)=0;
update products set unit='buku', price=25000, min_qty=1 where cat='umkm' and name='Nota Usaha' and coalesce(price,0)=0;
