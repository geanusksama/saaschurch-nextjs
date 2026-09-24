-- Gerado por scripts/dump-baseline.mjs em 2026-09-24T17:33:38.065Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 500e39c338ad501d

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

CREATE OR REPLACE FUNCTION public.appv3_alerta_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_titulo text; v_corpo text; v_link text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if tg_table_name = 'appv3_solicitacoes' then
    v_titulo := case new.status
      when 'AGUARDANDO_LINK' then 'Solicitação em andamento'
      when 'LINK_ENVIADO'    then 'Link disponível na Secretaria'
      when 'CONCLUIDA'       then 'Solicitação concluída'
      when 'RECUSADA'        then 'Solicitação recusada'
      when 'CANCELADA'       then 'Solicitação cancelada' end;
    v_corpo := new.tipo || ' · #SEC-' || new.protocolo || coalesce(' — ' || nullif(trim(new.resposta), ''), '');
    v_link := 'secretaria';
    perform public.appv3_alertar(new.perfil_id, 'SEC', v_titulo, v_corpo, v_link);
  elsif tg_table_name = 'appv3_contribuicoes' then
    v_titulo := case new.status
      when 'CONFIRMADA' then case new.tipo when 'DIZIMO' then 'Dízimo confirmado' else 'Oferta confirmada' end
      when 'RECUSADA'   then 'Contribuição não localizada' end;
    -- to_char sai no padrão C (1,234.50); translate troca para 1.234,50
    v_corpo := coalesce(new.descricao || ' · ', '') || 'R$ ' || translate(to_char(new.valor, 'FM999G999G990D00'), ',.', '.,')
               || case when new.status = 'RECUSADA' then ' — procure a tesouraria' else '' end;
    perform public.appv3_alertar(new.perfil_id, 'ORDER', v_titulo, v_corpo, 'contribuicoes');
  elsif tg_table_name = 'appv3_pedidos' then
    v_titulo := case new.status
      when 'PAGO'         then 'Pagamento confirmado'
      when 'EM_SEPARACAO' then 'Pedido em separação'
      when 'ENTREGUE'     then 'Pedido entregue'
      when 'REEMBOLSADO'  then 'Reembolso concluído'
      when 'CANCELADO'    then 'Pedido cancelado' end;
    v_corpo := 'Pedido #' || new.numero;
    perform public.appv3_alertar(new.perfil_id, 'ORDER', v_titulo, v_corpo, 'pedidos');
  elsif tg_table_name = 'appv3_reembolsos' then
    v_titulo := case new.status
      when 'APROVADO' then 'Reembolso aprovado'
      when 'NEGADO'   then 'Reembolso negado'
      when 'PAGO'     then 'Reembolso pago' end;
    v_corpo := new.motivo;
    perform public.appv3_alertar(new.perfil_id, 'ORDER', v_titulo, v_corpo, 'pedidos');
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_alertar(p_perfil uuid, p_tipo text, p_titulo text, p_corpo text, p_link text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.appv3_notificacoes (campo_id, perfil_id, tipo, titulo, corpo, link)
  select p.campo_id, p.id, p_tipo, p_titulo, p_corpo, p_link
    from public.appv3_perfis p
   where p.id = p_perfil and p.excluido_em is null and p_titulo is not null
$function$
;

CREATE OR REPLACE FUNCTION public.appv3_atualizar_contato(p_nome text, p_celular text, p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_buscar_membro(p_campo uuid, p_rol text, p_cpf text, p_telefone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid; v jsonb;
begin
  perform public.appv3_freio_vinculo();
  v_id := public.appv3_localizar_membro(p_campo, p_rol, p_cpf, p_telefone);
  insert into public.appv3_tentativas_vinculo (auth_user_id, sucesso) values (auth.uid(), v_id is not null);
  if v_id is null then return null; end if;

  select jsonb_build_object(
    'nome', m.full_name,
    'cargo', coalesce(et.name, m.ecclesiastical_title),
    'rol', m.rol,
    'status', public.appv3_status_membro(m.membership_status),
    'foto_url', m.photo_url,
    'campo', ca.name,
    'regional', r.name,
    'igreja', c.name,
    'membro_desde', extract(year from m.membership_date)::int,
    'ja_vinculado', exists (select 1 from public.appv3_perfis p where p.member_id = m.id and p.auth_user_id <> auth.uid()))
  into v
  from public.members m
  join public.churches c on c.id = m.church_id
  join public.regionais r on r.id = coalesce(m.regional_id, c.regional_id)
  join public.campos ca on ca.id = coalesce(m.campo_id, r.campo_id)
  left join public.ecclesiastical_titles et on et.id = m.ecclesiastical_title_id
  where m.id = v_id;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_campo_da_igreja(p_church uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.campo_id from public.churches c join public.regionais r on r.id = c.regional_id where c.id = p_church
$function$
;

CREATE OR REPLACE FUNCTION public.appv3_codigo(p_prefixo text)
 RETURNS text
 LANGUAGE sql
AS $function$
  select p_prefixo || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4))
                   || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 5, 4))
