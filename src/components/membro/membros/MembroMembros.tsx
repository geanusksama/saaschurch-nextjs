"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Search, X, Church, Star, Heart, Users } from 'lucide-react';
import { useMembroSession } from '../MembroProvider';
import { MEMBRO } from '../theme';

/**
 * TEMA CLARO FIXO, igual ao perfil. Esta tela nasceu escura (fundo preto,
 * texto branco) e destoava do resto do portal depois da migracao; aqui a foto
 * continua sendo a estrela, mas sobre fundo claro.
 */
const { ACCENT, BG, CARD, BORDER, TEXT1, TEXT2 } = MEMBRO;

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

/** Quantos membros cada lote traz. */
const PAGINA = 10;

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

/**
 * Um membro por tela, no MESMO desenho do perfil: a foto ocupa a metade de
 * cima com a base curva, e os dados vêm logo abaixo, sobre a folha clara.
 */
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
      className="relative flex-shrink-0 w-full flex flex-col"
      style={{ height: h, scrollSnapAlign: 'start', scrollSnapStop: 'always', background: BG }}
    >
      {/* ── foto: metade de cima, base curva ── */}
      <div
        className="relative flex-shrink-0 overflow-hidden"
        style={{ height: '54%', background: '#0f172a', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }}
      >
        {m.photoUrl ? (
          <img
            src={m.photoUrl} alt={name}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover', objectPosition: 'center top' }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: MEMBRO.ACCENT_SOFT }}>
            <span style={{ fontSize: 110, fontWeight: 900, color: `${ACCENT}25` }}>{first.charAt(0)}</span>
          </div>
        )}

        {/* curtir — sobre a foto, como no perfil */}
        <button
          onClick={handleLike}
          className="absolute active:scale-90 transition-transform flex items-center gap-1.5"
          style={{
            top: 14, right: 14, height: 40, paddingInline: 12, borderRadius: 999,
            background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.25)',
          }}
        >
          <Heart size={16} fill={liked ? '#f43f5e' : 'none'} color={liked ? '#f43f5e' : '#fff'} />
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{likeCount}</span>
        </button>
      </div>

      {/* ── dados embaixo ── */}
      <div className="flex-1 px-5 pt-5 text-center">
        {m.ecclesiasticalTitle && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 12px', borderRadius: 999, marginBottom: 10,
            background: MEMBRO.ACCENT_SOFT, border: `1px solid ${ACCENT}33`,
          }}>
            <Star size={8} fill={ACCENT} color={ACCENT} />
            <span style={{ fontSize: 10, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {m.ecclesiasticalTitle}
            </span>
          </div>
        )}
        <h2 style={{ color: TEXT1, fontSize: 28, fontWeight: 700, lineHeight: 1.15, margin: 0 }}>{first}</h2>
        {rest && <p style={{ color: TEXT2, fontSize: 17, fontWeight: 500, margin: '4px 0 0' }}>{rest}</p>}
        {m.church?.name && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 }}>
            <Church size={11} color={TEXT2} />
            <span style={{ fontSize: 12, color: TEXT2 }}>{m.church.name}</span>
          </div>
        )}
      </div>

      {/* dica de rolagem */}
      <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, opacity: 0.35 }}>
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: TEXT2 }} />
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: TEXT2 }} />
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: TEXT2 }} />
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
        // 10 por vez: a pessoa ve um membro por tela, entao lotes grandes so pesam
        body: JSON.stringify({ token: session.member_token, cursor: cursorRef.current, limit: PAGINA }),
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
        body: JSON.stringify({ token: memberToken, search: q, limit: PAGINA }),
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
    <div className="fixed inset-0 flex flex-col" style={{ maxWidth: 430, margin: '0 auto', background: BG, colorScheme: 'light' }}>

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-3 px-5 pt-12 pb-3"
        style={{ background: 'linear-gradient(to bottom, rgba(241,245,249,0.98) 55%, rgba(241,245,249,0))' }}>
        <button onClick={() => navigate('/membro/perfil')}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <ArrowLeft size={16} color={TEXT2} />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-[15px]" style={{ color: TEXT1 }}>Membros do Campo</h1>
          {allItems.length > 0 && <p className="text-[10px]" style={{ color: TEXT2 }}>{allItems.length}{hasMore ? '+' : ''} membros</p>}
        </div>
        {/* Simple search icon — opens modal */}
        <button onClick={() => { setShowSearch(true); setSearchResults([]); setSearchText(''); }}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <Search size={15} color={TEXT2} />
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
            style={{ height: containerH, scrollSnapAlign: 'start', background: BG }}>
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: `${ACCENT}30`, borderTopColor: ACCENT }} />
          </div>
        )}

        {!hasMore && !loading && allItems.length > 0 && containerH > 0 && (
          <div className="flex-shrink-0 flex flex-col items-center justify-center gap-4"
            style={{ height: containerH, scrollSnapAlign: 'start', background: BG }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: MEMBRO.ACCENT_SOFT }}>
              <Users size={26} color={ACCENT} />
            </div>
            <p className="font-semibold text-sm" style={{ color: TEXT2 }}>{allItems.length} membros</p>
            <button onClick={() => navigate('/membro/perfil')} className="mt-2 px-6 py-2.5 rounded-full font-bold text-sm text-white"
              style={{ background: ACCENT }}>Voltar ao perfil</button>
          </div>
        )}
      </div>

      {/* ── Search modal (bottom sheet) ── */}
      <AnimatePresence>
        {showSearch && (
          <div className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: 'rgba(2,6,23,0.55)', backdropFilter: 'blur(8px)', colorScheme: 'light' }}
            onClick={() => setShowSearch(false)}>
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full max-w-sm px-5 pt-4 pb-8 rounded-t-3xl"
              style={{ background: CARD, maxWidth: 430 }}
              onClick={e => e.stopPropagation()}>

              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full" style={{ background: '#cbd5e1' }} />
              </div>

              <p className="font-bold text-[15px] mb-4" style={{ color: TEXT1 }}>Buscar membro</p>

              {/* Input + button */}
              <div className="flex gap-2 mb-5">
                <div className="flex-1 flex items-center gap-2 rounded-2xl px-4 h-11"
                  style={{ background: BG, border: `1px solid ${BORDER}` }}>
                  <Search size={14} color={TEXT2} />
                  <input
                    ref={searchInputRef}
                    autoFocus
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Digite o nome…"
                    className="flex-1 bg-transparent outline-none text-[13px] placeholder-slate-400"
                    style={{ color: TEXT1, caretColor: ACCENT }}
                  />
                  {searchText && (
                    <button onClick={() => { setSearchText(''); setSearchResults([]); }}>
                      <X size={13} color={TEXT2} />
                    </button>
                  )}
                </div>
                <button onClick={handleSearch}
                  className="h-11 px-4 rounded-2xl font-bold text-[13px] flex-shrink-0 text-white"
                  style={{ background: ACCENT }}>
                  Buscar
                </button>
              </div>

              {/* Results */}
              {searching && (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 rounded-full border-2 animate-spin"
                    style={{ borderColor: `${ACCENT}30`, borderTopColor: ACCENT }} />
                </div>
              )}
              {!searching && searchResults.length === 0 && searchText.length >= 2 && (
                <p className="text-center text-[12px] py-4" style={{ color: TEXT2 }}>
                  Nenhum resultado para &quot;{searchText}&quot;
                </p>
              )}

              <div className="space-y-2 max-h-60 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                {searchResults.map(m => {
                  const name = toProper(m.preferredName || m.fullName);
                  return (
                    <div key={m.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer active:opacity-70"
                      style={{ background: BG, border: `1px solid ${BORDER}` }}
                      onClick={() => { setShowSearch(false); setViewMember(m); }}>
                      {m.photoUrl ? (
                        <img src={m.photoUrl} alt={name} className="rounded-xl object-cover object-top flex-shrink-0"
                          style={{ width: 44, height: 52 }} />
                      ) : (
                        <div className="rounded-xl flex items-center justify-center font-bold flex-shrink-0"
                          style={{ width: 44, height: 52, background: MEMBRO.ACCENT_SOFT, color: ACCENT, fontSize: 18 }}>
                          {name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[12px] truncate" style={{ color: TEXT1 }}>{name}</p>
                        {m.ecclesiasticalTitle && <p className="text-[10px] font-semibold" style={{ color: ACCENT }}>{m.ecclesiasticalTitle}</p>}
                        {m.church?.name && <p className="text-[10px] truncate" style={{ color: TEXT2 }}>{m.church.name}</p>}
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
              style={{ background: 'rgba(2,6,23,0.6)', backdropFilter: 'blur(10px)', colorScheme: 'light' }}
              onClick={() => setViewMember(null)}>
              <motion.div
                initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="w-full rounded-t-3xl overflow-hidden"
                style={{ maxWidth: 430, background: CARD }}
                onClick={e => e.stopPropagation()}>

                {/* Photo hero */}
                <div className="relative w-full" style={{ height: 260 }}>
                  {m.photoUrl ? (
                    <img src={m.photoUrl} alt={name} className="w-full h-full object-cover object-top" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"
                      style={{ background: MEMBRO.ACCENT_SOFT }}>
                      <span className="font-black" style={{ fontSize: 120, color: `${ACCENT}25` }}>{name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0"
                    style={{ height: '60%', background: `linear-gradient(to top, ${CARD} 0%, transparent 100%)` }} />
                  {/* Close */}
                  <button onClick={() => setViewMember(null)}
                    className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                    <X size={15} color={TEXT2} />
                  </button>
                </div>

                {/* Info */}
                <div className="px-5 pb-8 -mt-6 relative">
                  {m.ecclesiasticalTitle && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-2"
                      style={{ background: MEMBRO.ACCENT_SOFT, border: `1px solid ${ACCENT}33` }}>
                      <Star size={8} fill={ACCENT} color={ACCENT} />
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>{m.ecclesiasticalTitle}</span>
                    </div>
                  )}
                  <h2 className="font-bold text-xl leading-tight" style={{ color: TEXT1 }}>{name}</h2>
                  {m.church?.name && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Church size={12} color={TEXT2} />
                      <span className="text-[12px]" style={{ color: TEXT2 }}>{m.church.name}</span>
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
