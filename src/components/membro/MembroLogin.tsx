"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, Phone, MessageCircle, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useMembroSession } from './MembroProvider';
import type { MembroSession } from './MembroProvider';

interface MembroLoginProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'credentials' | 'phone' | 'otp' | 'success';

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
  if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

export function MembroLogin({ onClose, onSuccess }: MembroLoginProps) {
  const { login } = useMembroSession();
  const [step, setStep] = useState<Step>('credentials');
  const [rol, setRol] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneMasked, setPhoneMasked] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberPhoto, setMemberPhoto] = useState<string | null>(null);
  const [challengeToken, setChallengeToken] = useState('');
  const [otpToken, setOtpToken] = useState('');
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

  const handleLookup = async () => {
    setError('');
    if (!rol || !cpf) { setError('Preencha o ROL e o CPF.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/membro/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol: parseInt(rol), cpf }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao buscar membro.'); return; }
      setChallengeToken(data.challenge_token);
      setMemberName(data.name);
      setMemberPhoto(data.photo_url);
      setPhoneMasked(data.phone_masked);
      setStep('phone');
    } catch {
      setError('Falha na conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (phoneOverride?: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/membro/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_token: challengeToken, phone: phoneOverride }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao enviar código.'); return; }
      setOtpToken(data.otp_token);
      setStep('otp');
      setCountdown(60);
      setTimeout(() => codeRefs.current[0]?.focus(), 300);
    } catch {
      setError('Falha na conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/membro/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_token: otpToken, code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Código incorreto.'); setCode(''); codeRefs.current[0]?.focus(); return; }
      login(data as MembroSession);
      setStep('success');
      setTimeout(() => { onSuccess(); }, 1400);
    } catch {
      setError('Falha na conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeInput = (i: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const arr = code.split('').concat(Array(6).fill('')).slice(0, 6);
    arr[i] = digit;
    const next = arr.join('');
    setCode(next);
    if (digit && i < 5) codeRefs.current[i + 1]?.focus();
    if (next.replace(/\s/g, '').length === 6) {
      setTimeout(() => handleVerify(), 100);
    }
  };

  const handleCodeKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      const arr = code.split('').concat(Array(6).fill('')).slice(0, 6);
      arr[i] = '';
      setCode(arr.join(''));
      if (i > 0) codeRefs.current[i - 1]?.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden relative"
        style={{ background: '#0d0f17', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `${TEAL}22`, border: `1px solid ${TEAL}44` }}
            >
              <span style={{ color: TEAL, fontSize: 16 }}>👤</span>
            </div>
            <span className="text-sm font-semibold text-white/80">Sou Membro</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/08 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

        {/* Content */}
        <div className="px-6 py-6 min-h-[320px]">
          <AnimatePresence mode="wait">

            {/* Step 1: ROL + CPF */}
            {step === 'credentials' && (
              <motion.div key="credentials"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div>
                  <p className="text-lg font-bold text-white mb-1">Acesse sua área</p>
                  <p className="text-sm text-white/45">Digite seu número de ROL e CPF para continuar.</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Número de ROL</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="ex: 1234"
                      value={rol}
                      onChange={e => setRol(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLookup()}
                      className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">CPF</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={e => setCpf(formatCpf(e.target.value))}
                      onKeyDown={e => e.key === 'Enter' && handleLookup()}
                      maxLength={14}
                      className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle size={13} /> {error}
                  </div>
                )}

                <button
                  onClick={handleLookup}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  style={{ background: TEAL, color: '#0d0f17' }}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <><span>Continuar</span><ChevronRight size={16} /></>}
                </button>
              </motion.div>
            )}

            {/* Step 2: Phone confirmation */}
            {step === 'phone' && (
              <motion.div key="phone"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-4">
                  {memberPhoto && (
                    <img src={memberPhoto} alt="" className="w-14 h-14 rounded-full object-cover" style={{ border: `2px solid ${TEAL}44` }} />
                  )}
                  <div>
                    <p className="text-lg font-bold text-white leading-tight">Olá, {memberName.split(' ')[0]}!</p>
                    <p className="text-xs text-white/45 mt-0.5">Encontramos seu cadastro</p>
                  </div>
                </div>

                <div
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <Phone size={15} className="text-white/40 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-white/35 mb-0.5">Enviaremos o código para</p>
                    <p className="text-sm text-white font-medium">{phoneMasked}</p>
                  </div>
                </div>

                <p className="text-xs text-white/35 leading-relaxed">
                  Receberá uma mensagem no WhatsApp com o código de 6 dígitos.
                </p>

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle size={13} /> {error}
                  </div>
                )}

                <button
                  onClick={() => handleSendOtp()}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  style={{ background: TEAL, color: '#0d0f17' }}
                >
                  {loading
                    ? <Loader2 size={16} className="animate-spin" />
                    : <><MessageCircle size={16} /><span>Enviar código no WhatsApp</span></>
                  }
                </button>

                <button
                  onClick={() => setStep('credentials')}
                  className="w-full text-xs text-white/35 hover:text-white/60 transition-colors py-1"
                >
                  ← Voltar
                </button>
              </motion.div>
            )}

            {/* Step 3: OTP */}
            {step === 'otp' && (
              <motion.div key="otp"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div>
                  <p className="text-lg font-bold text-white mb-1">Código enviado</p>
                  <p className="text-sm text-white/45">
                    Digite os 6 dígitos enviados para <span className="text-white/70">{phoneMasked}</span>
                  </p>
                </div>

                {/* OTP inputs */}
                <div className="flex gap-2 justify-between">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <input
                      key={i}
                      ref={el => { codeRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={code[i] || ''}
                      onChange={e => handleCodeInput(i, e.target.value)}
                      onKeyDown={e => handleCodeKeyDown(i, e)}
                      className="w-11 h-13 rounded-xl text-center text-lg font-bold text-white outline-none transition-all"
                      style={{
                        height: '52px',
                        background: code[i] ? `${TEAL}18` : 'rgba(255,255,255,0.06)',
                        border: `1.5px solid ${code[i] ? TEAL + '60' : 'rgba(255,255,255,0.1)'}`,
                      }}
                    />
                  ))}
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle size={13} /> {error}
                  </div>
                )}

                <button
                  onClick={handleVerify}
                  disabled={loading || code.length !== 6}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: TEAL, color: '#0d0f17' }}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'Verificar código'}
                </button>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setStep('phone')}
                    className="text-xs text-white/35 hover:text-white/60 transition-colors"
                  >
                    ← Voltar
                  </button>
                  {countdown > 0 ? (
                    <span className="text-xs text-white/30">Reenviar em {countdown}s</span>
                  ) : (
                    <button
                      onClick={() => handleSendOtp()}
                      disabled={loading}
                      className="text-xs hover:opacity-80 transition-opacity"
                      style={{ color: TEAL }}
                    >
                      Reenviar código
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 4: Success */}
            {step === 'success' && (
              <motion.div key="success"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-8 gap-4"
              >
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.1 }}
                >
                  <CheckCircle size={56} style={{ color: TEAL }} />
                </motion.div>
                <p className="text-lg font-bold text-white">Bem-vindo(a), {memberName.split(' ')[0]}!</p>
                <p className="text-sm text-white/45">Abrindo seu perfil...</p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Safe area */}
        <div style={{ height: 'env(safe-area-inset-bottom, 16px)', minHeight: 16 }} />
      </motion.div>
    </div>
  );
}
