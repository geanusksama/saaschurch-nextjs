/**
 * Painel Mobile — lado servidor dos recursos de definicoes.ts.
 *
 * Aqui mora o que o navegador não decide:
 *   - ESCOPO: todo registro é procurado já filtrado pelo campo do painel (ou
 *     pela Igreja Mundial que vale para o campo, ou pelo registro-pai). Um id
 *     de outro campo simplesmente não é encontrado.
 *   - LISTA BRANCA: só grava os campos da definição que não são leitura,
 *     convertidos pelo tipo. O resto do corpo da requisição é ignorado.
 *   - EFEITOS: pedido pago ativa ingressos; cancelado devolve vagas; reembolso
 *     pago encerra pedido/ingresso. Os alertas para a pessoa saem dos gatilhos
 *     appv3_alerta_status do banco (appv3/app/supabase/appv3_schema.sql).
 *
 * Tabelas appv3_* do App Igreja v3. Nada aqui toca as tabelas app_* antigas.
 */
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { RECURSOS, type CampoDef, type RecursoDef } from './definicoes';
import { prepararJogo, resumoJogo } from './jogoDados';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export interface Contexto {
  campoId: string;
  /** churchId quando o usuário só vê a própria igreja (secretaria/tesouraria). */
  igreja: string | null;
}

export class ErroMobile extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// ── Igreja Mundial que vale para o campo (D-03: override por campo, senão 'padrao')
export async function mundialDoCampo(campoId: string) {
  return (
    (await prisma.appV3IgrejaMundial.findFirst({ where: { chave: campoId } })) ??
    (await prisma.appV3IgrejaMundial.findFirst({ where: { chave: 'padrao' } }))
  );
}

async function mundialIdObrigatorio(campoId: string): Promise<string> {
  const m = await mundialDoCampo(campoId);
  if (!m) throw new ErroMobile('Cadastre os dados da Igreja Mundial em Configurações primeiro.');
  return m.id;
}

const PESSOA_SEL = { select: { nome: true, email: true, celular: true, excluidoEm: true } };
const nomePessoa = (p: Row) => (p ? (p.excluidoEm ? 'Conta excluída' : p.nome) : null);

// ── Configuração de servidor por recurso ────────────────────────────────────
interface Serv {
  modelo: string;
  escopo: 'campo' | 'mundial' | 'pai' | 'especial';
  /** where fixo (ex.: escopo CAMPO dos eventos). */
  fixo?: Record<string, unknown>;
  /** Coluna de igreja para a restrição de secretário/tesoureiro. */
  colIgreja?: string;
  /** Recurso sem campo_id próprio restrito por relação (ex.: ingresso → pedido). */
  campoVia?: (campoId: string) => Record<string, unknown>;
  ordem: Record<string, unknown>[] | Record<string, unknown>;
  include?: Record<string, unknown>;
  mapear?: (r: Row) => Record<string, unknown>;
}

