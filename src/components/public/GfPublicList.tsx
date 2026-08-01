/**
 * Grupos Familiares — página pública.
 *
 * Aberta pelo ícone "Grupos Familiares" da home. Lista os GFs ativos da sede
 * com foto de capa, líder, endereço e horário. A pessoa pode digitar o
 * próprio endereço para ver a distância até cada grupo (Haversine, "de
 * pássaro" — mesma limitação documentada em lib/geo.ts) e ordenar pelo mais
 * perto. Clicar no endereço abre o mapa embutido (Google Maps sem chave).
 *
 * TEMA CLARO SEMPRE, mesmo motivo do GfResumoPublic e do formulário de
 * campanha: em aparelho no modo escuro o navegador reescreve as cores e o
 * texto fica ilegível. Os cards coloridos pastel só funcionam sobre fundo
 * claro, então a página inteira ignora o tema da home.
 *
 * Sem autenticação: mesma lógica de "portal público de uma igreja só" das
 * demais páginas deste site.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import {
  ArrowLeft, Users, MapPin, Clock, Tag, Loader2, AlertCircle, Search,
  X, Navigation, ImageOff, Car, Flag,
} from 'lucide-react';
import { apiBase } from '../../lib/apiBase';
import { searchAddress, haversineKm, buildMapEmbedUrl, buildMapsLink, type LocationCandidate } from '../../lib/geo';

interface GfItem {
  id: string;
  name: string;
  description: string | null;
  cellType: string | null;
  meetingDay: string | null;
  meetingTime: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZipcode: string | null;
  latitude: number | null;
  longitude: number | null;
  color: string | null;
  photo: string | null;
  leaderName: string | null;
  leaderPhone: string | null;
  leaderPhotoUrl: string | null;
  distanceKm?: number | null;
}

function formatAddress(gf: GfItem): string {
  const street = [gf.addressStreet, gf.addressNumber].filter(Boolean).join(', ');
  return [street, gf.addressNeighborhood, gf.addressCity, gf.addressState]
    .filter(Boolean)
    .join(', ');
}

// Paleta alegre para os cards — gira por índice para variar as cores entre
// os grupos.
const PALETTE = [
  { card: '#FFFBEB', border: '#FDE68A', accent: '#D97706', soft: '#FEF3C7' }, // âmbar
  { card: '#ECFDF5', border: '#A7F3D0', accent: '#059669', soft: '#D1FAE5' }, // verde
  { card: '#FFF1F2', border: '#FECDD3', accent: '#E11D48', soft: '#FFE4E6' }, // rosa
  { card: '#F0F9FF', border: '#BAE6FD', accent: '#0284C7', soft: '#E0F2FE' }, // azul
  { card: '#F5F3FF', border: '#DDD6FE', accent: '#7C3AED', soft: '#EDE9FE' }, // violeta
  { card: '#F0FDFA', border: '#99F6E4', accent: '#0D9488', soft: '#CCFBF1' }, // teal
];

function paletteFor(gf: GfItem, index: number) {
  const base = PALETTE[index % PALETTE.length];
  // A cor cadastrada no GF vira o destaque (ícones/badge); o fundo pastel
  // continua vindo da paleta para garantir contraste e legibilidade.
  return gf.color ? { ...base, accent: gf.color } : base;
}

// ── Card "quadro de investigação": a foto fica solta (pinada) e linhas
// (barbante) apontam dela para etiquetas com nome, líder, horário e
// endereço. Todas as posições são em % (x = % da largura, y = % da altura)
// porque o card trava a proporção (aspect-[3/4]) — assim a mesma % vale
// tanto pro CSS absolute (left/top) quanto pro SVG (viewBox 0 0 100 100,
// preserveAspectRatio="none"), sem precisar calcular pixel nenhum.
const PHOTO_ANCHOR = { x: 28, y: 28 };
// `width` é % da largura do quadro (não px) para o card encolher inteiro
// quando a estrela fica menor em telas estreitas.
const TAGS_LAYOUT = [
  { key: 'name', icon: Tag, label: 'Nome', box: { left: 48, top: 2, width: 50 }, anchor: { x: 48, y: 8 }, rotate: -3 },
  { key: 'leader', icon: Users, label: 'Líder', box: { left: 52, top: 26, width: 50 }, anchor: { x: 52, y: 32 }, rotate: 2 },
  { key: 'time', icon: Clock, label: 'Horário', box: { left: 46, top: 50, width: 50 }, anchor: { x: 46, y: 56 }, rotate: -2 },
  { key: 'address', icon: MapPin, label: 'Endereço', box: { left: 24, top: 72, width: 58 }, anchor: { x: 32, y: 78 }, rotate: 3 },
] as const;

/** Inclinação de cada quadro na estrela — dá o ar de "colado torto". */
const STAR_TILT = [-6, 5, -3, 7, -8, 4];

