/**
 * Acesso de servidor às páginas de departamento.
 *
 * Usa `supabaseAdmin` (service_role), que faz bypass de RLS — então TODA
 * consulta aqui filtra `campo_id` explicitamente. O tenant vem do usuário
 * autenticado (CMS) ou do slug publicado (portal público); nunca do corpo da
 * requisição.
 */
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { DepartmentSite, SiteBlock } from "@/lib/departmentSiteSchema";

const SITE_COLS =
  "id, campo_id, department_id, slug, titulo, subtitulo, descricao, logo_url, favicon_url, " +
  "cor_primaria, cor_secundaria, cor_destaque, tema, preset, tokens_override, " +
  "seo_title, seo_description, og_image_url, payment_link, whatsapp_number, instagram, youtube, " +
  "status, published_at";

const BLOCK_COLS = "id, site_id, tipo, variante, ordem, props, props_publicado, visivel";

export interface SiteWithBlocks {
  site: DepartmentSite;
  blocks: SiteBlock[];
  departamento: { id: string; name: string; color: string | null; icon: string | null } | null;
}

/** Lista os sites de um campo, com o nome do ministério (departamento). */
export async function listSites(campoId: string) {
  const { data, error } = await supabaseAdmin
    .from("department_sites")
    .select(`${SITE_COLS}, ministries!department_sites_department_id_fkey(id, name, color, icon)`)
    .eq("campo_id", campoId)
    .is("deleted_at", null)
    .order("titulo");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Carrega um site do CMS. Devolve null se não pertencer ao campo informado. */
export async function getSiteForCampo(siteId: string, campoId: string): Promise<SiteWithBlocks | null> {
  const { data: site, error } = await supabaseAdmin
    .from("department_sites")
    .select(`${SITE_COLS}, ministries!department_sites_department_id_fkey(id, name, color, icon)`)
    .eq("id", siteId)
    .eq("campo_id", campoId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!site) return null;

  const { data: blocks, error: bErr } = await supabaseAdmin
    .from("department_site_blocks")
    .select(BLOCK_COLS)
    .eq("site_id", siteId)
    .order("ordem");
  if (bErr) throw new Error(bErr.message);

  const { ministries, ...rest } = site as Record<string, unknown> & { ministries?: unknown };
  return {
    site: rest as unknown as DepartmentSite,
    blocks: (blocks ?? []) as SiteBlock[],
    departamento: (ministries ?? null) as SiteWithBlocks["departamento"],
  };
}

/**
 * Carrega o site publicado a partir do slug — a rota pública `/jovens`.
 *
 * `campoId` restringe a busca ao tenant do domínio. Sem ele, dois campos com o
 * mesmo slug ("jovens") colidiriam e um veria a página do outro.
 */
export async function getPublishedSiteBySlug(
  slug: string,
  campoId?: string | null,
): Promise<SiteWithBlocks | null> {
  let q = supabaseAdmin
    .from("department_sites")
    .select(`${SITE_COLS}, ministries!department_sites_department_id_fkey(id, name, color, icon)`)
    .ilike("slug", slug)
    .eq("status", "PUBLICADO")
    .is("deleted_at", null);
  if (campoId) q = q.eq("campo_id", campoId);

  const { data, error } = await q.limit(1);
  if (error) throw new Error(error.message);
  const site = data?.[0];
  if (!site) return null;

  const { data: blocks } = await supabaseAdmin
    .from("department_site_blocks")
    .select(BLOCK_COLS)
    .eq("site_id", site.id)
    .eq("visivel", true)
    .order("ordem");

  const { ministries, ...rest } = site as Record<string, unknown> & { ministries?: unknown };
  return {
    site: rest as unknown as DepartmentSite,
    blocks: (blocks ?? []) as SiteBlock[],
    departamento: (ministries ?? null) as SiteWithBlocks["departamento"],
  };
}

/** Linha de `app_events` usada pelo portal. A tabela tem colunas duplicadas
 *  (nome/title, descricao/description) por convivência entre o app e o MRM. */
interface AppEventRow {
  id: string;
  nome: string | null;
  title: string | null;
  descricao: string | null;
  description: string | null;
  banner_url: string | null;
  imagem_url: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  local: string | null;
  local_endereco: string | null;
  preco: number | null;
  default_price: number | null;
  gratuito: boolean | null;
  status: string | null;
  capacidade_total: number | null;
}

/** Configuração de inscrição de um evento (`department_event_forms`). */
interface EventFormRow {
  id: string;
  event_id: string;
  inscricoes_de: string | null;
  inscricoes_ate: string | null;
  vagas_total: number | null;
  vagas_por_pessoa: number | null;
  valor: number | null;
  gratuito: boolean | null;
  payment_link: string | null;
  campos_extras: unknown;
  mensagem_confirmacao: string | null;
  instrucoes_pagamento: string | null;
  ativo: boolean | null;
}

/**
 * Eventos do departamento, já classificados em abertos e encerrados.
 *
 * A regra do botão de inscrição mora aqui: um evento só aceita inscrição se
 * estiver dentro da janela do formulário e ainda houver vaga. Quem já passou
 * disso vai para `historico` e some da chamada para ação.
 */
export async function getDepartmentEvents(departmentId: string, campoId: string) {
  // O client do Supabase não conhece o schema (sem tipos gerados), então a
  // forma da linha é declarada aqui via .returns<>().
  const { data: eventos } = await supabaseAdmin
    .from("app_events")
    .select("id, nome, title, descricao, description, banner_url, imagem_url, data_inicio, data_fim, " +
            "local, local_endereco, preco, default_price, gratuito, status, capacidade_total")
    .eq("department_id", departmentId)
    .eq("campo_id", campoId)
    .eq("status", "PUBLICADO")
    .is("deleted_at", null)
    .order("data_inicio", { ascending: true })
    .returns<AppEventRow[]>();

  if (!eventos?.length) return { abertos: [], historico: [] };

  const ids = eventos.map((e) => e.id);
  const { data: forms } = await supabaseAdmin
    .from("department_event_forms")
    .select("*")
    .in("event_id", ids)
    .returns<EventFormRow[]>();

  // Quantas inscrições ativas cada evento já tem — para saber se lotou.
  const { data: contagens } = await supabaseAdmin
    .from("department_event_registrations")
    .select("event_id")
    .in("event_id", ids)
    .eq("status", "ATIVA")
    .is("deleted_at", null)
    .returns<{ event_id: string }[]>();

  const inscritosPor = new Map<string, number>();
  for (const r of contagens ?? []) {
    inscritosPor.set(r.event_id, (inscritosPor.get(r.event_id) ?? 0) + 1);
  }

  const agora = Date.now();
  const abertos: unknown[] = [];
  const historico: unknown[] = [];

  for (const ev of eventos) {
    const form = forms?.find((f) => f.event_id === ev.id) ?? null;
    const inscritos = inscritosPor.get(ev.id) ?? 0;

    const fim = ev.data_fim ? new Date(ev.data_fim).getTime() : null;
    const inicio = ev.data_inicio ? new Date(ev.data_inicio).getTime() : null;
    const jaAconteceu = (fim ?? inicio ?? Infinity) < agora;

    const abreEm = form?.inscricoes_de ? new Date(form.inscricoes_de).getTime() : null;
    const fechaEm = form?.inscricoes_ate ? new Date(form.inscricoes_ate).getTime() : null;
    // Sem data limite no formulário, o próprio início do evento é o limite.
    const limite = fechaEm ?? inicio;

    const lotado = form?.vagas_total != null && inscritos >= form.vagas_total;
    const dentroDoPrazo =
      (abreEm == null || agora >= abreEm) && (limite == null || agora <= limite);

    const inscricoesAbertas =
      !!form && form.ativo !== false && !jaAconteceu && dentroDoPrazo && !lotado;

    const registro = {
      ...ev,
      nome: ev.nome ?? ev.title,
      descricao: ev.descricao ?? ev.description,
      banner: ev.banner_url ?? ev.imagem_url,
      valor: form?.valor ?? ev.preco ?? ev.default_price ?? 0,
      gratuito: form?.gratuito ?? ev.gratuito ?? false,
      form,
      inscritos,
      vagasRestantes: form?.vagas_total != null ? Math.max(0, form.vagas_total - inscritos) : null,
      inscricoesAbertas,
      lotado,
      encerrado: jaAconteceu,
    };

    if (jaAconteceu) historico.push(registro);
    else abertos.push(registro);
  }

  // Histórico do mais recente para o mais antigo.
  historico.reverse();
  return { abertos, historico };
}

/** Produtos ativos do departamento, com imagens e variações. */
export async function getDepartmentProducts(departmentId: string, campoId: string) {
  const { data: produtos } = await supabaseAdmin
    .from("department_products")
    .select("*")
    .eq("department_id", departmentId)
    .eq("campo_id", campoId)
    .eq("ativo", true)
    .is("deleted_at", null)
    .order("ordem")
    .order("nome");

  if (!produtos?.length) return [];

  const ids = produtos.map((p) => p.id);
  const [{ data: imagens }, { data: variacoes }] = await Promise.all([
    supabaseAdmin.from("department_product_images").select("*").in("product_id", ids).order("ordem"),
    supabaseAdmin.from("department_product_variants").select("*").in("product_id", ids)
      .eq("ativo", true).order("ordem"),
  ]);

  return produtos.map((p) => ({
    ...p,
    imagens: (imagens ?? []).filter((i) => i.product_id === p.id),
    variacoes: (variacoes ?? []).filter((v) => v.product_id === p.id),
  }));
}
