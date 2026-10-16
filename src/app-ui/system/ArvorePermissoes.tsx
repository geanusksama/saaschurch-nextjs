/**
 * Árvore de componentes por tela — usada no Grupo de usuários e nas
 * Permissões do usuário.
 *
 *   Tela (raiz)              ← abre a tela / mostra no menu
 *   ├─ botões e abas reais   ← marcados no código com <Permissao>
 *   └─ Criar / Editar / Excluir  ← só se o código usa essa trava genérica
 *        └─ botões que herdam dela
 *
 * Mostra só o que existe: botão que ninguém marcou e trava genérica que nenhum
 * arquivo usa não aparecem (o "Excluir" do Dashboard, que não exclui nada).
 * Fontes: catálogo de módulos + src/lib/permissoes/arvore.generated.ts.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import {
  DEFAULT_PERMISSION_MODULES,
  PERMISSION_GROUPS,
  type ProfileKey,
} from './permissionCatalog';
import {
  ACOES_GENERICAS_EM_USO,
  COMPONENTES_PERMISSAO,
} from '../../lib/permissoes/arvore.generated';
import { ACOES_MODULO } from '../../lib/permissoes/definir';
import { podeChave } from '../../lib/permissoes/resolver';

export type Mapa = Record<string, boolean>;

interface No {
  chave: string;
  rotulo: string;
  tipo: 'tela' | 'acao' | 'componente';
  arquivos?: string[];
  filhos: No[];
}

const ROTULO_ACAO_ARVORE: Record<string, string> = {
  create: 'Criar / incluir (demais pontos)',
  edit: 'Editar / salvar alterações (demais pontos)',
  delete: 'Excluir (demais pontos)',
};

const FILHOS = new Map<string, typeof COMPONENTES_PERMISSAO>();
for (const d of COMPONENTES_PERMISSAO) FILHOS.set(d.herda, [...(FILHOS.get(d.herda) ?? []), d]);

function componentesDe(pai: string): No[] {
  return (FILHOS.get(pai) ?? []).map((d) => ({
    chave: d.chave,
    rotulo: d.rotulo,
    tipo: 'componente' as const,
    arquivos: d.arquivo ? [d.arquivo] : undefined,
    filhos: componentesDe(d.chave),
  }));
}

/** Uma raiz por tela, montada uma vez. */
export const RAIZES: { grupo: string; no: No; ocultas: string[] }[] = DEFAULT_PERMISSION_MODULES.map((m) => {
  const acoes: No[] = [];
  const ocultas: string[] = [];
  for (const a of ACOES_MODULO) {
    if (a === 'view') continue;
    const chave = `${m.key}.${a}`;
    const filhos = componentesDe(chave);
    const arquivos = ACOES_GENERICAS_EM_USO[chave];
    if (arquivos || filhos.length) {
      acoes.push({ chave, rotulo: ROTULO_ACAO_ARVORE[a], tipo: 'acao', arquivos, filhos });
    } else {
      ocultas.push(chave); // nada no código usa: segue a raiz
    }
  }
  return {
    grupo: m.group,
    ocultas,
    no: {
      chave: `${m.key}.view`,
      rotulo: m.name,
      tipo: 'tela',
      filhos: [...componentesDe(`${m.key}.view`), ...acoes],
    },
  };
});

/** Todas as chaves de uma raiz (inclusive as ocultas, que acompanham a raiz). */
function chavesDaSubarvore(no: No): string[] {
  return [no.chave, ...no.filhos.flatMap(chavesDaSubarvore)];
}

/** Pais de cada chave dentro da árvore exibida (para marcar o caminho). */
const PAIS = new Map<string, string>();
for (const { no } of RAIZES) {
  const andar = (n: No) => n.filhos.forEach((f) => { PAIS.set(f.chave, n.chave); andar(f); });
  andar(no);
}
// Ações genéricas ocultas (nada no código usa) acompanham a raiz da tela.
for (const { no, ocultas } of RAIZES) for (const k of ocultas) PAIS.set(k, no.chave);

/**
 * Valor efetivo de uma chave num grupo: explícito, senão herdado do pai na
 * árvore; pai desmarcado desmarca o filho (D7). A tela e a gravação usam esta
 * mesma conta.
 */
export function efetivoNoGrupo(valores: Mapa, chave: string, cache = new Map<string, boolean>()): boolean {
  if (cache.has(chave)) return cache.get(chave)!;
  const pai = PAIS.get(chave);
  const proprio = chave in valores ? valores[chave] === true : pai ? efetivoNoGrupo(valores, pai, cache) : false;
  const r = proprio && (pai ? efetivoNoGrupo(valores, pai, cache) : true);
  cache.set(chave, r);
  return r;
}

function ancestrais(chave: string): string[] {
  const out: string[] = [];
  let p = PAIS.get(chave);
  while (p) { out.push(p); p = PAIS.get(p); }
  return out;
}

