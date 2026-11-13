-- Tahap 3: pembayaran per pesanan, invoice, klik produk. Jalankan SEKALI (setelah schema.sql dan schema-tahap2.sql).
alter table orders add column if not exists product_id bigint references products(id) on delete set null;

create table if not exists payments (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders(id) on delete cascade,
  date date not null default current_date,
  amount numeric not null check (amount > 0),
  method text default 'Transfer', note text default '',
  created_at timestamptz default now());
create index if not exists payments_order_idx on payments(order_id);
alter table payments enable row level security;
create policy admin_all_pay on payments for all using (is_admin()) with check (is_admin());

-- Pindahkan DP lama menjadi catatan pembayaran (hanya untuk pesanan yang belum punya catatan)
insert into payments(order_id,date,amount,method,note)
select id, coalesce(created_at::date, current_date), dp, 'Transfer', 'DP (dari data lama)'
from orders o where dp > 0 and not exists (select 1 from payments p where p.order_id = o.id);

-- Klik produk (satu perangkat dihitung sekali per produk per hari)
create table if not exists product_clicks (
  product text not null, day date not null default current_date, device text not null,
  primary key (product, day, device));
alter table product_clicks enable row level security;
create policy admin_read_clicks on product_clicks for select using (is_admin());

create or replace function track_click(p_product text, p_device text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_device,'')) < 8 or length(p_device) > 64 then return; end if;
  if not exists (select 1 from products where name = p_product and active) then return; end if;
  insert into product_clicks(product, day, device) values (p_product, current_date, p_device) on conflict do nothing;
end $$;
grant execute on function track_click(text,text) to anon, authenticated;

-- Statistik publik, sekarang dengan klik 30 hari terakhir
create or replace function public_stats() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'ratings', coalesce((select json_object_agg(product, json_build_object('avg',round(a::numeric,1),'n',n))
        from (select product, avg(stars) a, count(*) n from reviews where status='tampil' and product<>'' group by product) t),'{}'::json),
    'sold', coalesce((select json_object_agg(product, n)
        from (select product, count(*) n from orders where stage='selesai' and product<>'' group by product) t),'{}'::json),
    'views', coalesce((select json_object_agg(product, n)
        from (select product, count(*) n from product_clicks where day >= current_date - 30 group by product) t),'{}'::json),
    'reviews', (select coalesce(json_agg(json_build_object('nama',name,'bintang',stars,'isi',body,'produk',product) order by created_at desc),'[]'::json)
        from (select * from reviews where status='tampil' order by created_at desc limit 20) r)) $$;

-- OPSIONAL: sebelumnya pesanan Selesai dianggap lunas. Jika Anda ingin pesanan Selesai lama
-- yang belum punya pembayaran dicatat lunas, hapus tanda komentar dan jalankan:
-- insert into payments(order_id,date,amount,method,note)
-- select o.id, coalesce(o.done_at::date, current_date), o.price - coalesce((select sum(amount) from payments p where p.order_id=o.id),0), 'Transfer', 'Dianggap lunas (data lama)'
-- from orders o where o.stage='selesai' and o.price > coalesce((select sum(amount) from payments p where p.order_id=o.id),0);
