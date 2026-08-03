import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Sincroniza imagens e variações de um produto da loja.
 *
 * Substituição completa: o editor sempre envia a lista inteira, então o que
 * não veio foi removido na tela. Só roda quando a chave está presente no
 * corpo — assim um PATCH que mexe apenas no preço não apaga as imagens.
 */
export async function gravarFilhosDoProduto(
  productId: string,
  campoId: string,
  body: Record<string, unknown>,
) {
  if (Array.isArray(body.imagens)) {
    await supabaseAdmin.from("department_product_images").delete().eq("product_id", productId);
    const linhas = (body.imagens as Array<Record<string, unknown>>)
      .filter((i) => i.url)
      .map((i, ordem) => ({
        campo_id: campoId,
        product_id: productId,
        url: String(i.url),
        alt: String(i.alt ?? ""),
        // Amarra a foto a uma cor: a galeria da PDP troca de imagem quando o
        // visitante seleciona aquela cor.
        variant_cor: i.variantCor ? String(i.variantCor) : null,
        ordem,
      }));
    if (linhas.length) await supabaseAdmin.from("department_product_images").insert(linhas);
  }

  if (Array.isArray(body.variacoes)) {
    await supabaseAdmin.from("department_product_variants").delete().eq("product_id", productId);
    const linhas = (body.variacoes as Array<Record<string, unknown>>)
      .filter((v) => v.cor || v.tamanho)
      .map((v, ordem) => ({
        campo_id: campoId,
        product_id: productId,
        sku: v.sku ? String(v.sku) : null,
        cor: v.cor ? String(v.cor) : null,
        cor_hex: v.corHex ? String(v.corHex) : null,
        tamanho: v.tamanho ? String(v.tamanho) : null,
        // Preço vazio = herda o do produto.
        preco: v.preco != null && v.preco !== "" ? Number(v.preco) : null,
        estoque: Number(v.estoque ?? 0),
        ativo: v.ativo !== false,
        ordem,
      }));
    if (linhas.length) await supabaseAdmin.from("department_product_variants").insert(linhas);
  }
}
