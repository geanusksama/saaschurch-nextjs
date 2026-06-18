"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Search, X, Church, Star, Heart, Users } from 'lucide-react';
import { useMembroSession } from '../MembroProvider';

const TEAL = '#2dd4bf';

function toProper(s: string): string {
  const minor = ['da','de','do','das','dos','e','a','o'];
  return s.toLowerCase().replace(/\b\w+/g, (w, i) =>
    i === 0 || !minor.includes(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w
  );
}
const BUSINESS_WORDS = [
  'LTDA','EIRELI','S.A.','S/A',' ME',' EPP','SERVICOS','SERVICO',
  'COMERCIO','INDUSTRIA','EMPRESA','LAVAGEM','LAVANDERIA','LOCACAO',
  'TRANSPORTE','CONSTRUTORA','CONSTRUCAO','IMOBILIARIA','SEGUROS',
  'FARMACIA','CLINICA','HOSPITAL','LABORATORIO','ASSESSORIA',
  'CONTABILIDADE','ADVOCACIA','ENGENHARIA','INFORMATICA','TECNOLOGIA',
  'SUPERMERCADO','MERCADO','PADARIA','RESTAURANTE','LANCHONETE',
  'POSTO','BORRACHARIA','OFICINA','MECANICA','TABELIAO','TABELIONATO',
  'CARTORIO','BANCO','FINANCEIRA','COOPERATIVA','SINDICATO','ASSOCIACAO',
  'FUNDACAO','INSTITUTO','COLEGIO','ESCOLA','ACADEMIA','ESPORTE',
];

function isRealPerson(name: string): boolean {
  if (!name) return false;
  if (/^\d/.test(name)) return false;
  if (name.includes('/')) return false;
  if (name.startsWith('(')) return false;
  if (name.startsWith('.')) return false;
  if (/\d{2}\.\d{3}/.test(name)) return false;
  const upper = name.toUpperCase();
  if (BUSINESS_WORDS.some(w => upper.includes(w))) return false;
  return true;
}

interface MemberCard {
  id: string;
  fullName: string;
  preferredName?: string | null;
  photoUrl?: string | null;
  ecclesiasticalTitle?: string | null;
  membershipStatus?: string | null;
  membershipDate?: string | null;
  church?: { id: string; name: string } | null;
}

// ── Single full-screen snap card ─────────────────────────────────
function SnapCard({ m, h, token }: { m: MemberCard; h: number; token: string }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const name  = toProper(m.preferredName || m.fullName);
  const first = name.split(' ')[0];
  const rest  = name.split(' ').slice(1).join(' ');

  const handleLike = async () => {
    try {
      const res = await fetch('/api/membro/curtir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, liked_id: m.id }),
      });
      const data = await res.json();
      if (!data.error) { setLiked(data.liked); setLikeCount(data.total ?? 0); }
    } catch {}
  };

  return (
    <div
      className="relative flex-shrink-0 w-full overflow-hidden"
      style={{ height: h, scrollSnapAlign: 'start', scrollSnapStop: 'always', background: '#0d1f2d' }}
    >
      {m.photoUrl ? (
        <img src={m.photoUrl} alt={name} className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'cover', objectPosition: 'center top' }} />
      ) : (
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #1a3a4c, #0d2a38)' }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-black text-white/10" style={{ fontSize: 160 }}>{first.charAt(0)}</span>
          </div>
        </div>
      )}

      {/* Bottom gradient */}
      <div className="absolute inset-x-0 bottom-0"
        style={{ height: '52%', background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }} />

      {/* Heart button */}
      <div className="absolute right-5 flex flex-col items-center gap-1" style={{ top: '30%' }}>
        <button onClick={handleLike}
          className="w-11 h-11 rounded-full flex items-center justify-center active:scale-90"
          style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(8px)' }}>
          <Heart size={18} fill={liked ? '#ec4899' : 'none'} color={liked ? '#ec4899' : '#fff'} />
        </button>
        {likeCount > 0 && <span className="text-white/60 text-[10px] font-semibold">{likeCount}</span>}
      </div>

      {/* Bottom content */}
      <div className="absolute inset-x-0 bottom-0 px-5 pb-8">
        {m.ecclesiasticalTitle && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-3"
            style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)' }}>
            <Star size={9} fill="#fff" color="#fff" />
            <span className="text-[10px] font-semibold text-white uppercase tracking-wider">{m.ecclesiasticalTitle}</span>
          </div>
        )}
        <h2 className="text-white font-semibold leading-tight" style={{ fontSize: 28 }}>{first}</h2>
        {rest && <p className="text-white/80 font-medium leading-tight mt-0.5" style={{ fontSize: 18 }}>{rest}</p>}
        {m.church?.name && (
          <div className="flex items-center gap-1.5 mt-3">
            <Church size={12} color="rgba(255,255,255,0.5)" />
            <span className="text-[12px] text-white/50">{m.church.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
export default function MembroMembros() {
  const { session, isLoading } = useMembroSession();
  const navigate = useNavigate();

  const [allItems, setAllItems] = useState<MemberCard[]>([]);
  const [hasMore, setHasMore]   = useState(true);
  const [loading, setLoading]   = useState(false);
  const [containerH, setContainerH] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 700
  );

  // Search modal
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<MemberCard[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Member profile sheet
  const [viewMember, setViewMember] = useState<MemberCard | null>(null);

  const fetchingRef = useRef(false);
  const cursorRef   = useRef<string | null>(null);
  const hasMoreRef  = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && !session) navigate('/', { replace: true });
  }, [session, isLoading, navigate]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerH(el.clientHeight));
    ro.observe(el);
    setContainerH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const loadMore = useCallback(async () => {
    if (fetchingRef.current || !hasMoreRef.current || !session?.member_token) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch('/api/membro/membros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session.member_token, cursor: cursorRef.current, limit: 10 }),
      });
      const data = await res.json();
      const newItems = (data.items || []).filter((m: MemberCard) => isRealPerson(m.fullName));
      setAllItems(prev => {
        const seen = new Set(prev.map(x => x.id));
        return [...prev, ...newItems.filter((m: MemberCard) => !seen.has(m.id))];
      });
      cursorRef.current = data.nextCursor ?? null;
      hasMoreRef.current = !!data.hasMore;
      setHasMore(!!data.hasMore);
    } catch {}
    finally { setLoading(false); fetchingRef.current = false; }
  }, [session]);

  useEffect(() => {
    if (session?.member_token) loadMore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.member_token]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      e => { if (e[0].isIntersecting) loadMore(); },
      { root: containerRef.current, rootMargin: '500px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const [searching, setSearching] = useState(false);
  const memberToken = session?.member_token ?? '';

  const handleSearch = async () => {
    const q = searchText.trim();
    if (q.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch('/api/membro/membros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: memberToken, search: q, limit: 30 }),
      });
      const data = await res.json();
      setSearchResults((data.items || []).filter((m: MemberCard) => isRealPerson(m.fullName)));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  if (isLoading || !session?.member) return null;

  return (
    <div className="fixed inset-0 flex flex-col" style={{ maxWidth: 430, margin: '0 auto', background: '#000' }}>

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-3 px-5 pt-12 pb-3"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)' }}>
        <button onClick={() => navigate('/membro/perfil')}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)' }}>
          <ArrowLeft size={16} color="#fff" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-[15px] text-white">Membros do Campo</h1>
          {allItems.length > 0 && <p className="text-[10px] text-white/40">{allItems.length}{hasMore ? '+' : ''} membros</p>}
        </div>
        {/* Simple search icon — opens modal */}
        <button onClick={() => { setShowSearch(true); setSearchResults([]); setSearchText(''); }}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)' }}>
          <Search size={15} color="#fff" />
        </button>
      </div>

      {/* Snap scroll feed */}
      <div ref={containerRef} className="flex-1 overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>

        {containerH > 0 && allItems.map(m => (
          <SnapCard key={m.id} m={m} h={containerH} token={memberToken} />
        ))}

        <div ref={sentinelRef} style={{ height: 1 }} />

        {loading && containerH > 0 && (
          <div className="flex-shrink-0 flex items-center justify-center"
            style={{ height: containerH, scrollSnapAlign: 'start', background: '#0a1a24' }}>
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: `${TEAL}30`, borderTopColor: TEAL }} />
          </div>
        )}

        {!hasMore && !loading && allItems.length > 0 && containerH > 0 && (
          <div className="flex-shrink-0 flex flex-col items-center justify-center gap-4"
            style={{ height: containerH, scrollSnapAlign: 'start', background: '#0a1a24' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: `${TEAL}22` }}>
              <Users size={26} color={TEAL} />
            </div>
            <p className="text-white/60 font-semibold text-sm">{allItems.length} membros</p>
            <button onClick={() => navigate('/membro/perfil')} className="mt-2 px-6 py-2.5 rounded-full font-semibold text-sm"
              style={{ background: TEAL, color: '#0d0f17' }}>Voltar ao perfil</button>
          </div>
        )}
      </div>

      {/* ── Search modal (bottom sheet) ── */}
      <AnimatePresence>
        {showSearch && (
          <div className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowSearch(false)}>
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full max-w-sm px-5 pt-4 pb-8 rounded-t-3xl"
              style={{ background: '#1a1d2a', maxWidth: 430 }}
              onClick={e => e.stopPropagation()}>

              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
              </div>

              <p className="text-white font-semibold text-[15px] mb-4">Buscar membro</p>

              {/* Input + button */}
              <div className="flex gap-2 mb-5">
                <div className="flex-1 flex items-center gap-2 rounded-2xl px-4 h-11"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
                  <Search size={14} color="rgba(255,255,255,0.35)" />
                  <input
                    ref={searchInputRef}
                    autoFocus
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Digite o nome…"
                    className="flex-1 bg-transparent outline-none text-[13px] placeholder-white/30"
                    style={{ color: '#fff', caretColor: TEAL }}
                  />
                  {searchText && (
                    <button onClick={() => { setSearchText(''); setSearchResults([]); }}>
                      <X size={13} color="rgba(255,255,255,0.35)" />
                    </button>
                  )}
                </div>
                <button onClick={handleSearch}
                  className="h-11 px-4 rounded-2xl font-semibold text-[13px] flex-shrink-0"
                  style={{ background: TEAL, color: '#0d0f17' }}>
                  Buscar
                </button>
              </div>

              {/* Results */}
              {searching && (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 rounded-full border-2 animate-spin"
                    style={{ borderColor: `${TEAL}30`, borderTopColor: TEAL }} />
                </div>
              )}
              {!searching && searchResults.length === 0 && searchText.length >= 2 && (
                <p className="text-center text-[12px] py-4" style={{ color: 'rgba(255,255,255,0.30)' }}>
                  Nenhum resultado para "{searchText}"
                </p>
              )}

              <div className="space-y-2 max-h-60 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                {searchResults.map(m => {
                  const name = toProper(m.preferredName || m.fullName);
                  return (
                    <div key={m.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer active:opacity-70"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                      onClick={() => { setShowSearch(false); setViewMember(m); }}>
                      {m.photoUrl ? (
                        <img src={m.photoUrl} alt={name} className="rounded-xl object-cover object-top flex-shrink-0"
                          style={{ width: 44, height: 52 }} />
                      ) : (
                        <div className="rounded-xl flex items-center justify-center font-bold flex-shrink-0"
                          style={{ width: 44, height: 52, background: `${TEAL}18`, color: TEAL, fontSize: 18 }}>
                          {name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[12px] truncate text-white/85">{name}</p>
                        {m.ecclesiasticalTitle && <p className="text-[10px] font-medium" style={{ color: TEAL }}>{m.ecclesiasticalTitle}</p>}
                        {m.church?.name && <p className="text-[10px] text-white/35 truncate">{m.church.name}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Member profile sheet ── */}
      <AnimatePresence>
        {viewMember && (() => {
          const m = viewMember;
          const name = toProper(m.preferredName || m.fullName);
          return (
            <div className="fixed inset-0 z-50 flex items-end justify-center"
              style={{ background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(12px)' }}
              onClick={() => setViewMember(null)}>
              <motion.div
                initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="w-full rounded-t-3xl overflow-hidden"
                style={{ maxWidth: 430, background: '#0d1f2d' }}
                onClick={e => e.stopPropagation()}>

                {/* Photo hero */}
                <div className="relative w-full" style={{ height: 260 }}>
                  {m.photoUrl ? (
                    <img src={m.photoUrl} alt={name} className="w-full h-full object-cover object-top" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"
                      style={{ background: 'linear-gradient(160deg,#1a3a4c,#0d2a38)' }}>
                      <span className="font-black text-white/10" style={{ fontSize: 120 }}>{name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0"
                    style={{ height: '60%', background: 'linear-gradient(to top, #0d1f2d 0%, transparent 100%)' }} />
                  {/* Close */}
                  <button onClick={() => setViewMember(null)}
                    className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}>
                    <X size={15} color="#fff" />
                  </button>
                </div>

                {/* Info */}
                <div className="px-5 pb-8 -mt-6 relative">
                  {m.ecclesiasticalTitle && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-2"
                      style={{ background: `${TEAL}22`, border: `1px solid ${TEAL}44` }}>
                      <Star size={8} fill={TEAL} color={TEAL} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: TEAL }}>{m.ecclesiasticalTitle}</span>
                    </div>
                  )}
                  <h2 className="text-white font-bold text-xl leading-tight">{name}</h2>
                  {m.church?.name && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Church size={12} color="rgba(255,255,255,0.40)" />
                      <span className="text-[12px] text-white/40">{m.church.name}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
