-- ============================================================
-- Claimo: Initial Schema Migration
-- 20260615181505_init_claimo_schema.sql
-- ============================================================

-- ── 1. profiles ─────────────────────────────────────────────
create table if not exists public.profiles (
  id               uuid        primary key references auth.users(id) on delete cascade,
  email            text        not null,
  full_name        text,
  avatar_url       text,
  gmail_connected  boolean     default false,
  created_at       timestamptz default now()
);

-- Auto-create profile row on first sign-in
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 2. receipts ─────────────────────────────────────────────
create table if not exists public.receipts (
  id                  uuid          primary key default gen_random_uuid(),
  user_id             uuid          not null references public.profiles(id) on delete cascade,
  service             text          not null check (service in ('uber', 'lyft', 'ola', 'other')),
  amount              numeric(10,2) not null,
  currency            text          default 'USD',
  trip_date           date          not null,
  from_location       text,
  to_location         text,
  status              text          not null default 'pending' check (status in ('pending', 'found', 'missing')),
  reviewed            boolean       default false,
  gmail_message_id    text          unique,
  email_subject       text,
  raw_email_snippet   text,
  created_at          timestamptz   default now()
);

create index if not exists receipts_user_id_idx  on public.receipts(user_id);
create index if not exists receipts_trip_date_idx on public.receipts(trip_date desc);

-- ── 3. reports ──────────────────────────────────────────────
create table if not exists public.reports (
  id            uuid          primary key default gen_random_uuid(),
  user_id       uuid          not null references public.profiles(id) on delete cascade,
  month         int           not null check (month between 1 and 12),
  year          int           not null,
  pdf_url       text,
  total_amount  numeric(10,2),
  ride_count    int           default 0,
  status        text          not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  created_at    timestamptz   default now(),
  unique(user_id, month, year)
);

create index if not exists reports_user_id_idx on public.reports(user_id);

-- ── 4. Row Level Security ────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.receipts  enable row level security;
alter table public.reports   enable row level security;

-- profiles
create policy "profiles: owner select" on public.profiles for select using (auth.uid() = id);
create policy "profiles: owner update" on public.profiles for update using (auth.uid() = id);

-- receipts
create policy "receipts: owner select" on public.receipts for select using (auth.uid() = user_id);
create policy "receipts: owner insert" on public.receipts for insert with check (auth.uid() = user_id);
create policy "receipts: owner update" on public.receipts for update using (auth.uid() = user_id);
create policy "receipts: owner delete" on public.receipts for delete using (auth.uid() = user_id);

-- reports
create policy "reports: owner select" on public.reports for select using (auth.uid() = user_id);
create policy "reports: owner insert" on public.reports for insert with check (auth.uid() = user_id);
create policy "reports: owner update" on public.reports for update using (auth.uid() = user_id);
create policy "reports: owner delete" on public.reports for delete using (auth.uid() = user_id);

-- ── 5. Storage bucket for report PDFs ───────────────────────
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

create policy "reports bucket: owner read" on storage.objects
  for select using (
    bucket_id = 'reports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "reports bucket: service write" on storage.objects
  for insert with check (bucket_id = 'reports');
