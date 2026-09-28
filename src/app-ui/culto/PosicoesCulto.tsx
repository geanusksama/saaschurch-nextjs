/**
 * Posições do Culto — "procuro a pessoa e anexo na posição".
 *
 * Anexa USUÁRIOS do sistema aos seis papéis do fluxo. É o cadastro que faltava:
 * medido em 27/08/2026, churches.lead_pastor_id estava NULL em 126 de 126
 * igrejas, ou seja, hoje o sistema não sabe quem é o dirigente de lugar nenhum.
 *
 * Layout em três colunas, na ordem em que a pergunta é feita:
 * hospedeira → igreja dela → quem responde por cada posição.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  UserPlus,
  Trash2,
  Loader2,
  AlertTriangle,
  Building2,
  Church,
  ChevronRight,
  Power,
  X,
  UserCheck,
} from 'lucide-react';
import { apiBase } from '../../lib/apiBase';
import MembroBusca, { telefoneDoMembro, type MembroOpcao } from '../system/MembroBusca';
import { cultoApi, ROTULO_PAPEL, type Papel, type Posicao } from './cultoApi';

// O dirigente vem primeiro: é a pergunta que se faz ao clicar numa igreja.
const PAPEIS_DA_IGREJA: Papel[] = [
  'APROVADOR_LOCAL',
  'FINANCEIRO',
  'PRESENCA',
  'EXTRA',
  'APROVADOR_HOSPEDEIRA',
];

const AJUDA_PAPEL: Record<Papel, string> = {
  FINANCEIRO: 'Lança total e quantidade de dízimos e ofertas. Não vê os outros blocos.',
  PRESENCA: 'Lança a contagem de pessoas e as cadeiras vazias. Não vê os outros blocos.',
  EXTRA: 'Lança o complemento livre do culto. Não vê os outros blocos.',
  APROVADOR_LOCAL: 'Vê os três blocos juntos e aprova ou devolve o culto desta igreja.',
  APROVADOR_HOSPEDEIRA:
    'Vê as igrejas hospedadas em verde/vermelho e aprova cada uma. Só existe na hospedeira.',
  PRESIDENTE: 'Pastor Presidente: só assiste o painel do campo. Não aprova.',
};

interface IgrejaOpcao {
  id: string;
  name: string;
  code?: string | null;
  regionalId?: string | null;
  isHost?: boolean;
  hostChurchId?: string | null;
  currentLeaderName?: string | null;
}

/**
 * Chave da regional. O `regionalId` é a fonte de verdade; o código da igreja
 * (`01-002-054` = campo 01, regional 002, igreja 054) entra como reserva para
 * os cadastros antigos que ficaram sem regional vinculada.
 */
function chaveRegional(c?: IgrejaOpcao | null): string | null {
  if (!c) return null;
  if (c.regionalId) return c.regionalId;
  const partes = (c.code ?? '').split('-');
  return partes.length >= 2 ? `${partes[0]}-${partes[1]}` : null;
}

