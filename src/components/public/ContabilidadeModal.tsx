import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calculator, Lock, Loader2, X, ShieldAlert, Download, CheckCircle2, KeyRound, Phone } from 'lucide-react';
import { apiBase } from '../../lib/apiBase';

type Etapa = 'credenciais' | 'codigo' | 'filtro' | 'bloqueado';

interface Props {
  open: boolean;
  onClose: () => void;
}

function maskTelefone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function primeiroDiaDoAno() {
  return `${new Date().getFullYear()}-01-01`;
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ContabilidadeModal({ open, onClose }: Props) {
  const [etapa, setEtapa] = useState<Etapa>('credenciais');
  const [telefone, setTelefone] = useState('');
  const [hash, setHash] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [otpToken, setOtpToken] = useState('');
  const [phoneMask, setPhoneMask] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [nome, setNome] = useState('');

  const [dataInicio, setDataInicio] = useState(primeiroDiaDoAno);
  const [dataFim, setDataFim] = useState(hojeIso);

  // Geracao do CSV — a tela inteira trava enquanto roda
  const [gerando, setGerando] = useState(false);
  const [percent, setPercent] = useState(0);
  const [carregados, setCarregados] = useState(0);
  const [totalLinhas, setTotalLinhas] = useState(0);
  const [concluido, setConcluido] = useState<{ filename: string; total: number } | null>(null);
  const gerandoRef = useRef(false);

  const resetar = useCallback(() => {
    setEtapa('credenciais');
    setTelefone('');
    setHash('');
    setCodigo('');
    setErro(null);
    setLoading(false);
    setOtpToken('');
    setPhoneMask('');
    setSessionToken('');
    setNome('');
    setDataInicio(primeiroDiaDoAno());
    setDataFim(hojeIso());
    setGerando(false);
    setPercent(0);
    setCarregados(0);
    setTotalLinhas(0);
    setConcluido(null);
    gerandoRef.current = false;
  }, []);

  useEffect(() => {
    if (open) resetar();
  }, [open, resetar]);

  // Uma vez aberto, o modal fica fixo: ESC nao fecha (o gatilho da home sao 7
  // toques — se um toque a mais fechasse a tela, o contador teria de recomecar).
  // Sair so pelo X, e nem ele durante a geracao.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.preventDefault();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!gerandoRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [open]);

  function fechar() {
    if (gerando) return; // nunca fecha no meio da geracao
    onClose();
  }

  // ── Etapa 1: telefone + hash ───────────────────────────────────────────────
  async function enviarCredenciais(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErro(null);
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/contabilidade/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: telefone.replace(/\D/g, ''), hash: hash.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error || 'Nao foi possivel validar o acesso.');
        if (json.blocked) setEtapa('bloqueado');
        return;
      }
      setOtpToken(json.otp_token);
      setPhoneMask(json.phone_mask || '');
      setCodigo('');
      setEtapa('codigo');
    } catch {
      setErro('Falha de conexao. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  // ── Etapa 2: codigo do WhatsApp ────────────────────────────────────────────
  async function enviarCodigo(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErro(null);
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/contabilidade/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_token: otpToken, code: codigo.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error || 'Codigo invalido.');
        if (json.blocked) setEtapa('bloqueado');
        if (json.expired) setEtapa('credenciais');
        return;
      }
      setSessionToken(json.session_token);
      setNome(json.nome || '');
      setEtapa('filtro');
    } catch {
      setErro('Falha de conexao. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  // ── Etapa 3: gerar CSV com progresso ───────────────────────────────────────
  async function gerar() {
    if (gerandoRef.current) return; // trava contra duplo clique
    setErro(null);
    setConcluido(null);
    setPercent(0);
    setCarregados(0);
    setTotalLinhas(0);
    gerandoRef.current = true;
    setGerando(true);

    try {
      const res = await fetch(`${apiBase}/contabilidade/relatorio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: sessionToken, data_inicio: dataInicio, data_fim: dataFim }),
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        setErro(json.error || 'Nao foi possivel gerar o relatorio.');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const linhas = buffer.split('\n');
        buffer = linhas.pop() ?? '';

        for (const linha of linhas) {
          if (!linha.trim()) continue;
          const evt = JSON.parse(linha);

          if (evt.type === 'start') {
            setTotalLinhas(evt.total);
          } else if (evt.type === 'progress') {
            setPercent(evt.percent);
            setCarregados(evt.loaded);
            setTotalLinhas(evt.total);
          } else if (evt.type === 'error') {
            setErro(evt.error);
          } else if (evt.type === 'done') {
            setPercent(100);
            setCarregados(evt.total);
            baixarCsv(evt.csv, evt.filename);
            setConcluido({ filename: evt.filename, total: evt.total });
          }
        }
      }
    } catch {
      setErro('A conexao caiu durante a geracao. Tente novamente.');
    } finally {
      gerandoRef.current = false;
      setGerando(false);
    }
  }

  function baixarCsv(csv: string, filename: string) {
    // BOM para o Excel abrir com acentuacao correta
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  if (!open) return null;

  const inputCls =
    'w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-slate-500 ' +
    'outline-none focus:border-amber-400/60 focus:bg-white/10 transition-colors disabled:opacity-50';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[210] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.97 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1220] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                style={{ borderColor: '#38bdf8', background: 'rgba(56,189,248,0.1)' }}
              >
                <Calculator className="w-5 h-5" style={{ color: '#38bdf8' }} />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg leading-tight">Relatorio Contabil</h2>
                <p className="text-xs text-slate-400">
                  {etapa === 'filtro' && nome ? nome : 'Acesso exclusivo da contabilidade'}
                </p>
              </div>
            </div>
            {!gerando && (
              <button onClick={fechar} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="px-6 py-6">
            {/* ── Bloqueado ─────────────────────────────────────────────── */}
            {etapa === 'bloqueado' && (
              <div className="text-center py-4">
                <ShieldAlert className="w-12 h-12 mx-auto text-red-400 mb-4" />
                <h3 className="text-white font-bold mb-2">Acesso bloqueado</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {erro || 'Este acesso foi desativado apos 3 tentativas invalidas. Procure a secretaria da igreja para reativar.'}
                </p>
                <button
                  onClick={fechar}
                  className="mt-6 w-full rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold py-3 transition-colors"
                >
                  Fechar
                </button>
              </div>
            )}

            {/* ── Etapa 1: credenciais ──────────────────────────────────── */}
            {etapa === 'credenciais' && (
              <form onSubmit={enviarCredenciais} className="space-y-4">
                <p className="text-sm text-slate-400 leading-relaxed">
                  Informe o telefone e o hash de acesso. Um codigo de confirmacao sera enviado no seu WhatsApp.
                </p>

                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
                    <Phone className="w-3.5 h-3.5" /> Telefone (usuario)
                  </label>
                  <input
                    value={maskTelefone(telefone)}
                    onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ''))}
                    placeholder="(19) 99999-9999"
                    inputMode="numeric"
                    autoFocus
                    disabled={loading}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
                    <KeyRound className="w-3.5 h-3.5" /> Hash (senha)
                  </label>
                  <input
                    value={hash}
                    onChange={(e) => setHash(e.target.value)}
                    placeholder="XXXXX-XXXXX"
                    autoComplete="off"
                    disabled={loading}
                    className={`${inputCls} tracking-widest uppercase`}
                  />
                </div>

                {erro && <p className="text-xs text-red-400 leading-relaxed">{erro}</p>}

                <button
                  type="submit"
                  disabled={loading || telefone.length < 10 || !hash.trim()}
                  className="w-full rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 text-white text-sm font-semibold py-3 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  {loading ? 'Validando...' : 'Receber codigo no WhatsApp'}
                </button>

                <p className="text-[11px] text-slate-500 text-center">
                  3 tentativas invalidas bloqueiam o acesso.
                </p>
              </form>
            )}

            {/* ── Etapa 2: codigo ───────────────────────────────────────── */}
            {etapa === 'codigo' && (
              <form onSubmit={enviarCodigo} className="space-y-4">
                <p className="text-sm text-slate-400 leading-relaxed">
                  Enviamos um codigo de 6 digitos para <strong className="text-white">{phoneMask}</strong> no WhatsApp.
                </p>

                <input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  autoFocus
                  disabled={loading}
                  className={`${inputCls} text-center text-2xl tracking-[0.5em] font-bold`}
                />

                {erro && <p className="text-xs text-red-400 leading-relaxed">{erro}</p>}

                <button
                  type="submit"
                  disabled={loading || codigo.length !== 6}
                  className="w-full rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 text-white text-sm font-semibold py-3 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {loading ? 'Conferindo...' : 'Confirmar codigo'}
                </button>

                <button
                  type="button"
                  onClick={() => { setEtapa('credenciais'); setErro(null); }}
                  disabled={loading}
                  className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Voltar
                </button>
              </form>
            )}

            {/* ── Etapa 3: filtro + geracao ─────────────────────────────── */}
            {etapa === 'filtro' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">Data inicial</label>
                    <input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      disabled={gerando}
                      className={`${inputCls} [color-scheme:dark]`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">Data final</label>
                    <input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      disabled={gerando}
                      className={`${inputCls} [color-scheme:dark]`}
                    />
                  </div>
                </div>

                {gerando && (
                  <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                      <span className="text-sm text-white font-semibold">Gerando relatorio...</span>
                      <span className="ml-auto text-sm font-bold text-sky-400">{percent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-sky-400 transition-[width] duration-300 ease-out"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">
                      {carregados.toLocaleString('pt-BR')} de {totalLinhas.toLocaleString('pt-BR')} lancamentos
                    </p>
                    <p className="mt-1 text-[11px] text-amber-400/80">
                      Nao feche nem atualize esta tela ate concluir.
                    </p>
                  </div>
                )}

                {concluido && !gerando && (
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm text-white font-semibold">Relatorio gerado</p>
                      <p className="text-[11px] text-slate-400 break-all">
                        {concluido.total.toLocaleString('pt-BR')} lancamentos — {concluido.filename}
                      </p>
                    </div>
                  </div>
                )}

                {erro && <p className="text-xs text-red-400 leading-relaxed">{erro}</p>}

                <button
                  onClick={gerar}
                  disabled={gerando || !dataInicio || !dataFim}
                  className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-white text-sm font-semibold py-3 transition-colors flex items-center justify-center gap-2"
                >
                  {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {gerando ? 'Gerando...' : concluido ? 'Gerar novamente' : 'Gerar CSV'}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
