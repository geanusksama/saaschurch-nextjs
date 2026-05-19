-- Adiciona coluna nome em app_cadastros
ALTER TABLE app_cadastros ADD COLUMN IF NOT EXISTS nome text NOT NULL DEFAULT '';

-- Corrige default de status para maiúsculo (alinha com MRM)
ALTER TABLE app_cadastros ALTER COLUMN status SET DEFAULT 'PENDENTE';

-- Corrige status existentes para maiúsculo caso haja registros antigos
UPDATE app_cadastros SET status = UPPER(status) WHERE status != UPPER(status);

-- Função RPC chamada pelo app Flutter no cadastro
-- Recebe os dados do formulário e insere em app_cadastros com status PENDENTE
CREATE OR REPLACE FUNCTION fn_register_app_user(
  p_user_id        uuid,
  p_email          text,
  p_nome           text,
  p_headquarters_id uuid,
  p_is_member      boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
  v_existing uuid;
BEGIN
  -- Evita duplicatas: se já existe registro para esse user_id, retorna o existente
  SELECT id INTO v_existing FROM app_cadastros WHERE user_id = p_user_id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_existing, 'already_exists', true);
  END IF;

  INSERT INTO app_cadastros (user_id, email, nome, headquarters_id, is_member, status)
  VALUES (p_user_id, p_email, p_nome, p_headquarters_id, p_is_member, 'PENDENTE')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'already_exists', false);
END;
$$;

-- Garante que apenas usuários autenticados podem chamar a função
REVOKE ALL ON FUNCTION fn_register_app_user(uuid, text, text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_register_app_user(uuid, text, text, uuid, boolean) TO authenticated;
