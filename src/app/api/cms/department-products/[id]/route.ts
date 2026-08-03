import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { gravarFilhosDoProduto } from "@/lib/departmentProducts";

const PERFIS_CMS = ["master", "admin", "campo", "regional", "church"];

/** Campos do produto que o painel pode alterar, e o nome da coluna. */
const MAPA_CAMPOS: Record<string, string> = {
  nome: "nome",
  descricao: "descricao",
  descricaoCurta: "descricao_curta",
  categoria: "categoria",
  preco: "preco",
  precoPromocional: "preco_promocional",
  parcelasMax: "parcelas_max",
  fichaTecnica: "ficha_tecnica",
  tabelaMedidas: "tabela_medidas",
  estoqueTotal: "estoque_total",
  controlaEstoque: "controla_estoque",
  destaque: "destaque",
  ordem: "ordem",
  ativo: "ativo",
  paymentLink: "payment_link",
};

async function autorizar(req: NextRequest) {
  const user = await getAuthUser(req).catch(() => null);
  if (!user || !PERFIS_CMS.includes(user.profileType || "")) {
    return { erro: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) };
  }
  if (!user.campoId) {
    return { erro: NextResponse.json({ error: "Usuário sem campo definido." }, { status: 400 }) };
  }
  return { campoId: user.campoId };
}

/** Carrega o produto garantindo que ele é do campo do usuário. */
async function produtoDoCampo(id: string, campoId: string) {
  const { data } = await supabaseAdmin
    .from("department_products")
    .select("*")
    .eq("id", id).eq("campo_id", campoId).is("deleted_at", null)
    .maybeSingle();
  return data;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await autorizar(req);
  if (auth.erro) return auth.erro;
  const { id } = await ctx.params;

  const produto = await produtoDoCampo(id, auth.campoId!);
  if (!produto) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });

  const [{ data: imagens }, { data: variacoes }] = await Promise.all([
    supabaseAdmin.from("department_product_images").select("*").eq("product_id", id).order("ordem"),
    supabaseAdmin.from("department_product_variants").select("*").eq("product_id", id).order("ordem"),
  ]);

  return NextResponse.json({ produto: { ...produto, imagens: imagens ?? [], variacoes: variacoes ?? [] } });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await autorizar(req);
  if (auth.erro) return auth.erro;
  const { id } = await ctx.params;

  const produto = await produtoDoCampo(id, auth.campoId!);
  if (!produto) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });

  const body = await req.json();

  const patch: Record<string, unknown> = {};
  for (const [chaveApi, coluna] of Object.entries(MAPA_CAMPOS)) {
    if (body[chaveApi] === undefined) continue;
    const v = body[chaveApi];
    patch[coluna] =
      coluna === "preco_promocional" && (v === "" || v === null) ? null
      : coluna === "estoque_total" && (v === "" || v === null) ? null
      : v;
  }

  if (Object.keys(patch).length) {
    const { error } = await supabaseAdmin
      .from("department_products").update(patch)
      .eq("id", id).eq("campo_id", auth.campoId!);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await gravarFilhosDoProduto(id, auth.campoId!, body);

  const atualizado = await produtoDoCampo(id, auth.campoId!);
  return NextResponse.json({ produto: atualizado });
}

/**
 * DELETE — arquiva o produto (soft delete).
 *
 * Não removemos de verdade porque `department_order_items` guarda o vínculo
 * com pedidos já feitos; apagar quebraria o histórico de vendas.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await autorizar(req);
  if (auth.erro) return auth.erro;
  const { id } = await ctx.params;

  const { error } = await supabaseAdmin
    .from("department_products")
    .update({ deleted_at: new Date().toISOString(), ativo: false })
    .eq("id", id).eq("campo_id", auth.campoId!);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
