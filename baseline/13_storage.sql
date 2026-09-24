-- Gerado por scripts/dump-baseline.mjs em 2026-09-24T17:33:38.074Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 500e39c338ad501d

-- Storage: buckets e policies
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('appv3-privado', 'appv3-privado', false, null, null)
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('appv3-publico', 'appv3-publico', true, null, null)
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

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
drop policy if exists "appv3_privado_dono" on "storage"."objects";
create policy "appv3_privado_dono" on "storage"."objects" as permissive for all to "authenticated" using (((bucket_id = 'appv3-privado'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) with check (((bucket_id = 'appv3-privado'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "appv3_publico_apagar" on "storage"."objects";
create policy "appv3_publico_apagar" on "storage"."objects" as permissive for delete to "authenticated" using (((bucket_id = 'appv3-publico'::text) AND ((storage.foldername(name))[1] = 'perfis'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)));
drop policy if exists "appv3_publico_escrita" on "storage"."objects";
create policy "appv3_publico_escrita" on "storage"."objects" as permissive for insert to "authenticated" with check (((bucket_id = 'appv3-publico'::text) AND ((storage.foldername(name))[1] = 'perfis'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)));
drop policy if exists "appv3_publico_leitura" on "storage"."objects";
create policy "appv3_publico_leitura" on "storage"."objects" as permissive for select to "anon", "authenticated" using ((bucket_id = 'appv3-publico'::text));
drop policy if exists "appv3_publico_troca" on "storage"."objects";
create policy "appv3_publico_troca" on "storage"."objects" as permissive for update to "authenticated" using (((bucket_id = 'appv3-publico'::text) AND ((storage.foldername(name))[1] = 'perfis'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)));
drop policy if exists "dados_faceid_app" on "storage"."objects";
create policy "dados_faceid_app" on "storage"."objects" as permissive for insert to "authenticated" with check (((bucket_id = 'dados'::text) AND (name ~~ (('faceid/enroll/'::text || ( SELECT (p.member_id)::text AS member_id
   FROM appv3_perfis p
  WHERE (p.auth_user_id = auth.uid()))) || '/%'::text))));
drop policy if exists "dados_sistema" on "storage"."objects";
create policy "dados_sistema" on "storage"."objects" as permissive for all to "authenticated" using (((bucket_id = ANY (ARRAY['dados'::text, 'cultos'::text])) AND ( SELECT fn_usuario_sistema() AS fn_usuario_sistema))) with check (((bucket_id = ANY (ARRAY['dados'::text, 'cultos'::text])) AND ( SELECT fn_usuario_sistema() AS fn_usuario_sistema)));
