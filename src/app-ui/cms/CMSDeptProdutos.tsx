"use client";

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Plus, Trash2, Upload, Loader2, X, Star, Package,
  Undo2, Save, Archive, ImagePlus, GripVertical,
} from "lucide-react";
import { useDepartmentSite } from "../../hooks/useDepartmentSite";
import {
  useDepartmentProducts, useSalvarProduto, useArquivarProduto,
  enviarImagemProduto, type ProdutoLoja,
} from "../../hooks/useDepartmentProducts";

/**
 * Cadastro de produtos da loja de um departamento.
 *
 * Cada produto tem galeria (as miniaturas da página de produto), variações de
 * cor e tamanho com estoque próprio, e ficha técnica. Uma imagem pode ser
 * amarrada a uma cor: a galeria da loja troca de foto quando o visitante
 * seleciona aquela cor.
 */
export default function CMSDeptProdutos() {
  const { id: siteId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: site } = useDepartmentSite(siteId);
  const departmentId = site?.site.department_id;
  const deptSlug = site?.site.slug ?? "loja";

  const { data: produtos, isLoading } = useDepartmentProducts(departmentId);
  const arquivar = useArquivarProduto(departmentId);

  const [editando, setEditando] = useState<ProdutoLoja | "novo" | null>(null);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/app-ui/cms/sites/${siteId}/builder`)}
            className="text-slate-400 hover:text-slate-700" aria-label="Voltar ao editor"
          >
            <Undo2 size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Loja · {site?.site.titulo ?? ""}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Camisetas, livros e o que mais o departamento vender. Adicione o bloco
              &ldquo;Loja&rdquo; na página para exibir estes produtos.
            </p>
          </div>
        </div>
        <button
          onClick={() => setEditando("novo")}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          <Plus size={15} /> Novo produto
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>
      ) : !produtos?.length ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
          <Package size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500">Nenhum produto cadastrado ainda.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {produtos.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="aspect-[4/3] bg-slate-100">
                {p.imagens[0]?.url && (
                  <img src={p.imagens[0].url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{p.nome}</p>
                    <p className="text-sm text-slate-500">
                      {Number(p.preco_promocional ?? p.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      {p.variacoes.length > 0 && ` · ${p.variacoes.length} variações`}
                    </p>
                  </div>
                  {p.destaque && <Star size={15} className="shrink-0 fill-amber-400 text-amber-400" />}
                </div>
                {!p.ativo && (
                  <span className="mt-2 inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                    Oculto na loja
                  </span>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setEditando(p)}
                    className="flex-1 rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Arquivar "${p.nome}"? Ele sai da loja, mas os pedidos antigos continuam intactos.`)) {
                        arquivar.mutate(p.id);
                      }
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-500 hover:bg-slate-50"
                    aria-label="Arquivar produto"
                  >
                    <Archive size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && departmentId && (
        <EditorProduto
          produto={editando === "novo" ? null : editando}
          departmentId={departmentId}
          deptSlug={deptSlug}
          onFechar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

// ── Editor ───────────────────────────────────────────────────────────────────

const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400";
const rotulo = "mb-1 block text-xs font-medium text-slate-600";

interface ImagemForm { url: string; alt: string; variantCor: string }
interface VariacaoForm {
  cor: string; corHex: string; tamanho: string; sku: string;
  preco: string; estoque: string; ativo: boolean;
}

function EditorProduto({
  produto, departmentId, deptSlug, onFechar,
}: {
  produto: ProdutoLoja | null;
  departmentId: string;
  deptSlug: string;
  onFechar: () => void;
}) {
  const salvar = useSalvarProduto(departmentId);

  const [nome, setNome] = useState("");
  const [descricaoCurta, setDescricaoCurta] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [preco, setPreco] = useState("0");
  const [precoPromo, setPrecoPromo] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [estoqueTotal, setEstoqueTotal] = useState("");
  const [destaque, setDestaque] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [paymentLink, setPaymentLink] = useState("");

  const [imagens, setImagens] = useState<ImagemForm[]>([]);
  const [variacoes, setVariacoes] = useState<VariacaoForm[]>([]);
  const [ficha, setFicha] = useState<Array<{ label: string; value: string }>>([]);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!produto) return;
    setNome(produto.nome);
    setDescricaoCurta(produto.descricao_curta ?? "");
    setDescricao(produto.descricao ?? "");
    setCategoria(produto.categoria ?? "");
    setPreco(String(produto.preco ?? 0));
    setPrecoPromo(produto.preco_promocional != null ? String(produto.preco_promocional) : "");
    setParcelas(String(produto.parcelas_max ?? 1));
    setEstoqueTotal(produto.estoque_total != null ? String(produto.estoque_total) : "");
    setDestaque(produto.destaque);
    setAtivo(produto.ativo);
    setPaymentLink(produto.payment_link ?? "");
    setImagens(produto.imagens.map((i) => ({ url: i.url, alt: i.alt ?? "", variantCor: i.variant_cor ?? "" })));
    setVariacoes(produto.variacoes.map((v) => ({
      cor: v.cor ?? "", corHex: v.cor_hex ?? "", tamanho: v.tamanho ?? "",
      sku: v.sku ?? "", preco: v.preco != null ? String(v.preco) : "",
      estoque: String(v.estoque ?? 0), ativo: v.ativo,
    })));
    setFicha(produto.ficha_tecnica ?? []);
  }, [produto]);

  // Cores já declaradas nas variações — para amarrar cada foto a uma delas.
  const coresDisponiveis = [...new Set(variacoes.map((v) => v.cor).filter(Boolean))];

  async function subirArquivos(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setEnviando(true);
    setErro(null);
    try {
      const urls = await Promise.all([...arquivos].map((f) => enviarImagemProduto(deptSlug, f)));
      setImagens((atual) => [...atual, ...urls.map((url) => ({ url, alt: "", variantCor: "" }))]);
    } catch (e) {
      setErro(`Falha ao enviar imagem: ${(e as Error).message}`);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmar() {
    setErro(null);
    if (!nome.trim()) { setErro("Informe o nome do produto."); return; }
    try {
      await salvar.mutateAsync({
        id: produto?.id,
        nome: nome.trim(),
        descricao,
        descricaoCurta,
        categoria,
        preco: Number(preco) || 0,
        precoPromocional: precoPromo === "" ? null : Number(precoPromo),
        parcelasMax: Number(parcelas) || 1,
        estoqueTotal: estoqueTotal === "" ? null : Number(estoqueTotal),
        destaque,
        ativo,
        paymentLink: paymentLink || null,
        fichaTecnica: ficha.filter((f) => f.label || f.value),
        imagens: imagens.map((i) => ({ url: i.url, alt: i.alt, variantCor: i.variantCor || null })),
        variacoes: variacoes.map((v) => ({
          cor: v.cor || null, corHex: v.corHex || null, tamanho: v.tamanho || null,
          sku: v.sku || null, preco: v.preco === "" ? null : Number(v.preco),
          estoque: Number(v.estoque) || 0, ativo: v.ativo,
        })),
      });
      onFechar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4" onClick={onFechar}>
      <div
        className="mx-auto my-4 w-full max-w-3xl rounded-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-900">{produto ? "Editar produto" : "Novo produto"}</h2>
          <button onClick={onFechar} aria-label="Fechar"><X size={18} className="text-slate-400" /></button>
        </header>

        <div className="flex flex-col gap-6 p-6">
          {/* Básico */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={rotulo}>Nome</label>
              <input className={input} value={nome} onChange={(e) => setNome(e.target.value)}
                     placeholder="Camiseta Frente Jovem 2026" />
            </div>
            <div className="sm:col-span-2">
              <label className={rotulo}>Chamada curta <span className="font-normal text-slate-400">— aparece no card da vitrine</span></label>
              <input className={input} value={descricaoCurta} onChange={(e) => setDescricaoCurta(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={rotulo}>Descrição completa</label>
              <textarea className={input} rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            <div>
              <label className={rotulo}>Categoria</label>
              <input className={input} value={categoria} onChange={(e) => setCategoria(e.target.value)}
                     placeholder="Vestuário" />
            </div>
            <div>
              <label className={rotulo}>Link de pagamento <span className="font-normal text-slate-400">— vazio usa o da página</span></label>
              <input className={input} value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)} />
            </div>
          </section>

          {/* Preço */}
          <section className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className={rotulo}>Preço (R$)</label>
              <input className={input} type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} />
            </div>
            <div>
              <label className={rotulo}>Promocional</label>
              <input className={input} type="number" step="0.01" value={precoPromo}
                     onChange={(e) => setPrecoPromo(e.target.value)} placeholder="—" />
            </div>
            <div>
              <label className={rotulo}>Parcelas</label>
              <input className={input} type="number" min={1} value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
            </div>
            <div>
              <label className={rotulo}>Estoque geral</label>
              <input className={input} type="number" value={estoqueTotal}
                     onChange={(e) => setEstoqueTotal(e.target.value)} placeholder="ilimitado" />
            </div>
          </section>

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={destaque} onChange={(e) => setDestaque(e.target.checked)} />
              Marcar como destaque
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
              Visível na loja
            </label>
          </div>

          {/* Imagens */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <label className={rotulo}>Fotos <span className="font-normal text-slate-400">— a primeira é a capa</span></label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-violet-600 hover:underline">
                {enviando ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                Enviar imagens
                <input type="file" accept="image/*" multiple className="hidden"
                       onChange={(e) => subirArquivos(e.target.files)} />
              </label>
            </div>

            {imagens.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-200 p-8 text-slate-400">
                <ImagePlus size={24} />
                <p className="text-sm">Sem fotos ainda.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {imagens.map((img, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-2">
                    <div className="relative mb-2 aspect-square overflow-hidden rounded bg-slate-100">
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                      {i === 0 && (
                        <span className="absolute left-1 top-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-white">
                          Capa
                        </span>
                      )}
                      <button
                        onClick={() => setImagens(imagens.filter((_, idx) => idx !== i))}
                        className="absolute right-1 top-1 rounded bg-white/90 p-1 text-slate-500 hover:text-red-500"
                        aria-label="Remover foto"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {coresDisponiveis.length > 0 && (
                      <select
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                        value={img.variantCor}
                        onChange={(e) => setImagens(imagens.map((x, idx) =>
                          idx === i ? { ...x, variantCor: e.target.value } : x))}
                      >
                        <option value="">Todas as cores</option>
                        {coresDisponiveis.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}
                    <div className="mt-1 flex items-center gap-1">
                      <GripVertical size={11} className="text-slate-300" />
                      <button
                        disabled={i === 0}
                        onClick={() => {
                          const novo = [...imagens];
                          [novo[i - 1], novo[i]] = [novo[i], novo[i - 1]];
                          setImagens(novo);
                        }}
                        className="text-[11px] text-slate-500 disabled:opacity-30"
                      >
                        mover para frente
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Variações */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <label className={rotulo}>
                Variações <span className="font-normal text-slate-400">— cor e tamanho, cada uma com seu estoque</span>
              </label>
              <button
                onClick={() => setVariacoes([...variacoes, {
                  cor: "", corHex: "#000000", tamanho: "", sku: "", preco: "", estoque: "0", ativo: true,
                }])}
                className="flex items-center gap-1 text-xs text-violet-600 hover:underline"
              >
                <Plus size={12} /> Adicionar
              </button>
            </div>

            {variacoes.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                Sem variações, o produto é vendido em opção única usando o estoque geral.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {variacoes.map((v, i) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-200 p-2">
                    <input className="col-span-3 rounded border border-slate-200 px-2 py-1.5 text-sm"
                           placeholder="Cor" value={v.cor}
                           onChange={(e) => setVariacoes(variacoes.map((x, idx) => idx === i ? { ...x, cor: e.target.value } : x))} />
                    <input type="color" className="col-span-1 h-8 w-full rounded border border-slate-200"
                           value={v.corHex || "#000000"}
                           onChange={(e) => setVariacoes(variacoes.map((x, idx) => idx === i ? { ...x, corHex: e.target.value } : x))} />
                    <input className="col-span-2 rounded border border-slate-200 px-2 py-1.5 text-sm"
                           placeholder="Tam." value={v.tamanho}
                           onChange={(e) => setVariacoes(variacoes.map((x, idx) => idx === i ? { ...x, tamanho: e.target.value } : x))} />
                    <input className="col-span-2 rounded border border-slate-200 px-2 py-1.5 text-sm"
                           type="number" step="0.01" placeholder="Preço" value={v.preco}
                           onChange={(e) => setVariacoes(variacoes.map((x, idx) => idx === i ? { ...x, preco: e.target.value } : x))} />
                    <input className="col-span-2 rounded border border-slate-200 px-2 py-1.5 text-sm"
                           type="number" placeholder="Estoque" value={v.estoque}
                           onChange={(e) => setVariacoes(variacoes.map((x, idx) => idx === i ? { ...x, estoque: e.target.value } : x))} />
                    <button onClick={() => setVariacoes(variacoes.filter((_, idx) => idx !== i))}
                            className="col-span-2 justify-self-end text-slate-300 hover:text-red-500"
                            aria-label="Remover variação">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Ficha técnica */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <label className={rotulo}>Ficha técnica <span className="font-normal text-slate-400">— ex: Tecido / Algodão 30.1</span></label>
              <button onClick={() => setFicha([...ficha, { label: "", value: "" }])}
                      className="flex items-center gap-1 text-xs text-violet-600 hover:underline">
                <Plus size={12} /> Adicionar
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {ficha.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <input className={input} placeholder="Característica" value={f.label}
                         onChange={(e) => setFicha(ficha.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} />
                  <input className={input} placeholder="Valor" value={f.value}
                         onChange={(e) => setFicha(ficha.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} />
                  <button onClick={() => setFicha(ficha.filter((_, idx) => idx !== i))}
                          className="shrink-0 text-slate-300 hover:text-red-500" aria-label="Remover linha">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button onClick={onFechar} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">
            Cancelar
          </button>
          <button
            onClick={confirmar} disabled={salvar.isPending || enviando}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {salvar.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Salvar produto
          </button>
        </footer>
      </div>
    </div>
  );
}
