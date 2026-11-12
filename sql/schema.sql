-- Rumah Cetak Admin: skema Tahap 1. Tempel seluruhnya di Supabase > SQL Editor > Run.
-- Admin = akun yang tercatat di tabel admins. Ganti EMAIL_ANDA di bagian paling bawah.

create table if not exists admins (user_id uuid primary key references auth.users(id) on delete cascade);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from admins where user_id = auth.uid()) $$;

create table if not exists categories (
  id text primary key, name text not null, descr text default '', sort int default 0, active boolean default true);

create table if not exists products (
  id bigint generated always as identity primary key,
  cat text references categories(id) on update cascade,
  name text not null, title text default '', price_label text default '',
  descr text default '', demo text default '', video text default '',
  img text default '', tag text default '', home boolean default false,
  sort int default 0, active boolean default true, created_at timestamptz default now());

create table if not exists orders (
  id bigint generated always as identity primary key,
  code text unique not null,
  client_name text default '', client_wa text default '',
  type text not null default 'fisik' check (type in ('fisik','umkm','web','video')),
  product text default '', qty int default 1,
  price numeric default 0, cost numeric default 0, dp numeric default 0,
  stage text not null default 'diterima',
  courier text default '', resi text default '', link text default '', note text default '',
  deadline date, show_until date,
  created_at timestamptz default now(), updated_at timestamptz default now());

create table if not exists reviews (
  id bigint generated always as identity primary key,
  order_code text unique references orders(code) on update cascade,
  name text default '', stars int check (stars between 1 and 5),
  body text default '', product text default '',
  status text default 'menunggu' check (status in ('menunggu','tampil','ditolak')),
  created_at timestamptz default now());

-- Lacak pesanan publik: hanya bisa ambil SATU pesanan dengan kode yang tepat, tanpa nama/WA/harga.
create or replace function track_order(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('type',type,'product',product,'stage',stage,'updated',updated_at,'note',note,
    'courier',courier,'resi',resi,'link',link)
  from orders where code = upper(trim(p_code)) and (show_until is null or show_until >= current_date) $$;

-- Ulasan publik: hanya yang berstatus tampil.
create or replace function public_reviews() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(r order by created_at desc),'[]'::json) from
  (select name,stars,body,product,created_at from reviews where status='tampil' limit 20) r $$;

-- Kirim ulasan: hanya untuk pesanan Selesai, satu kode satu ulasan, masuk status menunggu.
create or replace function submit_review(p_code text, p_stars int, p_body text) returns json
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  select * into o from orders where code = upper(trim(p_code));
  if not found or o.stage <> 'selesai' then return json_build_object('ok',false,'err','Kode belum selesai atau tidak ditemukan'); end if;
  if exists (select 1 from reviews where order_code = o.code) then return json_build_object('ok',false,'err','Kode ini sudah dipakai untuk ulasan'); end if;
  insert into reviews(order_code,name,stars,body,product)
  values (o.code, coalesce(nullif(o.client_name,''),'Pelanggan'), greatest(1,least(5,p_stars)), left(coalesce(p_body,''),600), o.product);
  return json_build_object('ok',true);
end $$;

grant execute on function track_order(text), public_reviews(), submit_review(text,int,text) to anon, authenticated;

-- Keamanan baris: semua tabel hanya boleh dibaca/ditulis admin. Katalog boleh dibaca publik (hanya yang aktif).
alter table admins enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table reviews enable row level security;

create policy admin_all_cat on categories for all using (is_admin()) with check (is_admin());
create policy admin_all_prod on products for all using (is_admin()) with check (is_admin());
create policy admin_all_ord on orders for all using (is_admin()) with check (is_admin());
create policy admin_all_rev on reviews for all using (is_admin()) with check (is_admin());
create policy pub_cat on categories for select using (active);
create policy pub_prod on products for select using (active);

-- Foto produk (bucket publik, hanya admin yang boleh unggah)
insert into storage.buckets (id,name,public) values ('media','media',true) on conflict do nothing;
create policy media_read on storage.objects for select using (bucket_id='media');
create policy media_write on storage.objects for insert with check (bucket_id='media' and is_admin());
create policy media_upd on storage.objects for update using (bucket_id='media' and is_admin());
create policy media_del on storage.objects for delete using (bucket_id='media' and is_admin());

-- Jadikan akun Anda admin (buat akun dulu di Authentication > Users, lalu ganti emailnya):
insert into admins select id from auth.users where email = 'mughny321@gmail.com';

-- Rating & terjual untuk web utama (dihitung dari ulasan tampil dan pesanan selesai)
create or replace function public_stats() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'ratings', coalesce((select json_object_agg(product, json_build_object('avg',round(a::numeric,1),'n',n))
        from (select product, avg(stars) a, count(*) n from reviews where status='tampil' and product<>'' group by product) t),'{}'::json),
    'sold', coalesce((select json_object_agg(product, n)
        from (select product, count(*) n from orders where stage='selesai' and product<>'' group by product) t),'{}'::json),
    'views','{}'::json,
    'reviews', (select coalesce(json_agg(json_build_object('nama',name,'bintang',stars,'isi',body,'produk',product) order by created_at desc),'[]'::json)
        from (select * from reviews where status='tampil' order by created_at desc limit 20) r)) $$;
grant execute on function public_stats() to anon, authenticated;
