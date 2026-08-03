/**
 * Descobre a qual campo pertence uma requisição pública.
 *
 * As páginas de departamento são endereçadas por slug (`/jovens`), e slug é
 * único por campo — não globalmente. Dois campos podem ter "jovens". Sem
 * resolver o tenant, um visitante de Campinas poderia cair na página de
 * Curitiba.
 *
 * Ordem de resolução:
 *   1. `?campo=` na URL (usado em preview e em links internos do app)
 *   2. host da requisição (adcampinas.com.br → campo Campinas)
 *   3. variável PUBLIC_DEFAULT_CAMPO_ID (instalação de campo único)
 *   4. null — a consulta então aceita qualquer campo (útil enquanto só há um)
 */
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** host → campo, resolvido uma vez por processo. */
const cacheHost = new Map<string, string | null>();

function normalizarHost(host: string) {
  return host.toLowerCase().split(":")[0].replace(/^www\./, "");
}

/**
 * Casa o host com o nome do campo: `adcampinas.com.br` → "Campinas".
 * Heurística deliberadamente simples; quando houver uma coluna de domínio em
 * `campos`, troque esta função por uma consulta direta.
 */
async function campoPorHost(host: string): Promise<string | null> {
  const limpo = normalizarHost(host);
  if (cacheHost.has(limpo)) return cacheHost.get(limpo)!;

  let resultado: string | null = null;
  const { data: campos } = await supabaseAdmin.from("campos").select("id, name");

  if (campos?.length) {
    const semPontos = limpo.replace(/\./g, "");
    // "adcampinas.com.br" contém "campinas"
    const achado = campos.find((c) => {
      const nome = (c.name || "").toLowerCase().replace(/\s+/g, "");
      return nome.length >= 4 && semPontos.includes(nome);
    });
    resultado = achado?.id ?? null;
  }

  cacheHost.set(limpo, resultado);
  return resultado;
}

export async function resolveCampoFromRequest(req: NextRequest): Promise<string | null> {
  const explicito = req.nextUrl.searchParams.get("campo");
  if (explicito) return explicito;

  const host = req.headers.get("host");
  if (host) {
    const porHost = await campoPorHost(host);
    if (porHost) return porHost;
  }

  return process.env.PUBLIC_DEFAULT_CAMPO_ID || null;
}
