/**
 * /eventos — eventos com ingresso do campo (os mesmos do app). `?dep=cibe`
 * filtra pelo departamento (ministério) — é o link "CIBE" do menu.
 * Clicar abre o modal: escolher ingressos → checkout pelo Asaas.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowDown, CalendarDays, Clock, MapPin, Minus, Plus, ShoppingBag, Ticket, Users, X } from 'lucide-react';
import { brl, cx, dataEvento, PaginaPublica, useVitrine, Vazio, type Evento, type ItemCarrinho } from './comum';
import { Checkout } from './Checkout';

export default function PublicEventosPage() {
  const { dados, erro } = useVitrine();
  const [sp, setSp] = useSearchParams();
  const dep = (sp.get('dep') ?? '').toLowerCase();
  const [aberto, setAberto] = useState<Evento | null>(null);

  const eventos = useMemo(() => (dados?.eventos ?? []).filter((e) => !dep || e.ministerio?.nome.toLowerCase() === dep), [dados, dep]);
  const produtosDep = dep ? (dados?.produtos ?? []).filter((p) => p.ministerio?.nome.toLowerCase() === dep).length : 0;
  const ministerio = dep ? dados?.ministerios.find((m) => m.nome.toLowerCase() === dep) : null;
  const departamentos = dados?.ministerios ?? [];
  const ir = useNavigate();
  const nomeDep = ministerio?.nome ?? dep.toUpperCase();
  const lista = () => document.getElementById('lista-eventos')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <PaginaPublica
      hero={() => ({
        selo: dep ? `Departamento ${nomeDep}` : 'Agenda da igreja',
        titulo: dep ? <>Eventos do <span className="opacity-60">{nomeDep}</span></> : <>Encontros que <span className="opacity-60">marcam</span> a sua caminhada</>,
        texto: dep
          ? `Inscrições e ingressos do ${nomeDep}. Escolha o evento, garanta sua vaga e pague com Pix ou cartão — a confirmação é na hora.`
          : 'Congressos, retiros, conferências e celebrações. Escolha o evento, garanta sua vaga e pague com Pix ou cartão — o ingresso com QR Code sai na hora.',
        acoes: [
          { rotulo: 'Ver próximos eventos', icone: ArrowDown, onClick: lista, principal: true },
          { rotulo: dep && produtosDep ? `Compras do ${nomeDep}` : 'Ir para Compras', icone: ShoppingBag, onClick: () => ir(dep && produtosDep ? `/loja?dep=${dep}` : '/loja') },
        ],
        cartoes: eventos.slice(0, 3).map((e) => ({ imagem: e.imagemUrl, rotulo: dataEvento(e.inicio, e.fim), titulo: e.titulo })),
      })}
    >
      {({ isDark, accent }) => (
        <div id="lista-eventos" className="scroll-mt-6">
          <div className="pb-6">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em]" style={{ color: accent }}>Próximos eventos</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {dep && <button onClick={() => setSp({})} className={cx('rounded-full px-4 py-2 text-sm font-semibold', isDark ? 'bg-white/10' : 'bg-black/5')}>Todos os eventos</button>}
              {!dep && departamentos.map((m) => (
                <button key={m.id} onClick={() => setSp({ dep: m.nome.toLowerCase() })} className={cx('rounded-full px-4 py-2 text-sm font-semibold', isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10')}>{m.nome}</button>
              ))}
              {dep && produtosDep > 0 && <Link to={`/loja?dep=${dep}`} className="rounded-full px-4 py-2 text-sm font-semibold text-black inline-flex items-center gap-2" style={{ background: accent }}><ShoppingBag className="w-4 h-4" />Compras do {ministerio?.nome ?? dep.toUpperCase()}</Link>}
              {ministerio?.site && <a href={`/dep/${ministerio.site}`} className={cx('rounded-full px-4 py-2 text-sm font-semibold', isDark ? 'bg-white/10' : 'bg-black/5')}>Página do {ministerio.nome}</a>}
            </div>
          </div>

          {erro && <Vazio isDark={isDark} titulo="Não foi possível carregar os eventos" sub={erro} />}
          {!dados && !erro && <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className={cx('h-80 rounded-3xl animate-pulse', isDark ? 'bg-white/5' : 'bg-black/5')} />)}</div>}
          {dados && !eventos.length && <Vazio isDark={isDark} titulo={dep ? `Nenhum evento do ${ministerio?.nome ?? dep.toUpperCase()} no momento` : 'Nenhum evento aberto no momento'} sub="Volte em breve: novos eventos aparecem aqui assim que forem publicados." />}

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {eventos.map((e) => {
              const menor = e.opcoes.length ? Math.min(...e.opcoes.map((o) => o.preco)) : null;
              return (
                <button key={e.id} onClick={() => setAberto(e)} className={cx('group text-left rounded-3xl overflow-hidden transition hover:-translate-y-0.5', isDark ? 'bg-white/5 ring-1 ring-white/10 hover:ring-white/20' : 'bg-white ring-1 ring-black/5 shadow-sm hover:shadow-md')}>
                  <div className="aspect-[16/9] relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${accent}33, transparent)` }}>
                    {e.imagemUrl && <img src={e.imagemUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />}
                    <div className="absolute top-3 left-3 flex gap-2">
                      {e.ministerio && <span className="rounded-full px-3 py-1 text-[11px] font-bold bg-black/60 text-white backdrop-blur">{e.ministerio.nome}</span>}
                      {e.destaque && <span className="rounded-full px-3 py-1 text-[11px] font-bold text-black" style={{ background: accent }}>Destaque</span>}
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: accent }}><CalendarDays className="w-3.5 h-3.5" />{dataEvento(e.inicio, e.fim)}</p>
                    <p className="text-lg font-bold mt-1 leading-snug">{e.titulo}</p>
                    {e.local && <p className="text-sm opacity-60 mt-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0" />{e.local}</p>}
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-sm opacity-70">{menor === null ? 'Divulgação' : menor === 0 ? 'Gratuito' : `A partir de ${brl(menor)}`}</span>
                      {e.opcoes.length > 0 && <span className="rounded-full px-4 py-2 text-sm font-semibold text-black" style={{ background: accent }}>{e.ctaTexto || 'Comprar ingresso'}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {aberto && <ModalEvento evento={aberto} isDark={isDark} accent={accent} pagamento={dados?.pagamento ?? null} onFechar={() => setAberto(null)} />}
        </div>
      )}
    </PaginaPublica>
  );
}

function ModalEvento({ evento: e, isDark, accent, pagamento, onFechar }: { evento: Evento; isDark: boolean; accent: string; pagamento: { pix: boolean; cartao: boolean } | null; onFechar: () => void }) {
  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [checkout, setCheckout] = useState(false);
  const itens: ItemCarrinho[] = e.opcoes.filter((o) => (qtd[o.id] ?? 0) > 0).map((o) => ({
    chave: `ING:${o.id}`, tipo: 'INGRESSO', nome: e.tituloCurto || e.titulo, detalhe: o.rotulo, preco: o.preco, quantidade: qtd[o.id], imagem: e.imagemUrl, opcaoId: o.id,
  }));
  const total = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const totalQtd = itens.reduce((s, i) => s + i.quantidade, 0);
  const card = isDark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white ring-1 ring-black/5';
  const mudar = (id: string, d: number) => setQtd((q) => ({ ...q, [id]: Math.max(0, Math.min(10, (q[id] ?? 0) + d)) }));

  if (checkout) return <Checkout itens={itens} isDark={isDark} accent={accent} pagamento={pagamento} onFechar={onFechar} />;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFechar} />
      <div className={cx('relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl', isDark ? 'bg-[#121212] text-white' : 'bg-slate-50 text-slate-900')}>
        <div className="aspect-[16/7] relative" style={{ background: `linear-gradient(135deg, ${accent}44, transparent)` }}>
          {e.imagemUrl && <img src={e.imagemUrl} alt="" className="w-full h-full object-cover" />}
          <button onClick={onFechar} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 sm:p-6 space-y-4">
          <div>
            {e.ministerio && <p className="text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>{e.ministerio.nome}</p>}
            <h2 className="text-2xl font-extrabold mt-1">{e.titulo}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm opacity-70">
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{dataEvento(e.inicio, e.fim)}</span>
              {e.local && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{e.local}</span>}
              {e.vagas !== null && <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{e.vagas} vagas</span>}
            </div>
            {e.endereco && <p className="text-xs opacity-50 mt-1">{e.endereco}</p>}
          </div>
          {e.descricao && <p className="text-sm opacity-80 whitespace-pre-line">{e.descricao}</p>}
          {e.opcoes.length ? (
            <div className="space-y-2">
              <p className="text-sm font-bold flex items-center gap-2"><Ticket className="w-4 h-4" />Ingressos</p>
              {e.opcoes.map((o) => (
                <div key={o.id} className={cx('rounded-2xl p-4 flex items-center gap-3', card)}>
                  <div className="flex-1 min-w-0"><p className="font-semibold">{o.rotulo}</p><p className="text-sm opacity-70">{o.preco === 0 ? 'Gratuito' : brl(o.preco)}</p></div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => mudar(o.id, -1)} disabled={!qtd[o.id]} className={cx('w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-30', isDark ? 'bg-white/10' : 'bg-black/5')}><Minus className="w-4 h-4" /></button>
                    <span className="w-6 text-center font-bold">{qtd[o.id] ?? 0}</span>
                    <button onClick={() => mudar(o.id, 1)} disabled={e.vagas !== null && totalQtd >= e.vagas} className="w-9 h-9 rounded-full flex items-center justify-center text-black disabled:opacity-30" style={{ background: accent }}><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              {e.vagas === 0 && <p className="text-sm text-rose-400">Ingressos esgotados.</p>}
            </div>
          ) : <p className={cx('rounded-2xl p-4 text-sm', card)}>Evento de divulgação, sem venda de ingresso.</p>}
          {e.opcoes.length > 0 && (
            <button onClick={() => setCheckout(true)} disabled={!totalQtd} className="w-full rounded-full py-3.5 font-semibold text-black disabled:opacity-40" style={{ background: accent }}>
              {totalQtd ? `Continuar · ${totalQtd} ${totalQtd === 1 ? 'ingresso' : 'ingressos'} · ${brl(total)}` : 'Escolha os ingressos'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
