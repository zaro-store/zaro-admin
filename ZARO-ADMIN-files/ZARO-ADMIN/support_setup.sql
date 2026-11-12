-- ZARO Customer Support setup
-- Run this entire script once in Supabase SQL Editor.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  subject text not null,
  status text not null default 'open' check (status in ('open','answered','closed')),
  access_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer','admin')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_updated_at_idx on public.support_tickets(updated_at desc);
create index if not exists support_messages_ticket_created_idx on public.support_messages(ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "Admins read support tickets" on public.support_tickets;
create policy "Admins read support tickets"
on public.support_tickets for select to authenticated
using (auth.uid() = '1bb9ddef-57a8-43d2-bf0c-be6d0b1f1cac'::uuid);

drop policy if exists "Admins update support tickets" on public.support_tickets;
create policy "Admins update support tickets"
on public.support_tickets for update to authenticated
using (auth.uid() = '1bb9ddef-57a8-43d2-bf0c-be6d0b1f1cac'::uuid)
with check (auth.uid() = '1bb9ddef-57a8-43d2-bf0c-be6d0b1f1cac'::uuid);

drop policy if exists "Admins read support messages" on public.support_messages;
create policy "Admins read support messages"
on public.support_messages for select to authenticated
using (auth.uid() = '1bb9ddef-57a8-43d2-bf0c-be6d0b1f1cac'::uuid);

drop policy if exists "Admins send support replies" on public.support_messages;
create policy "Admins send support replies"
on public.support_messages for insert to authenticated
with check (
  auth.uid() = '1bb9ddef-57a8-43d2-bf0c-be6d0b1f1cac'::uuid
  and sender_role = 'admin'
);

create or replace function public.zaro_create_support_ticket(
  p_name text, p_email text, p_subject text, p_body text, p_token text
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_ticket_id uuid;
begin
  if length(trim(coalesce(p_name,''))) not between 2 and 80
     or length(trim(coalesce(p_email,''))) not between 5 and 160
     or length(trim(coalesce(p_subject,''))) not between 2 and 100
     or length(trim(coalesce(p_body,''))) not between 2 and 3000
     or length(coalesce(p_token,'')) < 40 then
    raise exception 'بيانات الرسالة غير مكتملة أو أطول من المسموح.';
  end if;

  insert into public.support_tickets(customer_name, customer_email, subject, access_token_hash)
  values (trim(p_name), trim(p_email), trim(p_subject), encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex'))
  returning id into v_ticket_id;

  insert into public.support_messages(ticket_id, sender_role, body)
  values (v_ticket_id, 'customer', trim(p_body));

  return v_ticket_id;
end;
$$;

create or replace function public.zaro_send_customer_message(
  p_ticket_id uuid, p_token text, p_body text
) returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_hash text;
begin
  if length(trim(coalesce(p_body,''))) not between 1 and 3000 then
    raise exception 'الرسالة فارغة أو أطول من المسموح.';
  end if;

  v_hash := encode(extensions.digest(convert_to(coalesce(p_token,''),'UTF8'),'sha256'),'hex');
  update public.support_tickets
     set updated_at = now(), status = case when status = 'closed' then status else 'open' end
   where id = p_ticket_id and access_token_hash = v_hash and status <> 'closed';

  if not found then raise exception 'المحادثة غير موجودة أو مغلقة.'; end if;

  insert into public.support_messages(ticket_id, sender_role, body)
  values (p_ticket_id, 'customer', trim(p_body));
  return true;
end;
$$;

create or replace function public.zaro_get_customer_conversation(
  p_ticket_id uuid, p_token text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_result jsonb;
declare v_hash text;
begin
  v_hash := encode(extensions.digest(convert_to(coalesce(p_token,''),'UTF8'),'sha256'),'hex');

  select jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', t.id, 'customer_name', t.customer_name, 'subject', t.subject,
      'status', t.status, 'created_at', t.created_at, 'updated_at', t.updated_at
    ),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'sender_role', m.sender_role, 'body', m.body, 'created_at', m.created_at
      ) order by m.created_at asc)
      from public.support_messages m where m.ticket_id = t.id
    ), '[]'::jsonb)
  )
  into v_result
  from public.support_tickets t
  where t.id = p_ticket_id and t.access_token_hash = v_hash;

  if v_result is null then raise exception 'تعذر العثور على المحادثة. تحقق من بيانات المتابعة.'; end if;
  return v_result;
end;
$$;

revoke all on function public.zaro_create_support_ticket(text,text,text,text,text) from public;
revoke all on function public.zaro_send_customer_message(uuid,text,text) from public;
revoke all on function public.zaro_get_customer_conversation(uuid,text) from public;
grant execute on function public.zaro_create_support_ticket(text,text,text,text,text) to anon, authenticated;
grant execute on function public.zaro_send_customer_message(uuid,text,text) to anon, authenticated;
grant execute on function public.zaro_get_customer_conversation(uuid,text) to anon, authenticated;

grant select, update on public.support_tickets to authenticated;
grant select, insert on public.support_messages to authenticated;
