/**
 * Endereço, coordenadas e distância — usado pelo cadastro de igreja, pelo
 * cadastro de membro e pela troca de dirigente.
 *
 * Sem imports de alias e sem React de propósito: o e2e importa daqui para
 * exercitar o cálculo de distância de verdade, e não uma cópia.
 */

export interface Coords {
  latitude?: string | number | null;
  longitude?: string | number | null;
}

export interface AddressLike extends Coords {
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZipcode?: string | null;
}

/** Candidato devolvido pela busca de endereço. */
export interface LocationCandidate {
  id: string | number;
  label: string;
  lat: string;
  lon: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  zipcode: string;
}

export function normalizeZipcode(value: unknown) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 8);
}

export function formatZipcode(value: unknown) {
  const digits = normalizeZipcode(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** Número só é útil colado na rua; o resto entra na ordem que o mapa entende. */
export function buildAddressLabel(source?: AddressLike | null) {
  if (!source) return '';
  const street = [source.addressStreet, source.addressNumber].filter(Boolean).join(', ');
  return [street, source.addressNeighborhood, source.addressCity, source.addressState, source.addressZipcode, 'Brasil']
    .filter(Boolean)
    .join(', ')
    .trim();
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function hasCoords(source?: Coords | null): boolean {
  return toNumber(source?.latitude) !== null && toNumber(source?.longitude) !== null;
}

export function coordsPair(source?: Coords | null): string {
  const lat = toNumber(source?.latitude);
  const lon = toNumber(source?.longitude);
  return lat !== null && lon !== null ? `${lat},${lon}` : '';
}

/**
 * Distância em linha reta (Haversine), em quilômetros.
 *
 * É a distância "de pássaro", NÃO a rodoviária — sem chave da API de rotas do
 * Google não dá para saber a de carro. Por isso o campo no formulário é
 * editável: a secretaria pode corrigir para a distância real quando importar.
 */
export function haversineKm(a: Coords, b: Coords): number | null {
  const lat1 = toNumber(a?.latitude);
  const lon1 = toNumber(a?.longitude);
  const lat2 = toNumber(b?.latitude);
  const lon2 = toNumber(b?.longitude);
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;

  const R = 6371; // raio médio da Terra em km
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  const km = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  return Math.round(km * 100) / 100;
}

export function formatKm(value: unknown): string {
  const km = toNumber(value);
  if (km === null) return '—';
  return `${km.toFixed(2).replace('.', ',')} km`;
}

// ── Links de mapa ───────────────────────────────────────────────────────────
// Tudo sem chave de API: são as URLs públicas do Google Maps com `output=embed`,
// que é o mesmo caminho que o cadastro de igrejas já usava.

export function buildMapsLink(source?: AddressLike | null): string {
  const pair = coordsPair(source);
  if (pair) return `https://www.google.com/maps?q=${encodeURIComponent(pair)}`;
  const address = buildAddressLabel(source);
  return address ? `https://www.google.com/maps?q=${encodeURIComponent(address)}` : '';
}

export function buildMapEmbedUrl(source?: AddressLike | null, zoom = 15): string {
  const pair = coordsPair(source);
  if (pair) return `https://www.google.com/maps?q=${encodeURIComponent(pair)}&z=${zoom}&output=embed`;
  const address = buildAddressLabel(source);
  return address ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&z=${zoom}&output=embed` : '';
}

/** Minimapa com o trajeto de origem até destino. Vazio se faltar uma ponta. */
export function buildRouteEmbedUrl(from?: AddressLike | null, to?: AddressLike | null): string {
  const origem = coordsPair(from) || buildAddressLabel(from);
  const destino = coordsPair(to) || buildAddressLabel(to);
  if (!origem || !destino) return '';
  return `https://www.google.com/maps?saddr=${encodeURIComponent(origem)}&daddr=${encodeURIComponent(destino)}&output=embed`;
}

/** Mesmo trajeto, para abrir no Google numa aba nova. */
export function buildRouteLink(from?: AddressLike | null, to?: AddressLike | null): string {
  const origem = coordsPair(from) || buildAddressLabel(from);
  const destino = coordsPair(to) || buildAddressLabel(to);
  if (!origem || !destino) return '';
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origem)}&destination=${encodeURIComponent(destino)}`;
}

// ── Consultas externas ──────────────────────────────────────────────────────

export interface ZipcodeResult {
  addressZipcode: string;
  addressStreet: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  addressComplement: string;
}

/** ViaCEP. Lança com mensagem pronta para a tela. */
export async function lookupZipcode(rawZipcode: unknown): Promise<ZipcodeResult> {
  const zipcode = normalizeZipcode(rawZipcode);
  if (zipcode.length !== 8) throw new Error('Informe um CEP válido com 8 dígitos.');

  const response = await fetch(`https://viacep.com.br/ws/${zipcode}/json/`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.erro) throw new Error('CEP não encontrado.');

  return {
    addressZipcode: formatZipcode(zipcode),
    addressStreet: payload.logradouro || '',
    addressNeighborhood: payload.bairro || '',
    addressCity: payload.localidade || '',
    addressState: String(payload.uf || '').toUpperCase(),
    addressComplement: payload.complemento || '',
  };
}

/** Nominatim (OpenStreetMap). Devolve lista vazia quando não acha. */
export async function searchAddress(query: string): Promise<LocationCandidate[]> {
  const termo = String(query || '').trim();
  if (!termo) throw new Error('Informe um endereço ou CEP para localizar no mapa.');

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&countrycodes=br&q=${encodeURIComponent(termo)}`
  );
  if (!response.ok) throw new Error('Falha ao pesquisar endereço.');
  const payload = await response.json().catch(() => []);
  if (!Array.isArray(payload)) return [];

  return payload.map((item: Record<string, unknown>) => {
    const address = (item.address ?? {}) as Record<string, string>;
    return {
      id: item.place_id as string | number,
      label: String(item.display_name ?? ''),
      lat: String(item.lat ?? ''),
      lon: String(item.lon ?? ''),
      street: [address.road, address.house_number].filter(Boolean).join(', '),
      neighborhood: address.suburb || address.neighbourhood || address.quarter || '',
      city: address.city || address.town || address.village || address.municipality || '',
      state: address.state_code || address.state || '',
      zipcode: address.postcode || '',
    };
  });
}
