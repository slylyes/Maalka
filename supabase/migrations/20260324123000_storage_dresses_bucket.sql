-- =========================================================
-- MAALKA - Storage bucket for dress photos
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dresses',
  'dresses',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  create policy "dresses_select_authenticated"
    on storage.objects
    for select
    to authenticated
    using (bucket_id = 'dresses');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "dresses_insert_authenticated"
    on storage.objects
    for insert
    to authenticated
    with check (bucket_id = 'dresses');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "dresses_update_authenticated"
    on storage.objects
    for update
    to authenticated
    using (bucket_id = 'dresses')
    with check (bucket_id = 'dresses');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "dresses_delete_authenticated"
    on storage.objects
    for delete
    to authenticated
    using (bucket_id = 'dresses');
exception when duplicate_object then null; end $$;