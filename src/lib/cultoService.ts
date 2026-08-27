/**
 * Gestão de Culto — máquina de estados e agregação hierárquica.
 *
 * Duas responsabilidades:
 *   1. decidir o status de um registro a partir do que foi enviado e aprovado;
 *   2. montar o rollup verde/vermelho que sobe até o Pastor Presidente.
 *
 * Ver docs/modules/gestao-culto/SPEC.md, seções 3 e 5.1.
 */
import { prisma } from './prisma';
import { type Bloco, type Status } from './cultoScope';

/**
 * Blocos que todo culto precisa ter para ir a aprovação.
 *
 * FINANCEIRO e PRESENCA são SEMPRE exigidos — um fechamento de culto sem a
 * contagem de gente não é fechamento. EXTRA continua opcional: só é cobrado se
 * a igreja tiver alguém anexado àquele papel.
 *
 * Isto mudou em 27/08/2026. Antes a obrigatoriedade era derivada das posições
 * ativas, e o efeito colateral apareceu na tela: igreja com só o tesoureiro
 * anexado fechava o culto com um bloco só e aparecia "Concluído" exibindo
 * apenas o ícone de tesouraria — sem ninguém ter contado a presença.
 *
 * O preço é conhecido e aceito: igreja sem secretário anexado fica travada em
 * "Aguardando envio" até alguém ser anexado ao papel PRESENCA.
 */
export const BLOCOS_SEMPRE_EXIGIDOS: Bloco[] = ['FINANCEIRO', 'PRESENCA'];

export async function blocosExigidos(churchId: string): Promise<Bloco[]> {
  const temExtra = await prisma.cultoPosicao.findFirst({
    where: { churchId, isActive: true, deletedAt: null, papel: 'EXTRA' },
    select: { id: true },
  });
  return temExtra ? [...BLOCOS_SEMPRE_EXIGIDOS, 'EXTRA'] : [...BLOCOS_SEMPRE_EXIGIDOS];
}

/**
 * Versão em lote de `blocosExigidos`, para listas.
 *
 * Chamar `blocosExigidos` num laço custa uma ida ao banco por igreja. Medido em
 * 27/08/2026 contra o pooler: 85 igrejas levavam **65,5 s** em laço contra
 * **0,9 s** numa query só — era o minuto de espera da tela. Nunca chame a
 * versão de uma igreja dentro de um `for`.
 */
export async function blocosExigidosPorIgreja(
  churchIds: string[],
): Promise<Map<string, Bloco[]>> {
  const mapa = new Map<string, Bloco[]>();
  if (churchIds.length === 0) return mapa;

  // Só o EXTRA depende de ter alguém anexado; os outros dois são sempre.
  const comExtra = await prisma.cultoPosicao.findMany({
    where: {
      churchId: { in: churchIds },
      isActive: true,
      deletedAt: null,
      papel: 'EXTRA',
    },
    select: { churchId: true },
  });
  const temExtra = new Set(comExtra.map((p) => p.churchId).filter(Boolean) as string[]);

  for (const id of churchIds) {
    mapa.set(id, temExtra.has(id) ? [...BLOCOS_SEMPRE_EXIGIDOS, 'EXTRA'] : [...BLOCOS_SEMPRE_EXIGIDOS]);
  }
  return mapa;
}

/** A igreja passa pelo nível HOSPEDEIRA? Só se tiver hospedeira de fato (D3). */
export function temNivelHospedeira(registro: { hostChurchId: string | null }): boolean {
  return Boolean(registro.hostChurchId);
}

export interface ResultadoRecalculo {
  status: Status;
  mudou: boolean;
  exigidos: Bloco[];
  enviados: Bloco[];
  faltando: Bloco[];
}

/**
 * Recalcula e persiste o status do registro a partir dos blocos enviados e das
 * aprovações existentes. Idempotente — pode ser chamado a cada mutação.
 */