const SERV: Record<string, Serv> = {
  solicitacoes: {
    modelo: 'appV3Solicitacao', escopo: 'campo', colIgreja: 'churchId',
    ordem: [{ criadoEm: 'desc' }],
    include: { perfil: PESSOA_SEL, church: { select: { name: true } } },
    mapear: (r) => ({ protocolo: `#SEC-${r.protocolo}`, pessoa: nomePessoa(r.perfil), igreja: r.church?.name ?? null }),
  },
  contribuicoes: {
    modelo: 'appV3Contribuicao', escopo: 'campo', colIgreja: 'churchId',
    ordem: [{ criadoEm: 'desc' }],
    include: { perfil: PESSOA_SEL, church: { select: { name: true } } },
    mapear: (r) => ({ pessoa: nomePessoa(r.perfil), igreja: r.church?.name ?? null }),
  },
  pedidos: {
    modelo: 'appV3Pedido', escopo: 'campo', colIgreja: 'churchId',
    ordem: [{ criadoEm: 'desc' }],
    include: { perfil: PESSOA_SEL, itens: { select: { nome: true, variante: true, quantidade: true } } },
    mapear: (r) => ({
      numero: `#${r.numero}`,
      pessoa: nomePessoa(r.perfil),
      itensResumo: (r.itens ?? []).map((i: Row) => `${i.quantidade}× ${i.nome}${i.variante ? ` (${i.variante})` : ''}`).join('\n'),
    }),
  },
  ingressos: {
    modelo: 'appV3Ingresso', escopo: 'especial', ordem: [{ criadoEm: 'desc' }],
    campoVia: (campoId) => ({ pedido: { campoId } }),
    include: { perfil: PESSOA_SEL, evento: { select: { titulo: true, inicio: true } }, pedido: { select: { churchId: true } } },
    mapear: (r) => ({ pessoa: nomePessoa(r.perfil), evento: r.evento?.titulo ?? null }),
  },
  reembolsos: {
    modelo: 'appV3Reembolso', escopo: 'especial', ordem: [{ criadoEm: 'desc' }],
    campoVia: (campoId) => ({ perfil: { campoId } }),
    include: { perfil: PESSOA_SEL, pedido: { select: { numero: true } }, ingresso: { select: { codigo: true } } },
    mapear: (r) => ({
      pessoa: nomePessoa(r.perfil),
      referencia: r.pedido ? `Pedido #${r.pedido.numero}` : r.ingresso ? `Ingresso ${r.ingresso.codigo}` : null,
    }),
  },
  eventos: {
    modelo: 'appV3Evento', escopo: 'campo', fixo: { escopo: 'CAMPO' }, ordem: [{ inicio: 'desc' }],
  },
  'evento-opcoes': { modelo: 'appV3EventoOpcao', escopo: 'pai', ordem: [{ ordem: 'asc' }, { rotulo: 'asc' }] },
  noticias: { modelo: 'appV3Noticia', escopo: 'campo', fixo: { escopo: 'CAMPO' }, ordem: [{ publicadoEm: 'desc' }] },
  midias: { modelo: 'appV3Midia', escopo: 'campo', ordem: [{ publicadoEm: 'desc' }, { criadoEm: 'desc' }] },
  'pao-diario': { modelo: 'appV3PaoDiario', escopo: 'campo', ordem: [{ data: 'desc' }] },
  produtos: { modelo: 'appV3Produto', escopo: 'campo', ordem: [{ ordem: 'asc' }, { nome: 'asc' }] },
  'produto-cores': { modelo: 'appV3ProdutoCor', escopo: 'pai', ordem: [{ ordem: 'asc' }] },
  'produto-imagens': { modelo: 'appV3ProdutoImagem', escopo: 'pai', ordem: [{ ordem: 'asc' }] },
  'loja-destaques': { modelo: 'appV3LojaDestaque', escopo: 'campo', ordem: [{ ordem: 'asc' }] },
  'ebd-licoes': { modelo: 'appV3EbdLicao', escopo: 'campo', ordem: [{ data: 'desc' }] },
  'ebd-turmas': { modelo: 'appV3EbdTurma', escopo: 'campo', ordem: [{ ordem: 'asc' }, { nome: 'asc' }] },
  'ebd-matriculas': {
    modelo: 'appV3EbdMatricula', escopo: 'pai', ordem: [{ criadoEm: 'desc' }],
    include: { perfil: PESSOA_SEL },
    mapear: (r) => ({ pessoa: nomePessoa(r.perfil) }),
  },
  jogos: {
    modelo: 'appV3JogoConteudo', escopo: 'campo', ordem: [{ jogo: 'asc' }, { ordem: 'asc' }],
    mapear: (r) => ({ resumo: resumoJogo(r.dados) }),
  },
  'categorias-evento': { modelo: 'appV3Categoria', escopo: 'campo', fixo: { tipo: 'EVENTO' }, ordem: [{ ordem: 'asc' }, { nome: 'asc' }] },
  'categorias-produto': { modelo: 'appV3Categoria', escopo: 'campo', fixo: { tipo: 'PRODUTO' }, ordem: [{ ordem: 'asc' }, { nome: 'asc' }] },
  lideranca: { modelo: 'appV3Lideranca', escopo: 'campo', ordem: [{ ordem: 'asc' }, { nome: 'asc' }] },
  convites: { modelo: 'appV3ConviteModelo', escopo: 'campo', ordem: [{ ordem: 'asc' }] },
  alertas: {
    modelo: 'appV3Notificacao', escopo: 'campo', fixo: { perfilId: null }, ordem: [{ criadoEm: 'desc' }],
  },
  perfis: {
    modelo: 'appV3Perfil', escopo: 'campo', colIgreja: 'churchId', ordem: [{ criadoEm: 'desc' }],
    include: { church: { select: { name: true } } },
    mapear: (r) => ({
      igreja: r.church?.name ?? null,
      situacao: r.excluidoEm ? 'EXCLUIDA' : r.memberId ? 'MEMBRO' : 'VISITANTE',
    }),
  },
  pix: { modelo: 'appV3PixConfig', escopo: 'campo', fixo: { escopo: 'CAMPO' }, ordem: [{ finalidade: 'asc' }, { ordem: 'asc' }] },
  'mundial-lideres': { modelo: 'appV3MundialLider', escopo: 'mundial', ordem: [{ ordem: 'asc' }] },
  'mundial-recursos': { modelo: 'appV3MundialRecurso', escopo: 'mundial', ordem: [{ ordem: 'asc' }] },
  'mundial-eventos': { modelo: 'appV3Evento', escopo: 'mundial', fixo: { escopo: 'MUNDIAL' }, ordem: [{ inicio: 'desc' }] },
  'mundial-noticias': { modelo: 'appV3Noticia', escopo: 'mundial', fixo: { escopo: 'MUNDIAL' }, ordem: [{ publicadoEm: 'desc' }] },
  'mundial-pix': { modelo: 'appV3PixConfig', escopo: 'mundial', fixo: { escopo: 'MUNDIAL' }, ordem: [{ finalidade: 'asc' }] },
  // igrejas-perfil e ministerios-info são tratados à parte (a lista vem de churches/ministries).
};

