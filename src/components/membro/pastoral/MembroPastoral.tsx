import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useMembroSession } from '../MembroProvider';
import { MembroShell } from '../MembroShell';

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

  // New States
  const [churches, setChurches] = useState<{ id: string; name: string }[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState('');
  const [phone, setPhone] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [loadingOtp, setLoadingOtp] = useState(false);

  useEffect(() => {
    if (session?.member) {
      setSelectedChurchId(session.member.churchId || '');
      setPhone(session.member.phone || session.member.mobile || '');
    }
  }, [session]);

  useEffect(() => {
    fetch('/api/public/churches')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setChurches(data);
        }
      })
      .catch(err => console.error('Erro ao carregar igrejas:', err));
  }, []);

  if (!session) return null;

  const handleSendOtp = async () => {
    if (!motivo || !mensagem.trim()) {
      setError('Preencha o motivo e a mensagem.');
      return;
    }
    if (!phone.trim()) {
      setError('Por favor, informe seu número de WhatsApp.');
      return;
    }
    setError('');
    setLoadingOtp(true);
    try {
      const res = await fetch('/api/public/pastoral/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar OTP');
      setOtpToken(data.otp_token);
      setOtpError('');
      setOtpCode('');
      setOtpStep(true);
    } catch (e: any) {
      setError(e.message || 'Erro ao iniciar verificação.');
    } finally {
      setLoadingOtp(false);
    }
  };

  const handleVerifyAndSubmit = async () => {
    if (otpCode.length < 6) {
      setOtpError('O código deve conter 6 dígitos.');
      return;
    }
    setOtpError('');
    setLoading(true);
    try {
      const res = await fetch('/api/public/pastoral/create-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: session.member.fullName,
          phone,
          otp_token: otpToken,
          code: otpCode,
          churchId: selectedChurchId,
          memberId: session.member.id,
          campoId: session.member.campoId,
          reason: motivo,
          description: mensagem,
          priority: urgente ? 'high' : 'normal',
          source: 'portal_membro',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar solicitação.');
      setSent(true);
    } catch (e: any) {
      setOtpError(e.message || 'Não foi possível enviar a solicitação.');
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
          ) : otpStep ? (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="text-center">
                <p className="text-lg font-bold text-white mb-2">Verificação de WhatsApp</p>
                <p className="text-sm text-white/40 leading-relaxed">
                  Enviamos um código de verificação via WhatsApp para:<br />
                  <strong className="text-white">{phone}</strong>
                </p>
              </div>

              <div>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full tracking-[1.5em] text-center font-bold px-4 py-3.5 rounded-xl text-xl text-white outline-none focus:ring-2 focus:ring-teal-400"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>

              {otpError && (
                <div className="flex items-center justify-center gap-2 text-red-400 text-xs">
                  <AlertCircle size={13} /> {otpError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setOtpStep(false)}
                  className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-white/60 border border-white/10 hover:bg-white/5 active:scale-[0.98] transition-all"
                >
                  Voltar
                </button>
                <button
                  onClick={handleVerifyAndSubmit}
                  disabled={loading || otpCode.length < 6}
                  className="flex-1 py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: TEAL, color: '#0d0f17' }}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar'}
                </button>
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

              {/* Seleção de Igreja */}
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Igreja para Atendimento</label>
                <select
                  value={selectedChurchId}
                  onChange={e => setSelectedChurchId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <option value="" className="bg-slate-900 text-white">Selecione uma igreja...</option>
                  {churches.map(ch => (
                    <option key={ch.id} value={ch.id} className="bg-slate-900 text-white">
                      {ch.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Confirmar seu WhatsApp</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(19) 99999-9999"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>

              {/* Mensagem */}
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Sua mensagem</label>
                <textarea
                  value={mensagem}
                  onChange={e => setMensagem(e.target.value)}
                  placeholder="Descreva brevemente sua situação..."
                  rows={4}
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
                onClick={handleSendOtp}
                disabled={loadingOtp}
                className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ background: TEAL, color: '#0d0f17' }}
              >
                {loadingOtp ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar e Avançar'}
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </MembroShell>
  );
}
