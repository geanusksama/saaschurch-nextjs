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

import { useMarcaDaIgreja } from '../../lib/useMarcaDaIgreja';
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
  /** todos os líderes; o primeiro é o principal (recebe a mensagem) */
  leaders?: Array<{ name: string; phone: string | null; photoUrl: string | null }>;
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
// quando a coluna fica mais estreita no celular.
const TAGS_LAYOUT = [
  { key: 'name', icon: Tag, label: 'Nome', box: { left: 48, top: 2, width: 50 }, anchor: { x: 48, y: 8 }, rotate: -3 },
  { key: 'leader', icon: Users, label: 'Líder', box: { left: 52, top: 26, width: 50 }, anchor: { x: 52, y: 32 }, rotate: 2 },
  { key: 'time', icon: Clock, label: 'Horário', box: { left: 46, top: 50, width: 50 }, anchor: { x: 46, y: 56 }, rotate: -2 },
  { key: 'address', icon: MapPin, label: 'Endereço', box: { left: 24, top: 72, width: 58 }, anchor: { x: 32, y: 78 }, rotate: 3 },
] as const;

/** Inclinação de cada quadro — dá o ar de "colado torto" no mural. */
const STAR_TILT = [-6, 5, -3, 7, -8, 4];

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
  const marca = useMarcaDaIgreja();
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
  const [rotaXY, setRotaXY] = useState<{ x: number; y: number }[]>([]);
  const [balao, setBalao] = useState<{ index: number; km: number } | null>(null);
  // foto aberta em zoom
  const [zoomFoto, setZoomFoto] = useState<{
    src: string;
    nome: string;
    subtitulo?: string;
    accent?: string;
    lideres?: Array<{ name: string; phone: string | null; photoUrl: string | null }>;
    /** o GF de origem — habilita o mapa e o "Quero participar" dentro do celular */
    gf?: GfItem;
  } | null>(null);
  /** GF sob o mouse — os outros desbotam para destacar este */
  const [hoverGf, setHoverGf] = useState<string | null>(null);
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
  // Paradas do carrinho: a SEDE é a parada 0 e cada GF vem em seguida. Assim
  // clicar no pino da sede também leva o carrinho até lá.
  const paradas = useMemo(
    () => [
      { key: 'sede', latitude: sede?.latitude ?? null, longitude: sede?.longitude ?? null },
      ...sortedGroups.map((g) => ({ key: g.id, latitude: g.latitude, longitude: g.longitude })),
    ],
    [sede, sortedGroups],
  );

  useEffect(() => {
    function medir() {
      const wrap = trailWrapRef.current;
      if (!wrap) return;
      const wrapRect = wrap.getBoundingClientRect();
      const pontos = paradas.map((p) => {
        const el = cardRefs.current[p.key];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: r.left - wrapRect.left + r.width / 2,
          y: r.top - wrapRect.top + r.height / 2,
        };
      });
      // só publica quando TODAS as paradas já existem no DOM: um ponto faltando
      // desalinharia os índices e o carrinho iria para o lugar errado
      if (pontos.every((p) => p !== null)) setTrailPoints(pontos as { x: number; y: number }[]);
    }
    medir();
    const t = setTimeout(medir, 250); // depois das fotos/fontes assentarem o layout
    window.addEventListener('resize', medir);
    return () => { clearTimeout(t); window.removeEventListener('resize', medir); };
  }, [paradas]);

  /**
   * Manda o carrinho até a parada `destino`.
   *
   * O trajeto NÃO é uma reta: são pontos intermediários com um desvio lateral
   * para o carrinho serpentear, como quem pega ruas. O desvio é sorteado a
   * partir dos índices (não do Math.random) para o mesmo trecho sair sempre
   * igual — senão a rota mudaria a cada clique e ficaria nervosa.
   *
   * A distância do balão é a real (Haversine) entre as paradas, não pixels.
   */
  const viajarPara = (destino: number) => {
    if (traveling || trailPoints.length < 2) return;
    if (destino < 0 || destino >= trailPoints.length || destino === carIndex) return;

    const de = trailPoints[carIndex];
    const para = trailPoints[destino];
    if (!de || !para) return;

    // desvio pseudo-aleatório porém estável para este par de paradas
    const semente = Math.sin((carIndex + 1) * 12.9898 + (destino + 1) * 78.233) * 43758.5453;
    const lado = semente - Math.floor(semente) > 0.5 ? 1 : -1;
    const dx = para.x - de.x;
    const dy = para.y - de.y;
    const comprimento = Math.hypot(dx, dy) || 1;
    // normal ao trecho, para empurrar o meio do caminho para um dos lados
    const nx = -dy / comprimento;
    const ny = dx / comprimento;
    const curvatura = Math.min(90, comprimento * 0.22) * lado;

    const PASSOS = 24;
    const caminho: { x: number; y: number }[] = [];
    for (let i = 0; i <= PASSOS; i++) {
      const t = i / PASSOS;
      // curva suave (seno) + um chacoalhar leve para não ficar robótico
      const desvio = Math.sin(t * Math.PI) * curvatura;
      const treme = Math.sin(t * Math.PI * 6) * 4 * Math.sin(t * Math.PI);
      caminho.push({
        x: de.x + dx * t + nx * (desvio + treme),
        y: de.y + dy * t + ny * (desvio + treme),
      });
    }

    const km = haversineKm(paradas[carIndex], paradas[destino]) ?? 0;

    chegadaRef.current = { destino, km };
    setBalao(null);
    setRotaXY(caminho);
    setRideKey((k) => k + 1);
    setTraveling(true);
  };

  const aoChegar = () => {
    const chegada = chegadaRef.current;
    setTraveling(false);
    if (!chegada) return;
    setCarIndex(chegada.destino);
    setBalao({ index: chegada.destino, km: chegada.km });
  };

  /**
   * Um GF: o quadro com a foto pinada e as etiquetas em volta.
   *
   * Vive numa função (e não inline no JSX) porque as duas colunas chamam o
   * mesmo desenho — os índices PARES vão para a esquerda e os ÍMPARES para a
   * direita, e a lista cresce sozinha por mais GFs que existam.
   */
  function renderGf(gf: GfItem, index: number) {
    const pal = paletteFor(gf, index);
    const address = formatAddress(gf);
    const giro = STAR_TILT[index % STAR_TILT.length];
    const emFoco = hoverGf === gf.id;

    const values: Partial<Record<typeof TAGS_LAYOUT[number]['key'], React.ReactNode>> = {
      name: gf.name,
      leader: gf.leaders?.length ? gf.leaders.map((l) => l.name).join(' e ') : gf.leaderName,
      time: [gf.meetingDay, gf.meetingTime].filter(Boolean).join(' às ') || null,
      address: address || null,
    };

    return (
      <div
        key={gf.id}
        ref={(el) => { cardRefs.current[gf.id] = el; }}
        onMouseEnter={() => setHoverGf(gf.id)}
        onMouseLeave={() => setHoverGf(null)}
        // ao passar o mouse o quadro endireita e cresce; os outros desbotam
        className="w-full max-w-[210px] transition-all duration-300"
        style={{
          transform: `rotate(${emFoco ? 0 : giro}deg) scale(${emFoco ? 1.08 : 1})`,
          zIndex: emFoco ? 25 : 10,
          opacity: hoverGf && !emFoco ? 0.5 : 1,
          filter: hoverGf && !emFoco ? 'saturate(0.6)' : 'none',
        }}
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

          {/* pino: clicar leva o carrinho até este GF */}
          <button
            type="button"
            onClick={() => viajarPara(index + 1)}
            disabled={traveling || carIndex === index + 1}
            title="Levar o carrinho até este GF"
            className="absolute z-30 w-7 h-7 rounded-full text-white border-2 border-white shadow flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-40 disabled:hover:scale-100"
            style={{ left: '2%', top: '2%', background: pal.accent }}
          >
            <MapPin size={13} />
          </button>

          {/* foto pinada — clicar amplia no formato de celular */}
          <button
            type="button"
            onClick={() => setZoomFoto({
              src: gf.photo || marca.logoUrl || '',
              nome: gf.name,
              subtitulo: [gf.cellType, [gf.meetingDay, gf.meetingTime].filter(Boolean).join(' às ')]
                .filter(Boolean).join(' · '),
              accent: pal.accent,
              lideres: gf.leaders?.length
                ? gf.leaders
                : gf.leaderName
                  ? [{ name: gf.leaderName, phone: gf.leaderPhone, photoUrl: gf.leaderPhotoUrl }]
                  : [],
              gf,
            })}
            title="Ampliar"
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
              // o link vai para o líder PRINCIPAL (o primeiro da lista)
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
  }


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
        <div className="max-w-7xl mx-auto">
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

        {!loading && !error && sortedGroups.length > 0 && (
          <div ref={trailWrapRef} className="relative">
            {/* Fundo com jeito de mapa (decoração, não é mapa geográfico:
                as posições aqui são o layout, não a localização real). */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" preserveAspectRatio="none">
              <rect x="0" y="0" width="100%" height="100%" fill="#FDFCF7" />
              {Array.from({ length: 14 }).map((_, i) => (
                <line key={`h${i}`} x1="0" y1={i * 90} x2="100%" y2={i * 90} stroke="#EDE9DC" strokeWidth={2} />
              ))}
              {Array.from({ length: 10 }).map((_, i) => (
                <line key={`v${i}`} x1={i * 110} y1="0" x2={i * 110} y2="100%" stroke="#EDE9DC" strokeWidth={2} />
              ))}
            </svg>

            {/* linhas ligando a sede a cada GF — desenhadas sobre as posições
                MEDIDAS no DOM, então acompanham as colunas em qualquer tela */}
            {trailPoints.length > 1 && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1]" style={{ overflow: 'visible' }}>
                {sortedGroups.map((gf, i) => {
                  const sedeP = trailPoints[0];
                  const gfP = trailPoints[i + 1];
                  if (!sedeP || !gfP) return null;
                  return (
                    <line
                      key={gf.id}
                      x1={sedeP.x} y1={sedeP.y} x2={gfP.x} y2={gfP.y}
                      stroke={paletteFor(gf, i).accent}
                      strokeWidth={2}
                      strokeDasharray="4 5"
                      strokeLinecap="round"
                      opacity={hoverGf && hoverGf !== gf.id ? 0.15 : 0.45}
                    />
                  );
                })}
              </svg>
            )}

            {/* rastro do carrinho */}
            {traveling && rotaXY.length > 1 && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" style={{ overflow: 'visible' }}>
                <polyline
                  points={rotaXY.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="#D97706"
                  strokeWidth={2.5}
                  strokeDasharray="3 7"
                  strokeLinecap="round"
                  opacity={0.65}
                />
              </svg>
            )}

            {/* carrinho */}
            {trailPoints.length > 1 && trailPoints[carIndex] && (
              <motion.div
                key={rideKey}
                className="absolute z-30 w-8 h-8 -ml-4 -mt-4 rounded-full bg-amber-500 border-2 border-white shadow-lg flex items-center justify-center pointer-events-none"
                initial={{ x: trailPoints[carIndex].x, y: trailPoints[carIndex].y }}
                animate={
                  traveling && rotaXY.length > 1
                    ? { x: rotaXY.map((p) => p.x), y: rotaXY.map((p) => p.y) }
                    : { x: trailPoints[carIndex].x, y: trailPoints[carIndex].y }
                }
                transition={traveling ? { duration: 2.2, ease: 'easeInOut' } : { duration: 0 }}
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
                  ? `🚗 ${balao.km.toFixed(1).replace('.', ',')} km daqui`
                  : '🚗 Chegou!'}
                <span className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 rotate-45 bg-slate-900" />
              </motion.div>
            )}

            {/* Duas colunas ao redor da sede. Os GFs vão preenchendo:
                índice par na coluna da esquerda, ímpar na direita — então
                cresce sozinho por mais GFs que existam. No celular vira uma
                coluna só, com a sede em cima. */}
            {/* `md:items-center` deixa a sede no MEIO da altura, entre todos os
                GFs — e não colada no topo. Cada lado vira duas subcolunas nas
                telas largas, então cabem muitos GFs sem esticar a página. */}
            <div className="relative z-10 grid gap-x-10 gap-y-12 grid-cols-1 md:grid-cols-[1fr_auto_1fr] md:items-center px-4 py-10">
              {/* lado esquerdo */}
              <div className="order-2 md:order-1 grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-14 justify-items-center">
                {sortedGroups.filter((_, i) => i % 2 === 0).map((gf) => renderGf(gf, sortedGroups.indexOf(gf)))}
              </div>

              {/* SEDE no centro */}
              <div
                ref={(el) => { cardRefs.current.sede = el; }}
                className="order-1 md:order-2 mx-auto w-full max-w-[200px] md:self-center"
              >
                <div className="relative rounded-2xl bg-white border-2 border-amber-300 shadow-lg p-3 text-center">
                  <button
                    type="button"
                    onClick={() => viajarPara(0)}
                    disabled={traveling || carIndex === 0}
                    title="Trazer o carrinho para a sede"
                    className="absolute -top-2 -left-2 z-30 w-7 h-7 rounded-full bg-amber-500 text-white border-2 border-white shadow flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-40 disabled:hover:scale-100"
                  >
                    <MapPin size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setZoomFoto({
                        src: marca.logoUrl ?? '',
                        nome: sede?.name ?? marca.nome,
                        subtitulo: sedeAddress,
                      })
                    }
                    title="Ampliar"
                    className="mx-auto mb-2 block w-14 h-14 rounded-full overflow-hidden border-2 border-amber-200 bg-white hover:scale-105 transition-transform"
                  >
                    {marca.logoUrl && (
                      <img src={marca.logoUrl} alt="" className="w-full h-full object-cover" />
                    )}
                  </button>
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
                  <p className="mt-2 text-[10px] font-bold text-slate-400">
                    {sortedGroups.length} {sortedGroups.length === 1 ? 'grupo' : 'grupos'}
                  </p>
                </div>
              </div>

              {/* lado direito */}
              <div className="order-3 grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-14 justify-items-center">
                {sortedGroups.filter((_, i) => i % 2 === 1).map((gf) => renderGf(gf, sortedGroups.indexOf(gf)))}
              </div>
            </div>
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

      {/* Foto ampliada */}
      {zoomFoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={() => setZoomFoto(null)}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="relative z-10 flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* moldura de celular: a foto entra como se fosse a tela */}
            <div
              className="relative rounded-[2.2rem] bg-slate-900 p-2.5 shadow-2xl ring-1 ring-white/20"
              style={{ width: 'min(20rem, 78vw)' }}
            >
              {/* notch */}
              <span className="absolute top-2.5 left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-slate-900" />
              <div className="relative aspect-[9/19] overflow-hidden rounded-[1.7rem] bg-white flex flex-col">
                {/* foto do GF ocupa a parte de cima da "tela" */}
                <div className="relative h-[58%] w-full shrink-0 bg-slate-100">
                  <img src={zoomFoto.src} alt={zoomFoto.nome} className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-3 pt-8">
                    <p className="text-sm font-extrabold leading-tight text-white">{zoomFoto.nome}</p>
                    {zoomFoto.subtitulo && (
                      <p className="text-[11px] font-medium text-white/85">{zoomFoto.subtitulo}</p>
                    )}
                  </div>
                </div>

                {/* líderes logo abaixo, um por linha */}
                <div className="flex-1 overflow-y-auto px-3 py-3">
                  {zoomFoto.lideres?.length ? (
                    <>
                      <p
                        className="mb-2 text-[9px] font-extrabold uppercase tracking-wide"
                        style={{ color: zoomFoto.accent ?? '#D97706' }}
                      >
                        {zoomFoto.lideres.length > 1 ? 'Líderes' : 'Líder'}
                      </p>
                      <div className="space-y-2">
                        {zoomFoto.lideres.map((l, i) => (
                          <div key={`${l.name}-${i}`} className="flex items-center gap-2.5">
                            <div
                              className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 bg-slate-100"
                              style={{ borderColor: zoomFoto.accent ?? '#D97706' }}
                            >
                              {l.photoUrl ? (
                                <img src={l.photoUrl} alt={l.name} className="h-full w-full object-cover" />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center">
                                  <Users size={15} className="text-slate-400" />
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11px] font-bold text-slate-800">{l.name}</p>
                              {l.phone && <p className="truncate text-[10px] text-slate-500">{l.phone}</p>}
                            </div>
                            {l.phone && (
                              <a
                                href={`https://wa.me/55${l.phone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                title={`Falar com ${l.name}`}
                                className="shrink-0 rounded-full p-1.5 text-white"
                                style={{ background: zoomFoto.accent ?? '#D97706' }}
                              >
                                <Users size={12} />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-400">Sem líder cadastrado.</p>
                  )}
                </div>

                {/* endereço no mapa + entrar no grupo, sem sair da "tela" */}
                {zoomFoto.gf && (
                  <div className="shrink-0 border-t border-slate-100 px-3 py-2.5 space-y-2">
                    {formatAddress(zoomFoto.gf) && (
                      <button
                        onClick={() => {
                          const alvo = zoomFoto.gf!;
                          setZoomFoto(null);
                          setMapGroup(alvo);
                        }}
                        className="flex w-full items-start gap-2 text-left"
                      >
                        <span
                          className="mt-0.5 shrink-0 rounded-lg p-1.5 text-white"
                          style={{ background: zoomFoto.accent ?? '#D97706' }}
                        >
                          <MapPin size={12} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[9px] font-extrabold uppercase tracking-wide text-slate-400">
                            Ver no mapa
                          </span>
                          <span className="block text-[10px] font-semibold leading-snug text-slate-600 line-clamp-2">
                            {formatAddress(zoomFoto.gf)}
                          </span>
                        </span>
                      </button>
                    )}

                    {zoomFoto.gf.leaderPhone && (
                      <a
                        href={`https://wa.me/55${zoomFoto.gf.leaderPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Vi o GF "${zoomFoto.gf.name}" no site e tenho interesse em participar 🙂`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-extrabold text-white shadow hover:brightness-105"
                        style={{ background: zoomFoto.accent ?? '#D97706' }}
                      >
                        <Users size={12} /> Quero participar
                      </a>
                    )}
                  </div>
                )}

                {/* barrinha de "home" do celular */}
                <span className="mx-auto my-2 block h-1 w-20 shrink-0 rounded-full bg-slate-300" />
              </div>
              {/* botões laterais */}
              <span className="absolute -left-1 top-24 h-10 w-1 rounded-l bg-slate-700" />
              <span className="absolute -right-1 top-20 h-14 w-1 rounded-r bg-slate-700" />
            </div>
            <p className="text-base font-bold text-white drop-shadow">{zoomFoto.nome}</p>
          </motion.div>
          <button
            onClick={() => setZoomFoto(null)}
            className="absolute top-5 right-5 z-20 p-2 rounded-full bg-white/15 text-white hover:bg-white/25"
            title="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}