export function definicao(chave: string): { def: RecursoDef; serv: Serv | null } {
  const def = RECURSOS[chave];
  if (!def) throw new ErroMobile('Recurso desconhecido.', 404);
  return { def, serv: SERV[chave] ?? null };
}

// ── Escopo ─────────────────────────────────────────────────────────────────
/** where que prende o recurso ao campo/mundial/pai do painel. */
async function whereEscopo(chave: string, ctx: Contexto, paiId?: string | null): Promise<Record<string, unknown>> {
  const { def, serv } = definicao(chave);
  if (!serv) throw new ErroMobile('Recurso sem lista genérica.', 404);
  const w: Record<string, unknown> = { ...(serv.fixo ?? {}) };
  if (serv.escopo === 'campo') w.campoId = ctx.campoId;
  if (serv.escopo === 'mundial') w.mundialId = await mundialIdObrigatorio(ctx.campoId);
  if (serv.escopo === 'especial' && serv.campoVia) Object.assign(w, serv.campoVia(ctx.campoId));
  if (serv.escopo === 'pai') {
    if (!def.pai) throw new ErroMobile('Recurso filho sem pai.', 500);
    if (!paiId) throw new ErroMobile('Informe o registro principal.');
    await acharNoEscopo(def.pai.recurso, paiId, ctx); // lança 404 se o pai não é do campo
    w[def.pai.col] = paiId;
  }
  if (ctx.igreja && serv.colIgreja) w[serv.colIgreja] = ctx.igreja;
  if (ctx.igreja && chave === 'ingressos') w.pedido = { campoId: ctx.campoId, churchId: ctx.igreja };
  return w;
}

/** Registro pelo id, só se estiver no escopo; senão 404. */
export async function acharNoEscopo(chave: string, id: string, ctx: Contexto): Promise<Row> {
  const { def, serv } = definicao(chave);
  if (!serv) throw new ErroMobile('Recurso sem lista genérica.', 404);
  if (serv.escopo === 'pai') {
    const row = await db[serv.modelo].findUnique({ where: { id }, include: serv.include });
    if (!row) throw new ErroMobile('Registro não encontrado.', 404);
    await acharNoEscopo(def.pai!.recurso, row[def.pai!.col], ctx);
    return row;
  }
  const where = { ...(await whereEscopo(chave, ctx)), id };
  const row = await db[serv.modelo].findFirst({ where, include: serv.include });
  if (!row) throw new ErroMobile('Registro não encontrado.', 404);
  return row;
}

function saida(chave: string, row: Row): Record<string, unknown> {
  const { serv } = definicao(chave);
  const base = { ...row };
  delete base.perfil; delete base.church; delete base.itens; delete base.evento; delete base.pedido; delete base.ingresso;
  return { ...base, ...(serv?.mapear ? serv.mapear(row) : {}) };
}

// ── Conversão de valores ───────────────────────────────────────────────────
function vazio(v: unknown) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