interface UsuarioOpcao {
  id: string;
  fullName: string;
  email: string;
  profileType: string;
  role?: { name: string } | null;
  church?: { id: string; name: string } | null;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('mrm_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function PosicoesCulto() {
  const [igrejas, setIgrejas] = useState<IgrejaOpcao[]>([]);
  const [hostId, setHostId] = useState<string>('');
  const [churchId, setChurchId] = useState<string>('');
  const [buscaHost, setBuscaHost] = useState('');
  const [buscaIgreja, setBuscaIgreja] = useState('');
  // Cache por igreja: cada igreja é consultada UMA vez. Reclicar numa que já
  // foi aberta não volta ao banco — só a troca real de igreja e as mutações
  // (anexar/remover/ativar) disparam consulta, e sempre de uma igreja só.
  const [cache, setCache] = useState<Record<string, Posicao[]>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [anexandoPapel, setAnexandoPapel] = useState<Papel | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/churches?slim=1`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d: IgrejaOpcao[]) => {
        const lista = Array.isArray(d) ? d : [];
        setIgrejas(lista);
        const primeiraHost = lista.find((c) => c.isHost);
        if (primeiraHost) {
          setHostId(primeiraHost.id);
          setChurchId(primeiraHost.id);
        } else if (lista.length) {
          setChurchId(lista[0].id);
        }
      })
      .catch(() => setErro('Não foi possível carregar a lista de igrejas.'));
  }, []);

  // Invalida só a igreja mexida e deixa o efeito buscar de novo.
  const recarregar = useCallback(() => {
    setCache((c) => {
      const n = { ...c };
      delete n[churchId];
      return n;
    });
  }, [churchId]);

  useEffect(() => {
    if (!churchId || cache[churchId]) return;
    let vivo = true;
    cultoApi
      .listarPosicoes(churchId)
      .then((p) => {
        if (!vivo) return;
        setErro(null);
        setCache((c) => ({ ...c, [churchId]: p }));
      })
      .catch((e) => vivo && setErro((e as Error).message));
    return () => {
      vivo = false;
    };
  }, [churchId, cache]);

  const posicoes = cache[churchId] ?? [];
  const carregando = Boolean(churchId) && !cache[churchId] && !erro;

  const hospedeiras = useMemo(() => igrejas.filter((c) => c.isHost), [igrejas]);

  const hostAtual = hospedeiras.find((c) => c.id === hostId);

  // Igrejas solteiras da MESMA regional da hospedeira selecionada: nem
  // hospedeiras, nem hospedadas por ninguém. É o buraco que precisa ser tampado
  // dentro daquela regional — não faz sentido listar as das outras.
  const solteiras = useMemo(() => {
    const regional = chaveRegional(hostAtual);
    if (!regional) return [];
    return igrejas.filter(
      (c) => !c.isHost && !c.hostChurchId && chaveRegional(c) === regional,
    );
  }, [igrejas, hostAtual]);

  const contagemPorHost = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const c of igrejas) {
      if (c.hostChurchId) mapa.set(c.hostChurchId, (mapa.get(c.hostChurchId) ?? 0) + 1);
    }
    return mapa;
  }, [igrejas]);

  const hospedeirasFiltradas = useMemo(() => {
    const t = buscaHost.trim().toLowerCase();
    if (!t) return hospedeiras;
    return hospedeiras.filter((c) => c.name.toLowerCase().includes(t));
  }, [hospedeiras, buscaHost]);


  // Coluna do meio: só as hospedadas. A própria hospedeira já abre na coluna 3
  // no clique da coluna 1, então não precisa se repetir aqui.
  const hospedadas = useMemo(
    () => igrejas.filter((c) => c.hostChurchId === hostId && c.id !== hostId),
    [igrejas, hostId],
  );

  const filtrarPorBusca = useCallback(
    (lista: IgrejaOpcao[]) => {
      const t = buscaIgreja.trim().toLowerCase();
      if (!t) return lista;
      return lista.filter((c) => c.name.toLowerCase().includes(t));
    },
    [buscaIgreja],
  );

  const hospedadasFiltradas = useMemo(
    () => filtrarPorBusca(hospedadas),
    [hospedadas, filtrarPorBusca],
  );
  const solteirasFiltradas = useMemo(
    () => filtrarPorBusca(solteiras),
    [solteiras, filtrarPorBusca],
  );

  const igrejaAtual = igrejas.find((c) => c.id === churchId);

  function selecionarHost(id: string) {
    setHostId(id);
    setBuscaIgreja('');
    // Abre já na própria hospedeira — ela também tem culto para fechar.
    setChurchId(id);
  }

  async function remover(id: string) {
    try {
      await cultoApi.removerPosicao(id);
      recarregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function alternar(p: Posicao) {
    try {
      await cultoApi.alternarPosicao(p.id, !p.isActive);
      recarregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const papeisVisiveis = PAPEIS_DA_IGREJA.filter(
    (papel) => papel !== 'APROVADOR_HOSPEDEIRA' || igrejaAtual?.isHost,
  );

  return (
    <div className="p-6 flex flex-col gap-4 h-[calc(100vh-4rem)] min-h-0">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Posições do Culto</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Escolha a hospedeira, depois a igreja, e anexe quem lança e quem aprova o culto dela. São
          usuários do sistema — quem envia e quem aprova precisa conseguir entrar.
        </p>
      </div>

      {erro && (
        <div className="shrink-0 flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[17rem_20rem_1fr] gap-4 flex-1 min-h-0">
        {/* ── Coluna 1: hospedeiras ─────────────────────────────────────── */}
        <section className="flex flex-col min-h-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="shrink-0 px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                1. Hospedeiras
              </h2>
              <span className="text-[11px] text-slate-400">{hospedeiras.length}</span>
            </div>
            <div className="relative mt-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={buscaHost}
                onChange={(e) => setBuscaHost(e.target.value)}
                placeholder="Buscar hospedeira…"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {hospedeirasFiltradas.map((c) => (
              <ItemLista
                key={c.id}
                ativo={hostId === c.id}
                onClick={() => selecionarHost(c.id)}
                titulo={c.name}
                subtitulo={`${contagemPorHost.get(c.id) ?? 0} igreja(s) hospedada(s)`}
                icone={<Building2 className="w-4 h-4" />}
              />
            ))}
            {hospedeirasFiltradas.length === 0 && (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">Nenhuma hospedeira.</p>
            )}
          </div>
        </section>

        {/* ── Coluna 2: igrejas da hospedeira ───────────────────────────── */}
        <section className="flex flex-col min-h-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="shrink-0 px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                2. Hospedadas
              </h2>
              <span className="text-[11px] text-slate-400">{hospedadasFiltradas.length}</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
              {hostAtual?.name ?? '—'}
            </p>

            <div className="relative mt-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={buscaIgreja}
                onChange={(e) => setBuscaIgreja(e.target.value)}
                placeholder="Buscar igreja…"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {hospedadasFiltradas.map((c) => (
              <ItemLista
                key={c.id}
                ativo={churchId === c.id}
                onClick={() => setChurchId(c.id)}
                titulo={c.name}
                subtitulo={c.currentLeaderName || 'Dirigente não informado no cadastro'}
                icone={<Church className="w-4 h-4" />}
              />
            ))}
            {hospedadasFiltradas.length === 0 && (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">
                Nenhuma igreja hospedada.
              </p>
            )}

            {solteirasFiltradas.length > 0 && (
              <>
                <div className="mt-2 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-4 py-1.5 border-y border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  Solteiras desta regional · {solteirasFiltradas.length}
                </div>
                {solteirasFiltradas.map((c) => (
                  <ItemLista
                    key={c.id}
                    ativo={churchId === c.id}
                    onClick={() => setChurchId(c.id)}
                    titulo={c.name}
                    subtitulo={c.currentLeaderName || 'Dirigente não informado no cadastro'}
                    icone={<Church className="w-4 h-4" />}
                    alerta
                  />
                ))}
              </>
            )}
          </div>
        </section>

        {/* ── Coluna 3: responsáveis da igreja ──────────────────────────── */}
        <section className="flex flex-col min-h-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="shrink-0 px-4 pt-3 pb-3 border-b border-slate-100 dark:border-slate-700">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              3. Responsáveis
            </h2>
            {igrejaAtual ? (
              <div className="mt-1 flex items-center gap-2 text-sm">
                <strong className="text-slate-900 dark:text-white">{igrejaAtual.name}</strong>
                {igrejaAtual.isHost && (
                  <span className="rounded-full bg-sky-100 dark:bg-sky-900/40 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-700 dark:text-sky-300">
                    hospedeira
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-400">Selecione uma igreja ao lado.</p>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            {carregando && (
              <div className="flex items-center gap-2 text-slate-400 py-10 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" /> Carregando…
              </div>
            )}

            {!carregando &&
              igrejaAtual &&
              papeisVisiveis.map((papel) => {
                const doPapel = posicoes.filter((p) => p.papel === papel);
                const destaque = papel === 'APROVADOR_LOCAL';
                return (
                  <div
                    key={papel}
                    className={`rounded-xl border overflow-hidden ${
                      destaque
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {ROTULO_PAPEL[papel]}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {AJUDA_PAPEL[papel]}
                        </p>
                      </div>
                      <button
                        onClick={() => setAnexandoPapel(papel)}
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Anexar
                      </button>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-700 border-t border-slate-100 dark:border-slate-700">
                      {doPapel.length === 0 && (
                        <p className="px-4 py-3 text-sm text-slate-400">Ninguém anexado.</p>
                      )}
                      {doPapel.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 px-4 py-2.5"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                              {p.user.fullName}
                              {!p.isActive && (
                                <span className="ml-2 text-[10px] uppercase font-bold text-slate-400">
                                  inativo
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {p.user.email}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => void alternar(p)}
                              title={p.isActive ? 'Desativar' : 'Reativar'}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => void remover(p.id)}
                              title="Remover"
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      </div>

      {anexandoPapel && (
        <ModalAnexarUsuario
          papel={anexandoPapel}
          churchId={churchId}
          onFechar={() => setAnexandoPapel(null)}
          onAnexado={() => {
            setAnexandoPapel(null);
            recarregar();
          }}
        />
      )}
    </div>
  );
}

/**
 * Linha das colunas 1 e 2. O estado selecionado é uma faixa verde com barra à
 * esquerda — o cinza anterior se confundia com o hover e engolia o texto.
 */
function ItemLista({
  ativo,
  onClick,
  titulo,
  subtitulo,
  icone,
  etiqueta,
  alerta,
}: {
  ativo: boolean;
  onClick: () => void;
  titulo: string;
  subtitulo?: string;
  icone: React.ReactNode;
  etiqueta?: string;
  alerta?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={
        ativo
          ? {
              backgroundColor: 'var(--theme-soft-bg)',
              borderLeftColor: 'var(--theme-primary)',
              color: 'var(--theme-primary)',
            }
          : undefined
      }
      className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 border-l-[3px] focus:outline-none transition ${
        ativo ? '' : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-900/60'
      }`}
    >
      <span className={`shrink-0 ${ativo ? '' : alerta ? 'text-amber-500' : 'text-slate-400'}`}>
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm truncate ${
            ativo ? 'font-semibold' : 'font-medium text-slate-700 dark:text-slate-200'
          }`}
        >
          {titulo}
        </span>
        {subtitulo && (
          <span className="block text-[11px] truncate text-slate-500 dark:text-slate-400">
            {subtitulo}
          </span>
        )}
      </span>
      {etiqueta && (
        <span className="shrink-0 text-[9px] font-bold uppercase text-sky-600 dark:text-sky-400">
          {etiqueta}
        </span>
      )}
      <ChevronRight
        className={`w-4 h-4 shrink-0 ${ativo ? '' : 'text-slate-300 dark:text-slate-600'}`}
      />
    </button>
  );
}

function ModalAnexarUsuario({
  papel,
  churchId,
  onFechar,
  onAnexado,
}: {
  papel: Papel;
  churchId: string;
  onFechar: () => void;
  onAnexado: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  // Começa pelos usuários da própria igreja: é onde está o tesoureiro e o
  // secretário. O toggle amplia para o campo quando o dirigente não é de lá.
  const [soDaIgreja, setSoDaIgreja] = useState(true);
  // Atalho: quem vai lançar ou aprovar ainda não tem usuário, mas é membro.
  // Cria o usuário a partir do cadastro dele e já anexa, sem sair daqui.
  const [criando, setCriando] = useState(false);
  const [membro, setMembro] = useState<MembroOpcao | null>(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  // Posições de culto que cada usuário já ocupa, no campo todo: sem isso a
  // lista não dizia se a pessoa já é tesoureiro em outra igreja.
  const [posicoesPorUsuario, setPosicoesPorUsuario] = useState<Map<string, Posicao[]>>(new Map());

  useEffect(() => {
    let vivo = true;
    cultoApi
      .listarPosicoes()
      .then((lista) => {
        if (!vivo) return;
        const mapa = new Map<string, Posicao[]>();
        for (const p of lista) {
          if (!p.isActive || !p.user?.id) continue;
          mapa.set(p.user.id, [...(mapa.get(p.user.id) ?? []), p]);
        }
        setPosicoesPorUsuario(mapa);
      })
      .catch(() => {
        /* sem as posições, a lista continua — só sem esse detalhe */
      });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setBuscando(true);
      setErro(null);
      const params = new URLSearchParams({ limit: '30' });
      if (busca.trim()) params.set('search', busca.trim());
      if (soDaIgreja && churchId) params.set('churchId', churchId);
      fetch(`${apiBase}/users?${params}`, { headers: authHeaders() })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d?.error || 'Falha ao buscar usuários.');
          setUsuarios(Array.isArray(d) ? d : (d.data ?? []));
        })
        .catch((e) => setErro((e as Error).message))
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(t);
  }, [busca, soDaIgreja, churchId]);

