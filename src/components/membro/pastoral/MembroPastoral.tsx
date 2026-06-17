"use client";

import { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useMembroSession } from '../MembroProvider';
import { MembroShell } from '../MembroShell';
import { supabase } from '@/lib/supabaseClient';

const TEAL = '#2dd4bf';

const MOTIVOS = [
  'Aconselhamento pessoal',
  'Problema familiar',
  'Saúde e cura',
  'Situação financeira',
  'Relacionamentos',
  'Crescimento espiritual',
  'Outro',
];

export default function MembroPastoral() {
  const { session } = useMembroSession();
  const [motivo, setMotivo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (!session) return null;

  const handleSubmit = async () => {
    if (!motivo || !mensagem.trim()) { setError('Preencha o motivo e a mensagem.'); return; }
    setError('');
    setLoading(true);
    try {
      const { error: err } = await supabase.from('pastoral_attendances').insert({
        member_id: session.member.id,
        church_id: session.member.churchId,
        campo_id: session.member.campoId,
        reason: motivo,
        description: mensagem,
        priority: urgente ? 'high' : 'normal',
        status: 'open',
        source: 'portal_membro',
      });
      if (err) throw err;
      setSent(true);
    } catch (e) {
      console.error(e);
      setError('Não foi possível enviar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MembroShell title="Atend. Pastoral" showBack>
      <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="max-w-lg mx-auto px-5 py-4 pb-8">

          {sent ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-16 gap-5 text-center">
              <CheckCircle size={56} style={{ color: TEAL }} />
              <div>
                <p className="text-lg font-bold text-white mb-2">Solicitação enviada!</p>
                <p className="text-sm text-white/45 leading-relaxed">
                  Recebemos sua solicitação de atendimento pastoral.<br />
                  Em breve um pastor entrará em contato.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div>
                <p className="text-lg font-bold text-white mb-1">Atendimento Pastoral</p>
                <p className="text-sm text-white/40 leading-relaxed">
                  Solicite um atendimento pastoral. Sua mensagem será encaminhada com sigilo.
                </p>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">Motivo do atendimento</label>
                <div className="grid grid-cols-2 gap-2">
                  {MOTIVOS.map(m => (
                    <button
                      key={m}
                      onClick={() => setMotivo(m)}
                      className="px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all"
                      style={motivo === m
                        ? { background: `${TEAL}22`, color: TEAL, border: `1.5px solid ${TEAL}50` }
                        : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }
                      }
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mensagem */}
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Sua mensagem</label>
                <textarea
                  value={mensagem}
                  onChange={e => setMensagem(e.target.value)}
                  placeholder="Descreva brevemente sua situação..."
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all resize-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>

              {/* Urgente */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={() => setUrgente(u => !u)}
                  className="w-5 h-5 rounded-md flex items-center justify-center transition-all flex-shrink-0"
                  style={urgente ? { background: TEAL } : { background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)' }}
                >
                  {urgente && <svg viewBox="0 0 24 24" fill="none" stroke="#0d0f17" strokeWidth="3" className="w-3 h-3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span className="text-sm text-white/55">Situação urgente</span>
              </label>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs">
                  <AlertCircle size={13} /> {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ background: TEAL, color: '#0d0f17' }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Enviar solicitação'}
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </MembroShell>
  );
}