async function converter(c: CampoDef, v: unknown, ctx: Contexto): Promise<unknown> {
  if (vazio(v)) {
    if (c.obrigatorio) throw new ErroMobile(`Preencha "${c.rotulo}".`);
    if (c.padraoDoBanco) return undefined; // não envia: o banco preenche ou mantém
    if (c.padrao !== undefined && c.tipo !== 'json') return converter(c, c.padrao, ctx);
    if (c.tipo === 'bool') return false;
    if (c.tipo === 'tags') return [];
    if (c.tipo === 'json') return c.padrao ?? null;
    return null;
  }
  switch (c.tipo) {
    case 'texto': case 'textoLongo': case 'url': case 'imagem':
      return String(v).trim();
    case 'cor': {
      const s = String(v).trim();
      if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(s)) throw new ErroMobile(`"${c.rotulo}" deve ser uma cor como #D4F53C.`);
      return s.toUpperCase();
    }
    case 'numero': {
      const n = Number(v);
      if (!Number.isFinite(n)) throw new ErroMobile(`"${c.rotulo}" deve ser um número.`);
      return Math.trunc(n);
    }
    case 'dinheiro': {
      const n = Number(String(v).replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) throw new ErroMobile(`"${c.rotulo}" deve ser um valor válido.`);
      return n.toFixed(2);
    }
    case 'bool':
      return v === true || v === 'true';
    case 'data': {
      const s = String(v).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new ErroMobile(`"${c.rotulo}" deve ser uma data.`);
      return new Date(`${s}T00:00:00.000Z`);
    }
    case 'dataHora': {
      const d = new Date(String(v));
      if (Number.isNaN(d.getTime())) throw new ErroMobile(`"${c.rotulo}" deve ser data e hora.`);
      return d;
    }
    case 'opcoes': {
      const s = String(v);
      if (!c.opcoes?.some(([k]) => k === s)) throw new ErroMobile(`Valor inválido em "${c.rotulo}".`);
      return c.opcoes.every(([k]) => /^\d+$/.test(k)) ? Number(s) : s;
    }
    case 'tags':
      return (Array.isArray(v) ? v : String(v).split(',')).map((x) => String(x).trim()).filter(Boolean);
    case 'json': {
      if (typeof v !== 'string') return v;
      try {
        return JSON.parse(v);
      } catch {
        throw new ErroMobile(`"${c.rotulo}" não é um JSON válido.`);
      }
    }
    case 'igreja': {
      const id = String(v);
      const ok = await prisma.church.findFirst({ where: { id, deletedAt: null, regional: { campoId: ctx.campoId } }, select: { id: true } });
      if (!ok) throw new ErroMobile('Igreja não pertence ao campo.');
      return id;
    }
    case 'relacao':
      return String(v); // conferida em conferirRelacoes, que conhece o registro inteiro
    case 'categoria': {
      const nome = String(v).trim();
      const ok = await prisma.appV3Categoria.findFirst({
        where: { campoId: ctx.campoId, tipo: c.categoria, nome: { equals: nome, mode: 'insensitive' } }, select: { nome: true },
      });
      if (!ok) throw new ErroMobile(`Categoria "${nome}" não está cadastrada. Cadastre na aba Categorias.`);
      return ok.nome; // grafia do cadastro, para o filtro do app não separar "jovens" de "Jovens"
    }
    case 'ministerio': {
      const id = String(v);
      const ok = await prisma.ministry.findFirst({ where: { id, ...whereMinisterios(ctx) }, select: { id: true } });
      if (!ok) throw new ErroMobile('Ministério não pertence ao campo.');
      return id;
    }
    case 'jogo':
      return v; // montado em ajustarJogo, que conhece o tipo de jogo
  }
}

/** Monta o objeto de gravação a partir do corpo, só com campos editáveis. */
async function dadosDoCorpo(def: RecursoDef, corpo: Record<string, unknown>, ctx: Contexto, criando: boolean) {
  const dados: Record<string, unknown> = {};
  for (const c of def.campos) {
    if (c.leitura) continue;
    if (!criando && !(c.col in corpo)) continue;
    const bruto = c.col in corpo ? corpo[c.col] : c.padrao;
    const v = await converter(c, bruto, ctx);
    if (v !== undefined) dados[c.col] = v;
  }
  return dados;
}

/** Conteúdo de jogo: valida e monta o JSON do app (cruzadas: gera a grade). */
function ajustarJogo(def: RecursoDef, dados: Record<string, unknown>, jogoAtual?: string) {
  const campo = def.campos.find((c) => c.tipo === 'jogo');
  if (!campo || !(campo.col in dados)) return;
  let bruto = dados[campo.col];
  if (typeof bruto === 'string') {
    try { bruto = JSON.parse(bruto); } catch { throw new ErroMobile('Conteúdo do jogo inválido.'); }
  }
  const r = prepararJogo(String(dados.jogo ?? jogoAtual ?? ''), (bruto ?? {}) as Record<string, unknown>);
  if (r.erro) throw new ErroMobile(r.erro);
  dados[campo.col] = r.dados;
}

