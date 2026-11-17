-- ZARO product catalog for Admin
-- Run once in Supabase SQL Editor. This creates catalog tables only;
-- it does not modify orders, customer profiles, support, or payment flows.

begin;

create table if not exists public.catalog_games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  name_en text not null,
  image_url text not null default '',
  currency_label text not null default '',
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_packages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.catalog_games(id) on delete cascade,
  package_name text not null,
  amount_label text not null default '',
  supplier_sku text,
  supplier_cost numeric(12,2),
  selling_price numeric(12,2),
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_packages_supplier_cost_nonnegative
    check (supplier_cost is null or supplier_cost >= 0),
  constraint catalog_packages_selling_price_nonnegative
    check (selling_price is null or selling_price >= 0)
);

create index if not exists catalog_packages_game_id_idx
  on public.catalog_packages(game_id);
create index if not exists catalog_games_active_sort_idx
  on public.catalog_games(is_active, sort_order);
create index if not exists catalog_packages_active_sort_idx
  on public.catalog_packages(game_id, is_active, sort_order);

create or replace function public.zaro_catalog_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists catalog_games_set_updated_at on public.catalog_games;
create trigger catalog_games_set_updated_at
before update on public.catalog_games
for each row execute function public.zaro_catalog_set_updated_at();

drop trigger if exists catalog_packages_set_updated_at on public.catalog_packages;
create trigger catalog_packages_set_updated_at
before update on public.catalog_packages
for each row execute function public.zaro_catalog_set_updated_at();

alter table public.catalog_games enable row level security;
alter table public.catalog_packages enable row level security;

revoke all on public.catalog_games from anon, authenticated;
revoke all on public.catalog_packages from anon, authenticated;

-- Games contain only public catalog fields. Visitors can read active games.
grant select on public.catalog_games to anon, authenticated;
grant insert, update, delete on public.catalog_games to authenticated;

drop policy if exists "Public reads active catalog games" on public.catalog_games;
create policy "Public reads active catalog games"
on public.catalog_games for select to anon, authenticated
using (is_active = true);

drop policy if exists "ZARO admin manages catalog games" on public.catalog_games;
create policy "ZARO admin manages catalog games"
on public.catalog_games for all to authenticated
using (auth.uid() = '1bb9ddef-57a8-43d2-bf0c-be6d0b1f1cac'::uuid)
with check (auth.uid() = '1bb9ddef-57a8-43d2-bf0c-be6d0b1f1cac'::uuid);

-- Package costs and supplier SKUs must never be exposed to visitors.
-- Visitors read a safe view; only the ZARO admin can query the base table.
grant select, insert, update, delete on public.catalog_packages to authenticated;

drop policy if exists "ZARO admin manages catalog packages" on public.catalog_packages;
create policy "ZARO admin manages catalog packages"
on public.catalog_packages for all to authenticated
using (auth.uid() = '1bb9ddef-57a8-43d2-bf0c-be6d0b1f1cac'::uuid)
with check (auth.uid() = '1bb9ddef-57a8-43d2-bf0c-be6d0b1f1cac'::uuid);

create or replace view public.store_public_packages as
select
  p.id,
  p.game_id,
  p.package_name,
  p.amount_label,
  p.selling_price,
  p.is_active,
  p.sort_order
from public.catalog_packages p
join public.catalog_games g on g.id = p.game_id
where p.is_active = true
  and g.is_active = true;

grant select on public.store_public_packages to anon, authenticated;

commit;