/**
 * Posição (em % do container) do GF `i` de `total`, em volta da sede.
 *
 * A elipse é mais larga que alta de propósito: o quadro do GF é alto
 * (aspect 3/4), então espalhar na horizontal evita que ele cubra a sede.
 * Com 1 ou 2 GFs o círculo colocaria os quadros em cima/embaixo do centro —
 * exatamente onde eles se sobrepõem —, então esses casos vão para os lados.
 */
function starPoint(i: number, total: number) {
  const raioX = 34;
  const raioY = 30;
  if (total <= 2) {
    // um à direita, outro à esquerda
    const angulo = i === 0 ? 0 : Math.PI;
    return { x: 50 + raioX * Math.cos(angulo), y: 50 };
  }
  const angulo = (i / total) * Math.PI * 2 - Math.PI / 2;
  return { x: 50 + raioX * Math.cos(angulo), y: 50 + raioY * Math.sin(angulo) };
}

function BoardTag({
  icon: Icon, label, value, accent, box, rotate, onClick, href, destaque,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: React.ReactNode;
  accent: string;
  box: { left: number; top: number; width: number };
  rotate: number;
  onClick?: () => void;
  href?: string;
  /** pinta o valor com a cor do GF (usado no endereço) */
  destaque?: boolean;
}) {
  const clickable = !!(onClick || href);
  const style: React.CSSProperties = {
    left: `${box.left}%`,
    top: `${box.top}%`,
    width: `${box.width}%`,
    transform: `rotate(${rotate}deg)`,
    borderColor: `${accent}55`,
  };
  const inner = (
    <>
      <span className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wide" style={{ color: accent }}>
        <Icon size={10} /> {label}
      </span>
      {/* sem `block` aqui: o line-clamp precisa do próprio display
          (-webkit-box) para valer, e `block` disputava com ele */}
      <span
        className="text-xs font-bold leading-snug mt-0.5 line-clamp-2"
        style={{ color: destaque ? accent : '#334155' }}
      >
        {value}
      </span>
    </>
  );
  const cls = `absolute z-10 bg-white rounded-lg shadow-md border px-2.5 py-1.5 ${clickable ? 'hover:scale-[1.06] hover:shadow-lg transition-transform cursor-pointer' : ''}`;
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={cls} style={style}>{inner}</a>;
  if (onClick) return <button onClick={onClick} className={cls} style={style}>{inner}</button>;
  return <div className={cls} style={style}>{inner}</div>;
}

interface SedeItem {
  id: string;
  name: string;
  phone: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZipcode: string | null;
  latitude: number | null;
  longitude: number | null;
}

