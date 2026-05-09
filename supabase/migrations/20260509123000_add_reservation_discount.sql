-- =========================================================
-- Reservation discount applied at reservation time
-- =========================================================
alter table public.reservations
  add column if not exists discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0);

-- Backfill discount for existing reservations based on reservation_dresses
update public.reservations r
set discount_amount = sub.discount_total
from (
  select reservation_id, sum(greatest(base_price - price, 0)) as discount_total
  from public.reservation_dresses
  group by reservation_id
) sub
where r.id = sub.reservation_id;

-- Ensure reservation_dresses use base_price and derived discount
update public.reservation_dresses rd
set
  base_price = d.price,
  discount_amount = greatest(d.price - rd.price, 0),
  price = greatest(d.price - greatest(d.price - rd.price, 0), 0)
from public.dresses d
where rd.dress_id = d.id;