export async function recalcularStatus(registroId: string): Promise<ResultadoRecalculo> {
  const registro = await prisma.cultoRegistro.findUnique({
    where: { id: registroId },
    include: {
      lancamentos: { select: { bloco: true, enviadoEm: true } },
      aprovacoes: { select: { nivel: true, decisao: true } },
    },
  });
  if (!registro) throw new Error('Registro de culto não encontrado.');

  const exigidos = await blocosExigidos(registro.churchId);
  const enviados = registro.lancamentos
    .filter((l) => l.enviadoEm !== null)
    .map((l) => l.bloco as Bloco);
  const faltando = exigidos.filter((b) => !enviados.includes(b));

  const local = registro.aprovacoes.find((a) => a.nivel === 'LOCAL');
  const hospedeira = registro.aprovacoes.find((a) => a.nivel === 'HOSPEDEIRA');

  let status: Status;

  if (local?.decisao === 'REJEITADO' || hospedeira?.decisao === 'REJEITADO') {
    status = 'REJEITADO';
  } else if (hospedeira?.decisao === 'APROVADO') {
    status = 'CONCLUIDO';
  } else if (local?.decisao === 'APROVADO') {
    // Sem hospedeira, a aprovação do dirigente local já fecha o culto (D3).
    // Hoje isso vale para 122 das 126 igrejas, que ainda não foram organizadas
    // sob uma hospedeira.
    status = temNivelHospedeira(registro) ? 'APROVADO_LOCAL' : 'CONCLUIDO';
  } else if (exigidos.length > 0 && faltando.length === 0) {
    status = 'AGUARDANDO_LOCAL';
  } else if (exigidos.length === 0 && enviados.length > 0) {
    // Igreja sem nenhum lançador anexado, mas alguém (master) lançou: não trava
    // o registro num limbo — segue para aprovação.
    status = 'AGUARDANDO_LOCAL';
  } else {
    status = 'ABERTO';
  }

  const mudou = status !== registro.status;
  if (mudou) {
    await prisma.cultoRegistro.update({
      where: { id: registroId },
      data: {
        status,
        concluidoEm: status === 'CONCLUIDO' ? new Date() : null,
      },
    });
  }

  return { status, mudou, exigidos, enviados, faltando };
}

/** Verde só quando concluído. Todo o resto é vermelho para quem está acima. */
export function corDoStatus(status: string): 'VERDE' | 'VERMELHO' {
  return status === 'CONCLUIDO' ? 'VERDE' : 'VERMELHO';
}

export interface IgrejaNoPainel {
  churchId: string;
  nome: string;
  dirigente: string | null;
  /** Situação do culto mais atrasado do período (o que o dirigente precisa ver). */
  status: Status | 'SEM_REGISTRO';
  registroId: string | null;
  dataCulto: string | null;
  /** Quantos cultos a igreja tem no período e quantos já fecharam. */
  totalCultos: number;
  cultosConcluidos: number;
}

export interface GrupoDoPainel {
  tipo: 'HOSPEDEIRA' | 'REGIONAL';
  id: string;
  nome: string;
  dirigente: string | null;
  totalIgrejas: number;
  concluidas: IgrejaNoPainel[];
  pendentes: IgrejaNoPainel[];
  cor: 'VERDE' | 'VERMELHO';
}

/**
 * Monta o painel do diagrama: um card por hospedeira, com total de igrejas,
 * quais concluíram e quais faltam — com nome da igreja e do dirigente.
 *
 * Agrupamento (D3):
 *   1. host_church_id preenchido  → agrupa sob a hospedeira
 *   2. is_host = true             → é ela mesma o grupo
 *   3. nenhum dos dois            → agrupa sob a REGIONAL
 *
 * O caso 3 é a regra, não a exceção, enquanto a organização por hospedeiras não
 * é concluída: hoje 122 das 126 igrejas caem nele.
 */
