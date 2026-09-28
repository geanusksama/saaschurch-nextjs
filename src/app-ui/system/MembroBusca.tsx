/**
 * Busca no cadastro de membros para criar um usuário a partir dele.
 *
 * Usada no Novo Usuário e no "Anexar" das Posições do Culto: quem vai lançar
 * ou aprovar o culto quase sempre já é membro, e redigitar nome e e-mail era
 * onde o cadastro errava. Usa a mesma rota da busca global (`/members` com
 * `limit`), que já aplica o escopo de campo/igreja de quem está logado.
 */
import { useEffect, useState } from 'react';
import { Clock, Loader2, Pencil, Search, X } from 'lucide-react';

import { apiBase } from '../../lib/apiBase';
import { MemberEditDrawer } from '../../components/app-ui/MemberEditDrawer';

type TituloOpcao = { id: string; name: string; abbreviation?: string | null; level: number };

/** Membro achado na busca — só o que a criação do usuário usa. */
export type MembroOpcao = {
  id: string;
  fullName: string;
  rol?: number | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  churchId: string;
  church?: { name?: string | null } | null;
  ecclesiasticalTitle?: string | null;
  /** Funções ativas na igreja (Dirigente de congregação, Secretário…). */
  churchFunctions?: { function?: { name?: string | null } | null }[];
};

/** Nomes das funções ativas do membro. */
export function funcoesDoMembro(m: MembroOpcao): string[] {
  return (m.churchFunctions ?? [])
    .map((f) => f.function?.name?.trim())
    .filter((n): n is string => Boolean(n));
}

