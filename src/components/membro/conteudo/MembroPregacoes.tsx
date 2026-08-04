"use client";

/**
 * Pregações — mesma estrutura da tela do app Flutter: abas por tipo, o "ao
 * vivo" em destaque no topo, os shorts numa faixa horizontal e o restante em
 * lista.
 *
 * `thumbnail_url` é nulo em todo o acervo hoje. A primeira versão desta tela
 * apostava nele e o resultado era um cartão em branco; aqui a capa é gerada a
 * partir de `accent_hex`/tipo, e a miniatura real só entra quando existir.
 */

import { useState, useMemo } from 'react';
import { Play, Radio, Clock, Eye, Podcast, Zap } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { MEMBRO } from '../theme';
import { useConteudo } from './useConteudo';
import { Carregando, Vazio, SemCampo, Erro, dataBR } from './Primitivos';

interface Pregacao {
  id: string;
  titulo: string;
  descricao: string | null;
  thumb: string | null;
  url: string | null;
  duracao: string | null;
  data: string | null;
  pregador: string | null;
  tipo: string;
  selo: string | null;
  visualizacoes: number;
  ao_vivo: boolean;
  cor: string | null;
}

const ABAS = [
  { chave: 'tudo',    rotulo: 'Tudo' },
  { chave: 'live',    rotulo: 'Ao vivo' },
  { chave: 'sermon',  rotulo: 'Pregações' },
  { chave: 'short',   rotulo: 'Shorts' },
  { chave: 'podcast', rotulo: 'Podcasts' },
];

/** Paleta por tipo, usada quando o item não traz accent_hex. */
const COR_PADRAO: Record<string, string> = {
  live: '#dc2626', short: '#7c3aed', sermon: '#2563eb', podcast: '#0d9488',
};

