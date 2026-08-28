-- Gerado por scripts/dump-baseline.mjs em 2026-08-28T05:10:27.919Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline c4f239f220316469

-- Funcoes e procedures
set check_function_bodies = false;

CREATE OR REPLACE FUNCTION app.current_church_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_claims jsonb;
  v_church text;
BEGIN
  BEGIN
    v_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  v_church := COALESCE(v_claims->>'church_id', v_claims->>'churchId');
  IF v_church IS NULL OR trim(v_church) = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN v_church::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$function$
;

CREATE OR REPLACE FUNCTION app.current_user_role()
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_claims jsonb;
BEGIN
  BEGIN
    v_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'user';
  END;

  RETURN lower(COALESCE(v_claims->>'app_role', v_claims->>'role', 'user'));
END;
$function$
;

CREATE OR REPLACE FUNCTION app.is_leadership()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  SELECT app.current_user_role() IN ('admin', 'pastor', 'leader', 'lider');
$function$
;

CREATE OR REPLACE FUNCTION app.log_pastoral_audit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_church_id uuid;
  v_user_id uuid;
  v_entity_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_church_id := OLD.church_id;
    v_entity_id := OLD.id;
  ELSE
    v_church_id := NEW.church_id;
    v_entity_id := NEW.id;
  END IF;

  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  INSERT INTO pastoral_audit_logs (
    church_id,
    entity_type,
    entity_id,
    action,
    old_data,
    new_data,
    user_id,
    created_by,
    updated_by
  ) VALUES (
    v_church_id,
    TG_TABLE_NAME,
    v_entity_id,
    lower(TG_OP),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    v_user_id,
    v_user_id,
    v_user_id
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION app.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public._set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.app_cancel_order(p_order_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Apenas o dono do pedido ou um admin pode cancelar
  IF NOT EXISTS (
    SELECT 1 FROM app_orders
    WHERE id = p_order_id
      AND (user_id = p_user_id OR EXISTS (
        SELECT 1 FROM members m WHERE m.user_id = p_user_id AND m.rol IN (1,2,3) AND m.deleted_at IS NULL
      ))
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Libera assentos
  UPDATE app_seats
  SET    status = 'available', reserved_by = NULL, reserved_at = NULL, order_item_id = NULL
  WHERE  order_item_id IN (
    SELECT id FROM app_order_items WHERE order_id = p_order_id
  );

  -- Invalida ingressos
  UPDATE app_tickets
  SET    cancelled_at = now()
  WHERE  order_id = p_order_id AND cancelled_at IS NULL;

  -- Atualiza status do pedido
  UPDATE app_orders
  SET    status = 'cancelled', cancelled_at = now(), updated_at = now()
  WHERE  id = p_order_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.app_cleanup_expired_cart()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  -- Libera assentos cujo carrinho expirou
  UPDATE app_seats
  SET    status = 'available', reserved_by = NULL, reserved_at = NULL
  WHERE  reserved_by IN (
    SELECT DISTINCT user_id FROM app_cart_items WHERE expires_at < now()
  )
  AND status = 'reserved';

  DELETE FROM app_cart_items WHERE expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.app_confirm_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_item      app_order_items%ROWTYPE;
BEGIN
  UPDATE app_orders SET status = 'confirmed', updated_at = now()
  WHERE id = p_order_id AND status = 'pending';

  FOR v_item IN SELECT * FROM app_order_items WHERE order_id = p_order_id LOOP
    IF v_item.seat_id IS NOT NULL THEN
      UPDATE app_seats
      SET    status = 'sold', reserved_by = NULL, order_item_id = v_item.id
      WHERE  id = v_item.seat_id;
    END IF;

    INSERT INTO app_tickets (order_item_id, order_id, user_id, event_id, qr_payload)
    SELECT
      v_item.id,
      p_order_id,
      o.user_id,
      v_item.event_id,
      json_build_object(
        'order_id',    p_order_id,
        'event_id',    v_item.event_id,
        'seat',        COALESCE(v_item.row_label::TEXT || v_item.seat_number::TEXT, 'livre'),
        'hall',        v_item.hall_name,
        'building',    v_item.building_name,
        'issued_at',   now()
      )::TEXT
    FROM app_orders o WHERE o.id = p_order_id
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.app_generate_seats_for_hall(p_event_id uuid, p_hall_id uuid, p_price numeric DEFAULT 0)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_hall   app_event_halls%ROWTYPE;
  r_idx    INTEGER;
  s_idx    INTEGER;
  v_label  CHAR(1);
  v_count  INTEGER := 0;
BEGIN
  SELECT * INTO v_hall FROM app_event_halls WHERE id = p_hall_id AND event_id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hall % not found for event %', p_hall_id, p_event_id; END IF;

  FOR r_idx IN 0 .. v_hall.num_rows - 1 LOOP
    v_label := CHR(65 + (r_idx % 26));  -- A-Z
    FOR s_idx IN 1 .. v_hall.seats_per_row LOOP
      INSERT INTO app_seats (event_id, hall_id, row_label, seat_number, price)
      VALUES (p_event_id, p_hall_id, v_label, s_idx, p_price)
      ON CONFLICT (event_id, hall_id, row_label, seat_number) DO NOTHING;
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.app_reserve_seat(p_seat_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_status      seat_status;
  v_reserved_by UUID;
  v_reserved_at TIMESTAMPTZ;
BEGIN
  SELECT status, reserved_by, reserved_at
  INTO   v_status, v_reserved_by, v_reserved_at
  FROM   app_seats WHERE id = p_seat_id FOR UPDATE;

  -- Libera reserva expirada
  IF v_status = 'reserved'
     AND v_reserved_by IS NOT NULL
     AND v_reserved_at < now() - INTERVAL '15 minutes'
  THEN
    v_status := 'available';
  END IF;

  IF v_status <> 'available' AND NOT (v_status = 'reserved' AND v_reserved_by = p_user_id) THEN
    RETURN FALSE;
  END IF;

  UPDATE app_seats
  SET    status = 'reserved', reserved_by = p_user_id, reserved_at = now()
  WHERE  id = p_seat_id;

  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_apply_campo_policies(p_table text, p_profile text DEFAULT 'content'::text, p_extra text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_read      TEXT;
  v_write     TEXT;
  v_user_type TEXT;
  v_uid       TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name=p_table) THEN
    RETURN format('SKIP  %s', p_table);
  END IF;

  SELECT data_type INTO v_user_type
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name=p_table AND column_name='user_id';

  -- cast conforme o tipo real da coluna
  v_uid := CASE WHEN v_user_type = 'uuid' THEN 'auth.uid()' ELSE 'auth.uid()::text' END;

  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_table||'_campo_read',  p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_table||'_campo_write', p_table);

  v_read := 'public.fn_campo_visible(campo_id)';

  IF p_profile = 'owned' AND v_user_type IS NOT NULL THEN
    v_read  := '(' || v_read || ' AND (user_id = ' || v_uid
               || ' OR public.fn_is_campo_admin()))';
    v_write := '(public.fn_campo_visible(campo_id) AND (user_id = ' || v_uid
               || ' OR public.fn_is_campo_admin()))';
  ELSE
    v_write := '(public.fn_campo_visible(campo_id) AND public.fn_is_campo_admin())';
  END IF;

  IF p_extra IS NOT NULL THEN
    v_read := '(' || v_read || ' AND (' || p_extra || ' OR public.fn_is_campo_admin()))';
  END IF;

  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
                 p_table||'_campo_read', p_table, v_read);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
                 p_table||'_campo_write', p_table, v_write, v_write);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', p_table);

  RETURN format('OK    %s (%s, user_id=%s)', p_table, p_profile, coalesce(v_user_type,'—'));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_aprovar_reembolso(p_order_id uuid, p_admin_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Atualiza status do pedido (trigger cria notificação automaticamente)
  UPDATE public.orders
     SET status = 'REEMBOLSADO', updated_at = now()
   WHERE id = p_order_id
     AND status = 'REFUND_REQUESTED';

  -- Cancela QR codes do pedido
  UPDATE public.order_qrcodes
     SET cancelled_at = now()
   WHERE order_id = p_order_id
     AND cancelled_at IS NULL;

  -- Histórico
  INSERT INTO public.order_status_history (order_id, old_status, new_status, created_by)
  VALUES (p_order_id, 'REFUND_REQUESTED', 'REEMBOLSADO', p_admin_id)
  ON CONFLICT DO NOTHING;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_campo_visible(p_campo uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.fn_is_master()
      OR (p_campo IS NOT NULL AND p_campo = public.fn_get_my_campo_id());
$function$
;

CREATE OR REPLACE FUNCTION public.fn_face_enrollment_signal()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO public.face_enrollment_signals (job_id, device_id, church_id)
    VALUES (NEW.id, NEW.device_id, NEW.church_id);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_get_my_campo_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT campo_id FROM (
    -- 1. campo_id direto em members (melhor fonte)
    (SELECT m.campo_id, 1 AS prio
       FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.deleted_at IS NULL
        AND m.campo_id IS NOT NULL
      LIMIT 1)

    UNION ALL

    -- 2. headquarters_id da igreja do membro (UUID do campo no modelo legado)
    (SELECT c.headquarters_id AS campo_id, 2 AS prio
       FROM public.members m
       JOIN public.churches c ON c.id = m.church_id
      WHERE m.user_id = auth.uid()
        AND m.deleted_at IS NULL
        AND c.headquarters_id IS NOT NULL
      LIMIT 1)

    UNION ALL

    -- 3. campo via hierarquia regional (members → regionais → campos)
    (SELECT r.campo_id, 3 AS prio
       FROM public.members m
       JOIN public.regionais r ON r.id = m.regional_id
      WHERE m.user_id = auth.uid()
        AND m.deleted_at IS NULL
        AND r.campo_id IS NOT NULL
      LIMIT 1)

    UNION ALL

    -- 4. campo via hierarquia da igreja (members → churches → regionais → campos)
    (SELECT r.campo_id, 4 AS prio
       FROM public.members m
       JOIN public.churches c  ON c.id = m.church_id
       JOIN public.regionais r ON r.id = c.regional_id
      WHERE m.user_id = auth.uid()
        AND m.deleted_at IS NULL
        AND r.campo_id IS NOT NULL
      LIMIT 1)

    UNION ALL

    -- 5. campo_id em app_cadastros via user_id
    (SELECT ac.campo_id, 5 AS prio
       FROM public.app_cadastros ac
      WHERE ac.user_id = auth.uid()
        AND ac.campo_id IS NOT NULL
      LIMIT 1)

    UNION ALL

    -- 6. campo_id em app_cadastros via auth_user_id (instâncias legadas)
    (SELECT ac.campo_id, 6 AS prio
       FROM public.app_cadastros ac
      WHERE ac.auth_user_id = auth.uid()
        AND ac.campo_id IS NOT NULL
      LIMIT 1)

    UNION ALL

    -- 7. headquarters_id de app_cadastros como fallback de campo
    (SELECT ac.headquarters_id AS campo_id, 7 AS prio
       FROM public.app_cadastros ac
      WHERE ac.user_id = auth.uid()
        AND ac.headquarters_id IS NOT NULL
      LIMIT 1)

    UNION ALL

    -- 8. headquarters_id de app_cadastros via auth_user_id
    (SELECT ac.headquarters_id AS campo_id, 8 AS prio
       FROM public.app_cadastros ac
      WHERE ac.auth_user_id = auth.uid()
        AND ac.headquarters_id IS NOT NULL
      LIMIT 1)

    UNION ALL

    -- 9. app_membros_auth.campo_id
    (SELECT ama.campo_id, 9 AS prio
       FROM public.app_membros_auth ama
      WHERE ama.auth_user_id = auth.uid()
        AND ama.campo_id IS NOT NULL
      LIMIT 1)

  ) sub
  ORDER BY prio
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_is_campo_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.fn_is_master() OR EXISTS (
    SELECT 1 FROM public.members m
     WHERE m.user_id = auth.uid()
       AND m.rol = ANY (ARRAY[1,2,3])
       AND m.deleted_at IS NULL
  );
$function$
;

CREATE OR REPLACE FUNCTION public.fn_is_master()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.id = auth.uid()
       AND (u.is_admin = true OR lower(coalesce(u.profile_type,'')) = 'master')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.fn_negar_reembolso(p_order_id uuid, p_motivo text DEFAULT ''::text, p_admin_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Volta para PAGO (trigger cria notificação automaticamente)
  UPDATE public.orders
     SET status = 'PAGO', updated_at = now()
   WHERE id = p_order_id
     AND status = 'REFUND_REQUESTED';

  -- Histórico
  INSERT INTO public.order_status_history (order_id, old_status, new_status, reason, created_by)
  VALUES (p_order_id, 'REFUND_REQUESTED', 'PAGO', p_motivo, p_admin_id)
  ON CONFLICT DO NOTHING;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_notify_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id  UUID;
  v_titulo   TEXT;
  v_mensagem TEXT;
  v_tipo     TEXT;
BEGIN
  -- Só age em mudanças de status relevantes
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  v_user_id := NEW.user_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  CASE NEW.status
    WHEN 'REEMBOLSADO' THEN
      v_tipo     := 'reembolso_aprovado';
      v_titulo   := 'Reembolso aprovado';
      v_mensagem := 'Seu reembolso foi aprovado. O valor será devolvido conforme o método de pagamento original.';
    WHEN 'PAGO' THEN
      -- Volta pra PAGO após ter sido REFUND_REQUESTED = negado
      IF OLD.status = 'REFUND_REQUESTED' THEN
        v_tipo     := 'reembolso_negado';
        v_titulo   := 'Solicitação de reembolso negada';
        v_mensagem := 'Sua solicitação de reembolso não foi aprovada. Entre em contato com a equipe do evento.';
      ELSE
        RETURN NEW;
      END IF;
    WHEN 'CANCELADO' THEN
      v_tipo     := 'pedido_cancelado';
      v_titulo   := 'Pedido cancelado';
      v_mensagem := 'Seu pedido foi cancelado.';
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO public.app_notifications (user_id, tipo, titulo, mensagem, order_id)
  VALUES (v_user_id, v_tipo, v_titulo, v_mensagem, NEW.id);

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_publish_department_site(p_site_id uuid)
 RETURNS department_sites
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_site public.department_sites;
BEGIN
  SELECT * INTO v_site FROM public.department_sites WHERE id = p_site_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Site % não encontrado', p_site_id;
  END IF;

  IF NOT public.fn_campo_visible(v_site.campo_id) OR NOT public.fn_is_campo_admin() THEN
    RAISE EXCEPTION 'Sem permissão para publicar este site';
  END IF;

  -- congela o rascunho como versão no ar
  UPDATE public.department_site_blocks
     SET props_publicado = props
   WHERE site_id = p_site_id;

  UPDATE public.department_sites
     SET status = 'PUBLICADO',
         published_at = now(),
         published_by = auth.uid()
   WHERE id = p_site_id
  RETURNING * INTO v_site;

  RETURN v_site;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_register_app_user(p_user_id uuid, p_email text, p_nome text DEFAULT ''::text, p_headquarters_id uuid DEFAULT NULL::uuid, p_is_member boolean DEFAULT false, p_campo_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nome       TEXT := COALESCE(NULLIF(trim(p_nome), ''), split_part(p_email, '@', 1));
  v_campo_id   UUID := COALESCE(p_campo_id, p_headquarters_id);
  v_campo_name TEXT := '';
BEGIN
  -- Resolve nome do campo (p_headquarters_id = UUID do campo)
  IF v_campo_id IS NOT NULL THEN
    SELECT name INTO v_campo_name FROM public.campos WHERE id = v_campo_id LIMIT 1;
  END IF;

  INSERT INTO public.app_cadastros (
    user_id,
    auth_user_id,
    email,
    nome,
    headquarters_id,
    campo_id,
    campo_name,
    is_member,
    status
  ) VALUES (
    p_user_id,
    p_user_id,          -- sincroniza os dois campos de ID
    p_email,
    v_nome,
    p_headquarters_id,
    v_campo_id,
    COALESCE(v_campo_name, ''),
    p_is_member,
    'PENDENTE'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email          = EXCLUDED.email,
        nome           = CASE WHEN EXCLUDED.nome <> '' THEN EXCLUDED.nome ELSE app_cadastros.nome END,
        headquarters_id = COALESCE(EXCLUDED.headquarters_id, app_cadastros.headquarters_id),
        campo_id        = COALESCE(EXCLUDED.campo_id,        app_cadastros.campo_id),
        campo_name      = CASE WHEN EXCLUDED.campo_name <> '' THEN EXCLUDED.campo_name ELSE app_cadastros.campo_name END,
        updated_at      = now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_register_app_user(p_user_id uuid, p_email text, p_nome text, p_headquarters_id uuid, p_is_member boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.fn_setup_campo_scope(p_table text, p_parent text DEFAULT NULL::text, p_fk text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_backfilled INT := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name=p_table) THEN
    RETURN format('SKIP  %s (tabela inexistente)', p_table);
  END IF;

  -- 3a. coluna + índice
  EXECUTE format(
    'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS campo_id UUID REFERENCES public.campos(id)',
    p_table);
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON public.%I(campo_id)',
    'idx_' || p_table || '_campo_id', p_table);

  -- 3b. backfill a partir do pai
  IF p_parent IS NOT NULL AND p_fk IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name=p_parent AND column_name='campo_id') THEN
    EXECUTE format(
      'UPDATE public.%I t SET campo_id = p.campo_id
         FROM public.%I p
        WHERE p.id = t.%I AND t.campo_id IS NULL AND p.campo_id IS NOT NULL',
      p_table, p_parent, p_fk);
    GET DIAGNOSTICS v_backfilled = ROW_COUNT;
  END IF;

  -- 3c. trigger de herança
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',
                 'trg_' || p_table || '_campo_id', p_table);
  EXECUTE format(
    'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.trg_fn_inherit_campo_id(%L, %L)',
    'trg_' || p_table || '_campo_id', p_table,
    coalesce(p_parent,''), coalesce(p_fk,''));

  RETURN format('OK    %s (backfill: %s linhas)', p_table, v_backfilled);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_slugify(p_text text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT trim(both '-' FROM
    regexp_replace(
      lower(translate(coalesce(p_text,''),
                      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
                      'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')),
      '[^a-z0-9]+', '-', 'g'));
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_crm_profile()
 RETURNS TABLE(profile_type text, is_admin boolean, role_name text, user_permissions jsonb, role_permissions jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    u.profile_type,
    COALESCE(u.is_admin, false),
    r.name,
    COALESCE(u.permissions, '{}'),
    COALESCE(r.permissions, '{}')
  FROM users u
  LEFT JOIN roles r
    ON r.id = u.role_id
   AND r.deleted_at IS NULL
  WHERE
    u.deleted_at IS NULL
    AND u.is_active = true
    AND (u.id = auth.uid() OR u.email = (SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1))
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.set_wa_campaign_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_comments_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feed_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feed_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_likes_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feed_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feed_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_app_events_set_campo_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.campo_id IS NULL AND NEW.church_id IS NOT NULL THEN
    SELECT COALESCE(h.field_id, c.headquarters_id)
    INTO NEW.campo_id
    FROM public.churches c
    LEFT JOIN public.headquarters h ON h.id = c.headquarters_id
    WHERE c.id = NEW.church_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_fn_inherit_campo_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_parent TEXT  := TG_ARGV[0];
  v_fk     TEXT  := TG_ARGV[1];
  v_row    JSONB := to_jsonb(NEW);
  v_fk_val UUID;
  v_campo  UUID;
BEGIN
  IF (v_row ->> 'campo_id') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF v_parent IS NOT NULL AND v_fk IS NOT NULL THEN
    BEGIN
      v_fk_val := NULLIF(v_row ->> v_fk, '')::UUID;
    EXCEPTION WHEN others THEN
      v_fk_val := NULL;
    END;

    IF v_fk_val IS NOT NULL THEN
      EXECUTE format('SELECT campo_id FROM public.%I WHERE id = $1 LIMIT 1', v_parent)
         INTO v_campo
        USING v_fk_val;
    END IF;
  END IF;

  IF v_campo IS NULL THEN
    v_campo := public.fn_get_my_campo_id();
  END IF;

  IF v_campo IS NOT NULL THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('campo_id', v_campo));
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_fn_set_campo_id_from_church()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.campo_id IS NULL AND NEW.church_id IS NOT NULL THEN
    SELECT COALESCE(c.headquarters_id, r.campo_id)
      INTO NEW.campo_id
      FROM public.churches c
      LEFT JOIN public.regionais r ON r.id = c.regional_id
     WHERE c.id = NEW.church_id
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_fn_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_livro_caixa_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_santander_accounts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_santander_credentials_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_santander_movimentos_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

