-- Cria o primeiro usuário MASTER do sistema — login via Supabase Auth
-- (auth.users + auth.identities) + perfil em public.users com profile_type
-- = 'master'. É o login usado pra sistema inteiro (o login não usa
-- public.users.password_hash, é decorativo/legado — a autenticação real é
-- 100% Supabase Auth, ver src/lib/auth.ts).
--
-- COMO USAR: troque os 3 valores abaixo (v_email, v_senha, v_nome) e rode
-- este arquivo inteiro no SQL Editor do Supabase. Pode rodar a qualquer
-- momento (não depende de igreja, campo nem dos outros arquivos desta
-- pasta).
--
-- IMPORTANTE: este arquivo fica com a senha em texto puro até você trocar
-- o valor. Não commite este arquivo com uma senha real — troque de volta
-- por um placeholder (ou apague o arquivo) depois de rodar.

DO $$
DECLARE
  v_email   TEXT := 'admin@suaigreja.com.br';   -- <<< TROCAR: email de login
  v_senha   TEXT := 'TrocarEstaSenha123!';       -- <<< TROCAR: senha de login
  v_nome    TEXT := 'Administrador Master';      -- <<< TROCAR (opcional): nome exibido
  v_user_id UUID := gen_random_uuid();
BEGIN
  -- 1) Usuário no Supabase Auth (é isso que o login de fato verifica)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change, is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(v_senha, extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_nome, 'profile_type', 'master'),
    now(), now(), '', '', '', '', false, false
  )
  ON CONFLICT (email) WHERE is_sso_user = false DO NOTHING;

  -- Se o email já existia (conflito acima), pega o id real ao invés do gerado agora
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  -- 2) Identity — obrigatória pro Supabase Auth aceitar login por senha
  INSERT INTO auth.identities (
    id, provider_id, user_id, identity_data, provider, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id::text, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email', now(), now()
  )
  ON CONFLICT (provider_id, provider) DO NOTHING;

  -- 3) Perfil em public.users — é daqui que o sistema lê profile_type,
  -- permissões, campo/igreja vinculados etc. (busca por email, não por id)
  INSERT INTO public.users (id, email, full_name, profile_type, is_admin, is_active)
  VALUES (v_user_id, v_email, v_nome, 'master', true, true)
  ON CONFLICT (email) DO UPDATE
    SET profile_type = 'master', is_admin = true, is_active = true, full_name = EXCLUDED.full_name;
END $$;

-- Depois de rodar: faça login com o email/senha acima na tela de login do
-- sistema. Se o login falhar (schema do Supabase Auth pode variar entre
-- versões), crie o usuário pelo Dashboard: Authentication → Add User → com
-- o MESMO email, e rode só o bloco 3 acima (ou repita este arquivo inteiro —
-- ele é idempotente, não duplica).
