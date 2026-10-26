/**
 * Engajamento → Fotos e marcações.
 *
 * Publicações do Instagram da igreja (sincronizadas em Engajamento →
 * Instagram) e álbuns lançados à mão. Ao abrir uma, a equipe marca quem está
 * na foto: membro do cadastro (busca por nome ou ROL) ou pessoa sem cadastro.
 * Sem reconhecimento facial automático — ver docs/modules/engajamento/SPEC.md.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays, Camera, ChevronLeft, ChevronRight, ExternalLink, ImagePlus, Images, Loader2, Plus, Search, Trash2, UserPlus, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Permissao, usePode } from '../../lib/permissoes/Permissao';
import { InstagramIcon } from '../../components/icons/InstagramIcon';
import {
  dataBr, engajamentoApi, iniciais, somarDias, ymd,
  type Marcacao, type MembroBusca, type Publicacao,
} from './engajamentoApi';
import { Avatar, Aviso, Cabecalho, Corpo, Modal, Tela, Vazio, cls } from './ui';

// literal partido: "image/*" num atributo abre comentário para o script da árvore de permissões
const ACEITA_IMAGEM = 'image/' + '*';

export default function EngajamentoFotos() {
  const [de, setDe] = useState(() => somarDias(ymd(new Date()), -60));
  const [ate, setAte] = useState(() => ymd(new Date()));
  const [q, setQ] = useState('');
  const [pendentes, setPendentes] = useState(false);

  const [lista, setLista] = useState<Publicacao[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setLista((await engajamentoApi.publicacoes({ de, ate, churchId: null, q, pendentes })).publicacoes);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar as fotos.');
    } finally {
      setCarregando(false);
    }
  }, [de, ate, q, pendentes]);

  return (
    <Tela>
      <Cabecalho
        icone={<Images className="h-5 w-5" strokeWidth={1.8} />}
        titulo="Fotos e marcações"
        acoes={
          <Permissao chave="engajamento_fotos.fotos.nova" rotulo="Nova publicação (enviar fotos)" herda="engajamento_fotos.view">
            <button type="button" onClick={() => setNovaAberta(true)} className={cls.botaoPri}>
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              <span className="hidden md:inline">Nova publicação</span>
              <span className="md:hidden">Nova</span>
            </button>
          </Permissao>
        }
      />

      <Corpo>
        <div className="flex flex-wrap items-stretch gap-2">
          <div className="relative min-w-[220px] flex-[1_1_300px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }}
              placeholder="Título ou legenda"
              className="h-[52px] w-full rounded-2xl border-[1.5px] border-slate-200 bg-white pl-12 pr-3.5 text-[15px] outline-none placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2 rounded-2xl border-[1.5px] border-slate-200 bg-white px-3 dark:border-slate-600 dark:bg-slate-800">
            <CalendarDays className="h-[18px] w-[18px] flex-none text-slate-500" />
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-[49px] bg-transparent text-sm tabular-nums outline-none" />
            <span className="text-slate-400">→</span>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-[49px] bg-transparent text-sm tabular-nums outline-none" />
          </div>
          <button type="button" onClick={() => setPendentes((v) => !v)} className={`${cls.chip(pendentes)} h-[52px] rounded-2xl`} title="Só publicações sem ninguém marcado">
            Sem marcação
          </button>
          <button type="button" onClick={buscar} disabled={carregando} className="flex min-h-[52px] items-center gap-2 rounded-2xl bg-slate-900 px-[18px] text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900">
            {carregando ? <Loader2 className="h-[19px] w-[19px] animate-spin" /> : <Search className="h-[19px] w-[19px]" strokeWidth={2.2} />}
            <span className="hidden md:inline">{carregando ? 'Buscando...' : 'Buscar'}</span>
          </button>
        </div>

        {erro && <Aviso>{erro}</Aviso>}

        {lista === null ? (
          <Vazio
            icone={<Images className="h-6 w-6" strokeWidth={1.8} />}
            titulo="Escolha o período e clique em Buscar"
            texto="Aparecem as publicações sincronizadas do Instagram e os álbuns enviados à mão. Abra uma para marcar quem está na foto."
          />
        ) : lista.length === 0 ? (
          <Vazio
            icone={<Camera className="h-6 w-6" strokeWidth={1.8} />}
            titulo="Nenhuma publicação no período"
            texto="Sincronize o Instagram em Engajamento → Instagram ou envie as fotos do culto em Nova publicação."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {lista.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setAbertaId(p.id)}
                className="group flex animate-[egRowIn_.25s_ease_both] flex-col overflow-hidden rounded-[18px] border border-[#e8ecf1] bg-white text-left transition-shadow hover:shadow-[0_20px_40px_-16px_rgba(15,23,42,.25)] dark:border-slate-700 dark:bg-slate-800"
                style={{ animationDelay: `${Math.min(i, 24) * 15}ms` }}
              >
                <div className="relative aspect-square w-full overflow-hidden bg-[#f1f5f9] dark:bg-slate-700">
                  {p.imagens[0] && <img src={p.imagens[0]} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />}
                  <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-900 shadow-sm">{dataBr(p.dataEvento)}</span>
                  {p.imagens.length > 1 && (
                    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-1 text-xs font-bold text-white">
                      <Images className="h-3 w-3" />{p.imagens.length}
                    </span>
                  )}
                  <span
                    className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
                    style={p.marcados ? { background: '#dcfce7', color: '#166534' } : { background: '#fef3c7', color: '#a16207' }}
                  >
                    <UserPlus className="h-3 w-3" />{p.marcados ? `${p.marcados} marcado${p.marcados > 1 ? 's' : ''}` : 'Marcar pessoas'}
                  </span>
                </div>
                <div className="flex min-h-[64px] flex-col gap-0.5 p-3">
                  <span className="line-clamp-2 text-sm font-semibold">{p.titulo || p.legenda || 'Sem legenda'}</span>
                  <span className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
                    {p.origem === 'INSTAGRAM' ? <InstagramIcon className="h-3 w-3 flex-none" /> : <Camera className="h-3 w-3 flex-none" />}
                    {p.origem === 'INSTAGRAM' ? 'Instagram' : 'Enviada à mão'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Corpo>

      {abertaId && (
        <VisualizadorPublicacao
          id={abertaId}
          fechar={() => setAbertaId(null)}
          mudou={buscar}
        />
      )}
      <NovaPublicacao aberta={novaAberta} fechar={() => setNovaAberta(false)} criada={(id) => { setNovaAberta(false); setAbertaId(id); buscar(); }} />
    </Tela>
  );
}

// ─── Nova publicação (fotos enviadas à mão) ──────────────────────────────────

function NovaPublicacao({ aberta, fechar, criada }: {
  aberta: boolean; fechar: () => void; criada: (id: string) => void;
}) {
  const [dataEvento, setDataEvento] = useState(() => ymd(new Date()));
  const [titulo, setTitulo] = useState('');
  const [permalink, setPermalink] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const previas = useMemo(() => fotos.map((f) => URL.createObjectURL(f)), [fotos]);
  useEffect(() => () => previas.forEach((u) => URL.revokeObjectURL(u)), [previas]);

  const enviar = async () => {
    setErro('');
    if (!fotos.length) { setErro('Escolha ao menos uma foto.'); return; }
    const form = new FormData();
    form.set('dataEvento', dataEvento);
    form.set('titulo', titulo);
    form.set('permalink', permalink);
    fotos.forEach((f) => form.append('fotos', f));
    setEnviando(true);
    try {
      const { id } = await engajamentoApi.novaPublicacao(form);
      toast.success('Publicação criada. Agora marque quem está nas fotos.');
      setFotos([]); setTitulo(''); setPermalink('');
      criada(id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal aberto={aberta} fechar={fechar} titulo="Nova publicação">
      <div className="flex flex-col gap-4 p-5">
        <label>
          <span className={cls.rotulo}>Data do culto ou evento</span>
          <input type="date" value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} className={`${cls.campo} tabular-nums`} />
        </label>
        <label>
          <span className={cls.rotulo}>Título</span>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} placeholder="Ex.: Culto de domingo — noite" className={cls.campo} />
        </label>
        <label>
          <span className={cls.rotulo}>Link da publicação (opcional)</span>
          <input value={permalink} onChange={(e) => setPermalink(e.target.value)} placeholder="https://www.instagram.com/p/..." className={cls.campo} />
        </label>
        <div>
          <span className={cls.rotulo}>Fotos (até 10)</span>
          <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-slate-300 px-4 py-6 text-center hover:border-slate-900 dark:border-slate-600">
            <ImagePlus className="h-6 w-6 text-slate-500" />
            <span className="text-sm font-semibold">Escolher fotos</span>
            <span className="text-xs text-slate-500">JPG, PNG ou HEIC · até 15 MB cada</span>
            <input
              type="file"
              accept={ACEITA_IMAGEM}
              multiple
              className="hidden"
              onChange={(e) => setFotos(Array.from(e.target.files ?? []).slice(0, 10))}
            />
          </label>
          {fotos.length > 0 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {previas.map((u, i) => (
                <div key={u} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                  <img src={u} alt="" className="h-full w-full object-cover" />
                  <button type="button" title="Tirar" onClick={() => setFotos((l) => l.filter((_, j) => j !== i))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-900/80 text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {erro && <Aviso>{erro}</Aviso>}
      </div>
      <div className="flex justify-end gap-2 border-t border-[#e8ecf1] px-5 py-4 dark:border-slate-700">
        <button type="button" onClick={fechar} className={cls.botaoSec}>Cancelar</button>
        <Permissao chave="engajamento_fotos.fotos.nova" rotulo="Nova publicação (enviar fotos)" herda="engajamento_fotos.view">
          <button type="button" onClick={enviar} disabled={enviando} className={cls.botaoPri}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {enviando ? 'Enviando...' : 'Enviar fotos'}
          </button>
        </Permissao>
      </div>
    </Modal>
  );
}

// ─── Visualizador: foto grande + marcações ──────────────────────────────────

function VisualizadorPublicacao({ id, fechar, mudou }: {
  id: string; fechar: () => void; mudou: () => void;
}) {
  const [pub, setPub] = useState<Publicacao | null>(null);
  const [marcacoes, setMarcacoes] = useState<Marcacao[]>([]);
  const [indice, setIndice] = useState(0);
  const [erro, setErro] = useState('');

  const [dataEvento, setDataEvento] = useState('');
  const [titulo, setTitulo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const podeEditar = usePode()('engajamento_fotos.fotos.editar');

  const aplicar = (r: { publicacao: Publicacao; marcacoes: Marcacao[] }) => {
    setPub(r.publicacao);
    setMarcacoes(r.marcacoes);
    setDataEvento(r.publicacao.dataEvento);
    setTitulo(r.publicacao.titulo ?? '');
  };
  const falhou = (e: unknown) => setErro(e instanceof Error ? e.message : 'Não foi possível abrir.');
  const carregar = () => engajamentoApi.publicacao(id).then(aplicar).catch(falhou);
  useEffect(() => {
    let vivo = true;
    engajamentoApi.publicacao(id)
      .then((r) => { if (vivo) aplicar(r); })
      .catch((e) => { if (vivo) falhou(e); });
    return () => { vivo = false; };
  }, [id]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') setIndice((i) => Math.min(i + 1, (pub?.imagens.length ?? 1) - 1));
      if (e.key === 'ArrowLeft') setIndice((i) => Math.max(i - 1, 0));
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [pub]);

  const alterado = pub && (dataEvento !== pub.dataEvento || titulo !== (pub.titulo ?? ''));

  const salvar = async () => {
    if (!pub) return;
    setSalvando(true);
    try {
      await engajamentoApi.editarPublicacao(pub.id, { dataEvento, titulo: titulo || null });
      toast.success('Publicação atualizada.');
      await carregar();
      mudou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!pub || !window.confirm('Tirar esta publicação da análise? As marcações dela deixam de contar.')) return;
    try {
      await engajamentoApi.excluirPublicacao(pub.id);
      toast.success('Publicação removida.');
      mudou();
      fechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível remover.');
    }
  };

  const desmarcar = async (m: Marcacao) => {
    if (!pub) return;
    try {
      await engajamentoApi.desmarcar(pub.id, m.id);
      setMarcacoes((l) => l.filter((x) => x.id !== m.id));
      mudou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível desmarcar.');
    }
  };

  return (
    <Modal aberto fechar={fechar} titulo={pub ? `${dataBr(pub.dataEvento)} · ${pub.titulo || (pub.origem === 'INSTAGRAM' ? 'Publicação do Instagram' : 'Fotos do culto')}` : 'Carregando...'} largura={1180}>
      {erro ? (
        <div className="p-5"><Aviso>{erro}</Aviso></div>
      ) : !pub ? (
        <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Abrindo publicação...</div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Foto */}
          <div className="flex flex-col bg-[#0f172a]">
            <div className="relative flex min-h-[320px] flex-1 items-center justify-center">
              {pub.imagens[indice] && <img src={pub.imagens[indice]} alt="" className="max-h-[70vh] w-full object-contain" />}
              {pub.imagens.length > 1 && (
                <>
                  <button type="button" disabled={indice === 0} onClick={() => setIndice((i) => i - 1)} title="Foto anterior" className="absolute left-3 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-slate-900 disabled:opacity-30">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button type="button" disabled={indice === pub.imagens.length - 1} onClick={() => setIndice((i) => i + 1)} title="Próxima foto" className="absolute right-3 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-slate-900 disabled:opacity-30">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <span className="absolute bottom-3 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white tabular-nums">{indice + 1} / {pub.imagens.length}</span>
                </>
              )}
            </div>
            {pub.imagens.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {pub.imagens.map((u, i) => (
                  <button key={u} type="button" onClick={() => setIndice(i)} className={`h-14 w-14 flex-none overflow-hidden rounded-lg border-2 ${i === indice ? 'border-white' : 'border-transparent opacity-60'}`}>
                    <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Painel */}
          <div className="flex max-h-[80vh] flex-col overflow-y-auto">
            <div className="flex flex-col gap-3 border-b border-[#e8ecf1] p-4 dark:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  {pub.origem === 'INSTAGRAM' ? <InstagramIcon className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                  {pub.origem === 'INSTAGRAM' ? `Instagram${pub.publicadoEm ? ` · postado em ${dataBr(pub.publicadoEm)}` : ''}` : 'Enviada à mão'}
                </span>
                <div className="flex items-center gap-1">
                  {pub.permalink && (
                    <a href={pub.permalink} target="_blank" rel="noreferrer" title="Abrir no Instagram" className={cls.botaoIcone}><ExternalLink className="h-[18px] w-[18px]" /></a>
                  )}
                  <Permissao chave="engajamento_fotos.fotos.excluir" rotulo="Remover publicação" herda="engajamento_fotos.view">
                    <button type="button" onClick={excluir} title="Remover da análise" className={cls.botaoIconeRisco}><Trash2 className="h-[18px] w-[18px]" /></button>
                  </Permissao>
                </div>
              </div>
              {pub.legenda && <p className="line-clamp-4 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{pub.legenda}</p>}

              {podeEditar ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label>
                      <span className={cls.rotulo}>Data do culto</span>
                      <input type="date" value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} className={`${cls.campo} tabular-nums`} />
                    </label>
                    <label>
                      <span className={cls.rotulo}>Título</span>
                      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} placeholder="Ex.: Culto de domingo — noite" className={cls.campo} />
                    </label>
                  </div>
                  {alterado && (
                    <Permissao chave="engajamento_fotos.fotos.editar" rotulo="Corrigir data e título" herda="engajamento_fotos.view">
                      <button type="button" onClick={salvar} disabled={salvando} className={`${cls.botaoPri} justify-center`}>
                        {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar alterações
                      </button>
                    </Permissao>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-300">Culto em <b>{dataBr(pub.dataEvento)}</b></p>
              )}
            </div>

            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold">Pessoas na foto</span>
                <span className="rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-600 dark:bg-slate-700 dark:text-slate-200">{marcacoes.length}</span>
              </div>

              <Permissao chave="engajamento_fotos.fotos.marcar" rotulo="Marcar pessoa na foto" herda="engajamento_fotos.view">
                <MarcarPessoa
                  publicacaoId={pub.id}
                  imagemIndice={indice}
                  jaMarcados={marcacoes}
                  marcou={() => { carregar(); mudou(); }}
                />
              </Permissao>

              {marcacoes.length === 0 ? (
                <p className="rounded-2xl bg-[#f8fafc] px-4 py-5 text-center text-sm text-slate-500 dark:bg-slate-800">Ninguém marcado ainda.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-[#f1f5f9] dark:divide-slate-700">
                  {marcacoes.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 py-2">
                      <Avatar texto={iniciais(m.nome)} tamanho={36} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{m.nome}</div>
                        <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {m.memberId
                            ? `${m.rol != null ? `ROL ${m.rol}` : 'Membro'}${m.igreja ? ` · ${m.igreja}` : ''}`
                            : <span style={{ color: '#a16207' }}>Sem cadastro{m.instagram ? ` · @${m.instagram}` : ''}</span>}
                          {pub.imagens.length > 1 && ` · foto ${m.imagemIndice + 1}`}
                        </div>
                      </div>
                      <Permissao chave="engajamento_fotos.fotos.desmarcar" rotulo="Desmarcar pessoa" herda="engajamento_fotos.view">
                        <button type="button" onClick={() => desmarcar(m)} title="Desmarcar" className={cls.botaoIconeRisco}><X className="h-[18px] w-[18px]" /></button>
                      </Permissao>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function MarcarPessoa({ publicacaoId, imagemIndice, jaMarcados, marcou }: {
  publicacaoId: string; imagemIndice: number; jaMarcados: Marcacao[]; marcou: () => void;
}) {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<MembroBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [semCadastro, setSemCadastro] = useState(false);
  const [instagram, setInstagram] = useState('');
  const [gravando, setGravando] = useState(false);
  const pedido = useRef(0);
  const marcadosIds = new Set(jaMarcados.map((m) => m.memberId).filter(Boolean));

  // Busca de membro para marcar (não é tela de consulta): sugere enquanto digita.
  const sugerir = !semCadastro && termo.trim().length >= 2;
  useEffect(() => {
    if (!sugerir) return;
    const n = ++pedido.current;
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await engajamentoApi.buscarMembros(termo.trim());
        if (n === pedido.current) setResultados(r.membros);
      } catch {
        if (n === pedido.current) setResultados([]);
      } finally {
        if (n === pedido.current) setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [termo, sugerir]);

  const marcar = async (dados: { memberId?: string; nome?: string; instagram?: string }) => {
    setGravando(true);
    try {
      await engajamentoApi.marcar(publicacaoId, { ...dados, imagemIndice });
      setTermo(''); setInstagram(''); setResultados([]);
      marcou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível marcar.');
    } finally {
      setGravando(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[#e8ecf1] p-3 dark:border-slate-700">
      <div className="flex gap-1.5">
        <button type="button" onClick={() => setSemCadastro(false)} className={`${cls.chip(!semCadastro)} h-8 flex-1 justify-center px-3 text-xs`}>Membro</button>
        <button type="button" onClick={() => setSemCadastro(true)} className={`${cls.chip(semCadastro)} h-8 flex-1 justify-center px-3 text-xs`}>Sem cadastro</button>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder={semCadastro ? 'Nome da pessoa' : 'Nome ou ROL do membro'}
          className={`${cls.campo} pl-10`}
          onKeyDown={(e) => { if (e.key === 'Enter' && semCadastro && termo.trim()) marcar({ nome: termo.trim(), instagram }); }}
        />
        {buscando && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>
      {semCadastro ? (
        <>
          <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@ do Instagram (opcional)" className={cls.campo} />
          <button type="button" disabled={!termo.trim() || gravando} onClick={() => marcar({ nome: termo.trim(), instagram })} className={`${cls.botaoPri} justify-center`}>
            {gravando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Marcar
          </button>
        </>
      ) : sugerir && resultados.length > 0 && (
        <ul className="flex max-h-[260px] flex-col overflow-y-auto">
          {resultados.map((m) => {
            const ja = marcadosIds.has(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={ja || gravando}
                  onClick={() => marcar({ memberId: m.id })}
                  className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left hover:bg-[#f4f6f8] disabled:opacity-50 dark:hover:bg-slate-700"
                >
                  <Avatar texto={iniciais(m.nome)} tamanho={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{m.nome}</span>
                    <span className="block truncate text-xs text-slate-500">{m.rol != null ? `ROL ${m.rol}` : ''}{m.igreja ? ` · ${m.igreja}` : ''}</span>
                  </span>
                  <span className="text-xs font-bold text-slate-500">{ja ? 'Marcado' : <Plus className="h-4 w-4" />}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
