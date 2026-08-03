import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPublishedSiteBySlug } from "@/lib/departmentSiteService";
import { resolveCampoFromRequest } from "@/lib/publicTenant";
import { generateCheckInCode, normalizeBrazilPhone } from "@/lib/penielTicket";

interface ItemPedido {
  productId: string;
  variantId?: string | null;
  qty: number;
}

/**
 * POST /api/public/dept/[slug]/orders
 *
 * Fecha um pedido da loja do departamento. Mesmo formulário essencial da
 * inscrição em evento (nome, telefone, CPF) e mesmo fluxo de pagamento por
 * link + código de retirada com QR.
 *
 * Preço e estoque são SEMPRE relidos do banco — o que o carrinho do navegador
 * diz sobre valores é ignorado.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const campoId = await resolveCampoFromRequest(req);
    const dados = await getPublishedSiteBySlug(slug, campoId);
    if (!dados?.site.campo_id) {
      return NextResponse.json({ error: "Página não encontrada." }, { status: 404 });
    }
    const { site } = dados;

    const body = await req.json();
    const nome = String(body.nome ?? "").trim();
    const telefone = normalizeBrazilPhone(String(body.telefone ?? ""));
    const cpf = String(body.cpf ?? "").replace(/\D/g, "");
    const itens: ItemPedido[] = Array.isArray(body.itens) ? body.itens : [];

    if (nome.length < 3) return NextResponse.json({ error: "Informe seu nome completo." }, { status: 400 });
    if (telefone.replace(/\D/g, "").length < 12) {
      return NextResponse.json({ error: "Telefone inválido." }, { status: 400 });
    }
    if (cpf.length !== 11) return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
    if (!itens.length) return NextResponse.json({ error: "Carrinho vazio." }, { status: 400 });

    // ── Relê produtos e variações do banco ──────────────────────────────────
    const produtoIds = [...new Set(itens.map((i) => i.productId))];
    const { data: produtos } = await supabaseAdmin
      .from("department_products")
      .select("id, nome, preco, preco_promocional, controla_estoque, estoque_total, ativo, department_id, campo_id")
      .in("id", produtoIds)
      .returns<Array<{
        id: string; nome: string; preco: number; preco_promocional: number | null;
        controla_estoque: boolean; estoque_total: number | null; ativo: boolean;
        department_id: string; campo_id: string;
      }>>();

    const variantIds = itens.map((i) => i.variantId).filter(Boolean) as string[];
    const { data: variacoes } = variantIds.length
      ? await supabaseAdmin
          .from("department_product_variants")
          .select("id, product_id, cor, tamanho, preco, estoque, ativo")
          .in("id", variantIds)
          .returns<Array<{
            id: string; product_id: string; cor: string | null; tamanho: string | null;
            preco: number | null; estoque: number; ativo: boolean;
          }>>()
      : { data: [] };

    const { data: imagens } = await supabaseAdmin
      .from("department_product_images")
      .select("product_id, url, ordem")
      .in("product_id", produtoIds)
      .order("ordem")
      .returns<Array<{ product_id: string; url: string; ordem: number }>>();

    // ── Monta as linhas do pedido, validando cada item ──────────────────────
    const linhas: Array<Record<string, unknown>> = [];
    let subtotal = 0;

    for (const item of itens) {
      const produto = produtos?.find((p) => p.id === item.productId);
      if (!produto || !produto.ativo) {
        return NextResponse.json({ error: "Um dos produtos não está mais disponível." }, { status: 409 });
      }
      // Produto de outro departamento/campo não entra neste pedido.
      if (produto.department_id !== site.department_id || produto.campo_id !== site.campo_id) {
        return NextResponse.json({ error: "Produto inválido para esta loja." }, { status: 403 });
      }

      const qty = Math.max(1, Math.min(Number(item.qty) || 1, 99));
      const variacao = item.variantId ? variacoes?.find((v) => v.id === item.variantId) : null;

      if (item.variantId && (!variacao || !variacao.ativo || variacao.product_id !== produto.id)) {
        return NextResponse.json({ error: "Variação indisponível." }, { status: 409 });
      }
      if (variacao && variacao.estoque < qty) {
        return NextResponse.json(
          { error: `Estoque insuficiente para ${produto.nome} (${variacao.tamanho ?? ""} ${variacao.cor ?? ""}).` },
          { status: 409 },
        );
      }
      if (!variacao && produto.controla_estoque && produto.estoque_total != null && produto.estoque_total < qty) {
        return NextResponse.json({ error: `Estoque insuficiente para ${produto.nome}.` }, { status: 409 });
      }

      const unit = Number(
        variacao?.preco ?? produto.preco_promocional ?? produto.preco ?? 0,
      );
      subtotal += unit * qty;

      linhas.push({
        campo_id: site.campo_id,
        product_id: produto.id,
        variant_id: variacao?.id ?? null,
        produto_nome: produto.nome,
        variacao: variacao ? [variacao.cor, variacao.tamanho].filter(Boolean).join(" · ") : null,
        imagem_url: imagens?.find((i) => i.product_id === produto.id)?.url ?? null,
        qty,
        unit_price: unit,
        subtotal: unit * qty,
      });
    }

    // ── Cria o pedido ───────────────────────────────────────────────────────
    const numeroPedido = `PD-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;

    const { data: pedido, error } = await supabaseAdmin
      .from("department_orders")
      .insert({
        campo_id: site.campo_id,
        department_id: site.department_id,
        numero_pedido: numeroPedido,
        nome,
        telefone,
        cpf,
        email: body.email ? String(body.email).trim() : null,
        endereco: body.endereco ?? {},
        observacoes: body.observacoes ?? null,
        subtotal,
        total: subtotal,
        payment_link: site.payment_link,
        payment_status: "PENDENTE",
        lookup_token: randomBytes(16).toString("hex"),
        check_in_code: generateCheckInCode(),
        status: "AGUARDANDO",
        origem: body.origem === "app" ? "app" : "site",
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await supabaseAdmin
      .from("department_order_items")
      .insert(linhas.map((l) => ({ ...l, order_id: pedido.id })));

    // Baixa de estoque das variações. Feita depois da criação para não deixar
    // estoque reservado por um pedido que falhou ao gravar.
    for (const linha of linhas) {
      const variantId = linha.variant_id as string | null;
      if (!variantId) continue;
      const atual = variacoes?.find((v) => v.id === variantId);
      if (!atual) continue;
      await supabaseAdmin
        .from("department_product_variants")
        .update({ estoque: Math.max(0, atual.estoque - (linha.qty as number)) })
        .eq("id", variantId);
    }

    return NextResponse.json(
      {
        ok: true,
        pedido: {
          id: pedido.id,
          numero: numeroPedido,
          total: subtotal,
          token: pedido.lookup_token,
          codigoRetirada: pedido.check_in_code,
          paymentLink: site.payment_link,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
