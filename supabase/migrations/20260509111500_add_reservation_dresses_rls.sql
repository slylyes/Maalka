-- Enable RLS and allow authenticated access for reservation_dresses
alter table public.reservation_dresses enable row level security;

do $$ begin
  create policy "reservation_dresses_authenticated_all"
    on public.reservation_dresses for all
    to authenticated
    using (true)
    with check (true);
exception when duplicate_object then null; end $$;
