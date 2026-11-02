/**
 * Posições do Culto — "procuro a pessoa e anexo na posição".
 *
 * Anexa USUÁRIOS do sistema aos seis papéis do fluxo. É o cadastro que faltava:
 * medido em 27/08/2026, churches.lead_pastor_id estava NULL em 126 de 126
 * igrejas, ou seja, hoje o sistema não sabe quem é o dirigente de lugar nenhum.
 *
 * Navegação em pastas, na ordem em que a pergunta é feita:
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
  ArrowLeft,
  ArrowUpRight,
  Users,
} from 'lucide-react';
import { apiBase } from '../../lib/apiBase';
import MembroBusca, { telefoneDoMembro, type MembroOpcao } from '../system/MembroBusca';
import {
  cultoApi,
  ROTULO_PAPEL,
  type Papel,
  type Posicao,
  type PosicaoDaFuncao,
} from './cultoApi';
import { Permissao } from '../../lib/permissoes/Permissao';

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
  // Junto vêm os titulares das funções da igreja (dirigente, secretário...),
  // que aparecem setados no card mesmo antes de virarem posição.
  const [cache, setCache] = useState<
    Record<string, { posicoes: Posicao[]; funcoes: PosicaoDaFuncao[] }>
  >({});
  const [erro, setErro] = useState<string | null>(null);
  const [anexandoPapel, setAnexandoPapel] = useState<Papel | null>(null);
  // Titular sem acesso: o modal abre direto em "criar usuário" com ele.
  const [membroInicial, setMembroInicial] = useState<MembroOpcao | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  // Só visual: nível da navegação em pastas (não mexe na seleção).
  const [nivel, setNivel] = useState<'hospedeiras' | 'hospedadas' | 'responsaveis'>('hospedeiras');

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
    Promise.all([
      cultoApi.listarPosicoes(churchId),
      // Sem as funções o quadro continua — só sem os titulares setados.
      cultoApi.listarPosicoesDaFuncao(churchId).catch(() => [] as PosicaoDaFuncao[]),
    ])
      .then(([posicoes, funcoes]) => {
        if (!vivo) return;
        setErro(null);
        setCache((c) => ({ ...c, [churchId]: { posicoes, funcoes } }));
      })
      .catch((e) => vivo && setErro((e as Error).message));
    return () => {
      vivo = false;
    };
  }, [churchId, cache]);

  const posicoes = cache[churchId]?.posicoes ?? [];
  const funcoes = cache[churchId]?.funcoes ?? [];
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

  /** Titular da função que já tem usuário: um clique vira posição. */
  async function confirmarDaFuncao(f: PosicaoDaFuncao) {
    if (!f.usuario) return;
    const chave = `${f.papel}:${f.membro.id}`;
    setConfirmando(chave);
    try {
      await cultoApi.anexarPosicao({
        userId: f.usuario.id,
        papel: f.papel,
        churchId,
        memberId: f.membro.id,
      });
      recarregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setConfirmando(null);
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

  // Só visual: qual nível da navegação em pastas está na tela. A seleção
  // (hostId/churchId) continua a mesma de antes — inclusive a automática ao
  // carregar —; aqui só se escolhe o que mostrar.
  function abrirHospedeira(id: string) {
    selecionarHost(id);
    setNivel('hospedadas');
  }

  function abrirIgreja(id: string) {
    setChurchId(id);
    setNivel('responsaveis');
  }

  function voltar() {
    setNivel((n) => (n === 'responsaveis' && hostAtual ? 'hospedadas' : 'hospedeiras'));
  }

  const campoBusca =
    'w-full rounded-[14px] border border-[#e8ecf1] dark:border-[var(--sl-border)] bg-white dark:bg-[var(--sl-solid)] pl-9 pr-3 py-2.5 text-sm text-[var(--sl-text)] placeholder:text-[var(--sl-text-4)] focus:outline-none focus:ring-2 focus:ring-[var(--sl-primary-border)]';

  return (
    <div className="p-4 sm:px-6 sm:pt-4 sm:pb-6 flex flex-col gap-4">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[var(--sl-primary-soft)] text-[var(--sl-primary)]">
          <Users className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-[var(--sl-text-3)]">Gestão de Culto</p>
          <h1 className="text-[22px] font-bold leading-tight text-[var(--sl-text)]">Posições do Culto</h1>
          <p className="mt-0.5 text-[12.5px] text-[var(--sl-text-3)]">
            Escolha a hospedeira, depois a igreja, e anexe quem lança e quem aprova o culto dela. São
            usuários do sistema — quem envia e quem aprova precisa conseguir entrar.
          </p>
        </div>
      </div>

      {/* Caminho de volta */}
      <div className="flex flex-wrap items-center gap-2">
        {nivel !== 'hospedeiras' && (
          <button
            type="button"
            onClick={voltar}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#e8ecf1] dark:border-[var(--sl-border)] bg-white dark:bg-[var(--sl-solid)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--sl-text-2)] hover:bg-[var(--sl-chip)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>
        )}
        <nav className="flex min-w-0 flex-wrap items-center gap-1 text-[13px]">
          <button
            type="button"
            onClick={() => setNivel('hospedeiras')}
            className={`cursor-pointer rounded-md px-1.5 py-0.5 hover:bg-[var(--sl-chip)] ${
              nivel === 'hospedeiras' ? 'font-bold text-[var(--sl-text)]' : 'font-medium text-[var(--sl-text-3)]'
            }`}
          >
            Hospedeiras
          </button>
          {nivel !== 'hospedeiras' && hostAtual && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--sl-text-4)]" />
              <button
                type="button"
                onClick={() => setNivel('hospedadas')}
                className={`max-w-[16rem] cursor-pointer truncate rounded-md px-1.5 py-0.5 hover:bg-[var(--sl-chip)] ${
                  nivel === 'hospedadas' ? 'font-bold text-[var(--sl-text)]' : 'font-medium text-[var(--sl-text-3)]'
                }`}
              >
                {hostAtual.name}
              </button>
            </>
          )}
          {nivel === 'responsaveis' && igrejaAtual && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--sl-text-4)]" />
              <span className="max-w-[16rem] truncate px-1.5 py-0.5 font-bold text-[var(--sl-text)]">
                {igrejaAtual.name}
              </span>
            </>
          )}
        </nav>

        {/* Busca do nível na mesma linha do caminho (antes era uma linha
            separada). Mesmos campos e estados; só mudou de lugar. */}
        {nivel === 'hospedeiras' && (
          <div className="flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto">
            <span className="text-[12.5px] text-[var(--sl-text-3)]">
              {hospedeiras.length} hospedeira(s)
            </span>
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--sl-text-4)]" />
              <input
                value={buscaHost}
                onChange={(e) => setBuscaHost(e.target.value)}
                placeholder="Buscar hospedeira…"
                className={campoBusca}
              />
            </div>
          </div>
        )}
        {nivel === 'hospedadas' && (
          <div className="flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto">
            <span className="text-[12.5px] text-[var(--sl-text-3)]">
              {hospedadasFiltradas.length} hospedada(s) · {hostAtual?.name ?? '—'}
            </span>
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--sl-text-4)]" />
              <input
                value={buscaIgreja}
                onChange={(e) => setBuscaIgreja(e.target.value)}
                placeholder="Buscar igreja…"
                className={campoBusca}
              />
            </div>
          </div>
        )}
      </div>

      {erro && (
        <div className="flex items-start gap-2 rounded-[14px] border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* ── Nível 1: hospedeiras ─────────────────────────────────────────── */}
      {nivel === 'hospedeiras' && (
        <section className="flex flex-col gap-3">
          {hospedeirasFiltradas.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-[var(--sl-border-2)] bg-[var(--sl-surface)] px-6 py-12 text-center text-sm text-[var(--sl-text-3)]">
              Nenhuma hospedeira.
              {hospedeiras.length === 0 && igrejaAtual && (
                <button
                  type="button"
                  onClick={() => setNivel('responsaveis')}
                  className="ml-2 cursor-pointer font-semibold text-[var(--sl-primary)] hover:underline"
                >
                  Abrir {igrejaAtual.name}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-5 gap-y-7 pt-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {hospedeirasFiltradas.map((c, i) => {
                const n = contagemPorHost.get(c.id) ?? 0;
                return (
                  <PastaIgreja
                    key={c.id}
                    indice={i}
                    ativa={hostId === c.id}
                    onClick={() => abrirHospedeira(c.id)}
                    titulo={c.name}
                    icone={Building2}
                    numero={n}
                    rotuloNumero={`igreja(s) hospedada(s)`}
                    chips={[c.code ? c.code : null, 'hospedeira']}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Nível 2: igrejas da hospedeira ───────────────────────────────── */}
      {nivel === 'hospedadas' && (
        <section className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-x-5 gap-y-7 pt-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {/* A própria hospedeira também tem culto para fechar. */}
            {hostAtual && (
              <PastaIgreja
                indice={0}
                ativa={churchId === hostAtual.id}
                onClick={() => abrirIgreja(hostAtual.id)}
                titulo={hostAtual.name}
                icone={Building2}
                linha={hostAtual.currentLeaderName || 'Dirigente não informado no cadastro'}
                chips={['a própria hospedeira', hostAtual.code ?? null]}
              />
            )}
            {hospedadasFiltradas.map((c, i) => (
              <PastaIgreja
                key={c.id}
                indice={i + 1}
                ativa={churchId === c.id}
                onClick={() => abrirIgreja(c.id)}
                titulo={c.name}
                icone={Church}
                linha={c.currentLeaderName || 'Dirigente não informado no cadastro'}
                chips={[c.code ?? null, 'hospedada']}
              />
            ))}
          </div>
          {hospedadasFiltradas.length === 0 && (
            <p className="px-1 text-sm text-[var(--sl-text-3)]">Nenhuma igreja hospedada.</p>
          )}

          {solteirasFiltradas.length > 0 && (
            <>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--sl-text-3)]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Solteiras desta regional · {solteirasFiltradas.length}
              </div>
              <div className="grid grid-cols-1 gap-x-5 gap-y-7 pt-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {solteirasFiltradas.map((c, i) => (
                  <PastaIgreja
                    key={c.id}
                    indice={i}
                    ativa={churchId === c.id}
                    onClick={() => abrirIgreja(c.id)}
                    titulo={c.name}
                    icone={Church}
                    linha={c.currentLeaderName || 'Dirigente não informado no cadastro'}
                    chips={[c.code ?? null]}
                    alerta
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Nível 3: responsáveis da igreja ──────────────────────────────── */}
      {nivel === 'responsaveis' && (
        <section className="flex flex-col rounded-[22px] border border-[#e8ecf1] dark:border-[var(--sl-border)] bg-white dark:bg-[var(--sl-solid)] shadow-[var(--sl-shadow)] overflow-hidden">
          <div className="px-5 pt-4 pb-4 border-b border-[#e8ecf1] dark:border-[var(--sl-border)]">
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-[var(--sl-text-3)]">
              Responsáveis
            </h2>
            {igrejaAtual ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <strong className="text-[17px] font-bold text-[var(--sl-text)]">{igrejaAtual.name}</strong>
                {igrejaAtual.isHost && (
                  <span className="rounded-full bg-[var(--sl-primary-soft)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--sl-primary)]">
                    hospedeira
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm text-[var(--sl-text-3)]">Selecione uma igreja.</p>
            )}
          </div>

          <div className="p-4 sm:p-5 space-y-3">
            {carregando && (
              <div className="flex items-center gap-2 text-[var(--sl-text-3)] py-10 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" /> Carregando…
              </div>
            )}

            {!carregando &&
              igrejaAtual &&
              papeisVisiveis.map((papel) => {
                const doPapel = posicoes.filter((p) => p.papel === papel);
                // Titular que já virou posição aparece só uma vez, como posição.
                const daFuncao = funcoes.filter(
                  (f) =>
                    f.papel === papel &&
                    !(f.usuario && doPapel.some((p) => p.user.id === f.usuario!.id)),
                );
                const destaque = papel === 'APROVADOR_LOCAL';
                return (
                  <div
                    key={papel}
                    className={`rounded-[16px] border overflow-hidden ${
                      destaque
                        ? 'border-[var(--sl-primary-border)] bg-[var(--sl-primary-soft)]'
                        : 'border-[#e8ecf1] dark:border-[var(--sl-border)] bg-white dark:bg-[var(--sl-solid)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--sl-text)]">
                          {ROTULO_PAPEL[papel]}
                        </h3>
                        <p className="text-xs text-[var(--sl-text-3)] mt-0.5">
                          {AJUDA_PAPEL[papel]}
                        </p>
                      </div>
                      <Permissao chave="culto_posicoes.posicoes_culto.anexar" rotulo="Anexar — Posicoes Culto" herda="culto_posicoes.view">
                        <button
                          onClick={() => {
                            setMembroInicial(null);
                            setAnexandoPapel(papel);
                          }}
                          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--sl-primary)] hover:bg-[var(--sl-primary-strong)] text-white text-xs font-semibold cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Anexar
                        </button>
                      </Permissao>
                    </div>

                    <div className="divide-y divide-[#e8ecf1] dark:divide-[var(--sl-border)] border-t border-[#e8ecf1] dark:border-[var(--sl-border)]">
                      {doPapel.length === 0 && daFuncao.length === 0 && (
                        <p className="px-4 py-3 text-sm text-[var(--sl-text-4)]">Ninguém anexado.</p>
                      )}
                      {daFuncao.map((f) => {
                        const chave = `${f.papel}:${f.membro.id}`;
                        return (
                          <div
                            key={chave}
                            className="flex items-center justify-between gap-3 px-4 py-2.5"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-[var(--sl-text)] truncate">
                                {f.membro.fullName}
                                <span className="ml-2 rounded bg-[var(--sl-chip)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--sl-text-2)]">
                                  pela função
                                </span>
                              </div>
                              <div className="text-xs text-[var(--sl-text-3)] truncate">
                                {f.funcao}
                                {f.membro.rol ? ` · ROL #${f.membro.rol}` : ''}
                              </div>
                              <div className="text-xs truncate">
                                {f.usuario ? (
                                  <span className="text-[var(--sl-text-3)]">
                                    Acesso: {f.usuario.email}
                                  </span>
                                ) : (
                                  <span className="text-amber-600 dark:text-amber-400">
                                    Sem acesso ao sistema — crie o acesso para ele lançar/aprovar.
                                  </span>
                                )}
                              </div>
                            </div>
                            {f.usuario ? (
                              <Permissao chave="culto_posicoes.posicoes_culto.confirmar_pela_funcao" rotulo="Confirmar titular da função — Posicoes Culto" herda="culto_posicoes.view">
                                <button
                                  onClick={() => void confirmarDaFuncao(f)}
                                  disabled={confirmando !== null}
                                  title="Gravar como posição do culto"
                                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--sl-border-2)] text-xs font-semibold text-[var(--sl-text-2)] hover:bg-[var(--sl-chip)] disabled:opacity-50 cursor-pointer"
                                >
                                  {confirmando === chave ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <UserCheck className="w-3.5 h-3.5" />
                                  )}
                                  Confirmar
                                </button>
                              </Permissao>
                            ) : (
                              <Permissao chave="culto_posicoes.posicoes_culto.criar_acesso" rotulo="Criar acesso — Posicoes Culto" herda="culto_posicoes.view">
                                <button
                                  onClick={() => {
                                    setMembroInicial(f.membro);
                                    setAnexandoPapel(papel);
                                  }}
                                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--sl-border-2)] text-xs font-semibold text-[var(--sl-text-2)] hover:bg-[var(--sl-chip)] cursor-pointer"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  Criar acesso
                                </button>
                              </Permissao>
                            )}
                          </div>
                        );
                      })}
                      {doPapel.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 px-4 py-2.5"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-[var(--sl-text)] truncate">
                              {p.user.fullName}
                              {!p.isActive && (
                                <span className="ml-2 text-[10px] uppercase font-bold text-[var(--sl-text-4)]">
                                  inativo
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[var(--sl-text-3)] truncate">
                              {p.user.email}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => void alternar(p)}
                              title={p.isActive ? 'Desativar' : 'Reativar'}
                              className="p-1.5 rounded-lg border border-[#e8ecf1] dark:border-[var(--sl-border)] text-[var(--sl-text-3)] hover:bg-[var(--sl-chip)] cursor-pointer"
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <Permissao chave="culto_posicoes.posicoes_culto.remover" rotulo="Remover — Posicoes Culto" herda="culto_posicoes.view">
                              <button
                                onClick={() => void remover(p.id)}
                                title="Remover"
                                className="p-1.5 rounded-lg border border-[#e8ecf1] dark:border-[var(--sl-border)] text-[var(--sl-text-3)] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </Permissao>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {anexandoPapel && (
        <ModalAnexarUsuario
          papel={anexandoPapel}
          churchId={churchId}
          membroInicial={membroInicial}
          onFechar={() => {
            setAnexandoPapel(null);
            setMembroInicial(null);
          }}
          onAnexado={() => {
            setAnexandoPapel(null);
            setMembroInicial(null);
            recarregar();
          }}
        />
      )}
    </div>
  );
}

// Pastas chapadas, alternando como no Pipeline da Secretaria: escuro,
// primária, branco, lilás.
const VARIANTES = [
  { card: 'bg-[var(--sl-dark)] text-white', ear: 'bg-[var(--sl-dark)]', sheet: 'bg-[color-mix(in_srgb,var(--sl-dark)_35%,white)]', sub: 'text-white/70', tile: 'bg-white/10 text-white', chip: 'bg-white/15 text-white', border: 'border-transparent' },
  { card: 'bg-[var(--sl-primary)] text-white', ear: 'bg-[var(--sl-primary)]', sheet: 'bg-[color-mix(in_srgb,var(--sl-primary)_40%,white)]', sub: 'text-white/75', tile: 'bg-white/15 text-white', chip: 'bg-white/20 text-white', border: 'border-transparent' },
  { card: 'bg-[var(--sl-solid)] text-[var(--sl-text)]', ear: 'bg-[var(--sl-solid)]', sheet: 'bg-[color-mix(in_srgb,var(--sl-primary)_22%,white)]', sub: 'text-[var(--sl-text-3)]', tile: 'bg-[var(--sl-primary-soft)] text-[var(--sl-primary)]', chip: 'bg-[var(--sl-chip)] text-[var(--sl-text-2)]', border: 'border-[var(--sl-border)]' },
  { card: 'bg-[color-mix(in_srgb,var(--sl-primary)_16%,var(--sl-solid))] text-[var(--sl-text)]', ear: 'bg-[color-mix(in_srgb,var(--sl-primary)_16%,var(--sl-solid))]', sheet: 'bg-[color-mix(in_srgb,var(--sl-primary)_32%,white)]', sub: 'text-[var(--sl-text-3)]', tile: 'bg-[var(--sl-solid)] text-[var(--sl-primary)]', chip: 'bg-[var(--sl-solid)] text-[var(--sl-text-2)]', border: 'border-transparent' },
];

/** Pasta da grade (hospedeira ou igreja). Só apresentação: o clique é do pai. */
function PastaIgreja({
  indice,
  ativa,
  onClick,
  titulo,
  icone: Icone,
  numero,
  rotuloNumero,
  linha,
  chips,
  alerta,
}: {
  indice: number;
  ativa: boolean;
  onClick: () => void;
  titulo: string;
  icone: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  numero?: number;
  rotuloNumero?: string;
  linha?: string;
  chips?: Array<string | null>;
  alerta?: boolean;
}) {
  const v = VARIANTES[indice % VARIANTES.length];
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      className="group relative block cursor-pointer text-left transition-transform duration-150 hover:-translate-y-0.5"
    >
      {/* folhas atrás da pasta */}
      <span className={`absolute -top-3 left-[38%] right-5 h-6 rounded-t-[14px] ${v.sheet} opacity-80`} />
      {/* orelha da pasta */}
      <span className={`absolute -top-2.5 left-0 h-6 w-[44%] rounded-t-[18px] ${v.ear} ${v.border === 'border-transparent' ? '' : 'border border-b-0 ' + v.border}`} />
      {/* corpo */}
      <span
        className={`relative flex min-h-[170px] flex-col rounded-[22px] rounded-tl-none border p-5 ${v.card} ${v.border} ${
          ativa ? 'ring-2 ring-[var(--sl-primary)] ring-offset-2 ring-offset-transparent' : ''
        }`}
      >
        <span className="flex items-center gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ${v.tile}`}>
            <Icone className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1 line-clamp-2 text-[17px] font-bold leading-tight">{titulo}</span>
        </span>

        {numero !== undefined && (
          <span className="mt-4 flex flex-col">
            <span className="text-[26px] font-extrabold leading-none tracking-tight">{numero}</span>
            <span className={`mt-1 text-[12px] font-medium ${v.sub}`}>{rotuloNumero}</span>
          </span>
        )}
        {linha && <span className={`mt-3 line-clamp-2 block text-[13px] ${v.sub}`}>{linha}</span>}

        <span className="mt-auto flex items-center justify-between gap-3 pt-4">
          <span className="flex min-w-0 flex-wrap gap-1.5">
            {alerta && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-amber-950">
                <AlertTriangle className="h-3 w-3" />
                solteira
              </span>
            )}
            {(chips ?? []).filter(Boolean).map((t) => (
              <span key={t} className={`max-w-[160px] truncate whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${v.chip}`}>
                {t}
              </span>
            ))}
          </span>
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${v.tile}`}>
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </span>
      </span>
    </button>
  );
}

function ModalAnexarUsuario({
  papel,
  churchId,
  membroInicial,
  onFechar,
  onAnexado,
}: {
  papel: Papel;
  churchId: string;
  /** Titular da função sem acesso: abre já em "criar usuário" com ele. */
  membroInicial?: MembroOpcao | null;
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
  const [criando, setCriando] = useState(Boolean(membroInicial));
  const [membro, setMembro] = useState<MembroOpcao | null>(membroInicial ?? null);
  const [email, setEmail] = useState(membroInicial?.email?.trim() || '');
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

      // O usuário nasceu deste membro: o servidor grava o vínculo.
      await cultoApi.anexarPosicao({ userId: novo.id, papel, churchId, memberId: membro.id });
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
            <Permissao chave="culto_posicoes.posicoes_culto.nao_esta_na_lista_criar_a_partir_de_um_m" rotulo="Não está na lista? Criar a partir de um membro — Posicoes Culto" herda="culto_posicoes.view">
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
            </Permissao>
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
                  <Permissao chave="culto_posicoes.posicoes_culto.criar_usuario_e_anexar_como" rotulo="Criar usuário e anexar como — Posicoes Culto" herda="culto_posicoes.view">
                    <button
                      type="button"
                      onClick={() => void criarEAnexar()}
                      disabled={salvandoNovo}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
                    >
                      {salvandoNovo ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      Criar usuário e anexar como {ROTULO_PAPEL[papel]}
                    </button>
                  </Permissao>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
