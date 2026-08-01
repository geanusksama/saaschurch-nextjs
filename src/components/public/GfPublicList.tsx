/**
 * Grupos Familiares — página pública.
 *
 * Aberta pelo ícone "Grupos Familiares" da home. Lista os GFs ativos da sede
 * com foto de capa, líder, endereço e horário. A pessoa pode digitar o
 * próprio endereço para ver a distância até cada grupo (Haversine, "de
 * pássaro" — mesma limitação documentada em lib/geo.ts) e ordenar pelo mais
 * perto. Clicar no endereço abre o mapa embutido (Google Maps sem chave).
 *
 * Sem autenticação: mesma lógica de "portal público de uma igreja só" das
 * demais páginas deste site.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft, Users, MapPin, Phone, Clock, Loader2, AlertCircle, Search,
  X, Navigation, Sun, Moon,
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

export function GfPublicList() {
  const [isDark, setIsDark] = useState(true);
  const [groups, setGroups] = useState<GfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Busca de endereço para calcular distância
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<LocationCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [origin, setOrigin] = useState<{ lat: number; lon: number; label: string } | null>(null);

  // Modal do mapa
  const [mapGroup, setMapGroup] = useState<GfItem | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('mrm_theme_settings');
    if (saved) {
      try { setIsDark(JSON.parse(saved).isDark !== false); } catch { setIsDark(true); }
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/public/gf-list`);
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.error || 'Erro ao carregar os Grupos Familiares.');
        setGroups(Array.isArray(data) ? data : []);
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

  const bg = isDark ? '#0a0a0a' : '#f5f4f0';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSub = isDark ? 'text-slate-400' : 'text-gray-500';
  const cardBg = isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-gray-200';
  const avatarCls = isDark
    ? 'bg-slate-800 border border-slate-700 hover:bg-slate-700'
    : 'bg-white border border-gray-200 hover:bg-gray-50';

  return (
    <div className="min-h-screen font-sans transition-colors duration-500" style={{ background: bg }}>
      {/* Header */}
      <header className="flex items-center justify-between p-6 md:px-12">
        <Link to="/" className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${avatarCls}`}>
          <ArrowLeft className={`w-5 h-5 ${textSub}`} />
        </Link>
        <h1 className={`text-lg md:text-xl font-bold ${textPrimary}`}>Grupos Familiares</h1>
        <button onClick={() => setIsDark((d) => !d)} title={isDark ? 'Tema claro' : 'Tema escuro'}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${avatarCls}`}>
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 pb-16">
        <p className={`text-sm mb-6 ${textSub}`}>
          Encontre um GF perto de você — veja o líder, o endereço e o horário de cada grupo.
        </p>

        {/* Busca de endereço / distância */}
        <div className={`rounded-2xl border p-4 mb-8 ${cardBg}`}>
          <label className={`block text-xs font-semibold mb-2 ${textSub}`}>
            Digite seu endereço para ver a distância até cada GF
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="Rua, número, bairro, cidade..."
              className={`flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
            />
            <button
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 shrink-0"
            >
              {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              Calcular
            </button>
          </div>

          {searchError && (
            <p className="text-red-500 text-xs flex items-center gap-1.5 mt-2">
              <AlertCircle size={13} /> {searchError}
            </p>
          )}

          {candidates.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className={`text-xs ${textSub}`}>Encontramos mais de um endereço, escolha o correto:</p>
              {candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => applyCandidate(c)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs border hover:border-emerald-500 transition-colors ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-700'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {origin && (
            <div className={`mt-3 flex items-center justify-between gap-2 text-xs rounded-lg px-3 py-2 ${isDark ? 'bg-emerald-900/30 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
              <span className="flex items-center gap-1.5 truncate">
                <Navigation size={13} className="shrink-0" /> Distâncias a partir de: {origin.label}
              </span>
              <button onClick={clearOrigin} className="shrink-0 opacity-70 hover:opacity-100">
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Lista de GFs */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
          </div>
        )}

        {!loading && error && (
          <div className={`rounded-2xl border p-6 text-center text-sm ${isDark ? 'border-amber-900/50 bg-amber-950/30 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <AlertCircle className="mx-auto mb-2 h-6 w-6" />
            {error}
          </div>
        )}

        {!loading && !error && sortedGroups.length === 0 && (
          <div className={`rounded-2xl border p-6 text-center text-sm ${cardBg} ${textSub}`}>
            Nenhum Grupo Familiar disponível no momento.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {sortedGroups.map((gf) => {
            const address = formatAddress(gf);
            const color = gf.color || '#22c55e';
            return (
              <div key={gf.id} className={`rounded-2xl border overflow-hidden ${cardBg}`}>
                {/* Foto de capa */}
                <div className="h-32 w-full relative" style={{ background: gf.photo ? undefined : `linear-gradient(135deg, ${color}33, ${color}11)` }}>
                  {gf.photo ? (
                    <img src={gf.photo} alt={gf.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="w-10 h-10" style={{ color }} />
                    </div>
                  )}
                  {gf.distanceKm !== undefined && gf.distanceKm !== null && (
                    <span className="absolute top-2 right-2 px-2 py-1 rounded-full text-[11px] font-semibold bg-black/60 text-white backdrop-blur-sm">
                      {gf.distanceKm.toFixed(1).replace('.', ',')} km
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-bold text-base ${textPrimary}`}>{gf.name}</h3>
                  </div>
                  {gf.cellType && (
                    <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full mb-2 ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                      {gf.cellType}
                    </span>
                  )}

                  {gf.leaderName && (
                    <p className={`text-xs mb-1.5 flex items-center gap-1.5 ${textSub}`}>
                      <Users size={13} className="shrink-0" />
                      Líder: <span className={textPrimary}>{gf.leaderName}</span>
                    </p>
                  )}

                  {gf.leaderPhone && (
                    <a
                      href={`https://wa.me/55${gf.leaderPhone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs mb-1.5 flex items-center gap-1.5 text-emerald-500 hover:text-emerald-400 w-fit"
                    >
                      <Phone size={13} className="shrink-0" /> {gf.leaderPhone}
                    </a>
                  )}

                  {(gf.meetingDay || gf.meetingTime) && (
                    <p className={`text-xs mb-1.5 flex items-center gap-1.5 ${textSub}`}>
                      <Clock size={13} className="shrink-0" />
                      {[gf.meetingDay, gf.meetingTime].filter(Boolean).join(' às ')}
                    </p>
                  )}

                  {address && (
                    <button
                      onClick={() => setMapGroup(gf)}
                      className="text-xs mt-1 flex items-start gap-1.5 text-left hover:underline"
                      style={{ color }}
                    >
                      <MapPin size={13} className="shrink-0 mt-0.5" />
                      {address}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Modal do mapa */}
      {mapGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMapGroup(null)} />
          <div className={`relative w-full max-w-lg rounded-2xl border overflow-hidden shadow-2xl z-10 ${cardBg}`}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: isDark ? '#1e293b' : '#e2e8f0' }}>
              <h3 className={`font-bold text-sm ${textPrimary}`}>{mapGroup.name}</h3>
              <button onClick={() => setMapGroup(null)} className={`p-1 rounded-lg hover:bg-slate-500/10 ${textSub}`}>
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
              <p className={`text-xs ${textSub}`}>{formatAddress(mapGroup)}</p>
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
    </div>
  );
}