  /**
   * Cria o login (Supabase Auth), o perfil e anexa — na mesma ordem da tela
   * Novo Usuário. A senha é obrigatória aqui: sem ela só o perfil seria
   * criado, e quem é anexado precisa conseguir entrar.
   */
  async function criarEAnexar() {
    if (!membro) return;
    const emailLimpo = email.trim().toLowerCase();
    if (!emailLimpo) {
      setErro('O e-mail é obrigatório: é com ele que a pessoa entra no sistema.');
      return;
    }
    if (senha.length < 6) {
      setErro('A senha precisa de pelo menos 6 caracteres.');
      return;
    }
    setSalvandoNovo(true);
    setErro(null);
    try {
      const json = { 'Content-Type': 'application/json', ...authHeaders() };
      const auth = await fetch(`${apiBase}/users/create-supabase-auth`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ email: emailLimpo, password: senha }),
      });
      // 409 = o login já existe; o perfil pode faltar, então segue (como na
      // tela Novo Usuário). Qualquer outro erro para aqui.
      if (!auth.ok && auth.status !== 409) {
        const d = await auth.json().catch(() => ({}));
        throw new Error(d.error || `Erro ${auth.status} ao criar o login.`);
      }

      const perfil = await fetch(`${apiBase}/users`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify({
          fullName: membro.fullName,
          email: emailLimpo,
          phone: telefoneDoMembro(membro) || undefined,
          profileType: 'church',
          // A igreja do membro; regional e campo o servidor deriva dela.
          churchId: membro.churchId,
        }),
      });
      const novo = await perfil.json().catch(() => ({}));
      if (perfil.status === 409) {
        throw new Error(
          'Já existe um usuário com este e-mail. Busque-o na lista acima — desmarque "Somente usuários desta igreja" se ele for de outra igreja.',
        );
      }
      if (!perfil.ok || !novo?.id) throw new Error(novo?.error || `Erro ${perfil.status} ao criar o usuário.`);

      await cultoApi.anexarPosicao({ userId: novo.id, papel, churchId });
      onAnexado();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvandoNovo(false);
    }
  }

  async function anexar(userId: string) {
    setSalvandoId(userId);
    setErro(null);
    try {
      await cultoApi.anexarPosicao({ userId, papel, churchId });
      onAnexado();
    } catch (e) {
      setErro((e as Error).message);
      setSalvandoId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onFechar}>
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Anexar como</p>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{ROTULO_PAPEL[papel]}</h3>
          </div>
          <button
            onClick={onFechar}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar usuário por nome ou e-mail…"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={soDaIgreja}
              onChange={(e) => setSoDaIgreja(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
            />
            Somente usuários desta igreja
          </label>

          {erro && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {erro}
            </div>
          )}

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg">
            {buscando && (
              <div className="flex items-center gap-2 justify-center py-8 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Buscando…
              </div>
            )}
            {!buscando && usuarios.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                Nenhum usuário encontrado.
              </p>
            )}
            {!buscando &&
              usuarios.map((u) => (
                <button
                  key={u.id}
                  onClick={() => void anexar(u.id)}
                  disabled={salvandoId !== null}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                      {u.fullName}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {u.email}
                      {u.role?.name ? ` · ${u.role.name}` : ''}
                    </div>
                    {/* Onde ele está cadastrado e o que já faz no culto. */}
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      Cadastro: <strong className="text-slate-700 dark:text-slate-200">{u.church?.name ?? 'sem igreja'}</strong>
                    </div>
                    {(posicoesPorUsuario.get(u.id) ?? []).length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(posicoesPorUsuario.get(u.id) ?? []).map((p) => (
                          <span
                            key={p.id}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#e0f2fe] text-[#0369a1] dark:bg-[#082f49] dark:text-[#7dd3fc]"
                          >
                            {p.rotuloPapel}
                            {p.churchName ? ` · ${p.churchName}` : ''}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400">Nenhuma posição no culto ainda.</div>
                    )}
                  </div>
                  {salvandoId === u.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                  ) : (
                    <UserPlus className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                </button>
              ))}
          </div>

          {!criando ? (
            <button
              type="button"
              onClick={() => {
                setErro(null);
                setCriando(true);
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Não está na lista? Criar a partir de um membro
            </button>
          ) : (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Criar usuário a partir de um membro
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCriando(false);
                    setMembro(null);
                    setErro(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                  title="Cancelar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!membro ? (
                <MembroBusca
                  autoFocus
                  onEscolher={(m) => {
                    setMembro(m);
                    setEmail(m.email?.trim() || '');
                    setSenha('');
                    setErro(null);
                  }}
                />
              ) : (
                <>
                  <div className="flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 px-3 py-2">
                    <UserCheck className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{membro.fullName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {membro.rol ? `ROL #${membro.rol} · ` : ''}
                        {membro.church?.name ?? 'Igreja não informada'}
                        {telefoneDoMembro(membro) ? ` · ${telefoneDoMembro(membro)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMembro(null)}
                      className="text-xs font-semibold text-slate-500 hover:underline cursor-pointer"
                    >
                      trocar
                    </button>
                  </div>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      E-mail (login) <span className="text-rose-600">*</span>
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={membro.email ? '' : 'O membro não tem e-mail no cadastro — digite'}
                      className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Senha de acesso <span className="text-rose-600">*</span>
                    </span>
                    <input
                      type="text"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Mínimo 6 caracteres — passe para a pessoa"
                      className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void criarEAnexar()}
                    disabled={salvandoNovo}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {salvandoNovo ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Criar usuário e anexar como {ROTULO_PAPEL[papel]}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