function cor(p: Pregacao): string {
  const c = p.cor?.startsWith('#') ? p.cor : p.cor ? `#${p.cor}` : null;
  if (c && /^#[0-9a-f]{6}$/i.test(c)) return c;
  return COR_PADRAO[p.tipo] ?? MEMBRO.ACCENT;
}

function views(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')} mi`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')} mil`;
  return String(n);
}

const abrir = (p: Pregacao) => { if (p.url) window.open(p.url, '_blank', 'noopener'); };

function Selo({ p }: { p: Pregacao }) {
  if (!p.selo) return null;
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1"
      style={{ background: p.ao_vivo ? '#dc2626' : 'rgba(255,255,255,0.22)', color: '#fff' }}>
      {p.ao_vivo && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
      {p.selo}
    </span>
  );
}

/** Cartão grande do topo — o "ao vivo" ou, na falta dele, o mais recente. */
function Destaque({ p }: { p: Pregacao }) {
  const c = cor(p);
  return (
    <button onClick={() => abrir(p)} className="w-full text-left rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: `linear-gradient(135deg, ${c}, ${c}cc)`, boxShadow: MEMBRO.SHADOW }}>
      <div className="flex items-center gap-2"><Selo p={p} /></div>
      <div className="text-lg font-bold text-white leading-snug">{p.titulo}</div>
      {p.pregador && (
        <div className="inline-flex items-center gap-1.5 text-sm text-white/85">
          <Radio className="w-3.5 h-3.5" /> {p.pregador}
        </div>
      )}
      {p.descricao && <p className="text-sm text-white/80 leading-relaxed">{p.descricao}</p>}
      <div className="flex items-center gap-3 text-xs text-white/70">
        {p.data && <span>{dataBR(p.data, true)}</span>}
        {p.duracao && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{p.duracao}</span>}
        {p.visualizacoes > 0 && (
          <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" />{views(p.visualizacoes)}</span>
        )}
      </div>
      <div className="mt-1 h-10 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center justify-center gap-2">
        <Play className="w-4 h-4 fill-current" /> {p.ao_vivo ? 'Entrar agora' : 'Assistir'}
      </div>
    </button>
  );
}

/** Faixa horizontal de shorts, igual à do app. */
function FaixaShorts({ itens }: { itens: Pregacao[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 px-1">
        <Zap className="w-3.5 h-3.5" style={{ color: MEMBRO.ACCENT }} />
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: MEMBRO.TEXT3 }}>
          Shorts
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
        {itens.map(s => {
          const c = cor(s);
          return (
            <button key={s.id} onClick={() => abrir(s)}
              className="relative flex-shrink-0 w-32 h-48 rounded-2xl overflow-hidden text-left"
              style={{ background: `linear-gradient(160deg, ${c}, ${c}aa)` }}>
              <span className="absolute top-2 left-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded text-white"
                style={{ background: 'rgba(0,0,0,0.28)' }}>Short</span>
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.28)' }}>
                  <Play className="w-5 h-5 text-white fill-current" />
                </span>
              </span>
              <span className="absolute bottom-0 left-0 right-0 p-2"
                style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.55))' }}>
                <span className="block text-[11px] font-semibold text-white leading-tight line-clamp-2">
                  {s.titulo}
                </span>
                {s.visualizacoes > 0 && (
                  <span className="block text-[10px] text-white/75 mt-0.5">
                    {views(s.visualizacoes)} visualizações
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LinhaLista({ p }: { p: Pregacao }) {
  const c = cor(p);
  return (
    <button onClick={() => abrir(p)} className="w-full text-left rounded-2xl overflow-hidden flex gap-3 p-3 flex-shrink-0"
      style={{ background: MEMBRO.CARD, border: `1px solid ${MEMBRO.BORDER}`, boxShadow: MEMBRO.SHADOW }}>
      <div className="relative w-24 h-20 rounded-xl flex-shrink-0 overflow-hidden"
        style={{ background: `linear-gradient(150deg, ${c}, ${c}aa)` }}>
        {p.thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <span className="absolute inset-0 flex items-center justify-center">
          {p.tipo === 'podcast'
            ? <Podcast className="w-6 h-6 text-white" />
            : <Play className="w-6 h-6 text-white fill-current" />}
        </span>
        {p.duracao && (
          <span className="absolute bottom-1 right-1 text-[10px] font-medium px-1 rounded text-white"
            style={{ background: 'rgba(0,0,0,0.6)' }}>{p.duracao}</span>
        )}
      </div>

      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        {p.selo && (
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: c }}>{p.selo}</span>
        )}
        <span className="font-semibold leading-snug line-clamp-2" style={{ color: MEMBRO.TEXT1 }}>
          {p.titulo}
        </span>
        {p.pregador && (
          <span className="text-xs truncate" style={{ color: MEMBRO.TEXT2 }}>{p.pregador}</span>
        )}
        <span className="text-[11px] flex items-center gap-2" style={{ color: MEMBRO.TEXT3 }}>
          {p.data && dataBR(p.data)}
          {p.visualizacoes > 0 && (
            <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" />{views(p.visualizacoes)}</span>
          )}
        </span>
      </div>
    </button>
  );
}

export default function MembroPregacoes() {
  const { dados, carregando, erro, semCampo } = useConteudo<Pregacao[]>('pregacoes');
  const [aba, setAba] = useState('tudo');

  const itens = dados ?? [];

  // Só mostra aba que tem conteúdo — aba vazia é convite para o usuário achar
  // que a tela quebrou.
  const abasVisiveis = useMemo(
    () => ABAS.filter(a => a.chave === 'tudo' || itens.some(i => i.tipo === a.chave)),
    [itens]
  );

  const filtrados = aba === 'tudo' ? itens : itens.filter(i => i.tipo === aba);
  const destaque = aba === 'tudo' ? (itens.find(i => i.ao_vivo) ?? itens[0] ?? null) : null;
  const shorts = aba === 'tudo' ? itens.filter(i => i.tipo === 'short') : [];
  const resto = filtrados.filter(i => i.id !== destaque?.id && !(aba === 'tudo' && i.tipo === 'short'));

  return (
    <MembroShell title="Pregações" showBack>
      {carregando ? <Carregando />
        : erro ? <Erro mensagem={erro} />
        : semCampo ? <SemCampo />
        : !itens.length ? <Vazio oQue="vídeo" />
        : (
          <div className="h-full flex flex-col" style={{ background: MEMBRO.BG }}>
            <div className="flex gap-2 overflow-x-auto px-4 py-3 flex-shrink-0"
              style={{ background: MEMBRO.CARD, borderBottom: `1px solid ${MEMBRO.BORDER}` }}>
              {abasVisiveis.map(a => {
                const ativa = aba === a.chave;
                return (
                  <button key={a.chave} onClick={() => setAba(a.chave)}
                    className="px-4 h-9 rounded-full text-sm font-semibold flex-shrink-0 transition-colors"
                    style={{
                      background: ativa ? MEMBRO.TEXT1 : MEMBRO.BG,
                      color: ativa ? '#fff' : MEMBRO.TEXT2,
                    }}>
                    {a.rotulo}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
              {destaque && <Destaque p={destaque} />}
              {shorts.length > 0 && <FaixaShorts itens={shorts} />}
              {resto.length > 0 && (
                <div className="flex flex-col gap-2">
                  {aba === 'tudo' && (
                    <span className="text-[11px] font-bold uppercase tracking-wider px-1" style={{ color: MEMBRO.TEXT3 }}>
                      Últimos cultos e podcasts
                    </span>
                  )}
                  {resto.map(p => <LinhaLista key={p.id} p={p} />)}
                </div>
              )}
            </div>
          </div>
        )}
    </MembroShell>
  );
}
