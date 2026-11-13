-- Tahap 4: galeri, editor tampilan web, riwayat versi. Jalankan SEKALI (setelah schema-tahap3.sql).
create table if not exists gallery_items (
  id bigint generated always as identity primary key,
  img text not null, cap text default '', sort int default 0, active boolean default true,
  created_at timestamptz default now());
alter table gallery_items enable row level security;
create policy admin_all_gal on gallery_items for all using (is_admin()) with check (is_admin());
create policy pub_gal on gallery_items for select using (active);

create table if not exists site_versions (
  id bigint generated always as identity primary key,
  label text default '', value jsonb not null, created_at timestamptz default now());
alter table site_versions enable row level security;
create policy admin_all_ver on site_versions for all using (is_admin()) with check (is_admin());

-- Pengaturan yang boleh dibaca publik: promo, paket, harga, dan tampilan yang SUDAH diterbitkan.
-- Draf (site_draft) dan data usaha (biz) tetap hanya untuk admin.
drop policy if exists pub_set on settings;
create policy pub_set on settings for select using (key in ('promo','bundles','fisik','calc','site'));
