/**
 * Conamad: anuidades e inadimplência dos ministros, espelhadas do sistema da
 * convenção (sistema.conamad.com.br).
 *
 * Toda consulta recebe `campoId` e filtra por ele. A chave da anuidade é o id
 * dela no CONAMAD: a mesma matrícula pode repetir no ano (cancelada + nova).
 * A matrícula do CONAMAD é diferente do ROL e nunca é comparada com ele.
 */
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { normalizarSituacaoMembro } from '../situacaoMembro';

export const NAO_PAGO = 'Não Pago';
export const CANCELADO = 'Cancelado';
export const ANO_INICIAL = 2012;
export const TETO_LINHAS = 10000;

/** Erro de conteúdo da planilha: a mensagem é segura para mostrar a quem enviou. */
export class ErroPlanilha extends Error {}

export interface FiltrosConamad {
  anoDe?: number;
  anoAte?: number;
  anos?: number[];
  situacoes?: string[];
  situacoesMinistro?: string[];
  titulos?: string[];
  busca?: string;
}

const TITULO_ESCRITA: Record<string, string> = {
  Pr: 'PASTOR', 'Prª': 'PASTORA', Ev: 'EVANGELISTA', 'Missª': 'MISSIONARIA',
  'Pr. P': 'PASTOR PRESIDENTE', PrJ: 'PASTOR JUBILADO', PraJ: 'PASTORA JUBILADA',
};
const SITUACAO_ESCRITA: Record<string, string> = { ATIVO: 'ATIVO', INAT: 'DESLIGADO', AGUAR: 'AGUARDANDO ATIVACAO' };

/** Abreviações do CONAMAD escritas como no nosso sistema ("INATIVO" aqui é DESLIGADO). */
function naNossaEscrita<T extends { titulo: string | null; situacao?: string | null; situacaoMinistro?: string | null }>(linhas: T[]): T[] {
  return linhas.map((l) => ({
    ...l,
    titulo: l.titulo ? TITULO_ESCRITA[l.titulo] ?? l.titulo : l.titulo,
    ...('situacao' in l && l.situacao ? { situacao: SITUACAO_ESCRITA[l.situacao] ?? l.situacao } : {}),
    ...('situacaoMinistro' in l && l.situacaoMinistro ? { situacaoMinistro: SITUACAO_ESCRITA[l.situacaoMinistro] ?? l.situacaoMinistro } : {}),
  }));
}

function condicoes(campoId: string, f: FiltrosConamad, extras: Prisma.Sql[] = []) {
  const partes: Prisma.Sql[] = [Prisma.sql`a.campo_id = ${campoId}::uuid`, ...extras];
  if (f.anoDe) partes.push(Prisma.sql`a.ano_referencia >= ${f.anoDe}`);
  if (f.anoAte) partes.push(Prisma.sql`a.ano_referencia <= ${f.anoAte}`);
  if (f.anos?.length) partes.push(Prisma.sql`a.ano_referencia = ANY(${f.anos}::int[])`);
  if (f.situacoes?.length) partes.push(Prisma.sql`a.situacao = ANY(${f.situacoes}::text[])`);
  if (f.situacoesMinistro?.length) partes.push(Prisma.sql`m.situacao = ANY(${f.situacoesMinistro}::text[])`);
  if (f.titulos?.length) partes.push(Prisma.sql`m.titulo = ANY(${f.titulos}::text[])`);
  if (f.busca) {
    const termo = f.busca.trim();
    const digitos = termo.replace(/\D/g, '');
    const ouMatricula = digitos ? Prisma.sql`OR m.matricula::text = ${digitos} OR regexp_replace(coalesce(m.documento,''), '\\D', '', 'g') = ${digitos}` : Prisma.empty;
    partes.push(Prisma.sql`(m.nome ILIKE ${'%' + termo + '%'} ${ouMatricula})`);
  }
  return Prisma.join(partes, ' AND ');
}

