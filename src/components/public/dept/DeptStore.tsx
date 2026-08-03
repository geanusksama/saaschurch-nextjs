"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, ShoppingCart, ChevronLeft, ChevronRight, Minus, Plus,
  Trash2, CheckCircle2, Truck, Heart,
} from "lucide-react";
import { tokens as T, Secao, TituloSecao } from "./DeptSiteRenderer";
import type { DeptProduto } from "./DeptSiteRenderer";
import type { DepartmentSite } from "@/lib/departmentSiteSchema";

type Props = Record<string, unknown>;
const txt = (p: Props, k: string, d = "") => String(p[k] ?? d);
const num = (p: Props, k: string, d = 0) => Number(p[k] ?? d);

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface ItemCarrinho {
  key: string;
  produto: DeptProduto;
  variantId: string | null;
  variacaoLabel: string;
  qty: number;
  unit: number;
  imagem: string | null;
}

/**
 * Loja do departamento.
 *
 * A vitrine abre a página de produto num painel (PDP) com galeria de
 * miniaturas à esquerda, imagem grande no centro e painel de compra à direita
 * — o mesmo arranjo da referência enviada. O carrinho vive só no navegador; o
 * preço final é sempre recalculado no servidor no fechamento do pedido.
 */
export default function DeptStore({
  p, variante, slug, produtos, site,
}: {
  p: Props; variante: string; slug: string;
  produtos: DeptProduto[]; site: DepartmentSite;
}) {
  const [aberto, setAberto] = useState<DeptProduto | null>(null);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);

  const categoria = txt(p, "categoria");
  const lista = useMemo(() => {
    let base = produtos;
    if (variante === "destaque") base = base.filter((x) => x.destaque);
    if (categoria) base = base.filter((x) => (x.categoria ?? "").toLowerCase() === categoria.toLowerCase());
    return base.slice(0, num(p, "limite", 8));
  }, [produtos, variante, categoria, p]);

  const colunas = Math.min(Math.max(num(p, "colunas", 4), 1), 6);
  const totalItens = carrinho.reduce((s, i) => s + i.qty, 0);

  function adicionar(item: ItemCarrinho) {
    setCarrinho((atual) => {
      const existente = atual.find((i) => i.key === item.key);
      if (existente) {
        return atual.map((i) => (i.key === item.key ? { ...i, qty: i.qty + item.qty } : i));
      }
      return [...atual, item];
    });
    setAberto(null);
    setCarrinhoAberto(true);
  }

  if (!lista.length) return null;

  return (
    <Secao>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <TituloSecao>{txt(p, "titulo", "Loja")}</TituloSecao>
          {txt(p, "subtitulo") && <p style={{ color: T.muted }}>{txt(p, "subtitulo")}</p>}
        </div>
        <button
          onClick={() => setCarrinhoAberto(true)}
          className="relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
          style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius }}
        >
          <ShoppingCart size={17} />
          Carrinho
          {totalItens > 0 && (
            <span
              className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center px-1 text-[11px] font-bold"
              style={{ background: T.accent, color: T.bg, borderRadius: 999 }}
            >
              {totalItens}
            </span>
          )}
        </button>
      </div>

      <div
        className={variante === "carrossel" ? "flex snap-x gap-5 overflow-x-auto pb-4" : "grid gap-5"}
        style={variante === "carrossel" ? undefined : { gridTemplateColumns: `repeat(auto-fill, minmax(${Math.floor(1100 / colunas)}px, 1fr))` }}
      >
        {lista.map((prod) => (
          <CardProduto
            key={prod.id} produto={prod}
            fixo={variante === "carrossel"}
            onAbrir={() => setAberto(prod)}
          />
        ))}
      </div>

      <AnimatePresence>
        {aberto && (
          <PainelProduto
            produto={aberto}
            relacionados={produtos.filter((x) => x.id !== aberto.id).slice(0, 4)}
            onTrocar={setAberto}
            onFechar={() => setAberto(null)}
            onAdicionar={adicionar}
          />
        )}
        {carrinhoAberto && (
          <GavetaCarrinho
            carrinho={carrinho} slug={slug} site={site}
            onFechar={() => setCarrinhoAberto(false)}
            onAtualizar={setCarrinho}
          />
        )}
      </AnimatePresence>
    </Secao>
  );
}

// ── Card da vitrine ──────────────────────────────────────────────────────────