async function conferirRelacoes(def: RecursoDef, dados: Record<string, unknown>, ctx: Contexto, paiId: string | null) {
  for (const c of def.campos) {
    if (c.tipo !== 'relacao' || !dados[c.col]) continue;
    const alvo = String(dados[c.col]);
    if (c.relacao === 'produto-cores') {
      const cor = await prisma.appV3ProdutoCor.findUnique({ where: { id: alvo }, select: { produtoId: true } });
      if (!cor || cor.produtoId !== paiId) throw new ErroMobile('A cor não é deste produto.');
    } else if (c.relacao) {
      await acharNoEscopo(c.relacao, alvo, ctx);
    }
  }
}

// ── Operações ──────────────────────────────────────────────────────────────
const PAGE = 30;
const TAMANHOS = [10, 20, 30, 50, 100];
function tamanhoPagina(sp: URLSearchParams) {
  const n = Number(sp.get('pageSize'));
  return TAMANHOS.includes(n) ? n : PAGE;
}

/** Campo 'ministerio' guarda o id; a lista mostra o nome (`<col>Rotulo`). */
async function rotularMinisterios(def: RecursoDef, linhas: Record<string, unknown>[]) {
  const cols = def.campos.filter((c) => c.tipo === 'ministerio').map((c) => c.col);
  if (!cols.length) return;
  const ids = [...new Set(linhas.flatMap((l) => cols.map((c) => l[c]).filter(Boolean) as string[]))];
  if (!ids.length) return;
  const mins = await prisma.ministry.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const nome = new Map(mins.map((m) => [m.id, m.name]));
  for (const l of linhas) for (const c of cols) if (l[c]) l[`${c}Rotulo`] = nome.get(l[c] as string) ?? null;
}

export async function listar(chave: string, ctx: Contexto, sp: URLSearchParams) {
  if (chave === 'igrejas-perfil') return listarIgrejas(ctx, sp);
  if (chave === 'ministerios-info') return listarMinisterios(ctx, sp);
  const { def, serv } = definicao(chave);
  const where = await whereEscopo(chave, ctx, sp.get('pai'));

  for (const col of def.filtros ?? []) {
    const v = sp.get(`f_${col}`);
    if (!v) continue;
    const c = def.campos.find((x) => x.col === col);
    if (chave === 'perfis' && col === 'situacao') {
      if (v === 'EXCLUIDA') where.excluidoEm = { not: null };
      else { where.excluidoEm = null; where.memberId = v === 'MEMBRO' ? { not: null } : null; }
    } else if (c?.tipo === 'bool') {
      where[col] = v === 'true';
    } else if (c?.tipo === 'opcoes' && c.opcoes?.every(([k]) => /^\d+$/.test(k))) {
      where[col] = Number(v);
    } else {
      where[col] = v;
    }
  }
  // Período: dias inteiros no horário de Brasília (UTC-3, sem horário de verão desde 2019).
  if (def.data) {
    const de = sp.get('de'), ate = sp.get('ate');
    const c = def.campos.find((x) => x.col === def.data);
    const faixa: Record<string, Date> = {};
    const dia = (d: string, fim: boolean) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new ErroMobile('Data inválida no filtro.');
      const base = c?.tipo === 'data' ? new Date(`${d}T00:00:00.000Z`) : new Date(`${d}T00:00:00.000-03:00`);
      return fim ? new Date(base.getTime() + 86_400_000) : base;
    };
    if (de) faixa.gte = dia(de, false);
    if (ate) faixa.lt = dia(ate, true);
    if (de || ate) where[def.data] = faixa;
  }
  const q = (sp.get('q') ?? '').trim();
  if (q && def.busca?.length) {
    where.OR = def.busca.map((col) => ({ [col]: { contains: q, mode: 'insensitive' } }));
  }
  const pagina = Math.max(1, Number(sp.get('pagina') ?? 1) || 1);
  const tudo = sp.get('tudo') === '1'; // listas curtas (filhos, opções de relação)
  const tamanho = tudo ? 200 : tamanhoPagina(sp);
  const [linhas, total] = await Promise.all([
    db[serv!.modelo].findMany({
      where, orderBy: serv!.ordem, include: serv!.include,
      skip: tudo ? 0 : (pagina - 1) * tamanho, take: tamanho,
    }),
    db[serv!.modelo].count({ where }),
  ]);
  const saidas = linhas.map((r: Row) => saida(chave, r));
  await rotularMinisterios(def, saidas);
  return { linhas: saidas, total, pagina, pageSize: tamanho };
}

