/**
 * A mesa do dirigente da igreja.
 *
 * Uma tabela com os cultos da igreja dele no período e o que cada frente
 * enviou. Clicou na linha, abre o detalhe com os dois blocos: se os dois
 * chegaram, ele aprova (com observação); se falta algum, ele cobra.
 *
 * É só a igreja dele — nada de hospedeira, organograma ou painel.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  X,
  Loader2,
  AlertTriangle,
  CalendarDays,
  Wallet,
  Users,
  Check,
  Clock,
  Undo2,
} from 'lucide-react';
import {
  cultoApi,
  fmtData,
  fmtHora,
  turnoDoCulto,
  periodoPadrao,
  ROTULO_BLOCO,
  ROTULO_STATUS,
  type Bloco,
  type Papel,
  type Posicao,
  type Registro,
} from './cultoApi';
import { PASTILHA, PONTO, TOM_DO_STATUS } from './cultoCores';
import CultoRegistroDrawer from './CultoRegistroDrawer';

/** "MARIA DAJUDA DA SILVA" → "MARIA DAJUDA": cabe na pastilha e identifica. */
function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/).slice(0, 2).join(' ');
}

const ICONE_BLOCO: Record<Bloco, React.ElementType> = {
  FINANCEIRO: Wallet,
  PRESENCA: Users,
  EXTRA: CalendarDays,
};

interface Props {
  churchId: string | null;
  onFechar: () => void;
}

export default function CultoDirigenteModal({ churchId, onFechar }: Props) {
  const inicial = periodoPadrao();
  const [de, setDe] = useState(inicial.de);
  const [ate, setAte] = useState(inicial.ate);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  /**
   * Quem é responsável por cada bloco nesta igreja.
   *
   * O dirigente não cobra "o Financeiro": ele cobra a pessoa. Sem o nome ao
   * lado do bloco que falta, ele tem de sair perguntando quem era o tesoureiro
   * daquele culto.
   */
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);

  const recarregar = useCallback(() => {
    setCarregando(true);
    setVersao((v) => v + 1);
  }, []);

  function aplicarFiltro(setter: (v: string) => void, valor: string) {
    setCarregando(true);
    setter(valor);
  }

  useEffect(() => {
    let vivo = true;
    cultoApi
      .listarRegistros({ de, ate, churchId })
      .then((r) => {
        if (!vivo) return;
        setErro(null);
        setRegistros(r);
      })
      .catch((e) => vivo && setErro((e as Error).message))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [de, ate, churchId, versao]);

  useEffect(() => {
    cultoApi
      .listarPosicoes(churchId)
      .then(setPosicoes)
      .catch(() => {
        /* sem as posições o bloco continua aparecendo, só sem o nome */
      });
  }, [churchId]);

  /** Nome de quem deveria enviar aquele bloco, quando há alguém anexado. */
  function responsavel(bloco: Bloco): string | null {
    const papel = bloco as Papel;
    const achado = posicoes.find((p) => p.papel === papel && p.isActive);
    return achado?.user.fullName ?? null;
  }

  function pastilha(r: Registro, bloco: Bloco) {
    const Icone = ICONE_BLOCO[bloco];
    const ok = r.blocosEnviados.includes(bloco);
    const quem = ok
      ? (r.lancamentos.find((l) => l.bloco === bloco)?.enviadoPorUser?.fullName ?? null)
      : responsavel(bloco);
    return (
      <span
        key={bloco}
        title={
          ok
            ? `${ROTULO_BLOCO[bloco]} enviado${quem ? ` por ${quem}` : ''}`
            : `${ROTULO_BLOCO[bloco]}: falta enviar${quem ? ` — responsável: ${quem}` : ' — ninguém anexado nesta igreja'}`
        }
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold ${
          ok ? PASTILHA.verde : PASTILHA.cinza
        }`}
      >
        <Icone className="w-3.5 h-3.5" />
        {ROTULO_BLOCO[bloco]}
        {!ok && quem && <span className="font-normal opacity-80">· {primeiroNome(quem)}</span>}
      </span>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="mr-auto">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {/* Sem o nome da igreja aqui, quem dirige uma e hospeda outras
                  não sabe de qual congregação são estes números. */}
              {registros[0]?.church.name ?? posicoes[0]?.churchName ?? 'Envios da minha igreja'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Envios da igreja · clique na linha para ver e aprovar.
            </p>
          </div>
          <input
            type="date"
            value={de}
            onChange={(e) => aplicarFiltro(setDe, e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          />
          <span className="text-slate-400 text-sm">a</span>
          <input
            type="date"
            value={ate}
            onChange={(e) => aplicarFiltro(setAte, e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          />
          <button
            onClick={onFechar}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {carregando && (
            <div className="flex items-center justify-center gap-2 text-slate-400 py-20">
              <Loader2 className="w-5 h-5 animate-spin" /> Carregando…
            </div>
          )}

          {erro && (
            <div className="m-5 flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {!carregando && !erro && registros.length === 0 && (
            <p className="text-center py-20 text-slate-400">
              Nenhum culto aberto neste período.
            </p>
          )}

          {!carregando && registros.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-5 py-2 font-semibold">Culto</th>
                  <th className="px-3 py-2 font-semibold">Envios</th>
                  <th className="px-3 py-2 font-semibold">Situação</th>
                  <th className="px-5 py-2 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {registros.map((r) => {
                  const faltando = r.blocosFaltando.length > 0;
                  const podeAprovar = r.status === 'AGUARDANDO_LOCAL';
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setAbertoId(r.id)}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    >
                      <td className="px-5 py-3">
                        <span className="block font-medium text-slate-800 dark:text-slate-100">
                          {fmtData(r.dataCulto)}
                          {turnoDoCulto(r.horaInicio) ? ` · ${turnoDoCulto(r.horaInicio)}` : ''}
                          {fmtHora(r.horaInicio, r.horaFim)
                            ? ` · ${fmtHora(r.horaInicio, r.horaFim)}`
                            : ''}
                        </span>
                        <span className="block text-xs text-slate-400">{r.tipoCulto}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(['FINANCEIRO', 'PRESENCA'] as Bloco[]).map((b) => pastilha(r, b))}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${PONTO[TOM_DO_STATUS[r.status]]}`}
                          />
                          <span className="text-slate-600 dark:text-slate-300">
                            {ROTULO_STATUS[r.status]}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {podeAprovar ? (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg ${PASTILHA.verde}`}
                          >
                            <Check className="w-3.5 h-3.5" /> aprovar
                          </span>
                        ) : faltando ? (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="w-3.5 h-3.5" /> falta{' '}
                            {r.blocosFaltando.map((b) => ROTULO_BLOCO[b]).join(', ')}
                          </span>
                        ) : r.status === 'REJEITADO' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Undo2 className="w-3.5 h-3.5" /> devolvido
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">ver</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {abertoId && (
        <CultoRegistroDrawer
          registroId={abertoId}
          onFechar={() => setAbertoId(null)}
          onMudou={recarregar}
        />
      )}
    </div>
  );
}
