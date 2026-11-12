-- Tahap 2: keuangan, promo & paket. Jalankan SEKALI di SQL Editor (setelah schema.sql).
alter table orders add column if not exists done_at timestamptz;
update orders set done_at = coalesce(updated_at, created_at) where stage = 'selesai' and done_at is null;

create table if not exists expenses (
  id bigint generated always as identity primary key,
  date date not null default current_date,
  category text default 'Lainnya', note text default '', amount numeric not null default 0,
  created_at timestamptz default now());

create table if not exists settings (key text primary key, value jsonb not null, updated_at timestamptz default now());

alter table expenses enable row level security;
alter table settings enable row level security;
create policy admin_all_exp on expenses for all using (is_admin()) with check (is_admin());
create policy admin_all_set on settings for all using (is_admin()) with check (is_admin());
create policy pub_set on settings for select using (key in ('promo','bundles','fisik'));