type Props =
  | {
      modo: 'grupo';
      /** Regras explícitas do grupo. */
      valores: Mapa;
      onChange: (novo: Mapa) => void;
    }
  | {
      modo: 'usuario';
      /** Sobrescritas pessoais (ausente = padrão do perfil). */
      valores: Mapa;
      onChange: (novo: Mapa) => void;
      profileType: string;
      /**
       * Categoria (role) do usuário. Com categoria, ter QUALQUER sobrescrita
       * vira lista fechada (resolvePermission): o que não está marcado é negado.
       */
      roleId?: string | null;
      roleName?: string | null;
    };

export function ArvorePermissoes(props: Props) {
  const { modo, valores, onChange } = props;
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [busca, setBusca] = useState('');
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  /** Valor efetivo exibido para a chave. */
  const efetivo = useMemo(() => {
    if (modo === 'grupo') {
      const cache = new Map<string, boolean>();
      return (k: string) => efetivoNoGrupo(valores, k, cache);
    }
    const pt = (props as { profileType: string }).profileType as ProfileKey;
    const roleId = (props as { roleId?: string | null }).roleId ?? null;
    // Com a categoria: mostra o que vale de fato, inclusive a lista fechada.
    return (k: string) =>
      podeChave(k, { profileType: pt, modules: DEFAULT_PERMISSION_MODULES, userOverrides: valores, userRoleId: roleId });
  }, [modo, valores, props]);

  const roleIdUsuario = modo === 'usuario' ? ((props as { roleId?: string | null }).roleId ?? null) : null;
  const roleNameUsuario = modo === 'usuario' ? ((props as { roleName?: string | null }).roleName ?? null) : null;

  /**
   * Ponto de partida de uma alteração no modo usuário. Quem tem categoria e
   * ainda não tem sobrescrita está no padrão do perfil; a primeira sobrescrita
   * liga a lista fechada e o resto SUMIRIA ("permitir tudo" numa seção
   * apagava as outras). Então, antes da primeira, grava o estado atual de
   * todas as chaves — a alteração só acrescenta ou tira o que foi clicado.
   */
  function base(): Mapa {
    if (modo !== 'usuario' || !roleIdUsuario || Object.keys(valores).length > 0) return { ...valores };
    const n: Mapa = {};
    for (const { no, ocultas } of RAIZES) for (const k of [...chavesDaSubarvore(no), ...ocultas]) n[k] = efetivo(k);
    return n;
  }

  function alternarGrupo(no: No, marcar: boolean, raizOcultas: string[]) {
    const n = { ...valores };
    for (const k of chavesDaSubarvore(no)) n[k] = marcar;
    if (no.tipo === 'tela') for (const k of raizOcultas) n[k] = marcar;
    // Marcar um botão liga o caminho até a raiz — senão ele não teria efeito.
    if (marcar) for (const k of ancestrais(no.chave)) n[k] = true;
    onChange(n);
  }

  /** Usuário: padrão → permitido → bloqueado → padrão. Na raiz, vale a tela inteira. */
  function cicloUsuario(no: No, raizOcultas: string[]) {
    const atual = valores[no.chave];
    const prox: boolean | undefined = atual === undefined ? true : atual === true ? false : undefined;
    const alvo = no.tipo === 'tela' ? [...chavesDaSubarvore(no), ...raizOcultas] : [no.chave];
    const n = base();
    for (const k of alvo) {
      if (prox === undefined) delete n[k];
      else n[k] = prox;
    }
    if (prox === true) for (const k of ancestrais(no.chave)) if (!efetivo(k)) n[k] = true;
    onChange(n);
  }

  function marcarSecao(raizes: typeof RAIZES, v: boolean | undefined) {
    const n = base();
    for (const { no, ocultas } of raizes)
      for (const k of [...chavesDaSubarvore(no), ...ocultas]) {
        if (v === undefined) delete n[k];
        else n[k] = v;
      }
    onChange(n);
  }

  const t = busca.trim().toLowerCase();
  const casa = (no: No): boolean =>
    !t || no.rotulo.toLowerCase().includes(t) || no.chave.includes(t) || no.filhos.some(casa);

  const secoes = PERMISSION_GROUPS.filter((g) => !filtroGrupo || g === filtroGrupo)
    .map((g) => ({ g, raizes: RAIZES.filter((r) => r.grupo === g && casa(r.no)) }))
    .filter((s) => s.raizes.length);

  const todas = RAIZES.flatMap((r) => chavesDaSubarvore(r.no));
  const liberadas = todas.filter((k) => efetivo(k)).length;

  function Linha({ no, nivel, ocultas }: { no: No; nivel: number; ocultas: string[] }) {
    const temFilhos = no.filhos.length > 0;
    const aberto = abertos.has(no.chave) || Boolean(t);
    const val = efetivo(no.chave);
    const sub = chavesDaSubarvore(no);
    const misto = val && sub.some((k) => !efetivo(k));
    const pai = PAIS.get(no.chave);
    const paiNegado = Boolean(pai) && !efetivo(pai!);
    const explicito = valores[no.chave];

    return (
      <>
        <div
          style={{ paddingLeft: `${0.75 + nivel * 1.5}rem` }}
          className={`flex items-center gap-2 pr-4 py-1.5 ${
            no.tipo === 'tela' ? 'bg-white dark:bg-slate-800' : ''
          } ${paiNegado ? 'opacity-50' : ''}`}
        >
          <button
            type="button"
            onClick={() =>
              setAbertos((s) => {
                const n = new Set(s);
                if (n.has(no.chave)) n.delete(no.chave);
                else n.add(no.chave);
                return n;
              })
            }
            className={`w-5 shrink-0 text-slate-400 ${temFilhos ? '' : 'invisible'}`}
          >
            {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {modo === 'grupo' ? (
            <input
              type="checkbox"
              checked={val}
              ref={(el) => {
                if (el) el.indeterminate = misto;
              }}
              onChange={(e) => alternarGrupo(no, e.target.checked, ocultas)}
              className="h-4 w-4 shrink-0 rounded border-slate-300"
              title={misto ? 'Parte liberada' : val ? 'Liberado' : 'Bloqueado'}
            />
          ) : (
            <button
              type="button"
              onClick={() => cicloUsuario(no, ocultas)}
              title="Clique: padrão → permitido → bloqueado → padrão"
              className={`shrink-0 w-[5.5rem] rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${
                explicito === true
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : explicito === false
                    ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                    : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900'
              }`}
            >
              {explicito === true ? 'permitido' : explicito === false ? 'bloqueado' : `padrão: ${val ? 'sim' : 'não'}`}
            </button>
          )}

          <span
            className={`min-w-0 truncate ${
              no.tipo === 'tela'
                ? 'text-sm font-semibold text-slate-800 dark:text-slate-100'
                : 'text-sm text-slate-700 dark:text-slate-200'
            }`}
          >
            {no.rotulo}
          </span>
          {no.tipo === 'tela' && temFilhos && (
            <span className="shrink-0 text-[11px] text-slate-400">{sub.length - 1} item(ns)</span>
          )}
          {no.tipo === 'acao' && (
            <span
              className="shrink-0 rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-300"
              title={`Trava genérica usada em:\n${(no.arquivos ?? []).join('\n')}`}
            >
              genérica · {(no.arquivos ?? []).length} arquivo(s)
            </span>
          )}
          <span className="ml-auto shrink-0 text-[10px] text-slate-400 hidden md:inline" title={(no.arquivos ?? []).join('\n')}>
            {no.chave}
          </span>
        </div>
        {aberto && no.filhos.map((f) => <Linha key={f.chave} no={f} nivel={nivel + 1} ocultas={[]} />)}
      </>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {roleIdUsuario && (
        <p className="shrink-0 px-4 py-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          Usuário com a categoria <strong>{roleNameUsuario ?? 'definida'}</strong>: com sobrescritas, vale
          lista fechada — o que não estiver permitido fica bloqueado. Na primeira alteração a tela grava o
          estado atual de todas as telas, para nada sumir; depois só muda o que você clicar.
        </p>
      )}
      <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <select
          value={filtroGrupo}
          onChange={(e) => setFiltroGrupo(e.target.value)}
          className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
        >
          <option value="">Todos os módulos</option>
          {PERMISSION_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar tela, botão ou chave…"
            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
          />
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {liberadas} de {todas.length} liberado(s)
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {secoes.map(({ g, raizes }) => (
          <div key={g}>
            <div className="sticky top-0 z-10 flex items-center justify-between bg-slate-50 dark:bg-slate-900 px-4 py-1.5 border-y border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{g}</span>
              <span className="flex gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {modo === 'grupo' ? (
                  <>
                    <button type="button" onClick={() => marcarSecao(raizes, true)} className="hover:underline">marcar tudo</button>
                    <button type="button" onClick={() => marcarSecao(raizes, false)} className="hover:underline">desmarcar tudo</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => marcarSecao(raizes, true)} className="hover:underline">permitir tudo</button>
                    <button type="button" onClick={() => marcarSecao(raizes, false)} className="hover:underline">bloquear tudo</button>
                    <button type="button" onClick={() => marcarSecao(raizes, undefined)} className="hover:underline">voltar ao padrão</button>
                  </>
                )}
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {raizes.map(({ no, ocultas }) => (
                <div key={no.chave}>
                  <Linha no={no} nivel={0} ocultas={ocultas} />
                </div>
              ))}
            </div>
          </div>
        ))}
        {secoes.length === 0 && <p className="py-10 text-center text-sm text-slate-400">Nada encontrado.</p>}
      </div>
    </div>
  );
}
