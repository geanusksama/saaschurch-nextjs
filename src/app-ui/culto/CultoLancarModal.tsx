/**
 * O formulário em si — modal do tesoureiro ou do secretário.
 *
 * Escolhe a data (e a igreja, quando é master), preenche os campos do bloco e
 * salva. Se o culto daquele dia ainda não existir, é aberto na hora: quem lança
 * não deveria precisar "criar o culto" antes de digitar os números.
 *
 * Reenvio é permitido enquanto o dirigente não aprovou. Depois de aprovado, o
 * servidor recusa (409) e o modal explica que precisa pedir a devolução.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Loader2, Check, AlertTriangle, CalendarDays, Clock, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { apiBase } from '../../lib/apiBase';
import {
  cultoApi,
  fmtData,
  mascaraMoeda,
  moedaParaNumero,
  numeroParaMoeda,
  ROTULO_BLOCO,
  ROTULO_STATUS,
  type Bloco,
  type HorarioCulto,
  type Registro,
  type TipoCulto,
} from './cultoApi';
import { PASTILHA } from './cultoCores';
import HorariosCultoModal from './HorariosCultoModal';

/**
 * Os campos de cada bloco, em grupos com subtítulo.
 *
 * O bloco PRESENÇA mistura duas contagens diferentes: quantas pessoas estavam
 * no culto e o que aconteceu no apelo. Sem separação visual, quem lança lia
 * dezesseis caixinhas iguais e errava a linha.
 *
 * "Jovens" e "Adolescentes" saíram do formulário: a igreja parou de contar por
 * faixa. As colunas continuam no banco por causa dos cultos já lançados.
 */
type Campo = { campo: string; label: string; moeda?: boolean };
type Grupo = { titulo: string | null; campos: Campo[] };

const CAMPOS: Record<Bloco, Grupo[]> = {
  FINANCEIRO: [
    {
      titulo: null,
      // A quantidade vem antes do valor: quem lança conta os envelopes
      // primeiro e só depois soma o dinheiro.
      campos: [
        { campo: 'qtdDizimos', label: 'Qtd. de dízimos' },
        { campo: 'totalDizimos', label: 'Valor total de dízimos', moeda: true },
        { campo: 'totalOfertas', label: 'Valor total de ofertas', moeda: true },
      ],
    },
  ],
  PRESENCA: [
    {
      titulo: 'Descrição do culto',
      campos: [
        { campo: 'qtdHomens', label: 'Homens' },
        { campo: 'qtdMulheres', label: 'Mulheres' },
        { campo: 'qtdCriancas', label: 'Crianças' },
      ],
    },
    {
      titulo: 'Detalhes do culto',
      campos: [
        { campo: 'qtdVisitantes', label: 'Visitantes' },
        { campo: 'qtdConversoes', label: 'Conversões' },
        { campo: 'qtdReconciliacoes', label: 'Reconciliações' },
        { campo: 'cadeirasVazias', label: 'Cadeiras vazias' },
      ],
    },
  ],
  EXTRA: [],
};

/**
 * Fim do culto quando o cadastro não tem hora de término.
 *
 * O horário cadastrado guarda início e fim; este cálculo é a rede de segurança
 * para os horários criados antes de o campo Fim existir. Vira ao dia seguinte
 * quando o culto começa às 23h30 (vigília), por isso o resto de 24.
 */
function umaHoraDepois(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return '';
  const hora = (Number(m[1]) + 1) % 24;
  return `${String(hora).padStart(2, '0')}:${m[2]}`;
}

/** "2026-09-28" → "2026-09-22": começo da janela de cultos recentes. */
function seisDiasAntes(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 6);
  return d.toISOString().slice(0, 10);
}

/** Valor do dropdown de horário quando a hora do culto não está no cadastro. */
const HORA_AVULSA = '__hora_do_culto__';

/** Todos os campos do bloco, sem os grupos — para ler e gravar o lançamento. */
function camposDoBloco(bloco: Bloco): Campo[] {
  return CAMPOS[bloco].flatMap((g) => g.campos);
}