/** Como "Status de Ministro Jubilados". */
export async function listarJubilados(campoId: string, f: FiltrosConamad) {
  const partes = [Prisma.sql`m.campo_id = ${campoId}::uuid`, Prisma.sql`m.jubilado`];
  if (f.situacoesMinistro?.length) partes.push(Prisma.sql`m.situacao = ANY(${f.situacoesMinistro}::text[])`);
  if (f.titulos?.length) partes.push(Prisma.sql`m.titulo = ANY(${f.titulos}::text[])`);
  if (f.busca) {
    const digitos = f.busca.replace(/\D/g, '');
    const ouNumero = digitos ? Prisma.sql`OR m.matricula::text = ${digitos} OR regexp_replace(coalesce(m.documento,''), '\\D', '', 'g') = ${digitos}` : Prisma.empty;
    partes.push(Prisma.sql`(m.nome ILIKE ${'%' + f.busca.trim() + '%'} ${ouNumero})`);
  }
  return naNossaEscrita(await prisma.$queryRaw<Array<{ titulo: string | null; situacao: string | null } & Record<string, unknown>>>(Prisma.sql`
    SELECT m.id, m.matricula, m.nome, m.titulo, m.situacao, m.igreja, m.jubilado_estado AS estado, m.jubilado_anuidade AS anuidade,
           mb.rol, mb.id AS "memberId", mb.photo_url AS "fotoUrl", mb.membership_status AS "situacaoCadastro"
    FROM conamad_ministros m
    LEFT JOIN members mb ON mb.id = m.member_id AND mb.deleted_at IS NULL
    WHERE ${Prisma.join(partes, ' AND ')}
    ORDER BY m.nome LIMIT ${TETO_LINHAS}`));
}

export function anosDisponiveis(campoId: string) {
  return prisma.$queryRaw<Array<{ ano: number }>>(Prisma.sql`
    SELECT DISTINCT ano_referencia AS ano FROM conamad_anuidades
    WHERE campo_id = ${campoId}::uuid ORDER BY 1 DESC`).then((r) => r.map((x) => x.ano));
}

/** Totais por ano (Visão geral). */
export function resumoPorAno(campoId: string, f: FiltrosConamad) {
  const where = condicoes(campoId, { ...f, situacoes: undefined });
  return prisma.$queryRaw<Array<{ ano: number; pagas: number; naoPagas: number; isentas: number; canceladas: number; recebido: string; aberto: string }>>(Prisma.sql`
    SELECT a.ano_referencia AS ano,
           count(*) FILTER (WHERE a.situacao = 'Pago')::int AS pagas,
           count(*) FILTER (WHERE a.situacao = ${NAO_PAGO})::int AS "naoPagas",
           count(*) FILTER (WHERE a.situacao = 'Isento')::int AS isentas,
           count(*) FILTER (WHERE a.situacao = ${CANCELADO})::int AS canceladas,
           coalesce(sum(a.valor) FILTER (WHERE a.situacao = 'Pago'), 0)::text AS recebido,
           coalesce(sum(a.valor) FILTER (WHERE a.situacao = ${NAO_PAGO}), 0)::text AS aberto
    FROM conamad_anuidades a
    JOIN conamad_ministros m ON m.id = a.ministro_id
    WHERE ${where}
    GROUP BY 1 ORDER BY 1 DESC
    LIMIT ${TETO_LINHAS}`);
}

export interface LinhaInadimplente {
  matricula: number; nome: string; titulo: string | null; situacao: string | null; igreja: string | null;
  rol: number | null; memberId: string | null; fotoUrl: string | null; situacaoCadastro: string | null;
  qtd: number; total: string; anos: number[];
}

