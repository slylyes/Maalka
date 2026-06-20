-- Supplément (frais additionnels, ex: journée de location supplémentaire)
-- Inclus dans total_price (total = sous-total - remise + supplément),
-- donc automatiquement reflété dans balance_due (colonne générée) et le CA.
alter table public.reservations
  add column if not exists supplement numeric(10,2) not null default 0 check (supplement >= 0);
