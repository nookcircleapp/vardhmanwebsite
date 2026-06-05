-- =====================================================================
-- VARDHMAN DASHBOARD — SUPABASE SETUP
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Then go to Authentication → Users and invite the 3 dashboard users:
--   saif@vardhman.com
--   sudhanshu@vardhman.com
--   admin@vardhman.com
-- =====================================================================

-- 1. Enquiries table (stores all contact-form submissions)
create table if not exists public.enquiries (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  email       text not null,
  project     text,
  message     text,
  source_url  text,
  user_agent  text,
  status      text default 'new',
  created_at  timestamptz not null default now()
);

create index if not exists enquiries_created_at_idx
  on public.enquiries (created_at desc);

-- 2. Row Level Security
alter table public.enquiries enable row level security;

drop policy if exists "anon_insert_enquiries"          on public.enquiries;
drop policy if exists "authenticated_read_enquiries"   on public.enquiries;
drop policy if exists "authenticated_update_enquiries" on public.enquiries;
drop policy if exists "authenticated_delete_enquiries" on public.enquiries;

-- Public website can INSERT (the form)
create policy "anon_insert_enquiries"
  on public.enquiries for insert
  to anon, authenticated
  with check (true);

-- Per-user visibility:
--   admin@vardhman.com    → all enquiries
--   saif@vardhman.com     → only Fairmont enquiries
--   sudhanshu@vardhman.com → only Celestia enquiries
create policy "authenticated_read_enquiries"
  on public.enquiries for select
  to authenticated
  using (
    auth.jwt() ->> 'email' = 'admin@vardhman.com'
    or (auth.jwt() ->> 'email' = 'saif@vardhman.com'      and project ilike '%fairmont%')
    or (auth.jwt() ->> 'email' = 'sudhanshu@vardhman.com' and project ilike '%celestia%')
  );

-- Update / delete inherit the same scope (saif can't touch celestia rows etc.)
create policy "authenticated_update_enquiries"
  on public.enquiries for update
  to authenticated
  using (
    auth.jwt() ->> 'email' = 'admin@vardhman.com'
    or (auth.jwt() ->> 'email' = 'saif@vardhman.com'      and project ilike '%fairmont%')
    or (auth.jwt() ->> 'email' = 'sudhanshu@vardhman.com' and project ilike '%celestia%')
  )
  with check (
    auth.jwt() ->> 'email' = 'admin@vardhman.com'
    or (auth.jwt() ->> 'email' = 'saif@vardhman.com'      and project ilike '%fairmont%')
    or (auth.jwt() ->> 'email' = 'sudhanshu@vardhman.com' and project ilike '%celestia%')
  );

create policy "authenticated_delete_enquiries"
  on public.enquiries for delete
  to authenticated
  using (
    auth.jwt() ->> 'email' = 'admin@vardhman.com'
    or (auth.jwt() ->> 'email' = 'saif@vardhman.com'      and project ilike '%fairmont%')
    or (auth.jwt() ->> 'email' = 'sudhanshu@vardhman.com' and project ilike '%celestia%')
  );

-- 3. Enable Realtime so dashboard updates live as new enquiries arrive
alter publication supabase_realtime add table public.enquiries;