function precoDe(produto: DeptProduto) {
  const cheio = Number(produto.preco ?? 0);
  const promo = produto.preco_promocional != null ? Number(produto.preco_promocional) : null;
  return { atual: promo ?? cheio, antigo: promo != null ? cheio : null };
}

function CardProduto({ produto, fixo, onAbrir }: { produto: DeptProduto; fixo: boolean; onAbrir: () => void }) {
  const capa = produto.imagens[0]?.url ?? null;
  const { atual, antigo } = precoDe(produto);
  const desconto = antigo ? Math.round((1 - atual / antigo) * 100) : 0;

  return (
    <button
      onClick={onAbrir}
      className={`group flex flex-col overflow-hidden text-left transition-transform hover:-translate-y-1 ${fixo ? "w-64 shrink-0 snap-start" : ""}`}
      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius }}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden" style={{ background: T.surfaceAlt }}>
        {capa && (
          <img src={capa} alt={produto.nome} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        )}
        {desconto > 0 && (
          <span className="absolute left-3 top-3 px-2 py-1 text-[11px] font-bold" style={{ background: T.accent, color: T.bg, borderRadius: 4 }}>
            -{desconto}%
          </span>
        )}
        {produto.destaque && (
          <span className="absolute right-3 top-3 px-2 py-1 text-[11px] font-bold uppercase" style={{ background: T.primary, color: "#fff", borderRadius: 4 }}>
            Novo
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-sm font-medium leading-snug">{produto.nome}</p>
        {produto.descricao_curta && (
          <p className="mt-1 line-clamp-2 text-xs" style={{ color: T.muted }}>{produto.descricao_curta}</p>
        )}
        <div className="mt-auto pt-3">
          {antigo && <p className="text-xs line-through" style={{ color: T.muted }}>{moeda(antigo)}</p>}
          <p className="text-lg font-bold">{moeda(atual)}</p>
          {produto.parcelas_max > 1 && (
            <p className="text-xs" style={{ color: T.muted }}>
              ou {produto.parcelas_max}x de {moeda(atual / produto.parcelas_max)}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ── PDP ──────────────────────────────────────────────────────────────────────

function PainelProduto({
  produto, relacionados, onTrocar, onFechar, onAdicionar,
}: {
  produto: DeptProduto;
  relacionados: DeptProduto[];
  onTrocar: (p: DeptProduto) => void;
  onFechar: () => void;
  onAdicionar: (item: ItemCarrinho) => void;
}) {
  const cores = [...new Set(produto.variacoes.map((v) => v.cor).filter(Boolean))] as string[];
  const tamanhos = [...new Set(produto.variacoes.map((v) => v.tamanho).filter(Boolean))] as string[];

  const [cor, setCor] = useState<string | null>(cores[0] ?? null);
  const [tamanho, setTamanho] = useState<string | null>(tamanhos[0] ?? null);
  const [qty, setQty] = useState(1);
  const [indice, setIndice] = useState(0);

  // A galeria segue a cor escolhida quando as imagens estão marcadas por cor.
  const imagens = useMemo(() => {
    const daCor = produto.imagens.filter((i) => i.variant_cor && i.variant_cor === cor);
    return daCor.length ? daCor : produto.imagens;
  }, [produto.imagens, cor]);

  const variacao = produto.variacoes.find(
    (v) => (cor == null || v.cor === cor) && (tamanho == null || v.tamanho === tamanho),
  ) ?? null;

  const { atual, antigo } = precoDe(produto);
  const unit = Number(variacao?.preco ?? atual);
  const semEstoque = variacao ? variacao.estoque <= 0 : false;

  const foto = imagens[Math.min(indice, imagens.length - 1)]?.url ?? null;

  function adicionar() {
    onAdicionar({
      key: `${produto.id}:${variacao?.id ?? "-"}`,
      produto,
      variantId: variacao?.id ?? null,
      variacaoLabel: [cor, tamanho].filter(Boolean).join(" · "),
      qty,
      unit,
      imagem: foto,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: "rgba(0,0,0,.75)" }}
      onClick={onFechar}
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 250 }}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto my-6 w-full max-w-6xl overflow-hidden"
        style={{ background: T.bg, borderRadius: T.radius, border: `1px solid ${T.border}`, color: T.text }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
          <p className="text-sm" style={{ color: T.muted }}>
            {produto.categoria ? `${produto.categoria} · ` : ""}{produto.nome}
          </p>
          <button onClick={onFechar} aria-label="Fechar"><X size={20} style={{ color: T.muted }} /></button>
        </div>

        <div className="grid gap-8 p-6 lg:grid-cols-[80px_1fr_340px]">
          {/* Miniaturas */}
          <div className="order-2 flex gap-2 overflow-x-auto lg:order-1 lg:flex-col lg:overflow-visible">
            {imagens.map((img, i) => (
              <button
                key={img.id ?? i} onClick={() => setIndice(i)}
                className="h-20 w-16 shrink-0 overflow-hidden transition-opacity"
                style={{
                  borderRadius: 6,
                  border: `2px solid ${i === indice ? T.primary : "transparent"}`,
                  opacity: i === indice ? 1 : 0.65,
                }}
              >
                <img src={img.url} alt={img.alt ?? ""} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>

          {/* Imagem principal */}
          <div className="relative order-1 lg:order-2">
            <div className="aspect-[3/4] w-full overflow-hidden" style={{ background: T.surfaceAlt, borderRadius: T.radius }}>
              {foto && <img src={foto} alt={produto.nome} className="h-full w-full object-cover" />}
            </div>
            {imagens.length > 1 && (
              <>
                <SetaGaleria lado="esq" onClick={() => setIndice((i) => (i - 1 + imagens.length) % imagens.length)} />
                <SetaGaleria lado="dir" onClick={() => setIndice((i) => (i + 1) % imagens.length)} />
                <span className="absolute bottom-3 right-3 px-2 py-1 text-xs" style={{ background: "rgba(0,0,0,.6)", color: "#fff", borderRadius: 4 }}>
                  {indice + 1}/{imagens.length}
                </span>
              </>
            )}
          </div>

          {/* Painel de compra */}
          <aside className="order-3 flex flex-col gap-4 p-5" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, alignSelf: "start" }}>
            <h2 className="text-xl font-semibold leading-snug" style={{ fontFamily: T.fontTitle }}>{produto.nome}</h2>

            <div>
              {antigo && <p className="text-sm line-through" style={{ color: T.muted }}>{moeda(antigo)}</p>}
              <p className="text-3xl font-bold">{moeda(unit)}</p>
              {produto.parcelas_max > 1 && (
                <p className="text-sm" style={{ color: T.muted }}>
                  ou {produto.parcelas_max}x sem juros de {moeda(unit / produto.parcelas_max)}
                </p>
              )}
            </div>

            {cores.length > 0 && (
              <div>
                <p className="mb-2 text-sm" style={{ color: T.muted }}>Cor: <strong style={{ color: T.text }}>{cor}</strong></p>
                <div className="flex flex-wrap gap-2">
                  {cores.map((c) => {
                    const hex = produto.variacoes.find((v) => v.cor === c)?.cor_hex;
                    return (
                      <button
                        key={c} onClick={() => { setCor(c); setIndice(0); }} title={c} aria-label={c}
                        className="h-8 w-8 rounded-full transition-transform hover:scale-110"
                        style={{ background: hex ?? T.surfaceAlt, border: `2px solid ${c === cor ? T.primary : T.border}` }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {tamanhos.length > 0 && (
              <div>
                <p className="mb-2 text-sm" style={{ color: T.muted }}>Tamanho: <strong style={{ color: T.text }}>{tamanho}</strong></p>
                <div className="flex flex-wrap gap-2">
                  {tamanhos.map((t) => {
                    const disponivel = produto.variacoes.some(
                      (v) => v.tamanho === t && (cor == null || v.cor === cor) && v.estoque > 0,
                    );
                    const ativo = t === tamanho;
                    return (
                      <button
                        key={t} onClick={() => setTamanho(t)} disabled={!disponivel}
                        className="h-10 min-w-10 px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:line-through disabled:opacity-40"
                        style={{
                          background: ativo ? T.primary : "transparent",
                          color: ativo ? "#fff" : T.text,
                          border: `1px solid ${ativo ? T.primary : T.border}`,
                          borderRadius: 6,
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {produto.tabela_medidas && Object.keys(produto.tabela_medidas as object).length > 0 && (
              <details className="text-sm" style={{ color: T.muted }}>
                <summary className="cursor-pointer underline">Ver tabela de medidas</summary>
                <pre className="mt-2 whitespace-pre-wrap text-xs">{JSON.stringify(produto.tabela_medidas, null, 2)}</pre>
              </details>
            )}

            <div className="flex items-center gap-3">
              <div className="flex items-center" style={{ border: `1px solid ${T.border}`, borderRadius: 6 }}>
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2" aria-label="Diminuir"><Minus size={14} /></button>
                <span className="min-w-8 text-center text-sm font-medium">{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="px-3 py-2" aria-label="Aumentar"><Plus size={14} /></button>
              </div>
              <button
                onClick={adicionar} disabled={semEstoque}
                className="flex-1 px-5 py-3 text-sm font-bold disabled:opacity-50"
                style={{ background: T.text, color: T.bg, borderRadius: 6 }}
              >
                {semEstoque ? "Esgotado" : "COMPRAR AGORA"}
              </button>
            </div>

            <button
              onClick={adicionar} disabled={semEstoque}
              className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold disabled:opacity-50"
              style={{ border: `1px solid ${T.border}`, borderRadius: 6, color: T.text }}
            >
              <Heart size={15} /> Adicionar ao carrinho
            </button>

            <div className="flex items-start gap-2 p-3 text-xs" style={{ background: T.bg, borderRadius: 6, color: T.muted }}>
              <Truck size={15} className="mt-0.5 shrink-0" style={{ color: T.primary }} />
              Retirada na igreja após a confirmação do pagamento. Você recebe um código com QR para retirar.
            </div>

            {produto.ficha_tecnica?.length > 0 && (
              <dl className="flex flex-col gap-1 text-xs" style={{ color: T.muted }}>
                {produto.ficha_tecnica.map((f, i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <dt>{f.label}</dt><dd style={{ color: T.text }}>{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </aside>
        </div>

        {produto.descricao && (
          <div className="px-6 pb-6">
            <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: T.muted }}>{produto.descricao}</p>
          </div>
        )}

        {relacionados.length > 0 && (
          <div className="px-6 pb-8">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest">Você pode gostar</h3>
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
              {relacionados.map((r) => (
                <CardProduto key={r.id} produto={r} fixo={false} onAbrir={() => { onTrocar(r); setIndice(0); }} />
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function SetaGaleria({ lado, onClick }: { lado: "esq" | "dir"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={lado === "esq" ? "Imagem anterior" : "Próxima imagem"}
      className="absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center"
      style={{
        [lado === "esq" ? "left" : "right"]: 12,
        background: "rgba(255,255,255,.9)", color: "#111", borderRadius: 999,
      }}
    >
      {lado === "esq" ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </button>
  );
}

// ── Carrinho e checkout ──────────────────────────────────────────────────────

function mascaraCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function mascaraTelefone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

function GavetaCarrinho({
  carrinho, slug, site, onFechar, onAtualizar,
}: {
  carrinho: ItemCarrinho[]; slug: string; site: DepartmentSite;
  onFechar: () => void; onAtualizar: (c: ItemCarrinho[]) => void;
}) {
  const [checkout, setCheckout] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pedido, setPedido] = useState<{ numero: string; total: number; codigoRetirada: string; paymentLink?: string | null } | null>(null);

  const total = carrinho.reduce((s, i) => s + i.unit * i.qty, 0);

  function mudarQty(key: string, delta: number) {
    onAtualizar(
      carrinho
        .map((i) => (i.key === key ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0),
    );
  }

  async function finalizar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/public/dept/${slug}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome, telefone, cpf, email: email || undefined,
          itens: carrinho.map((i) => ({ productId: i.produto.id, variantId: i.variantId, qty: i.qty })),
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Não foi possível fechar o pedido.");
      setPedido(json.pedido);
      onAtualizar([]);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const inputStyle = { background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex justify-end"
      style={{ background: "rgba(0,0,0,.6)" }}
      onClick={onFechar}
    >
      <motion.aside
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col"
        style={{ background: T.surface, color: T.text, borderLeft: `1px solid ${T.border}` }}
      >
        <header className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
          <h3 className="font-semibold">
            {pedido ? "Pedido enviado" : checkout ? "Seus dados" : "Carrinho"}
          </h3>
          <button onClick={onFechar} aria-label="Fechar"><X size={18} style={{ color: T.muted }} /></button>
        </header>

        {pedido ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <CheckCircle2 size={48} style={{ color: T.accent }} />
            <p className="text-lg font-semibold">Pedido {pedido.numero}</p>
            <p className="text-sm" style={{ color: T.muted }}>
              Total {moeda(pedido.total)}. Assim que confirmarmos o pagamento, seu produto fica separado para retirada.
            </p>
            <div className="w-full px-4 py-3" style={{ background: T.bg, borderRadius: 6 }}>
              <p className="text-xs uppercase tracking-widest" style={{ color: T.muted }}>Código de retirada</p>
              <p className="font-mono text-2xl font-bold tracking-[0.2em]">{pedido.codigoRetirada}</p>
            </div>
            {(pedido.paymentLink ?? site.payment_link) && (
              <a
                href={pedido.paymentLink ?? site.payment_link ?? "#"} target="_blank" rel="noreferrer"
                className="w-full px-5 py-3 text-sm font-bold"
                style={{ background: T.primary, color: "#fff", borderRadius: 6 }}
              >
                Pagar {moeda(pedido.total)}
              </a>
            )}
          </div>
        ) : carrinho.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center" style={{ color: T.muted }}>
            <ShoppingCart size={40} />
            <p>Seu carrinho está vazio.</p>
          </div>
        ) : checkout ? (
          <form onSubmit={finalizar} className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
            <p className="text-sm" style={{ color: T.muted }}>
              Precisamos destes dados para separar seu pedido e avisar quando estiver pronto.
            </p>
            <input required placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)}
                   className="px-4 py-3 text-sm outline-none" style={inputStyle} />
            <input required placeholder="Telefone com DDD" value={telefone} inputMode="numeric"
                   onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
                   className="px-4 py-3 text-sm outline-none" style={inputStyle} />
            <input required placeholder="CPF" value={cpf} inputMode="numeric"
                   onChange={(e) => setCpf(mascaraCpf(e.target.value))}
                   className="px-4 py-3 text-sm outline-none" style={inputStyle} />
            <input type="email" placeholder="E-mail (opcional)" value={email} onChange={(e) => setEmail(e.target.value)}
                   className="px-4 py-3 text-sm outline-none" style={inputStyle} />
            {erro && <p className="text-sm" style={{ color: "#ef4444" }}>{erro}</p>}
            <div className="mt-auto flex flex-col gap-2 pt-4">
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span><span>{moeda(total)}</span>
              </div>
              <button type="submit" disabled={enviando}
                      className="px-5 py-3 text-sm font-bold disabled:opacity-60"
                      style={{ background: T.primary, color: "#fff", borderRadius: 6 }}>
                {enviando ? "Enviando…" : "Finalizar pedido"}
              </button>
              <button type="button" onClick={() => setCheckout(false)} className="text-sm" style={{ color: T.muted }}>
                Voltar ao carrinho
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5">
              <ul className="flex flex-col gap-4">
                {carrinho.map((item) => (
                  <li key={item.key} className="flex gap-3">
                    <div className="h-20 w-16 shrink-0 overflow-hidden" style={{ background: T.surfaceAlt, borderRadius: 6 }}>
                      {item.imagem && <img src={item.imagem} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.produto.nome}</p>
                      {item.variacaoLabel && <p className="text-xs" style={{ color: T.muted }}>{item.variacaoLabel}</p>}
                      <p className="mt-1 text-sm font-semibold">{moeda(item.unit * item.qty)}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center" style={{ border: `1px solid ${T.border}`, borderRadius: 6 }}>
                          <button onClick={() => mudarQty(item.key, -1)} className="px-2 py-1" aria-label="Diminuir"><Minus size={12} /></button>
                          <span className="min-w-6 text-center text-xs">{item.qty}</span>
                          <button onClick={() => mudarQty(item.key, 1)} className="px-2 py-1" aria-label="Aumentar"><Plus size={12} /></button>
                        </div>
                        <button onClick={() => mudarQty(item.key, -item.qty)} aria-label="Remover">
                          <Trash2 size={14} style={{ color: T.muted }} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <footer className="flex flex-col gap-3 p-5" style={{ borderTop: `1px solid ${T.border}` }}>
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span><span>{moeda(total)}</span>
              </div>
              <button onClick={() => setCheckout(true)}
                      className="px-5 py-3 text-sm font-bold"
                      style={{ background: T.primary, color: "#fff", borderRadius: 6 }}>
                Finalizar compra
              </button>
            </footer>
          </>
        )}
      </motion.aside>
    </motion.div>
  );
}
