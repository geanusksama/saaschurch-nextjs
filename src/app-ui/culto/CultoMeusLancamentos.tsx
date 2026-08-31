/**
 * A tela do tesoureiro e do secretário: só o formulário.
 *
 * Eles não têm visão de gestão — nada de Kanban, Painel ou Organograma. Veem os
 * cultos da própria igreja no período e lançam o bloco que é deles. O bloco do
 * outro não aparece nem como número (a poda é feita no servidor, em
 * cultoScope.ts).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Plus,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  Undo2,
  Wallet,
  Users,
  FileText,
  Calendar,
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
  type MeusPapeis,
  type Registro,
} from './cultoApi';
import CultoRegistroDrawer from './CultoRegistroDrawer';
import { BORDA, PASTILHA, TEXTO } from './cultoCores';

const ICONE_BLOCO: Record<Bloco, React.ElementType> = {
  FINANCEIRO: Wallet,
  PRESENCA: Users,
  EXTRA: FileText,
};

interface Props {
  papeis: MeusPapeis;
}

export default function CultoMeusLancamentos({ papeis }: Props) {
  const navigate = useNavigate();
  const inicial = periodoPadrao();
  const [de, setDe] = useState(inicial.de);
  const [ate, setAte] = useState(inicial.ate);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [novaData, setNovaData] = useState(new Date().toISOString().slice(0, 10));
  const [versao, setVersao] = useState(0);

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
      .listarRegistros({ de, ate })
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
  }, [de, ate, versao]);

  /** Os blocos que esta pessoa responde. Normalmente um só. */
  const meusBlocos = Array.from(new Set(papeis.podeEnviar.map((p) => p.bloco)));
  const minhaIgreja = papeis.posicoes.find((p) => p.churchName)?.churchName ?? null;

  async function abrirNovoCulto() {
    setCriando(true);
    setErro(null);
    try {
      const criado = await cultoApi.abrirRegistro({
        churchId: papeis.churchIdPadrao,
        dataCulto: novaData,
        tipoCulto: 'CULTO',
      });
      recarregar();
      setAbertoId(criado.id);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCriando(false);
    }
  }

  /** Já enviei o meu bloco neste culto? */
  function meuEnvio(r: Registro): { enviado: boolean; bloco: Bloco | null } {
    for (const b of meusBlocos) {
      if (r.blocosEnviados.includes(b)) return { enviado: true, bloco: b };
    }
    return { enviado: false, bloco: meusBlocos[0] ?? null };
  }

  const pendentes = registros.filter((r) => !meuEnvio(r).enviado);

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div>
        <button
          onClick={() => navigate('/app-ui/culto')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 mb-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para os cards
        </button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Meus lançamentos</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {meusBlocos.map((b) => ROTULO_BLOCO[b]).join(' e ')}
          {minhaIgreja ? ` · ${minhaIgreja}` : ''}. Você lança o seu bloco; o dirigente confere e
          aprova.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <label className="block">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> De
          </span>
          <input
            type="date"
            value={de}
            onChange={(e) => aplicarFiltro(setDe, e.target.value)}
            className="mt-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Até</span>
          <input
            type="date"
            value={ate}
            onChange={(e) => aplicarFiltro(setAte, e.target.value)}
            className="mt-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          />
        </label>
        <button
          onClick={recarregar}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
          title="Atualizar"
        >
          <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
        </button>

        <div className="flex items-end gap-2 ml-auto">
          <label className="block">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Culto ainda não aberto?
            </span>
            <input
              type="date"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
              className="mt-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            />
          </label>
          <button
            onClick={() => void abrirNovoCulto()}
            disabled={criando}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Abrir
          </button>
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {!carregando && registros.length > 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {pendentes.length === 0 ? (
            <>Você já lançou todos os cultos deste período.</>
          ) : (
            <>
              <strong>
                {pendentes.length} culto{pendentes.length > 1 ? 's' : ''}
              </strong>{' '}
              esperando o seu lançamento.
            </>
          )}
        </p>
      )}

      {carregando && (
        <div className="flex items-center justify-center gap-2 text-slate-400 py-16">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando…
        </div>
      )}

      {!carregando && registros.length === 0 && (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          Nenhum culto aberto neste período. Use &ldquo;Abrir&rdquo; acima para criar o do dia.
        </div>
      )}

      <div className="space-y-2">
        {!carregando &&
          registros.map((r) => {
            const { enviado, bloco } = meuEnvio(r);
            const Icone = bloco ? ICONE_BLOCO[bloco] : FileText;
            const devolvido = r.status === 'REJEITADO';
            const travado = r.status === 'CONCLUIDO' || r.status === 'APROVADO_LOCAL';
            return (
              <button
                key={r.id}
                onClick={() => setAbertoId(r.id)}
                className={`w-full flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-left hover:shadow-md transition-shadow ${
                  devolvido ? BORDA.ambar : enviado ? BORDA.verde : BORDA.vermelho
                }`}
              >
                <span
                  className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${
                    enviado ? PASTILHA.verde : PASTILHA.vermelho
                  }`}
                >
                  <Icone className="w-4 h-4" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-800 dark:text-slate-100">
                    {fmtData(r.dataCulto)}
                    {turnoDoCulto(r.horaInicio) ? ` · ${turnoDoCulto(r.horaInicio)}` : ''}
                    {fmtHora(r.horaInicio, r.horaFim)
                      ? ` · ${fmtHora(r.horaInicio, r.horaFim)}`
                      : ''}{' '}
                    · {r.tipoCulto}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {r.church.name} · {ROTULO_STATUS[r.status]}
                  </span>
                </span>

                <span className="shrink-0 flex items-center gap-2 text-xs font-semibold">
                  {devolvido ? (
                    <span className={`inline-flex items-center gap-1 ${TEXTO.ambar}`}>
                      <Undo2 className="w-3.5 h-3.5" /> devolvido — corrigir
                    </span>
                  ) : enviado ? (
                    <span className={`inline-flex items-center gap-1 ${TEXTO.verde}`}>
                      <Check className="w-3.5 h-3.5" /> enviado
                    </span>
                  ) : (
                    <span className={`inline-flex items-center gap-1 ${TEXTO.vermelho}`}>
                      <Clock className="w-3.5 h-3.5" /> falta lançar
                    </span>
                  )}
                  <span
                    className={`px-3 py-1.5 rounded-lg ${
                      travado
                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                        : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {travado ? 'ver' : enviado ? 'editar' : 'lançar'}
                  </span>
                </span>
              </button>
            );
          })}
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
