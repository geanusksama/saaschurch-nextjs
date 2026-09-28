/**
 * Busca no cadastro de membros para criar um usuário a partir dele.
 *
 * Usada no Novo Usuário e no "Anexar" das Posições do Culto: quem vai lançar
 * ou aprovar o culto quase sempre já é membro, e redigitar nome e e-mail era
 * onde o cadastro errava. Usa a mesma rota da busca global (`/members` com
 * `limit`), que já aplica o escopo de campo/igreja de quem está logado.
 */
import { useEffect, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';

import { apiBase } from '../../lib/apiBase';

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
};

/** Telefone do membro: o celular primeiro, que é o que atende. */
export function telefoneDoMembro(m: MembroOpcao): string {
  return m.mobile?.trim() || m.phone?.trim() || '';
}

/** Consulta os membros pelo nome ou ROL, no escopo de quem está logado. */
async function buscarMembros(termo: string): Promise<MembroOpcao[]> {
  const token = localStorage.getItem('mrm_token');
  const params = new URLSearchParams({ q: termo, limit: '20', slim: '1', memberType: 'MEMBRO' });
  const r = await fetch(`${apiBase}/members?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error(`Erro ${r.status} ao buscar membros.`);
  const lista = await r.json();
  return Array.isArray(lista) ? lista : [];
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

  async function buscar() {
    const t = termo.trim();
    if (t.length < 2) {
      setErro('Digite pelo menos 2 letras do nome, ou o número do ROL.');
      return;
    }
    setBuscando(true);
    setErro(null);
    try {
      setLista(await buscarMembros(t));
      setBuscou(true);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBuscando(false);
    }
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
              placeholder="Nome ou ROL do membro"
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

          {buscou && !buscando && (
            lista.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Nenhum membro encontrado. Feche e preencha os dados à mão.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg">
                {lista.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onEscolher(m)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{m.fullName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {m.rol ? `ROL #${m.rol} · ` : ''}
                      {m.church?.name ?? '—'}
                      {m.email ? ` · ${m.email}` : ' · sem email'}
                    </p>
                  </button>
                ))}
              </div>
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
        .then((lista) => vivo && setMembros(lista))
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