export async function montarPainel(params: {
  campoId: string;
  de: Date;
  ate: Date;
  tipoCulto?: string | null;
  churchIds?: string[] | null;
}): Promise<GrupoDoPainel[]> {
  const { campoId, de, ate, tipoCulto, churchIds } = params;

  const igrejas = await prisma.church.findMany({
    where: {
      deletedAt: null,
      regional: { campoId },
      ...(churchIds ? { id: { in: churchIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      isHost: true,
      hostChurchId: true,
      regionalId: true,
      currentLeaderName: true,
      regional: { select: { id: true, name: true } },
    },
  });
  if (igrejas.length === 0) return [];

  const idsIgrejas = igrejas.map((c) => c.id);

  const registros = await prisma.cultoRegistro.findMany({
    where: {
      churchId: { in: idsIgrejas },
      deletedAt: null,
      dataCulto: { gte: de, lte: ate },
      ...(tipoCulto ? { tipoCulto } : {}),
    },
    select: { id: true, churchId: true, status: true, dataCulto: true },
    orderBy: { dataCulto: 'desc' },
  });

  // Dirigentes: quem está anexado como APROVADOR_LOCAL / APROVADOR_HOSPEDEIRA.
  // Cai para churches.current_leader_name (texto livre) quando ninguém foi
  // anexado ainda — é o que existe hoje em 85 igrejas.
  const posicoes = await prisma.cultoPosicao.findMany({
    where: {
      churchId: { in: idsIgrejas },
      isActive: true,
      deletedAt: null,
      papel: { in: ['APROVADOR_LOCAL', 'APROVADOR_HOSPEDEIRA'] },
    },
    select: { churchId: true, papel: true, user: { select: { fullName: true } } },
  });

  const dirigenteLocal = new Map<string, string>();
  const dirigenteHospedeira = new Map<string, string>();
  for (const p of posicoes) {
    if (!p.churchId) continue;
    const alvo = p.papel === 'APROVADOR_HOSPEDEIRA' ? dirigenteHospedeira : dirigenteLocal;
    if (!alvo.has(p.churchId)) alvo.set(p.churchId, p.user.fullName);
  }

  // Um registro por igreja no período: o mais recente manda no semáforo.
  // Igreja com vários cultos no intervalo fica pendente enquanto qualquer um
  // deles não estiver concluído.
  const porIgreja = new Map<string, { status: string; id: string; dataCulto: Date }[]>();
  for (const r of registros) {
    const lista = porIgreja.get(r.churchId) ?? [];
    lista.push({ status: r.status, id: r.id, dataCulto: r.dataCulto });
    porIgreja.set(r.churchId, lista);
  }

  const nomePorId = new Map(igrejas.map((c) => [c.id, c.name]));

  function situacao(c: (typeof igrejas)[number]): IgrejaNoPainel {
    const lista = porIgreja.get(c.id) ?? [];
    const pendente = lista.find((r) => r.status !== 'CONCLUIDO');
    const escolhido = pendente ?? lista[0] ?? null;
    return {
      churchId: c.id,
      nome: c.name,
      dirigente: dirigenteLocal.get(c.id) ?? c.currentLeaderName ?? null,
      status: (escolhido?.status as Status) ?? 'SEM_REGISTRO',
      registroId: escolhido?.id ?? null,
      dataCulto: escolhido ? escolhido.dataCulto.toISOString().slice(0, 10) : null,
      totalCultos: lista.length,
      cultosConcluidos: lista.filter((r) => r.status === 'CONCLUIDO').length,
    };
  }

  const grupos = new Map<string, GrupoDoPainel>();

  function grupoDe(c: (typeof igrejas)[number]): GrupoDoPainel {
    const hostId = c.hostChurchId ?? (c.isHost ? c.id : null);
    if (hostId) {
      const chave = `H:${hostId}`;
      if (!grupos.has(chave)) {
        grupos.set(chave, {
          tipo: 'HOSPEDEIRA',
          id: hostId,
          nome: nomePorId.get(hostId) ?? 'Hospedeira',
          dirigente: dirigenteHospedeira.get(hostId) ?? dirigenteLocal.get(hostId) ?? null,
          totalIgrejas: 0,
          concluidas: [],
          pendentes: [],
          cor: 'VERDE',
        });
      }
      return grupos.get(chave)!;
    }
    const chave = `R:${c.regionalId ?? 'sem'}`;
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        tipo: 'REGIONAL',
        id: c.regionalId ?? 'sem',
        nome: c.regional?.name ?? 'Sem regional',
        dirigente: null,
        totalIgrejas: 0,
        concluidas: [],
        pendentes: [],
        cor: 'VERDE',
      });
    }
    return grupos.get(chave)!;
  }

  for (const c of igrejas) {
    const grupo = grupoDe(c);
    grupo.totalIgrejas += 1;
    const sit = situacao(c);
    if (sit.status === 'CONCLUIDO') grupo.concluidas.push(sit);
    else grupo.pendentes.push(sit);
  }

  const saida = Array.from(grupos.values());
  for (const g of saida) {
    g.cor = g.pendentes.length === 0 ? 'VERDE' : 'VERMELHO';
    g.concluidas.sort((a, b) => a.nome.localeCompare(b.nome));
    g.pendentes.sort((a, b) => a.nome.localeCompare(b.nome));
  }
  saida.sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === 'HOSPEDEIRA' ? -1 : 1;
    return a.nome.localeCompare(b.nome);
  });
  return saida;
}

