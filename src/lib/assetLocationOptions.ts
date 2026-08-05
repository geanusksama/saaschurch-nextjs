/**
 * Regras do módulo Patrimônio que não dependem do Prisma — pode ser
 * importado tanto pelas rotas de API quanto pelas telas (client-side), ao
 * contrário de assetService.ts (que puxa `prisma` e só roda no servidor).
 */

/**
 * Setores/locais físicos de uma igreja onde um bem pode estar. Value é o que
 * fica salvo em `assets.location_type` (VARCHAR(20) — por isso os códigos
 * curtos); label é o texto exibido nas telas e nas etiquetas/relatórios.
 * "OUTRO" continua existindo para o que não se encaixa em nenhum — o detalhe
 * livre (`locationDetail`) complementa qualquer um desses.
 */
export const ASSET_LOCATION_OPTIONS = [
  { value: "NAVE", label: "Templo / Nave principal" },
  { value: "SALA", label: "Sala (genérica)" },
  { value: "SECRETARIA", label: "Secretaria" },
  { value: "TESOURARIA", label: "Tesouraria" },
  { value: "PASTORAL", label: "Sala pastoral" },
  { value: "REUNIAO", label: "Sala de reuniões" },
  { value: "LOUVOR", label: "Sala de louvor / ensaio" },
  { value: "MIDIA", label: "Sala de mídia / som" },
  { value: "INFANTIL", label: "Sala infantil" },
  { value: "JUVENIL", label: "Sala de jovens" },
  { value: "CASAIS", label: "Sala de casais" },
  { value: "EBD", label: "Sala de EBD" },
  { value: "BIBLIOTECA", label: "Biblioteca" },
  { value: "COZINHA", label: "Cozinha" },
  { value: "RECEPCAO", label: "Recepção / Hall" },
  { value: "BANHEIRO", label: "Banheiro" },
  { value: "DEPOSITO", label: "Depósito / Almoxarifado" },
  { value: "ESCRITORIO", label: "Escritório administrativo" },
  { value: "GARAGEM", label: "Garagem" },
  { value: "ESTACIONAMENTO", label: "Estacionamento" },
  { value: "AREA_EXTERNA", label: "Área externa / Jardim" },
  { value: "OUTRO", label: "Outro local" },
] as const;

export const ASSET_LOCATION_TYPES = ASSET_LOCATION_OPTIONS.map((o) => o.value);
export const ASSET_ACQUISITION_TYPES = ["DOACAO", "COMPRA"] as const;
export const ASSET_STATUSES = ["active", "baixado", "manutencao"] as const;

export interface AssetInput {
  name: string;
  category?: string | null;
  sector?: string | null;
  description?: string | null;
  photoUrl?: string | null;
  locationType?: string | null;
  locationDetail?: string | null;
  acquisitionType?: string | null;
  acquisitionDate?: string | null;
  value?: number | string | null;
  status?: string | null;
}

export function assetDataFromBody(body: Record<string, unknown>): AssetInput {
  const str = (v: unknown) => (v === undefined || v === null || v === "" ? null : String(v).trim());
  return {
    name: String(body.name || "").trim(),
    category: str(body.category),
    sector: str(body.sector),
    description: str(body.description),
    photoUrl: str(body.photoUrl),
    locationType: str(body.locationType) || "SALA",
    locationDetail: str(body.locationDetail),
    acquisitionType: str(body.acquisitionType),
    acquisitionDate: str(body.acquisitionDate),
    value: body.value === undefined || body.value === null || body.value === "" ? null : Number(body.value),
    status: str(body.status) || "active",
  };
}

/** Descrição legível da localização cadastrada, usada na tela de leitura do inventário. */
export function locationLabel(locationType?: string | null, locationDetail?: string | null): string {
  const typeLabel = ASSET_LOCATION_OPTIONS.find((o) => o.value === locationType)?.label || "Sala (genérica)";
  return locationDetail ? `${typeLabel} — ${locationDetail}` : typeLabel;
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Aceita o `qr_token` puro (UUID) ou uma URL com `?c=<uuid>` lida pela câmera —
 * usado tanto pela rota de scan quanto pela tela do leitor, para os dois
 * lados falarem a mesma regra.
 */
export function normalizeQrToken(raw: string): string | null {
  const value = raw.trim();
  const fromQuery = value.match(/[?&]c=([0-9a-f-]{36})/i)?.[1];
  const candidate = fromQuery || value;
  const match = candidate.match(UUID_RE);
  return match ? match[0].toLowerCase() : null;
}
