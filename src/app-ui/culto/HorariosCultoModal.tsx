/**
 * Cadastro dos horários de culto DA IGREJA, aberto de dentro do lançamento.
 *
 * Não vive em Configurações de propósito: cada congregação tem os seus (uma
 * tem três cultos, outra tem um) e quem sabe disso é quem lança o culto ali.
 * Deixar no menu de configurações obrigaria a liberar acesso administrativo
 * para uma lista que é da própria igreja.
 *
 * O isolamento é do servidor, não desta tela: /api/lookups/horarios-culto
 * carimba e filtra por church_id, então uma igreja não vê nem apaga o horário
 * da outra mesmo conhecendo o id.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { X, Loader2, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { cultoApi, type HorarioCulto } from './cultoApi';

/**
 * Código estável a partir do nome ("Culto da manhã" → "CULTO_DA_MANHA").
 *
 * O cadastro pede só nome e horário; o código existe porque é ele que
 * identifica a linha dentro da igreja, e ninguém deveria ter que inventá-lo.
 */
function codigoDoNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

interface Props {
  churchId: string | null;
  /** Fecha o modal; recebe true quando algo mudou, para o dropdown recarregar. */
  onFechar: (mudou: boolean) => void;
}

export default function HorariosCultoModal({ churchId, onFechar }: Props) {
  const [lista, setLista] = useState<HorarioCulto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState('');
  const [hora, setHora] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mudou, setMudou] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setLista(await cultoApi.listarHorariosCulto(churchId));
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [churchId]);

  // A carga inicial não passa por `carregar` porque aquele acende o
  // "carregando" antes do await — e setState síncrono dentro de efeito dispara
  // renderização em cascata (regra react-hooks/set-state-in-effect).
  useEffect(() => {
    let vivo = true;
    cultoApi
      .listarHorariosCulto(churchId)
      .then((l) => {
        if (!vivo) return;
        setLista(l);
        setErro(null);
      })
      .catch((e) => vivo && setErro((e as Error).message))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [churchId]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const limpo = nome.trim();
    if (!limpo) {
      setErro('Dê um nome ao horário. Ex.: Culto da manhã.');
      return;
    }
    if (!hora) {
      setErro('Informe a hora em que o culto começa.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await cultoApi.criarHorarioCulto({
        codigo: codigoDoNome(limpo),
        nome: limpo,
        hora_inicio: hora,
        hora_fim: horaFim || null,
        // Entra no fim da lista; quem ordena de fato é o próprio horário.
        ordem: lista.length + 1,
        churchId,
      });
      setNome('');
      setHora('');
      setHoraFim('');
      setMudou(true);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(h: HorarioCulto) {
    setExcluindo(h.id);
    setErro(null);
    try {
      await cultoApi.excluirHorarioCulto(h.id);
      setMudou(true);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setExcluindo(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => onFechar(mudou)}
    >
      <div
        className="w-full max-w-md max-h-[85vh] flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Horários de culto</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Os horários desta igreja — o lançamento vem preenchido com eles, e
              quem lança ajusta quando o culto foge do combinado. Outra
              congregação não vê nem edita estes.
            </p>
          </div>
          <button
            onClick={() => onFechar(mudou)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <form
            onSubmit={(e) => void adicionar(e)}
            className="flex flex-wrap items-end gap-2"
          >
            <label className="block flex-1 min-w-[9rem]">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">Nome</span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Culto da manhã"
                className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">Início</span>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="mt-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">Fim</span>
              <input
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                className="mt-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </label>
            <button
              type="submit"
              disabled={salvando || !churchId}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </button>
          </form>

          {erro && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {carregando ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : lista.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Nenhum horário cadastrado ainda. Adicione os cultos desta igreja acima.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700 rounded-lg border border-slate-200 dark:border-slate-700">
              {lista.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <p className="min-w-0 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {h.nome}
                  </p>
                  <button
                    type="button"
                    onClick={() => void excluir(h)}
                    disabled={excluindo === h.id}
                    title="Excluir horário"
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50"
                  >
                    {excluindo === h.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end px-5 py-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={() => onFechar(mudou)}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
