-- Date de réservation : jour où le client a réservé et payé l'acompte.
-- Peut être dans le passé (réservations historiques saisies après coup).
-- Les finances comptent désormais l'acompte sur cette date (au lieu de created_at).
alter table public.reservations
  add column if not exists reservation_date date;

-- Backfill : on garde created_at comme valeur de départ. Certaines réservations ont
-- déjà une date réelle = date de création ; les autres seront corrigées manuellement.
update public.reservations
  set reservation_date = (created_at)::date
  where reservation_date is null;

alter table public.reservations
  alter column reservation_date set default current_date;

alter table public.reservations
  alter column reservation_date set not null;

create index if not exists idx_reservations_reservation_date
  on public.reservations(reservation_date);
