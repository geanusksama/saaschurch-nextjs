-- Gerado por scripts/dump-baseline.mjs em 2026-08-28T18:29:08.876Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 6013fb939d04d7f4

-- Storage: buckets e policies
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cultos', 'cultos', true, null, null)
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dados', 'dados', true, null, null)
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dept-media', 'dept-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'video/webm']::text[])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 52428800, null)
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Policies em storage.objects / storage.buckets
drop policy if exists "liuvres2 1cprxsu_0" on "storage"."objects";
create policy "liuvres2 1cprxsu_0" on "storage"."objects" as permissive for select to public using ((bucket_id = 'cultos'::text));
drop policy if exists "liuvres2 1cprxsu_1" on "storage"."objects";
create policy "liuvres2 1cprxsu_1" on "storage"."objects" as permissive for insert to public with check ((bucket_id = 'cultos'::text));
drop policy if exists "liuvres2 1cprxsu_2" on "storage"."objects";
create policy "liuvres2 1cprxsu_2" on "storage"."objects" as permissive for delete to public using ((bucket_id = 'cultos'::text));
drop policy if exists "livre 1krhyj_0" on "storage"."objects";
create policy "livre 1krhyj_0" on "storage"."objects" as permissive for select to public using ((bucket_id = 'dados'::text));
drop policy if exists "livre 1krhyj_1" on "storage"."objects";
create policy "livre 1krhyj_1" on "storage"."objects" as permissive for insert to public with check ((bucket_id = 'dados'::text));
drop policy if exists "livre 1krhyj_2" on "storage"."objects";
create policy "livre 1krhyj_2" on "storage"."objects" as permissive for update to public using ((bucket_id = 'dados'::text));
drop policy if exists "livre 1krhyj_3" on "storage"."objects";
create policy "livre 1krhyj_3" on "storage"."objects" as permissive for delete to public using ((bucket_id = 'dados'::text));
