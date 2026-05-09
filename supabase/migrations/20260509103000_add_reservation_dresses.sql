-- =========================================================
-- Reservation dresses (multi-robe par reservation)
-- =========================================================
create table if not exists public.reservation_dresses (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  dress_id uuid not null references public.dresses(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  period daterange generated always as (daterange(start_date, end_date, '[]')) stored,
  status reservation_status not null default 'reserved',
  price numeric(10,2) not null check (price >= 0),
  base_price numeric(10,2) not null check (base_price >= 0),
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  created_at timestamptz not null default now(),
  constraint reservation_dresses_dates_chk check (end_date >= start_date),
  constraint reservation_dresses_unique unique (reservation_id, dress_id),
  constraint reservation_dresses_discount_chk check (discount_amount <= base_price)
);

create index if not exists idx_reservation_dresses_reservation_id on public.reservation_dresses(reservation_id);
create index if not exists idx_reservation_dresses_dress_id on public.reservation_dresses(dress_id);
create index if not exists idx_reservation_dresses_status on public.reservation_dresses(status);

alter table public.reservation_dresses
  drop constraint if exists reservation_dresses_no_overlap;

alter table public.reservation_dresses
  add constraint reservation_dresses_no_overlap
  exclude using gist (
    dress_id with =,
    period with &&
  )
  where (status in ('reserved', 'rented', 'preparing'));

alter table public.reservations
  drop constraint if exists reservations_no_overlap_for_unavailable_status;

insert into public.reservation_dresses (
  reservation_id,
  dress_id,
  start_date,
  end_date,
  status,
  price,
  base_price,
  discount_amount
)
select
  r.id,
  r.dress_id,
  r.start_date,
  r.end_date,
  r.status,
  r.total_price,
  d.price,
  d.discount_amount
from public.reservations r
join public.dresses d on d.id = r.dress_id
where r.dress_id is not null
on conflict (reservation_id, dress_id) do nothing;
