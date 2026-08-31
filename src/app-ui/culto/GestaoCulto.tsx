/**
 * Gestão de Culto — a tela única que se adapta ao nível de quem entrou.
 *
 *   lançador  → vê o próprio culto e o formulário do próprio bloco
 *   dirigente → vê os blocos juntos e decide
 *   hospedeira→ vê as filhas em verde/vermelho
 *   presidente→ vê o painel agregado do campo
 *
 * Três modos: Kanban (colunas por status, "incluindo" → "concluído"), Tabela
 * (aninhada por hospedeira/regional → igreja → blocos) e Painel (os cards do
 * diagrama). Todos respeitam o mesmo filtro de intervalo de datas.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  LayoutGrid,
  Table2,
  LayoutDashboard,
  Network,
  Sigma,
  ArrowLeft,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Info,
  ChevronRight,
  ChevronDown,
  Wallet,
  Users,
  FileText,
  Printer,
} from 'lucide-react';
import {
  cultoApi,
  fmtData,
  fmtHora,
  turnoDoCulto,
  fmtMoeda,
  periodoPadrao,
  COLUNAS_KANBAN,
  ROTULO_BLOCO,
  ROTULO_STATUS,
  type Bloco,
  type GrupoDoPainel,
  type MeusPapeis,
  type Registro,

} from './cultoApi';
import CultoPainel from './CultoPainel';
import CultoOrganograma from './CultoOrganograma';
import CultoResumoModal, { type PassoResumo } from './CultoResumoModal';
import CultoMeusLancamentos from './CultoMeusLancamentos';
import { BORDA, PASTILHA, PONTO, TOM_DO_STATUS, tomDoSemaforo } from './cultoCores';
import CultoRegistroDrawer from './CultoRegistroDrawer';
import CultoImprimirModal from './CultoImprimirModal';

type Modo = 'kanban' | 'tabela' | 'painel' | 'organograma';

const MODOS_VALIDOS: Modo[] = ['kanban', 'tabela', 'painel', 'organograma'];

const ICONE_BLOCO: Record<Bloco, React.ElementType> = {
  FINANCEIRO: Wallet,
  PRESENCA: Users,
  EXTRA: FileText,
};

/**
 * Quais visões cada papel enxerga. Regra do dono do produto:
 *
 *   tesoureiro/secretário   → NENHUMA visão de gestão, só o formulário
 *   dirigente da igreja     → a própria igreja (Kanban e Tabela); ele confere
 *                             o que o tesoureiro e o secretário lançaram
 *   dirigente da hospedeira → tudo pra baixo, incluindo o Organograma
 *   presidente / master     → todas; ele escolhe até que nível quer descer
 */
function modosPermitidos(p: MeusPapeis | null): Modo[] {
  if (!p) return [];
  if (p.irrestrito || p.visaoCampo) return ['kanban', 'tabela', 'painel', 'organograma'];
  if (p.papeis.includes('APROVADOR_HOSPEDEIRA')) return ['kanban', 'tabela', 'organograma'];
  if (p.papeis.includes('APROVADOR_LOCAL')) return ['kanban', 'tabela'];
  return [];
}

/** Topo de cada coluna do Kanban, na cor do próprio status. */
/** Topo de cada coluna, na cor do que ela representa. */
const COR_COLUNA: Record<string, string> = {
  enviar: BORDA.cinza,
  aprovar: BORDA.ambar,
  concluido: BORDA.verde,
};

interface Props {
  /**
   * Entrada pelo item "Hospedeiro" do menu: mostra só a hierarquia abaixo da
   * hospedeira do usuário, já no organograma. O dirigente da hospedeira não
   * quer escolher card nenhum — ele quer ver as igrejas dele.
   */
  escopoHospedeira?: boolean;
}

