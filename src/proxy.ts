import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Reescrita das URLs curtas dos departamentos.
 *
 *   /jovens  →  /dep/jovens
 *
 * A raiz do app é um catch-all do SPA (`app/(spa)/[[...slug]]`), então não dá
 * para declarar `/[slug]` como rota — daria conflito no build. A reescrita
 * acontece antes do roteamento: o visitante vê `/jovens`, o Next renderiza
 * `/dep/jovens`.
 *
 * A lista de slugs publicados fica em memória por alguns minutos, para não
 * consultar o banco a cada request. Caminho que não seja de departamento cai
 * no SPA, como antes.
 */
const TTL_MS = 5 * 60 * 1000;

let slugsPublicados = new Set<string>();
let carregadoEm = 0;
let carregando: Promise<void> | null = null;

/** Caminhos de um segmento que nunca são slug de departamento. */
const RESERVADOS = new Set([
  "api", "app-ui", "auth", "login", "logout", "admin", "dep", "_next",
  "favicon.ico", "robots.txt", "sitemap.xml", "manifest.json", "membro",
  "peniel", "public", "assets", "images", "icons",
]);

async function atualizarSlugs(origin: string) {
  try {
    const r = await fetch(`${origin}/api/public/dept-slugs`, { cache: "no-store" });
    if (!r.ok) return;
    const json = (await r.json()) as { slugs?: string[] };
    slugsPublicados = new Set((json.slugs ?? []).map((s) => s.toLowerCase()));
    carregadoEm = Date.now();
  } catch {
    // Falha na atualização não derruba o site: segue com a lista anterior e
    // tenta de novo no próximo request.
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;
  const response = NextResponse.next();

  // Security headers on every response
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Câmera liberada para a própria origem (leitor de QR do check-in Peniel);
  // microfone e geolocalização seguem bloqueados.
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Allow all static files, Next.js internals, and API routes to pass through.
  // Page auth is handled client-side by the React SPA (mrm_token in localStorage).
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2)$/)
  ) {
    return response;
  }

  // ── Página pública de departamento ────────────────────────────────────
  const partes = pathname.split("/").filter(Boolean);
  if (partes.length === 1) {
    const slug = partes[0].toLowerCase();

    if (!RESERVADOS.has(slug) && !slug.includes(".")) {
      // Atualiza a lista quando vencida, uma atualização por vez. Nunca
      // bloqueia o request: um slug novo passa a valer no request seguinte.
      // (Esperar aqui trava o dev server, que atende a busca na mesma thread.)
      if (Date.now() - carregadoEm > TTL_MS && !carregando) {
        carregando = atualizarSlugs(origin).finally(() => { carregando = null; });
      }

      if (slugsPublicados.has(slug)) {
        const url = request.nextUrl.clone();
        url.pathname = `/dep/${slug}`;
        return NextResponse.rewrite(url, { headers: response.headers });
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
