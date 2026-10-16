/**
 * /loja — a mesma loja do app no site: produtos do campo, cor/tamanho,
 * carrinho (guardado no navegador) e checkout pelo Asaas. `?dep=` filtra pelo
 * departamento (ministério).
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowDown, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { brl, cx, deDep, PaginaPublica, useCarrinho, useVitrine, Vazio, type ItemCarrinho, type Produto } from './comum';
import { Checkout } from './Checkout';

export default function PublicLojaPage() {
  const { dados, erro } = useVitrine();
  const carrinho = useCarrinho();
  const [sp, setSp] = useSearchParams();
  const dep = (sp.get('dep') ?? '').toLowerCase();
  const [categoria, setCategoria] = useState('');
  const [produto, setProduto] = useState<Produto | null>(null);
  const [verCarrinho, setVerCarrinho] = useState(false);
  const [checkout, setCheckout] = useState(false);

  const produtos = useMemo(
    () => (dados?.produtos ?? []).filter((p) => (!dep || p.ministerio?.nome.toLowerCase() === dep) && (!categoria || p.categoria === categoria)),
    [dados, dep, categoria],
  );
  const categorias = [...new Set((dados?.produtos ?? []).map((p) => p.categoria).filter((c): c is string => Boolean(c)))];
  const ministerio = dep ? dados?.ministerios.find((m) => m.nome.toLowerCase() === dep) : null;

  const lista = () => document.getElementById('lista-produtos')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <PaginaPublica
      hero={() => ({
        selo: ministerio ? `Loja ${deDep(ministerio.nome)}` : 'Loja da igreja',
        titulo: ministerio ? <>Compras {deDep(ministerio.nome).split(' ')[0]} <span className="opacity-60">{ministerio.nome}</span></> : <>Vista a sua fé, <span className="opacity-60">apoie a obra</span></>,
        texto: 'Camisetas, livros e itens da igreja. Escolha, coloque no carrinho e pague com Pix ou cartão. A retirada é na secretaria.',
        acoes: [
          { rotulo: 'Ver produtos', icone: ArrowDown, onClick: lista, principal: true },
          { rotulo: carrinho.qtd ? `Carrinho (${carrinho.qtd})` : 'Carrinho', icone: ShoppingBag, onClick: () => setVerCarrinho(true) },
        ],
        cartoes: produtos.filter((p) => p.imagens[0]).slice(0, 3).map((p) => ({ imagem: p.imagens[0].url, rotulo: brl(p.preco), titulo: p.nome })),
      })}
      direita={({ isDark, accent }) => (
        <button onClick={() => setVerCarrinho(true)} className={cx('relative h-10 px-3 rounded-full flex items-center gap-2 text-sm font-semibold', isDark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-black/5')}>
          <ShoppingBag className="w-4 h-4" />
          <span className="hidden sm:inline">{brl(carrinho.total)}</span>
          {carrinho.qtd > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-[11px] font-bold text-black flex items-center justify-center" style={{ background: accent }}>{carrinho.qtd}</span>}
        </button>
      )}
    >
      {({ isDark, accent }) => (
        <div id="lista-produtos" className="scroll-mt-6">
          <div className="pb-6">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em]" style={{ color: accent }}>Produtos</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {dep && <button onClick={() => setSp({})} className={cx('rounded-full px-4 py-2 text-sm font-semibold', isDark ? 'bg-white/10' : 'bg-black/5')}>Toda a loja</button>}
              {categorias.length > 1 && ['', ...categorias].map((c) => (
                <button key={c || 'todas'} onClick={() => setCategoria(c)} className={cx('rounded-full px-4 py-2 text-sm font-semibold', categoria === c ? 'text-black' : isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10')} style={categoria === c ? { background: accent } : undefined}>{c || 'Todos'}</button>
              ))}
            </div>
          </div>

          {erro && <Vazio isDark={isDark} icone={ShoppingBag} titulo="Não foi possível carregar a loja" sub={erro} />}
          {!dados && !erro && <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className={cx('h-72 rounded-3xl animate-pulse', isDark ? 'bg-white/5' : 'bg-black/5')} />)}</div>}
          {dados && !produtos.length && <Vazio isDark={isDark} icone={ShoppingBag} titulo="Nenhum produto por aqui ainda" />}

          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {produtos.map((p) => (
              <button key={p.id} onClick={() => setProduto(p)} className={cx('group text-left rounded-3xl overflow-hidden transition hover:-translate-y-0.5', isDark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white ring-1 ring-black/5 shadow-sm')}>
                <div className={cx('aspect-square relative overflow-hidden', isDark ? 'bg-white/5' : 'bg-slate-100')}>
                  {p.imagens[0] && <img src={p.imagens[0].url} alt={p.nome} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />}
                  {p.novo && <span className="absolute top-3 left-3 rounded-full px-3 py-1 text-[11px] font-bold text-black" style={{ background: accent }}>Novo</span>}
                </div>
                <div className="p-4">
                  {p.ministerio && <p className="text-[11px] font-bold uppercase tracking-wider opacity-60">{p.ministerio.nome}</p>}
                  <p className="font-semibold leading-snug">{p.nome}</p>
                  <p className="font-bold mt-1" style={{ color: accent }}>{brl(p.preco)}</p>
                </div>
              </button>
            ))}
          </div>

          {produto && <ModalProduto produto={produto} isDark={isDark} accent={accent} onFechar={() => setProduto(null)} onAdicionar={(i) => { carrinho.adicionar(i); setProduto(null); setVerCarrinho(true); }} />}
          {verCarrinho && !checkout && (
            <Carrinho isDark={isDark} accent={accent} carrinho={carrinho} onFechar={() => setVerCarrinho(false)} onFinalizar={() => setCheckout(true)} />
          )}
          {checkout && (
            <Checkout itens={carrinho.itens} isDark={isDark} accent={accent} pagamento={dados?.pagamento ?? null}
              onFechar={() => { setCheckout(false); setVerCarrinho(false); }} onPago={() => carrinho.limpar()} />
          )}
        </div>
      )}
    </PaginaPublica>
  );
}

function ModalProduto({ produto: p, isDark, accent, onFechar, onAdicionar }: { produto: Produto; isDark: boolean; accent: string; onFechar: () => void; onAdicionar: (i: ItemCarrinho) => void }) {
  const [cor, setCor] = useState(p.cores[0]?.id ?? '');
  const [tam, setTam] = useState('');
  const [qtd, setQtd] = useState(1);
  const fotos = p.imagens.filter((i) => !cor || !i.corId || i.corId === cor);
  const [foto, setFoto] = useState(0);
  const url = (fotos[foto] ?? fotos[0] ?? p.imagens[0])?.url;
  const corNome = p.cores.find((c) => c.id === cor)?.nome;
  const falta = p.tamanhos.length > 0 && !tam;
  const chip = (ativo: boolean) => cx('rounded-full px-4 py-2 text-sm font-semibold transition', ativo ? 'text-black' : isDark ? 'bg-white/10' : 'bg-black/5');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFechar} />
      <div className={cx('relative w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl grid sm:grid-cols-2', isDark ? 'bg-[#121212] text-white' : 'bg-slate-50 text-slate-900')}>
        <div className={cx('relative', isDark ? 'bg-white/5' : 'bg-slate-100')}>
          {url && <img src={url} alt={p.nome} className="w-full aspect-square object-cover" />}
          {fotos.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto">
              {fotos.map((f, i) => <button key={f.url + i} onClick={() => setFoto(i)} className={cx('w-14 h-14 rounded-xl overflow-hidden ring-2 shrink-0', i === foto ? '' : 'ring-transparent opacity-60')} style={i === foto ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}><img src={f.url} alt="" className="w-full h-full object-cover" /></button>)}
            </div>
          )}
          <button onClick={onFechar} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center sm:hidden"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex justify-between gap-3">
            <div>
              {p.ministerio && <p className="text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>{p.ministerio.nome}</p>}
              <h2 className="text-2xl font-extrabold">{p.nome}</h2>
              <p className="text-xl font-bold mt-1">{brl(p.preco)}</p>
            </div>
            <button onClick={onFechar} className={cx('w-9 h-9 rounded-full hidden sm:flex items-center justify-center shrink-0', isDark ? 'bg-white/10' : 'bg-black/5')}><X className="w-4 h-4" /></button>
          </div>
          {p.descricao && <p className="text-sm opacity-80 whitespace-pre-line">{p.descricao}</p>}
          {p.cores.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Cor {corNome ? `· ${corNome}` : ''}</p>
              <div className="flex flex-wrap gap-2">
                {p.cores.map((c) => <button key={c.id} onClick={() => { setCor(c.id); setFoto(0); }} title={c.nome} className="w-9 h-9 rounded-full ring-2" style={{ background: c.hex, boxShadow: cor === c.id ? `0 0 0 2px ${accent}` : undefined }} />)}
              </div>
            </div>
          )}
          {p.tamanhos.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Tamanho</p>
              <div className="flex flex-wrap gap-2">{p.tamanhos.map((t) => <button key={t} onClick={() => setTam(t)} className={chip(tam === t)} style={tam === t ? { background: accent } : undefined}>{t}</button>)}</div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button onClick={() => setQtd((q) => Math.max(1, q - 1))} className={cx('w-10 h-10 rounded-full flex items-center justify-center', isDark ? 'bg-white/10' : 'bg-black/5')}><Minus className="w-4 h-4" /></button>
            <span className="w-6 text-center font-bold">{qtd}</span>
            <button onClick={() => setQtd((q) => Math.min(20, q + 1))} className={cx('w-10 h-10 rounded-full flex items-center justify-center', isDark ? 'bg-white/10' : 'bg-black/5')}><Plus className="w-4 h-4" /></button>
          </div>
          <button disabled={falta} onClick={() => onAdicionar({
            chave: `PROD:${p.id}:${tam}:${cor}`, tipo: 'PRODUTO', nome: p.nome, detalhe: [tam && `Tam. ${tam}`, corNome].filter(Boolean).join(' · ') || null,
            preco: p.preco, quantidade: qtd, imagem: url ?? null, produtoId: p.id, tamanho: tam || undefined, corId: cor || undefined,
          })} className="w-full rounded-full py-3.5 font-semibold text-black disabled:opacity-40" style={{ background: accent }}>
            {falta ? 'Escolha o tamanho' : `Adicionar ao carrinho · ${brl(p.preco * qtd)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Carrinho({ isDark, accent, carrinho, onFechar, onFinalizar }: { isDark: boolean; accent: string; carrinho: ReturnType<typeof useCarrinho>; onFechar: () => void; onFinalizar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFechar} />
      <div className={cx('relative w-full max-w-md h-full flex flex-col', isDark ? 'bg-[#121212] text-white' : 'bg-slate-50 text-slate-900')}>
        <div className="flex items-center justify-between p-5">
          <p className="text-xl font-bold">Carrinho <span className="opacity-50 text-base font-semibold">· {carrinho.qtd} {carrinho.qtd === 1 ? 'item' : 'itens'}</span></p>
          <button onClick={onFechar} className={cx('w-9 h-9 rounded-full flex items-center justify-center', isDark ? 'bg-white/10' : 'bg-black/5')}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 space-y-3">
          {!carrinho.itens.length && <Vazio isDark={isDark} icone={ShoppingBag} titulo="Seu carrinho está vazio" sub="Escolha um produto da loja." />}
          {carrinho.itens.map((i) => (
            <div key={i.chave} className={cx('rounded-2xl p-3 flex gap-3', isDark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white ring-1 ring-black/5')}>
              <div className={cx('w-16 h-16 rounded-xl overflow-hidden shrink-0', isDark ? 'bg-white/5' : 'bg-slate-100')}>{i.imagem && <img src={i.imagem} alt="" className="w-full h-full object-cover" />}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{i.nome}</p>
                {i.detalhe && <p className="text-xs opacity-60">{i.detalhe}</p>}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => carrinho.mudar(i.chave, i.quantidade - 1)} className={cx('w-7 h-7 rounded-full flex items-center justify-center', isDark ? 'bg-white/10' : 'bg-black/5')}>{i.quantidade === 1 ? <Trash2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}</button>
                    <span className="text-sm font-bold w-4 text-center">{i.quantidade}</span>
                    <button onClick={() => carrinho.mudar(i.chave, i.quantidade + 1)} className={cx('w-7 h-7 rounded-full flex items-center justify-center', isDark ? 'bg-white/10' : 'bg-black/5')}><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                  <span className="font-bold text-sm">{brl(i.preco * i.quantidade)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-5 space-y-3">
          <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{brl(carrinho.total)}</span></div>
          <button onClick={onFinalizar} disabled={!carrinho.itens.length} className="w-full rounded-full py-3.5 font-semibold text-black disabled:opacity-40" style={{ background: accent }}>Finalizar compra</button>
        </div>
      </div>
    </div>
  );
}
