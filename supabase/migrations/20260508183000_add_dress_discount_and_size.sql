alter table public.dresses
  add column if not exists discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  add column if not exists size text;

alter table public.dresses
  drop constraint if exists dresses_discount_not_greater_than_price;

alter table public.dresses
  add constraint dresses_discount_not_greater_than_price
  check (discount_amount <= price);
