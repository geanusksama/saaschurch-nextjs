/**
 * GET /api/public/home-config — configuração da home pública, sem autenticação.
 *
 * Esta rota alimenta a página mais acessada do sistema, então ela tem uma regra
 * acima de qualquer outra: NUNCA falha. Banco fora, campo inexistente, tabela
 * ainda não migrada — em todos os casos devolve o conteúdo padrão com
 * `fallback: true` em vez de um 500 que deixaria a igreja sem home.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolvePublicCampoId } from "@/lib/penielCampo";
import { loadHomePayload } from "@/lib/homeConfigServer";
import { DEFAULT_HOME_PAYLOAD } from "@/lib/homeConfig";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const campoId = await resolvePublicCampoId({
      campoId: searchParams.get("campoId"),
      campo: searchParams.get("campo"),
    });

    const payload = await loadHomePayload(campoId);

    return NextResponse.json(
      { campoId, ...payload },
      {
        headers: {
          // Sem cache, de propósito.
          //
          // Antes eram 60 s de cache + 300 s de stale-while-revalidate. Parecia
          // barato — a configuração muda uma vez por ano —, mas quebrava o
          // fluxo de quem edita: a pessoa ocultava um cartão, salvava, abria a
          // home e continuava vendo o cartão por até 5 minutos. Sem jeito de
          // saber se tinha salvado errado ou se era cache.
          //
          // O custo real de largar o cache é UMA consulta por chave única
          // (home_configs.campo_id) por carregamento da home. É menos do que a
          // própria página já faz para montar a tela.
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[GET /api/public/home-config]", error);
    return NextResponse.json(
      { campoId: null, ...DEFAULT_HOME_PAYLOAD, fallback: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
