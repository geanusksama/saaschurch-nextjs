/**
 * Seletor de campos do cadastro — os "chips" da campanha.
 *
 * Existe porque montar o formulário pergunta a pergunta obriga quem cria a
 * campanha a adivinhar quais colunas existem em `members`. Aqui a lista vem do
 * catálogo real (MEMBER_FIELD_MAP): marcou o chip, a pergunta já nasce com
 * título, tipo e opções certos, ligada à coluna que a aprovação vai gravar.
 *
 * A lista mostra SÓ o que a campanha pode atualizar. Nome civil, filiação e
 * batismo ficam de fora — mudam por processo da secretaria, com documento.
 */

import { useMemo, useState } from 'react';
import { Check, ListChecks, Search, X } from 'lucide-react';
import {
  FIELD_TYPE_LABELS,
  memberFieldsByGroup,
  type MemberFieldKey,
} from '@/lib/secretariaCampaignFields';

const GRUPOS = memberFieldsByGroup();

/** Sem acento e em minúsculas, para a busca achar "endereco" e "endereço". */
function normalizar(v: string) {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

interface Props {
  open: boolean;
  /** campos já presentes no formulário — aparecem marcados e travados */
  jaUsados: Set<string>;
  onConfirm: (keys: MemberFieldKey[]) => void;
  onClose: () => void;
}

export function MemberFieldPickerModal({ open, jaUsados, onConfirm, onClose }: Props) {
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<Set<MemberFieldKey>>(new Set());

  const grupos = useMemo(() => {
    const alvo = normalizar(busca.trim());
    if (!alvo) return GRUPOS;
    return GRUPOS
      .map(g => ({
        group: g.group,
        fields: g.fields.filter(
          f => normalizar(f.spec.label).includes(alvo) || normalizar(g.group).includes(alvo)
        ),
      }))
      .filter(g => g.fields.length);
  }, [busca]);

  if (!open) return null;

  const alternar = (key: MemberFieldKey) =>
    setSelecionados(atual => {
      const proximo = new Set(atual);
      if (proximo.has(key)) proximo.delete(key);
      else proximo.add(key);
      return proximo;
    });

  const disponiveis = GRUPOS.flatMap(g => g.fields).filter(f => !jaUsados.has(f.key));

  const marcarTodos = () => setSelecionados(new Set(disponiveis.map(f => f.key)));

  const confirmar = () => {
    onConfirm(Array.from(selecionados));
    setSelecionados(new Set());
    setBusca('');
    onClose();
  };

  return (
    // z acima do construtor (z-50): este modal abre por cima dele
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-purple-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Campos do cadastro
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Marque o que a campanha vai pedir — cada campo vira uma pergunta pronta.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar campo (CPF, celular, CEP, zona eleitoral…)"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 focus:border-purple-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!grupos.length ? (
            <p className="py-8 text-center text-xs text-slate-400">
              Nenhum campo com esse nome. Filiação, nome civil e batismo não entram em campanha —
              são rotinas da secretaria.
            </p>
          ) : (
            grupos.map(g => (
              <div key={g.group}>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {g.group}
                </p>
                <div className="flex flex-wrap gap-2">
                  {g.fields.map(({ key, spec }) => {
                    const usado = jaUsados.has(key);
                    const marcado = selecionados.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={usado}
                        onClick={() => alternar(key)}
                        title={
                          usado
                            ? 'Já está no formulário'
                            : `Vira uma pergunta do tipo "${FIELD_TYPE_LABELS[spec.accepts[0]]}"`
                        }
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          usado
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
                            : marcado
                              ? 'border-purple-600 bg-purple-600 text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-purple-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {(marcado || usado) && <Check className="h-3.5 w-3.5" />}
                        {spec.label}
                        {usado && <span className="text-[10px]">· no formulário</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
          <button
            onClick={marcarTodos}
            className="text-[11px] font-semibold text-purple-600 hover:underline"
          >
            Marcar todos os disponíveis
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={!selecionados.size}
              className="rounded-lg bg-purple-600 px-5 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              Adicionar {selecionados.size || ''} {selecionados.size === 1 ? 'campo' : 'campos'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MemberFieldPickerModal;
