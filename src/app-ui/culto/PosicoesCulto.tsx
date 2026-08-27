/**
 * Posições do Culto — "procuro a pessoa e anexo na posição".
 *
 * Anexa USUÁRIOS do sistema aos seis papéis do fluxo. É o cadastro que faltava:
 * medido em 27/08/2026, churches.lead_pastor_id estava NULL em 126 de 126
 * igrejas, ou seja, hoje o sistema não sabe quem é o dirigente de lugar nenhum.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  UserPlus,
  Trash2,
  Loader2,
  AlertTriangle,
  Building2,
  Power,
  X,
} from 'lucide-react';
import { apiBase } from '../../lib/apiBase';
import { cultoApi, ROTULO_PAPEL, type Papel, type Posicao } from './cultoApi';

const PAPEIS_DA_IGREJA: Papel[] = [
  'FINANCEIRO',
  'PRESENCA',
  'EXTRA',
  'APROVADOR_LOCAL',
  'APROVADOR_HOSPEDEIRA',
];

const AJUDA_PAPEL: Record<Papel, string> = {
  FINANCEIRO: 'Lança total e quantidade de dízimos e ofertas. Não vê os outros blocos.',
  PRESENCA: 'Lança a contagem de pessoas e as cadeiras vazias. Não vê os outros blocos.',
  EXTRA: 'Lança o complemento livre do culto. Não vê os outros blocos.',
  APROVADOR_LOCAL: 'Dirigente da igreja: vê os três blocos juntos e aprova ou devolve.',
  APROVADOR_HOSPEDEIRA:
    'Dirigente da hospedeira: vê as igrejas filhas em verde/vermelho e aprova cada uma. Cadastre na igreja hospedeira.',
  PRESIDENTE: 'Pastor Presidente: só assiste o painel do campo. Não aprova.',
};

interface IgrejaOpcao {
  id: string;
  name: string;
  isHost?: boolean;
  hostChurchId?: string | null;
}

interface UsuarioOpcao {
  id: string;
  fullName: string;
  email: string;
  profileType: string;
  role?: { name: string } | null;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('mrm_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function PosicoesCulto() {
  const [igrejas, setIgrejas] = useState<IgrejaOpcao[]>([]);
  const [churchId, setChurchId] = useState<string>('');
  const [buscaIgreja, setBuscaIgreja] = useState('');
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [anexandoPapel, setAnexandoPapel] = useState<Papel | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/churches?slim=1`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d: IgrejaOpcao[]) => {
        const lista = Array.isArray(d) ? d : [];
        setIgrejas(lista);
        if (lista.length && !churchId) setChurchId(lista[0].id);
      })
      .catch(() => setErro('Não foi possível carregar a lista de igrejas.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recarga por evento (clique numa igreja, anexar, remover), não por setState
  // síncrono dentro do efeito.
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => {
    setCarregando(true);
    setVersao((v) => v + 1);
  }, []);

  function selecionarIgreja(id: string) {
    setCarregando(true);
    setChurchId(id);
  }

  useEffect(() => {
    if (!churchId) return;
    let vivo = true;
    cultoApi
      .listarPosicoes(churchId)
      .then((p) => {
        if (!vivo) return;
        setErro(null);
        setPosicoes(p);
      })
      .catch((e) => vivo && setErro((e as Error).message))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [churchId, versao]);

  const igrejasFiltradas = useMemo(() => {
    const t = buscaIgreja.trim().toLowerCase();
    if (!t) return igrejas.slice(0, 60);
    return igrejas.filter((c) => c.name.toLowerCase().includes(t)).slice(0, 60);
  }, [igrejas, buscaIgreja]);

  const igrejaAtual = igrejas.find((c) => c.id === churchId);

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

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Posições do Culto</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Quem lança e quem aprova o fechamento do culto de cada igreja. São usuários do sistema —
          quem envia e quem aprova precisa conseguir entrar.
        </p>
      </div>

      {erro && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-[18rem_1fr] gap-5">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm h-fit">
          <div className="p-3 border-b border-slate-100 dark:border-slate-700 relative">
            <Search className="w-4 h-4 absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={buscaIgreja}
              onChange={(e) => setBuscaIgreja(e.target.value)}
              placeholder="Buscar igreja…"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div className="max-h-[28rem] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
            {igrejasFiltradas.map((c) => (
              <button
                key={c.id}
                onClick={() => selecionarIgreja(c.id)}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-900 ${
                  churchId === c.id
                    ? 'bg-emerald-500/5 font-semibold text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <span className="truncate">{c.name}</span>
                {c.isHost && (
                  <span className="shrink-0 text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400">
                    hospedeira
                  </span>
                )}
              </button>
            ))}
            {igrejasFiltradas.length === 0 && (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">Nenhuma igreja.</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {igrejaAtual && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <strong className="text-slate-900 dark:text-white">{igrejaAtual.name}</strong>
              {igrejaAtual.isHost && (
                <span className="text-xs text-sky-600 dark:text-sky-400 font-semibold">
                  é hospedeira
                </span>
              )}
            </div>
          )}

          {carregando && (
            <div className="flex items-center gap-2 text-slate-400 py-10 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Carregando…
            </div>
          )}

          {!carregando &&
            PAPEIS_DA_IGREJA.map((papel) => {
              const doPapel = posicoes.filter((p) => p.papel === papel);
              // A posição de hospedeira só faz sentido na igreja hospedeira.
              const desabilitado = papel === 'APROVADOR_HOSPEDEIRA' && !igrejaAtual?.isHost;
              return (
                <div
                  key={papel}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {ROTULO_PAPEL[papel]}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {AJUDA_PAPEL[papel]}
                      </p>
                    </div>
                    <button
                      onClick={() => setAnexandoPapel(papel)}
                      disabled={desabilitado}
                      title={
                        desabilitado
                          ? 'Marque esta igreja como hospedeira no cadastro de Igrejas primeiro.'
                          : undefined
                      }
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Anexar
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {doPapel.length === 0 && (
                      <p className="px-4 py-4 text-sm text-slate-400">Ninguém anexado.</p>
                    )}
                    {doPapel.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
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
            <h3 className="font-bold text-slate-900 dark:text-white">Anexar na posição</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{ROTULO_PAPEL[papel]}</p>
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
                  </div>
                  {salvandoId === u.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                  ) : (
                    <UserPlus className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
