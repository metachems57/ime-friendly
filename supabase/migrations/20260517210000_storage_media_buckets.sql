-- Buckets publics pour médias app (Réseau / Outils / Photos profil)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('reseau-media', 'reseau-media', true, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('tools-media', 'tools-media', true, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('profile-photos', 'profile-photos', true, 6291456, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lecture publique (invités inclus)
drop policy if exists storage_select_reseau_media_public on storage.objects;
create policy storage_select_reseau_media_public
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'reseau-media');

drop policy if exists storage_select_tools_media_public on storage.objects;
create policy storage_select_tools_media_public
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'tools-media');

drop policy if exists storage_select_profile_photos_public on storage.objects;
create policy storage_select_profile_photos_public
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'profile-photos');

-- Upload: utilisateur validé dans son propre dossier <uid>/...
drop policy if exists storage_insert_reseau_media_own_validated on storage.objects;
create policy storage_insert_reseau_media_own_validated
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'reseau-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_validated = true
  )
);

drop policy if exists storage_insert_tools_media_own_validated on storage.objects;
create policy storage_insert_tools_media_own_validated
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'tools-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_validated = true
  )
);

drop policy if exists storage_insert_profile_photos_own_validated on storage.objects;
create policy storage_insert_profile_photos_own_validated
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_validated = true
  )
);

-- Modification / suppression: propriétaire du dossier ou admin validé
drop policy if exists storage_update_reseau_media_owner_or_admin on storage.objects;
create policy storage_update_reseau_media_owner_or_admin
on storage.objects
for update
to authenticated
using (
  bucket_id = 'reseau-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role = 'admin'
        and me.is_validated = true
    )
  )
)
with check (
  bucket_id = 'reseau-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role = 'admin'
        and me.is_validated = true
    )
  )
);

drop policy if exists storage_delete_reseau_media_owner_or_admin on storage.objects;
create policy storage_delete_reseau_media_owner_or_admin
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'reseau-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role = 'admin'
        and me.is_validated = true
    )
  )
);

drop policy if exists storage_update_tools_media_owner_or_admin on storage.objects;
create policy storage_update_tools_media_owner_or_admin
on storage.objects
for update
to authenticated
using (
  bucket_id = 'tools-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role = 'admin'
        and me.is_validated = true
    )
  )
)
with check (
  bucket_id = 'tools-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role = 'admin'
        and me.is_validated = true
    )
  )
);

drop policy if exists storage_delete_tools_media_owner_or_admin on storage.objects;
create policy storage_delete_tools_media_owner_or_admin
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'tools-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role = 'admin'
        and me.is_validated = true
    )
  )
);

drop policy if exists storage_update_profile_photos_owner_or_admin on storage.objects;
create policy storage_update_profile_photos_owner_or_admin
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role = 'admin'
        and me.is_validated = true
    )
  )
)
with check (
  bucket_id = 'profile-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role = 'admin'
        and me.is_validated = true
    )
  )
);

drop policy if exists storage_delete_profile_photos_owner_or_admin on storage.objects;
create policy storage_delete_profile_photos_owner_or_admin
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role = 'admin'
        and me.is_validated = true
    )
  )
);
