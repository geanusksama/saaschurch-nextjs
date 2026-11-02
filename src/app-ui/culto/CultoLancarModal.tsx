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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Loader2,
  Check,
  AlertTriangle,
  CalendarDays,
  Clock,
  Settings2,
  Plus,
  ChevronRight,
  ArrowLeftRight,
  Minus,
} from 'lucide-react';
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
import { Permissao } from '../../lib/permissoes/Permissao';

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

/** "19:30" → 1170. Null quando a hora não é válida. */
function emMinutos(hhmm: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * Faixa [início, fim) de um culto em minutos. Sem fim, vale uma hora; fim
 * menor que o início é vigília que vira o dia.
 */
function faixa(inicio: string | null, fim: string | null): [number, number] | null {
  const a = emMinutos(inicio);
  if (a === null) return null;
  let b = emMinutos(fim) ?? a + 60;
  if (b <= a) b += 24 * 60;
  return [a, b];
}

/**
 * O culto ainda espera o bloco de quem está lançando: o bloco é exigido, não
 * foi enviado e o dirigente não aprovou.
 */
function faltaOBloco(r: Registro, bloco: Bloco): boolean {
  return (
    r.blocosExigidos.includes(bloco) &&
    !r.blocosEnviados.includes(bloco) &&
    !['APROVADO_LOCAL', 'CONCLUIDO'].includes(r.status)
  );
}

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

/** "09:00–10:00", "09:00" ou "Sem horário". */
function rotuloHorario(r: Registro): string {
  return r.horaInicio ? `${r.horaInicio}${r.horaFim ? `–${r.horaFim}` : ''}` : 'Sem horário';
}

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
  // Antes do formulário, a escolha do culto: quem abre vê os cultos do dia que
  // ainda esperam o seu bloco e escolhe um, ou pede um lançamento novo. Começa
  // aberta (carregando) e fecha sozinha se o dia não tiver nenhum pendente.
  const [escolhendo, setEscolhendo] = useState(true);
  const [avisoEscolha, setAvisoEscolha] = useState<string | null>(null);
  // Igreja+data já avaliadas: a escolha reabre ao trocar de dia, não a cada
  // recarga da mesma lista.
  const avaliadoPara = useRef<string | null>(null);
  // Trava síncrona do envio: o estado `salvando` só chega no próximo render, e
  // dois cliques rápidos no Enviar passavam os dois.
  const enviandoAgora = useRef(false);
  // Enviou e não sobrou culto pendente no dia: mostra o verde e fecha tudo.
  const [fechando, setFechando] = useState(false);
  useEffect(() => {
    if (!fechando) return;
    const t = setTimeout(onFechar, 1500);
    return () => clearTimeout(t);
  }, [fechando, onFechar]);

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
        const chave = `${churchId ?? ''}|${data}`;
        if (avaliadoPara.current === chave) return;
        const primeira = avaliadoPara.current === null;
        avaliadoPara.current = chave;
        // Qualquer culto já lançado no dia passa pela escolha — inclusive os
        // concluídos, que a pessoa pode querer abrir para conferir.
        const temCulto = lista.some((r) => r.dataCulto.slice(0, 10) === data);
        // Ao abrir o modal num dia sem culto, vai direto ao formulário. Depois
        // disso, trocar o dia só abre a escolha — fechar fica com o usuário,
        // que pode estar trocando a data dentro dela.
        if (temCulto) setEscolhendo(true);
        else if (primeira) setEscolhendo(false);
      })
      .catch((e) => {
        if (!vivo) return;
        setErro((e as Error).message);
        setEscolhendo(false);
      })
      .finally(() => vivo && setBuscando(false));
    return () => {
      vivo = false;
    };
  }, [buscarRecentes, churchId, data, bloco]);

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

  /** Cultos do dia que ainda esperam o bloco de quem lança — os da escolha. */
  const pendentes = useMemo(() => doDia.filter((r) => faltaOBloco(r, bloco)), [doDia, bloco]);
  /** Os cultos do dia na escolha: os que esperam este bloco vêm primeiro. */
  const paraEscolher = useMemo(
    () => [...pendentes, ...doDia.filter((r) => !faltaOBloco(r, bloco))],
    [pendentes, doDia, bloco],
  );

  /**
   * Culto novo que cai no horário de um culto já lançado no dia.
   *
   * É a duplicação que a escolha evita: o secretário lançou a EBD das 9h e o
   * tesoureiro, com "Culto" no nome, abriria outro culto das 9h na mesma
   * igreja. O servidor só recusa quando tipo e hora são idênticos; aqui
   * qualquer sobreposição de horário trava o envio.
   */
  const conflito = useMemo(() => {
    if (registro) return null;
    const minha = faixa(horaInicio, horaFim);
    if (!minha) return null;
    return (
      doDia.find((r) => {
        const outra = faixa(r.horaInicio, r.horaFim);
        return outra !== null && minha[0] < outra[1] && outra[0] < minha[1];
      }) ?? null
    );
  }, [registro, horaInicio, horaFim, doDia]);

  /** Fecha a escolha e deixa o formulário pronto para um culto novo. */
  function novoLancamento() {
    const tipoPadrao = tipos.find((t) => t.is_default) ?? tipos[0];
    setTipoCulto(tipoPadrao?.codigo ?? 'CULTO');
    const h = horarios.find((x) => x.is_default);
    setHorarioCodigo(h?.codigo ?? '');
    setHoraInicio(h?.hora_inicio ?? '');
    setHoraFim(h ? (h.hora_fim ?? (h.hora_inicio ? umaHoraDepois(h.hora_inicio) : '')) : '');
    setSalvo(false);
    setAvisoEscolha(null);
    setEscolhendo(false);
  }

  /** Escolheu um culto na lista: o formulário passa a ser o dele. */
  function escolher(r: Registro) {
    abrirExistente(r);
    setAvisoEscolha(null);
    setEscolhendo(false);
  }

  // O dropdown mostra o horário do culto aberto mesmo quando a igreja não tem
  // aquele horário no cadastro (ou não tem cadastro nenhum): o culto já
  // lançado às 18:00 não pode aparecer como "Sem horário definido".
  const horarioExibido =
    horarios.find((h) => h.codigo === horarioCodigo && h.hora_inicio === horaInicio)?.codigo ??
    horarios.find((h) => h.hora_inicio === horaInicio)?.codigo ??
    (horaInicio ? HORA_AVULSA : '');
  const tipoForaDoCadastro = tipoCulto && !tipos.some((t) => t.codigo === tipoCulto);

  const jaAprovado = registro
    ? ['APROVADO_LOCAL', 'CONCLUIDO'].includes(registro.status)
    : false;

  async function salvar() {
    if (!churchId) {
      setErro('Escolha a igreja.');
      return;
    }
    if (conflito) {
      setErro('Já existe um culto neste horário. Abra-o na lista em vez de lançar outro.');
      return;
    }
    if (enviandoAgora.current || salvo) return;
    enviandoAgora.current = true;
    setSalvando(true);
    setErro(null);
    try {
      // Abre o culto se ainda não existir — quem lança não deveria precisar
      // criar o registro antes de digitar.
      let alvo = registro;
      if (!alvo) {
        try {
          alvo = await cultoApi.abrirRegistro({
            churchId,
            dataCulto: data,
            horaInicio: horaInicio || null,
            horaFim: horaFim || null,
            tipoCulto,
          });
        } catch (e) {
          // Outra pessoa abriu o mesmo culto entre a lista e o envio (o
          // servidor recusa a duplicata com 409): lança nele em vez de falhar.
          const mesmo = (await buscarRecentes()).find(
            (r) =>
              r.dataCulto.slice(0, 10) === data &&
              r.tipoCulto === tipoCulto.toUpperCase() &&
              (r.horaInicio ?? '') === horaInicio,
          );
          if (!mesmo) throw e;
          alvo = mesmo;
        }
      }
      const dados: Record<string, unknown> = { observacao: observacao.trim() || null };
      for (const c of camposDoBloco(bloco)) {
        const bruto = form[c.campo] ?? '';
        dados[c.campo] = c.moeda ? moedaParaNumero(bruto) : bruto || null;
      }
      await cultoApi.enviarBloco(alvo.id, bloco, dados);

      // Recarregar o dia atualiza a tabela e reaponta o formulário para o
      // culto recém-aberto (o efeito de seleção roda com a lista nova).
      const lista = await buscarRecentes();
      setRecentes(lista);
      setSalvo(true);
      // Ainda há cultos do dia esperando este bloco: volta à escolha, já com
      // um a menos, para emendar o próximo.
      const restam = lista.filter(
        (r) => r.dataCulto.slice(0, 10) === data && faltaOBloco(r, bloco),
      ).length;
      if (restam > 0) {
        setAvisoEscolha(`${ROTULO_BLOCO[bloco]} enviado.`);
        setEscolhendo(true);
      } else {
        setFechando(true);
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      enviandoAgora.current = false;
      setSalvando(false);
    }
  }

  const grupos = CAMPOS[bloco];

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 max-sm:items-stretch max-sm:p-0" onClick={onFechar}>
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden max-sm:max-w-none max-sm:max-h-none max-sm:h-full max-sm:rounded-none max-sm:shadow-none max-sm:bg-[#F4F6F9] dark:max-sm:bg-[#0d1017]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700 max-sm:px-4 max-sm:pt-[calc(12px+env(safe-area-inset-top))] max-sm:bg-white dark:max-sm:bg-slate-800 max-sm:border-[#e5e7eb]">
          <div>
            <p className="sm:hidden text-xs font-semibold text-slate-500 dark:text-slate-400">Gestão de Culto</p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white max-sm:text-xl max-sm:font-extrabold">
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

        <div className="flex-1 overflow-y-auto p-5 space-y-4 max-sm:px-4">
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
                className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 max-sm:rounded-xl max-sm:py-2.5 max-sm:text-base max-sm:bg-white dark:max-sm:bg-slate-900 max-sm:border-[#e5e7eb]"
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
                className="mt-1 w-full sm:w-auto border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 max-sm:rounded-xl max-sm:py-2.5 max-sm:text-base max-sm:bg-white dark:max-sm:bg-slate-900 max-sm:border-[#e5e7eb]"
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
                  className="w-full sm:w-44 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 max-sm:rounded-xl max-sm:py-2.5 max-sm:text-base max-sm:bg-white dark:max-sm:bg-slate-900 max-sm:border-[#e5e7eb]"
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
                <Permissao chave="culto_lancar.culto_lancar_modal.cadastrar_horarios_de_culto_desta_igreja" rotulo="Cadastrar horários de culto desta igreja — Culto Lancar Modal" herda="culto_lancar.view">
                  <button
                    type="button"
                    onClick={() => setCadastrandoHorarios(true)}
                    title="Cadastrar horários de culto desta igreja"
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                </Permissao>
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
                className="mt-1 w-full sm:w-auto border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 max-sm:rounded-xl max-sm:py-2.5 max-sm:text-base max-sm:bg-white dark:max-sm:bg-slate-900 max-sm:border-[#e5e7eb]"
              />
            </label>
            <label className="block sm:w-auto">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">Fim</span>
              <input
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                className="mt-1 w-full sm:w-auto border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 max-sm:rounded-xl max-sm:py-2.5 max-sm:text-base max-sm:bg-white dark:max-sm:bg-slate-900 max-sm:border-[#e5e7eb]"
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
                  className="w-full sm:w-44 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 max-sm:rounded-xl max-sm:py-2.5 max-sm:text-base max-sm:bg-white dark:max-sm:bg-slate-900 max-sm:border-[#e5e7eb]"
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
                <Permissao chave="culto_lancar.culto_lancar_modal.cadastrar_tipos_de_culto" rotulo="Cadastrar tipos de culto — Culto Lancar Modal" herda="culto_lancar.view">
                  <button
                    type="button"
                    onClick={() => navigate('/app-ui/config/tipos-culto')}
                    title="Cadastrar tipos de culto"
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                </Permissao>
              </div>
            </label>
            {buscando && (
              <Loader2 className="col-span-2 w-4 h-4 animate-spin text-slate-400 sm:mb-3" />
            )}
          </div>

          {/* Os cultos do dia moram na escolha; aqui fica só qual está aberto
              e o caminho de volta para ela. */}
          {doDia.length > 0 && (
            <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm ${PASTILHA.azul} max-sm:flex-nowrap max-sm:gap-3 max-sm:rounded-2xl max-sm:border max-sm:border-[#e5e7eb] max-sm:bg-white max-sm:px-3 max-sm:text-slate-800 dark:max-sm:bg-slate-800 dark:max-sm:border-slate-700 dark:max-sm:text-slate-100`}>
              {/* Celular: a linha do culto — ícone, nome · dia, horário · igreja. */}
              <span className="sm:hidden shrink-0 w-11 h-11 rounded-xl bg-[#151b28] flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-white" />
              </span>
              <span className="sm:hidden min-w-0 flex-1">
                {registro ? (
                  <>
                    <span className="block truncate font-bold">
                      {nomeDoTipo(registro.tipoCulto)} · {fmtData(registro.dataCulto)}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {rotuloHorario(registro)} · {registro.church.name}
                    </span>
                  </>
                ) : (
                  <span className="block font-bold">Culto novo em {fmtData(data)}</span>
                )}
              </span>
              <span className="max-sm:hidden">
                {registro ? (
                  <>
                    Lançando em: <strong>{rotuloHorario(registro)} · {nomeDoTipo(registro.tipoCulto)}</strong>
                  </>
                ) : (
                  <strong>Culto novo em {fmtData(data)}</strong>
                )}
              </span>
              <Permissao chave="culto_lancar.culto_lancar_modal.escolher_outro_culto" rotulo="Escolher outro culto — Culto Lancar Modal" herda="culto_lancar.view">
                <button
                  type="button"
                  onClick={() => {
                    setAvisoEscolha(null);
                    setEscolhendo(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 max-sm:shrink-0 max-sm:border-0 max-sm:px-2 max-sm:text-sm max-sm:font-bold max-sm:text-emerald-600"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 max-sm:hidden" />
                  <span className="sm:hidden">Alterar</span>
                  <span className="max-sm:hidden">Escolher outro culto ({doDia.length} no dia)</span>
                </button>
              </Permissao>
            </div>
          )}

          {tabela.length > 0 && doDia.length === 0 && (
            <div className={`rounded-lg px-4 py-3 text-sm space-y-2 ${PASTILHA.azul}`}>
              <p>
                <strong>Nenhum culto lançado em {fmtData(data)}.</strong> Estes são os
                lançados nesta igreja nos 7 dias anteriores — clique em um para abri-lo.
              </p>
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
                            {rotuloHorario(r)}
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

          {conflito && (
            <div className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${PASTILHA.ambar}`}>
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                <strong>
                  Já existe {nomeDoTipo(conflito.tipoCulto)} das {rotuloHorario(conflito)} neste dia.
                </strong>{' '}
                Para não lançar o mesmo culto duas vezes, abra-o em Escolher outro culto ou escolha
                outro horário.
              </span>
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
                <div className="pt-1 border-t border-slate-100 dark:border-slate-700 max-sm:border-0 max-sm:pt-0">
                  <h3 className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200 max-sm:mt-1 max-sm:text-[11px] max-sm:font-bold max-sm:uppercase max-sm:tracking-wider max-sm:text-slate-500 dark:max-sm:text-slate-400">
                    {g.titulo}
                  </h3>
                </div>
              )}
              <div
                className={`grid grid-cols-2 sm:grid-cols-3 gap-3 max-sm:grid-cols-1 ${
                  bloco === 'PRESENCA'
                    ? 'max-sm:gap-0 max-sm:divide-y max-sm:divide-[#eef0f3] max-sm:rounded-[20px] max-sm:border max-sm:border-[#e5e7eb] max-sm:bg-white max-sm:px-4 dark:max-sm:divide-slate-700 dark:max-sm:border-slate-700 dark:max-sm:bg-slate-800'
                    : 'max-sm:gap-4'
                }`}
              >
                {g.campos.map((c) => (
              <label
                key={c.campo}
                className={`block ${
                  bloco === 'PRESENCA'
                    ? 'max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-3 max-sm:py-3'
                    : ''
                }`}
              >
                <span
                  className={`text-xs font-medium text-slate-500 dark:text-slate-400 ${
                    bloco === 'PRESENCA'
                      ? 'max-sm:text-[15px] max-sm:font-semibold max-sm:text-slate-800 dark:max-sm:text-slate-100'
                      : 'max-sm:text-[13px] max-sm:font-semibold max-sm:text-slate-600'
                  }`}
                >
                  {c.label}
                </span>
                <div
                  className={`mt-1 relative ${
                    c.moeda
                      ? 'max-sm:mt-1.5 max-sm:rounded-2xl max-sm:border max-sm:border-[#e5e7eb] max-sm:bg-white dark:max-sm:border-slate-700 dark:max-sm:bg-slate-800'
                      : bloco === 'PRESENCA'
                        ? 'max-sm:mt-0 max-sm:shrink-0 max-sm:flex max-sm:items-center max-sm:gap-2'
                        : 'max-sm:mt-1.5 max-sm:flex max-sm:items-center max-sm:gap-2 max-sm:rounded-2xl max-sm:border max-sm:border-[#e5e7eb] max-sm:bg-white max-sm:p-2 dark:max-sm:border-slate-700 dark:max-sm:bg-slate-800'
                  }`}
                >
                  {c.moeda && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none max-sm:left-4 max-sm:text-base max-sm:font-bold max-sm:text-slate-500">
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
                    className={`w-full border border-slate-200 dark:border-slate-700 rounded-lg py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 max-sm:border-0 max-sm:bg-transparent dark:max-sm:bg-transparent max-sm:font-extrabold max-sm:tabular-nums ${
                      c.moeda
                        ? 'pl-9 pr-3 text-right tabular-nums max-sm:h-16 max-sm:rounded-2xl max-sm:pl-12 max-sm:pr-4 max-sm:text-[28px]'
                        : `px-3 max-sm:order-2 max-sm:px-0 max-sm:text-center ${
                            bloco === 'PRESENCA'
                              ? 'max-sm:w-14 max-sm:text-xl'
                              : 'max-sm:flex-1 max-sm:min-w-0 max-sm:text-[28px]'
                          }`
                    }`}
                  />
                  {/* Celular: − e + ao lado do número. Mesmo setter do campo,
                      um a menos (nunca abaixo de zero) ou um a mais. */}
                  {!c.moeda && (
                    <>
                      <button
                        type="button"
                        aria-label={`Diminuir ${c.label}`}
                        disabled={jaAprovado}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            [c.campo]: String(Math.max(0, (Number(f[c.campo]) || 0) - 1)),
                          }))
                        }
                        className="sm:hidden order-1 shrink-0 w-11 h-11 rounded-xl border border-[#e5e7eb] bg-white text-slate-700 flex items-center justify-center active:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Aumentar ${c.label}`}
                        disabled={jaAprovado}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            [c.campo]: String(Math.max(0, (Number(f[c.campo]) || 0) + 1)),
                          }))
                        }
                        className={`sm:hidden order-3 shrink-0 w-11 h-11 rounded-xl flex items-center justify-center disabled:opacity-50 ${
                          bloco === 'PRESENCA'
                            ? 'bg-pink-50 text-[#be185d] active:bg-pink-100 dark:bg-pink-950/40 dark:text-pink-300'
                            : 'bg-[#151b28] text-white active:bg-slate-700'
                        }`}
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </label>
                ))}
              </div>
              {/* Só exibição: soma do que já está digitado nos campos acima.
                  Não é gravada nem enviada; o lançamento continua igual. */}
              {g.campos.some((c) => c.campo === 'totalDizimos') && (
                <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 dark:bg-emerald-950/30">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Total do culto
                  </span>
                  <span className="text-xl font-extrabold tabular-nums text-emerald-900 dark:text-emerald-200">
                    {((moedaParaNumero(form.totalDizimos ?? '') ?? 0) + (moedaParaNumero(form.totalOfertas ?? '') ?? 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              )}
              {g.campos.some((c) => c.campo === 'qtdHomens') && (
                <div className="flex items-center justify-between rounded-2xl bg-pink-50 px-4 py-3 dark:bg-pink-950/30">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-[#be185d] dark:text-pink-300">
                    Presentes
                  </span>
                  <span className="text-xl font-extrabold tabular-nums text-[#9d174d] dark:text-pink-200">
                    {['qtdHomens', 'qtdMulheres', 'qtdCriancas'].reduce((soma, k) => soma + (Number(form[k]) || 0), 0)}
                  </span>
                </div>
              )}
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
              className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 max-sm:rounded-2xl max-sm:border-[#e5e7eb] max-sm:bg-white dark:max-sm:bg-slate-800 max-sm:px-4 max-sm:py-3 max-sm:text-base"
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

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-700 max-sm:px-4 max-sm:pb-[calc(16px+env(safe-area-inset-bottom))] max-sm:bg-white dark:max-sm:bg-slate-800 max-sm:border-[#e5e7eb]">
          <div className="flex items-center gap-2 max-sm:w-full">
            <button
              onClick={onFechar}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 max-sm:hidden"
            >
              Fechar
            </button>
            <Permissao chave="culto_lancar.culto_lancar_modal.enviar" rotulo="Enviar — Culto Lancar Modal" herda="culto_lancar.view">
              <button
                onClick={() => void salvar()}
                // Enviado fica travado até escolher outro culto: reenviar o
                // mesmo formulário era o envio duplicado.
                disabled={salvando || salvo || jaAprovado || !churchId || Boolean(conflito)}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 max-sm:w-full max-sm:justify-center max-sm:rounded-2xl max-sm:py-3.5 max-sm:text-base max-sm:font-bold max-sm:bg-[#151b28] max-sm:hover:bg-[#151b28]"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span className="max-sm:hidden">{salvo ? 'Enviado' : 'Enviar'}</span>
                <span className="sm:hidden">{salvo ? 'Enviado' : 'Enviar para o dirigente'}</span>
              </button>
            </Permissao>
          </div>
        </div>
      </div>
    </div>

    {/* A escolha do culto, por cima do formulário. Fechar aqui fecha tudo:
        quem quer lançar um culto novo usa o botão próprio. */}
    {escolhendo && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 max-sm:items-stretch max-sm:p-0" onClick={onFechar}>
        <div
          className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden max-sm:max-w-none max-sm:max-h-none max-sm:h-full max-sm:rounded-none max-sm:shadow-none max-sm:bg-[#F4F6F9] dark:max-sm:bg-[#0d1017]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700 max-sm:px-4 max-sm:pt-[calc(12px+env(safe-area-inset-top))] max-sm:bg-white dark:max-sm:bg-slate-800 max-sm:border-[#e5e7eb]">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white max-sm:text-xl max-sm:font-extrabold">
                Qual culto você vai lançar?
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {precisaEscolherIgreja && igrejas.find((c) => c.id === churchId)
                  ? `${igrejas.find((c) => c.id === churchId)?.name} · `
                  : ''}
                {ROTULO_BLOCO[bloco]} · escolha um culto já aberto neste dia
              </p>
            </div>
            <button
              onClick={onFechar}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 max-sm:px-4">
            {avisoEscolha && (
              <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${PASTILHA.verde}`}>
                <Check className="w-4 h-4 shrink-0" />
                <span>{avisoEscolha}</span>
              </div>
            )}

            <label className="block">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" /> Data do culto
              </span>
              <input
                type="date"
                value={data}
                onChange={(e) => {
                  setBuscando(true);
                  setAvisoEscolha(null);
                  setData(e.target.value);
                }}
                className="mt-1 w-full sm:w-auto border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 max-sm:rounded-xl max-sm:py-2.5 max-sm:text-base max-sm:bg-white dark:max-sm:bg-slate-900 max-sm:border-[#e5e7eb]"
              />
            </label>

            {buscando ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Buscando os cultos do dia…
              </div>
            ) : paraEscolher.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Nenhum culto lançado em {fmtData(data)}. Use <strong>Novo lançamento</strong> para
                abrir um.
              </p>
            ) : (
              <div className={`rounded-lg px-4 py-3 text-sm space-y-2 ${PASTILHA.azul} max-sm:rounded-2xl`}>
                {/* A conta do que falta é a que diminui a cada envio; os já
                    lançados continuam na tabela para conferir ou corrigir. */}
                <p>
                  <strong>
                    {doDia.length === 1
                      ? 'Já existe 1 culto lançado'
                      : `Já existem ${doDia.length} cultos lançados`}{' '}
                    em {fmtData(data)}.
                  </strong>{' '}
                  {pendentes.length === 0
                    ? `Todos já têm o ${ROTULO_BLOCO[bloco].toLowerCase()}. Clique em um para conferir, ou lance um culto novo.`
                    : `${pendentes.length === 1 ? 'Falta 1' : `Faltam ${pendentes.length}`} com o ${ROTULO_BLOCO[bloco].toLowerCase()}. Clique no culto que você vai lançar.`}
                </p>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 max-sm:rounded-2xl max-sm:border-[#e5e7eb]">
                  <table className="w-full text-xs text-slate-700 dark:text-slate-200 max-sm:block max-sm:text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 max-sm:hidden">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Horário</th>
                        <th className="px-3 py-2 text-left font-medium">Culto</th>
                        <th className="px-3 py-2 text-left font-medium">Financeiro</th>
                        <th className="px-3 py-2 text-left font-medium">Presença</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="max-sm:block">
                      {/* Quem lançou cada parte fica à vista: é o que diz ao
                          tesoureiro qual culto o secretário já abriu. */}
                      {paraEscolher.map((r) => {
                        const falta = faltaOBloco(r, bloco);
                        return (
                          <tr
                            key={r.id}
                            onClick={() => escolher(r)}
                            className={`border-t border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 max-sm:flex max-sm:flex-wrap max-sm:items-center max-sm:gap-x-2 max-sm:gap-y-1 max-sm:p-4 max-sm:first:border-t-0 ${
                              falta ? 'font-semibold' : ''
                            }`}
                          >
                            <td className="px-3 py-2 whitespace-nowrap tabular-nums max-sm:p-0 max-sm:font-bold">{rotuloHorario(r)}</td>
                            <td className="px-3 py-2 whitespace-nowrap max-sm:p-0 max-sm:font-bold">
                              <span className="sm:hidden">· </span>
                              {nomeDoTipo(r.tipoCulto)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap max-sm:basis-full max-sm:p-0 max-sm:text-xs max-sm:text-slate-500">
                              <span className="sm:hidden">Financeiro · </span>
                              {situacaoBloco(r, 'FINANCEIRO')}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap max-sm:basis-full max-sm:p-0 max-sm:text-xs max-sm:text-slate-500">
                              <span className="sm:hidden">Presença · </span>
                              {situacaoBloco(r, 'PRESENCA')}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-right max-sm:basis-full max-sm:p-0 max-sm:pt-2 max-sm:text-left">
                              {/* Botão de verdade, na cor do Enviar: um "Abrir"
                                  em texto passava despercebido e a pessoa não
                                  via que precisava escolher o culto. */}
                              <Permissao chave="culto_lancar.culto_lancar_modal.selecionar_e_lancar" rotulo="Selecionar e lançar — Culto Lancar Modal" herda="culto_lancar.view">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    escolher(r);
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold max-sm:w-full max-sm:justify-center max-sm:rounded-xl max-sm:py-2.5 max-sm:text-sm"
                                >
                                  Selecionar e lançar
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </Permissao>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-700 max-sm:px-4 max-sm:pb-[calc(16px+env(safe-area-inset-bottom))] max-sm:bg-white dark:max-sm:bg-slate-800 max-sm:border-[#e5e7eb]">
            <button
              onClick={onFechar}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Fechar
            </button>
            <Permissao chave="culto_lancar.culto_lancar_modal.novo_lancamento" rotulo="Novo lançamento — Culto Lancar Modal" herda="culto_lancar.view">
              <button
                onClick={novoLancamento}
                disabled={buscando}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold disabled:opacity-50 max-sm:flex-1 max-sm:justify-center max-sm:rounded-2xl max-sm:py-3 max-sm:bg-[#151b28]"
              >
                <Plus className="w-4 h-4" />
                Novo lançamento
              </button>
            </Permissao>
          </div>
        </div>
      </div>
    )}

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
