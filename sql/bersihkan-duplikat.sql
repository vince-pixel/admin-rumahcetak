-- Menghapus produk ganda (nama dan kategori sama) setelah import-katalog.sql terjalankan dua kali.
-- Yang dipertahankan adalah baris dengan id terkecil (yang paling lama). Jalankan sekali di SQL Editor.
-- Lihat dulu yang akan terhapus:
--   select a.id,a.cat,a.name from products a join products b on a.id>b.id and a.cat=b.cat and a.name=b.name;
delete from products a using products b where a.id>b.id and a.cat=b.cat and a.name=b.name;