export async function listarInadimplentes(campoId: string, f: FiltrosConamad) {
  const where = condicoes(campoId, { ...f, situacoes: undefined }, [Prisma.sql`a.situacao = ${NAO_PAGO}`]);
  return naNossaEscrita(await prisma.$queryRaw<LinhaInadimplente[]>(Prisma.sql`
    SELECT m.matricula, m.nome, m.titulo, m.situacao, m.igreja, mb.rol, mb.id AS "memberId", mb.photo_url AS "fotoUrl",
           mb.membership_status AS "situacaoCadastro",
           count(*)::int AS qtd, sum(a.valor)::text AS total, array_agg(a.ano_referencia ORDER BY a.ano_referencia) AS anos
    FROM conamad_anuidades a
    JOIN conamad_ministros m ON m.id = a.ministro_id
    LEFT JOIN members mb ON mb.id = m.member_id AND mb.deleted_at IS NULL
    WHERE ${where}
    GROUP BY m.matricula, m.nome, m.titulo, m.situacao, m.igreja, mb.rol, mb.id, mb.photo_url, mb.membership_status
    ORDER BY sum(a.valor) DESC, m.nome
    LIMIT ${TETO_LINHAS}`));
}

/** Como "Inadimplentes por igreja": total de ministros e quantos devem em cada ano. */
export async function inadimplentesPorIgreja(campoId: string, f: FiltrosConamad) {
  const where = condicoes(campoId, { ...f, situacoes: undefined }, [Prisma.sql`a.situacao = ${NAO_PAGO}`]);
  const filtroMinistro = [Prisma.sql`m.campo_id = ${campoId}::uuid`];
  if (f.situacoesMinistro?.length) filtroMinistro.push(Prisma.sql`m.situacao = ANY(${f.situacoesMinistro}::text[])`);
  if (f.titulos?.length) filtroMinistro.push(Prisma.sql`m.titulo = ANY(${f.titulos}::text[])`);
  const [linhas, porAno, totais] = await Promise.all([
    prisma.$queryRaw<Array<{ igreja: string | null; ministros: number; anuidades: number; total: string }>>(Prisma.sql`
      SELECT a.igreja, count(DISTINCT a.matricula)::int AS ministros, count(*)::int AS anuidades, sum(a.valor)::text AS total
      FROM conamad_anuidades a JOIN conamad_ministros m ON m.id = a.ministro_id
      WHERE ${where} GROUP BY a.igreja ORDER BY sum(a.valor) DESC LIMIT ${TETO_LINHAS}`),
    prisma.$queryRaw<Array<{ igreja: string | null; ano: number; qtd: number }>>(Prisma.sql`
      SELECT a.igreja, a.ano_referencia AS ano, count(DISTINCT a.matricula)::int AS qtd
      FROM conamad_anuidades a JOIN conamad_ministros m ON m.id = a.ministro_id
      WHERE ${where} GROUP BY 1, 2`),
    prisma.$queryRaw<Array<{ igreja: string | null; qtd: number }>>(Prisma.sql`
      SELECT m.igreja, count(*)::int AS qtd FROM conamad_ministros m
      WHERE ${Prisma.join(filtroMinistro, ' AND ')} GROUP BY 1`),
  ]);
  return linhas.map((l) => ({
    ...l,
    totalMinistros: totais.find((t) => t.igreja === l.igreja)?.qtd ?? 0,
    anos: Object.fromEntries(porAno.filter((a) => a.igreja === l.igreja).map((a) => [String(a.ano), a.qtd])),
  }));
}

export async function listarAnuidades(campoId: string, f: FiltrosConamad) {
  const where = condicoes(campoId, f);
  return naNossaEscrita(await prisma.$queryRaw<Array<{ titulo: string | null; situacaoMinistro: string | null } & Record<string, unknown>>>(Prisma.sql`
    SELECT a.id, a.matricula, a.nome, m.titulo, m.situacao AS "situacaoMinistro", a.igreja, a.ano_referencia AS ano,
           a.valor::text AS valor, a.situacao AS anuidade, a.motivo_isencao AS "motivoIsencao", a.parcelado,
           a.data_vencimento AS "dataVencimento", mb.rol, mb.id AS "memberId", mb.photo_url AS "fotoUrl"
    FROM conamad_anuidades a
    JOIN conamad_ministros m ON m.id = a.ministro_id
    LEFT JOIN members mb ON mb.id = m.member_id AND mb.deleted_at IS NULL
    WHERE ${where}
    ORDER BY a.ano_referencia DESC, a.nome
    LIMIT ${TETO_LINHAS}`));
}

