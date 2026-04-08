alter table public.dresses
  add column if not exists category text not null default 'Catégorie 1';

create index if not exists idx_dresses_category on public.dresses(category);
