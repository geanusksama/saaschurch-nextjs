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
  const isSecret = roleClassOf(user) === "secretary";
  const isTesour = roleClassOf(user) === "treasurer";
  const isAtSede = isAtHeadquartersChurch(user);
  const seesAllInCampo =
    pt === "admin" ||
    pt === "campo" ||
    (pt === "church" && isAtSede && !isSecret && !isTesour);

  if (pt === "master") return {};
  if (seesAllInCampo && user.campoId) {
    return { church: { regional: { campoId: user.campoId } } };
  }
  if (pt === "church" || isRestrictedToOwnChurch(user)) {
    if (user.churchId) return { churchId: user.churchId };
    return {};
  }
  if (user.campoId) return { church: { regional: { campoId: user.campoId } } };
  return {};
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
    const tzDateStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const [day, m, y] = tzDateStr.split('/').map(Number);
    if (year < y) return true;
    if (year === y && month < m) return true;
  } catch (e) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    if (year < y) return true;
    if (year === y && month < m) return true;
  }
  return false;
}