/** Grade ministro × ano, como "Anuidades (Lista geral)". Cancelada só aparece se for a única do ano. */
export async function listaGeral(campoId: string, f: FiltrosConamad) {
  const where = condicoes(campoId, { ...f, situacoes: undefined });
  return naNossaEscrita(await prisma.$queryRaw<Array<{ matricula: number; nome: string; titulo: string | null; situacao: string | null; igreja: string | null; rol: number | null; memberId: string | null; fotoUrl: string | null; naoPago: string; anos: Record<string, string> }>>(Prisma.sql`
    WITH por_ano AS (
      SELECT DISTINCT ON (a.ministro_id, a.ano_referencia) a.ministro_id, a.ano_referencia,
             CASE WHEN a.situacao = 'Isento' AND a.motivo_isencao ILIKE '%idade%' THEN 'Isento por idade' ELSE a.situacao END AS situacao
      FROM conamad_anuidades a JOIN conamad_ministros m ON m.id = a.ministro_id
      WHERE ${where}
      ORDER BY a.ministro_id, a.ano_referencia, (a.situacao = ${CANCELADO}), a.alterado_no_conamad_em DESC NULLS LAST
    ), aberto AS (
      SELECT a.ministro_id, sum(a.valor) AS total
      FROM conamad_anuidades a JOIN conamad_ministros m ON m.id = a.ministro_id
      WHERE ${where} AND a.situacao = ${NAO_PAGO}
      GROUP BY a.ministro_id
    )
    SELECT m.matricula, m.nome, m.titulo, m.situacao, m.igreja, mb.rol, mb.id AS "memberId", mb.photo_url AS "fotoUrl",
           coalesce(ab.total, 0)::text AS "naoPago", jsonb_object_agg(p.ano_referencia::text, p.situacao) AS anos
    FROM por_ano p
    JOIN conamad_ministros m ON m.id = p.ministro_id
    LEFT JOIN members mb ON mb.id = m.member_id AND mb.deleted_at IS NULL
    LEFT JOIN aberto ab ON ab.ministro_id = m.id
    GROUP BY m.matricula, m.nome, m.titulo, m.situacao, m.igreja, mb.rol, mb.id, mb.photo_url, ab.total
    ORDER BY m.nome
    LIMIT ${TETO_LINHAS}`));
}

// ─── Atualização por planilha exportada do CONAMAD ──────────────────────────

const CODIGO_SITUACAO: Record<string, string> = { PAGO: 'Pago', NPAG: NAO_PAGO, ISN: 'Isento', 'ISN/ID': 'Isento' };
const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

export interface MudancaAnuidade { id: string; matricula: number; nome: string; ano: number; de: string; para: string; motivo?: string }
export interface MudancaMinistro { id: string; matricula: number; nome: string; de: string | null; para: string }
export interface Previa {
  tipo: 'anuidades' | 'ministros';
  linhas: number;
  iguais: number;
  mudancasAnuidades: MudancaAnuidade[];
  mudancasMinistros: MudancaMinistro[];
  /** Situação do nosso cadastro diferente da planilha. Só informa, não grava. */
  divergenciasCadastro: Array<{ matricula: number; nome: string; rol: number | null; conamad: string; aqui: string | null }>;
  duvidas: Array<{ matricula: string; nome: string; motivo: string }>;
  /** Impressão digital das mudanças: confirmar só grava se ainda for esta. */
  assinatura: string;
}

const SITUACOES_MINISTRO = new Set(['ATIVO', 'INAT', 'AGUAR']);

