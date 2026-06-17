"use client";

import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { LogOut, Church, MapPin, Hash, Calendar, User } from 'lucide-react';
import { useMembroSession } from '../MembroProvider';
import { MembroShell } from '../MembroShell';

const TEAL = '#2dd4bf';
const BG = '#0d0f17';

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function statusColor(status?: string | null): string {
  const s = (status || '').toLowerCase();
  if (s.includes('ativo') || s.includes('ativa')) return '#22c55e';
  if (s.includes('inativo') || s.includes('inativa')) return '#ef4444';
  return '#f59e0b';
}

export default function MembroPerfil() {
  const { session, logout } = useMembroSession();
  const navigate = useNavigate();

  if (!session) {
    navigate('/membro', { replace: true });
    return null;
  }

  const { member } = session;
  const displayName = member.preferredName || member.fullName;
  const churchName = member.church?.name || '—';
  const campoName = member.church?.regional?.campo?.name || '—';
  const scolor = statusColor(member.membershipStatus);

  const InfoCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <div
      className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <span className="flex-shrink-0 opacity-40">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-white/35 font-medium uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-sm text-white/90 font-medium truncate">{value}</p>
      </div>
    </div>
  );

  return (
    <MembroShell title="Meu Perfil">
      <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="max-w-lg mx-auto px-5 pb-8">

          {/* Hero / Avatar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center pt-6 pb-8 relative"
          >
            {/* Cover blurred bg */}
            {member.coverPhotoUrl && (
              <div
                className="absolute inset-x-0 top-0 h-28 rounded-2xl overflow-hidden -z-0"
                style={{
                  backgroundImage: `url(${member.coverPhotoUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  opacity: 0.3,
                  filter: 'blur(20px)',
                }}
              />
            )}

            {/* Avatar */}
            <div className="relative z-10 mb-4">
              {member.photoUrl ? (
                <img
                  src={member.photoUrl}
                  alt={displayName}
                  className="w-24 h-24 rounded-full object-cover"
                  style={{ border: `3px solid ${TEAL}55`, boxShadow: `0 0 32px ${TEAL}30` }}
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold"
                  style={{ background: `${TEAL}22`, border: `3px solid ${TEAL}44`, color: TEAL }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              {/* Online indicator */}
              <div
                className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2"
                style={{ background: scolor, borderColor: BG }}
              />
            </div>

            {/* Name */}
            <h1 className="text-xl font-bold text-white text-center leading-tight z-10">{displayName}</h1>
            {member.preferredName && member.preferredName !== member.fullName && (
              <p className="text-xs text-white/35 mt-0.5 z-10">{member.fullName}</p>
            )}

            {/* Title badge */}
            {member.ecclesiasticalTitle && (
              <div
                className="mt-3 px-3 py-1 rounded-full text-xs font-semibold z-10"
                style={{ background: `${TEAL}18`, color: TEAL, border: `1px solid ${TEAL}30` }}
              >
                {member.ecclesiasticalTitle}
              </div>
            )}

            {/* Status badge */}
            {member.membershipStatus && (
              <div
                className="mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-medium z-10"
                style={{ background: `${scolor}18`, color: scolor, border: `1px solid ${scolor}30` }}
              >
                {member.membershipStatus}
              </div>
            )}
          </motion.div>

          {/* Info cards */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-2.5"
          >
            {member.rol && (
              <InfoCard icon={<Hash size={16} className="text-white" />} label="Número de ROL" value={String(member.rol)} />
            )}
            <InfoCard icon={<Church size={16} className="text-white" />} label="Igreja" value={churchName} />
            <InfoCard icon={<MapPin size={16} className="text-white" />} label="Campo" value={campoName} />
            {member.baptismDate && (
              <InfoCard icon={<Calendar size={16} className="text-white" />} label="Data de Batismo" value={formatDate(member.baptismDate)} />
            )}
            {member.membershipDate && (
              <InfoCard icon={<Calendar size={16} className="text-white" />} label="Membro desde" value={formatDate(member.membershipDate)} />
            )}
            {member.birthDate && (
              <InfoCard icon={<User size={16} className="text-white" />} label="Data de Nascimento" value={formatDate(member.birthDate)} />
            )}
          </motion.div>

          {/* Quick actions */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 space-y-2.5"
          >
            <p className="text-[10px] font-semibold tracking-widest text-white/25 uppercase px-1 mb-3">Acesso rápido</p>
            <QuickAction
              label="Ver Menu"
              sub="Bíblia, Pregações, Agenda..."
              color={TEAL}
              onClick={() => navigate('/membro/menu')}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5">
                  <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
                  <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
                </svg>
              }
            />
            <QuickAction
              label="Pão Diário"
              sub="Devocional de hoje"
              color="#f59e0b"
              onClick={() => navigate('/membro/pao-diario')}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              }
            />
            <QuickAction
              label="Atend. Pastoral"
              sub="Solicitar atendimento"
              color="#a78bfa"
              onClick={() => navigate('/membro/pastoral')}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  <line x1="12" y1="8" x2="12" y2="12"/><line x1="10" y1="10" x2="14" y2="10"/>
                </svg>
              }
            />
          </motion.div>

          {/* Logout */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-10 flex justify-center"
          >
            <button
              onClick={() => { logout(); navigate('/', { replace: true }); }}
              className="flex items-center gap-2 text-sm text-white/25 hover:text-red-400 transition-colors py-2 px-4"
            >
              <LogOut size={14} />
              Sair da conta
            </button>
          </motion.div>

        </div>
      </div>
    </MembroShell>
  );
}

function QuickAction({
  label, sub, color, icon, onClick,
}: {
  label: string; sub: string; color: string; icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left group transition-all active:scale-[0.99]"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}30`, color }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white/85">{label}</p>
        <p className="text-[11px] text-white/35 mt-0.5">{sub}</p>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 opacity-20 flex-shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
