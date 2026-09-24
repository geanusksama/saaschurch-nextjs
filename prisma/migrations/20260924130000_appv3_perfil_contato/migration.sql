-- App Igreja v3: função appv3_atualizar_contato (tela Atualizar perfil).
-- Fonte: appv3/app/supabase/appv3_schema.sql.
-- -----------------------------------------------------------------------------
-- Atualizar perfil (H2): contatos da conta do app valem na hora; o nome só
-- quando a conta ainda não está vinculada a um membro (vinculada, o nome da
-- carteirinha vem de members e a troca vai para a secretaria — D-09).
-- -----------------------------------------------------------------------------
create or replace function public.appv3_atualizar_contato(p_nome text, p_celular text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.appv3_perfis;
begin
  select * into p from public.appv3_perfis where auth_user_id = auth.uid() for update;
  if p.id is null then raise exception 'SEM_PERFIL'; end if;
  update public.appv3_perfis
     set celular = coalesce(nullif(regexp_replace(coalesce(p_celular, ''), '\D', '', 'g'), ''), celular),
         email   = coalesce(nullif(trim(p_email), ''), email),
         nome    = case when member_id is null then coalesce(nullif(trim(p_nome), ''), nome) else nome end,
         atualizado_em = now()
   where id = p.id
  returning * into p;
  return jsonb_build_object('nome', p.nome, 'celular', p.celular, 'email', p.email, 'vinculado', p.member_id is not null);
end $$;

revoke all on function public.appv3_atualizar_contato(text, text, text) from public, anon;
grant execute on function public.appv3_atualizar_contato(text, text, text) to authenticated;