function assinar(p: Pick<Previa, 'mudancasAnuidades' | 'mudancasMinistros'>) {
  return createHash('sha256').update(JSON.stringify([p.mudancasAnuidades, p.mudancasMinistros])).digest('hex');
}

export type LinhaPlanilha = Record<string, unknown>;

/** `linhas` vem lida no navegador: o servidor não abre o arquivo enviado. */
export async function previaPlanilha(campoId: string, linhas: LinhaPlanilha[]): Promise<Previa> {
  if (!linhas.length) throw new ErroPlanilha('Planilha vazia.');
  const colunas = Object.keys(linhas[0] ?? {});
  const ehAnuidades = colunas.includes('ValorNaoPago') && colunas.includes('Matricula');
  const ehMinistros = colunas.includes('Situacao') && colunas.includes('Matricula') && colunas.includes('NomeCompleto');
  if (!ehAnuidades && !ehMinistros) {
    throw new ErroPlanilha('Planilha não reconhecida. Use "Anuidades (Lista geral)" ou "Lista Geral Simplificada /c Endereço", exportadas em Excel.');
  }
  const matriculas = [...new Set(linhas.map((l) => Number(l.Matricula)).filter((n) => Number.isInteger(n) && n > 0))];
  const ministros = await prisma.conamadMinistro.findMany({
    where: { campoId, matricula: { in: matriculas } },
    select: { id: true, matricula: true, nome: true, situacao: true, member: { select: { rol: true, membershipStatus: true } } },
    take: matriculas.length || 1,
  });
  const porMatricula = new Map(ministros.map((m) => [m.matricula, m]));
  const previa: Previa = { tipo: ehAnuidades ? 'anuidades' : 'ministros', linhas: linhas.length, iguais: 0, mudancasAnuidades: [], mudancasMinistros: [], divergenciasCadastro: [], duvidas: [], assinatura: '' };

  const vezes = new Map<string, number>();
  for (const l of linhas) vezes.set(String(l.Matricula ?? ''), (vezes.get(String(l.Matricula ?? '')) ?? 0) + 1);

  const conferir = (l: Record<string, unknown>) => {
    const matricula = String(l.Matricula ?? '');
    const nome = String(l.NomeCompleto ?? '');
    if ((vezes.get(matricula) ?? 0) > 1) { previa.duvidas.push({ matricula, nome, motivo: 'Matrícula repetida na planilha' }); return null; }
    const m = porMatricula.get(Number(l.Matricula));
    if (!m) { previa.duvidas.push({ matricula, nome, motivo: 'Matrícula não encontrada aqui' }); return null; }
    if (norm(m.nome) !== norm(nome)) { previa.duvidas.push({ matricula, nome, motivo: `Nome diferente do registrado: ${m.nome}` }); return null; }
    return m;
  };

  if (ehMinistros && !ehAnuidades) {
    for (const l of linhas) {
      const m = conferir(l);
      if (!m) continue;
      const para = String(l.Situacao).trim().toUpperCase();
      if (!SITUACOES_MINISTRO.has(para)) { previa.duvidas.push({ matricula: String(m.matricula), nome: m.nome, motivo: `Situação desconhecida "${para}"` }); continue; }
      if (m.situacao === para) previa.iguais++;
      else previa.mudancasMinistros.push({ id: m.id, matricula: m.matricula, nome: m.nome, de: m.situacao, para });
      const aqui = normalizarSituacaoMembro(m.member?.membershipStatus);
      const bate = SITUACAO_ESCRITA[para] === aqui;
      if (m.member && !bate) previa.divergenciasCadastro.push({ matricula: m.matricula, nome: m.nome, rol: m.member.rol ?? null, conamad: para, aqui });
    }
    previa.assinatura = assinar(previa);
    return previa;
  }

  const anos = colunas.filter((c) => /^\d{4}$/.test(c) && Number(c) >= ANO_INICIAL).map(Number);
  const registros = await prisma.conamadAnuidade.findMany({
    where: { campoId, matricula: { in: matriculas }, anoReferencia: { in: anos }, situacao: { not: CANCELADO } },
    select: { id: true, matricula: true, anoReferencia: true, situacao: true },
    take: 50001,
  });
  if (registros.length > 50000) throw new ErroPlanilha('Planilha grande demais para comparar de uma vez. Gere por igreja ou região.');
  const chave = (m: number, a: number) => `${m}|${a}`;
  const porChave = new Map<string, typeof registros>();
  for (const r of registros) {
    const k = chave(r.matricula, r.anoReferencia);
    porChave.set(k, [...(porChave.get(k) ?? []), r]);
  }
  for (const l of linhas) {
    const m = conferir(l);
    if (!m) continue;
    for (const ano of anos) {
      const codigo = String(l[String(ano)] ?? '').trim().toUpperCase();
      if (!codigo) continue;
      const para = CODIGO_SITUACAO[codigo];
      if (!para) { previa.duvidas.push({ matricula: String(m.matricula), nome: m.nome, motivo: `${ano}: situação desconhecida "${codigo}"` }); continue; }
      const achados = porChave.get(chave(m.matricula, ano)) ?? [];
      if (achados.length !== 1) { previa.duvidas.push({ matricula: String(m.matricula), nome: m.nome, motivo: `${ano}: ${achados.length} anuidades ativas aqui` }); continue; }
      if (achados[0].situacao === para) previa.iguais++;
      else previa.mudancasAnuidades.push({ id: achados[0].id, matricula: m.matricula, nome: m.nome, ano, de: achados[0].situacao, para, ...(codigo === 'ISN/ID' ? { motivo: 'Isenção por idade' } : {}) });
    }
  }
  previa.assinatura = assinar(previa);
  return previa;
}

