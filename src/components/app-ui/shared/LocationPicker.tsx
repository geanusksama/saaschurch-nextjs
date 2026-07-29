import { useState } from 'react';
import { ExternalLink, Loader2, MapPin, Search, X } from 'lucide-react';
import {
  buildAddressLabel,
  buildMapEmbedUrl,
  buildMapsLink,
  hasCoords,
  searchAddress,
  type AddressLike,
  type LocationCandidate,
} from '../../../lib/geo';

export interface LocationValue {
  latitude: string;
  longitude: string;
}

interface LocationPickerProps {
  value: LocationValue;
  /** Endereço já preenchido no formulário — vira a busca inicial. */
  address: AddressLike;
  onChange: (next: LocationValue & { address?: Partial<AddressLike> }) => void;
  /** Quando true, preenche também os campos de endereço vazios do formulário. */
  fillAddress?: boolean;
}

/**
 * Bloco "Localidade" do cadastro de membro — mesmo comportamento do cadastro de
 * igreja: acha as coordenadas pelo endereço/CEP ou escolhendo no mapa.
 *
 * As coordenadas ficam no membro porque a troca de dirigente precisa delas para
 * calcular a distância até a igreja. Endereço em texto não serve: mudança de
 * grafia já quebraria o cálculo.
 */
export function LocationPicker({ value, address, onChange, fillAddress = true }: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultados, setResultados] = useState<LocationCandidate[]>([]);
  const [previa, setPrevia] = useState<LocationCandidate | null>(null);

  const definido = hasCoords(value);
  const rotulo = buildAddressLabel(address);

  async function procurar(termo?: string) {
    const alvo = String(termo ?? busca ?? rotulo).trim();
    if (!alvo) {
      setErro('Preencha o endereço ou o CEP antes de localizar no mapa.');
      return;
    }
    setCarregando(true);
    setErro('');
    setBusca(alvo);
    try {
      const achados = await searchAddress(alvo);
      setResultados(achados);
      setPrevia(achados[0] || null);
      if (!achados.length) setErro('Nenhum endereço encontrado para essa busca.');
    } catch (e) {
      setResultados([]);
      setPrevia(null);
      setErro(e instanceof Error ? e.message : 'Falha ao localizar endereço.');
    } finally {
      setCarregando(false);
    }
  }

  function aplicar(candidato: LocationCandidate | null) {
    if (!candidato) return;
    onChange({
      latitude: String(candidato.lat ?? ''),
      longitude: String(candidato.lon ?? ''),
      // só completa o que está em branco — nunca sobrescreve o que foi digitado
      address: fillAddress
        ? {
            addressStreet: address.addressStreet || candidato.street || '',
            addressNeighborhood: address.addressNeighborhood || candidato.neighborhood || '',
            addressCity: address.addressCity || candidato.city || '',
            addressState: address.addressState || candidato.state || '',
          }
        : undefined,
    });
    setOpen(false);
  }

  function abrir() {
    setOpen(true);
    setErro('');
    setResultados([]);
    setPrevia(null);
    const inicial = rotulo;
    setBusca(inicial);
    if (inicial) void procurar(inicial);
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <MapPin className="h-4 w-4 text-blue-600" />
            Localidade
            {definido ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                definida
              </span>
            ) : (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                não definida
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={abrir}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Localizar no mapa
            </button>
            {definido ? (
              <button
                type="button"
                onClick={() => onChange({ latitude: '', longitude: '' })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Limpar
              </button>
            ) : null}
          </div>
        </div>

        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Usada para calcular a distância até a igreja na troca de dirigente. Preencha o CEP acima e clique em
          Localizar no mapa.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Latitude
            <input
              value={value.latitude}
              onChange={(e) => onChange({ ...value, latitude: e.target.value })}
              placeholder="-22.9056"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Longitude
            <input
              value={value.longitude}
              onChange={(e) => onChange({ ...value, longitude: e.target.value })}
              placeholder="-47.0608"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
        </div>

        {definido ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <iframe
              title="Localização do membro"
              src={buildMapEmbedUrl(value, 16)}
              className="h-40 w-full bg-slate-100"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <a
              href={buildMapsLink(value)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 border-t border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:underline dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir no Google Maps
            </a>
          </div>
        ) : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Localizar endereço no mapa</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pesquise pelo endereço ou CEP e escolha o ponto para gravar as coordenadas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid flex-1 gap-4 overflow-hidden p-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
              <div className="flex min-h-0 flex-col gap-3">
                <div className="flex gap-2">
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void procurar();
                      }
                    }}
                    placeholder="Rua, bairro, cidade ou CEP"
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => void procurar()}
                    disabled={carregando}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Buscar
                  </button>
                </div>

                {erro ? <p className="text-xs text-rose-600">{erro}</p> : null}

                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  {resultados.length ? (
                    resultados.map((candidato) => (
                      <button
                        key={candidato.id}
                        type="button"
                        onClick={() => aplicar(candidato)}
                        onMouseEnter={() => setPrevia(candidato)}
                        className={`flex w-full flex-col items-start gap-1 border-b border-slate-200 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 ${
                          previa?.id === candidato.id ? 'bg-slate-50 dark:bg-slate-800/60' : ''
                        }`}
                      >
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {candidato.street || candidato.city || 'Endereço localizado'}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{candidato.label}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-purple-600">
                          Usar estas coordenadas
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                      {carregando ? 'Procurando...' : 'Pesquise por CEP ou endereço para ver as opções.'}
                    </p>
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                <iframe
                  title="Prévia do endereço"
                  src={
                    previa
                      ? buildMapEmbedUrl({ latitude: previa.lat, longitude: previa.lon }, 16)
                      : buildMapEmbedUrl(hasCoords(value) ? value : address, 15)
                  }
                  className="h-full min-h-[320px] w-full bg-slate-100"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => aplicar(previa)}
                disabled={!previa}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Aplicar localização
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