$function$
;

CREATE OR REPLACE FUNCTION public.appv3_criar_pedido(p_itens jsonb, p_metodo text, p_parcelas integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  p public.appv3_perfis; it jsonb; ped public.appv3_pedidos; v_item uuid;
  prod public.appv3_produtos; op public.appv3_evento_opcoes; ev public.appv3_eventos;
  v_qtd int; v_total numeric(12,2) := 0; v_cor text; v_tam text; v_status text; v_metodo text;
begin
  select * into p from public.appv3_perfis where auth_user_id = auth.uid();
  if p.id is null then raise exception 'SEM_PERFIL'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'CARRINHO_VAZIO'; end if;
  v_metodo := upper(coalesce(p_metodo, 'PIX'));
  if v_metodo not in ('PIX','CARTAO') then raise exception 'METODO_INVALIDO'; end if;
  if v_metodo = 'PIX' then p_parcelas := 1; end if;

  insert into public.appv3_pedidos (perfil_id, campo_id, church_id, metodo, parcelas, status)
  values (p.id, p.campo_id, p.church_id, v_metodo, greatest(1, least(coalesce(p_parcelas, 1), 3)), 'AGUARDANDO_PAGAMENTO')
  returning * into ped;

  for it in select * from jsonb_array_elements(p_itens) loop
    v_qtd := greatest(1, coalesce((it->>'quantidade')::int, 1));
    if it->>'tipo' = 'PRODUTO' then
      select * into prod from public.appv3_produtos where id = (it->>'produto_id')::uuid and ativo and campo_id = p.campo_id;
      if prod.id is null then raise exception 'PRODUTO_INDISPONIVEL'; end if;
      v_tam := nullif(it->>'tamanho', '');
      if v_tam is not null and not (v_tam = any(prod.tamanhos)) then raise exception 'TAMANHO_INVALIDO'; end if;
      select nome into v_cor from public.appv3_produto_cores where id = nullif(it->>'cor_id', '')::uuid and produto_id = prod.id;
      insert into public.appv3_pedido_itens (pedido_id, tipo, produto_id, nome, variante, tamanho, cor, quantidade, preco_unit, total)
      values (ped.id, 'PRODUTO', prod.id, prod.nome,
              nullif(concat_ws(' · ', 'Tamanho ' || v_tam, v_cor), ''), v_tam, v_cor, v_qtd, prod.preco, prod.preco * v_qtd);
      v_total := v_total + prod.preco * v_qtd;
    elsif it->>'tipo' = 'INGRESSO' then
      select * into op from public.appv3_evento_opcoes where id = (it->>'opcao_id')::uuid and ativo;
      select * into ev from public.appv3_eventos where id = op.evento_id and publicado and escopo = 'CAMPO' and campo_id = p.campo_id
        for update;
      if op.id is null or ev.id is null then raise exception 'EVENTO_INDISPONIVEL'; end if;
      if ev.capacidade is not null and ev.vendidos + v_qtd > ev.capacidade then raise exception 'EVENTO_ESGOTADO'; end if;
      update public.appv3_eventos set vendidos = vendidos + v_qtd where id = ev.id;
      insert into public.appv3_pedido_itens (pedido_id, tipo, evento_id, opcao_id, nome, variante, quantidade, preco_unit, total)
      values (ped.id, 'INGRESSO', ev.id, op.id, coalesce(ev.titulo_curto, ev.titulo), op.rotulo, v_qtd, op.preco, op.preco * v_qtd)
      returning id into v_item;
      insert into public.appv3_ingressos (pedido_id, item_id, perfil_id, evento_id, opcao_id, codigo, rotulo, quantidade, valor_pago, status, reembolso_ate)
      values (ped.id, v_item, p.id, ev.id, op.id, public.appv3_codigo('ING'),
              op.rotulo || ' · ' || v_qtd || case when v_qtd > 1 then ' ingressos' else ' ingresso' end,
              v_qtd, op.preco * v_qtd,
              case when op.preco = 0 then 'ATIVO' else 'AGUARDANDO_PAGAMENTO' end,
              case when op.preco > 0 then ev.inicio - make_interval(hours => ev.reembolso_ate_horas) end);
      v_total := v_total + op.preco * v_qtd;
    else
      raise exception 'ITEM_INVALIDO';
    end if;
  end loop;

  v_status := case when v_total = 0 then 'PAGO' else 'AGUARDANDO_PAGAMENTO' end;
  update public.appv3_pedidos
     set subtotal = v_total, total = v_total, status = v_status,
         metodo = case when v_total = 0 then 'GRATUITO' else metodo end,
         pix_txid = 'PED' || numero, pago_em = case when v_total = 0 then now() end
   where id = ped.id returning * into ped;
  return to_jsonb(ped);
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_criar_perfil(p_campo uuid, p_regional uuid, p_igreja uuid, p_nome text, p_celular text)
 RETURNS appv3_perfis
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.appv3_perfis; v_email text;
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO'; end if;
  if not exists (select 1 from public.churches c join public.regionais r on r.id = c.regional_id
                  where c.id = p_igreja and r.id = p_regional and r.campo_id = p_campo) then
    raise exception 'IGREJA_INVALIDA';
  end if;
  select email into v_email from auth.users where id = auth.uid();

  insert into public.appv3_perfis (auth_user_id, campo_id, regional_id, church_id, nome, celular, email)
  values (auth.uid(), p_campo, p_regional, p_igreja, coalesce(nullif(trim(p_nome), ''), split_part(v_email, '@', 1)),
          nullif(trim(p_celular), ''), v_email)
  on conflict (auth_user_id) do update
     set campo_id    = case when appv3_perfis.member_id is null then excluded.campo_id else appv3_perfis.campo_id end,
         regional_id = case when appv3_perfis.member_id is null then excluded.regional_id else appv3_perfis.regional_id end,
         church_id   = case when appv3_perfis.member_id is null then excluded.church_id else appv3_perfis.church_id end,
         nome        = case when nullif(trim(p_nome), '') is null then appv3_perfis.nome else excluded.nome end,
         celular     = coalesce(excluded.celular, appv3_perfis.celular),
         email       = excluded.email,
         atualizado_em = now()
  returning * into p;
  return p;
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_digitos(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$ select regexp_replace(coalesce(t, ''), '\D', '', 'g') $function$
;

CREATE OR REPLACE FUNCTION public.appv3_diretorio(p_q text DEFAULT NULL::text, p_regional uuid DEFAULT NULL::uuid, p_filtro text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu public.appv3_perfis;
begin
  select * into eu from public.appv3_perfis where auth_user_id = auth.uid();
  if eu.id is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(public.appv3_linha_diretorio(pp.id, eu.id) order by pp.nome)
      from (select pp.* from public.appv3_perfis pp
             where pp.campo_id = eu.campo_id and pp.id <> eu.id and pp.publico
               and (p_regional is null or pp.regional_id = p_regional)
               and (coalesce(trim(p_q), '') = '' or pp.nome ilike '%' || trim(p_q) || '%')
               and (p_filtro is null
                    or (p_filtro = 'SEGUIDORES' and exists (select 1 from public.appv3_seguidores s where s.seguidor_id = pp.id and s.seguido_id = eu.id))
                    or (p_filtro = 'SEGUINDO' and exists (select 1 from public.appv3_seguidores s where s.seguidor_id = eu.id and s.seguido_id = pp.id)))
             order by pp.nome limit 200) pp), '[]'::jsonb);
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_ebd_turmas()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.appv3_perfis;
begin
  select * into p from public.appv3_perfis where auth_user_id = auth.uid();
  if p.id is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'nome', t.nome, 'professor', t.professor, 'sala', t.sala,
      'alunos', (select count(*) from public.appv3_ebd_matriculas m where m.turma_id = t.id and m.status <> 'CANCELADA'),
      'minha', exists (select 1 from public.appv3_ebd_matriculas m where m.turma_id = t.id and m.perfil_id = p.id and m.status <> 'CANCELADA'),
      'nomes', coalesce((select jsonb_agg(x.nome) from (
                  select pp.nome from public.appv3_ebd_matriculas m join public.appv3_perfis pp on pp.id = m.perfil_id
                   where m.turma_id = t.id and m.status <> 'CANCELADA' and pp.id <> p.id order by m.criado_em limit 7) x), '[]'::jsonb))
      order by t.ordem, t.nome)
    from public.appv3_ebd_turmas t
    where t.ativo and t.campo_id = p.campo_id and (t.church_id is null or t.church_id = p.church_id)), '[]'::jsonb);
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_estrutura_publica()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with igrejas as (
    select c.id, c.regional_id, c.address_city, c.address_state,
           case when count(*) over (partition by c.regional_id, lower(c.name)) > 1 and c.periodo in ('M','T','N')
                then c.name || ' · ' || case c.periodo when 'M' then 'Manhã' when 'T' then 'Tarde' else 'Noite' end
                else c.name end as nome
      from public.churches c
     where c.deleted_at is null and coalesce(c.status, 'active') <> 'inactive'
  )
  select coalesce(jsonb_agg(x order by x->>'nome'), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', ca.id,
      'nome', ca.name,
      'codigo', ca.code,
      'cidade', coalesce(
        (select h.city || coalesce(', ' || h.state, '') from public.headquarters h where h.field_id = ca.id and h.city is not null limit 1),
        (select i.address_city || coalesce(', ' || i.address_state, '') from igrejas i join public.regionais r on r.id = i.regional_id
          where r.campo_id = ca.id and i.address_city is not null group by 1 order by count(*) desc limit 1)),
      'regionais', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', r.id, 'nome', r.name,
                 'igrejas', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'nome', i.nome, 'cidade', i.address_city) order by i.nome)
                                        from igrejas i where i.regional_id = r.id), '[]'::jsonb))
               order by r.name)
          from public.regionais r where r.campo_id = ca.id and r.deleted_at is null), '[]'::jsonb)
    ) x
    from public.campos ca where ca.deleted_at is null
  ) s
