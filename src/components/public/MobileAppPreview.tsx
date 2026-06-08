/**
 * MobileAppPreview — Shared phone shell that replicates the novoChurch Flutter app.
 * Used on the public homepage AND inside the MRM system header.
 */
import { useState, useEffect } from 'react';
import { X, Wifi, Battery, Signal, Sun, Moon, LogIn } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// ── Brand colors from novoChurch Flutter app ──────────────────────────────────
const NAVY_LIGHT  = '#1A1D3D'; // primary (light mode icon bg)
const TEAL_DARK   = '#4DD9C0'; // primary (dark mode accent)
const BG_LIGHT    = '#F0F3FB'; // app background light
const BG_DARK     = '#10131F'; // app background dark
const SURF_LIGHT  = '#FFFFFF';
const SURF_DARK   = '#1B1F31';

// ── Icons matching novoChurch menu tiles (lucide-react equivalents) ───────────
// We import inline SVGs to match Flutter Material icons more closely
function IcoBookOpen()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>; }
function IcoChurch()      { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]"><path d="M18 22H6a2 2 0 0 1-2-2v-8l8-6 8 6v8a2 2 0 0 1-2 2z"/><path d="M12 2v4M10 4h4"/><path d="M9 22V12h6v10"/></svg>; }
function IcoPlay()        { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>; }
function IcoFlame()       { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>; }
function IcoGlobe()       { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>; }
function IcoMic()         { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>; }
function IcoCalendar()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function IcoTicket()      { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>; }
function IcoCart()        { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>; }
function IcoVolunteer()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>; }
function IcoSunny()       { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>; }
function IcoPastor()      { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/><path d="M12 8v4M10 10h4"/></svg>; }
function IcoGroups()      { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }

