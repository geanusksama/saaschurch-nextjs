import { prisma } from '@/lib/prisma';
import { LIMITE_LINHAS, type Linha } from './tipos';

/**
 * Peças comuns das consultas. Os filtros chegam como texto da querystring e
 * entram SEMPRE como parâmetro ($n) — nunca concatenados no SQL.
 */

/** Hoje em Brasília (o banco e o servidor rodam em UTC). */
export const HOJE = "(now() at time zone 'America/Sao_Paulo')::date";

export type Filtros = Record<string, string>;

export type Executor = (relId: string, campoId: string, f: Filtros) => Promise<Linha[]>;

export class Sql {
  params: unknown[] = [];
  p(v: unknown) { this.params.push(v); return `$${this.params.length}`; }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuid = (v: string | undefined) => (v && UUID.test(v) ? v : undefined);

export async function consultar(sql: string, params: unknown[]): Promise<Linha[]> {
  const linhas = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`${sql} limit ${LIMITE_LINHAS}`, ...params);
  return linhas.map((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, normalizar(v)])));
}

function normalizar(v: unknown): string | number | null {
  if (v == null) return null;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object' && 'toNumber' in (v as object)) return (v as { toNumber: () => number }).toNumber();
  return String(v);
}


/** Condições comuns de pessoa: campo ativo, igreja, regional, zona e situação. */
export function ondePessoa(s: Sql, campoId: string, f: Filtros, alias = 'm'): string[] {
  const onde = [`r.campo_id = ${s.p(campoId)}::uuid`, `${alias}.deleted_at is null`];
  if (uuid(f.igreja)) onde.push(`${alias}.church_id = ${s.p(f.igreja)}::uuid`);
  if (uuid(f.regional)) onde.push(`c.regional_id = ${s.p(f.regional)}::uuid`);
  if (f.zona?.trim()) onde.push(`c.zone = ${s.p(f.zona.trim())}`);
  if (f.situacao === 'ativos') onde.push(`${alias}.membership_status = 'ATIVO'`);
  if (f.situacao === 'inativos') onde.push(`coalesce(${alias}.membership_status,'') <> 'ATIVO'`);
  return onde;
}

/** Joins de pessoa → igreja → regional (para o filtro de campo). */
export const JOIN_PESSOA = 'join churches c on c.id = m.church_id join regionais r on r.id = c.regional_id';
export const IGREJA_TXT = "c.code || ' - ' || c.name";
export const CARGO_TXT = "coalesce(et.name, m.ecclesiastical_title, 'Membro')";
export const JOIN_CARGO = 'left join ecclesiastical_titles et on et.id = m.ecclesiastical_title_id';