/**
 * Parser tolerante para `de`/`ate` da query string.
 *
 * Padrão: os últimos 7 dias, não o mês inteiro. Uma igreja é considerada
 * pendente enquanto QUALQUER culto do intervalo estiver aberto — sobre um mês
 * cheio isso pinta praticamente tudo de vermelho e o painel deixa de informar.
 * Medido em 27/08/2026 com o mês inteiro: 0 de 116 igrejas apareciam verdes.
 * Uma semana cobre a pergunta real ("fecharam o culto de domingo?") e o
 * usuário amplia o intervalo quando quiser.
 */
export function periodoDaQuery(searchParams: URLSearchParams): { de: Date; ate: Date } {
  const hoje = new Date();
  const deRaw = searchParams.get('de');
  const ateRaw = searchParams.get('ate');
  const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate(), 23, 59, 59, 999));
  const inicio = new Date(fim);
  inicio.setUTCDate(inicio.getUTCDate() - 6);
  inicio.setUTCHours(0, 0, 0, 0);

  const de = deRaw ? new Date(`${deRaw}T00:00:00.000Z`) : inicio;
  const ate = ateRaw ? new Date(`${ateRaw}T23:59:59.999Z`) : fim;
  return { de, ate };
}


/**
 * "19:30" → Date usada nas colunas TIME do Postgres.
 *
 * O Prisma representa TIME como Date; só a parte de hora é gravada. A data
 * base é irrelevante, mas precisa ser estável para não variar por fuso.
 */
export function horaParaDate(hora?: string | null): Date | null {
  if (!hora) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hora).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return new Date(Date.UTC(1970, 0, 1, h, min, 0));
}

/** Date da coluna TIME → "19:30", para a API devolver algo legível. */
export function dateParaHora(valor?: Date | null): string | null {
  if (!valor) return null;
  const h = String(valor.getUTCHours()).padStart(2, '0');
  const m = String(valor.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Filtro por faixa de horário (`hora_de` / `hora_ate`).
 *
 * Registros sem hora ficam de fora quando a faixa é usada — não dá para
 * afirmar que um culto sem horário informado aconteceu às 19h.
 */
export function filtroDeHora(searchParams: URLSearchParams): Record<string, unknown> {
  const de = horaParaDate(searchParams.get('hora_de'));
  const ate = horaParaDate(searchParams.get('hora_ate'));
  if (!de && !ate) return {};
  return {
    horaInicio: {
      ...(de ? { gte: de } : {}),
      ...(ate ? { lte: ate } : {}),
    },
  };
}