export async function obter(chave: string, id: string, ctx: Contexto) {
  if (chave === 'igrejas-perfil') return obterIgreja(id, ctx);
  if (chave === 'ministerios-info') return obterMinisterio(id, ctx);
  const row = await acharNoEscopo(chave, id, ctx);
  const out = saida(chave, row);
  await rotularMinisterios(RECURSOS[chave], [out]);
  if (chave === 'solicitacoes' && row.anexoPath) {
    const { data } = await supabaseAdmin.storage.from('appv3-privado').createSignedUrl(row.anexoPath, 3600);
    out.anexo = data?.signedUrl ?? null;
  }
  return out;
}

export async function criar(chave: string, corpo: Record<string, unknown>, ctx: Contexto) {
  const { def, serv } = definicao(chave);
  if (!def.criar || !serv) throw new ErroMobile('Este cadastro não aceita novos registros.', 405);
  const paiId = def.pai ? String(corpo.__pai ?? '') : null;
  const escopo = await whereEscopo(chave, ctx, paiId);
  const dados = await dadosDoCorpo(def, corpo, ctx, true);
  ajustarJogo(def, dados);
  await conferirRelacoes(def, dados, ctx, paiId);
  // o escopo entra por último: o corpo não consegue trocar campo, mundial ou pai
  const row = await db[serv.modelo].create({ data: { ...dados, ...escopo } });
  return saida(chave, row);
}

export async function atualizar(chave: string, id: string, corpo: Record<string, unknown>, ctx: Contexto) {
  if (chave === 'igrejas-perfil') return salvarIgreja(id, corpo, ctx);
  if (chave === 'ministerios-info') return salvarMinisterio(id, corpo, ctx);
  const { def, serv } = definicao(chave);
  const antes = await acharNoEscopo(chave, id, ctx);
  const dados = await dadosDoCorpo(def, corpo, ctx, false);
  ajustarJogo(def, dados, antes.jogo);
  if (Object.keys(dados).length === 0) return saida(chave, antes);
  await conferirRelacoes(def, dados, ctx, def.pai ? antes[def.pai.col] : null);

  const extras = await efeitos(chave, antes, dados);
  const ops = [db[serv!.modelo].update({ where: { id }, data: { ...dados, ...extras.proprio } }), ...extras.ops];
  const [row] = await prisma.$transaction(ops);
  return saida(chave, { ...antes, ...row });
}

export async function excluir(chave: string, id: string, ctx: Contexto) {
  const { def, serv } = definicao(chave);
  if (!def.excluir || !serv) throw new ErroMobile('Este cadastro não permite excluir.', 405);
  await acharNoEscopo(chave, id, ctx);
  // Pedido guarda evento/opção/produto com ON DELETE SET NULL: apagar algo já
  // vendido deixaria ingresso sem evento. Quem vendeu, despublica.
  const vendas =
    chave === 'eventos' || chave === 'mundial-eventos' ? await prisma.appV3PedidoItem.count({ where: { eventoId: id } })
    : chave === 'evento-opcoes' ? await prisma.appV3PedidoItem.count({ where: { opcaoId: id } })
    : chave === 'produtos' ? await prisma.appV3PedidoItem.count({ where: { produtoId: id } })
    : 0;
  if (chave === 'categorias-evento' || chave === 'categorias-produto') {
    const cat = await prisma.appV3Categoria.findUnique({ where: { id }, select: { nome: true } });
    const emUso = !cat ? 0 : chave === 'categorias-evento'
      ? await prisma.appV3Evento.count({ where: { campoId: ctx.campoId, categoria: cat.nome } })
      : (await prisma.appV3Produto.count({ where: { campoId: ctx.campoId, categoria: cat.nome } }))
        + (await prisma.appV3LojaDestaque.count({ where: { campoId: ctx.campoId, categoria: cat.nome } }));
    if (emUso > 0) throw new ErroMobile(`Categoria em uso por ${emUso} registro(s). Desative em vez de excluir.`, 409);
  }
  if (vendas > 0) throw new ErroMobile('Já existe venda ligada a este registro. Desative ou despublique em vez de excluir.', 409);
  try {
    await db[serv.modelo].delete({ where: { id } });
  } catch (e) {
    // FK de pedido/ingresso: evento ou produto já vendido não some do histórico
    if ((e as { code?: string }).code === 'P2003') {
      throw new ErroMobile('Já existe venda ligada a este registro. Desative ou despublique em vez de excluir.', 409);
    }
    throw e;
  }
}

