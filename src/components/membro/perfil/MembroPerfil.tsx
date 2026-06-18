"use client";

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Heart, Phone, Video, MessageCircle, Info, Users, Calendar, MapPin, Church, Star, X, Sun, Moon } from 'lucide-react';
import { useMembroSession } from '../MembroProvider';
import { useMembroTheme } from '../MembroShell';

const TEAL = '#2dd4bf';

function useThemeTokens(isDark: boolean) {
  return {
    BG:       isDark ? '#0d0f17'                  : '#f0f4f8',
    MODAL_BG: isDark ? '#1a1d2a'                  : '#ffffff',
    SURFACE:  isDark ? 'rgba(255,255,255,0.05)'   : 'rgba(255,255,255,0.90)',
    BORDER:   isDark ? 'rgba(255,255,255,0.08)'   : 'rgba(0,0,0,0.08)',
    TEXT1:    isDark ? '#f1f5f9'                  : '#0f172a',
    TEXT2:    isDark ? 'rgba(255,255,255,0.40)'   : 'rgba(0,0,0,0.45)',
    CARD_SH:  isDark ? '0 4px 20px rgba(0,0,0,0.35)' : '0 4px 16px rgba(0,0,0,0.07)',
  };
}

// ── Helpers ────────────────────────────────────────────────────────
function safeDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(String(iso).includes('T') ? iso : iso + 'T12:00:00');
  return isNaN(d.getTime()) ? null : d;
}
function formatDate(iso?: string | null) {
  const d = safeDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function memberYears(date?: string | null) {
  const d = safeDate(date);
  if (!d) return '—';
  const y = Math.floor((Date.now() - d.getTime()) / (365.25 * 86400000));
  return y < 1 ? '< 1 ano' : `${y} ${y === 1 ? 'ano' : 'anos'}`;
}
function toProper(s: string): string {
  const minor = ['da','de','do','das','dos','e','a','o'];
  return s.toLowerCase().replace(/\b\w+/g, (w, i) =>
    i === 0 || !minor.includes(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w
  );
}
function statusColor(s?: string | null) {
  const v = (s || '').toLowerCase();
  if (v.includes('ativo') || v.includes('ativa')) return '#22c55e';
  if (v.includes('inativo')) return '#ef4444';
  return '#f59e0b';
}

// ── SVG Stats Icons ───────────────────────────────────────────────
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const PeopleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

// ═══════════════════════════════════════════════════════════════════
export default function MembroPerfil() {
  const { session, isLoading, logout } = useMembroSession();
  const { isDark, toggle: toggleTheme } = useMembroTheme();
  const { BG, MODAL_BG, SURFACE, BORDER, TEXT1, TEXT2, CARD_SH } = useThemeTokens(isDark);
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) navigate('/', { replace: true });
  }, [session, isLoading, navigate]);

  // Ensure table exists + load like count for own profile
  useEffect(() => {
    if (!session?.member_token || !session?.member?.id) return;
    // One-time table setup (idempotent)
    fetch('/api/membro/setup-likes').catch(() => {});
    // Load how many people liked this member
    fetch(`/api/membro/curtir?token=${encodeURIComponent(session.member_token)}&liked_id=${session.member.id}`)
      .then(r => r.json()).then(d => { setLikeCount(d.total ?? 0); }).catch(() => {});
  }, [session?.member?.id, session?.member_token]);

  if (isLoading || !session?.member) return null;

  const { member } = session;
  const displayName = toProper(member.preferredName || member.fullName);
  const firstName   = displayName.split(' ')[0];
  const restName    = displayName.split(' ').slice(1).join(' ');
  const churchName  = member.church?.name || '—';
  const campoName   = member.church?.regional?.campo?.name || '—';
  const scolor      = statusColor(member.membershipStatus);

  const stats = [
    { Icon: ClockIcon,  value: memberYears(member.membershipDate), label: 'Experiência' },
    { Icon: PeopleIcon, value: member.rol ? `#${member.rol}` : '—', label: 'ROL' },
    { Icon: StarIcon,   value: likeCount > 0 ? `${likeCount}` : '0', label: 'Curtidas' },
  ];

  const infoRows = [
    { Icon: Church,   label: 'Igreja',        value: churchName },
    { Icon: MapPin,   label: 'Campo',          value: campoName },
    member.membershipDate ? { Icon: Calendar, label: 'Membro desde', value: formatDate(member.membershipDate) } : null,
    member.baptismDate    ? { Icon: Calendar, label: 'Batismo',      value: formatDate(member.baptismDate)    } : null,
  ].filter(Boolean) as { Icon: React.ElementType; label: string; value: string }[];

  return (
    <>
      <div
        className="fixed inset-0 flex flex-col"
        style={{ maxWidth: 430, margin: '0 auto', background: BG, overflow: 'hidden' }}
      >

        {/* ══════════════════════════════════════════
            BLOCK 1 — HERO (foto preenche o fundo)
        ══════════════════════════════════════════ */}
        <div className="relative flex-shrink-0" style={{ height: '46%' }}>

          {/* Dark background base */}
          <div className="absolute inset-0" style={{ background: BG }} />

          {/* Member photo — fills entire hero area, no gradients */}
          {member.photoUrl && (
            <img
              src={member.photoUrl}
              alt={displayName}
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: 'cover', objectPosition: 'center top' }}
            />
          )}

          {/* Floating buttons — top corners */}
          <div className="absolute inset-x-0 top-0 flex justify-between px-5 pt-12">
            <button
              onClick={() => navigate('/')}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90"
              style={{ background: 'rgba(0,0,0,0.30)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.20)' }}
            >
              <ArrowLeft size={16} color="#fff" />
            </button>
            <div className="flex items-center gap-2">
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90"
                style={{ background: 'rgba(0,0,0,0.30)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.20)' }}
                title={isDark ? 'Tema claro' : 'Tema escuro'}
              >
                {isDark
                  ? <Sun size={15} color="#fbbf24" />
                  : <Moon size={15} color="#fff" />
                }
              </button>
              {/* Heart */}
              <button
                onClick={() => setLiked(l => !l)}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90"
                style={{ background: 'rgba(0,0,0,0.30)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.20)' }}
              >
                <Heart size={15} fill={liked ? '#ec4899' : 'none'} color={liked ? '#ec4899' : '#fff'} />
              </button>
            </div>
          </div>

          {/* Text — bottom-left, with dark translucent pill behind it */}
          <div className="absolute left-4 bottom-4" style={{ maxWidth: '60%' }}>
            <div
              className="inline-flex flex-col gap-1 px-4 py-3 rounded-2xl"
              style={{
                background: 'rgba(0,0,0,0.45)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              {/* Title badge */}
              {member.ecclesiasticalTitle && (
                <div className="flex items-center gap-1 mb-0.5">
                  <Star size={9} fill="#fff" color="#fff" />
                  <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wider">{member.ecclesiasticalTitle}</span>
                </div>
              )}

              <h1 className="text-white leading-tight font-semibold" style={{ fontSize: 20 }}>
                {firstName}
              </h1>
              {restName && (
                <h2 className="text-white/85 leading-tight font-medium" style={{ fontSize: 14 }}>
                  {restName}
                </h2>
              )}
              <p className="text-white/55 text-[11px]">{churchName}</p>

              {member.membershipStatus && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: scolor }} />
                  <span className="text-[10px] font-medium" style={{ color: scolor }}>{member.membershipStatus}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            DARK CARD — scrollable bottom section
        ══════════════════════════════════════════ */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            background: BG,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            scrollbarWidth: 'none',
            marginTop: -16,
          }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: BORDER }} />
          </div>

          <div className="px-5 pb-10 space-y-3 mt-1">

            {/* BLOCK 2 — Quick actions */}
            <div className="flex items-center gap-2.5 py-1">
              <button
                onClick={() => setShowDetails(true)}
                className="flex-1 flex items-center justify-center gap-2 font-semibold rounded-full h-12 transition-all active:scale-95"
                style={{ background: TEAL, color: '#0d0f17', fontSize: 14, boxShadow: `0 6px 20px ${TEAL}40` }}
              >
                <Info size={15} />
                Detalhes
              </button>
              {[Phone, Video, MessageCircle].map((Icon, i) => (
                <button
                  key={i}
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
                  style={{ background: SURFACE, boxShadow: CARD_SH, border: `1px solid ${BORDER}` }}
                >
                  <Icon size={17} color={TEXT2} />
                </button>
              ))}
            </div>

            {/* BLOCK 3 — Stats */}
            <div
              className="rounded-3xl overflow-hidden"
              style={{ background: SURFACE, boxShadow: CARD_SH, border: `1px solid ${BORDER}` }}
            >
              <div className="flex">
                {stats.map((s, i) => (
                  <div
                    key={s.label}
                    className="flex-1 flex flex-col items-center py-3.5 gap-1"
                    style={{ borderLeft: i > 0 ? `1px solid ${BORDER}` : undefined }}
                  >
                    <span style={{ color: TEAL }}><s.Icon /></span>
                    <p className="font-bold text-sm" style={{ color: TEXT1 }}>{s.value}</p>
                    <p className="text-[10px]" style={{ color: TEXT2 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* BLOCK 4 — Info rows */}
            <div
              className="rounded-3xl overflow-hidden"
              style={{ background: SURFACE, boxShadow: CARD_SH, border: `1px solid ${BORDER}` }}
            >
              {infoRows.map((row, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-5 py-3.5"
                  style={{ borderBottom: i < infoRows.length - 1 ? `1px solid ${BORDER}` : undefined }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${TEAL}18` }}
                  >
                    <row.Icon size={14} color={TEAL} />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: TEXT2 }}>{row.label}</p>
                    <p className="text-[13px] font-semibold" style={{ color: TEXT1 }}>{row.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* BLOCK 5 — CTA */}
            <button
              onClick={() => navigate('/membro/membros')}
              className="w-full flex items-center justify-center gap-2 font-semibold transition-all active:scale-[0.98]"
              style={{ height: 56, background: TEAL, color: '#0d0f17', borderRadius: 28, fontSize: 15, boxShadow: `0 8px 24px ${TEAL}40` }}
            >
              <Users size={16} />
              Ver Membros do Campo
            </button>

            {/* Logout */}
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="w-full text-xs text-center py-1 transition-opacity hover:opacity-60"
              style={{ color: TEXT2 }}
            >
              Sair da conta
            </button>
          </div>
        </div>
      </div>

      {/* ── Details bottom sheet ── */}
      <AnimatePresence>
        {showDetails && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(12px)' }}
            onClick={() => setShowDetails(false)}
          >
            <motion.div
              initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 48, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full max-w-sm px-6 pt-4 pb-10"
              style={{ background: MODAL_BG, borderRadius: '28px 28px 0 0', maxHeight: '80vh', overflowY: 'auto', scrollbarWidth: 'none' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full" style={{ background: BORDER }} />
              </div>
              <div className="flex items-center justify-between mb-5">
                <p className="font-semibold" style={{ fontSize: 17, color: TEXT1 }}>Dados do Membro</p>
                <button
                  onClick={() => setShowDetails(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
                >
                  <X size={13} color={TEXT2} />
                </button>
              </div>
              <div className="space-y-3">
                {([
                  ['ROL', member.rol ? String(member.rol) : '—'],
                  ['Nome completo', toProper(member.fullName)],
                  ['Nome preferido', member.preferredName ? toProper(member.preferredName) : '—'],
                  ['Título eclesiástico', member.ecclesiasticalTitle || '—'],
                  ['Status', member.membershipStatus || '—'],
                  ['Gênero', member.gender || '—'],
                  ['Estado civil', (member as any).maritalStatus || '—'],
                  ['Nacionalidade', (member as any).nationality || '—'],
                  ['Nascimento', formatDate(member.birthDate)],
                  ['Nome do pai', (member as any).fatherName ? toProper((member as any).fatherName) : '—'],
                  ['Nome da mãe', (member as any).motherName ? toProper((member as any).motherName) : '—'],
                  ['Cônjuge', (member as any).spouseName ? toProper((member as any).spouseName) : '—'],
                  ['Email', member.email || '—'],
                  ['Celular', member.mobile || member.phone || '—'],
                  ['Igreja', churchName],
                  ['Campo', campoName],
                  ['Membro desde', formatDate(member.membershipDate)],
                  ['Data de batismo', formatDate(member.baptismDate)],
                ] as [string, string][]).map(([lbl, val]) => (
                  <div key={lbl} className="flex justify-between gap-4 pb-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <span className="text-[11px] font-medium" style={{ color: TEXT2 }}>{lbl}</span>
                    <span className="text-[12px] font-semibold text-right" style={{ color: TEXT1 }}>{val}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