/** "SECRETÁRIO(a)" → "secretario": sem acento, sem "(a)", minúsculo. */
function normalizar(txt: string): string {
  return txt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Função de usuário (role) que corresponde à função do membro:
 * "DIRIGENTE DE CONGREGACAO" → "Dirigente", "SECRETARIO(a)" → "Secretário (a)".
 *
 * As funções do membro chegam da mais recente para a mais antiga (a rota
 * ordena por startDate desc), então vale a ÚLTIMA função ativa que casa com
 * alguma função de usuário. Casa quando um nome começa com o outro; se uma
 * mesma função do membro casar com duas de usuário, pula — na dúvida, quem
 * cadastra escolhe.
 */
export function funcaoSugerida<R extends { id: string; name: string }>(
  m: MembroOpcao,
  funcoes: R[],
): R | null {
  for (const f of funcoesDoMembro(m).map(normalizar).filter(Boolean)) {
    const achadas = funcoes.filter((r) => {
      const nome = normalizar(r.name);
      return nome && (f.startsWith(nome) || nome.startsWith(f));
    });
    if (achadas.length === 1) return achadas[0];
  }
  return null;
}

/**
 * Últimas buscas deste modal, por usuário logado, no localStorage — o mesmo
 * padrão de src/lib/recentSearches.ts, com chave própria para não misturar
 * com a barra de busca do topo. Conveniência de digitação: nada vai ao servidor.
 */
const MAX_RECENTES = 5;

function chaveRecentes(): string {
  try {
    const u = JSON.parse(localStorage.getItem('mrm_user') || '{}');
    return `mrm_busca_membro_usuario:${u?.id || u?.email || 'anon'}`;
  } catch {
    return 'mrm_busca_membro_usuario:anon';
  }
}

function lerRecentes(): string[] {
  try {
    const bruto = JSON.parse(localStorage.getItem(chaveRecentes()) || '[]');
    return Array.isArray(bruto) ? bruto.filter((t) => typeof t === 'string').slice(0, MAX_RECENTES) : [];
  } catch {
    return [];
  }
}

function guardarRecente(termo: string): string[] {
  const limpo = termo.trim();
  const lista = [limpo, ...lerRecentes().filter((t) => t.toLowerCase() !== limpo.toLowerCase())].slice(
    0,
    MAX_RECENTES,
  );
  try {
    localStorage.setItem(chaveRecentes(), JSON.stringify(lista));
  } catch {
    /* storage bloqueado: histórico é descartável */
  }
  return lista;
}

function limparRecentes(): void {
  try {
    localStorage.removeItem(chaveRecentes());
  } catch {
    /* idem */
  }
}

/** Telefone do membro: o celular primeiro, que é o que atende. */
export function telefoneDoMembro(m: MembroOpcao): string {
  return m.mobile?.trim() || m.phone?.trim() || '';
}

/** Consulta os membros pelo nome ou ROL, no escopo de quem está logado. */
async function consultarMembros(params: Record<string, string>): Promise<MembroOpcao[]> {
  const token = localStorage.getItem('mrm_token');
  // Sem `slim`: é ele que tira as funções (churchFunctions) da resposta.
  const qs = new URLSearchParams({ memberType: 'MEMBRO', ...params });
  const r = await fetch(`${apiBase}/members?${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error(`Erro ${r.status} ao buscar membros.`);
  const lista = await r.json();
  return Array.isArray(lista) ? lista : [];
}

/** Igrejas do campo (nome), carregadas uma vez por sessão da tela. */
let igrejasCache: Promise<{ id: string; name: string }[]> | null = null;
function igrejasDoCampo(): Promise<{ id: string; name: string }[]> {
  if (!igrejasCache) {
    const token = localStorage.getItem('mrm_token');
    igrejasCache = fetch(`${apiBase}/churches?slim=1`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => (Array.isArray(d) ? d : []))
      .catch(() => {
        igrejasCache = null;
        return [];
      });
  }
  return igrejasCache;
}

/** Até quantas igrejas o termo pode casar antes de ficar genérico demais. */
const MAX_IGREJAS = 3;

/**
 * Busca pelo nome/ROL do membro E pelo nome da igreja: "vila yolanda" traz
 * os membros de lá. Os que casam pelo nome vêm primeiro.
 */
async function buscarMembros(
  termo: string,
): Promise<{ membros: MembroOpcao[]; igrejas: string[] }> {
  const alvo = normalizar(termo);
  const [porNome, igrejas] = await Promise.all([
    consultarMembros({ q: termo, limit: '20' }),
    alvo.length >= 3 ? igrejasDoCampo() : Promise.resolve([]),
  ]);
  const casadas = igrejas.filter((c) => normalizar(c.name).includes(alvo)).slice(0, MAX_IGREJAS);
  const porIgreja = await Promise.all(
    casadas.map((c) => consultarMembros({ churchId: c.id, limit: '100' })),
  );
  const vistos = new Set<string>();
  const membros = [...porNome, ...porIgreja.flat()].filter((m) => {
    if (vistos.has(m.id)) return false;
    vistos.add(m.id);
    return true;
  });
  return { membros, igrejas: casadas.map((c) => c.name) };
}

/**
 * Busca em modal, com botão "Buscar": ocupa uma linha só na tela de origem.
 * Clicar no membro escolhe e fecha.
 */
export function MembroBuscaModal({
  onEscolher,
  onFechar,
}: {
  onEscolher: (m: MembroOpcao) => void;
  onFechar: () => void;
}) {
  const [termo, setTermo] = useState('');
  const [lista, setLista] = useState<MembroOpcao[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Edição no drawer de membro que o app já usa (Lista de Membros, busca
  // global) — na mesma tela, sem abrir outra aba.
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [recentes, setRecentes] = useState<string[]>(lerRecentes);
  const [igrejasAchadas, setIgrejasAchadas] = useState<string[]>([]);
  const [titulos, setTitulos] = useState<TituloOpcao[] | null>(null);

  function editar(id: string) {
    setEditandoId(id);
    // Os títulos são carregados na primeira edição, como no AppUI.
    if (titulos === null) {
      const token = localStorage.getItem('mrm_token');
      fetch(`${apiBase}/ecclesiastical-titles`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setTitulos(Array.isArray(d) ? d : []))
        .catch(() => setTitulos([]));
    }
  }

  function fecharEdicao() {
    setEditandoId(null);
    // Busca de novo: o e-mail cadastrado agora aparece no resultado.
    if (buscou) void buscar();
  }

  async function buscar(termoEscolhido?: string) {
    const t = (termoEscolhido ?? termo).trim();
    if (t.length < 2) {
      setErro('Digite pelo menos 2 letras do nome, ou o número do ROL.');
      return;
    }
    setBuscando(true);
    setErro(null);
    try {
      const r = await buscarMembros(t);
      setLista(r.membros);
      setIgrejasAchadas(r.igrejas);
      setBuscou(true);
      setRecentes(guardarRecente(t));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBuscando(false);
    }
  }

  // Durante a edição só o drawer aparece; ao fechar, o modal volta com a busca.
  if (editandoId) {
    return (
      <MemberEditDrawer
        memberId={editandoId}
        open
        onClose={fecharEdicao}
        onSaved={fecharEdicao}
        titles={titulos ?? []}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onFechar}>
      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Buscar membro</h3>
          <button
            type="button"
            onClick={onFechar}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          <div className="flex gap-2">
            <input
              type="text"
              autoFocus
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={(e) => {
                // Enter busca, e não submete o formulário da tela de trás.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void buscar();
                }
              }}
              placeholder="Nome, ROL ou igreja do membro"
              className="flex-1 min-w-0 px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669]/30"
            />
            <button
              type="button"
              onClick={() => void buscar()}
              disabled={buscando}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
            >
              {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </button>
          </div>

          {erro && <p className="text-sm text-[#be123c]">{erro}</p>}

          {/* Antes da primeira busca: as últimas feitas aqui, para repetir num clique. */}
          {!buscou && !buscando && recentes.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Últimas buscas</p>
                <button
                  type="button"
                  onClick={() => {
                    limparRecentes();
                    setRecentes([]);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 hover:underline cursor-pointer"
                >
                  limpar
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg">
                {recentes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTermo(t);
                      void buscar(t);
                    }}
                    className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {buscou && !buscando && (
            lista.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Nenhum membro encontrado. Feche e preencha os dados à mão.
              </p>
            ) : (
              <>
              {igrejasAchadas.length > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inclui os membros de: <strong>{igrejasAchadas.join(', ')}</strong>
                </p>
              )}
              <div className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg">
                {lista.map((m) => (
                  <div key={m.id} className="flex items-stretch hover:bg-slate-50 dark:hover:bg-slate-700">
                    <button
                      type="button"
                      onClick={() => onEscolher(m)}
                      title="Usar este membro"
                      className="flex-1 min-w-0 text-left px-4 py-2.5 cursor-pointer"
                    >
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {m.fullName}
                        {m.rol ? <span className="ml-1.5 text-xs font-normal text-slate-400">ROL #{m.rol}</span> : null}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {m.church?.name ?? '—'}
                        {m.ecclesiasticalTitle ? ` · ${m.ecclesiasticalTitle}` : ''}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {m.email ? m.email : <span className="text-[#b45309]">sem e-mail — edite o membro ou digite depois</span>}
                        {telefoneDoMembro(m) ? ` · ${telefoneDoMembro(m)}` : ''}
                      </p>
                      {funcoesDoMembro(m).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {funcoesDoMembro(m).map((f) => (
                            <span
                              key={f}
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#e0f2fe] text-[#0369a1] dark:bg-[#082f49] dark:text-[#7dd3fc]"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                    {/* Edita no drawer de membro, sem sair da tela (ex.: cadastrar
                        o e-mail que falta). */}
                    <button
                      type="button"
                      onClick={() => editar(m.id)}
                      title="Editar membro"
                      className="px-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function MembroBusca({
  onEscolher,
  autoFocus = false,
}: {
  onEscolher: (m: MembroOpcao) => void;
  autoFocus?: boolean;
}) {
  const [busca, setBusca] = useState('');
  const [membros, setMembros] = useState<MembroOpcao[]>([]);
  const [buscando, setBuscando] = useState(false);

  // Atraso de 300 ms: sem isso cada tecla era uma consulta.
  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) return;
    let vivo = true;
    const timer = setTimeout(() => {
      setBuscando(true);
      buscarMembros(termo)
        .then((r) => vivo && setMembros(r.membros))
        .catch(() => vivo && setMembros([]))
        .finally(() => vivo && setBuscando(false));
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [busca]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        type="text"
        autoFocus={autoFocus}
        value={busca}
        onChange={(e) => {
          setBusca(e.target.value);
          if (e.target.value.trim().length < 2) setMembros([]);
        }}
        placeholder="Digite o nome ou o ROL do membro"
        className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
      />
      {buscando && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
      )}
      {busca.trim().length >= 2 && !buscando && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg">
          {membros.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">Nenhum membro encontrado.</p>
          ) : (
            membros.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setBusca('');
                  setMembros([]);
                  onEscolher(m);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 border-b last:border-0 border-slate-100 dark:border-slate-700 cursor-pointer"
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{m.fullName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {m.rol ? `ROL #${m.rol} · ` : ''}
                  {m.church?.name ?? '—'}
                  {m.email ? ` · ${m.email}` : ' · sem email'}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
