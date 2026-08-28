/**
 * Shared helpers for Next.js Route Handlers
 */
import { AuthUser } from "./auth";

export function serializeBigInts(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeBigInts);
  // Prisma Decimal (decimal.js) — converte para número antes de serializar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (value !== null && typeof value === "object" && typeof (value as any).toNumber === "function") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (value as any).toNumber();
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, serializeBigInts(v)])
    );
  }
  return value;
}

export function normalizeRoleName(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isRestrictedToOwnChurch(user: AuthUser) {
  if (user.profileType === "church") return true;
  const n = normalizeRoleName(user.roleName || "");
  return n.includes("secret") || n.includes("tesour");
}

export function isFieldAdmin(user: AuthUser) {
  return user.profileType === "admin" && Boolean(user.campoId) && Boolean((user.profile as Record<string, unknown>)?.id);
}

export function roleClassOf(user: AuthUser) {
  const n = normalizeRoleName(user.roleName || "");
  if (n.includes("secret")) return "secretary";
  if (n.includes("tesour")) return "treasurer";
  return "other";
}

export function isAtHeadquartersChurch(user: AuthUser) {
  return Boolean(user.churchId) && !user.parentChurchId;
}

export function resolveScopedFieldId(user: AuthUser, requestedFieldId?: string) {
  if (isRestrictedToOwnChurch(user) && user.campoId) return user.campoId;
  if (user.profileType !== "master" && user.profileType !== "admin" && user.campoId) {
    return requestedFieldId || user.campoId;
  }
  return requestedFieldId || null;
}

export function getManagedCampoId(user: AuthUser) {
  if (user.profileType === "admin" && user.campoId) return user.campoId;
  return null;
}

export function kanScopeFilter(user: AuthUser) {
  const pt = user.profileType;
  if (pt === "master") return {};

  // All non-master users must be restricted to their own campo
  if (!user.campoId) {
    return { churchId: "00000000-0000-0000-0000-000000000000" };
  }

  const baseFilter = { church: { regional: { campoId: user.campoId } } };

  const isSecret = roleClassOf(user) === "secretary";
  const isTesour = roleClassOf(user) === "treasurer";
  const isAtSede = isAtHeadquartersChurch(user);
  const seesAllInCampo =
    pt === "admin" ||
    pt === "campo" ||
    (pt === "church" && isAtSede && !isSecret && !isTesour);

  if (seesAllInCampo) {
    return baseFilter;
  }

  if (pt === "church" || isRestrictedToOwnChurch(user)) {
    if (user.churchId) {
      return { churchId: user.churchId };
    }
    // Restricted to own church but has no churchId assigned
    return { churchId: "00000000-0000-0000-0000-000000000000" };
  }

  return baseFilter;
}

export function buildProtocol(sigla: string) {
  const year = new Date().getFullYear();
  const prefix = crypto.randomUUID().replace(/-/g, '').substring(0, 5).toUpperCase();
  return `${prefix}-${sigla}-${year}`;
}

export function parseDateValue(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return new Date(value as string);
}

export function parseNumberValue(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return Number(value);
}

export async function assertChurchAccess(
  user: AuthUser,
  churchId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any
): Promise<boolean> {
  if (user.profileType === "master" || user.profileType === "admin") return true;
  if (!isRestrictedToOwnChurch(user)) return true;
  if (user.churchId === churchId) return true;
  return false;
}

export function isPastMonth(year: number, month: number): boolean {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "numeric",
    });
    const parts = formatter.formatToParts(new Date());
    const yPart = parts.find((p) => p.type === "year")?.value;
    const mPart = parts.find((p) => p.type === "month")?.value;

    if (yPart && mPart) {
      const y = Number(yPart);
      const m = Number(mPart);
      if (year < y) return true;
      if (year === y && month < m) return true;
      return false;
    }
  } catch (e) {
    // Ignore and fallback
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (year < y) return true;
  if (year === y && month < m) return true;
  return false;
}


/**
 * Teto da fila dos painéis de fluxo (batismo/consagração/transferência).
 *
 * O recorte por data já corta a fila para dezenas de linhas; este teto só
 * existe para o caso de o usuário limpar as duas datas, que sem ele traria a
 * tabela inteira de volta.
 *
 * Vale para as telas de lista, nunca para quem precisa da base fechada:
 * relatórios pedem `all=1` e recebem tudo (ver kanQueueTake). Um teto calado
 * num relatório seria pior do que a lentidão que ele evita.
 */
export const KAN_QUEUE_CAP = 2000;

/**
 * `take` da fila: `all=1` desliga o teto, para os relatórios, que agregam sobre
 * a base inteira e não podem receber um recorte silencioso. O +1 serve para o
 * chamador detectar que houve corte sem pagar uma segunda contagem.
 */
export function kanQueueTake(sp: URLSearchParams): number | undefined {
  return sp.get("all") === "1" ? undefined : KAN_QUEUE_CAP + 1;
}

/**
 * Recorte por data dos painéis de fluxo, lido da query string.
 *
 * As telas de batismo, consagração e transferência sempre filtraram a fila por
 * `openedAt`, com o mês corrente como padrão — só que no navegador. O servidor
 * mandava a tabela inteira e o front descartava o resto: 23.243 cards de
 * batismo trafegados (35 MB) para exibir os 51 do mês.
 *
 * A semântica aqui é a mesma que o front aplicava em `dateInRange`: compara a
 * data UTC de `openedAt` com limites inclusivos nas duas pontas. Igual de
 * propósito — os filtros do cliente continuam no lugar, e nenhuma linha que
 * aparecia antes pode sumir por causa deste recorte.
 *
 * Sem intervalo informado não há recorte; quem segura a resposta é KAN_QUEUE_CAP.
 */
export function kanQueueWindow(sp: URLSearchParams): Record<string, unknown> {
  const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const from = (sp.get("dateFrom") || "").trim();
  const to = (sp.get("dateTo") || "").trim();

  const range: Record<string, Date> = {};
  if (isDate(from)) range.gte = new Date(`${from}T00:00:00.000Z`);
  if (isDate(to)) range.lte = new Date(`${to}T23:59:59.999Z`);

  return Object.keys(range).length > 0 ? { openedAt: range } : {};
}
