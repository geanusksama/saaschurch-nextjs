/**
 * Regras puras do leitor de QR Code da Secretaria (Batismo / Consagração).
 *
 * Sem Prisma e sem imports com alias de propósito: a rota
 * /api/ecclesiastical/scan e o e2e (scripts/e2e-qrcode-secretaria.mjs) importam
 * daqui, então o teste roda em cima do código de produção e não de uma cópia.
 */

export type ScanMode = "baptism" | "consecration";

export type StageColumn = { id: number; name: string; columnIndex: number };

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CANCEL_RE = /cancel|desist|abandon|reprov/i;

/** Aceita o uuid puro, a URL completa do QR (…?c=<uuid>) ou o protocolo digitado à mão. */
export function normalizeCode(raw: string) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (UUID_RE.test(value)) return value;
  const fromUrl = value.match(/[?&]c=([0-9a-f-]{36})/i);
  if (fromUrl) return fromUrl[1];
  const anyUuid = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (anyUuid) return anyUuid[0];
  return value.toUpperCase();
}

export function detectMode(
  service: { serviceGroup?: string | null; sigla?: string | null; description?: string | null } | null,
): ScanMode | null {
  if (!service) return null;
  const group = (service.serviceGroup || "").toUpperCase();
  const text = `${service.sigla || ""} ${service.description || ""}`.toUpperCase();
  if (group === "BATISMO" || text.includes("BATISM")) return "baptism";
  if (group === "CONSAGRACAO" || text.includes("CONSAGRA")) return "consecration";
  return null;
}

/**
 * Resolve a coluna pelo nome, com índice de reserva para quando o campo
 * renomeou as colunas do pipeline.
 */
export function pickColumn(
  columns: StageColumn[],
  match: RegExp,
  exclude: RegExp,
  fallbackIndex: number,
): StageColumn | null {
  const byName = columns
    .filter((c) => match.test(c.name || "") && !exclude.test(c.name || ""))
    .sort((a, b) => b.columnIndex - a.columnIndex)[0];
  return byName || columns.find((c) => c.columnIndex === fallbackIndex) || null;
}

export function targetColumns(mode: ScanMode, columns: StageColumn[]): {
  confirm: StageColumn | null;
  abandon: StageColumn | null;
  requiredBefore: StageColumn | null;
} {
  if (mode === "consecration") {
    return {
      confirm: pickColumn(columns, /consagrad/i, CANCEL_RE, 4),
      abandon: pickColumn(columns, CANCEL_RE, /^$/, 5),
      /** Consagração só é liberada a partir de "Documentos Aprovados". */
      requiredBefore: pickColumn(columns, /documento/i, CANCEL_RE, 3),
    };
  }
  return {
    confirm: pickColumn(columns, /batiz|aprovad/i, CANCEL_RE, 2),
    abandon: pickColumn(columns, CANCEL_RE, /^$/, 3),
    requiredBefore: null,
  };
}

/**
 * Motivo pelo qual a confirmação não pode ser feita agora — nulo quando libera.
 * Regra do usuário: só consagra quem já está em "Documentos Aprovados".
 */
export function confirmBlockedReason(
  mode: ScanMode,
  card: { columnIndex: number; statusLabel?: string | null; column?: { name: string | null } | null },
  targets: ReturnType<typeof targetColumns>,
): string | null {
  const current = card.statusLabel || card.column?.name || `etapa ${card.columnIndex}`;
  if (targets.abandon && card.columnIndex === targets.abandon.columnIndex) {
    return `Este registro está em "${current}" e não pode ser confirmado.`;
  }
  if (mode === "consecration" && targets.requiredBefore && card.columnIndex !== targets.requiredBefore.columnIndex) {
    if (targets.confirm && card.columnIndex === targets.confirm.columnIndex) return null;
    return `Consagração liberada apenas na etapa "${targets.requiredBefore.name}". Este registro está em "${current}".`;
  }
  return null;
}
