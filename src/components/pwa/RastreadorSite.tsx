"use client";

import { useEffect } from "react";

/**
 * Rastreador do site público — páginas vistas e cliques, para o painel
 * Sistema → Rastreador do site (src/lib/siteRastreio.ts).
 *
 * Só páginas públicas: painel (/app-ui), login e links pessoais com código
 * ficam de fora (mesma regra no servidor, caminhoRastreavel). Sem dado
 * pessoal: visitante = número aleatório no navegador; sessão = 30 min.
 * Envio em lote por sendBeacon (não atrasa a página nem o clique).
 */

const ENDPOINT = "/api/public/site-eventos";
const SESSAO_MS = 30 * 60_000;
const BLOQUEADO = /^\/(app-ui|auth|api|pending-activation|design-system|membro|campanha|gf-resumo|pastoral\/timeline)(\/|$)/;

type Evento = { tipo: "pagina" | "clique"; caminho: string; titulo?: string; alvo?: string; alvoUrl?: string };

function id(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; }
}

function ler(store: Storage | undefined, chave: string): string | null {
  try { return store?.getItem(chave) ?? null; } catch { return null; }
}
function gravar(store: Storage | undefined, chave: string, valor: string) {
  try { store?.setItem(chave, valor); } catch { /* modo privado */ }
}

// a origem (referrer/utm) só vale para a PRIMEIRA sessão desta aba: depois de
// 30 min parado, a sessão nova é continuação, não uma nova vinda do Google
let primeiraSessaoDaAba = true

/** Visitante (fixo no navegador) e sessão (renova após 30 min parado), com a origem da entrada. */
function contexto() {
  const ls = typeof localStorage !== "undefined" ? localStorage : undefined;
  const ss = typeof sessionStorage !== "undefined" ? sessionStorage : undefined;
  let visitante = ler(ls, "mrm_visitante");
  if (!visitante) { visitante = id(); gravar(ls, "mrm_visitante", visitante); }

  const agora = Date.now();
  const ultimo = Number(ler(ss, "mrm_sessao_em") || 0);
  let sessao = ler(ss, "mrm_sessao");
  let origem = ler(ss, "mrm_sessao_origem");
  if (!sessao || agora - ultimo > SESSAO_MS) {
    sessao = id();
    const p = new URLSearchParams(window.location.search);
    const entrada = primeiraSessaoDaAba;
    origem = JSON.stringify({
      referrer: entrada ? document.referrer || null : null,
      utmSource: entrada ? p.get("utm_source") : null,
      utmMedium: entrada ? p.get("utm_medium") : null,
      utmCampaign: entrada ? p.get("utm_campaign") : null,
    });
    gravar(ss, "mrm_sessao", sessao);
    gravar(ss, "mrm_sessao_origem", origem);
  }
  primeiraSessaoDaAba = false;
  gravar(ss, "mrm_sessao_em", String(agora));
  return { visitante, sessao, ...(origem ? JSON.parse(origem) : {}) };
}

export function RastreadorSite() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let fila: Evento[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    let ultimoCaminho = "";

    const enviar = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!fila.length) return;
      const eventos = fila.slice(0, 20);
      fila = fila.slice(20);
      try {
        const corpo = JSON.stringify({ ...contexto(), eventos });
        const blob = new Blob([corpo], { type: "application/json" });
        if (!navigator.sendBeacon?.(ENDPOINT, blob)) {
          void fetch(ENDPOINT, { method: "POST", body: corpo, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
        }
      } catch { /* nunca atrapalha o site */ }
      if (fila.length) enviar();
    };
    const agendar = (e: Evento) => {
      if (BLOQUEADO.test(e.caminho)) return;
      fila.push(e);
      if (fila.length >= 10) enviar();
      else if (!timer) timer = setTimeout(enviar, 4000);
    };

    const paginaVista = () => {
      const caminho = window.location.pathname;
      if (caminho === ultimoCaminho) return;
      ultimoCaminho = caminho;
      // fixa a sessão e a origem AGORA, com o utm ainda na URL
      if (!BLOQUEADO.test(caminho)) contexto();
      // título atualiza depois da troca de rota do SPA
      setTimeout(() => agendar({ tipo: "pagina", caminho, titulo: document.title?.slice(0, 200) }), 300);
    };

    const aoClicar = (ev: MouseEvent) => {
      const el = (ev.target as HTMLElement | null)?.closest?.("a, button, [role=button], [data-rastreio]") as HTMLElement | null;
      if (!el) return;
      const rotulo = (el.getAttribute("data-rastreio") || el.getAttribute("aria-label") || el.getAttribute("title") || el.innerText || "")
        .replace(/\s+/g, " ").trim().slice(0, 120);
      const href = el instanceof HTMLAnchorElement ? el.href : el.closest("a")?.href;
      agendar({ tipo: "clique", caminho: window.location.pathname, alvo: rotulo || undefined, alvoUrl: href?.slice(0, 400) });
      // link para fora: manda já, antes de sair da página
      if (href && !href.startsWith(window.location.origin)) enviar();
    };

    // SPA: troca de rota por pushState/replaceState/voltar
    const push = history.pushState;
    const replace = history.replaceState;
    history.pushState = function (...args) { const r = push.apply(this, args as Parameters<typeof push>); paginaVista(); return r; };
    history.replaceState = function (...args) { const r = replace.apply(this, args as Parameters<typeof replace>); paginaVista(); return r; };
    const aoVoltar = () => paginaVista();
    const aoSair = () => { if (document.visibilityState === "hidden") enviar(); };

    window.addEventListener("popstate", aoVoltar);
    document.addEventListener("click", aoClicar, true);
    document.addEventListener("visibilitychange", aoSair);
    window.addEventListener("pagehide", enviar);
    paginaVista();

    return () => {
      history.pushState = push;
      history.replaceState = replace;
      window.removeEventListener("popstate", aoVoltar);
      document.removeEventListener("click", aoClicar, true);
      document.removeEventListener("visibilitychange", aoSair);
      window.removeEventListener("pagehide", enviar);
      enviar();
    };
  }, []);
  return null;
}
