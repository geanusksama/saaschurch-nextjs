"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Html5Qrcode } from "html5-qrcode";
import { AlertTriangle, Camera, CameraOff, CheckCircle2, Crown, Droplets, Loader2, Lock, QrCode, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "../../lib/secretariaHooks";
import { apiBase } from "../../lib/apiBase";

type ScanMode = "baptism" | "consecration";

type ScanCard = {
  id: string;
  protocol: string;
  mode: ScanMode | null;
  member?: { id: string; fullName: string; rol?: number | null; phone?: string | null; mobile?: string | null; birthDate?: string | null; ecclesiasticalTitle?: string | null; membershipStatus?: string | null } | null;
  church?: { id: string; name: string; code?: string | null; regional?: { name?: string | null } | null } | null;
  service?: { description?: string | null; sigla?: string | null } | null;
  statusLabel?: string | null;
  columnIndex: number;
  openedAt?: string | null;
  observations?: string | null;
  confirmLabel?: string | null;
  abandonLabel?: string | null;
  requiredStageLabel?: string | null;
  canConfirm: boolean;
  blockedReason?: string | null;
  alreadyConfirmed: boolean;
  alreadyAbandoned: boolean;
};

const SCANNER_ID = "mrm-secretaria-qr-reader";

const MODE_UI: Record<ScanMode, { label: string; confirm: string; abandon: string; Icon: typeof Droplets; accent: string; ring: string }> = {
  baptism: {
    label: "Batismo",
    confirm: "Batizar",
    abandon: "Abandonar",
    Icon: Droplets,
    accent: "bg-blue-600 hover:bg-blue-700",
    ring: "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  },
  consecration: {
    label: "Consagração",
    confirm: "Consagrar",
    abandon: "Abandonar",
    Icon: Crown,
    accent: "bg-amber-600 hover:bg-amber-700",
    ring: "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR");
}

export function QrScanReader() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<ScanMode>("baptism");
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<"confirm" | "abandon" | null>(null);
  const [card, setCard] = useState<ScanCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ action: "confirm" | "abandon"; message: string } | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const cooldownRef = useRef<Record<string, number>>({});

  const lookup = useCallback(async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;
    // O scanner dispara várias vezes com o mesmo código; segura a repetição.
    const now = Date.now();
    if (cooldownRef.current[code] && now - cooldownRef.current[code] < 3000) return;
    cooldownRef.current[code] = now;
    if (busyRef.current) return;

    busyRef.current = true;
    setLoading(true);
    setError(null);
    setDone(null);
    try {
      const data = await authFetch<ScanCard>(`${apiBase}/ecclesiastical/scan?code=${encodeURIComponent(code)}`);
      setCard(data);
      if (data.mode && data.mode !== mode) setMode(data.mode);
    } catch (e) {
      setCard(null);
      setError(e instanceof Error ? e.message : "Não foi possível ler este QR Code.");
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, [mode]);

  // Deep link da câmera nativa do celular: /app-ui/qr-reader?c=<cardId>
  useEffect(() => {
    const deepLink = searchParams.get("c");
    // A busca depende da URL, então só pode sair depois da montagem — e roda uma vez só.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (deepLink) void lookup(deepLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop();
        await scanner.clear();
      } catch { /* ignora */ }
    }
    scannerRef.current = null;
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCamError(null);
    try {
      const scanner = new Html5Qrcode(SCANNER_ID, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => { void lookup(decodedText); },
        () => { /* ignora falhas de frame */ },
      );
      setScanning(true);
    } catch {
      setCamError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
      setScanning(false);
    }
  }, [lookup]);

  useEffect(() => {
    return () => { void stopCamera(); };
  }, [stopCamera]);

  async function runAction(action: "confirm" | "abandon") {
    if (!card) return;
    setActing(action);
    try {
      const data = await authFetch<{ ok?: boolean; alreadyDone?: boolean; message: string; card: ScanCard }>(
        `${apiBase}/ecclesiastical/scan`,
        { method: "POST", body: JSON.stringify({ code: card.id, action, mode }) },
      );
      setCard(data.card);
      setDone({ action, message: data.message });
      if (data.alreadyDone) toast.info(data.message);
      else toast.success(data.message);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao registrar a ação.";
      setError(message);
      toast.error(message);
    } finally {
      setActing(null);
    }
  }

  function reset() {
    setCard(null);
    setError(null);
    setDone(null);
    setManualCode("");
  }

  const ui = MODE_UI[mode];
  const wrongMode = card?.mode && card.mode !== mode;
  const confirmDisabled = !card || Boolean(wrongMode) || !card.canConfirm || card.alreadyConfirmed || acting !== null;
  const abandonDisabled = !card || Boolean(wrongMode) || card.alreadyAbandoned || card.alreadyConfirmed || acting !== null;

  return (
    <div className="space-y-4 p-6 text-slate-900 dark:text-slate-100">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
          <QrCode className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ler QR Code</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Confirme batismos e consagrações lendo o canhoto do candidato</p>
        </div>
      </div>

      {/* Seletor de modo */}
      <div className="flex flex-wrap gap-3">
        {(Object.keys(MODE_UI) as ScanMode[]).map((value) => {
          const item = MODE_UI[value];
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => { setMode(value); reset(); }}
              className={`flex items-center gap-2 rounded-xl border-2 px-5 py-3 text-sm font-semibold transition-all ${
                active ? item.ring : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400"
              }`}
            >
              <item.Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Câmera */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 font-bold text-slate-800 dark:text-white">Leitor</h3>
          <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
            {/* Nó "folha" para o html5-qrcode — o React nunca renderiza filhos aqui dentro */}
            <div id={SCANNER_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
            {!scanning ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-slate-400">
                <Camera className="h-8 w-8" />
                Câmera desligada
              </div>
            ) : null}
          </div>

          {camError ? <p className="mt-2 text-xs text-rose-600">{camError}</p> : null}

          <div className="mt-4 flex justify-center gap-2">
            {!scanning ? (
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                <Camera className="h-4 w-4" /> Ligar câmera
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
              >
                <CameraOff className="h-4 w-4" /> Desligar
              </button>
            )}
          </div>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => { event.preventDefault(); void lookup(manualCode); }}
          >
            <input
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="Protocolo impresso no canhoto"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm uppercase tracking-wide text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <button
              type="submit"
              disabled={loading || !manualCode.trim()}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900 disabled:opacity-50"
            >
              Buscar
            </button>
          </form>
        </div>

        {/* Resultado */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-white">Conferência</h3>
            {card ? (
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Ler outro
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="flex items-center gap-3 py-8 text-slate-500 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Consultando o registro...
            </div>
          ) : null}

          {!loading && !card && !error ? (
            <p className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
              Aponte a câmera para o QR Code do canhoto de {ui.label.toLowerCase()} ou digite o protocolo.
            </p>
          ) : null}

          {!loading && error ? (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950/30">
              <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-400">
                <XCircle className="h-5 w-5" /> Não foi possível continuar
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{error}</p>
            </div>
          ) : null}

          {!loading && card ? (
            <div className="space-y-4">
              <div>
                <p className="text-lg font-bold uppercase text-slate-900 dark:text-white">
                  {card.member?.fullName || "Membro não vinculado"}
                </p>
                <p className="text-xs font-semibold text-purple-600">{card.protocol}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="ROL" value={card.member?.rol ? String(card.member.rol) : "—"} />
                <Info label="Título" value={card.member?.ecclesiasticalTitle || "—"} />
                <Info label="Igreja" value={`${card.church?.code ? `${card.church.code} - ` : ""}${card.church?.name || "—"}`} />
                <Info label="Regional" value={card.church?.regional?.name || "—"} />
                <Info label="Serviço" value={card.service?.description || "—"} />
                <Info label="Etapa atual" value={card.statusLabel || "—"} />
                <Info label="Nascimento" value={formatDate(card.member?.birthDate)} />
                <Info label="Aberto em" value={formatDate(card.openedAt)} />
              </div>

              {card.observations ? (
                <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {card.observations}
                </div>
              ) : null}

              {done ? (
                <div className={`rounded-xl border p-4 ${
                  done.action === "confirm"
                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                    : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                }`}>
                  <div className={`flex items-center gap-2 font-bold ${done.action === "confirm" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                    <CheckCircle2 className="h-5 w-5" /> {done.message}
                  </div>
                </div>
              ) : null}

              {wrongMode ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  Este QR Code é de {MODE_UI[card.mode as ScanMode].label}. Troque o leitor para {MODE_UI[card.mode as ScanMode].label} antes de continuar.
                </div>
              ) : null}

              {!wrongMode && card.blockedReason ? (
                <div className="flex items-start gap-2 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <Lock className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  {card.blockedReason}
                </div>
              ) : null}

              {!wrongMode && card.alreadyConfirmed ? (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  Já está em &quot;{card.statusLabel}&quot;.
                </div>
              ) : null}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => runAction("confirm")}
                  disabled={confirmDisabled}
                  title={card.blockedReason || undefined}
                  className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${ui.accent}`}
                >
                  {acting === "confirm" ? "Registrando..." : ui.confirm}
                </button>
                <button
                  type="button"
                  onClick={() => runAction("abandon")}
                  disabled={abandonDisabled}
                  className="flex-1 rounded-lg border border-rose-300 px-4 py-3 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:text-rose-400"
                >
                  {acting === "abandon" ? "Registrando..." : ui.abandon}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 pb-1 dark:border-slate-800">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-medium text-slate-800 dark:text-slate-200">{value}</p>
    </div>
  );
}

export default QrScanReader;
