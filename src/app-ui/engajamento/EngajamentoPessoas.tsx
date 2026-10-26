/**
 * Engajamento → Pessoas.
 *
 * Cada pessoa que o reconhecimento achou nas fotos, das que mais aparecem para
 * as que menos. A equipe dá o nome (ou liga ao membro do cadastro) uma vez e
 * vale para todas as fotos. Corrige o que o sistema errou: juntar duas que são
 * a mesma pessoa, tirar um rosto que não é dela, ocultar quem não interessa.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Combine, EyeOff, ExternalLink, Eye, Loader2, ScanFace, Search, Trash2, UserCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { Permissao } from '../../lib/permissoes/Permissao';
import { dataBr, engajamentoApi, iniciais, type MembroBusca, type Pessoa, type RostoDaPessoa } from './engajamentoApi';
import { Aviso, Avatar, Cabecalho, Corpo, Modal, Tela, Vazio, cls } from './ui';

type Filtro = 'sem_nome' | 'com_nome' | 'todas' | 'ocultas';
const FILTROS: Array<{ id: Filtro; rotulo: string }> = [
  { id: 'sem_nome', rotulo: 'Sem nome' },
  { id: 'com_nome', rotulo: 'Com nome' },
  { id: 'todas', rotulo: 'Todas' },
  { id: 'ocultas', rotulo: 'Ocultas' },
];

function Rosto({ url, nome, tamanho }: { url: string | null; nome: string | null; tamanho: number }) {
  return url
    ? <img src={url} alt="" loading="lazy" className="flex-none rounded-2xl object-cover" style={{ width: tamanho, height: tamanho }} />
    : <Avatar texto={iniciais(nome ?? '?')} tamanho={tamanho} />;
}

export default function EngajamentoPessoas() {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<Filtro>('sem_nome');
  const [q, setQ] = useState('');
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aberta, setAberta] = useState<string | null>(null);

  const buscar = useCallback(async (f: Filtro, termo: string) => {
    setCarregando(true);
    setErro('');
    try {
      setPessoas((await engajamentoApi.pessoas(f === 'todas' ? '' : f, termo)).pessoas);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar as pessoas.');
    } finally {
      setCarregando(false);
    }
  }, []);

  // Abre já mostrando quem falta nomear (lista pequena, só deste campo).
  useEffect(() => {
    let vivo = true;
    engajamentoApi.pessoas('sem_nome', '')
      .then((r) => { if (vivo) setPessoas(r.pessoas); })
      .catch((e) => { if (vivo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar as pessoas.'); });
    return () => { vivo = false; };
  }, []);

  const trocarFiltro = (f: Filtro) => { setFiltro(f); buscar(f, q); };

  const apagarTudo = async () => {
    if (!window.confirm('Apagar TODOS os rostos e pessoas reconhecidas deste campo? Os nomes dados se perdem. As fotos e as marcações feitas à mão continuam.')) return;
    try {
      await engajamentoApi.apagarRostos();
      toast.success('Dados de rosto apagados.');
      buscar(filtro, q);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível apagar.');
    }
  };

  return (
    <Tela>
      <Cabecalho
        icone={<ScanFace className="h-5 w-5" strokeWidth={1.8} />}
        titulo="Pessoas nas fotos"
        acoes={
          <Permissao chave="engajamento_pessoas.pessoas.apagar_rostos" rotulo="Apagar todos os dados de rosto" herda="engajamento_pessoas.view">
            <button type="button" onClick={apagarTudo} title="Apagar todos os dados de rosto" className={`${cls.botaoSec} hover:border-[#b91c1c] hover:text-[#b91c1c]`}>
              <Trash2 className="h-4 w-4" />
              <span className="hidden md:inline">Apagar rostos</span>
            </button>
          </Permissao>
        }
      />
      <Corpo>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2 overflow-x-auto">
            {FILTROS.map((f) => (
              <button key={f.id} type="button" onClick={() => trocarFiltro(f.id)} className={cls.chip(filtro === f.id)}>{f.rotulo}</button>
            ))}
          </div>
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') buscar(filtro, q); }}
              placeholder="Buscar pelo nome (Enter)"
              className="h-[46px] w-full rounded-2xl border-[1.5px] border-slate-200 bg-white pl-12 pr-3.5 text-sm outline-none placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
          {carregando && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
        </div>

        {erro && <Aviso>{erro}</Aviso>}

        {pessoas === null ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : pessoas.length === 0 ? (
          <Vazio
            icone={<ScanFace className="h-6 w-6" strokeWidth={1.8} />}
            titulo={filtro === 'sem_nome' ? 'Ninguém sem nome' : 'Nenhuma pessoa aqui'}
            texto="As pessoas aparecem depois que você clica em Iniciar na tela do Instagram, que traz as fotos e reconhece os rostos."
          />
        ) : (
          <>
            <p className="px-1 text-xs text-slate-500">{pessoas.length} pessoa(s). Clique para dar o nome — vale para todas as fotos dela.</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
              {pessoas.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setAberta(p.id)}
                  className="flex animate-[egRowIn_.25s_ease_both] flex-col items-center gap-1.5 rounded-[18px] border border-[#e8ecf1] bg-white p-2.5 text-center transition-shadow hover:shadow-[0_20px_40px_-16px_rgba(15,23,42,.25)] dark:border-slate-700 dark:bg-slate-800"
                  style={{ animationDelay: `${Math.min(i, 40) * 10}ms` }}
                >
                  <Rosto url={p.foto} nome={p.nome} tamanho={88} />
                  <span className={`line-clamp-2 min-h-[32px] text-xs font-bold leading-4 ${p.nome ? '' : 'text-[#a16207]'}`}>{p.nome ?? 'Sem nome'}</span>
                  <span className="text-[11px] text-slate-500 tabular-nums">{p.publicacoes} foto(s) · {dataBr(p.ultima)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </Corpo>

      {aberta && (
        <FichaPessoa
          id={aberta}
          fechar={() => setAberta(null)}
          mudou={() => buscar(filtro, q)}
          abrirRelatorio={() => navigate('/app-ui/engajamento')}
        />
      )}
    </Tela>
  );
}

function FichaPessoa({ id, fechar, mudou, abrirRelatorio }: { id: string; fechar: () => void; mudou: () => void; abrirRelatorio: () => void }) {
  const [dados, setDados] = useState<{ pessoa: Pessoa & { nomeLivre: string | null }; rostos: RostoDaPessoa[] } | null>(null);
  const [erro, setErro] = useState('');
  const [nome, setNome] = useState('');
  const [membro, setMembro] = useState<MembroBusca | null>(null);
  const [sugestoes, setSugestoes] = useState<MembroBusca[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [juntando, setJuntando] = useState(false);
  const pedido = useRef(0);

  const aplicar = (r: { pessoa: Pessoa & { nomeLivre: string | null }; rostos: RostoDaPessoa[] }) => {
    setDados(r);
    setNome(r.pessoa.memberId ? '' : (r.pessoa.nomeLivre ?? ''));
    setMembro(r.pessoa.memberId ? { id: r.pessoa.memberId, nome: r.pessoa.nome ?? '', rol: r.pessoa.rol, igreja: null, titulo: null } : null);
  };
  const recarregar = () => engajamentoApi.pessoa(id).then(aplicar).catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível abrir.'));
  useEffect(() => {
    let vivo = true;
    engajamentoApi.pessoa(id)
      .then((r) => { if (vivo) aplicar(r); })
      .catch((e) => { if (vivo) setErro(e instanceof Error ? e.message : 'Não foi possível abrir.'); });
    return () => { vivo = false; };
  }, [id]);

  // sugere membros do cadastro enquanto digita o nome
  const sugerir = !membro && nome.trim().length >= 3;
  useEffect(() => {
    if (!sugerir) return;
    const n = ++pedido.current;
    const t = setTimeout(() => {
      engajamentoApi.buscarMembros(nome.trim())
        .then((r) => { if (n === pedido.current) setSugestoes(r.membros.slice(0, 6)); })
        .catch(() => undefined);
    }, 300);
    return () => clearTimeout(t);
  }, [nome, sugerir]);

  const salvar = async () => {
    if (!dados) return;
    setSalvando(true);
    try {
      await engajamentoApi.editarPessoa(id, { memberId: membro?.id ?? null, nome: membro ? null : nome });
      toast.success('Nome salvo para todas as fotos.');
      mudou();
      fechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const ocultar = async (oculta: boolean) => {
    try {
      await engajamentoApi.editarPessoa(id, { oculta });
      toast.success(oculta ? 'Pessoa fora do relatório.' : 'Pessoa de volta ao relatório.');
      mudou();
      fechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível alterar.');
    }
  };

  const tirarRosto = async (r: RostoDaPessoa) => {
    try {
      await engajamentoApi.tirarRosto(r.id);
      mudou();
      if ((dados?.rostos.length ?? 0) <= 1) fechar();
      else recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível tirar.');
    }
  };

  const usarComoCapa = async (r: RostoDaPessoa) => {
    if (!r.foto) return;
    try {
      await engajamentoApi.editarPessoa(id, { foto: r.foto });
      recarregar();
      mudou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível trocar a foto.');
    }
  };

  const p = dados?.pessoa;
  return (
    <Modal aberto fechar={fechar} titulo={p?.nome ?? 'Quem é esta pessoa?'} largura={760}>
      {erro ? <div className="p-5"><Aviso>{erro}</Aviso></div> : !p ? (
        <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Abrindo…</div>
      ) : juntando ? (
        <EscolherOutra atual={p.id} voltar={() => setJuntando(false)} juntou={() => { mudou(); fechar(); }} />
      ) : (
        <div className="flex flex-col gap-5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <Rosto url={p.foto} nome={p.nome} tamanho={120} />
            <div className="flex flex-1 flex-col gap-2">
              <span className={cls.rotulo}>Nome</span>
              {membro ? (
                <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-slate-900 px-3 py-2 dark:border-slate-300">
                  <UserCheck className="h-4 w-4 text-[#166534]" />
                  <span className="flex-1 text-sm font-semibold">{membro.nome}{membro.rol != null ? ` · ROL ${membro.rol}` : ''}</span>
                  <button type="button" title="Trocar" onClick={() => { setMembro(null); setNome(''); }} className={cls.botaoIcone}><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <>
                  <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Digite o nome — se for membro, escolha na lista" className={cls.campo} autoFocus />
                  {sugerir && sugestoes.length > 0 && (
                    <ul className="flex flex-col rounded-xl border border-[#e8ecf1] p-1 dark:border-slate-700">
                      {sugestoes.map((m) => (
                        <li key={m.id}>
                          <button type="button" onClick={() => { setMembro(m); setSugestoes([]); }} className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-[#f4f6f8] dark:hover:bg-slate-700">
                            <UserCheck className="h-4 w-4 text-slate-500" />
                            <span className="flex-1 truncate font-semibold">{m.nome}</span>
                            <span className="text-xs text-slate-500">{m.rol != null ? `ROL ${m.rol}` : ''}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <span className="text-xs text-slate-500">Ligar ao membro do cadastro junta no relatório as fotos e as marcações dele.</span>
                </>
              )}
              <div className="mt-1 flex flex-wrap gap-2">
                <Permissao chave="engajamento_pessoas.pessoas.nomear" rotulo="Dar nome / ligar ao membro" herda="engajamento_pessoas.view">
                  <button type="button" onClick={salvar} disabled={salvando || (!membro && !nome.trim())} className={cls.botaoPri}>
                    {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar nome
                  </button>
                </Permissao>
                <Permissao chave="engajamento_pessoas.pessoas.juntar" rotulo="Juntar com outra pessoa" herda="engajamento_pessoas.view">
                  <button type="button" onClick={() => setJuntando(true)} className={cls.botaoSec} title="O sistema separou a mesma pessoa em duas">
                    <Combine className="h-4 w-4" /> É a mesma que…
                  </button>
                </Permissao>
                <Permissao chave="engajamento_pessoas.pessoas.ocultar" rotulo="Ocultar do relatório" herda="engajamento_pessoas.view">
                  <button type="button" onClick={() => ocultar(!p.oculta)} className={cls.botaoSec} title={p.oculta ? 'Voltar ao relatório' : 'Não contar no relatório'}>
                    {p.oculta ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} {p.oculta ? 'Mostrar' : 'Ocultar'}
                  </button>
                </Permissao>
                <button type="button" onClick={abrirRelatorio} className="text-xs font-semibold text-slate-500 underline">Ver relatório</button>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[15px] font-bold">Aparece em {dados.rostos.length} foto(s)</div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {dados.rostos.map((r) => (
                <div key={r.id} className="group relative overflow-hidden rounded-xl border border-[#e8ecf1] dark:border-slate-700">
                  <button type="button" onClick={() => usarComoCapa(r)} title="Usar como foto da pessoa" className="block w-full">
                    {r.foto && <img src={r.foto} alt="" loading="lazy" className="aspect-square w-full object-cover" />}
                  </button>
                  <div className="flex items-center justify-between gap-1 px-1.5 py-1 text-[11px] tabular-nums text-slate-600 dark:text-slate-300">
                    {dataBr(r.dataEvento)}
                    {r.permalink && <a href={r.permalink} target="_blank" rel="noreferrer" title="Abrir no Instagram"><ExternalLink className="h-3 w-3" /></a>}
                  </div>
                  <Permissao chave="engajamento_pessoas.pessoas.tirar_rosto" rotulo="Tirar rosto (não é esta pessoa)" herda="engajamento_pessoas.view">
                    <button type="button" onClick={() => tirarRosto(r)} title="Não é esta pessoa" className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-[#b91c1c] opacity-0 shadow group-hover:opacity-100 focus:opacity-100">
                      <X className="h-4 w-4" />
                    </button>
                  </Permissao>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function EscolherOutra({ atual, voltar, juntou }: { atual: string; voltar: () => void; juntou: () => void }) {
  const [lista, setLista] = useState<Pessoa[] | null>(null);
  const [gravando, setGravando] = useState(false);
  useEffect(() => {
    let vivo = true;
    engajamentoApi.pessoas('', '').then((r) => { if (vivo) setLista(r.pessoas.filter((p) => p.id !== atual)); }).catch(() => { if (vivo) setLista([]); });
    return () => { vivo = false; };
  }, [atual]);

  const juntar = async (outra: Pessoa) => {
    if (!window.confirm(`Juntar com ${outra.nome ?? 'esta pessoa'}? Os rostos dela passam para esta.`)) return;
    setGravando(true);
    try {
      await engajamentoApi.juntarPessoas(atual, outra.id);
      toast.success('Pessoas juntadas.');
      juntou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível juntar.');
      setGravando(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Escolha a outra foto da mesma pessoa</span>
        <button type="button" onClick={voltar} className={cls.botaoSec}>Voltar</button>
      </div>
      {!lista ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : (
        <div className="grid max-h-[60vh] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
          {lista.map((p) => (
            <button key={p.id} type="button" disabled={gravando} onClick={() => juntar(p)} className="flex flex-col items-center gap-1 rounded-xl p-1.5 hover:bg-[#f4f6f8] disabled:opacity-50 dark:hover:bg-slate-700">
              <Rosto url={p.foto} nome={p.nome} tamanho={72} />
              <span className="line-clamp-1 text-[11px] font-semibold">{p.nome ?? 'Sem nome'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