export function GfPublicList() {
  const [groups, setGroups] = useState<GfItem[]>([]);
  const [sede, setSede] = useState<SedeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Busca de endereço para calcular distância
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<LocationCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [origin, setOrigin] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // Modal do mapa
  const [mapGroup, setMapGroup] = useState<GfItem | null>(null);
  const [mapSede, setMapSede] = useState(false);

  // Trilha de "mapa do tesouro" ligando os cards — o carrinho percorre os
  // pontos medidos de verdade no DOM (a lista pode ter 1 ou 2 colunas
  // dependendo da tela, então a trilha é recalculada, não fixa).
  const trailWrapRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [trailPoints, setTrailPoints] = useState<{ x: number; y: number }[]>([]);
  const [traveling, setTraveling] = useState(false);
  const [rideKey, setRideKey] = useState(0);
  // Onde o carrinho está parado agora, o trecho que ele vai percorrer, e o
  // balão de "andou X km" que aparece quando ele chega.
  const [carIndex, setCarIndex] = useState(0);
  const [rota, setRota] = useState<number[]>([]);
  const [balao, setBalao] = useState<{ index: number; km: number } | null>(null);
  const chegadaRef = useRef<{ destino: number; km: number } | null>(null);

  // Esta página é clara SEMPRE. Não basta usar bg-white: o globals.css tem
  // `.dark .bg-white { background-color: #0f172a !important }` (e o mesmo
  // para os text-slate-*), então enquanto o <html> tiver a classe `dark` a
  // tela inteira é reescrita para o tema escuro. Tiramos a classe enquanto
  // esta rota está montada e devolvemos ao sair, para não afetar o resto.
  useEffect(() => {
    const root = document.documentElement;
    const eraEscuro = root.classList.contains('dark');
    if (eraEscuro) root.classList.remove('dark');
    return () => { if (eraEscuro) root.classList.add('dark'); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/public/gf-list`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erro ao carregar os Grupos Familiares.');
        setGroups(Array.isArray(data?.groups) ? data.groups : []);
        setSede(data?.sede ?? null);
      } catch (e: any) {
        setError(e.message || 'Erro ao carregar os Grupos Familiares.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError('');
    setCandidates([]);
    try {
      const results = await searchAddress(query);
      if (!results.length) {
        setSearchError('Não encontramos esse endereço. Tente incluir cidade e estado.');
        return;
      }
      if (results.length === 1) {
        applyCandidate(results[0]);
      } else {
        setCandidates(results);
      }
    } catch (e: any) {
      setSearchError(e.message || 'Falha ao pesquisar o endereço.');
    } finally {
      setSearching(false);
    }
  };

  const applyCandidate = (c: LocationCandidate) => {
    setOrigin({ lat: Number(c.lat), lon: Number(c.lon), label: c.label });
    setCandidates([]);
  };

  const clearOrigin = () => {
    setOrigin(null);
    setQuery('');
    setCandidates([]);
    setSearchError('');
  };

  // Lista já com distância calculada (quando há origem) e ordenada pelo mais perto
  const sortedGroups = useMemo(() => {
    if (!origin) return groups;
    const withDistance = groups.map((g) => ({
      ...g,
      distanceKm: haversineKm({ latitude: origin.lat, longitude: origin.lon }, { latitude: g.latitude, longitude: g.longitude }),
    }));
    return [...withDistance].sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) return 0;
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }, [groups, origin]);

  // O cadastro da sede ainda está sem endereço no banco (tudo null). Até
  // alguém preencher, cai no mesmo endereço que a home já publica, para o
  // card do centro não ficar mudo nem sem mapa.
  const SEDE_FALLBACK = {
    label: 'Rua Barão de Parnaíba, 149 · Conceição · Campinas',
    addressStreet: 'Rua Barão de Parnaíba',
    addressNumber: '149',
    addressNeighborhood: 'Conceição',
    addressCity: 'Campinas',
    addressState: 'SP',
    addressZipcode: '13013-170',
  };

  const sedeAddressDoBanco = sede
    ? [
        [sede.addressStreet, sede.addressNumber].filter(Boolean).join(', '),
        sede.addressNeighborhood,
        sede.addressCity,
      ].filter(Boolean).join(' · ')
    : '';
  const sedeAddress = sedeAddressDoBanco || SEDE_FALLBACK.label;
  // o que o mapa usa: o cadastro se existir, senão o endereço de referência
  const sedeParaMapa = sede?.addressStreet ? sede : SEDE_FALLBACK;

  // Mede a posição real dos cards no DOM pra desenhar a trilha — as pontas da
  // estrela mudam de lugar conforme a largura da tela, então não dá pra
  // calcular isso "no papel": tem que ler do layout depois que ele assenta.
  useEffect(() => {
    function medir() {
      const wrap = trailWrapRef.current;
      if (!wrap) return;
      const wrapRect = wrap.getBoundingClientRect();
      const pontos = sortedGroups
        .map((gf) => {
          const el = cardRefs.current[gf.id];
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.left - wrapRect.left + r.width / 2, y: r.top - wrapRect.top };
        })
        .filter((p): p is { x: number; y: number } => p !== null);
      setTrailPoints(pontos);
    }
    medir();
    const t = setTimeout(medir, 250); // depois das fotos/fontes assentarem o layout
    window.addEventListener('resize', medir);
    return () => { clearTimeout(t); window.removeEventListener('resize', medir); };
  }, [sortedGroups]);

  /**
   * Manda o carrinho do GF onde ele está até o `destino`, passando por todos
   * os GFs do caminho. A distância mostrada no balão é a soma real (Haversine)
   * dos trechos percorridos — não a distância em pixels da tela.
   */
  const viajarPara = (destino: number) => {
    if (traveling || trailPoints.length < 2) return;
    if (destino < 0 || destino >= trailPoints.length || destino === carIndex) return;

    const passo = destino > carIndex ? 1 : -1;
    const caminho: number[] = [];
    for (let i = carIndex; passo > 0 ? i <= destino : i >= destino; i += passo) caminho.push(i);

    let km = 0;
    for (let i = 1; i < caminho.length; i++) {
      const trecho = haversineKm(sortedGroups[caminho[i - 1]], sortedGroups[caminho[i]]);
      if (trecho) km += trecho;
    }

    chegadaRef.current = { destino, km };
    setBalao(null);
    setRota(caminho);
    setRideKey((k) => k + 1);
    setTraveling(true);
  };

  // O botão manda para a outra ponta: na ida vai até o último GF, e clicando
  // de novo o carrinho volta para o primeiro.
  const iniciarPasseio = () => {
    viajarPara(carIndex === 0 ? trailPoints.length - 1 : 0);
  };

  const aoChegar = () => {
    const chegada = chegadaRef.current;
    setTraveling(false);
    if (!chegada) return;
    setCarIndex(chegada.destino);
    setBalao({ index: chegada.destino, km: chegada.km });
  };

  return (
    <div className="min-h-screen font-sans bg-white" style={{ colorScheme: 'light' }}>
      {/* Header */}
      <header className="flex items-center justify-between p-6 md:px-12">
        <Link to="/" className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </Link>
        <h1 className="text-lg md:text-xl font-bold text-amber-600">Grupos Familiares</h1>
        <span className="w-10 h-10" />
      </header>

      <main className="px-6 pb-16">
        {/* Texto de intro fica num miolo mais estreito — os cards logo
            abaixo usam um container mais largo e "vazam" pra fora dele */}
        <div className="max-w-xl mx-auto">
        <p className="text-sm mb-6 text-slate-500">
          Encontre um GF perto de você — veja o líder, o endereço e o horário de cada grupo.
        </p>

        {/* Busca de endereço / distância — some atrás de uma lupa de investigador,
            só expande quando a pessoa clica nela */}
        {!searchOpen && !origin ? (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-3 mb-8 group"
          >
            <span className="w-14 h-14 rounded-full bg-white border-2 border-amber-300 shadow-sm flex items-center justify-center group-hover:scale-105 group-hover:border-amber-400 transition-transform">
              <Search size={24} className="text-amber-600" strokeWidth={2.5} />
            </span>
            <span className="text-sm font-semibold text-slate-600 group-hover:text-slate-800">
              Investigar o GF mais perto de você
            </span>
          </button>
        ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-8 shadow-sm relative">
          {!origin && (
            <button
              onClick={() => setSearchOpen(false)}
              className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <X size={16} />
            </button>
          )}
          <label className="block text-xs font-semibold mb-2 text-slate-500 pr-6">
            Digite seu endereço para ver a distância até cada GF
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="Rua, número, bairro, cidade..."
              autoFocus
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              className="w-11 h-11 shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white flex items-center justify-center"
              title="Calcular distância"
            >
              {searching ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
            </button>
          </div>

          {searchError && (
            <p className="text-red-500 text-xs flex items-center gap-1.5 mt-2">
              <AlertCircle size={13} /> {searchError}
            </p>
          )}

          {candidates.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs text-slate-500">Encontramos mais de um endereço, escolha o correto:</p>
              {candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => applyCandidate(c)}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs border border-slate-200 text-slate-700 hover:border-emerald-500 transition-colors"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {origin && (
            <div className="mt-3 rounded-xl overflow-hidden border border-emerald-200">
              <div className="flex items-center justify-between gap-2 text-xs px-3 py-2 bg-emerald-50 text-emerald-700">
                <span className="flex items-center gap-1.5 truncate">
                  <Navigation size={13} className="shrink-0" /> Distâncias a partir de: {origin.label}
                </span>
                <button onClick={clearOrigin} className="shrink-0 opacity-70 hover:opacity-100">
                  <X size={14} />
                </button>
              </div>
              {/* Desenho do mapa da origem digitada, não só o texto do endereço */}
              <iframe
                title="Mapa do endereço digitado"
                src={buildMapEmbedUrl({ latitude: origin.lat, longitude: origin.lon })}
                className="w-full h-40 border-0 block"
                loading="lazy"
              />
            </div>
          )}
        </div>
        )}
        </div>

        {/* Constelação: a SEDE no centro e os quadros dos GFs em volta, cada
            um girado num ângulo e ligado a ela. As posições saem de um
            ângulo (estrela), então serve para 1 ou para vários GFs. */}
        <div className="max-w-5xl mx-auto">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
            <AlertCircle className="mx-auto mb-2 h-6 w-6" />
            {error}
          </div>
        )}

        {!loading && !error && sortedGroups.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            Nenhum Grupo Familiar disponível no momento.
          </div>
        )}

        {!loading && !error && sortedGroups.length > 1 && (
          <button
            onClick={iniciarPasseio}
            disabled={traveling}
            className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full border-2 border-dashed border-amber-400 text-amber-700 text-xs font-bold hover:bg-amber-50 disabled:opacity-50 transition-colors"
          >
            <Car size={15} />
            {traveling
              ? 'Percorrendo os GFs...'
              : carIndex === 0
                ? 'Percorrer a trilha dos GFs'
                : 'Voltar ao primeiro GF'}
          </button>
        )}

        {!loading && !error && sortedGroups.length > 0 && (
          <div ref={trailWrapRef} className="relative w-full aspect-[4/3]">
            {/* raios ligando a sede a cada GF */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
              {sortedGroups.map((gf, i) => {
                const p = starPoint(i, sortedGroups.length);
                return (
                  <line
                    key={gf.id}
                    x1={50} y1={50} x2={p.x} y2={p.y}
                    stroke={paletteFor(gf, i).accent}
                    strokeWidth={1.6}
                    strokeDasharray="3 3"
                    strokeLinecap="round"
                    opacity={0.45}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>

            {/* carrinho passeando entre os GFs */}
            {trailPoints.length > 1 && trailPoints[carIndex] && (
              <motion.div
                key={rideKey}
                className="absolute z-30 w-8 h-8 -ml-4 -mt-4 rounded-full bg-amber-500 border-2 border-white shadow-lg flex items-center justify-center pointer-events-none"
                initial={{ x: trailPoints[carIndex].x, y: trailPoints[carIndex].y }}
                animate={
                  traveling && rota.length > 1
                    ? { x: rota.map((i) => trailPoints[i].x), y: rota.map((i) => trailPoints[i].y) }
                    : { x: trailPoints[carIndex].x, y: trailPoints[carIndex].y }
                }
                transition={traveling ? { duration: Math.max(1, rota.length * 0.9), ease: 'easeInOut' } : { duration: 0 }}
                onAnimationComplete={() => { if (traveling) aoChegar(); }}
              >
                <Car size={16} className="text-white" />
              </motion.div>
            )}

            {/* balão com a distância percorrida */}
            {balao && trailPoints[balao.index] && !traveling && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute z-40 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg pointer-events-none"
                style={{ left: trailPoints[balao.index].x, top: trailPoints[balao.index].y - 46 }}
              >
                {balao.km > 0
                  ? `🚗 ${balao.km.toFixed(1).replace('.', ',')} km percorridos`
                  : '🚗 Chegou!'}
                <span className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 rotate-45 bg-slate-900" />
              </motion.div>
            )}

            {/* SEDE no centro da estrela */}
            <div className="absolute z-20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[26%] max-w-[180px]">
              <div className="rounded-2xl bg-white border-2 border-amber-300 shadow-lg p-3 text-center">
                <div className="mx-auto mb-2 w-14 h-14 rounded-full overflow-hidden border-2 border-amber-200 bg-white">
                  <img src="/adcampinas.png" alt="" className="w-full h-full object-cover" />
                </div>
                <p className="text-[9px] font-extrabold uppercase tracking-wide text-amber-600">Igreja sede</p>
                <p className="text-xs font-extrabold text-slate-800 leading-tight mt-0.5">
                  {sede?.name ?? 'AD Campinas'}
                </p>
                {sedeAddress && (
                  <button
                    onClick={() => setMapSede(true)}
                    className="mt-1.5 text-[10px] font-semibold text-amber-700 hover:underline leading-snug"
                  >
                    {sedeAddress}
                  </button>
                )}
              </div>
            </div>

            {/* cada GF é um quadro girado numa ponta da estrela */}
            {sortedGroups.map((gf, index) => {
              const pal = paletteFor(gf, index);
              const address = formatAddress(gf);
              const p = starPoint(index, sortedGroups.length);
              const giro = STAR_TILT[index % STAR_TILT.length];

              const values: Partial<Record<typeof TAGS_LAYOUT[number]['key'], React.ReactNode>> = {
                name: gf.name,
                leader: gf.leaderName,
                time: [gf.meetingDay, gf.meetingTime].filter(Boolean).join(' às ') || null,
                address: address || null,
              };

              return (
                <div
                  key={gf.id}
                  ref={(el) => { cardRefs.current[gf.id] = el; }}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 w-[27%] max-w-[200px]"
                  style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `translate(-50%, -50%) rotate(${giro}deg)` }}
                >
                  <div className="relative aspect-[3/4]">
                    {/* mancha colorida só atrás da foto */}
                    <div
                      className="absolute rounded-2xl pointer-events-none"
                      style={{
                        left: '2%', top: '6%', width: '54%', height: '44%',
                        background: pal.card,
                        backgroundImage: `radial-gradient(${pal.accent}18 1px, transparent 1px)`,
                        backgroundSize: '14px 14px',
                      }}
                    />

                    {/* barbantes da foto até as etiquetas */}
                    <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {TAGS_LAYOUT.filter((t) => values[t.key]).map((t) => (
                        <line
                          key={t.key}
                          x1={PHOTO_ANCHOR.x} y1={PHOTO_ANCHOR.y}
                          x2={t.anchor.x} y2={t.anchor.y}
                          stroke={pal.accent}
                          strokeWidth={0.6}
                          strokeDasharray="1.6 1.6"
                          strokeLinecap="round"
                          opacity={0.55}
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                    </svg>

                    {gf.cellType && (
                      <span
                        className="absolute top-0 right-0 z-20 -rotate-3 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide text-white shadow-sm"
                        style={{ background: pal.accent }}
                      >
                        {gf.cellType}
                      </span>
                    )}

                    {gf.distanceKm !== undefined && gf.distanceKm !== null && (
                      <span
                        className="absolute bottom-0 right-0 z-20 px-2 py-0.5 rounded-full text-[9px] font-bold text-white shadow-sm"
                        style={{ background: pal.accent }}
                      >
                        {gf.distanceKm.toFixed(1).replace('.', ',')} km
                      </span>
                    )}

                    {/* foto pinada — clicar chama o carrinho até este GF */}
                    <button
                      type="button"
                      onClick={() => viajarPara(index)}
                      title="Levar o carrinho até este GF"
                      className="absolute z-10 hover:scale-105 transition-transform"
                      style={{ left: '8%', top: '10%', width: '34%' }}
                    >
                      <div className="relative aspect-square -rotate-6">
                        <div className="w-full h-full rounded-full overflow-hidden border-[3px] border-white shadow-lg bg-white">
                          {gf.photo ? (
                            <img src={gf.photo} alt={gf.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center" style={{ background: pal.soft }}>
                              <ImageOff size={18} style={{ color: pal.accent, opacity: 0.6 }} />
                            </div>
                          )}
                        </div>
                        <span
                          className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow"
                          style={{ background: pal.accent }}
                        />
                      </div>
                    </button>

                    {values.name && (
                      <BoardTag
                        icon={TAGS_LAYOUT[0].icon} label={TAGS_LAYOUT[0].label} box={TAGS_LAYOUT[0].box} rotate={TAGS_LAYOUT[0].rotate}
                        value={values.name} accent={pal.accent}
                      />
                    )}
                    {values.leader && (
                      <BoardTag
                        icon={TAGS_LAYOUT[1].icon} label={TAGS_LAYOUT[1].label} box={TAGS_LAYOUT[1].box} rotate={TAGS_LAYOUT[1].rotate}
                        value={values.leader} accent={pal.accent}
                        href={gf.leaderPhone ? `https://wa.me/55${gf.leaderPhone.replace(/\D/g, '')}` : undefined}
                      />
                    )}
                    {values.time && (
                      <BoardTag
                        icon={TAGS_LAYOUT[2].icon} label={TAGS_LAYOUT[2].label} box={TAGS_LAYOUT[2].box} rotate={TAGS_LAYOUT[2].rotate}
                        value={values.time} accent={pal.accent}
                      />
                    )}
                    {values.address && (
                      <BoardTag
                        icon={TAGS_LAYOUT[3].icon} label={TAGS_LAYOUT[3].label} box={TAGS_LAYOUT[3].box} rotate={TAGS_LAYOUT[3].rotate}
                        value={values.address} accent={pal.accent} destaque onClick={() => setMapGroup(gf)}
                      />
                    )}
                  </div>

                  {gf.leaderPhone && (
                    <a
                      href={`https://wa.me/55${gf.leaderPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Vi o GF "${gf.name}" no site e tenho interesse em participar 🙂`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="relative z-30 mt-2 flex items-center justify-center gap-1 w-full px-2 py-1.5 rounded-full text-[10px] font-extrabold text-white shadow hover:scale-[1.03] transition-transform"
                      style={{ background: pal.accent }}
                    >
                      <Users size={10} /> Quero participar
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>

      </main>

      {/* Modal do mapa */}
      {mapGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMapGroup(null)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xl z-10">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-900">{mapGroup.name}</h3>
              <button onClick={() => setMapGroup(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe
              title={`Mapa - ${mapGroup.name}`}
              src={buildMapEmbedUrl(mapGroup)}
              className="w-full h-72 border-0"
              loading="lazy"
            />
            <div className="p-4 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">{formatAddress(mapGroup)}</p>
              <a
                href={buildMapsLink(mapGroup)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700"
              >
                Abrir no Google Maps
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal do mapa da SEDE */}
      {mapSede && sede && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMapSede(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xl z-10">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-900">{sede.name}</h3>
              <button onClick={() => setMapSede(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe
              title={`Mapa - ${sede.name}`}
              src={buildMapEmbedUrl(sedeParaMapa)}
              className="w-full h-72 border-0"
              loading="lazy"
            />
            <div className="p-4 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">{sedeAddress}</p>
              <a
                href={buildMapsLink(sedeParaMapa)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700"
              >
                Abrir no Google Maps
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