export default function GestaoCulto({ escopoHospedeira = false }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // O hub manda o papel pela URL: cada card abre a visão que interessa a ele.
  const visaoDaUrl = searchParams.get('visao');
  const modoInicial: Modo | null = MODOS_VALIDOS.includes(visaoDaUrl as Modo)
    ? (visaoDaUrl as Modo)
    : null;
  const blocoDaUrl = searchParams.get('bloco');

  const inicial = periodoPadrao();
  const [de, setDe] = useState(inicial.de);
  const [ate, setAte] = useState(inicial.ate);
  const [tipoCulto, setTipoCulto] = useState('');
  const [horaDe, setHoraDe] = useState('');
  const [horaAte, setHoraAte] = useState('');
  const [modo, setModo] = useState<Modo>(modoInicial ?? 'kanban');

  const [papeis, setPapeis] = useState<MeusPapeis | null>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [grupos, setGrupos] = useState<GrupoDoPainel[]>([]);
  const [campoNome, setCampoNome] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [resumo, setResumo] = useState<PassoResumo | null>(null);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const [imprimindo, setImprimindo] = useState(false);
  /**
   * Atualização automática.
   *
   * O quadro é acompanhado a várias mãos: o tesoureiro lança de um lugar, o
   * secretário de outro e o dirigente aprova de um terceiro. Sem recarregar
   * sozinho, quem está de olho no telão vê um quadro parado e cobra um culto
   * que já entrou. Desligável porque, ao conferir número a número, a lista
   * pulando debaixo do dedo atrapalha.
   */
  const [aoVivo, setAoVivo] = useState(true);
  /** Nós com a visão de valores trancada — o cadeado do organograma. */
  const [bloqueados, setBloqueados] = useState<Set<string>>(new Set());
  const [podeBloquear, setPodeBloquear] = useState(false);
  /** Código gravado no culto → nome cadastrado. O card mostra o nome. */
  const [nomesDeTipo, setNomesDeTipo] = useState<Record<string, string>>({});
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  /** A hospedeira em que o usuário é dirigente — o recorte do item "Hospedeiro". */
  const minhaHospedeira =
    papeis?.posicoes.find((p) => p.papel === 'APROVADOR_HOSPEDEIRA')?.churchId ?? null;
  const recorte = escopoHospedeira ? minhaHospedeira : null;

  const permitidos = modosPermitidos(papeis).filter(
    // Na visão do hospedeiro não faz sentido o Painel do campo inteiro.
    (m) => !escopoHospedeira || m !== 'painel',
  );

  // Recarga é disparada por evento (filtro, botão, mudança no drawer), não por
  // setState dentro do efeito — o efeito só reage e resolve a promessa.
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => {
    setCarregando(true);
    setVersao((v) => v + 1);
  }, []);

  /** Muda um filtro e já acende o carregando, fora do efeito. */
  function aplicarFiltro<T>(setter: (v: T) => void, valor: T) {
    setCarregando(true);
    setter(valor);
  }

  useEffect(() => {
    cultoApi
      .meusPapeis()
      .then((p) => {
        setPapeis(p);
        const permitidos = modosPermitidos(p);
        // A visão pedida pela URL só vale se o papel dela permitir; senão cai
        // na primeira permitida. Sem isso o card mandaria alguém para uma tela
        // que ele não deveria ver.
        if (permitidos.length > 0) {
          if (escopoHospedeira) setModo('organograma');
          else if (modoInicial && permitidos.includes(modoInicial)) setModo(modoInicial);
          else if (p.visaoCampo && !p.podeEnviar.length) setModo('organograma');
          else setModo(permitidos[0]);
        }
      })
      .catch((e) => setErro((e as Error).message));
    // modoInicial vem da URL e é fixo enquanto a tela estiver montada: relê-lo
    // aqui só reabriria a visão padrão por cima da que o usuário escolheu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      cultoApi.listarRegistros({
        de,
        ate,
        tipoCulto: tipoCulto || null,
        hostChurchId: recorte,
        horaDe: horaDe || null,
        horaAte: horaAte || null,
      }),
      cultoApi.painel({ de, ate, tipoCulto: tipoCulto || null, hostChurchId: recorte }),
    ])
      .then(([reg, pai]) => {
        if (!vivo) return;
        setErro(null);
        setRegistros(reg);
        setGrupos(pai.grupos);
        setCampoNome(pai.campoNome);
        setAtualizadoEm(new Date());
      })
      .catch((e) => vivo && setErro((e as Error).message))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [de, ate, tipoCulto, versao, recorte, horaDe, horaAte]);

  /**
   * Recarga silenciosa a cada 20s — sem acender o "carregando", senão a tela
   * pisca a cada volta. Só com a aba visível: nada de bater no servidor com o
   * quadro esquecido atrás de outra janela. Ao voltar para a aba, recarrega na
   * hora, porque nesse intervalo pode ter mudado tudo.
   */
  useEffect(() => {
    cultoApi
      .tiposCulto()
      .then((lista) => {
        const mapa: Record<string, string> = {};
        for (const t of lista) mapa[t.codigo] = t.nome;
        setNomesDeTipo(mapa);
      })
      .catch(() => {
        /* sem cadastro, o card mostra o código gravado */
      });
  }, []);

  const nomeDoTipo = useCallback(
    (codigo: string) => nomesDeTipo[codigo] ?? codigo,
    [nomesDeTipo],
  );

  useEffect(() => {
    cultoApi
      .visaoBloqueada()
      .then((d) => {
        setBloqueados(new Set(d.churchIds ?? []));
        setPodeBloquear(Boolean(d.podeMexer));
      })
      .catch(() => {
        /* sem o cadastro de cadeados a árvore aparece toda liberada */
      });
  }, [versao]);

  /** Tranca ou destranca um nó e já reflete na árvore. */
  async function alternarBloqueio(churchId: string, bloquear: boolean) {
    // Otimista: o cadeado vira na hora e volta atrás se o servidor recusar.
    setBloqueados((atual) => {
      const proximo = new Set(atual);
      if (bloquear) proximo.add(churchId);
      else proximo.delete(churchId);
      return proximo;
    });
    try {
      await cultoApi.bloquearVisao(churchId, bloquear);
    } catch (e) {
      setErro((e as Error).message);
      setBloqueados((atual) => {
        const proximo = new Set(atual);
        if (bloquear) proximo.delete(churchId);
        else proximo.add(churchId);
        return proximo;
      });
    }
  }

  useEffect(() => {
    if (!aoVivo) return;
    const tick = () => {
      if (document.visibilityState === 'visible') setVersao((v) => v + 1);
    };
    const id = window.setInterval(tick, 20000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [aoVivo]);

  /** Bloco que o card do hub mandou destacar (tesoureiro ou secretário). */
  const blocoAtalho: Bloco | null =
    blocoDaUrl === 'FINANCEIRO' || blocoDaUrl === 'PRESENCA' || blocoDaUrl === 'EXTRA'
      ? (blocoDaUrl as Bloco)
      : null;

  const cultosPendentesDoBloco = useMemo(() => {
    if (!blocoAtalho) return 0;
    return registros.filter((r) => r.blocosFaltando.includes(blocoAtalho)).length;
  }, [registros, blocoAtalho]);

  /**
   * As igrejas do meu alcance que não abriram culto nenhum no período.
   *
   * O quadro só mostrava o que existe: igreja que não lançou nada não tem
   * registro e, portanto, não aparecia em lugar nenhum — justo a que o
   * hospedeiro precisa cobrar. Aqui elas entram como card sem registro na
   * coluna "Aguardando envio". O painel já sabe quem são (status SEM_REGISTRO).
   *
   * Vale o período consultado, e não uma agenda de dias de culto: quem consulta
   * escolhe o dia em que houve culto. Numa segunda-feira o quadro apareceria
   * todo vermelho, e é uma pergunta que ninguém faz.
   */
  const igrejasSemLancamento = useMemo(() => {
    const lista: { churchId: string; nome: string; dirigente: string | null; grupo: string }[] = [];
    for (const g of grupos) {
      for (const i of [...g.pendentes, ...g.concluidas]) {
        if (i.status === 'SEM_REGISTRO' || i.totalCultos === 0) {
          lista.push({ churchId: i.churchId, nome: i.nome, dirigente: i.dirigente, grupo: g.nome });
        }
      }
    }
    return lista.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [grupos]);

  /** Registros agrupados por hospedeira/regional, para a tabela aninhada. */
  const agrupados = useMemo(() => {
    const mapa = new Map<string, { nome: string; tipo: string; itens: Registro[] }>();
    for (const r of registros) {
      const hostId = r.hostChurchId ?? (r.church.isHost ? r.church.id : null);
      const chave = hostId ? `H:${hostId}` : `R:${r.regional?.id ?? 'sem'}`;
      const nome = hostId
        ? (r.hostChurch?.name ?? r.church.name)
        : (r.regional?.name ?? 'Sem regional');
      if (!mapa.has(chave)) {
        mapa.set(chave, { nome, tipo: hostId ? 'Hospedeira' : 'Regional', itens: [] });
      }
      mapa.get(chave)!.itens.push(r);
    }
    return Array.from(mapa.entries()).sort((a, b) => a[1].nome.localeCompare(b[1].nome));
  }, [registros]);

  /**
   * A tabela agrupa pela chave `H:<hostId>` / `R:<regionalId>`; o resumo pede o
   * id do nó e o tipo do grupo. Traduz de um para o outro.
   */
  function abrirResumoDoGrupo(chave: string, grupo: { nome: string }) {
    const [prefixo, ...resto] = chave.split(':');
    const id = resto.join(':');
    setResumo({
      nivel: 'GRUPO',
      id,
      tipoGrupo: prefixo === 'H' ? 'HOSPEDEIRA' : 'REGIONAL',
      rotulo: grupo.nome,
    });
  }

  function pastilhasBloco(r: Registro) {
    // Os dois ícones aparecem SEMPRE: cinza quando falta, verde quando chegou.
    // Mostrar só o que estava "exigido" escondia a ausência da presença e o
    // culto parecia completo com um bloco só.
    const base: Bloco[] = ['FINANCEIRO', 'PRESENCA'];
    const blocos: Bloco[] = r.blocosExigidos.includes('EXTRA')
      ? [...base, 'EXTRA']
      : base;
    return (
      <div className="flex items-center gap-1">
        {blocos.map((b) => {
          const Icone = ICONE_BLOCO[b];
          const ok = r.blocosEnviados.includes(b);
          return (
            <span
              key={b}
              title={`${ROTULO_BLOCO[b]}: ${ok ? 'enviado' : 'pendente'}`}
              className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${
                ok ? PASTILHA.verde : PASTILHA.cinza
              }`}
            >
              <Icone className="w-3.5 h-3.5" />
            </span>
          );
        })}
      </div>
    );
  }

  function resumoLancamentos(r: Registro) {
    const fin = r.lancamentos.find((l) => l.bloco === 'FINANCEIRO');
    const pre = r.lancamentos.find((l) => l.bloco === 'PRESENCA');
    if (!fin && !pre) return null;
    return (
      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 pl-6 pb-2">
        {fin && (
          <div>
            <strong className="text-slate-600 dark:text-slate-300">Financeiro</strong>{' '}
            {fmtMoeda(fin.totalDizimos)} em dízimos · {fmtMoeda(fin.totalOfertas)} em ofertas
          </div>
        )}
        {pre && (
          <div>
            <strong className="text-slate-600 dark:text-slate-300">Presença</strong>{' '}
            {pre.qtdHomens ?? 0} H · {pre.qtdMulheres ?? 0} M · {pre.qtdCriancas ?? 0} crianças ·{' '}
            {pre.qtdVisitantes ?? 0} visitantes · {pre.cadeirasVazias ?? 0} cadeiras vazias
          </div>
        )}
      </div>
    );
  }

  // Tesoureiro e secretário não têm visão de gestão: caem direto no formulário.
  if (papeis && permitidos.length === 0) {
    return <CultoMeusLancamentos papeis={papeis} />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Uma faixa só: voltar + título + seletor de visão + ações. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {!escopoHospedeira && (
          <button
            onClick={() => navigate('/app-ui/culto/gestao')}
            title="Visão geral"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {escopoHospedeira ? 'Hospedeiro' : 'Gestão de Culto'}
        </h1>

        {papeis && papeis.posicoes.length > 0 && (
          <span
            className="hidden lg:inline text-xs text-slate-400 truncate max-w-[22rem]"
            title={papeis.posicoes
              .map((pp) => `${pp.rotulo}${pp.churchName ? ` (${pp.churchName})` : ''}`)
              .join(' · ')}
          >
            {papeis.posicoes.map((pp) => pp.rotulo).join(' · ')}
          </span>
        )}

        {/* No celular a faixa vira três blocos empilhados — visões, ações e
            período. Rolagem horizontal escondia o seletor de visão; espremer
            tudo numa linha deixava os campos ilegíveis. */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-auto sm:flex-nowrap">
          <div className="flex w-full sm:w-auto rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {(
              [
                ['kanban', LayoutGrid, 'Kanban'],
                ['tabela', Table2, 'Tabela'],
                ['painel', LayoutDashboard, 'Painel'],
                ['organograma', Network, 'Organograma'],
              ] as [Modo, React.ElementType, string][]
            )
              .filter(([m]) => permitidos.includes(m))
              .map(([m, Icone, label]) => (
                <button
                  key={m}
                  onClick={() => setModo(m)}
                  title={label}
                  className={`inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-2.5 py-1.5 text-sm font-medium transition-colors ${
                    modo === m
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icone className="w-4 h-4 shrink-0" />
                  <span className="truncate sm:hidden xl:inline">{label}</span>
                </button>
              ))}
          </div>

          {papeis?.visaoCampo && (
            <button
              onClick={() => setResumo({ nivel: 'CAMPO', id: null, rotulo: campoNome ?? 'Campo' })}
              title="Resumo consolidado do campo inteiro"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <Sigma className="w-4 h-4" />
              <span className="hidden xl:inline">Resumo</span>
            </button>
          )}

          {/* O que sai no papel é o que o filtro deixou na lista — por isso o
              botão fica junto dos filtros, e não numa tela de relatórios. */}
          <button
            onClick={() => setImprimindo(true)}
            title="Imprimir relatório dos cultos filtrados"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden xl:inline">Imprimir</span>
          </button>

          {/* Período: lado a lado no desktop, um sobre o outro no celular —
              dois campos de data na mesma linha de 360px não cabem legíveis. */}
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <label className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-xs text-slate-400 sm:hidden">de</span>
              <input
                type="date"
                value={de}
                onChange={(e) => aplicarFiltro(setDe, e.target.value)}
                title="Data inicial"
                className="w-full sm:w-auto border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              />
            </label>
            <span className="hidden sm:inline text-slate-400 text-sm">a</span>
            <label className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-xs text-slate-400 sm:hidden">até</span>
              <input
                type="date"
                value={ate}
                onChange={(e) => aplicarFiltro(setAte, e.target.value)}
                title="Data final"
                className="w-full sm:w-auto border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              />
            </label>
          </div>
          <input
            type="time"
            value={horaDe}
            onChange={(e) => aplicarFiltro(setHoraDe, e.target.value)}
            title="Hora inicial — filtra a faixa de horário do culto"
            className="hidden md:block border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          />
          <input
            type="time"
            value={horaAte}
            onChange={(e) => aplicarFiltro(setHoraAte, e.target.value)}
            title="Hora final"
            className="hidden md:block border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          />
          <input
            type="text"
            value={tipoCulto}
            onChange={(e) => aplicarFiltro(setTipoCulto, e.target.value.toUpperCase())}
            placeholder="tipo"
            title="Filtrar por tipo de culto"
            className="hidden xl:block w-20 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          />
          <button
            onClick={() => setAoVivo((v) => !v)}
            title={
              aoVivo
                ? `Atualizando sozinho a cada 20s${
                    atualizadoEm ? ` — última às ${atualizadoEm.toLocaleTimeString('pt-BR')}` : ''
                  }. Clique para congelar.`
                : 'Atualização automática desligada. Clique para voltar a acompanhar ao vivo.'
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              aoVivo
                ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500'
            }`}
          >
            <span className="relative flex w-2 h-2">
              {aoVivo && (
                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              )}
              <span
                className={`relative inline-flex w-2 h-2 rounded-full ${
                  aoVivo ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              />
            </span>
            <span className="hidden xl:inline">
              {aoVivo
                ? atualizadoEm
                  ? atualizadoEm.toLocaleTimeString('pt-BR')
                  : 'Ao vivo'
                : 'Congelado'}
            </span>
          </button>

          <button
            onClick={recarregar}
            title="Atualizar agora"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quem entrou pelo card do tesoureiro ou do secretário já chega sabendo
          qual bloco é dele e onde estão os cultos que ainda dependem disso. */}
      {blocoAtalho && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Você entrou pelo card <strong>{ROTULO_BLOCO[blocoAtalho]}</strong>. Abra um culto da
            coluna <strong>Incluindo</strong> para lançar os seus números.
            {cultosPendentesDoBloco > 0 ? (
              <>
                {' '}
                Há{' '}
                <strong>
                  {cultosPendentesDoBloco} culto{cultosPendentesDoBloco > 1 ? 's' : ''}
                </strong>{' '}
                esperando o seu lançamento neste período.
              </>
            ) : (
              ' Nenhum culto do período está esperando o seu lançamento.'
            )}
          </span>
        </div>
      )}

      {erro && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {carregando && (
        <div className="flex items-center justify-center gap-2 text-slate-400 py-16">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando…
        </div>
      )}

      {!carregando && modo === 'painel' && (
        <CultoPainel grupos={grupos} onAbrirResumo={setResumo} />
      )}

      {!carregando && modo === 'organograma' && (
        <CultoOrganograma
          grupos={grupos}
          registros={registros}
          onAbrirRegistro={setAbertoId}
          onAbrirResumo={setResumo}
          bloqueados={bloqueados}
          podeBloquear={podeBloquear}
          onAlternarBloqueio={(id, bloquear) => void alternarBloqueio(id, bloquear)}
        />
      )}

      {!carregando && modo === 'kanban' && (
        <div className="flex flex-col lg:flex-row gap-4 pb-4 min-w-0">
          {COLUNAS_KANBAN.map((coluna) => {
            const itens = registros.filter((r) => coluna.status.includes(r.status));
            // As igrejas que não abriram culto nenhum entram na primeira
            // coluna: é lá que se olha para saber quem ainda deve.
            const semLancamento = coluna.chave === 'enviar' ? igrejasSemLancamento : [];
            return (
              /* min-w só a partir do lg: no celular as colunas empilham e a
                 largura mínima de 18rem furava a tela de 360px. */
              <div key={coluna.chave} className="flex-1 min-w-0 lg:min-w-[18rem]">
                <div
                  className={`flex items-center justify-between px-3 py-2 rounded-t-xl bg-white dark:bg-slate-800 border-t-4 ${COR_COLUNA[coluna.chave]} border-x border-slate-200 dark:border-slate-700`}
                >
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {coluna.titulo}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {itens.length + semLancamento.length}
                  </span>
                </div>
                <div className="space-y-2 p-2 rounded-b-xl bg-slate-100/70 dark:bg-slate-900/50 border-x border-b border-slate-200 dark:border-slate-700 min-h-[8rem]">
                  {itens.length === 0 && semLancamento.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-6">vazio</p>
                  )}
                  {itens.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setAbertoId(r.id)}
                      className={`w-full text-left rounded-lg bg-white dark:bg-slate-800 border-l-4 ${
                        BORDA[tomDoSemaforo(r.status === 'CONCLUIDO')]
                      } border-y border-r border-slate-200 dark:border-slate-700 p-3 hover:shadow-md transition-shadow`}
                    >
                      <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
                        {r.church.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {fmtData(r.dataCulto)}
                        {turnoDoCulto(r.horaInicio) ? ` · ${turnoDoCulto(r.horaInicio)}` : ''}
                        {fmtHora(r.horaInicio, r.horaFim)
                          ? ` · ${fmtHora(r.horaInicio, r.horaFim)}`
                          : ''}{' '}
                        · {nomeDoTipo(r.tipoCulto)}
                      </div>
                      {/* A coluna agrupa estados; o card diz qual é o dele. */}
                      {r.status !== 'ABERTO' && (
                        <span
                          className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            PASTILHA[TOM_DO_STATUS[r.status]]
                          }`}
                        >
                          {ROTULO_STATUS[r.status]}
                        </span>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        {pastilhasBloco(r)}
                        {r.blocosFaltando.length > 0 && (
                          /* O nome do bloco, não a contagem: "falta 1" obrigava
                             a abrir o card para descobrir se o que faltava era
                             o dinheiro ou a presença. */
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PASTILHA.vermelho}`}>
                            falta {r.blocosFaltando.map((b) => ROTULO_BLOCO[b]).join(' e ')}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}

                  {/* Sem registro: a igreja não abriu culto nenhum no período.
                      Borda tracejada para não se confundir com culto aberto. */}
                  {semLancamento.map((i) => (
                    <button
                      key={`sem:${i.churchId}`}
                      onClick={() =>
                        setResumo({ nivel: 'IGREJA', id: i.churchId, rotulo: i.nome })
                      }
                      className="w-full text-left rounded-lg bg-white/60 dark:bg-slate-800/40 border-2 border-dashed border-slate-300 dark:border-slate-600 p-3 hover:shadow-md transition-shadow"
                    >
                      <div className="font-semibold text-sm text-slate-600 dark:text-slate-300 truncate">
                        {i.nome}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        nenhum culto lançado no período
                        {i.dirigente ? ` · ${i.dirigente}` : ''}
                      </div>
                      {/* De quem ela é: sem isto, quem tem várias hospedeiras
                          não sabe se aquela igreja é dele. */}
                      <div className="text-[11px] text-slate-400 truncate">{i.grupo}</div>
                      <div className="mt-2 flex items-center justify-end">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PASTILHA.vermelho}`}>
                          não abriu culto
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* A tabela tem colunas demais para 360px. Em vez de espremer (que fazia
          o status escrever por cima do nome da igreja), ela rola na horizontal
          dentro do próprio cartão, com largura mínima que preserva o alinhamento. */}
      {!carregando && modo === 'tabela' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto shadow-sm">
          <div className="min-w-[44rem] sm:min-w-0">
          {agrupados.length === 0 ? (
            <div className="text-center py-20 text-slate-400 dark:text-slate-500">
              Nenhum culto registrado no período.
            </div>
          ) : (
            agrupados.map(([chave, grupo]) => {
              const concluidas = grupo.itens.filter((r) => r.status === 'CONCLUIDO').length;
              const aberto = expandido[chave] ?? true;
              return (
                <div key={chave} className="border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <button
                    onClick={() => setExpandido((s) => ({ ...s, [chave]: !aberto }))}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900"
                  >
                    <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100 text-sm">
                      {aberto ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      {grupo.nome}
                      <span className="text-xs font-normal text-slate-400">{grupo.tipo}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirResumoDoGrupo(chave, grupo);
                        }}
                        className="text-emerald-600 hover:underline font-semibold"
                      >
                        resumo
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        concluídos {concluidas}/{grupo.itens.length}
                      </span>
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          PONTO[tomDoSemaforo(concluidas === grupo.itens.length)]
                        }`}
                      />
                    </span>
                  </button>

                  {aberto &&
                    grupo.itens.map((r) => {
                      const chaveItem = `${chave}:${r.id}`;
                      const itemAberto = expandido[chaveItem] ?? false;
                      return (
                        <div key={r.id}>
                          <div className="flex items-center justify-between px-4 py-2.5 pl-10 hover:bg-slate-50 dark:hover:bg-slate-900/40">
                            <button
                              onClick={() =>
                                setExpandido((s) => ({ ...s, [chaveItem]: !itemAberto }))
                              }
                              className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 min-w-0"
                            >
                              {itemAberto ? (
                                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span className="truncate font-medium">{r.church.name}</span>
                              <span className="text-xs text-slate-400 shrink-0">
                                {fmtData(r.dataCulto)}
                                {turnoDoCulto(r.horaInicio) ? ` · ${turnoDoCulto(r.horaInicio)}` : ''}
                                {fmtHora(r.horaInicio, r.horaFim)
                                  ? ` · ${fmtHora(r.horaInicio, r.horaFim)}`
                                  : ''}
                              </span>
                            </button>
                            <div className="flex items-center gap-3 shrink-0">
                              {pastilhasBloco(r)}
                              <span className="text-xs text-slate-500 dark:text-slate-400 w-40 text-right">
                                {ROTULO_STATUS[r.status]}
                              </span>
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${
                                  PONTO[TOM_DO_STATUS[r.status]]
                                }`}
                              />
                              <button
                                onClick={() =>
                                  setResumo({
                                    nivel: 'IGREJA',
                                    id: r.churchId,
                                    rotulo: r.church.name,
                                  })
                                }
                                className="text-xs font-semibold text-slate-500 hover:text-emerald-600"
                              >
                                resumo
                              </button>
                              <button
                                onClick={() => setAbertoId(r.id)}
                                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                              >
                                abrir
                              </button>
                            </div>
                          </div>
                          {itemAberto && resumoLancamentos(r)}
                        </div>
                      );
                    })}

                  {/* As que não abriram culto nenhum fecham o grupo: é a lista
                      de quem o dirigente da hospedeira ainda precisa cobrar. */}
                  {aberto &&
                    igrejasSemLancamento
                      .filter((i) => i.grupo === grupo.nome)
                      .map((i) => (
                        <div
                          key={`sem:${i.churchId}`}
                          className="flex items-center justify-between px-4 py-2.5 pl-10 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                        >
                          <span className="flex items-center gap-2 min-w-0 text-sm text-slate-500 dark:text-slate-400">
                            <span className="w-3.5 shrink-0" />
                            <span className="truncate">{i.nome}</span>
                            <span className="text-xs text-slate-400 shrink-0">
                              nenhum culto lançado
                            </span>
                          </span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PASTILHA.vermelho}`}
                            >
                              não abriu culto
                            </span>
                            <button
                              onClick={() =>
                                setResumo({ nivel: 'IGREJA', id: i.churchId, rotulo: i.nome })
                              }
                              className="text-xs font-semibold text-slate-500 hover:text-emerald-600"
                            >
                              resumo
                            </button>
                          </div>
                        </div>
                      ))}
                </div>
              );
            })
          )}

          {/* Grupo inteiro sem nenhum culto no período não aparece acima (a
              tabela é montada a partir dos registros). Estas igrejas ficariam
              invisíveis justamente por não terem lançado nada. */}
          {(() => {
            const gruposNaTabela = new Set(agrupados.map(([, g]) => g.nome));
            const orfas = igrejasSemLancamento.filter((i) => !gruposNaTabela.has(i.grupo));
            if (orfas.length === 0) return null;
            return (
              <div className="border-b border-slate-100 dark:border-slate-700 last:border-0">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/40 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Sem nenhum culto no período
                  <span className="ml-1 text-xs font-normal text-slate-400">
                    ({orfas.length} igreja{orfas.length > 1 ? 's' : ''})
                  </span>
                </div>
                {orfas.map((i) => (
                  <div
                    key={`orfa:${i.churchId}`}
                    className="flex items-center justify-between px-4 py-2.5 pl-10 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                  >
                    <span className="flex items-center gap-2 min-w-0 text-sm text-slate-500 dark:text-slate-400">
                      <span className="truncate">{i.nome}</span>
                      <span className="text-xs text-slate-400 shrink-0 truncate">{i.grupo}</span>
                    </span>
                    <button
                      onClick={() => setResumo({ nivel: 'IGREJA', id: i.churchId, rotulo: i.nome })}
                      className="text-xs font-semibold text-slate-500 hover:text-emerald-600 shrink-0"
                    >
                      resumo
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}
          </div>
        </div>
      )}

      {resumo && (
        <CultoResumoModal
          inicial={resumo}
          de={de}
          ate={ate}
          tipoCulto={tipoCulto || null}
          onFechar={() => setResumo(null)}
          onAbrirCulto={(id) => {
            setResumo(null);
            setAbertoId(id);
          }}
        />
      )}

      {abertoId && (
        <CultoRegistroDrawer
          registroId={abertoId}
          onFechar={() => setAbertoId(null)}
          onMudou={recarregar}
        />
      )}

      {imprimindo && (
        <CultoImprimirModal
          registros={registros}
          titulo="Relatório de Gestão de Cultos"
          periodo={`${fmtData(de)} a ${fmtData(ate)}${campoNome ? ` · ${campoNome}` : ''}${
            escopoHospedeira ? ' · visão do hospedeiro' : ''
          }`}
          onFechar={() => setImprimindo(false)}
        />
      )}
    </div>
  );
}
