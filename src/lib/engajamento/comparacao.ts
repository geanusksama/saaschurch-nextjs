/**
 * Comparação de presença entre dois períodos (Engajamento), pelas FOTOS que a
 * igreja posta no Instagram.
 *
 * Uma pessoa "esteve" num culto quando aparece em alguma foto de publicação
 * daquele dia — achada pelo reconhecimento de rosto (engajamento_rostos →
 * engajamento_pessoas) ou marcada à mão (engajamento_marcacoes).
 *
 * Quem é "a mesma pessoa" no relatório:
 *  - pessoa ligada a um membro do cadastro → o membro (rosto e marcação somam);
 *  - pessoa do reconhecimento sem membro → ela mesma (com ou sem nome);
 *  - marcação à mão sem membro → o nome digitado.
 *
 * Conta CULTOS (dias distintos com foto), não fotos. O resultado é indicador
 * para a equipe conferir: não aparecer em foto não prova que não foi.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type Situacao = 'AUSENTE' | 'DIMINUIU' | 'CONSTANTE' | 'VOLTOU' | 'NOVO';

export interface Periodos {
  refIni: string; // YYYY-MM-DD, inclusivo
  refFim: string;
  recIni: string;
  recFim: string;
}

export interface FiltroComparacao extends Periodos {
  campoId: string;
  soDomingos: boolean;
}

export interface LinhaComparacao {
  chave: string;
  pessoaId: string | null;
  memberId: string | null;
  nome: string | null;
  foto: string | null;
  rol: number | null;
  celular: string | null;
  diasRef: number;
  diasRec: number;
  ultimaPresenca: string | null;
  situacao: Situacao;
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

export function validarPeriodos(p: Partial<Periodos>): string | null {
  for (const k of ['refIni', 'refFim', 'recIni', 'recFim'] as const) {
    if (!p[k] || !DIA.test(p[k]!)) return 'Informe as datas dos dois períodos.';
  }
  if (p.refIni! > p.refFim! || p.recIni! > p.recFim!) return 'A data inicial não pode ser depois da final.';
  if (p.refFim! >= p.recIni!) return 'O período de referência tem de terminar antes do período recente.';
  return null;
}

function dias(ini: string, fim: string) {
  return Math.round((Date.parse(fim) - Date.parse(ini)) / 86_400_000) + 1;
}

/** Ritmo = cultos com presença por 30 dias; "diminuiu" é cair para menos da metade. */
export function classificar(diasRef: number, diasRec: number, diasAntes: number, p: Periodos): Situacao {
  if (diasRef > 0 && diasRec === 0) return 'AUSENTE';
  if (diasRef > 0) {
    const ritmoRef = (diasRef / dias(p.refIni, p.refFim)) * 30;
    const ritmoRec = (diasRec / dias(p.recIni, p.recFim)) * 30;
    return ritmoRec < ritmoRef * 0.5 ? 'DIMINUIU' : 'CONSTANTE';
  }
  return diasAntes > 0 ? 'VOLTOU' : 'NOVO';
}

