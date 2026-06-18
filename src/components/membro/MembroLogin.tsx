"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useMembroSession } from './MembroProvider';
import type { MembroSession } from './MembroProvider';

interface MembroLoginProps {
  isDark?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'credentials' | 'otp' | 'success';

const TEAL = '#2dd4bf';

function formatCpf(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function MembroLogin({ isDark = true, onClose, onSuccess }: MembroLoginProps) {
  const { login } = useMembroSession();

  const dark = isDark;
  const bg        = dark ? '#0f1117' : '#ffffff';
  const surface   = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const border    = dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.10)';
  const textPri   = dark ? '#f1f5f9' : '#111827';
  const textSub   = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const divider   = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const inputBg   = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  const inputBorder = dark ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.13)';
  const overlay   = dark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.35)';

  const [step, setStep] = useState<Step>('credentials');
  const [rol, setRol] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberPhoto, setMemberPhoto] = useState<string | null>(null);
  const [phoneMasked, setPhoneMasked] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const inputStyle: React.CSSProperties = {
    background: inputBg,
    border: `1px solid ${inputBorder}`,
    color: textPri,
  };

  const inputClass = "w-full px-4 py-3 rounded-xl text-sm outline-none transition-all";

  // Step 1 → lookup + auto send OTP
  const handleLookup = async () => {
    setError('');
    if (!rol.trim()) { setError('Informe o número de ROL.'); return; }
    if (!cpf.trim() || cpf.replace(/\D/g, '').length !== 11) { setError('Informe um CPF válido.'); return; }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) { setError('Informe o celular com DDD.'); return; }

    setLoading(true);
    try {
      // Lookup
      const lookupRes = await fetch('/api/membro/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol: parseInt(rol), cpf, phone }),
      });
      const lookupData = await lookupRes.json();
      if (!lookupRes.ok) { setError(lookupData.error || 'Dados não encontrados.'); return; }

      setChallengeToken(lookupData.challenge_token);
      setMemberName(lookupData.name);
      setMemberPhoto(lookupData.photo_url);
      setPhoneMasked(lookupData.phone_masked);

      // Auto send OTP
      const otpRes = await fetch('/api/membro/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_token: lookupData.challenge_token }),
      });
      const otpData = await otpRes.json();
      if (!otpRes.ok) { setError(otpData.error || 'Erro ao enviar código.'); return; }

      setOtpToken(otpData.otp_token);
      setStep('otp');
      setCountdown(60);
      setTimeout(() => codeRefs.current[0]?.focus(), 300);
    } catch {
      setError('Falha na conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/membro/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_token: challengeToken }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao reenviar.'); return; }
      setOtpToken(data.otp_token);
      setCode('');
      setCountdown(60);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch {
      setError('Falha ao reenviar código.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (codeOverride?: string) => {
    const finalCode = codeOverride ?? code;
    if (finalCode.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/membro/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_token: otpToken, code: finalCode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Código incorreto.'); setCode(''); codeRefs.current[0]?.focus(); return; }
      login(data as MembroSession);
      setStep('success');
      setTimeout(() => onSuccess(), 1200);
    } catch {
      setError('Falha na conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeInput = (i: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const arr = (code + '      ').slice(0, 6).split('');
    arr[i] = digit;
    const next = arr.join('');
    setCode(next);
    if (digit && i < 5) codeRefs.current[i + 1]?.focus();
    if (next.replace(/ /g, '').length === 6) setTimeout(() => handleVerify(next.replace(/ /g, '')), 80);
  };

  const handleCodeKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      const arr = (code + '      ').slice(0, 6).split('');
      arr[i] = ' ';
      setCode(arr.join(''));
      if (i > 0) codeRefs.current[i - 1]?.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      style={{ background: overlay, backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 48 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{ background: bg, border: `1px solid ${border}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base" style={{ background: `${TEAL}20`, border: `1px solid ${TEAL}40` }}>
              👤
            </div>
            <span className="text-sm font-semibold" style={{ color: textPri }}>Sou Membro</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ color: textSub }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ height: 1, background: divider }} />

        {/* Content */}
        <div className="px-6 py-5 min-h-[300px]">
          <AnimatePresence mode="wait">

            {/* Passo 1: ROL + CPF + Celular */}
            {step === 'credentials' && (
              <motion.div key="cred" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-4">
                <div>
                  <p className="text-base font-bold mb-1" style={{ color: textPri }}>Acesse sua área</p>
                  <p className="text-xs leading-relaxed" style={{ color: textSub }}>Busca por ROL e CPF. O código de acesso será enviado para o celular informado.</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: textSub }}>Número de ROL</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="ex: 1234"
                      value={rol}
                      onChange={e => setRol(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={e => e.key === 'Enter' && handleLookup()}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: textSub }}>CPF</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={e => setCpf(formatCpf(e.target.value))}
                      onKeyDown={e => e.key === 'Enter' && handleLookup()}
                      maxLength={14}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 uppercase tracking-wide" style={{ color: textSub }}>Celular para receber o código</label>
                    <p className="text-[10px] mb-1.5" style={{ color: textSub, opacity: 0.6 }}>Informe o número onde o código será enviado via WhatsApp</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="(19) 99999-0000"
                      value={phone}
                      onChange={e => setPhone(formatPhone(e.target.value))}
                      onKeyDown={e => e.key === 'Enter' && handleLookup()}
                      maxLength={15}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-500 text-xs">
                    <AlertCircle size={13} className="flex-shrink-0" /> {error}
                  </div>
                )}

                <button
                  onClick={handleLookup}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ background: TEAL, color: '#0d0f17' }}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <><span>Enviar código</span><ChevronRight size={15} /></>}
                </button>
              </motion.div>
            )}

            {/* Passo 2: Código OTP */}
            {step === 'otp' && (
              <motion.div key="otp" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-5">
                <div className="flex items-center gap-3">
                  {memberPhoto && (
                    <img src={memberPhoto} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" style={{ border: `2px solid ${TEAL}44` }} />
                  )}
                  <div>
                    <p className="text-base font-bold leading-tight" style={{ color: textPri }}>Olá, {memberName.split(' ')[0]}!</p>
                    <p className="text-xs mt-0.5" style={{ color: textSub }}>
                      Código enviado para <span style={{ color: textPri }}>{phoneMasked}</span>
                    </p>
                  </div>
                </div>

                {/* OTP inputs */}
                <div className="flex gap-2 justify-between">
                  {Array.from({ length: 6 }).map((_, i) => {
                    const digit = (code + '      ')[i];
                    const filled = digit && digit !== ' ';
                    return (
                      <input
                        key={i}
                        ref={el => { codeRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={filled ? digit : ''}
                        onChange={e => handleCodeInput(i, e.target.value)}
                        onKeyDown={e => handleCodeKeyDown(i, e)}
                        className="flex-1 rounded-xl text-center text-lg font-bold outline-none transition-all"
                        style={{
                          height: '52px',
                          background: filled ? `${TEAL}18` : inputBg,
                          border: `1.5px solid ${filled ? TEAL + '55' : inputBorder}`,
                          color: textPri,
                        }}
                      />
                    );
                  })}
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-500 text-xs">
                    <AlertCircle size={13} /> {error}
                  </div>
                )}

                <button
                  onClick={() => handleVerify()}
                  disabled={loading || code.replace(/ /g, '').length !== 6}
                  className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: TEAL, color: '#0d0f17' }}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'Verificar código'}
                </button>

                <div className="flex items-center justify-between">
                  <button onClick={() => setStep('credentials')} className="text-xs transition-colors" style={{ color: textSub }}>
                    ← Voltar
                  </button>
                  {countdown > 0 ? (
                    <span className="text-xs" style={{ color: textSub }}>Reenviar em {countdown}s</span>
                  ) : (
                    <button onClick={handleResend} disabled={loading} className="text-xs font-medium transition-opacity hover:opacity-70" style={{ color: TEAL }}>
                      Reenviar código
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Sucesso */}
            {step === 'success' && (
              <motion.div key="ok" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-8 gap-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}>
                  <CheckCircle size={52} style={{ color: TEAL }} />
                </motion.div>
                <p className="text-base font-bold text-center" style={{ color: textPri }}>Bem-vindo(a), {memberName.split(' ')[0]}!</p>
                <p className="text-xs text-center" style={{ color: textSub }}>Abrindo seu perfil...</p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <div style={{ height: 'env(safe-area-inset-bottom, 16px)', minHeight: 16 }} />
      </motion.div>
    </div>
  );
}
