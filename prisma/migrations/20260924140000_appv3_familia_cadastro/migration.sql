-- App Igreja v3: função appv3_familia_cadastro (tela Minha família).
-- Fonte: appv3/app/supabase/appv3_schema.sql.
-- -----------------------------------------------------------------------------
-- Família do cadastro da igreja (H5): pai, mãe e cônjuge de members e os
-- vínculos de member_family_relationships do membro vinculado. Somente
-- leitura no app; alterações vão para a secretaria.
-- -----------------------------------------------------------------------------
create or replace function public.appv3_familia_cadastro()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m public.members;
begin
  select mm.* into m from public.members mm
    join public.appv3_perfis p on p.member_id = mm.id
   where p.auth_user_id = auth.uid();
  if m.id is null then return jsonb_build_object('vinculado', false, 'pessoas', '[]'::jsonb); end if;
  return jsonb_build_object(
    'vinculado', true,
    'pai', nullif(trim(m.father_name), ''),
    'mae', nullif(trim(m.mother_name), ''),
    'conjuge', coalesce((select s.full_name from public.members s where s.id = m.spouse_id), nullif(trim(m.spouse_name), '')),
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nome', coalesce(o.full_name, r.related_name),
               'tipo', r.relationship_type,
               'nascimento', coalesce(o.birth_date, r.related_birth_date),
               'membro', r.related_member_id is not null,
               'sentido', case when r.member_id = m.id then 'dele' else 'inverso' end)
             order by r.created_at)
        from public.member_family_relationships r
        left join public.members o on o.id = case when r.member_id = m.id then r.related_member_id else r.member_id end
       where (r.member_id = m.id or r.related_member_id = m.id) and r.deleted_at is null), '[]'::jsonb));
end $$;

revoke all on function public.appv3_familia_cadastro() from public, anon;
grant execute on function public.appv3_familia_cadastro() to authenticated;
