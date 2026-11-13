-- ZARO customer accounts: run once in Supabase SQL Editor.
create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  zaro_id text unique,
  full_name text not null default '',
  email text not null default '',
  status text not null default 'pending' check (status in ('pending','active','rejected','suspended')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
create sequence if not exists public.zaro_customer_number_seq start 1001;

create or replace function public.zaro_new_customer_profile()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.customer_profiles(user_id,full_name,email,status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.email,''),
    'pending'
  ) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists zaro_auth_user_created on auth.users;
create trigger zaro_auth_user_created
after insert on auth.users
for each row execute function public.zaro_new_customer_profile();

alter table public.customer_profiles enable row level security;
revoke all on public.customer_profiles from anon, authenticated;
grant select, update on public.customer_profiles to authenticated;

drop policy if exists "Customers read own profile" on public.customer_profiles;
create policy "Customers read own profile"
on public.customer_profiles for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admin reads all customer profiles" on public.customer_profiles;
create policy "Admin reads all customer profiles"
on public.customer_profiles for select to authenticated
using (auth.uid() = '1bb9ddef-57a8-43d2-bf0c-be6d0b1f1cac'::uuid);

drop policy if exists "Admin updates customer profiles" on public.customer_profiles;
create policy "Admin updates customer profiles"
on public.customer_profiles for update to authenticated
using (auth.uid() = '1bb9ddef-57a8-43d2-bf0c-be6d0b1f1cac'::uuid)
with check (auth.uid() = '1bb9ddef-57a8-43d2-bf0c-be6d0b1f1cac'::uuid);

create or replace function public.zaro_review_customer(p_user_id uuid,p_decision text)
returns text language plpgsql security definer
set search_path = public
as $$
declare v_id text;
begin
  if auth.uid() <> '1bb9ddef-57a8-43d2-bf0c-be6d0b1f1cac'::uuid then
    raise exception 'غير مصرح';
  end if;
  if p_decision not in ('active','rejected','suspended') then
    raise exception 'قرار غير صالح';
  end if;
  if p_decision = 'active' then
    update public.customer_profiles
       set zaro_id = coalesce(zaro_id, 'ZARO-' || lpad(nextval('public.zaro_customer_number_seq')::text,6,'0')),
           status='active', reviewed_at=now(), reviewed_by=auth.uid()
     where user_id=p_user_id and status in ('pending','rejected','suspended')
     returning zaro_id into v_id;
  else
    update public.customer_profiles
       set status=p_decision, reviewed_at=now(), reviewed_by=auth.uid()
     where user_id=p_user_id
     returning zaro_id into v_id;
  end if;
  if not found then raise exception 'الحساب غير موجود'; end if;
  return coalesce(v_id,'تم تحديث الحالة');
end;
$$;
revoke all on function public.zaro_review_customer(uuid,text) from public, anon;
grant execute on function public.zaro_review_customer(uuid,text) to authenticated;
