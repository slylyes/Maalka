update public.dresses
set category = case
  when category = 'Catégorie 1' then 'Caftans'
  when category = 'Catégorie 2' then 'Robes Kabyles'
  when category = 'Catégorie 3' then 'Karakou'
  when category = 'Catégorie 4' then 'Fergani'
  else category
end;

alter table public.dresses
  alter column category set default 'Caftans';
