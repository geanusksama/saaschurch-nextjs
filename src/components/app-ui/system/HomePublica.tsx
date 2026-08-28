/**
 * Sistema → Home Pública.
 *
 * Personaliza a home que o visitante vê (a tela do "REINAR"): logo, favicon,
 * título da aba, nome do app instalado, textos, cores e — o principal — os
 * ícones, que agora são registros de banco e podem ser reordenados, ocultados,
 * renomeados e reapontados.
 *
 * O que esta tela NÃO edita, de propósito: endereço, telefone, redes sociais e
 * programação de culto. Isso já é cadastrado em Sistema → Informações da
 * Igreja; aqui aparece só em leitura, com atalho para lá. Duplicar criaria
 * duas verdades para o mesmo dado.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  Save, Loader2, Check, Upload, Eye, EyeOff, ChevronUp, ChevronDown, Plus,
  Trash2, Pencil, X, ExternalLink, Lock, RotateCcw, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiBase } from '../../../lib/apiBase';
import { resolveHomeIcon } from '../../public/homeIcons';
import {
  DEFAULT_HOME_PAYLOAD, HOME_ICON_CATALOG, HOME_ICON_CATEGORIES, homeIconOption,
  isLockedAction, isProtectedAction, mergeHomePayload, SEDE_LINK_FIELDS,
  SEDE_URL_PREFIX, sedeUrlField,
  type HomeCard, type HomeConfig, type HomeConfigPayload, type HomeIconCategory,
} from '../../../lib/homeConfig';

// Mesmo catálogo do botão flutuante da home (src/components/public/PublicHome.tsx).
const SERVICOS = [
  { id: 'membro_login', label: 'Já sou Membro' },
  { id: 'membership', label: 'Quero ser Membro' },
  { id: 'visita_pastoral', label: 'Visita Pastoral' },
  { id: 'aconselhamento', label: 'Aconselhamento' },
  { id: 'pedido_oracao', label: 'Pedido de Oração' },
  { id: 'emergencial', label: 'Atendimento Emergencial' },
  { id: 'reconciliacao', label: 'Reconciliação' },
  { id: 'familiar', label: 'Atendimento Familiar' },
  { id: 'jovem', label: 'Atendimento Jovem' },
  { id: 'infantil', label: 'Atendimento Infantil' },
  { id: 'financeiro', label: 'Atendimento Financeiro' },
  { id: 'ministerial', label: 'Atendimento Ministerial' },
  { id: 'online', label: 'Atendimento Online' },
  { id: 'presencial', label: 'Atendimento Presencial' },
  { id: 'casamento', label: 'Casamento' },
  { id: 'apresentacao_criancas', label: 'Apresentação de Crianças' },
];

type Aba = 'identidade' | 'hero' | 'aparencia' | 'icones' | 'servicos' | 'sede';

const ABAS: { id: Aba; label: string }[] = [
  { id: 'identidade', label: 'Identidade' },
  { id: 'hero', label: 'Texto principal' },
  { id: 'aparencia', label: 'Aparência' },
  { id: 'icones', label: 'Ícones da home' },
  { id: 'servicos', label: 'Atendimento' },
  { id: 'sede', label: 'Sede e cultos' },
];

const inputCls =
  'w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary-ring)] dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm';
const labelCls = 'block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide';
const cardCls = 'rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900';

function token() {
  try { return localStorage.getItem('mrm_token'); } catch { return null; }
}
function authHeaders(json = false): Record<string, string> {
  const t = token();
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

// ── Seletor de ícone ────────────────────────────────────────────────────────

function IconPickerModal({
  atual, onEscolher, onFechar,
}: { atual: string; onEscolher: (nome: string) => void; onFechar: () => void }) {
  const [categoria, setCategoria] = useState<HomeIconCategory>(homeIconOption(atual).category);
  const icones = HOME_ICON_CATALOG.filter(i => i.category === categoria);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onFechar}>
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">Escolher ícone</h3>
          <button type="button" onClick={onFechar}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
          {HOME_ICON_CATEGORIES.map(cat => (
            <button key={cat.id} type="button" onClick={() => setCategoria(cat.id)}
              className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${
                categoria === cat.id
                  ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}>
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2 max-h-[320px] overflow-y-auto">
          {icones.map(ic => {
            const Icone = resolveHomeIcon(ic.value);
            const escolhido = atual === ic.value;
            return (
              <button key={ic.value} type="button" title={ic.label}
                onClick={() => { onEscolher(ic.value); onFechar(); }}
                className={`flex flex-col items-center gap-1.5 rounded-xl p-2 transition-all border-2 ${
                  escolhido
                    ? 'border-[var(--theme-primary)] bg-[var(--theme-primary-soft)] scale-105'
                    : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}>
                <span className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${ic.bg} overflow-hidden shadow-md`}>
                  <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                  <Icone className="h-5 w-5 text-white relative z-10 drop-shadow" />
                </span>
                <span className="text-center text-[10px] text-slate-600 dark:text-slate-400 leading-tight">{ic.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Campo de imagem com upload ──────────────────────────────────────────────

function CampoImagem({
  label, valor, ajuda, redondo, fallbackUrl, fallbackNota, acaoRapida, aoTrocar,
}: {
  label: string; valor: string | null; ajuda?: string; redondo?: boolean;
  /** Imagem realmente usada quando o campo está vazio — evita "sem imagem"
   *  numa tela em que sempre existe um ícone no ar. */
  fallbackUrl?: string | null;
  fallbackNota?: string;
  acaoRapida?: { label: string; aoClicar: () => void };
  aoTrocar: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('A imagem deve ter no máximo 5MB.'); return; }

    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'home');
      const res = await fetch(`${apiBase}/upload`, { method: 'POST', headers: authHeaders(), body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao enviar a imagem.');
      aoTrocar(data.url as string);
      toast.success('Imagem enviada. Não esqueça de salvar.');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao enviar a imagem.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-3">
        <div className={`flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 ${redondo ? 'rounded-full' : 'rounded-xl'}`}>
          {valor || fallbackUrl
            ? <img src={(valor || fallbackUrl) as string} alt=""
                className={`h-full w-full object-cover ${valor ? '' : 'opacity-60'}`} />
            : <span className="text-[10px] text-slate-400">sem imagem</span>}
        </div>
        <div className="flex-1 space-y-2">
          {/* Campo vazio mostra no placeholder o caminho que está realmente
              no ar, senão a prévia aparece sem explicação de onde veio. */}
          <input className={inputCls} value={valor || ''}
            placeholder={fallbackUrl || 'https://… ou /caminho.png'}
            onChange={e => aoTrocar(e.target.value.trim() || null)} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={enviando} onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Enviar imagem
            </button>
            {acaoRapida && (
              <button type="button" onClick={acaoRapida.aoClicar}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                {acaoRapida.label}
              </button>
            )}
            {valor && (
              <button type="button" onClick={() => aoTrocar(null)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30">
                Remover
              </button>
            )}
          </div>
          {!valor && fallbackNota && <p className="text-[11px] text-amber-600 dark:text-amber-400">{fallbackNota}</p>}
          {ajuda && <p className="text-[11px] text-slate-400">{ajuda}</p>}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={enviar} />
    </div>
  );
}

function CampoCor({
  label, valor, permiteVazio, aoTrocar,
}: { label: string; valor: string | null; permiteVazio?: boolean; aoTrocar: (v: string | null) => void }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={valor || '#475569'} onChange={e => aoTrocar(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200 bg-transparent dark:border-slate-700" />
        <input className={inputCls} value={valor || ''} placeholder={permiteVazio ? 'padrão do tema' : '#RRGGBB'}
          onChange={e => {
            const v = e.target.value.trim();
            if (!v && permiteVazio) return aoTrocar(null);
            aoTrocar(v);
          }} />
        {permiteVazio && valor && (
          <button type="button" onClick={() => aoTrocar(null)} title="Voltar ao padrão"
            className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Editor de um cartão ─────────────────────────────────────────────────────

function EditorDeCartao({
  card, aoMudar, aoFechar,
}: { card: HomeCard; aoMudar: (c: HomeCard) => void; aoFechar: () => void }) {
  const [seletorAberto, setSeletorAberto] = useState(false);
  const campoSede = sedeUrlField(card.url);
  const usaSede = !!campoSede;

  return (
    <div className="mt-3 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={labelCls}>Título</label>
          <input className={inputCls} value={card.title} maxLength={160}
            onChange={e => aoMudar({ ...card, title: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Ícone</label>
          <button type="button" onClick={() => setSeletorAberto(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800">
            {(() => {
              const opt = homeIconOption(card.icon);
              const Icone = resolveHomeIcon(card.icon);
              return (
                <>
                  <span className={`relative flex h-8 w-8 items-center justify-center rounded-lg ${opt.bg} overflow-hidden`}>
                    <Icone className="h-4 w-4 text-white relative z-10" />
                  </span>
                  <span className="text-slate-700 dark:text-slate-200">{opt.label}</span>
                </>
              );
            })()}
          </button>
        </div>
      </div>

      {card.action !== 'maps' && card.action !== 'agenda' && (
        <div>
          <label className={labelCls}>Descrição (uma linha por linha do cartão)</label>
          <textarea className={`${inputCls} min-h-[64px]`} rows={2} value={card.subtitle || ''}
            onChange={e => aoMudar({ ...card, subtitle: e.target.value || null })} />
        </div>
      )}

      {card.action === 'maps' && (
        <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          O endereço e o telefone deste cartão vêm de <strong>Informações da Igreja</strong>.
        </p>
      )}
      {card.action === 'agenda' && (
        <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          Os horários deste cartão vêm da <strong>Programação</strong> em Informações da Igreja.
        </p>
      )}

      {card.action === 'link' && (
        <div className="space-y-2">
          <label className={labelCls}>Destino do link</label>
          <select className={inputCls} value={campoSede ? `${SEDE_URL_PREFIX}${campoSede}` : 'custom'}
            onChange={e => {
              const v = e.target.value;
              aoMudar({ ...card, url: v === 'custom' ? '' : v });
            }}>
            <option value="custom">Endereço digitado aqui</option>
            {SEDE_LINK_FIELDS.map(f => (
              <option key={f.id} value={`${SEDE_URL_PREFIX}${f.id}`}>{f.label}</option>
            ))}
          </select>
          {usaSede
            ? <p className="text-[11px] text-slate-400">
                O endereço é o que estiver cadastrado em Informações da Igreja — troca lá, muda aqui.
              </p>
            : <input className={inputCls} value={card.url || ''} placeholder="https://…"
                onChange={e => aoMudar({ ...card, url: e.target.value.trim() })} />}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <CampoCor label="Cor do ícone (destaque)" valor={card.iconColor} permiteVazio
          aoTrocar={v => aoMudar({ ...card, iconColor: v })} />
        <CampoCor label="Cor ao passar o mouse" valor={card.hoverColor} permiteVazio
          aoTrocar={v => aoMudar({ ...card, hoverColor: v })} />
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={card.pulse} onChange={e => aoMudar({ ...card, pulse: e.target.checked })} />
          Anel pulsante (chama atenção)
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={card.liveDot} onChange={e => aoMudar({ ...card, liveDot: e.target.checked })} />
          Bolinha de &ldquo;ao vivo&rdquo;
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={card.fullWidth} onChange={e => aoMudar({ ...card, fullWidth: e.target.checked })} />
          Ocupar a linha inteira
        </label>
      </div>

      <button type="button" onClick={aoFechar}
        className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400">
        Fechar edição
      </button>

      {seletorAberto && (
        <IconPickerModal atual={card.icon} onFechar={() => setSeletorAberto(false)}
          onEscolher={nome => aoMudar({ ...card, icon: nome })} />
      )}
    </div>
  );
}

// ── Tela ────────────────────────────────────────────────────────────────────

export function HomePublica() {
  const [aba, setAba] = useState<Aba>('identidade');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<HomeConfigPayload>(DEFAULT_HOME_PAYLOAD);
  const [original, setOriginal] = useState<string>('');
  const [editando, setEditando] = useState<string | null>(null);

  const cfg = dados.config;
  const cards = dados.cards;
  const sede = dados.sede;

  const alterado = useMemo(() => JSON.stringify(dados) !== original, [dados, original]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/home-config`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Não foi possível carregar a configuração.');
        const payload = mergeHomePayload(data);
        setDados(payload);
        setOriginal(JSON.stringify(payload));
        if (data.seedFailed) {
          toast.warning('A configuração ainda não pôde ser gravada no banco. Salve para criá-la.');
        }
      } catch (e: any) {
        setErro(e?.message || 'Falha ao carregar.');
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  function trocarConfig(patch: Partial<HomeConfig>) {
    setDados(d => ({ ...d, config: { ...d.config, ...patch } }));
  }

  function trocarCartao(key: string, novo: HomeCard) {
    setDados(d => ({ ...d, cards: d.cards.map(c => (c.key === key ? novo : c)) }));
  }

  function mover(index: number, direcao: -1 | 1) {
    const destino = index + direcao;
    if (destino < 0 || destino >= cards.length) return;
    const lista = [...cards];
    [lista[index], lista[destino]] = [lista[destino], lista[index]];
    setDados(d => ({ ...d, cards: lista }));
  }

  function adicionarCartao() {
    const key = `link_${Date.now().toString(36)}`;
    setDados(d => ({
      ...d,
      cards: [...d.cards, {
        key, action: 'link', title: 'Novo cartão', subtitle: null, url: '',
        icon: 'Link', iconColor: null, hoverColor: null,
        visible: true, pulse: false, liveDot: false, fullWidth: false,
      }],
    }));
    setEditando(key);
    setAba('icones');
  }

  function removerCartao(key: string) {
    setDados(d => ({ ...d, cards: d.cards.filter(c => c.key !== key) }));
    if (editando === key) setEditando(null);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`${apiBase}/home-config`, {
        method: 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify({ config: dados.config, cards: dados.cards }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detalhes = Array.isArray(data?.detalhes) ? `\n${data.detalhes.join('\n')}` : '';
        throw new Error(`${data?.error || 'Falha ao salvar.'}${detalhes}`);
      }
      const payload = mergeHomePayload(data);
      setDados(payload);
      setOriginal(JSON.stringify(payload));
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
      toast.success('Home atualizada.');
    } catch (e: any) {
      setErro(e?.message || 'Falha ao salvar.');
      toast.error('Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando a configuração da home…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Home Pública</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Personalize a página que o visitante vê: marca, textos, cores e os ícones de atalho.
          </p>
        </div>
        <a href="/" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          <ExternalLink className="h-4 w-4" /> Ver a home
        </a>
      </div>

      {erro && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span className="whitespace-pre-line">{erro}</span>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {ABAS.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              aba === a.id
                ? 'bg-[var(--theme-primary)] text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
            }`}>
            {a.label}
          </button>
        ))}
      </div>

      {/* ── Identidade ─────────────────────────────────────────────────── */}
      {aba === 'identidade' && (
        <div className="space-y-6">
          <div className={cardCls}>
            <h3 className="mb-5 font-bold text-slate-900 dark:text-white">Navegador</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Título da aba</label>
                <input className={inputCls} value={cfg.siteTitle} maxLength={120}
                  onChange={e => trocarConfig({ siteTitle: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Descrição</label>
                <input className={inputCls} value={cfg.siteDescription} maxLength={300}
                  onChange={e => trocarConfig({ siteDescription: e.target.value })} />
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <CampoImagem label="Ícone da aba (favicon)" valor={cfg.faviconUrl} redondo
                fallbackUrl={cfg.pwaIcon192}
                fallbackNota="Vazio: a aba usa o ícone 192×192 do app — o caminho em uso está no campo, em cinza."
                ajuda="PNG quadrado, idealmente 192×192. É o que todo visitante vê."
                acaoRapida={cfg.logoUrl && cfg.faviconUrl !== cfg.logoUrl
                  ? { label: 'Usar a logo do cabeçalho', aoClicar: () => trocarConfig({ faviconUrl: cfg.logoUrl }) }
                  : undefined}
                aoTrocar={v => trocarConfig({ faviconUrl: v })} />
              <CampoImagem label="Logo do cabeçalho" valor={cfg.logoUrl} redondo
                ajuda="Aparece no canto superior esquerdo da home."
                aoTrocar={v => trocarConfig({ logoUrl: v || '' })} />
            </div>
          </div>

          <div className={cardCls}>
            <h3 className="mb-5 font-bold text-slate-900 dark:text-white">App instalado (PWA)</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Nome completo</label>
                <input className={inputCls} value={cfg.pwaName} maxLength={120}
                  onChange={e => trocarConfig({ pwaName: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Nome curto (embaixo do ícone)</label>
                <input className={inputCls} value={cfg.pwaShortName} maxLength={60}
                  onChange={e => trocarConfig({ pwaShortName: e.target.value })} />
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <CampoImagem label="Ícone 192×192" valor={cfg.pwaIcon192}
                aoTrocar={v => trocarConfig({ pwaIcon192: v || '' })} />
              <CampoImagem label="Ícone 512×512" valor={cfg.pwaIcon512}
                aoTrocar={v => trocarConfig({ pwaIcon512: v || '' })} />
              <CampoImagem label="Ícone maskable" valor={cfg.pwaIconMaskable}
                ajuda="Com margem de segurança; o Android recorta."
                aoTrocar={v => trocarConfig({ pwaIconMaskable: v || '' })} />
            </div>
          </div>
        </div>
      )}

      {/* ── Texto principal ────────────────────────────────────────────── */}
      {aba === 'hero' && (
        <div className="space-y-6">
          <div className={cardCls}>
            <h3 className="mb-5 font-bold text-slate-900 dark:text-white">Chamada</h3>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Linha de cima</label>
                <input className={inputCls} value={cfg.heroEyebrow} maxLength={120}
                  onChange={e => trocarConfig({ heroEyebrow: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Palavra em destaque</label>
                <input className={`${inputCls} text-2xl font-medium tracking-tight`} value={cfg.heroTitle} maxLength={120}
                  onChange={e => trocarConfig({ heroTitle: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Parágrafo</label>
                <textarea className={`${inputCls} min-h-[96px]`} rows={3} value={cfg.heroText}
                  onChange={e => trocarConfig({ heroText: e.target.value })} />
              </div>
            </div>
          </div>

          <div className={cardCls}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">Versículo</h3>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={cfg.showVerse}
                  onChange={e => trocarConfig({ showVerse: e.target.checked })} />
                Mostrar na home
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Referência</label>
                <input className={inputCls} value={cfg.verseRef} maxLength={80}
                  onChange={e => trocarConfig({ verseRef: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Rótulo do botão</label>
                <input className={inputCls} value={cfg.verseLabel} maxLength={40}
                  onChange={e => trocarConfig({ verseLabel: e.target.value })} />
              </div>
            </div>
            <div className="mt-4">
              <label className={labelCls}>Texto que abre no modal</label>
              <textarea className={`${inputCls} min-h-[96px]`} rows={3} value={cfg.verseText}
                onChange={e => trocarConfig({ verseText: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      {/* ── Aparência ──────────────────────────────────────────────────── */}
      {aba === 'aparencia' && (
        <div className="space-y-6">
          <div className={cardCls}>
            <h3 className="mb-5 font-bold text-slate-900 dark:text-white">Cores</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <CampoCor label="Fundo — tema escuro" valor={cfg.bgDark} aoTrocar={v => trocarConfig({ bgDark: v || '#0a0a0a' })} />
              <CampoCor label="Fundo — tema claro" valor={cfg.bgLight} aoTrocar={v => trocarConfig({ bgLight: v || '#f5f4f0' })} />
              <CampoCor label="Cor de destaque" valor={cfg.accentColor} aoTrocar={v => trocarConfig({ accentColor: v || '#d4af37' })} />
            </div>
            <div className="mt-5 flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={cfg.defaultDark}
                  onChange={e => trocarConfig({ defaultDark: e.target.checked })} />
                Abrir no tema escuro
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={cfg.showSymbols}
                  onChange={e => trocarConfig({ showSymbols: e.target.checked })} />
                Símbolos bíblicos flutuando ao fundo
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={cfg.showSpotlights}
                  onChange={e => trocarConfig({ showSpotlights: e.target.checked })} />
                Holofotes e cometas (tema escuro)
              </label>
            </div>
          </div>

          <div className={cardCls}>
            <h3 className="mb-5 font-bold text-slate-900 dark:text-white">Marca d&rsquo;água do fundo</h3>
            <CampoImagem label="Imagem" valor={cfg.watermarkUrl} redondo
              ajuda="A logo gigante e translúcida atrás do conteúdo. Deixe vazio para não mostrar."
              aoTrocar={v => trocarConfig({ watermarkUrl: v })} />
            <div className="mt-4 max-w-xs">
              <label className={labelCls}>Opacidade — {(cfg.watermarkOpacity * 100).toFixed(0)}%</label>
              <input type="range" min={0} max={30} step={1} value={Math.round(cfg.watermarkOpacity * 100)}
                onChange={e => trocarConfig({ watermarkOpacity: Number(e.target.value) / 100 })}
                className="w-full" />
            </div>
          </div>

          <div className={cardCls}>
            <h3 className="mb-2 font-bold text-slate-900 dark:text-white">Paleta dos símbolos</h3>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              As cores que os símbolos bíblicos assumem, alternando entre si.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {cfg.symbolColors.map((cor, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input type="color" value={cor}
                    onChange={e => {
                      const lista = [...cfg.symbolColors];
                      lista[i] = e.target.value;
                      trocarConfig({ symbolColors: lista });
                    }}
                    className="h-9 w-9 cursor-pointer rounded-lg border border-slate-200 bg-transparent dark:border-slate-700" />
                  <button type="button" title="Remover cor"
                    onClick={() => trocarConfig({ symbolColors: cfg.symbolColors.filter((_, j) => j !== i) })}
                    className="text-slate-300 hover:text-red-500">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button type="button"
                onClick={() => trocarConfig({ symbolColors: [...cfg.symbolColors, '#d4af37'] })}
                className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">
                <Plus className="mr-1 inline h-3.5 w-3.5" /> Cor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ícones ─────────────────────────────────────────────────────── */}
      {aba === 'icones' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              A ordem aqui é a ordem na home. O olho oculta sem apagar.
            </p>
            <button type="button" onClick={adicionarCartao}
              className="flex items-center gap-2 rounded-xl bg-[var(--theme-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              <Plus className="h-4 w-4" /> Adicionar cartão
            </button>
          </div>

          {cards.map((card, index) => {
            const Icone = resolveHomeIcon(card.icon);
            const opt = homeIconOption(card.icon);
            const travado = isLockedAction(card.action);
            const protegido = isProtectedAction(card.action);
            return (
              <div key={card.key} className={cardCls}>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col">
                    <button type="button" disabled={index === 0} onClick={() => mover(index, -1)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800">
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={index === cards.length - 1} onClick={() => mover(index, 1)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  <span className={`relative mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${opt.bg} overflow-hidden shadow`}>
                    <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10" />
                    <Icone className="relative z-10 h-5 w-5 text-white" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-semibold ${card.visible ? 'text-slate-900 dark:text-white' : 'text-slate-400 line-through'}`}>
                      {card.title}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {card.action === 'maps' && 'Endereço da sede'}
                      {card.action === 'agenda' && 'Programação de cultos'}
                      {card.action === 'membro' && 'Abre o Portal do Membro'}
                      {card.action === 'peniel' && 'Abre a inscrição do Peniel'}
                      {card.action === 'gf' && 'Abre a lista de Grupos Familiares'}
                      {card.action === 'pwa' && 'Convite para instalar o app — padrão da plataforma'}
                      {card.action === 'verse' && 'Abre o versículo'}
                      {card.action === 'link' && (sedeUrlField(card.url)
                        ? SEDE_LINK_FIELDS.find(f => f.id === sedeUrlField(card.url))?.label
                        : card.url || 'sem endereço')}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    {travado ? (
                      <span title="Padrão da plataforma: sempre visível"
                        className="rounded-lg p-2 text-slate-300 dark:text-slate-600">
                        <Lock className="h-4 w-4" />
                      </span>
                    ) : (
                      <button type="button" title={card.visible ? 'Ocultar da home' : 'Mostrar na home'}
                        onClick={() => trocarCartao(card.key, { ...card, visible: !card.visible })}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                        {card.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    )}
                    {travado ? (
                      // O convite de instalar o app desenha o próprio conteúdo
                      // (e muda entre Android e iPhone): não há o que editar.
                      <span title="Conteúdo definido pela plataforma"
                        className="rounded-lg p-2 text-slate-200 dark:text-slate-700">
                        <Pencil className="h-4 w-4" />
                      </span>
                    ) : (
                      <button type="button" title="Editar"
                        onClick={() => setEditando(editando === card.key ? null : card.key)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {protegido ? (
                      <span title="Cartão do sistema: pode ser ocultado, não apagado"
                        className="rounded-lg p-2 text-slate-200 dark:text-slate-700">
                        <Trash2 className="h-4 w-4" />
                      </span>
                    ) : (
                      <button type="button" title="Remover cartão"
                        onClick={() => removerCartao(card.key)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {editando === card.key && (
                  <EditorDeCartao card={card} aoFechar={() => setEditando(null)}
                    aoMudar={novo => trocarCartao(card.key, novo)} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Atendimento (botão flutuante) ──────────────────────────────── */}
      {aba === 'servicos' && (
        <div className="space-y-6">
          <div className={cardCls}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Botão flutuante de atendimento</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  O botão verde no canto da home, que abre os pedidos para a secretaria.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={cfg.services.enabled}
                  onChange={e => trocarConfig({ services: { ...cfg.services, enabled: e.target.checked } })} />
                Ativo
              </label>
            </div>
            <div>
              <label className={labelCls}>Título do modal</label>
              <input className={inputCls} value={cfg.services.title}
                onChange={e => trocarConfig({ services: { ...cfg.services, title: e.target.value } })} />
            </div>
          </div>

          <div className={cardCls}>
            <h3 className="mb-1 font-bold text-slate-900 dark:text-white">Opções oferecidas</h3>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Desmarque o que a igreja não atende. O formulário e o destino do pedido continuam os mesmos.
            </p>
            <div className="space-y-2">
              {SERVICOS.map(s => {
                const oculto = cfg.services.hidden.includes(s.id);
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <input type="checkbox" checked={!oculto}
                      onChange={e => {
                        const hidden = e.target.checked
                          ? cfg.services.hidden.filter(h => h !== s.id)
                          : [...cfg.services.hidden, s.id];
                        trocarConfig({ services: { ...cfg.services, hidden } });
                      }} />
                    <input className={`${inputCls} ${oculto ? 'opacity-50' : ''}`}
                      value={cfg.services.labels[s.id] ?? s.label}
                      onChange={e => {
                        const labels = { ...cfg.services.labels };
                        if (e.target.value.trim() && e.target.value !== s.label) labels[s.id] = e.target.value;
                        else delete labels[s.id];
                        trocarConfig({ services: { ...cfg.services, labels } });
                      }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Sede e cultos (leitura) ────────────────────────────────────── */}
      {aba === 'sede' && (
        <div className="space-y-6">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              Endereço, telefone, redes sociais e programação de culto são cadastrados em{' '}
              <Link to="/app-ui/system/church-info" className="font-semibold underline">Informações da Igreja</Link>.
              A home lê de lá — assim o dado tem um dono só.
            </p>
          </div>

          <div className={cardCls}>
            <h3 className="mb-4 font-bold text-slate-900 dark:text-white">O que a home está mostrando</h3>
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <div><dt className={labelCls}>Igreja</dt><dd className="text-slate-700 dark:text-slate-200">{sede.churchName || '—'}</dd></div>
              <div><dt className={labelCls}>Endereço</dt><dd className="text-slate-700 dark:text-slate-200">{sede.address || '—'}</dd></div>
              <div><dt className={labelCls}>Telefone</dt><dd className="text-slate-700 dark:text-slate-200">{sede.phone || '—'}</dd></div>
              <div><dt className={labelCls}>WhatsApp</dt><dd className="text-slate-700 dark:text-slate-200">{sede.whatsapp || '—'}</dd></div>
              <div><dt className={labelCls}>Instagram</dt><dd className="truncate text-slate-700 dark:text-slate-200">{sede.instagram || '—'}</dd></div>
              <div><dt className={labelCls}>YouTube</dt><dd className="truncate text-slate-700 dark:text-slate-200">{sede.youtube || '—'}</dd></div>
            </dl>
          </div>

          <div className={cardCls}>
            <h3 className="mb-4 font-bold text-slate-900 dark:text-white">Programação</h3>
            {sede.schedules.length === 0
              ? <p className="text-sm text-slate-400">Nenhum culto cadastrado.</p>
              : (
                <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                  {sede.schedules.map((s, i) => (
                    <li key={i}>
                      <strong>{s.dayOfWeek}</strong> · {s.time} — {s.name}
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </div>
      )}

      {/* ── Barra de salvar ─────────────────────────────────────────────
          `sticky` dentro da coluna de conteúdo, não `fixed` na janela: fixa na
          viewport ela atravessava por cima do menu lateral. */}
      <div className="sticky bottom-0 z-30 -mx-6 mt-8 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {alterado ? 'Há alterações não salvas.' : 'Tudo salvo.'}
          </span>
          <button type="button" onClick={salvar} disabled={salvando || !alterado}
            className="flex items-center gap-2 rounded-xl bg-[var(--theme-primary)] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : salvo ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {salvando ? 'Salvando…' : salvo ? 'Salvo' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default HomePublica;