$function$
;

CREATE OR REPLACE FUNCTION public.appv3_excluir_conta()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_sistema boolean;
  p public.appv3_perfis;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  select email into v_email from auth.users where id = v_uid;
  v_sistema := exists (select 1 from public.users u
                        where u.deleted_at is null and lower(u.email) = lower(v_email));

  select * into p from public.appv3_perfis where auth_user_id = v_uid for update;
  if p.id is not null then
    delete from public.appv3_status where perfil_id = p.id;
    delete from public.appv3_seguidores where seguidor_id = p.id or seguido_id = p.id;
    delete from public.appv3_familiares where perfil_id = p.id;
    delete from public.appv3_biblia_salvos where perfil_id = p.id;
    delete from public.appv3_biblia_anotacoes where perfil_id = p.id;
    delete from public.appv3_jogos_pontos where perfil_id = p.id;
    delete from public.appv3_notificacao_leituras where perfil_id = p.id;
    delete from public.appv3_notificacoes where perfil_id = p.id;
    delete from public.appv3_cartoes where perfil_id = p.id;
    delete from public.appv3_ebd_matriculas where perfil_id = p.id;
    update public.appv3_perfis
       set auth_user_id = gen_random_uuid(), member_id = null, nome = 'Conta excluída',
           celular = null, email = null, avatar_url = null, capa_url = null,
           publico = false, notificacoes = false, excluido_em = now(), atualizado_em = now()
     where id = p.id;
  end if;
  delete from public.appv3_tentativas_vinculo where auth_user_id = v_uid;

  if not v_sistema then
    begin
      delete from auth.users where id = v_uid;
    exception when foreign_key_violation then
      delete from auth.sessions where user_id = v_uid;
      delete from auth.identities where user_id = v_uid;
      update auth.users
         set email = 'excluido.' || v_uid || '@conta-excluida.invalid', phone = null,
             encrypted_password = null, raw_user_meta_data = '{}'::jsonb,
             banned_until = now() + interval '100 years'
       where id = v_uid;
    end;
  end if;
  return jsonb_build_object('conta_sistema_mantida', v_sistema);
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_faceid_cadastrar(p_foto text, p_atualizar boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  p public.appv3_perfis;
  m public.members;
  v_batch uuid;
  v_prefixo text;
  v_n int;
begin
  select * into p from public.appv3_perfis where auth_user_id = auth.uid();
  if p.id is null then raise exception 'SEM_PERFIL'; end if;
  if p.member_id is null then raise exception 'FACEID_SEM_VINCULO'; end if;
  select * into m from public.members where id = p.member_id;
  if m.rol is null then raise exception 'FACEID_SEM_ROL'; end if;
  if m.church_id is null then raise exception 'FACEID_SEM_IGREJA'; end if;

  -- A foto precisa estar na pasta do próprio membro e já ter sido enviada.
  v_prefixo := 'faceid/enroll/' || m.id::text || '/';
  if p_foto is null or left(p_foto, length(v_prefixo)) <> v_prefixo
     or p_foto !~ '^faceid/enroll/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png)$' then
    raise exception 'FACEID_FOTO_INVALIDA';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'dados' and o.name = p_foto) then
    raise exception 'FACEID_FOTO_INVALIDA';
  end if;
  v_batch := substring(p_foto from '([0-9a-f-]{36})\.(?:jpg|png)$')::uuid;

  -- Leitores: os da Sede + os da igreja do membro (primária ou secundária),
  -- ativos e com host local, sem repetir.
  insert into public.face_enrollment_jobs (id, batch_id, church_id, device_id, member_id, rol, nome, cpf, photo_url, status, allow_update, updated_at)
  select gen_random_uuid(), v_batch, coalesce(d.church_id, m.church_id), d.id, m.id, m.rol, m.full_name, m.cpf, p_foto, 'pending', coalesce(p_atualizar, false), now()
    from public.faceid_devices d
   where d.is_active and nullif(d.local_host, '') is not null
     and (d.is_sede or d.church_id = m.church_id or d.secondary_church_id = m.church_id);
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'FACEID_SEM_LEITOR'; end if;

  return jsonb_build_object('batch_id', v_batch, 'status', 'pending', 'devices', v_n);
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_faceid_status(p_batch uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_member uuid; v_batch uuid;
begin
  select member_id into v_member from public.appv3_perfis where auth_user_id = auth.uid();
  if v_member is null then return jsonb_build_object('batch_id', null, 'jobs', '[]'::jsonb); end if;
  v_batch := coalesce(p_batch, (select j.batch_id from public.face_enrollment_jobs j where j.member_id = v_member order by j.created_at desc limit 1));
  return jsonb_build_object(
    'batch_id', v_batch,
    'foto_perfil', (select photo_url from public.members where id = v_member),
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', j.id, 'status', j.status, 'rol', j.rol, 'error_code', j.error_code, 'error_message', j.error_message,
        'match_user_id', j.match_user_id, 'leitor', coalesce(d.name, 'Leitor')) order by j.created_at)
        from public.face_enrollment_jobs j
        left join public.faceid_devices d on d.id = j.device_id
       where j.member_id = v_member and j.batch_id = v_batch), '[]'::jsonb));
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_familia_cadastro()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_freio_vinculo()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO'; end if;
  if (select count(*) from public.appv3_tentativas_vinculo
       where auth_user_id = auth.uid() and criado_em > now() - interval '1 hour') >= 5 then
    raise exception 'LIMITE_TENTATIVAS';
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_grupos_familiares()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_campo uuid := public.appv3_meu_campo_id();
begin
  if v_campo is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id, 'nome', g.name, 'descricao', g.description, 'categoria', g.cell_type,
      'dia', g.meeting_day, 'hora', to_char(g.meeting_time, 'HH24:MI'),
      'rua', coalesce(nullif(concat_ws(', ', g.address_street, g.address_number), ''), g.address),
      'bairro', g.address_neighborhood, 'cidade', g.address_city,
      'latitude', g.latitude, 'longitude', g.longitude, 'foto_url', g.photo,
      'igreja', c.name,
      'participantes', (select count(*) from public.cell_group_members gm where gm.cell_group_id = g.id and gm.is_active),
      'lideres', coalesce((select jsonb_agg(jsonb_build_object('nome', m.full_name, 'telefone', coalesce(m.mobile, m.phone)) order by gl.position)
                             from public.cell_group_leaders gl join public.members m on m.id = gl.member_id
                            where gl.cell_group_id = g.id),
                          (select jsonb_build_array(jsonb_build_object('nome', m.full_name, 'telefone', coalesce(m.mobile, m.phone)))
                             from public.members m where m.id = g.leader_id),
                          '[]'::jsonb))
      order by g.name)
    from public.cell_groups g
    join public.churches c on c.id = g.church_id
    join public.regionais r on r.id = c.regional_id
    where r.campo_id = v_campo and g.deleted_at is null and coalesce(g.status, 'active') = 'active'), '[]'::jsonb);
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_informar_pix_pedido(p_pedido uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ped public.appv3_pedidos;
begin
  update public.appv3_pedidos set status = 'AGUARDANDO_CONFERENCIA'
   where id = p_pedido and perfil_id = public.appv3_meu_perfil_id() and status = 'AGUARDANDO_PAGAMENTO' and metodo = 'PIX'
  returning * into ped;
  if ped.id is null then raise exception 'PEDIDO_INVALIDO'; end if;
  return to_jsonb(ped);
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_linha_diretorio(p_alvo uuid, p_eu uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'perfil_id', pp.id,
    'nome', coalesce(m.full_name, pp.nome),
    'avatar_url', coalesce(pp.avatar_url, m.photo_url),
    'capa_url', coalesce(pp.capa_url, m.cover_photo_url),
    'cargo', coalesce(et.name, m.ecclesiastical_title, 'Visitante'),
    'igreja', c.name, 'regional', r.name, 'regional_id', r.id, 'campo', ca.name,
    'membro_desde', extract(year from m.membership_date)::int,
    'ministerio', (select mi.name from public.ministry_members mm join public.ministries mi on mi.id = mm.ministry_id
                    where mm.member_id = m.id and mm.is_active order by mm.joined_at limit 1),
    'status_24h', (select jsonb_build_object('texto', s.texto, 'expira_em', s.expira_em) from public.appv3_status s
                    where s.perfil_id = pp.id and s.expira_em > now()),
    'seguindo', exists (select 1 from public.appv3_seguidores s where s.seguidor_id = p_eu and s.seguido_id = pp.id),
    'segue_voce', exists (select 1 from public.appv3_seguidores s where s.seguidor_id = pp.id and s.seguido_id = p_eu),
    'seguidores', (select count(*) from public.appv3_seguidores s where s.seguido_id = pp.id),
    'seguindo_total', (select count(*) from public.appv3_seguidores s where s.seguidor_id = pp.id))
  from public.appv3_perfis pp
  join public.campos ca on ca.id = pp.campo_id
  left join public.members m on m.id = pp.member_id
  left join public.ecclesiastical_titles et on et.id = m.ecclesiastical_title_id
  left join public.churches c on c.id = pp.church_id
  left join public.regionais r on r.id = pp.regional_id
  where pp.id = p_alvo
$function$
;

CREATE OR REPLACE FUNCTION public.appv3_localizar_membro(p_campo uuid, p_rol text, p_cpf text, p_telefone text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select m.id
    from public.members m
    join public.churches c on c.id = m.church_id
    join public.regionais r on r.id = coalesce(m.regional_id, c.regional_id)
   where m.deleted_at is null
     and m.rol = nullif(public.appv3_digitos(p_rol), '')::int
     and public.appv3_digitos(m.cpf) = public.appv3_digitos(p_cpf)
     and length(public.appv3_digitos(p_telefone)) >= 8
     and (right(public.appv3_digitos(m.mobile), 8) = right(public.appv3_digitos(p_telefone), 8)
          or right(public.appv3_digitos(m.phone), 8) = right(public.appv3_digitos(p_telefone), 8))
     and coalesce(m.campo_id, r.campo_id) = p_campo
   limit 1
$function$
;

CREATE OR REPLACE FUNCTION public.appv3_meu_campo_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select campo_id from public.appv3_perfis where auth_user_id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.appv3_meu_cartao()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.appv3_perfis; v jsonb;
begin
  select * into p from public.appv3_perfis where auth_user_id = auth.uid();
  if p.id is null then return null; end if;

  select jsonb_build_object(
    'perfil_id', p.id,
    'nome', coalesce(m.full_name, p.nome),
    'email', coalesce(p.email, m.email),
    'celular', coalesce(p.celular, m.mobile, m.phone),
    'avatar_url', coalesce(p.avatar_url, m.photo_url),
    'capa_url', coalesce(p.capa_url, m.cover_photo_url),
    'notificacoes', p.notificacoes,
    'publico', p.publico,
    'vinculado', p.member_id is not null,
    'member_id', p.member_id,
    'campo_id', p.campo_id, 'campo', ca.name,
    'regional_id', p.regional_id, 'regional', r.name,
    'church_id', p.church_id, 'igreja', c.name,
    'cidade', nullif(concat_ws(', ', c.address_city, c.address_state), ''),
    'cargo', coalesce(et.name, m.ecclesiastical_title),
    'status', public.appv3_status_membro(m.membership_status),
    'rol', m.rol,
    'membro_desde', extract(year from m.membership_date)::int,
    'nascimento', m.birth_date,
    'estado_civil', m.marital_status,
    'endereco', nullif(concat_ws(', ', nullif(concat_ws(', ', m.address_street, m.address_number), ''), m.address_neighborhood), ''),
    'batismo_data', coalesce(m.baptism_date, (select b.baptism_date from public.baptisms b where b.member_id = m.id and b.deleted_at is null order by b.baptism_date desc limit 1)),
    'batismo_local', (select b.location from public.baptisms b where b.member_id = m.id and b.deleted_at is null order by b.baptism_date desc limit 1),
    'seguidores', (select count(*) from public.appv3_seguidores s where s.seguido_id = p.id),
    'seguindo', (select count(*) from public.appv3_seguidores s where s.seguidor_id = p.id),
    'pedidos', (select count(*) from public.appv3_pedidos x where x.perfil_id = p.id),
    'ingressos_ativos', (select count(*) from public.appv3_ingressos x where x.perfil_id = p.id and x.status in ('ATIVO','AGUARDANDO_PAGAMENTO')),
    'solicitacoes_abertas', (select count(*) from public.appv3_solicitacoes x where x.perfil_id = p.id and x.status in ('EM_ANALISE','AGUARDANDO_LINK')),
    'contribuicoes', (select count(*) from public.appv3_contribuicoes x where x.perfil_id = p.id),
    'pontos', (select coalesce(sum(pontos), 0) from public.appv3_jogos_pontos x where x.perfil_id = p.id),
    'status_24h', (select to_jsonb(s) from public.appv3_status s where s.perfil_id = p.id and s.expira_em > now()))
  into v
  from public.campos ca
  left join public.regionais r on r.id = p.regional_id
  left join public.churches c on c.id = p.church_id
  left join public.members m on m.id = p.member_id
  left join public.ecclesiastical_titles et on et.id = m.ecclesiastical_title_id
  where ca.id = p.campo_id;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_meu_perfil_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id from public.appv3_perfis where auth_user_id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.appv3_minha_igreja()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.appv3_perfis; c public.churches; h public.headquarters;
begin
  select * into p from public.appv3_perfis where auth_user_id = auth.uid();
  if p.id is null then return null; end if;
  select * into c from public.churches where id = p.church_id;
  -- Sede do campo definida no painel (Mobile › Configurações); sem ela, a
  -- sede da igreja da pessoa e, por último, a primeira do campo.
  select hq.* into h from public.appv3_campo_config cc join public.headquarters hq on hq.id = cc.headquarters_id
   where cc.campo_id = p.campo_id;
  if h.id is null then
    select * into h from public.headquarters where id = c.headquarters_id;
  end if;
  if h.id is null then
    select * into h from public.headquarters where field_id = p.campo_id order by created_at limit 1;
  end if;

  return jsonb_build_object(
    'igreja', jsonb_build_object(
      'id', c.id, 'nome', c.name,
      'rua', nullif(concat_ws(', ', c.address_street, c.address_number), ''),
      'bairro', c.address_neighborhood, 'cidade', c.address_city, 'uf', c.address_state,
      'latitude', c.latitude, 'longitude', c.longitude,
      'telefone', coalesce(c.phone, h.contact), 'whatsapp', coalesce(c.whatsapp, h.whatsapp),
      'email', coalesce(c.email, h.email), 'site', coalesce(c.website, h.site),
      'logo_url', c.logo_url),
    'sede', case when h.id is null then null else jsonb_build_object(
      'id', h.id, 'nome', h.name, 'instagram', h.instagram, 'youtube', h.youtube, 'facebook', h.facebook,
      'rua', nullif(concat_ws(', ', h.street, h.number), ''), 'bairro', h.neighborhood, 'cidade', h.city, 'uf', h.state,
      'cnpj', h.cnpj) end,
    'campo', (select jsonb_build_object('id', ca.id, 'nome', ca.name) from public.campos ca where ca.id = p.campo_id),
    'cultos', coalesce((select jsonb_agg(jsonb_build_object('dia', s.day_of_week, 'nome', s.name, 'hora', s.time) order by s."order")
                          from public.church_schedule s where s.headquarters_id = h.id), '[]'::jsonb),
    'perfil', (select to_jsonb(ip) from public.appv3_igreja_perfil ip where ip.church_id = c.id)
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_ministerios()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.appv3_perfis;
begin
  select * into p from public.appv3_perfis where auth_user_id = auth.uid();
  if p.id is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(x order by x->>'nome') from (
      select distinct on (lower(mi.name)) jsonb_build_object(
        'id', mi.id, 'nome', mi.name, 'descricao', mi.description, 'cor', mi.color, 'icone', mi.icon,
        'lider', lm.full_name, 'publico', inf.publico, 'agenda', inf.agenda, 'imagem_url', inf.imagem_url) x
      from public.ministries mi
      left join public.churches c on c.id = mi.church_id
      left join public.regionais r on r.id = c.regional_id
      left join public.members lm on lm.id = mi.leader_id
      left join public.appv3_ministerio_info inf on inf.ministry_id = mi.id
      where mi.is_active and mi.deleted_at is null
        and (mi.campo_id = p.campo_id or r.campo_id = p.campo_id)
      order by lower(mi.name), (mi.church_id = p.church_id) desc nulls last, mi.created_at
    ) s), '[]'::jsonb);
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_mundial_publico(p_campo uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m public.appv3_igreja_mundial;
begin
  if p_campo is not null then
    select * into m from public.appv3_igreja_mundial where chave = p_campo::text and ativo;
  end if;
  if m.id is null then
    select * into m from public.appv3_igreja_mundial where chave = 'padrao' and ativo;
  end if;
  if m.id is null then return null; end if;

  return jsonb_build_object(
    'mundial', to_jsonb(m),
    'lideres', coalesce((select jsonb_agg(to_jsonb(l) order by l.ordem) from public.appv3_mundial_lideres l
                          where l.mundial_id = m.id and l.ativo), '[]'::jsonb),
    'recursos', coalesce((select jsonb_agg(to_jsonb(r) order by r.ordem) from public.appv3_mundial_recursos r
                           where r.mundial_id = m.id and r.ativo), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(to_jsonb(e) order by e.inicio) from public.appv3_eventos e
                          where e.mundial_id = m.id and e.escopo = 'MUNDIAL' and e.publicado
                            and coalesce(e.fim, e.inicio) >= now() - interval '1 day'), '[]'::jsonb),
    'noticias', coalesce((select jsonb_agg(to_jsonb(n) order by n.publicado_em desc) from (
                            select * from public.appv3_noticias
                             where mundial_id = m.id and escopo = 'MUNDIAL' and publicado
                             order by publicado_em desc limit 10) n), '[]'::jsonb),
    'pix', coalesce((select jsonb_agg(to_jsonb(p) order by p.finalidade, p.ordem) from public.appv3_pix_config p
                      where p.mundial_id = m.id and p.escopo = 'MUNDIAL' and p.ativo), '[]'::jsonb)
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_perfil_publico(p_perfil uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eu public.appv3_perfis;
begin
  select * into eu from public.appv3_perfis where auth_user_id = auth.uid();
  if eu.id is null or not exists (select 1 from public.appv3_perfis
                                   where id = p_perfil and campo_id = eu.campo_id and (publico or id = eu.id)) then
    return null;
  end if;
  return public.appv3_linha_diretorio(p_perfil, eu.id);
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_preencher_perfil()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_table_name = 'appv3_seguidores' then
    new.seguidor_id := coalesce(new.seguidor_id, public.appv3_meu_perfil_id());
  else
    new.perfil_id := coalesce(new.perfil_id, public.appv3_meu_perfil_id());
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_registrar_contribuicao(p_tipo text, p_valor numeric, p_descricao text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.appv3_perfis; c public.appv3_contribuicoes; v_tipo text := upper(p_tipo);
begin
  select * into p from public.appv3_perfis where auth_user_id = auth.uid();
  if p.id is null then raise exception 'SEM_PERFIL'; end if;
  if v_tipo not in ('DIZIMO','OFERTA') then raise exception 'TIPO_INVALIDO'; end if;
  if p_valor is null or p_valor <= 0 or p_valor > 100000 then raise exception 'VALOR_INVALIDO'; end if;
  insert into public.appv3_contribuicoes (perfil_id, campo_id, church_id, member_id, tipo, valor, descricao, metodo, autenticacao)
  values (p.id, p.campo_id, p.church_id, p.member_id, v_tipo, round(p_valor, 2),
          coalesce(left(nullif(trim(p_descricao), ''), 120),
                   case when v_tipo = 'DIZIMO'
                        then 'Dízimo de ' || (array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto',
                                                    'setembro','outubro','novembro','dezembro'])[extract(month from now())::int]
                        else 'Oferta voluntária' end),
          'PIX',
          public.appv3_codigo(case when v_tipo = 'DIZIMO' then 'DZ' else 'OF' end))
  returning * into c;
  update public.appv3_contribuicoes set pix_txid = replace(autenticacao, '-', '') where id = c.id returning * into c;
  return to_jsonb(c);
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_solicitacoes_preencher()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.appv3_perfis;
begin
  select * into p from public.appv3_perfis where id = new.perfil_id;
  new.campo_id  := p.campo_id;
  new.church_id := p.church_id;
  new.member_id := p.member_id;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_solicitar_reembolso(p_pedido uuid, p_ingresso uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_perfil uuid := public.appv3_meu_perfil_id(); ped public.appv3_pedidos; ing public.appv3_ingressos; r public.appv3_reembolsos;
begin
  if coalesce(trim(p_motivo), '') = '' then raise exception 'MOTIVO_OBRIGATORIO'; end if;
  if p_ingresso is not null then
    select * into ing from public.appv3_ingressos where id = p_ingresso and perfil_id = v_perfil for update;
    if ing.id is null or ing.status <> 'ATIVO' or ing.reembolso_ate is null or ing.reembolso_ate < now() then
      raise exception 'REEMBOLSO_FORA_DO_PRAZO';
    end if;
    update public.appv3_ingressos set status = 'REEMBOLSO_SOLICITADO' where id = ing.id;
    insert into public.appv3_reembolsos (perfil_id, ingresso_id, motivo, valor) values (v_perfil, ing.id, p_motivo, ing.valor_pago)
    returning * into r;
  else
    select * into ped from public.appv3_pedidos where id = p_pedido and perfil_id = v_perfil for update;
    if ped.id is null or ped.status not in ('PAGO','AGUARDANDO_CONFERENCIA','EM_SEPARACAO','ENTREGUE')
       or ped.criado_em < now() - interval '7 days' then
      raise exception 'REEMBOLSO_FORA_DO_PRAZO';
    end if;
    update public.appv3_pedidos set status = 'REEMBOLSO_SOLICITADO' where id = ped.id;
    insert into public.appv3_reembolsos (perfil_id, pedido_id, motivo, valor) values (v_perfil, ped.id, p_motivo, ped.total)
    returning * into r;
  end if;
  return to_jsonb(r);
end $function$
;

CREATE OR REPLACE FUNCTION public.appv3_status_membro(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when t is null then null
    when upper(translate(t, 'ÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç', 'AAAAEEIOOOUCaaaaeeiooouc')) like 'ATIV%' then 'ATIVO'
    else upper(t) end
$function$
;

CREATE OR REPLACE FUNCTION public.appv3_vincular_membro(p_campo uuid, p_rol text, p_cpf text, p_telefone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid; m public.members; v_regional uuid; v_campo uuid; v_email text;
begin
  perform public.appv3_freio_vinculo();
  v_id := public.appv3_localizar_membro(p_campo, p_rol, p_cpf, p_telefone);
  insert into public.appv3_tentativas_vinculo (auth_user_id, sucesso) values (auth.uid(), v_id is not null);
  if v_id is null then raise exception 'MEMBRO_NAO_ENCONTRADO'; end if;
  if exists (select 1 from public.appv3_perfis where member_id = v_id and auth_user_id <> auth.uid()) then
    raise exception 'MEMBRO_JA_VINCULADO';
  end if;

  select * into m from public.members where id = v_id;
  select c.regional_id into v_regional from public.churches c where c.id = m.church_id;
  v_regional := coalesce(m.regional_id, v_regional);
  select coalesce(m.campo_id, r.campo_id) into v_campo from public.regionais r where r.id = v_regional;
  select email into v_email from auth.users where id = auth.uid();

  insert into public.appv3_perfis (auth_user_id, campo_id, regional_id, church_id, member_id, nome, celular, email, vinculado_em)
  values (auth.uid(), v_campo, v_regional, m.church_id, m.id, m.full_name, coalesce(m.mobile, m.phone), v_email, now())
  on conflict (auth_user_id) do update
     set campo_id = excluded.campo_id, regional_id = excluded.regional_id, church_id = excluded.church_id,
         member_id = excluded.member_id, nome = excluded.nome,
         celular = coalesce(appv3_perfis.celular, excluded.celular),
         vinculado_em = now(), atualizado_em = now();

  return public.appv3_meu_cartao();
end $function$
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

CREATE OR REPLACE FUNCTION public.fn_usuario_sistema()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.users u
     where u.deleted_at is null
       and u.profile_type in ('master', 'admin', 'campo', 'church')
       and lower(u.email) = lower(nullif(auth.jwt() ->> 'email', '')))
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