/** Grava só o que foi revisado, no espelho CONAMAD. O cadastro de membros não é alterado aqui. */
export async function aplicarPlanilha(campoId: string, usuarioId: string | null, linhas: LinhaPlanilha[], nomeArquivo: string, assinatura: string) {
  const previa = await previaPlanilha(campoId, linhas);
  if (previa.assinatura !== assinatura) throw new ErroPlanilha('Os dados mudaram desde a comparação. Envie a planilha novamente e revise.');
  const anuidades = previa.mudancasAnuidades.map((m) => ({ id: m.id, situacao: m.para, motivo: m.motivo ?? null, limpar: m.para !== 'Isento' }));
  const ministros = previa.mudancasMinistros.map((m) => ({ id: m.id, situacao: m.para }));
  const resumo = { tipo: previa.tipo, linhas: previa.linhas, iguais: previa.iguais, anuidades: anuidades.length, ministros: ministros.length, duvidas: previa.duvidas.length };
  await prisma.$transaction([
    prisma.$executeRaw(Prisma.sql`
      UPDATE conamad_anuidades a SET situacao = x.situacao, sincronizado_em = now(),
        motivo_isencao = CASE WHEN x.limpar THEN NULL ELSE coalesce(x.motivo, a.motivo_isencao) END
      FROM jsonb_to_recordset(${JSON.stringify(anuidades)}::jsonb) AS x(id uuid, situacao text, motivo text, limpar boolean)
      WHERE a.id = x.id AND a.campo_id = ${campoId}::uuid`),
    prisma.$executeRaw(Prisma.sql`
      UPDATE conamad_ministros m SET situacao = x.situacao, sincronizado_em = now()
      FROM jsonb_to_recordset(${JSON.stringify(ministros)}::jsonb) AS x(id uuid, situacao text)
      WHERE m.id = x.id AND m.campo_id = ${campoId}::uuid`),
    prisma.conamadSincronizacao.create({ data: { campoId, usuarioId, origem: 'planilha', arquivo: nomeArquivo.slice(0, 255), resumo } }),
  ]);
  return { ...resumo, previa };
}
