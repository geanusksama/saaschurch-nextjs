/**
 * "Anexar pessoas" — monta o público-alvo da campanha.
 *
 * Os filtros são independentes e se somam: escolher duas regionais e três
 * igrejas dentro delas devolve só essas três igrejas. Cada bloco tem
 * "Marcar todos / Desmarcar todos", e a lista de igrejas obedece as regionais
 * e zonas já escolhidas — assim não dá para marcar uma igreja que o filtro de
 * cima acabou de excluir.
 *
 * As opções vêm do servidor já limitadas ao acesso do usuário: quem só enxerga
 * a própria igreja não vê as outras nem aqui.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';

interface Opcao {
  value: string;
  label: string;
  hint?: string;
}

interface AudienceOptions {
  regionais: { id: string; name: string }[];
  churches: { id: string; name: string; zone: string | null; regionalId: string; regionalName: string | null }[];
  zones: string[];
  titles: { id: string; name: string }[];
  statuses: { value: string; count: number }[];
}

export interface AudienceMemberPreview {
  memberId: string;
  name: string;
  phone: string | null;
  rol: number | null;
  churchName: string;
  regionalName: string | null;
  zone: string | null;
  titleName: string | null;
  status: string | null;
}

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/** Bloco de seleção múltipla com marcar/desmarcar todos e busca interna. */
function BlocoFiltro({
  titulo,
  opcoes,
  selecionados,
  onChange,
  busca = false,
}: {
  titulo: string;
  opcoes: Opcao[];
  selecionados: string[];
  onChange: (v: string[]) => void;
  busca?: boolean;
}) {
  const [q, setQ] = useState('');
  const visiveis = useMemo(() => {
    const termo = q.trim().toLowerCase();
    return termo ? opcoes.filter(o => o.label.toLowerCase().includes(termo)) : opcoes;
  }, [opcoes, q]);

  const todosVisiveisMarcados = visiveis.length > 0 && visiveis.every(o => selecionados.includes(o.value));

  const alternarTodos = () => {
    const idsVisiveis = visiveis.map(o => o.value);
    onChange(
      todosVisiveisMarcados
        ? selecionados.filter(v => !idsVisiveis.includes(v))
        : Array.from(new Set([...selecionados, ...idsVisiveis]))
    );
  };

  const alternar = (v: string) =>
    onChange(selecionados.includes(v) ? selecionados.filter(x => x !== v) : [...selecionados, v]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-700">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {titulo}
          {selecionados.length ? (
            <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
              {selecionados.length}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={alternarTodos}
          disabled={!visiveis.length}
          className="text-[11px] font-semibold text-purple-600 hover:underline disabled:opacity-40 dark:text-purple-400"
        >
          {todosVisiveisMarcados ? 'Desmarcar todos' : 'Marcar todos'}
        </button>
      </div>

      {busca ? (
        <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-700">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Filtrar..."
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-2 text-xs text-slate-700 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
        </div>
      ) : null}

      <div className="max-h-52 overflow-y-auto p-2">
        {!visiveis.length ? (
          <p className="px-1 py-3 text-center text-xs text-slate-400">Nada aqui.</p>
        ) : (
          visiveis.map(o => {
            const marcado = selecionados.includes(o.value);
            return (
              <label
                key={o.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60"
              >
                <span
                  className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                    marcado ? 'border-purple-600 bg-purple-600' : 'border-slate-300 dark:border-slate-500'
                  }`}
                >
                  {marcado ? <Check className="h-3 w-3 text-white" /> : null}
                </span>
                <input type="checkbox" checked={marcado} onChange={() => alternar(o.value)} className="hidden" />
                <span className="flex-1 truncate">{o.label}</span>
                {o.hint ? <span className="text-[10px] text-slate-400">{o.hint}</span> : null}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

export function AttachAudienceModal({
  campaignId,
  open,
  onClose,
  onAttached,
}: {
  campaignId: string;
  open: boolean;
  onClose: () => void;
  onAttached: (added: number) => void;
}) {
  const [options, setOptions] = useState<AudienceOptions | null>(null);
  // começa carregando: as opções só chegam depois do primeiro fetch
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [anexando, setAnexando] = useState(false);

  const [regionalIds, setRegionalIds] = useState<string[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [churchIds, setChurchIds] = useState<string[]>([]);
  const [titleIds, setTitleIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [somenteComTelefone, setSomenteComTelefone] = useState(true);
  const [q, setQ] = useState('');

  const [preview, setPreview] = useState<AudienceMemberPreview[] | null>(null);
  const [semTelefone, setSemTelefone] = useState(0);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // `ativo` evita gravar estado depois que o modal já fechou — abrir e fechar
  // rápido deixava a resposta antiga chegando em cima da tela nova.
  useEffect(() => {
    if (!open) return;
    let ativo = true;
    void (async () => {
      try {
        const res = await fetch('/api/secretaria/campaigns/audience', { headers: authHeaders() });
        const d = await res.json();
        if (!ativo) return;
        if (d.error) throw new Error(d.error);
        setOptions(d);
      } catch (e) {
        if (ativo) toast.error(e instanceof Error ? e.message : 'Erro ao carregar os filtros');
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [open]);

  // A lista de igrejas segue regionais e zonas: marcar "Zona Leste" reduz o que
  // aparece aqui, e as igrejas que saíram da lista também saem da seleção.
  const igrejasVisiveis = useMemo(() => {
    if (!options) return [];
    return options.churches.filter(c => {
      if (regionalIds.length && !regionalIds.includes(c.regionalId)) return false;
      if (zones.length && !zones.includes(c.zone ?? '')) return false;
      return true;
    });
  }, [options, regionalIds, zones]);

  /**
   * Igreja que saiu da lista por causa do filtro de cima não conta mais. Isso é
   * derivado, não sincronizado por efeito: guardar o estado "limpo" numa segunda
   * variável faria a seleção piscar e perderia a marcação de quem volta a
   * aparecer quando o usuário desmarca a regional.
   */
  const churchIdsEfetivos = useMemo(() => {
    const validos = new Set(igrejasVisiveis.map(c => c.id));
    return churchIds.filter(id => validos.has(id));
  }, [churchIds, igrejasVisiveis]);

  const filtros = useCallback(
    () => ({
      regionalIds,
      churchIds: churchIdsEfetivos,
      zones,
      titleIds,
      statuses,
      requirePhone: somenteComTelefone,
      q: q.trim() || undefined,
    }),
    [regionalIds, churchIdsEfetivos, zones, titleIds, statuses, somenteComTelefone, q]
  );

  const buscar = async () => {
    setBuscando(true);
    try {
      const res = await fetch('/api/secretaria/campaigns/audience', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ filters: filtros() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao buscar');
      setPreview(data.members ?? []);
      setSemTelefone(data.semTelefone ?? 0);
      setSelecionados(new Set((data.members ?? []).map((m: AudienceMemberPreview) => m.memberId)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao buscar');
    } finally {
      setBuscando(false);
    }
  };

  const anexar = async () => {
    if (!selecionados.size) {
      toast.error('Selecione ao menos uma pessoa.');
      return;
    }
    setAnexando(true);
    try {
      const res = await fetch(`/api/secretaria/campaigns/${campaignId}/targets`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ filters: filtros(), memberIds: Array.from(selecionados) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao anexar');
      toast.success(
        data.added
          ? `${data.added} pessoa(s) anexada(s).${data.skipped ? ` ${data.skipped} já estavam.` : ''}`
          : 'Todas já estavam anexadas.'
      );
      onAttached(data.added ?? 0);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao anexar');
    } finally {
      setAnexando(false);
    }
  };

  if (!open) return null;

  const todosMarcados = !!preview?.length && selecionados.size === preview.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Anexar pessoas à campanha</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <BlocoFiltro
                  titulo="Regionais"
                  opcoes={(options?.regionais ?? []).map(r => ({ value: r.id, label: r.name }))}
                  selecionados={regionalIds}
                  onChange={setRegionalIds}
                  busca
                />
                <BlocoFiltro
                  titulo="Zonas"
                  opcoes={(options?.zones ?? []).map(z => ({ value: z, label: z }))}
                  selecionados={zones}
                  onChange={setZones}
                />
                <BlocoFiltro
                  titulo="Igrejas"
                  opcoes={igrejasVisiveis.map(c => ({ value: c.id, label: c.name, hint: c.zone ?? undefined }))}
                  selecionados={churchIdsEfetivos}
                  onChange={setChurchIds}
                  busca
                />
                <BlocoFiltro
                  titulo="Títulos eclesiásticos"
                  opcoes={(options?.titles ?? []).map(t => ({ value: t.id, label: t.name }))}
                  selecionados={titleIds}
                  onChange={setTitleIds}
                  busca
                />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <BlocoFiltro
                  titulo="Situação de membresia"
                  opcoes={(options?.statuses ?? []).map(s => ({
                    value: s.value,
                    label: s.value,
                    hint: String(s.count),
                  }))}
                  selecionados={statuses}
                  onChange={setStatuses}
                />
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Busca por nome ou ROL
                  </label>
                  <input
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && buscar()}
                    placeholder="Opcional"
                    className="mb-3 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={somenteComTelefone}
                      onChange={e => setSomenteComTelefone(e.target.checked)}
                      className="h-4 w-4 rounded accent-purple-600"
                    />
                    Só quem tem telefone (sem telefone não há envio por WhatsApp)
                  </label>
                  <button
                    type="button"
                    onClick={buscar}
                    disabled={buscando}
                    className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-purple-600 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Buscar pessoas
                  </button>
                </div>
              </div>

              {preview ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 dark:border-slate-700">
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <Users className="h-4 w-4 text-purple-600" />
                      {preview.length} encontrada(s) · {selecionados.size} selecionada(s)
                      {semTelefone ? <span className="text-amber-600"> · {semTelefone} sem telefone</span> : null}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelecionados(todosMarcados ? new Set() : new Set(preview.map(m => m.memberId)))
                      }
                      className="text-[11px] font-semibold text-purple-600 hover:underline dark:text-purple-400"
                    >
                      {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {!preview.length ? (
                      <p className="py-8 text-center text-xs text-slate-400">
                        Nenhuma pessoa com esses filtros.
                      </p>
                    ) : (
                      preview.map(m => {
                        const marcado = selecionados.has(m.memberId);
                        return (
                          <label
                            key={m.memberId}
                            className="flex cursor-pointer items-center gap-3 border-b border-slate-50 px-4 py-2 text-xs last:border-0 hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700/40"
                          >
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() =>
                                setSelecionados(prev => {
                                  const next = new Set(prev);
                                  if (next.has(m.memberId)) next.delete(m.memberId);
                                  else next.add(m.memberId);
                                  return next;
                                })
                              }
                              className="h-4 w-4 rounded accent-purple-600"
                            />
                            <span className="w-12 flex-shrink-0 font-mono text-slate-400">{m.rol ?? '—'}</span>
                            <span className="flex-1 truncate font-medium text-slate-700 dark:text-slate-200">{m.name}</span>
                            <span className="hidden w-40 truncate text-slate-500 sm:block">{m.churchName}</span>
                            <span className="hidden w-32 truncate text-slate-400 md:block">{m.titleName ?? '—'}</span>
                            <span className={`w-28 text-right ${m.phone ? 'text-slate-500' : 'text-amber-600'}`}>
                              {m.phone ?? 'sem telefone'}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-center text-xs text-slate-400">
                  Escolha os filtros e clique em <strong>Buscar pessoas</strong> para ver quem entra na campanha.
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-800">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
            Cancelar
          </button>
          <button
            onClick={anexar}
            disabled={anexando || !selecionados.size}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {anexando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Anexar {selecionados.size || ''} pessoa(s)
          </button>
        </div>
      </div>
    </div>
  );
}

export default AttachAudienceModal;
