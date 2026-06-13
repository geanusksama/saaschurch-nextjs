"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { CheckCircle2, XCircle, AlertTriangle, Camera, CameraOff, QrCode, Loader2, Clock } from "lucide-react";
import { authFetch } from "../../lib/secretariaHooks";
import { apiBase } from "../../lib/apiBase";

type CheckResult = {
  result: "ok" | "already" | "waitlist" | "cancelled" | "not_found" | "error";
  registration?: any;
  event?: any;
  message?: string;
};

const SCANNER_ID = "peniel-qr-reader";

export default function PenielCheckIn() {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [last, setLast] = useState<CheckResult | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const cooldownRef = useRef<Record<string, number>>({});

  const doCheckIn = async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    // Evita reprocessar o mesmo código em janela curta (scanner dispara várias vezes)
    const now = Date.now();
    if (cooldownRef.current[clean] && now - cooldownRef.current[clean] < 4000) return;
    cooldownRef.current[clean] = now;

    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    try {
      const data = await authFetch<CheckResult>(`${apiBase}/peniel/checkin`, {
        method: "POST",
        body: JSON.stringify({ code: clean })
      });
      setLast(data);
    } catch (e: any) {
      setLast({ result: "not_found", message: e?.message || "Ingresso não encontrado." });
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  };

  const startCamera = async () => {
    setCamError(null);
    try {
      const scanner = new Html5Qrcode(SCANNER_ID, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => { doCheckIn(decodedText); },
        () => { /* ignora falhas de frame */ }
      );
      setScanning(true);
    } catch (e: any) {
      setCamError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
      setScanning(false);
    }
  };

  const stopCamera = async () => {
    const s = scannerRef.current;
    if (s) {
      try {
        if (s.isScanning) await s.stop();
        await s.clear();
      } catch { /* ignore */ }
    }
    scannerRef.current = null;
    setScanning(false);
  };

  useEffect(() => {
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doCheckIn(manualCode);
    setManualCode("");
  };

  const fmtDateTime = (d?: string) =>
    d ? new Date(d).toLocaleString("pt-BR") : "";

  // ── UI do resultado ──
  const renderResult = () => {
    if (loading) {
      return (
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Validando ingresso...
        </div>
      );
    }
    if (!last) {
      return (
        <div className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">
          Aponte a câmera para o QR Code do ingresso ou digite o código manualmente.
        </div>
      );
    }

    const nome = last.registration?.nome;
    const evt = last.event?.title;

    if (last.result === "ok") {
      return (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-lg">
            <CheckCircle2 className="w-6 h-6" /> Check-in confirmado!
          </div>
          <p className="mt-1 text-slate-800 dark:text-slate-200 font-semibold">{nome}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{evt} · {fmtDateTime(last.registration?.checkedInAt)}</p>
        </div>
      );
    }
    if (last.result === "already") {
      return (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-lg">
            <Clock className="w-6 h-6" /> Ingresso já utilizado
          </div>
          <p className="mt-1 text-slate-800 dark:text-slate-200 font-semibold">{nome}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Check-in feito em {fmtDateTime(last.registration?.checkedInAt)}</p>
        </div>
      );
    }
    if (last.result === "waitlist") {
      return (
        <div className="rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 p-4">
          <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 font-bold text-lg">
            <AlertTriangle className="w-6 h-6" /> Fila de espera
          </div>
          <p className="mt-1 text-slate-800 dark:text-slate-200 font-semibold">{nome}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Inscrição não confirmada (fila de espera). Verifique antes de liberar a entrada.</p>
        </div>
      );
    }
    // cancelled / not_found / error
    return (
      <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-4">
        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-lg">
          <XCircle className="w-6 h-6" /> {last.result === "cancelled" ? "Inscrição cancelada" : "Ingresso inválido"}
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {last.result === "cancelled"
            ? `${nome} — esta inscrição foi cancelada.`
            : (last.message || "Código não encontrado. Confira e tente novamente.")}
        </p>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Scanner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <QrCode className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-slate-800 dark:text-white">Leitor de QR Code</h3>
        </div>

        <div className="relative w-full aspect-square max-w-sm mx-auto rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          {/* Nó "folha" para o html5-qrcode — o React NUNCA renderiza filhos aqui dentro */}
          <div id={SCANNER_ID} className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover" />
          {/* Placeholder como overlay irmão (fora da div do scanner) */}
          {!scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 text-sm pointer-events-none">
              <Camera className="w-8 h-8" />
              Câmera desligada
            </div>
          )}
        </div>

        {camError && <p className="text-xs text-rose-600 mt-2">{camError}</p>}

        <div className="flex gap-2 mt-4 justify-center">
          {!scanning ? (
            <button
              onClick={startCamera}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
            >
              <Camera className="w-4 h-4" /> Ligar câmera
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-colors"
            >
              <CameraOff className="w-4 h-4" /> Desligar
            </button>
          )}
        </div>
      </div>

      {/* Resultado + código manual */}
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 min-h-[160px]">
          <h3 className="font-bold text-slate-800 dark:text-white mb-3">Resultado</h3>
          {renderResult()}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="font-bold text-slate-800 dark:text-white mb-1">Confirmação manual</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Caso o QR não seja lido, digite o código que está na mensagem do inscrito.
          </p>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              value={manualCode}
              onChange={e => setManualCode(e.target.value.toUpperCase())}
              placeholder="Ex: A1B2C3D4"
              maxLength={20}
              className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono tracking-widest uppercase bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={loading || !manualCode.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              Confirmar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