// Nav icons
function IcoGrid()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>; }
function IcoCampaign(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>; }
function IcoHistory() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5-4v-4h4"/></svg>; }
function IcoPerson()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>; }
function IcoHeart()   { return <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className="w-5 h-5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>; }

const TILES = [
  { name: 'Bíblia',        Icon: IcoBookOpen  },
  { name: 'Igreja',        Icon: IcoChurch    },
  { name: 'Pregações',     Icon: IcoPlay      },
  { name: 'Ministério',    Icon: IcoFlame     },
  { name: 'Site',          Icon: IcoGlobe     },
  { name: 'Rádio',         Icon: IcoMic       },
  { name: 'Agenda anual',  Icon: IcoCalendar  },
  { name: 'Eventos',       Icon: IcoTicket    },
  { name: 'Compras',       Icon: IcoCart      },
  { name: 'Pão diário',    Icon: IcoVolunteer },
  { name: 'Testemunhos',   Icon: IcoSunny     },
  { name: 'Atend. Past.',  Icon: IcoPastor    },
  { name: 'Liderança',     Icon: IcoGroups    },
];

// ─── Bottom nav with floating FAB arc ─────────────────────────────────────────
function BottomNav({ dark, activeTab, onTab }: { dark: boolean; activeTab: string; onTab: (t: string) => void }) {
  const surf = dark ? SURF_DARK : SURF_LIGHT;
  const accent = dark ? TEAL_DARK : NAVY_LIGHT;
  const muted = dark ? '#64748b' : '#94a3b8';

  const tabs = [
    { key: 'menu',     label: 'Menu',     Icon: IcoGrid },
    { key: 'feed',     label: 'Feed',     Icon: IcoCampaign },
    { key: '__center__', label: '', Icon: IcoHeart },
    { key: 'historia', label: 'História', Icon: IcoHistory },
    { key: 'perfil',   label: 'Perfil',   Icon: IcoPerson },
  ];

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {/* The nav pill */}
      <div style={{
        background: surf,
        boxShadow: dark ? '0 -1px 20px rgba(0,0,0,0.4)' : '0 -1px 20px rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center',
        padding: '6px 0 0',
        transition: 'background 0.3s',
      }}>
        {tabs.map((tab) => {
          if (tab.key === '__center__') {
            return <div key="spacer" style={{ flex: 1 }} />;
          }
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => onTab(tab.key)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', paddingBottom: 6 }}>
              <span style={{ color: isActive ? accent : muted, transition: 'color 0.2s' }}>
                <tab.Icon />
              </span>
              <span style={{ fontSize: 8, color: isActive ? accent : muted, fontWeight: isActive ? 700 : 400, transition: 'color 0.2s' }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Floating center FAB */}
      <div style={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
        <button style={{
          width: 46, height: 46, borderRadius: '50%',
          background: dark ? TEAL_DARK : NAVY_LIGHT,
          boxShadow: `0 4px 18px ${dark ? 'rgba(77,217,192,0.4)' : 'rgba(26,29,61,0.4)'}`,
          border: `3px solid ${surf}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: dark ? '#10131F' : '#fff',
          transition: 'background 0.3s, box-shadow 0.3s, border-color 0.3s',
        }}>
          <IcoHeart />
        </button>
      </div>

      {/* Home indicator */}
      <div style={{ height: 20, background: surf, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.3s' }}>
        <div style={{ width: 90, height: 4, background: dark ? '#334155' : '#cbd5e1', borderRadius: 4 }} />
      </div>
    </div>
  );
}

// ─── Main phone shell ─────────────────────────────────────────────────────────
export function PhoneShell() {
  const [dark, setDark]       = useState(true);
  const [time, setTime]       = useState('');
  const [activeTab, setActiveTab] = useState('menu');
  const [user, setUser]       = useState<{ name: string; initial: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const stored = JSON.parse(localStorage.getItem('mrm_user') || '{}');
        const name = stored.fullName || stored.name || '';
        if (name) { setUser({ name, initial: name.charAt(0).toUpperCase() }); setLoading(false); return; }
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const n = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuário';
          setUser({ name: n, initial: n.charAt(0).toUpperCase() });
        } else { setUser(null); }
      } catch { setUser(null); }
      setLoading(false);
    }
    load();
  }, []);

  const bg     = dark ? BG_DARK    : BG_LIGHT;
  const surf   = dark ? SURF_DARK  : SURF_LIGHT;
  const text   = dark ? '#F1F5F9'  : '#1A1D3D';
  const sub    = dark ? '#64748B'  : '#6B7280';
  const accent = dark ? TEAL_DARK  : NAVY_LIGHT;
  const iconBg = dark ? '#1B1F31'  : NAVY_LIGHT;
  const toggleBg = dark ? '#1B1F31' : '#E2E8F0';

  return (
    <div className="relative select-none" style={{ width: 310 }}>
      {/* Phone body */}
      <div style={{
        width: 310, height: 668, borderRadius: 54,
        background: 'linear-gradient(160deg,#3d3d3f 0%,#1c1c1e 55%,#0d0d0f 100%)',
        padding: 3,
        boxShadow: [
          '0 0 0 1px rgba(255,255,255,0.11)',
          'inset 0 0 0 1px rgba(255,255,255,0.04)',
          '0 40px 100px rgba(0,0,0,0.9)',
          '0 0 80px rgba(34,197,94,0.14)',
        ].join(','),
        position: 'relative',
      }}>
        {/* Specular highlight */}
        <div style={{ position: 'absolute', inset: 3, borderRadius: 52, background: 'linear-gradient(145deg,rgba(255,255,255,0.05) 0%,transparent 40%)', pointerEvents: 'none', zIndex: 10 }} />

        {/* Screen */}
        <div style={{ width: '100%', height: '100%', borderRadius: 51, overflow: 'hidden', background: bg, display: 'flex', flexDirection: 'column', transition: 'background 0.3s', position: 'relative' }}>

          {/* Status bar */}
          <div style={{ background: dark ? BG_DARK : BG_LIGHT, padding: '10px 22px 2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 7, left: '50%', transform: 'translateX(-50%)', width: 110, height: 28, background: '#000', borderRadius: 20, zIndex: 5 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: text, fontVariantNumeric: 'tabular-nums', zIndex: 6 }}>{time}</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', zIndex: 6 }}>
              <Signal size={11} color={text} strokeWidth={2} />
              <Wifi size={11} color={text} strokeWidth={2} />
              <Battery size={12} color={text} strokeWidth={2} />
            </div>
          </div>

          {/* App header */}
          <div style={{ padding: '12px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: dark ? BG_DARK : BG_LIGHT }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: toggleBg }} />
                <div style={{ width: 80, height: 10, background: toggleBg, borderRadius: 6 }} />
              </div>
            ) : user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: dark ? '#10131F' : '#fff', fontWeight: 700 }}>
                  {user.initial}
                </div>
                <div>
                  <p style={{ fontSize: 9, color: sub, margin: 0 }}>Bom dia</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: text, margin: 0, maxWidth: 145, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: toggleBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LogIn size={16} color={sub} />
                </div>
                <div>
                  <p style={{ fontSize: 9, color: sub, margin: 0 }}>Bem-vindo</p>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#22c55e', margin: 0 }}>Entre para ver seus dados</p>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setDark(d => !d)} style={{ width: 30, height: 30, borderRadius: '50%', background: toggleBg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
                {dark ? <Sun size={14} color="#F1F5F9" /> : <Moon size={14} color={NAVY_LIGHT} />}
              </button>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: toggleBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🔔</div>
            </div>
          </div>

          {/* Icon grid */}
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: '10px 14px 16px', background: bg, transition: 'background 0.3s' }}>
            {!user && !loading && (
              <div style={{ marginBottom: 12, padding: '9px 12px', background: dark ? 'rgba(34,197,94,0.09)' : 'rgba(26,29,61,0.06)', borderRadius: 10, border: `1px solid ${dark ? 'rgba(34,197,94,0.2)' : 'rgba(26,29,61,0.12)'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <LogIn size={13} color={dark ? '#22c55e' : accent} />
                <p style={{ fontSize: 9, color: dark ? '#22c55e' : accent, margin: 0, lineHeight: 1.4 }}>
                  <strong>Faça login</strong> no MRM para ver seus dados da igreja aqui.
                </p>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px 4px' }}>
              {TILES.map(({ name, Icon }) => (
                <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                  onMouseEnter={e => { const d = e.currentTarget.querySelector<HTMLDivElement>('[data-tile-icon]'); if (d) d.style.transform = 'scale(1.1)'; }}
                  onMouseLeave={e => { const d = e.currentTarget.querySelector<HTMLDivElement>('[data-tile-icon]'); if (d) d.style.transform = 'scale(1)'; }}>
                  <div data-tile-icon="1" style={{ width: 54, height: 54, borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: dark ? '#E2E8F0' : '#fff', boxShadow: dark ? '0 4px 14px rgba(0,0,0,0.4)' : '0 4px 14px rgba(26,29,61,0.25)', transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1), background 0.3s' }}>
                    <Icon />
                  </div>
                  <span style={{ fontSize: 9, color: text, textAlign: 'center', fontWeight: 500, lineHeight: 1.2, transition: 'color 0.3s' }}>{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom nav */}
          <BottomNav dark={dark} activeTab={activeTab} onTab={setActiveTab} />
        </div>
      </div>

      {/* Side buttons */}
      <div style={{ position: 'absolute', right: -4, top: 130, width: 4, height: 68, background: 'linear-gradient(180deg,#3a3a3c,#2a2a2c)', borderRadius: '0 3px 3px 0', boxShadow: '1px 0 4px rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'absolute', left: -4, top: 108, width: 4, height: 30, background: 'linear-gradient(180deg,#3a3a3c,#2a2a2c)', borderRadius: '3px 0 0 3px', boxShadow: '-1px 0 4px rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'absolute', left: -4, top: 148, width: 4, height: 56, background: 'linear-gradient(180deg,#3a3a3c,#2a2a2c)', borderRadius: '3px 0 0 3px', boxShadow: '-1px 0 4px rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'absolute', left: -4, top: 214, width: 4, height: 56, background: 'linear-gradient(180deg,#3a3a3c,#2a2a2c)', borderRadius: '3px 0 0 3px', boxShadow: '-1px 0 4px rgba(0,0,0,0.5)' }} />

      {/* Green glow */}
      <div style={{ position: 'absolute', inset: -20, borderRadius: 74, background: 'radial-gradient(ellipse,rgba(34,197,94,0.07) 0%,transparent 68%)', pointerEvents: 'none', zIndex: -1 }} />
    </div>
  );
}

// ─── Overlay wrapper ──────────────────────────────────────────────────────────
export function MobileAppOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(14px)' }}
      onClick={onClose}>
      <div className="flex flex-col items-center gap-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-[10px] tracking-widest uppercase">Preview do App</span>
          <span className="text-green-400 text-[10px] tracking-widest uppercase font-semibold">● Ao Vivo</span>
        </div>
        <div style={{ animation: 'phonePop 0.42s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
          <PhoneShell />
        </div>
        <button onClick={onClose} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs transition-colors mt-1">
          <X size={13} /> Fechar (Esc)
        </button>
      </div>
      <style>{`@keyframes phonePop{from{transform:scale(0.82) translateY(28px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}`}</style>
    </div>
  );
}
