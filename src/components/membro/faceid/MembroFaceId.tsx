"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { useMembroSession } from '../MembroProvider';
import { MembroShell } from '../MembroShell';

const TEAL = '#2dd4bf';

type Step = 'intro' | 'camera' | 'preview' | 'sending' | 'tracking';

interface DeviceResult {
  id: string;
  device: string;
  status: string;
  message: string | null;
  canRetry: boolean;
  canUpdate: boolean;
}

interface StatusResponse {
  state: 'none' | 'processing' | 'done' | 'failed' | 'partial' | 'needs_approval';
  batch_id?: string;
  devices: DeviceResult[];
  message: string | null;
  canRetry: boolean;
  canUpdate: boolean;
}

// O Control iD exige nitidez mínima e rosto entre 60px e 800px de largura.
// 720x720 dá margem confortável sem estourar o limite de 2MB.
const CAPTURE_SIZE = 720;
const JPEG_QUALITY = 0.92;

export default function MembroFaceId() {
  const { session, isLoading } = useMembroSession();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [step, setStep] = useState<Step>('intro');
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !session) navigate('/membro', { replace: true });
  }, [session, isLoading, navigate]);

  // ------------------------------------------------------------------
  // Câmera
  // ------------------------------------------------------------------
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador não permite acessar a câmera. Tente pelo Chrome ou Safari.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      });

      // Guarda o stream e troca de passo. O <video> só existe depois desta
      // troca, então quem anexa o stream é o efeito abaixo — tentar aqui
      // pegaria videoRef.current === null e a tela ficaria preta.
      streamRef.current = stream;
      setStep('camera');
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setError('Permissão de câmera negada. Libere o acesso nas configurações do navegador e tente de novo.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setError('Nenhuma câmera frontal encontrada neste aparelho.');
      } else if (name === 'NotReadableError') {
        setError('A câmera está sendo usada por outro aplicativo. Feche-o e tente de novo.');
      } else {
        setError('Não conseguimos acessar a câmera. Verifique a permissão do navegador e tente de novo.');
      }
      setStep('intro');
    }
  }, []);

  // Anexa o stream assim que o <video> entra no DOM
  useEffect(() => {
    if (step !== 'camera') return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.play().catch(() => {
      setError('Não foi possível iniciar a pré-visualização. Toque em "Abrir câmera" novamente.');
      setStep('intro');
    });
  }, [step]);

  useEffect(() => () => {
    stopCamera();
    if (pollRef.current) clearInterval(pollRef.current);
  }, [stopCamera]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Sem dimensões o canvas sairia preto e o leitor recusaria a foto
    if (!video.videoWidth || !video.videoHeight) {
      setError('A câmera ainda está carregando. Aguarde um instante e tente de novo.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = CAPTURE_SIZE;
    canvas.height = CAPTURE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Recorta o quadrado central do vídeo — é o que o membro vê no enquadramento
    const side = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - side) / 2;
    const sy = (video.videoHeight - side) / 2;

    // Desespelha: o preview é espelhado por conforto, mas a foto enviada
    // ao leitor precisa ser a imagem real.
    ctx.translate(CAPTURE_SIZE, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, side, side, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE);

    setPhoto(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    stopCamera();
    setStep('preview');
  }, [stopCamera]);

  // ------------------------------------------------------------------
  // Envio + acompanhamento
  // ------------------------------------------------------------------
  const pollStatus = useCallback(
    async (batch: string) => {
      if (!session) return;
      try {
        const res = await fetch('/api/membro/faceid/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: session.member_token, batchId: batch }),
        });
        const data: StatusResponse = await res.json();
        if (!res.ok) return;

        setStatus(data);

        // Parou de mexer: encerra o polling
        if (data.state !== 'processing' && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        /* rede instável — a próxima tentativa resolve */
      }
    },
    [session]
  );

  const submit = useCallback(
    async (allowUpdate = false) => {
      if (!session || !photo) return;
      setStep('sending');
      setError(null);

      try {
        const res = await fetch('/api/membro/faceid/enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: session.member_token, photo, allowUpdate }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Não foi possível enviar sua foto.');
          setStep('preview');
          return;
        }

        setBatchId(data.batch_id);
        setStatus({
          state: data.status === 'needs_approval' ? 'needs_approval' : 'processing',
          devices: [],
          message: null,
          canRetry: false,
          canUpdate: false,
        });
        setStep('tracking');

        if (data.status !== 'needs_approval') {
          pollStatus(data.batch_id);
          pollRef.current = setInterval(() => pollStatus(data.batch_id), 3000);
        }
      } catch {
        setError('Falha de conexão. Verifique sua internet e tente novamente.');
        setStep('preview');
      }
    },
    [session, photo, pollStatus]
  );

  const restart = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPhoto(null);
    setStatus(null);
    setBatchId(null);
    setError(null);
    startCamera();
  }, [startCamera]);

  if (isLoading || !session || !session.member) return null;

  const firstName = (session.member.preferredName || session.member.fullName).split(' ')[0];

  return (
    <MembroShell>
      <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="max-w-lg mx-auto px-5 py-5 pb-10">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate('/membro/menu')}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
              aria-label="Voltar"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-white/60">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-white">Cadastro Face ID</h1>
              <p className="text-[11px] text-white/40">Registre seu rosto para marcar presença</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl px-4 py-3 text-[12px] leading-relaxed"
                 style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">

            {/* ---------------- INTRO ---------------- */}
            {step === 'intro' && (
              <motion.div key="intro" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="rounded-2xl p-5 mb-5"
                     style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-[13px] text-slate-300 leading-relaxed mb-3">
                    Olá, <span className="font-semibold text-white">{firstName}</span>. Vamos cadastrar
                    seu rosto nos leitores da sua igreja para que sua presença seja registrada
                    automaticamente.
                  </p>
                  <p className="text-[12px] text-slate-400 leading-relaxed mb-4">
                    Se você já tem cadastro no leitor, a foto será substituída pela nova.
                    Ela também passa a ser a foto do seu perfil.
                  </p>
                  <p className="text-[11px] font-semibold text-white/50 mb-2 uppercase tracking-wide">
                    Para a foto dar certo
                  </p>
                  <ul className="space-y-2">
                    {[
                      'Fique num lugar bem iluminado, de frente para a luz',
                      'Olhe direto para a câmera, sem inclinar o rosto',
                      'Tire óculos escuros, boné ou qualquer coisa que cubra o rosto',
                      'Deixe o rosto inteiro dentro do círculo',
                      'Segure o celular firme para a foto não sair tremida',
                    ].map((t) => (
                      <li key={t} className="flex gap-2 text-[12px] text-slate-400 leading-relaxed">
                        <span style={{ color: TEAL }}>•</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={startCamera}
                  className="w-full py-3.5 rounded-xl font-bold text-[14px] text-slate-900 transition-transform active:scale-[0.98]"
                  style={{ background: TEAL }}
                >
                  Abrir câmera
                </button>
              </motion.div>
            )}

            {/* ---------------- CÂMERA ---------------- */}
            {step === 'camera' && (
              <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="relative rounded-2xl overflow-hidden mb-5 bg-black" style={{ aspectRatio: '1/1' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  {/* Guia de enquadramento */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div
                      className="rounded-full"
                      style={{
                        width: '68%',
                        height: '84%',
                        border: `2px dashed ${TEAL}88`,
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                      }}
                    />
                  </div>
                  <p className="absolute bottom-3 inset-x-0 text-center text-[11px] text-white/70 font-medium">
                    Encaixe o rosto no círculo
                  </p>
                </div>

                <button
                  onClick={capture}
                  className="w-full py-3.5 rounded-xl font-bold text-[14px] text-slate-900 transition-transform active:scale-[0.98]"
                  style={{ background: TEAL }}
                >
                  Tirar foto
                </button>
              </motion.div>
            )}

            {/* ---------------- PREVIEW ---------------- */}
            {step === 'preview' && photo && (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="rounded-2xl overflow-hidden mb-5" style={{ aspectRatio: '1/1' }}>
                  <img src={photo} alt="Sua foto" className="w-full h-full object-cover" />
                </div>
                <p className="text-[12px] text-slate-400 text-center mb-5">
                  Seu rosto está nítido, centralizado e bem iluminado?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={restart}
                    className="flex-1 py-3.5 rounded-xl font-semibold text-[14px] text-white/70"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    Refazer
                  </button>
                  <button
                    onClick={() => submit(false)}
                    className="flex-1 py-3.5 rounded-xl font-bold text-[14px] text-slate-900 transition-transform active:scale-[0.98]"
                    style={{ background: TEAL }}
                  >
                    Enviar
                  </button>
                </div>
              </motion.div>
            )}

            {/* ---------------- ENVIANDO ---------------- */}
            {step === 'sending' && (
              <motion.div key="sending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="py-16 flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-full animate-spin"
                     style={{ border: `3px solid ${TEAL}22`, borderTopColor: TEAL }} />
                <p className="text-[13px] text-slate-400">Enviando sua foto…</p>
              </motion.div>
            )}

            {/* ---------------- ACOMPANHAMENTO ---------------- */}
            {step === 'tracking' && status && (
              <motion.div key="tracking" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

                {status.state === 'processing' && (
                  <div className="py-12 flex flex-col items-center gap-4">
                    <div className="w-10 h-10 rounded-full animate-spin"
                         style={{ border: `3px solid ${TEAL}22`, borderTopColor: TEAL }} />
                    <p className="text-[13px] text-slate-300 font-medium">Cadastrando nos leitores…</p>
                    <p className="text-[11px] text-slate-500 text-center max-w-[240px] leading-relaxed">
                      Isso leva alguns segundos. Você pode deixar esta tela aberta.
                    </p>
                  </div>
                )}

                {status.state === 'needs_approval' && (
                  <div className="rounded-2xl p-5 text-center"
                       style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.25)' }}>
                    <p className="text-[14px] font-bold text-yellow-300 mb-1.5">Aguardando liberação</p>
                    <p className="text-[12px] text-yellow-200/70 leading-relaxed">
                      Sua solicitação foi enviada e será liberada pela secretaria da igreja.
                      Você não precisa fazer mais nada.
                    </p>
                  </div>
                )}

                {status.state === 'done' && (
                  <div className="rounded-2xl p-6 text-center"
                       style={{ background: `${TEAL}12`, border: `1px solid ${TEAL}40` }}>
                    <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
                         style={{ background: `${TEAL}22` }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.5" className="w-7 h-7">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <p className="text-[15px] font-bold text-white mb-1.5">Cadastro concluído</p>
                    <p className="text-[12px] text-slate-400 leading-relaxed">
                      Seu rosto foi registrado. A partir do próximo culto sua presença será
                      marcada automaticamente.
                    </p>
                  </div>
                )}

                {(status.state === 'failed' || status.state === 'partial') && (
                  <div>
                    <div className="rounded-2xl p-5 mb-4"
                         style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
                      <p className="text-[14px] font-bold text-red-300 mb-1.5">
                        {status.state === 'partial' ? 'Cadastro incompleto' : 'Não deu certo'}
                      </p>
                      <p className="text-[12px] text-red-200/75 leading-relaxed">
                        {status.message || 'Não foi possível concluir o cadastro.'}
                      </p>
                    </div>

                    {/* Detalhe por leitor — importante quando a igreja tem
                        mais de uma entrada e só uma falhou */}
                    {status.devices.length > 1 && (
                      <div className="rounded-xl overflow-hidden mb-4"
                           style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                        {status.devices.map((d) => (
                          <div key={d.id}
                               className="flex items-center justify-between px-4 py-2.5 text-[12px]"
                               style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <span className="text-slate-400">{d.device}</span>
                            <span style={{ color: d.status === 'done' ? TEAL : '#fca5a5' }}>
                              {d.status === 'done' ? 'OK' : 'Falhou'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-3">
                      {status.canRetry && (
                        <button
                          onClick={restart}
                          className="flex-1 py-3.5 rounded-xl font-bold text-[14px] text-slate-900"
                          style={{ background: TEAL }}
                        >
                          Tirar outra foto
                        </button>
                      )}
                      {status.canUpdate && (
                        <button
                          onClick={() => submit(true)}
                          className="flex-1 py-3.5 rounded-xl font-semibold text-[13px] text-white/80"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                        >
                          Atualizar minha foto
                        </button>
                      )}
                    </div>

                    {!status.canRetry && !status.canUpdate && (
                      <p className="text-[11px] text-slate-500 text-center mt-4 leading-relaxed">
                        Procure a secretaria da igreja para concluir seu cadastro.
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MembroShell>
  );
}
