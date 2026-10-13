/**
 * Campo ativo — a regra de isolamento entre campos.
 *
 * O campo ativo do usuário é `users.campo_id` (AuthUser.campoId). A troca de
 * campo (context-switcher/verify-field) grava esse valor, então ele é a única
 * fonte de verdade. Vale para TODOS os perfis, inclusive o master: estando no
 * campo Aguaí, nada de Campinas aparece, e vice-versa.
 *
 * Duas camadas usam isto:
 *  - `barreiraDeCampo`, chamada pelo withAuth em toda rota autenticada: recusa
 *    filtro de querystring (campoId, churchId, regionalId...) que aponte para
 *    fora do campo ativo. Pega também a rota que ainda não força o campo.
 *  - as rotas, que montam o `where` com `igrejaDoCampoWhere` / `campoAtivoId`
 *    em vez de liberar tudo para o master.
 *
 * No navegador (supabase-js) quem faz o mesmo é o RLS: fn_meu_campo_id() /
 * fn_igrejas_do_meu_campo(), migration 20261013120000_isolamento_campo.
 */
import { NextResponse } from "next/server";
import type { AuthUser } from "./auth";
import { prisma } from "./prisma";

/** Id que não casa com nada: devolve lista vazia sem estourar a query. */
export const NENHUM_ID = "00000000-0000-0000-0000-000000000000";

/** Campo ativo do usuário, ou o id nulo quando ele não tem campo. */
export function campoAtivoId(user: AuthUser): string {
  return user.campoId || NENHUM_ID;
}

/** `where` de Church restrito ao campo ativo (Prisma). */
export function igrejaDoCampoWhere(user: AuthUser) {
  return { regional: { campoId: campoAtivoId(user) } };
}

/** A igreja pertence ao campo ativo? Para rotas que recebem um id. */
export async function igrejaNoCampoAtivo(user: AuthUser, churchId: string | null | undefined) {
  if (!churchId || !user.campoId) return false;
  const igreja = await prisma.church.findFirst({
    where: { id: churchId, regional: { campoId: user.campoId } },
    select: { id: true },
  });
  return Boolean(igreja);
}

// ─── Barreira de querystring ────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PARAMS_CAMPO = ["campoId", "fieldId", "campo_id", "field_id"];
const PARAMS_IGREJA = ["churchId", "church_id", "churchIds", "igrejaId", "igreja_id", "hostChurchId"];
const PARAMS_REGIONAL = ["regionalId", "regional_id", "regionalIds"];

/**
 * Rotas de ESTRUTURA (nomes de campo/regional/igreja, cadastro de usuário),
 * que o master usa para configurar outro campo — criar a usuária de Aguaí
 * estando em Campinas, por exemplo. Nenhuma delas devolve membro, lançamento
 * ou qualquer dado de trabalho; a própria rota confere o perfil.
 */
const ROTAS_DE_ESTRUTURA = [
  /^\/api\/regionais\/?$/,
  /^\/api\/churches\/?$/,
  /^\/api\/campos(\/|$)/,
  /^\/api\/users(\/|$)/,
  /^\/api\/context-switcher(\/|$)/,
];

function idsDoParametro(sp: URLSearchParams, nomes: string[]) {
  const ids: string[] = [];
  for (const nome of nomes) {
    for (const valor of sp.getAll(nome)) {
      for (const parte of valor.split(",")) {
        const id = parte.trim();
        if (UUID.test(id)) ids.push(id.toLowerCase());
      }
    }
  }
  return Array.from(new Set(ids));
}

function foraDoCampo(nome: string) {
  return NextResponse.json(
    {
      error: `O filtro de ${nome} aponta para outro campo. Troque de campo para ver esses dados.`,
      code: "FORA_DO_CAMPO",
    },
    { status: 403 },
  );
}

/**
 * Devolve uma resposta 403 quando algum filtro da URL sai do campo ativo, ou
 * null quando está tudo dentro. Sem campo ativo não há o que conferir aqui: as
 * rotas já negam acesso a quem não tem campo.
 */
export async function barreiraDeCampo(user: AuthUser, url: string): Promise<NextResponse | null> {
  if (!user.campoId) return null;

  const { pathname, searchParams } = new URL(url);
  if (master(user) && ROTAS_DE_ESTRUTURA.some((r) => r.test(pathname))) return null;

  const campoAtivo = user.campoId.toLowerCase();
  const campos = idsDoParametro(searchParams, PARAMS_CAMPO);
  if (campos.some((id) => id !== campoAtivo)) return foraDoCampo("campo");

  const igrejas = idsDoParametro(searchParams, PARAMS_IGREJA);
  const regionais = idsDoParametro(searchParams, PARAMS_REGIONAL);
  if (!igrejas.length && !regionais.length) return null;

  const [igrejasOk, regionaisOk] = await Promise.all([
    igrejas.length
      ? prisma.church.count({ where: { id: { in: igrejas }, regional: { campoId: user.campoId } } })
      : 0,
    regionais.length
      ? prisma.regional.count({ where: { id: { in: regionais }, campoId: user.campoId } })
      : 0,
  ]);
  if (igrejasOk !== igrejas.length) return foraDoCampo("igreja");
  if (regionaisOk !== regionais.length) return foraDoCampo("regional");
  return null;
}

function master(user: AuthUser) {
  return user.profileType === "master";
}

/** A sede (legacy_church_headquarters) é do campo ativo? */
export async function sedeNoCampoAtivo(user: AuthUser, headquartersId: string | null | undefined) {
  if (!headquartersId || !user.campoId) return false;
  const sede = await prisma.legacyChurchHeadquarters.findFirst({
    where: { id: headquartersId, fieldId: user.campoId },
    select: { id: true },
  });
  return Boolean(sede);
}

/** O horário (church_schedules) ou o acesso (church_access_infos) é de uma sede do campo ativo? */
export async function itemDaSedeNoCampoAtivo(
  user: AuthUser,
  tipo: "horario" | "acesso",
  itemId: string | null | undefined,
) {
  if (!itemId) return false;
  const item =
    tipo === "horario"
      ? await prisma.churchSchedule.findUnique({ where: { id: itemId }, select: { headquartersId: true } })
      : await prisma.churchAccessInfo.findUnique({ where: { id: itemId }, select: { headquartersId: true } });
  return sedeNoCampoAtivo(user, item?.headquartersId);
}

/**
 * Filtro `campoId` para tabelas que guardam o campo direto (culto_registros,
 * por exemplo). Master sem campo: sem filtro; qualquer outro sem campo: nada.
 */
export function filtroDoCampoAtivo(user: AuthUser): { campoId?: string } {
  if (user.campoId) return { campoId: user.campoId };
  return user.profileType === "master" ? {} : { campoId: NENHUM_ID };
}

/** A regional é do campo ativo? */
export async function regionalNoCampoAtivo(user: AuthUser, regionalId: string | null | undefined) {
  if (!regionalId || !user.campoId) return false;
  const regional = await prisma.regional.findFirst({
    where: { id: regionalId, campoId: user.campoId },
    select: { id: true },
  });
  return Boolean(regional);
}
