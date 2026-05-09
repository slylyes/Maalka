-- =========================================================
-- MAALKA - Schéma SQL initial (Supabase / PostgreSQL)
-- Version SANS rôles
-- =========================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- =========================================================
-- ENUMS
-- =========================================================
do $$ begin
  create type dress_status as enum ('available', 'reserved', 'rented', 'preparing', 'maintenance');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reservation_status as enum ('draft', 'reserved', 'rented', 'preparing', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type caution_status as enum ('not_required', 'pending', 'received', 'returned', 'retained');
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_type as enum ('contract', 'invoice');
exception when duplicate_object then null; end $$;

-- =========================================================
-- FONCTION UTILITAIRE
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- UTILISATEURS APPLICATIFS (profil lié à auth.users)
-- Auth gérée par Supabase Auth (email/password)
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- =========================================================
-- ROBES
-- =========================================================
create table if not exists public.dresses (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  name text,
  price numeric(10,2) not null check (price >= 0),
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  size text,
  status dress_status not null default 'available',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_dresses_updated_at on public.dresses;
create trigger trg_dresses_updated_at
before update on public.dresses
for each row execute function public.set_updated_at();

create table if not exists public.dress_photos (
  id uuid primary key default gen_random_uuid(),
  dress_id uuid not null references public.dresses(id) on delete cascade,
  storage_path text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_dress_photos_dress_id on public.dress_photos(dress_id);

-- =========================================================
-- CLIENTS
-- =========================================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_email_format_chk check (
    email is null or email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  )
);

drop trigger if exists trg_clients_updated_at on public.clients;
create trigger trg_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create index if not exists idx_clients_last_name_first_name on public.clients(last_name, first_name);

-- =========================================================
-- RÉSERVATIONS / CONTRATS (1 réservation = 1 robe)
-- =========================================================
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),

  contract_number text not null unique
    default ('CTR-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || substr(gen_random_uuid()::text, 1, 6)),

  dress_id uuid not null references public.dresses(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,

  start_date date not null,
  end_date date not null,
  period daterange generated always as (daterange(start_date, end_date, '[]')) stored,

  status reservation_status not null default 'reserved',

  total_price numeric(10,2) not null check (total_price >= 0),
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  deposit_paid numeric(10,2) not null default 0 check (deposit_paid >= 0),
  balance_due numeric(10,2) generated always as (greatest(total_price - deposit_paid, 0)) stored,

  caution_amount numeric(10,2) not null default 0 check (caution_amount >= 0),
  caution_status caution_status not null default 'pending',

  pickup_datetime timestamptz,
  return_datetime timestamptz,

  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reservation_dates_chk check (end_date >= start_date),
  constraint reservation_deposit_chk check (deposit_paid <= total_price)
);

drop trigger if exists trg_reservations_updated_at on public.reservations;
create trigger trg_reservations_updated_at
before update on public.reservations
for each row execute function public.set_updated_at();

alter table public.reservations
  drop constraint if exists reservations_no_overlap_for_unavailable_status;

alter table public.reservations
  add constraint reservations_no_overlap_for_unavailable_status
  exclude using gist (
    dress_id with =,
    period with &&
  )
  where (status in ('reserved', 'rented', 'preparing'));

create index if not exists idx_reservations_dress_dates
  on public.reservations(dress_id, start_date, end_date);

create index if not exists idx_reservations_status
  on public.reservations(status);

create index if not exists idx_reservations_start_date
  on public.reservations(start_date);

create index if not exists idx_reservations_end_date
  on public.reservations(end_date);

-- =========================================================
-- DOCUMENTS (contrat / facture PDF)
-- =========================================================
create table if not exists public.reservation_documents (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  doc_type document_type not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (reservation_id, doc_type)
);

create index if not exists idx_reservation_documents_reservation_id
  on public.reservation_documents(reservation_id);

-- =========================================================
-- RLS (outil interne : accès complet aux utilisateurs authentifiés)
-- =========================================================
alter table public.profiles enable row level security;
alter table public.dresses enable row level security;
alter table public.dress_photos enable row level security;
alter table public.clients enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_dresses enable row level security;
alter table public.reservation_documents enable row level security;

do $$ begin
  create policy "profiles_authenticated_all"
    on public.profiles for all
    to authenticated
    using (true)
    with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "dresses_authenticated_all"
    on public.dresses for all
    to authenticated
    using (true)
    with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "dress_photos_authenticated_all"
    on public.dress_photos for all
    to authenticated
    using (true)
    with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "clients_authenticated_all"
    on public.clients for all
    to authenticated
    using (true)
    with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "reservations_authenticated_all"
    on public.reservations for all
    to authenticated
    using (true)
    with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "reservation_dresses_authenticated_all"
    on public.reservation_dresses for all
    to authenticated
    using (true)
    with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "reservation_documents_authenticated_all"
    on public.reservation_documents for all
    to authenticated
    using (true)
    with check (true);
exception when duplicate_object then null; end $$;
