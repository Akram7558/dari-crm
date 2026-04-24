-- Add image + reservation columns to vehicles
alter table vehicles
  add column if not exists image_url text,
  add column if not exists reserved_by_lead_id uuid references leads(id) on delete set null;

create index if not exists idx_vehicles_reserved_by_lead_id on vehicles(reserved_by_lead_id);

-- Storage bucket for vehicle images
insert into storage.buckets (id, name, public)
values ('vehicules', 'vehicules', true)
on conflict (id) do nothing;

-- Public read; authenticated uploads/updates/deletes
drop policy if exists "vehicules public read" on storage.objects;
create policy "vehicules public read"
  on storage.objects for select
  using (bucket_id = 'vehicules');

drop policy if exists "vehicules authenticated write" on storage.objects;
create policy "vehicules authenticated write"
  on storage.objects for insert
  with check (bucket_id = 'vehicules' and auth.role() = 'authenticated');

drop policy if exists "vehicules authenticated update" on storage.objects;
create policy "vehicules authenticated update"
  on storage.objects for update
  using (bucket_id = 'vehicules' and auth.role() = 'authenticated');

drop policy if exists "vehicules authenticated delete" on storage.objects;
create policy "vehicules authenticated delete"
  on storage.objects for delete
  using (bucket_id = 'vehicules' and auth.role() = 'authenticated');