interface IgrejaOpcao {
  id: string;
  name: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('mrm_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface Props {
  bloco: Bloco;
  churchIdPadrao: string | null;
  precisaEscolherIgreja: boolean;
  onFechar: () => void;
}

export default function CultoLancarModal({
  bloco,
  churchIdPadrao,
  precisaEscolherIgreja,
  onFechar,
}: Props) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const [tipoCulto, setTipoCulto] = useState('CULTO');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [tipos, setTipos] = useState<TipoCulto[]>([]);
  const [horarios, setHorarios] = useState<HorarioCulto[]>([]);
  const [horarioCodigo, setHorarioCodigo] = useState('');
  const [cadastrandoHorarios, setCadastrandoHorarios] = useState(false);
  const [observacao, setObservacao] = useState('');
  const navigate = useNavigate();
  const [churchId, setChurchId] = useState<string | null>(churchIdPadrao);
  const [igrejas, setIgrejas] = useState<IgrejaOpcao[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  // Cultos da igreja nos 7 dias até a data escolhida — manhã, noite, EBD.
  // Quem abre o modal vê o que o tesoureiro ou o secretário já lançou antes de
  // digitar, mesmo quando a data ainda está em "hoje" e o culto foi ontem.
  const [recentes, setRecentes] = useState<Registro[]>([]);
  const [buscando, setBuscando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  // Tipos vêm do cadastro (Configurações › Listas), nunca de lista fixa.
  useEffect(() => {
    let vivo = true;
    cultoApi
      .tiposCulto()
      .then((lista) => {
        if (!vivo) return;
        setTipos(lista);
        const padrao = lista.find((t) => t.is_default) ?? lista[0];
        if (padrao) setTipoCulto(padrao.codigo);
      })
      .catch(() => {
        /* sem cadastro, o campo fica vazio e o usuário é avisado abaixo */
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Horários vêm do mesmo lugar (Configurações › Horários de Culto). Escolher
  // um preenche início e fim — quem lança não digita "19:00" toda semana.
  const carregarHorarios = useCallback(() => {
    if (!churchId) return;
    cultoApi
      .horariosCulto(churchId)
      .then((lista) => {
        setHorarios(lista);
        const padrao = lista.find((h) => h.is_default);
        // Só o padrão entra sozinho, e só se o usuário ainda não mexeu na hora:
        // reabrir um culto já lançado não pode trocar o horário dele.
        if (padrao) {
          setHorarioCodigo((atual) => atual || padrao.codigo);
          setHoraInicio((atual) => atual || padrao.hora_inicio || '');
          setHoraFim(
            (atual) =>
              atual ||
              padrao.hora_fim ||
              (padrao.hora_inicio ? umaHoraDepois(padrao.hora_inicio) : ''),
          );
        }
      })
      .catch(() => {
        /* sem cadastro, o dropdown fica vazio e as horas são digitadas à mão */
      });
    // Trocar de igreja troca a lista: o horário é cadastro de cada congregação.
  }, [churchId]);

  useEffect(carregarHorarios, [carregarHorarios]);

  useEffect(() => {
    if (!precisaEscolherIgreja) return;
    fetch(`${apiBase}/churches?slim=1`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d: IgrejaOpcao[]) => {
        const lista = Array.isArray(d) ? d : [];
        setIgrejas(lista);
        if (!churchId && lista.length) setChurchId(lista[0].id);
      })
      .catch(() => setErro('Não foi possível carregar a lista de igrejas.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precisaEscolherIgreja]);

  /** Busca os cultos da igreja na semana que termina na data escolhida. */
  const buscarRecentes = useCallback(async (): Promise<Registro[]> => {
    if (!churchId || !data) return [];
    return cultoApi.listarRegistros({ de: seisDiasAntes(data), ate: data, churchId });
  }, [churchId, data]);

  useEffect(() => {
    let vivo = true;
    buscarRecentes()
      .then((lista) => {
        if (!vivo) return;
        setErro(null);
        setSalvo(false);
        setRecentes(lista);
      })
      .catch((e) => vivo && setErro((e as Error).message))
      .finally(() => vivo && setBuscando(false));
    return () => {
      vivo = false;
    };
  }, [buscarRecentes]);

  /** Só os da data escolhida: é entre eles que o formulário procura o culto. */
  const doDia = useMemo(
    () => recentes.filter((r) => r.dataCulto.slice(0, 10) === data),
    [recentes, data],
  );

  /** Dentre os cultos do dia, o que corresponde ao tipo/horário escolhido. */
  const registro = useMemo(() => {
    // Manhã e noite do mesmo dia são cultos distintos: quando há horário
    // escolhido, ele entra na busca — senão o lançamento da noite abriria
    // em cima do da manhã.
    const doTipo = doDia.filter((r) => r.tipoCulto === tipoCulto);
    return (
      (horaInicio ? doTipo.find((r) => r.horaInicio === horaInicio) : null) ??
      (horaInicio ? null : doTipo[0]) ??
      null
    );
  }, [doDia, tipoCulto, horaInicio]);

  // Trocou a lista do dia, o tipo ou o horário: o formulário passa a mostrar
  // o que já foi lançado naquele culto (ou fica vazio, se é culto novo).
  // Ajuste durante o render, não em efeito — evita um render a mais.
  const [preenchidoPara, setPreenchidoPara] = useState<{
    lista: Registro[];
    tipoCulto: string;
    horaInicio: string;
  } | null>(null);
  if (
    !preenchidoPara ||
    preenchidoPara.lista !== doDia ||
    preenchidoPara.tipoCulto !== tipoCulto ||
    preenchidoPara.horaInicio !== horaInicio
  ) {
    setPreenchidoPara({ lista: doDia, tipoCulto, horaInicio });
    if (registro) {
      setHoraInicio(registro.horaInicio ?? '');
      setHoraFim(registro.horaFim ?? '');
    }
    const valores: Record<string, string> = {};
    const lanc = registro?.lancamentos.find((l) => l.bloco === bloco);
    if (lanc) {
      for (const c of camposDoBloco(bloco)) {
        const v = lanc[c.campo as keyof typeof lanc];
        if (v === null || v === undefined) continue;
        // Dinheiro volta formatado; contagem volta como número puro.
        valores[c.campo] = c.moeda ? numeroParaMoeda(v as string) : String(v);
      }
    }
    setObservacao(lanc?.observacao ?? '');
    setForm(valores);
  }

  /** Abre no formulário um culto que já existe no dia (linha da tabela). */
  function abrirExistente(r: Registro) {
    const dia = r.dataCulto.slice(0, 10);
    if (dia !== data) {
      setBuscando(true);
      setData(dia);
    }
    setTipoCulto(r.tipoCulto);
    setHoraInicio(r.horaInicio ?? '');
    setHoraFim(r.horaFim ?? '');
    setHorarioCodigo(horarios.find((h) => h.hora_inicio === r.horaInicio)?.codigo ?? '');
    setSalvo(false);
  }

  // Os do dia quando há; senão, a semana — para quem abriu com a data errada.
  const tabela = doDia.length > 0 ? doDia : recentes;

  const nomeDoTipo = (codigo: string) => tipos.find((t) => t.codigo === codigo)?.nome ?? codigo;

  // O dropdown mostra o horário do culto aberto mesmo quando a igreja não tem
  // aquele horário no cadastro (ou não tem cadastro nenhum): o culto já
  // lançado às 18:00 não pode aparecer como "Sem horário definido".
  const horarioExibido =
    horarios.find((h) => h.codigo === horarioCodigo && h.hora_inicio === horaInicio)?.codigo ??
    horarios.find((h) => h.hora_inicio === horaInicio)?.codigo ??
    (horaInicio ? HORA_AVULSA : '');
  const tipoForaDoCadastro = tipoCulto && !tipos.some((t) => t.codigo === tipoCulto);

  /**
   * Situação de um bloco na tabela do dia. Usa blocosEnviados, que o servidor
   * calcula antes de podar os lançamentos: o secretário sabe que o financeiro
   * foi enviado sem ver os valores.
   */
  function situacaoBloco(r: Registro, b: Bloco): string {
    if (!r.blocosExigidos.includes(b)) return '—';
    if (!r.blocosEnviados.includes(b)) return 'Falta';
    const autor = r.lancamentos.find((l) => l.bloco === b)?.enviadoPorUser?.fullName;
    return autor ? `Enviado · ${autor}` : 'Enviado';
  }

  const jaAprovado = registro
    ? ['APROVADO_LOCAL', 'CONCLUIDO'].includes(registro.status)
    : false;

  async function salvar() {
    if (!churchId) {
      setErro('Escolha a igreja.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      // Abre o culto se ainda não existir — quem lança não deveria precisar
      // criar o registro antes de digitar.
      let alvo = registro;
      if (!alvo) {
        alvo = await cultoApi.abrirRegistro({
          churchId,
          dataCulto: data,
          horaInicio: horaInicio || null,
          horaFim: horaFim || null,
          tipoCulto,
        });
      }
      const dados: Record<string, unknown> = { observacao: observacao.trim() || null };
      for (const c of camposDoBloco(bloco)) {
        const bruto = form[c.campo] ?? '';
        dados[c.campo] = c.moeda ? moedaParaNumero(bruto) : bruto || null;
      }
      await cultoApi.enviarBloco(alvo.id, bloco, dados);

      // Recarregar o dia atualiza a tabela e reaponta o formulário para o
      // culto recém-aberto (o efeito de seleção roda com a lista nova).
      setRecentes(await buscarRecentes());
      setSalvo(true);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const grupos = CAMPOS[bloco];

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onFechar}>
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {bloco === 'FINANCEIRO' ? 'Financeiro do culto' : 'Presença no culto'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {registro
                ? `${registro.church.name} · ${fmtData(registro.dataCulto)} · ${ROTULO_STATUS[registro.status]}`
                : 'O culto será aberto ao salvar.'}
            </p>
          </div>
          <button
            onClick={onFechar}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Cabeçalho do formulário.
              No celular vira uma grade de duas colunas: data, horário, nome e
              igreja ocupam a linha toda e só Início/Fim dividem espaço — são
              os dois campos estreitos, e um do lado do outro é como se lê a
              duração do culto. A partir do sm volta a ser uma linha corrida. */}
          {/* A igreja vem primeiro: é ela que decide os horários e os cultos
              já lançados no dia. Já chega escolhida; o administrador troca. */}
          {precisaEscolherIgreja && (
            <label className="block">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Igreja</span>
              <select
                value={churchId ?? ''}
                onChange={(e) => {
                  setBuscando(true);
                  setChurchId(e.target.value);
                }}
                className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              >
                {igrejas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="grid grid-cols-2 gap-3 items-end sm:flex sm:flex-wrap">
            <label className="col-span-2 block sm:w-auto">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" /> Data do culto
              </span>
              <input
                type="date"
                value={data}
                onChange={(e) => {
                  setBuscando(true);
                  setData(e.target.value);
                }}
                className="mt-1 w-full sm:w-auto border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
            </label>
            <label className="col-span-2 block sm:w-auto">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Horário do culto
              </span>
              <div className="mt-1 flex items-center gap-1">
                <select
                  value={horarioExibido}
                  onChange={(e) => {
                    if (e.target.value === HORA_AVULSA) return;
                    const h = horarios.find((x) => x.codigo === e.target.value);
                    setHorarioCodigo(e.target.value);
                    // "Sem horário definido" limpa as horas: senão a hora antiga
                    // continuaria valendo e o dropdown voltaria para ela.
                    if (!h) {
                      setHoraInicio('');
                      setHoraFim('');
                    }
                    // Escolher o horário preenche Início com a hora cadastrada
                    // e Fim uma hora depois; quem lança ajusta ao lado quando o
                    // culto passa disso.
                    if (h) {
                      setHoraInicio(h.hora_inicio ?? '');
                      // O fim vem do cadastro; sem ele, uma hora depois do
                      // início, que era o comportamento anterior.
                      setHoraFim(
                        h.hora_fim ?? (h.hora_inicio ? umaHoraDepois(h.hora_inicio) : ''),
                      );
                    }
                  }}
                  className="w-full sm:w-44 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                >
                  <option value="">Sem horário definido</option>
                  {horarioExibido === HORA_AVULSA && (
                    <option value={HORA_AVULSA}>
                      {horaFim ? `${horaInicio}–${horaFim}` : horaInicio}
                    </option>
                  )}
                  {horarios.map((h) => (
                    // Só o nome: a hora aparece nos campos ao lado assim que o
                    // horário é escolhido — repeti-la aqui era ler duas vezes a
                    // mesma informação.
                    <option key={h.id} value={h.codigo}>
                      {h.nome}
                    </option>
                  ))}
                </select>
                {/* O cadastro é da própria igreja e mora aqui, não em
                    Configurações: quem lança o culto é quem sabe os horários
                    dele, e não precisa de acesso administrativo para isso. */}
                <button
                  type="button"
                  onClick={() => setCadastrandoHorarios(true)}
                  title="Cadastrar horários de culto desta igreja"
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              </div>
            </label>
            {/* O tesoureiro escolhe só o horário cadastrado; quem cronometra o
                culto é o secretário, então início e fim aparecem só para ele. */}
            {bloco === 'PRESENCA' && (
              <>
            <label className="block sm:w-auto">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">Início</span>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="mt-1 w-full sm:w-auto border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
            </label>
            <label className="block sm:w-auto">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">Fim</span>
              <input
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                className="mt-1 w-full sm:w-auto border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
            </label>
              </>
            )}
            <label className="col-span-2 block sm:w-auto">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Nome do culto
              </span>
              <div className="mt-1 flex items-center gap-1">
                <select
                  value={tipoCulto}
                  onChange={(e) => setTipoCulto(e.target.value)}
                  className="w-full sm:w-44 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                >
                  {tipos.length === 0 && tipoCulto !== 'CULTO' && <option value="CULTO">Culto</option>}
                  {/* Culto lançado com um tipo que saiu do cadastro (ou antes
                      dele existir) aparece com o código gravado, não com o
                      primeiro tipo da lista. */}
                  {tipoForaDoCadastro && <option value={tipoCulto}>{tipoCulto}</option>}
                  {tipos.map((t) => (
                    <option key={t.id} value={t.codigo}>
                      {t.nome}
                    </option>
                  ))}
                </select>
                {/* Cadastro dos tipos, no CRUD genérico das listas auxiliares. */}
                <button
                  type="button"
                  onClick={() => navigate('/app-ui/config/tipos-culto')}
                  title="Cadastrar tipos de culto"
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              </div>
            </label>
            {buscando && (
              <Loader2 className="col-span-2 w-4 h-4 animate-spin text-slate-400 sm:mb-3" />
            )}
          </div>

          {tabela.length > 0 && (
            <div className={`rounded-lg px-4 py-3 text-sm space-y-2 ${PASTILHA.azul}`}>
              {doDia.length > 0 ? (
                <p>
                  <strong>
                    {doDia.length === 1
                      ? 'Já existe 1 culto lançado'
                      : `Já existem ${doDia.length} cultos lançados`}{' '}
                    em {fmtData(data)}.
                  </strong>{' '}
                  Clique em um para abri-lo, ou escolha outro horário para lançar um culto novo.
                </p>
              ) : (
                <p>
                  <strong>Nenhum culto lançado em {fmtData(data)}.</strong> Estes são os
                  lançados nesta igreja nos 7 dias anteriores — clique em um para abri-lo.
                </p>
              )}
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <table className="w-full text-xs text-slate-700 dark:text-slate-200">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Data</th>
                      <th className="px-3 py-2 text-left font-medium">Horário</th>
                      <th className="px-3 py-2 text-left font-medium">Culto</th>
                      <th className="px-3 py-2 text-left font-medium">Financeiro</th>
                      <th className="px-3 py-2 text-left font-medium">Presença</th>
                      <th className="px-3 py-2 text-left font-medium">Situação</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {tabela.map((r) => {
                      const atual = registro?.id === r.id;
                      return (
                        <tr
                          key={r.id}
                          onClick={() => abrirExistente(r)}
                          className={`border-t border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${
                            atual ? 'bg-slate-100 dark:bg-slate-800 font-semibold' : ''
                          }`}
                        >
                          <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                            {fmtData(r.dataCulto)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                            {r.horaInicio
                              ? `${r.horaInicio}${r.horaFim ? `–${r.horaFim}` : ''}`
                              : 'Sem horário'}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{nomeDoTipo(r.tipoCulto)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{situacaoBloco(r, 'FINANCEIRO')}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{situacaoBloco(r, 'PRESENCA')}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{ROTULO_STATUS[r.status]}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-right">
                            {atual ? 'Aberto' : 'Abrir'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {erro && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {salvo && (
            <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${PASTILHA.verde}`}>
              <Check className="w-4 h-4 shrink-0" />
              <span>
                {ROTULO_BLOCO[bloco]} enviado.
                {registro && registro.blocosFaltando.length > 0
                  ? ` Ainda falta: ${registro.blocosFaltando.map((b) => ROTULO_BLOCO[b]).join(', ')}.`
                  : ' O culto seguiu para a aprovação do dirigente.'}
              </span>
            </div>
          )}

          {jaAprovado && (
            <div className={`rounded-lg px-4 py-3 text-sm ${PASTILHA.azul}`}>
              Este culto já foi aprovado pelo dirigente. Para corrigir, peça a devolução.
            </div>
          )}

          {grupos.map((g) => (
            <div key={g.titulo ?? 'sem-titulo'} className="space-y-3">
              {g.titulo && (
                <div className="pt-1 border-t border-slate-100 dark:border-slate-700">
                  <h3 className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {g.titulo}
                  </h3>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {g.campos.map((c) => (
              <label key={c.campo} className="block">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {c.label}
                </span>
                <div className="mt-1 relative">
                  {c.moeda && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">
                      R$
                    </span>
                  )}
                  <input
                    // Dinheiro é texto com máscara pt-BR (1.234,56); contagem é
                    // number puro. `type=number` não aceita separador de milhar
                    // e mostraria 1234.56, que não é como se escreve em real.
                    type={c.moeda ? 'text' : 'number'}
                    inputMode={c.moeda ? 'numeric' : undefined}
                    min={c.moeda ? undefined : 0}
                    placeholder={c.moeda ? '0,00' : '0'}
                    value={form[c.campo] ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        [c.campo]: c.moeda ? mascaraMoeda(e.target.value) : e.target.value,
                      }))
                    }
                    disabled={jaAprovado}
                    className={`w-full border border-slate-200 dark:border-slate-700 rounded-lg py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 ${
                      c.moeda ? 'pl-9 pr-3 text-right tabular-nums' : 'px-3'
                    }`}
                  />
                </div>
              </label>
                ))}
              </div>
            </div>
          ))}

          {/* O dirigente lê isto antes de aprovar. */}
          <label className="block">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Observações para o dirigente
            </span>
            <textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              disabled={jaAprovado}
              placeholder="Algo que explique estes números? Ex.: a oferta do sábado entrou junto."
              className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
            />
          </label>

          {registro && registro.status === 'REJEITADO' && (
            <div className={`rounded-lg px-4 py-3 text-sm ${PASTILHA.ambar}`}>
              <strong>Devolvido pelo dirigente.</strong>{' '}
              {registro.aprovacoes.find((a) => a.decisao === 'REJEITADO')?.motivo ??
                'Corrija e envie de novo.'}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <button
              onClick={onFechar}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Fechar
            </button>
            <button
              onClick={() => void salvar()}
              disabled={salvando || jaAprovado || !churchId}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Cadastro dos horários desta igreja, por cima do lançamento — sai daqui
        com a lista já recarregada quando algo mudou. */}
    {cadastrandoHorarios && (
      <HorariosCultoModal
        churchId={churchId}
        onFechar={(mudou) => {
          setCadastrandoHorarios(false);
          if (mudou) carregarHorarios();
        }}
      />
    )}
    </>
  );
}
