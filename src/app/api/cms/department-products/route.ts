import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { gravarFilhosDoProduto } from "@/lib/departmentProducts";

const PERFIS_CMS = ["master", "admin", "campo", "regional", "church"];

function slugify(s: string) {
  return s
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function autorizar(req: NextRequest) {
  const user = await getAuthUser(req).catch(() => null);
  if (!user || !PERFIS_CMS.includes(user.profileType || "")) {
    return { erro: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) };
  }
  if (!user.campoId) {
    return { erro: NextResponse.json({ error: "Usuário sem campo definido." }, { status: 400 }) };
  }
  return { user, campoId: user.campoId };
}

/**
 * GET /api/cms/department-products?departmentId=…
 *
 * Produtos de um departamento, com imagens e variações. Sempre restrito ao
 * campo do usuário — `supabaseAdmin` ignora RLS, então o filtro é explícito.
 */
export async function GET(req: NextRequest) {
  const auth = await autorizar(req);
  if (auth.erro) return auth.erro;

  const departmentId = req.nextUrl.searchParams.get("departmentId");
  if (!departmentId) {
    return NextResponse.json({ error: "departmentId é obrigatório." }, { status: 400 });
  }

  const { data: produtos, error } = await supabaseAdmin
    .from("department_products")
    .select("*")
    .eq("department_id", departmentId)
    .eq("campo_id", auth.campoId!)
    .is("deleted_at", null)
    .order("ordem")
    .order("nome");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!produtos?.length) return NextResponse.json({ produtos: [] });

  const ids = produtos.map((p) => p.id);
  const [{ data: imagens }, { data: variacoes }] = await Promise.all([
    supabaseAdmin.from("department_product_images").select("*").in("product_id", ids).order("ordem"),
    supabaseAdmin.from("department_product_variants").select("*").in("product_id", ids).order("ordem"),
  ]);

  return NextResponse.json({
    produtos: produtos.map((p) => ({
      ...p,
      imagens: (imagens ?? []).filter((i) => i.product_id === p.id),
      variacoes: (variacoes ?? []).filter((v) => v.product_id === p.id),
    })),
  });
}

/**
 * POST /api/cms/department-products
 *
 * Cria um produto. Imagens e variações podem vir no mesmo corpo.
 */
export async function POST(req: NextRequest) {
  const auth = await autorizar(req);
  if (auth.erro) return auth.erro;

  const body = await req.json();
  const departmentId: string | undefined = body.departmentId;
  const nome = String(body.nome ?? "").trim();

  if (!departmentId) return NextResponse.json({ error: "departmentId é obrigatório." }, { status: 400 });
  if (!nome) return NextResponse.json({ error: "Informe o nome do produto." }, { status: 400 });

  // O departamento precisa ser do campo do usuário.
  const { data: dept } = await supabaseAdmin
    .from("ministries").select("id, campo_id").eq("id", departmentId).maybeSingle();
  if (!dept || dept.campo_id !== auth.campoId) {
    return NextResponse.json({ error: "Departamento não pertence ao seu campo." }, { status: 403 });
  }

  // Slug único dentro do departamento.
  const base = slugify(body.slug || nome) || "produto";
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { data: existe } = await supabaseAdmin
      .from("department_products").select("id")
      .eq("department_id", departmentId).ilike("slug", slug)
      .is("deleted_at", null).maybeSingle();
    if (!existe) break;
    slug = `${base}-${i}`;
  }

  const { data: produto, error } = await supabaseAdmin
    .from("department_products")
    .insert({
      campo_id: auth.campoId!,
      department_id: departmentId,
      site_id: body.siteId ?? null,
      slug,
      nome,
      descricao: body.descricao ?? "",
      descricao_curta: body.descricaoCurta ?? "",
      categoria: body.categoria ?? "",
      preco: Number(body.preco ?? 0),
      preco_promocional: body.precoPromocional != null ? Number(body.precoPromocional) : null,
      parcelas_max: Number(body.parcelasMax ?? 1),
      ficha_tecnica: body.fichaTecnica ?? [],
      tabela_medidas: body.tabelaMedidas ?? {},
      estoque_total: body.estoqueTotal != null ? Number(body.estoqueTotal) : null,
      controla_estoque: body.controlaEstoque ?? true,
      destaque: body.destaque ?? false,
      ordem: Number(body.ordem ?? 0),
      ativo: body.ativo ?? true,
      payment_link: body.paymentLink ?? null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await gravarFilhosDoProduto(produto.id, auth.campoId!, body);

  return NextResponse.json({ produto }, { status: 201 });
}