/** Até 12 meses antes da referência, só para separar "voltou" de "novo". */
function inicioAntes(refIni: string) {
  const d = new Date(`${refIni}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

/** CTE `todas`: (chave, dia, pessoa_id, member_id, nome_livre, publicacao_id, rosto_foto) no intervalo. */
function presencas(f: FiltroComparacao, desde: string, ate: string) {
  const domingo = f.soDomingos ? Prisma.sql`AND extract(dow FROM pub.data_evento) = 0` : Prisma.empty;
  return Prisma.sql`
    rostos AS (
      SELECT CASE WHEN pe.member_id IS NOT NULL THEN 'm:' || pe.member_id ELSE 'p:' || pe.id END AS chave,
             pub.data_evento AS dia, pe.id AS pessoa_id, pe.member_id, NULL::text AS nome_livre,
             pub.id AS publicacao_id, r.foto_url AS rosto_foto
        FROM engajamento_rostos r
        JOIN engajamento_pessoas pe ON pe.id = r.pessoa_id AND NOT pe.oculta
        JOIN engajamento_publicacoes pub ON pub.id = r.publicacao_id AND pub.deleted_at IS NULL
       WHERE r.campo_id = ${f.campoId}::uuid
         AND pub.data_evento BETWEEN ${desde}::date AND ${ate}::date ${domingo}
    ),
    marcadas AS (
      SELECT CASE WHEN mk.member_id IS NOT NULL THEN 'm:' || mk.member_id ELSE 'n:' || lower(trim(mk.nome)) END AS chave,
             pub.data_evento AS dia, NULL::uuid AS pessoa_id, mk.member_id, mk.nome AS nome_livre,
             pub.id AS publicacao_id, NULL::text AS rosto_foto
        FROM engajamento_marcacoes mk
        JOIN engajamento_publicacoes pub ON pub.id = mk.publicacao_id AND pub.deleted_at IS NULL
       WHERE pub.campo_id = ${f.campoId}::uuid
         AND pub.data_evento BETWEEN ${desde}::date AND ${ate}::date ${domingo}
    ),
    todas AS (SELECT * FROM rostos UNION ALL SELECT * FROM marcadas)`;
}

export async function comparar(f: FiltroComparacao): Promise<LinhaComparacao[]> {
  const rows = await prisma.$queryRaw<Array<{
    chave: string; pessoa_id: string | null; member_id: string | null; nome: string | null; foto: string | null;
    rol: number | null; celular: string | null;
    dias_ref: number; dias_rec: number; dias_antes: number; ultima: Date | null;
  }>>(Prisma.sql`
    WITH ${presencas(f, inicioAntes(f.refIni), f.recFim)},
    por_chave AS (
      SELECT chave,
             (array_agg(pessoa_id) FILTER (WHERE pessoa_id IS NOT NULL))[1] AS pessoa_id,
             (array_agg(member_id) FILTER (WHERE member_id IS NOT NULL))[1] AS member_id,
             min(nome_livre) AS nome_livre,
             count(DISTINCT dia) FILTER (WHERE dia BETWEEN ${f.refIni}::date AND ${f.refFim}::date)::int AS dias_ref,
             count(DISTINCT dia) FILTER (WHERE dia BETWEEN ${f.recIni}::date AND ${f.recFim}::date)::int AS dias_rec,
             count(DISTINCT dia) FILTER (WHERE dia < ${f.refIni}::date)::int AS dias_antes,
             max(dia) AS ultima
        FROM todas
       GROUP BY chave
    )
    SELECT pc.chave, pc.pessoa_id, pc.member_id,
           coalesce(m.full_name, pe.nome, pc.nome_livre) AS nome,
           pe.foto_url AS foto, m.rol, coalesce(m.mobile, m.phone) AS celular,
           pc.dias_ref, pc.dias_rec, pc.dias_antes, pc.ultima
      FROM por_chave pc
      LEFT JOIN members m ON m.id = pc.member_id
      LEFT JOIN engajamento_pessoas pe ON pe.id = pc.pessoa_id
     WHERE pc.dias_ref > 0 OR pc.dias_rec > 0
     ORDER BY nome NULLS LAST
     LIMIT 5000`);

  return rows.map((r) => ({
    chave: r.chave,
    pessoaId: r.pessoa_id,
    memberId: r.member_id,
    nome: r.nome,
    foto: r.foto,
    rol: r.rol,
    celular: r.celular,
    diasRef: r.dias_ref,
    diasRec: r.dias_rec,
    ultimaPresenca: r.ultima ? r.ultima.toISOString().slice(0, 10) : null,
    situacao: classificar(r.dias_ref, r.dias_rec, r.dias_antes, f),
  }));
}

export interface EventoLinhaDoTempo {
  dia: string;
  fonte: 'ROSTO' | 'MARCACAO';
  publicacaoId: string;
  titulo: string | null;
  permalink: string | null;
  imagem: string | null;
  rosto: string | null;
}

/** Cada culto em que a pessoa aparece, mais recente primeiro, com a foto. */
export async function linhaDoTempo(f: FiltroComparacao, chave: string): Promise<EventoLinhaDoTempo[]> {
  const rows = await prisma.$queryRaw<Array<{
    dia: Date; fonte: 'ROSTO' | 'MARCACAO'; publicacao_id: string; titulo: string | null; permalink: string | null; imagem: string | null; rosto: string | null;
  }>>(Prisma.sql`
    WITH ${presencas(f, inicioAntes(f.refIni), f.recFim)}
    SELECT DISTINCT ON (t.publicacao_id) t.dia, CASE WHEN t.pessoa_id IS NULL THEN 'MARCACAO' ELSE 'ROSTO' END AS fonte,
           t.publicacao_id, coalesce(p.titulo, left(p.legenda, 80)) AS titulo, p.permalink,
           p.imagens->0->>'url' AS imagem, t.rosto_foto AS rosto
      FROM todas t
      JOIN engajamento_publicacoes p ON p.id = t.publicacao_id
     WHERE t.chave = ${chave}
     ORDER BY t.publicacao_id, t.rosto_foto NULLS LAST
     LIMIT 300`);
  return rows
    .map((r) => ({
      dia: r.dia.toISOString().slice(0, 10),
      fonte: r.fonte,
      publicacaoId: r.publicacao_id,
      titulo: r.titulo,
      permalink: r.permalink,
      imagem: r.imagem,
      rosto: r.rosto,
    }))
    .sort((a, b) => b.dia.localeCompare(a.dia));
}
