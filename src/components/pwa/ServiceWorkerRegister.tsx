"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Registra o service worker e avisa quando sai uma versão nova do sistema.
 *
 * Como o ciclo funciona:
 *  1. registramos /sw.js?v=<NEXT_PUBLIC_BUILD_ID>. A cada deploy o build id
 *     muda, então o navegador vê um script diferente e instala o SW novo;
 *  2. o SW novo NÃO chama skipWaiting — ele fica parado em `waiting`, para não
 *     recarregar a tela de quem está preenchendo um formulário;
 *  3. quando existe um `waiting` E já existe um controller (ou seja: não é a
 *     primeira visita, é mesmo uma atualização), mostramos o banner;
 *  4. no clique, mandamos 'skip-waiting' e recarregamos assim que o SW novo
 *     assume (`controllerchange`).
 *
 * O banner mostra o que mudou: lê /novidades.json direto do servidor (sem
 * cache), que já é o arquivo da versão NOVA. A lista fica recolhida atrás de
 * "Ver o que mudou"; quem não quiser ler só toca em Atualizar.
 *
 * Fica fora do dev de propósito: o SW guardaria os bundles de /_next/static e
 * o hot reload passaria a servir código velho.
 */

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
// de quanto em quanto tempo perguntamos ao servidor se há versão nova
const INTERVALO_CHECAGEM = 30 * 60 * 1000;

type Novidades = { data: string; titulo: string; itens: string[] };

/** Sessão do painel aberta neste navegador (mesmo token que o app usa nas APIs). */
function estaLogado(): boolean {
  try {
    return !!localStorage.getItem("mrm_token");
  } catch {
    return false;
  }
}

/** Primeira entrada de /novidades.json (a versão mais recente). Falha = null. */
async function carregarNovidades(): Promise<Novidades | null> {
  try {
    const r = await fetch(`/novidades.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    const v = Array.isArray(j?.versoes) ? j.versoes[0] : null;
    const itens = Array.isArray(v?.itens) ? v.itens.map(String).filter(Boolean) : [];
    return itens.length ? { data: String(v.data ?? ""), titulo: String(v.titulo ?? ""), itens } : null;
  } catch {
    return null;
  }
}

export function ServiceWorkerRegister() {
  const [aguardando, setAguardando] = useState<ServiceWorker | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [novidades, setNovidades] = useState<Novidades | null>(null);
  const [verLista, setVerLista] = useState(false);
  const recarregou = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let registro: ServiceWorkerRegistration | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;

    // só é "atualização" se já havia um SW no comando; na primeira visita o
    // waiting é a instalação inicial e não deve incomodar ninguém
    const anunciar = (sw: ServiceWorker | null) => {
      if (sw && navigator.serviceWorker.controller) setAguardando(sw);
    };

    const aoTrocarController = () => {
      if (recarregou.current) return; // controllerchange dispara mais de uma vez
      recarregou.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", aoTrocarController);

    const aoVoltarPraAba = () => {
      if (document.visibilityState === "visible") registro?.update().catch(() => {});
    };

    const registrar = async () => {
      try {
        registro = await navigator.serviceWorker.register(`/sw.js?v=${BUILD_ID}`);
      } catch {
        return; // sem SW o site continua funcionando, só não instala nem avisa
      }

      anunciar(registro.waiting);

      registro.addEventListener("updatefound", () => {
        const novo = registro?.installing;
        if (!novo) return;
        novo.addEventListener("statechange", () => {
          if (novo.state === "installed") anunciar(novo);
        });
      });

      timer = setInterval(() => registro?.update().catch(() => {}), INTERVALO_CHECAGEM);
      document.addEventListener("visibilitychange", aoVoltarPraAba);
    };

    // depois do load para não disputar banda com o primeiro render
    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar, { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", aoTrocarController);
      document.removeEventListener("visibilitychange", aoVoltarPraAba);
      if (timer) clearInterval(timer);
    };
  }, []);

  // banner apareceu: busca a lista do que mudou na versão nova
  useEffect(() => {
    if (!aguardando) return;
    let ativo = true;
    carregarNovidades().then((n) => { if (ativo) setNovidades(n); });
    return () => { ativo = false; };
  }, [aguardando]);

  const atualizar = useCallback(() => {
    if (!aguardando) return;
    setAtualizando(true);
    aguardando.postMessage("skip-waiting");
    // rede ruim ou SW travado: não deixa o botão girando para sempre
    setTimeout(() => {
      if (!recarregou.current) window.location.reload();
    }, 4000);
  }, [aguardando]);

  // Só para quem está logado (equipe). O visitante do site público não vê o
  // aviso: recebe a versão nova sozinho na próxima vez que abrir o site.
  if (!aguardando || !estaLogado()) return null;

  return (
    <div
      role="status"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-emerald-500/30 bg-slate-900/95 text-white shadow-2xl backdrop-blur-sm p-4"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Nova versão disponível</p>
          <p className="text-[11px] leading-snug text-slate-400">Atualize para receber as novidades.</p>
        </div>

        <button
          onClick={() => setAguardando(null)}
          className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-400 hover:bg-white/5"
        >
          Depois
        </button>
        <button
          onClick={atualizar}
          disabled={atualizando}
          className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold shadow-md hover:bg-emerald-700 disabled:opacity-50"
        >
          {atualizando ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {novidades && (
        <div className="mt-2 border-t border-white/10 pt-2">
          <button
            type="button"
            onClick={() => setVerLista((v) => !v)}
            aria-expanded={verLista}
            className="flex w-full items-center gap-1.5 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className={`h-3.5 w-3.5 transition-transform ${verLista ? "rotate-90" : ""}`}
            >
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.17 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
            </svg>
            {verLista ? "Ocultar novidades" : `Ver o que mudou (${novidades.itens.length})`}
          </button>
          {verLista && (
            <div className="mt-2 max-h-64 overflow-y-auto pr-1">
              {novidades.titulo && <p className="text-xs font-semibold text-white">{novidades.titulo}</p>}
              <ul className="mt-1.5 space-y-1.5">
                {novidades.itens.map((item, i) => (
                  <li key={i} className="flex gap-2 text-[11px] leading-snug text-slate-300">
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