// ── Efeitos colaterais de mudança de status ────────────────────────────────
async function devolverVagas(ingressos: { eventoId: string | null; quantidade: number }[]) {
  const porEvento = new Map<string, number>();
  for (const i of ingressos) if (i.eventoId) porEvento.set(i.eventoId, (porEvento.get(i.eventoId) ?? 0) + i.quantidade);
  return [...porEvento].map(([eventoId, n]) =>
    prisma.appV3Evento.update({ where: { id: eventoId }, data: { vendidos: { decrement: n } } }));
}

async function cancelarIngressosDoPedido(pedidoId: string) {
  const vivos = await prisma.appV3Ingresso.findMany({
    where: { pedidoId, status: { in: ['AGUARDANDO_PAGAMENTO', 'ATIVO', 'REEMBOLSO_SOLICITADO'] } },
    select: { eventoId: true, quantidade: true },
  });
  return [
    prisma.appV3Ingresso.updateMany({ where: { pedidoId, status: { in: ['AGUARDANDO_PAGAMENTO', 'ATIVO', 'REEMBOLSO_SOLICITADO'] } }, data: { status: 'CANCELADO' } }),
    ...(await devolverVagas(vivos)),
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function efeitos(chave: string, antes: Row, dados: Record<string, unknown>): Promise<{ proprio: Record<string, unknown>; ops: any[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: any[] = [];
  const proprio: Record<string, unknown> = {};

  // Renomear categoria leva o nome novo aos registros que usam a antiga.
  if ((chave === 'categorias-evento' || chave === 'categorias-produto') && dados.nome && dados.nome !== antes.nome) {
    const where = { campoId: antes.campoId, categoria: antes.nome };
    const data = { categoria: dados.nome as string };
    if (chave === 'categorias-evento') ops.push(prisma.appV3Evento.updateMany({ where, data }));
    else ops.push(prisma.appV3Produto.updateMany({ where, data }), prisma.appV3LojaDestaque.updateMany({ where, data }));
  }

  const novo = dados.status as string | undefined;
  if (!novo || novo === antes.status) return { proprio, ops };

  if (chave === 'solicitacoes') proprio.atualizadoEm = new Date();
  if (chave === 'contribuicoes') proprio.confirmadoEm = novo === 'CONFIRMADA' ? new Date() : null;

  if (chave === 'pedidos') {
    if (novo === 'PAGO') {
      proprio.pagoEm = antes.pagoEm ?? new Date();
      ops.push(prisma.appV3Ingresso.updateMany({ where: { pedidoId: antes.id, status: 'AGUARDANDO_PAGAMENTO' }, data: { status: 'ATIVO' } }));
    }
    if (novo === 'CANCELADO' || novo === 'REEMBOLSADO') ops.push(...(await cancelarIngressosDoPedido(antes.id)));
  }

  if (chave === 'ingressos' && novo === 'CANCELADO' && antes.status !== 'CANCELADO') {
    ops.push(...(await devolverVagas([{ eventoId: antes.eventoId, quantidade: antes.quantidade }])));
  }

  if (chave === 'reembolsos') {
    if (novo === 'PAGO') {
      if (antes.pedidoId) {
        ops.push(prisma.appV3Pedido.update({ where: { id: antes.pedidoId }, data: { status: 'REEMBOLSADO' } }));
        ops.push(...(await cancelarIngressosDoPedido(antes.pedidoId)));
      }
      if (antes.ingressoId) {
        const ing = await prisma.appV3Ingresso.findUnique({ where: { id: antes.ingressoId }, select: { eventoId: true, quantidade: true, status: true } });
        if (ing && ing.status !== 'CANCELADO') {
          ops.push(prisma.appV3Ingresso.update({ where: { id: antes.ingressoId }, data: { status: 'CANCELADO' } }));
          ops.push(...(await devolverVagas([ing])));
        }
      }
    }
    if (novo === 'NEGADO') {
      if (antes.pedidoId) ops.push(prisma.appV3Pedido.updateMany({ where: { id: antes.pedidoId, status: 'REEMBOLSO_SOLICITADO' }, data: { status: 'PAGO' } }));
      if (antes.ingressoId) ops.push(prisma.appV3Ingresso.updateMany({ where: { id: antes.ingressoId, status: 'REEMBOLSO_SOLICITADO' }, data: { status: 'ATIVO' } }));
    }
  }
  return { proprio, ops };
}

// ── Página das igrejas e ministérios (lista vem das tabelas do saaschurch) ──
async function listarIgrejas(ctx: Contexto, sp: URLSearchParams) {
  const q = (sp.get('q') ?? '').trim();
  const where: Record<string, unknown> = { deletedAt: null, regional: { campoId: ctx.campoId } };
  if (q) where.name = { contains: q, mode: 'insensitive' };
  const pagina = Math.max(1, Number(sp.get('pagina') ?? 1) || 1);
  const [igrejas, total] = await Promise.all([
    prisma.church.findMany({ where, orderBy: { name: 'asc' }, skip: (pagina - 1) * PAGE, take: PAGE, select: { id: true, name: true } }),
    prisma.church.count({ where }),
  ]);
  const perfis = await prisma.appV3IgrejaPerfil.findMany({ where: { churchId: { in: igrejas.map((i) => i.id) } } });
  const porId = new Map(perfis.map((p) => [p.churchId, p]));
  return {
    linhas: igrejas.map((i) => ({ id: i.id, nome: i.name, fotoUrl: porId.get(i.id)?.fotoUrl ?? null, historia: porId.get(i.id)?.historia ?? null, marcos: porId.get(i.id)?.marcos ?? [] })),
    total, pagina, pageSize: PAGE,
  };
}

async function igrejaDoCampo(id: string, ctx: Contexto) {
  const i = await prisma.church.findFirst({ where: { id, deletedAt: null, regional: { campoId: ctx.campoId } }, select: { id: true, name: true } });
  if (!i) throw new ErroMobile('Igreja não encontrada no campo.', 404);
  return i;
}

async function obterIgreja(id: string, ctx: Contexto) {
  const i = await igrejaDoCampo(id, ctx);
  const p = await prisma.appV3IgrejaPerfil.findUnique({ where: { churchId: id } });
  return { id: i.id, nome: i.name, fotoUrl: p?.fotoUrl ?? null, historia: p?.historia ?? null, marcos: p?.marcos ?? [] };
}

async function salvarIgreja(id: string, corpo: Record<string, unknown>, ctx: Contexto) {
  await igrejaDoCampo(id, ctx);
  const dados = await dadosDoCorpo(RECURSOS['igrejas-perfil'], corpo, ctx, false);
  await prisma.appV3IgrejaPerfil.upsert({
    where: { churchId: id },
    update: dados,
    create: { churchId: id, marcos: [], ...dados },
  });
  return obterIgreja(id, ctx);
}

function whereMinisterios(ctx: Contexto): Record<string, unknown> {
  return {
    deletedAt: null, isActive: true,
    OR: [{ campoId: ctx.campoId }, { church: { regional: { campoId: ctx.campoId } } }],
  };
}

async function listarMinisterios(ctx: Contexto, sp: URLSearchParams) {
  const q = (sp.get('q') ?? '').trim();
  const where = whereMinisterios(ctx);
  if (q) where.name = { contains: q, mode: 'insensitive' };
  const pagina = Math.max(1, Number(sp.get('pagina') ?? 1) || 1);
  const [mins, total] = await Promise.all([
    prisma.ministry.findMany({ where, orderBy: { name: 'asc' }, skip: (pagina - 1) * PAGE, take: PAGE, select: { id: true, name: true, church: { select: { name: true } } } }),
    prisma.ministry.count({ where }),
  ]);
  const infos = await prisma.appV3MinisterioInfo.findMany({ where: { ministryId: { in: mins.map((m) => m.id) } } });
  const porId = new Map(infos.map((x) => [x.ministryId, x]));
  return {
    linhas: mins.map((m) => ({
      id: m.id, nome: m.church?.name ? `${m.name} · ${m.church.name}` : m.name,
      publico: porId.get(m.id)?.publico ?? null, agenda: porId.get(m.id)?.agenda ?? null, imagemUrl: porId.get(m.id)?.imagemUrl ?? null,
    })),
    total, pagina, pageSize: PAGE,
  };
}

async function obterMinisterio(id: string, ctx: Contexto) {
  const m = await prisma.ministry.findFirst({ where: { id, ...whereMinisterios(ctx) }, select: { id: true, name: true } });
  if (!m) throw new ErroMobile('Ministério não encontrado no campo.', 404);
  const x = await prisma.appV3MinisterioInfo.findUnique({ where: { ministryId: id } });
  return { id: m.id, nome: m.name, publico: x?.publico ?? null, agenda: x?.agenda ?? null, imagemUrl: x?.imagemUrl ?? null };
}

async function salvarMinisterio(id: string, corpo: Record<string, unknown>, ctx: Contexto) {
  await obterMinisterio(id, ctx);
  const dados = await dadosDoCorpo(RECURSOS['ministerios-info'], corpo, ctx, false);
  await prisma.appV3MinisterioInfo.upsert({ where: { ministryId: id }, update: dados, create: { ministryId: id, ...dados } });
  return obterMinisterio(id, ctx);
}
