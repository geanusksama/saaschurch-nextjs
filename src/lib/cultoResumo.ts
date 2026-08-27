/**
 * Gestão de Culto — resumo hierárquico consolidado.
 *
 * É o que o modal mostra ao clicar num nó: o total DAQUELE nível e a lista do
 * nível imediatamente abaixo, para poder descer clicando.
 *
 *   Campo  → soma do campo   + um filho por hospedeira/regional
 *   Grupo  → soma do grupo   + um filho por igreja
 *   Igreja → soma da igreja  + um filho por culto do período
 *
 * A soma respeita a mesma matriz de visibilidade da seção 4 da SPEC: um
 * tesoureiro que abra o resumo vê o financeiro consolidado e nada de presença.
 * Bloco que ele não pode ver não entra nem na conta.
 */
import { prisma } from './prisma';
import type { Status } from './cultoScope';

export type NivelResumo = 'CAMPO' | 'GRUPO' | 'IGREJA';
export type TipoGrupo = 'HOSPEDEIRA' | 'REGIONAL';

export interface TotaisFinanceiro {
  totalDizimos: number;
  totalOfertas: number;
  qtdDizimos: number;
  qtdOfertas: number;
}

export interface TotaisPresenca {
  homens: number;
  mulheres: number;
  jovens: number;
  adolescentes: number;
  criancas: number;
  visitantes: number;
  conversoes: number;
  reconciliacoes: number;
  familias: number;
  cadeirasVazias: number;
  /** Soma das faixas de público presentes no culto. */
  publicoTotal: number;
}

export interface NoResumo {
  tipo: 'GRUPO' | 'IGREJA' | 'CULTO';
  id: string;
  nome: string;
  subtitulo: string | null;
  dirigente: string | null;
  cultos: number;
  concluidos: number;
  cor: 'VERDE' | 'VERMELHO';
  /** Preenchidos apenas em nós do tipo CULTO. */
  status: Status | null;
  dataCulto: string | null;
  registroId: string | null;
  financeiro: TotaisFinanceiro | null;
  presenca: TotaisPresenca | null;
  /** Dá para abrir o resumo deste filho? (culto abre o detalhe, não o resumo) */
  navegavel: boolean;
  /** Só em filhos do tipo GRUPO — o modal precisa para descer. */
  tipoGrupo: TipoGrupo | null;
}

export interface Resumo {
  nivel: NivelResumo;
  id: string | null;
  titulo: string;
  subtitulo: string | null;
  periodo: { de: string; ate: string };
  totais: {
    igrejas: number;
    cultos: number;
    concluidos: number;
    pendentes: number;
    financeiro: TotaisFinanceiro | null;
    presenca: TotaisPresenca | null;
  };
  filhos: NoResumo[];
}

function zeroFinanceiro(): TotaisFinanceiro {
  return { totalDizimos: 0, totalOfertas: 0, qtdDizimos: 0, qtdOfertas: 0 };
}

function zeroPresenca(): TotaisPresenca {
  return {
    homens: 0,
    mulheres: 0,
    jovens: 0,
    adolescentes: 0,
    criancas: 0,
    visitantes: 0,
    conversoes: 0,
    reconciliacoes: 0,
    familias: 0,
    cadeirasVazias: 0,
    publicoTotal: 0,
  };
}

interface LinhaLancamento {
  registroId: string;
  bloco: string;
  totalDizimos: unknown;
  totalOfertas: unknown;
  qtdDizimos: number | null;
  qtdOfertas: number | null;
  qtdHomens: number | null;
  qtdMulheres: number | null;
  qtdJovens: number | null;
  qtdAdolescentes: number | null;
  qtdCriancas: number | null;
  qtdVisitantes: number | null;
  qtdConversoes: number | null;
  qtdReconciliacoes: number | null;
  qtdFamilias: number | null;
  cadeirasVazias: number | null;
}

interface Acumulador {
  financeiro: TotaisFinanceiro;
  presenca: TotaisPresenca;
}

function novoAcumulador(): Acumulador {
  return { financeiro: zeroFinanceiro(), presenca: zeroPresenca() };
}

function acumular(destino: Acumulador, l: LinhaLancamento) {
  if (l.bloco === 'FINANCEIRO') {
    destino.financeiro.totalDizimos += Number(l.totalDizimos ?? 0);
    destino.financeiro.totalOfertas += Number(l.totalOfertas ?? 0);
    destino.financeiro.qtdDizimos += l.qtdDizimos ?? 0;
    destino.financeiro.qtdOfertas += l.qtdOfertas ?? 0;
    return;
  }
  if (l.bloco !== 'PRESENCA') return;
  const p = destino.presenca;
  p.homens += l.qtdHomens ?? 0;
  p.mulheres += l.qtdMulheres ?? 0;
  p.jovens += l.qtdJovens ?? 0;
  p.adolescentes += l.qtdAdolescentes ?? 0;
  p.criancas += l.qtdCriancas ?? 0;
  p.visitantes += l.qtdVisitantes ?? 0;
  p.conversoes += l.qtdConversoes ?? 0;
  p.reconciliacoes += l.qtdReconciliacoes ?? 0;
  p.familias += l.qtdFamilias ?? 0;
  p.cadeirasVazias += l.cadeirasVazias ?? 0;
  p.publicoTotal =
    p.homens + p.mulheres + p.jovens + p.adolescentes + p.criancas + p.visitantes;
}

/**
 * Quais igrejas compõem o nó pedido.
 *
 * Um grupo REGIONAL junta só as igrejas SOLTAS daquela regional: as que já têm
 * hospedeira pertencem ao grupo dela. Sem esse recorte a igreja apareceria em
 * dois grupos e a soma do campo sairia inflada.
 */
async function igrejasDoNo(params: {
  campoId: string;
  nivel: NivelResumo;
  id?: string | null;
  tipoGrupo?: TipoGrupo | null;
}): Promise<string[]> {
  const { campoId, nivel, id, tipoGrupo } = params;

  if (nivel === 'IGREJA') return id ? [id] : [];

  if (nivel === 'GRUPO' && id) {
    if (tipoGrupo === 'REGIONAL') {
      const lista = await prisma.church.findMany({
        where: {
          regionalId: id,
          deletedAt: null,
          hostChurchId: null,
          isHost: false,
          regional: { campoId },
        },
        select: { id: true },
      });
      return lista.map((c) => c.id);
    }
    const filhas = await prisma.church.findMany({
      where: { hostChurchId: id, deletedAt: null, regional: { campoId } },
      select: { id: true },
    });
    return [id, ...filhas.map((c) => c.id)];
  }

  const todas = await prisma.church.findMany({
    where: { deletedAt: null, regional: { campoId } },
    select: { id: true },
  });
  return todas.map((c) => c.id);
}

export async function montarResumo(params: {
  campoId: string;
  nivel: NivelResumo;
  id?: string | null;
  tipoGrupo?: TipoGrupo | null;
  de: Date;
  ate: Date;
  tipoCulto?: string | null;
  /** Escopo do usuário: `null` = campo inteiro. */
  churchIdsPermitidos: string[] | null;
  /** Blocos que o usuário pode ver — a agregação respeita isso. */
  blocosVisiveis: string[];
  campoNome: string | null;
}): Promise<Resumo> {
  const {
    campoId,
    nivel,
    id,
    tipoGrupo,
    de,
    ate,
    tipoCulto,
    churchIdsPermitidos,
    blocosVisiveis,
    campoNome,
  } = params;

  const veFinanceiro = blocosVisiveis.includes('FINANCEIRO');
  const vePresenca = blocosVisiveis.includes('PRESENCA');

  function comVisibilidade(acc: Acumulador) {
    return {
      financeiro: veFinanceiro ? acc.financeiro : null,
      presenca: vePresenca ? acc.presenca : null,
    };
  }

  const periodo = { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) };

  const doNo = await igrejasDoNo({ campoId, nivel, id, tipoGrupo });
  const idsIgrejas =
    churchIdsPermitidos === null ? doNo : doNo.filter((c) => churchIdsPermitidos.includes(c));

  if (idsIgrejas.length === 0) {
    return {
      nivel,
      id: id ?? null,
      titulo: campoNome ?? 'Campo',
      subtitulo: null,
      periodo,
      totais: {
        igrejas: 0,
        cultos: 0,
        concluidos: 0,
        pendentes: 0,
        ...comVisibilidade(novoAcumulador()),
      },
      filhos: [],
    };
  }

  const igrejas = await prisma.church.findMany({
    where: { id: { in: idsIgrejas }, deletedAt: null },
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

  const registros = await prisma.cultoRegistro.findMany({
    where: {
      churchId: { in: idsIgrejas },
      deletedAt: null,
      dataCulto: { gte: de, lte: ate },
      ...(tipoCulto ? { tipoCulto } : {}),
    },
    select: { id: true, churchId: true, status: true, dataCulto: true, tipoCulto: true },
    orderBy: { dataCulto: 'desc' },
  });

  const lancamentos: LinhaLancamento[] =
    registros.length && blocosVisiveis.length
      ? await prisma.cultoLancamento.findMany({
          where: {
            registroId: { in: registros.map((r) => r.id) },
            enviadoEm: { not: null },
            // A poda acontece aqui: bloco invisível não entra nem na soma.
            bloco: { in: blocosVisiveis },
          },
          select: {
            registroId: true,
            bloco: true,
            totalDizimos: true,
            totalOfertas: true,
            qtdDizimos: true,
            qtdOfertas: true,
            qtdHomens: true,
            qtdMulheres: true,
            qtdJovens: true,
            qtdAdolescentes: true,
            qtdCriancas: true,
            qtdVisitantes: true,
            qtdConversoes: true,
            qtdReconciliacoes: true,
            qtdFamilias: true,
            cadeirasVazias: true,
          },
        })
      : [];

  const lancPorRegistro = new Map<string, LinhaLancamento[]>();
  for (const l of lancamentos) {
    const lista = lancPorRegistro.get(l.registroId) ?? [];
    lista.push(l);
    lancPorRegistro.set(l.registroId, lista);
  }

  const registrosPorIgreja = new Map<string, typeof registros>();
  for (const r of registros) {
    const lista = registrosPorIgreja.get(r.churchId) ?? [];
    lista.push(r);
    registrosPorIgreja.set(r.churchId, lista);
  }

  const dirigentes = await prisma.cultoPosicao.findMany({
    where: {
      churchId: { in: idsIgrejas },
      isActive: true,
      deletedAt: null,
      papel: { in: ['APROVADOR_LOCAL', 'APROVADOR_HOSPEDEIRA'] },
    },
    select: { churchId: true, papel: true, user: { select: { fullName: true } } },
  });
  const dirLocal = new Map<string, string>();
  const dirHosp = new Map<string, string>();
  for (const d of dirigentes) {
    if (!d.churchId) continue;
    const alvo = d.papel === 'APROVADOR_HOSPEDEIRA' ? dirHosp : dirLocal;
    if (!alvo.has(d.churchId)) alvo.set(d.churchId, d.user.fullName);
  }

  function somaDe(lista: typeof registros): Acumulador {
    const acc = novoAcumulador();
    for (const r of lista) {
      for (const l of lancPorRegistro.get(r.id) ?? []) acumular(acc, l);
    }
    return acc;
  }

  const nomePorId = new Map(igrejas.map((c) => [c.id, c.name]));
  const filhos: NoResumo[] = [];

  if (nivel === 'IGREJA') {
    for (const r of registros) {
      const vis = comVisibilidade(somaDe([r]));
      filhos.push({
        tipo: 'CULTO',
        id: r.id,
        nome: `${r.dataCulto.toISOString().slice(0, 10)} · ${r.tipoCulto}`,
        subtitulo: null,
        dirigente: null,
        cultos: 1,
        concluidos: r.status === 'CONCLUIDO' ? 1 : 0,
        cor: r.status === 'CONCLUIDO' ? 'VERDE' : 'VERMELHO',
        status: r.status as Status,
        dataCulto: r.dataCulto.toISOString().slice(0, 10),
        registroId: r.id,
        ...vis,
        navegavel: false,
        tipoGrupo: null,
      });
    }
  } else if (nivel === 'GRUPO') {
    for (const c of igrejas) {
      const daIgreja = registrosPorIgreja.get(c.id) ?? [];
      const conc = daIgreja.filter((r) => r.status === 'CONCLUIDO').length;
      filhos.push({
        tipo: 'IGREJA',
        id: c.id,
        nome: c.name,
        subtitulo: c.isHost ? 'hospedeira' : null,
        dirigente: dirLocal.get(c.id) ?? c.currentLeaderName ?? null,
        cultos: daIgreja.length,
        concluidos: conc,
        cor: daIgreja.length > 0 && conc === daIgreja.length ? 'VERDE' : 'VERMELHO',
        status: null,
        dataCulto: null,
        registroId: null,
        ...comVisibilidade(somaDe(daIgreja)),
        navegavel: true,
        tipoGrupo: null,
      });
    }
  } else {
    // CAMPO: agrupa igual ao painel (D3) — hospedeira, senão regional.
    const grupos = new Map<
      string,
      { no: NoResumo; registros: typeof registros }
    >();
    for (const c of igrejas) {
      const hostId = c.hostChurchId ?? (c.isHost ? c.id : null);
      const chave = hostId ? `H:${hostId}` : `R:${c.regionalId ?? 'sem'}`;
      if (!grupos.has(chave)) {
        grupos.set(chave, {
          registros: [],
          no: {
            tipo: 'GRUPO',
            id: hostId ?? c.regionalId ?? 'sem',
            nome: hostId
              ? (nomePorId.get(hostId) ?? 'Hospedeira')
              : (c.regional?.name ?? 'Sem regional'),
            subtitulo: hostId ? 'hospedeira' : 'regional',
            dirigente: hostId ? (dirHosp.get(hostId) ?? dirLocal.get(hostId) ?? null) : null,
            cultos: 0,
            concluidos: 0,
            cor: 'VERMELHO',
            status: null,
            dataCulto: null,
            registroId: null,
            financeiro: null,
            presenca: null,
            navegavel: true,
            tipoGrupo: hostId ? 'HOSPEDEIRA' : 'REGIONAL',
          },
        });
      }
      grupos.get(chave)!.registros.push(...(registrosPorIgreja.get(c.id) ?? []));
    }

    for (const g of grupos.values()) {
      const conc = g.registros.filter((r) => r.status === 'CONCLUIDO').length;
      const vis = comVisibilidade(somaDe(g.registros));
      g.no.cultos = g.registros.length;
      g.no.concluidos = conc;
      g.no.cor = g.registros.length > 0 && conc === g.registros.length ? 'VERDE' : 'VERMELHO';
      g.no.financeiro = vis.financeiro;
      g.no.presenca = vis.presenca;
      filhos.push(g.no);
    }
  }

  filhos.sort((a, b) => {
    if (a.tipo === 'CULTO' && b.tipo === 'CULTO') {
      return (b.dataCulto ?? '').localeCompare(a.dataCulto ?? '');
    }
    // Pendentes primeiro: é o que quem abriu o resumo foi olhar.
    if (a.cor !== b.cor) return a.cor === 'VERMELHO' ? -1 : 1;
    return a.nome.localeCompare(b.nome);
  });

  const concluidos = registros.filter((r) => r.status === 'CONCLUIDO').length;
  const alvo = nivel === 'IGREJA' ? igrejas[0] : null;

  let titulo: string;
  if (nivel === 'CAMPO') titulo = campoNome ?? 'Campo';
  else if (nivel === 'IGREJA') titulo = alvo?.name ?? 'Igreja';
  else if (tipoGrupo === 'REGIONAL') titulo = igrejas[0]?.regional?.name ?? 'Regional';
  else titulo = nomePorId.get(id ?? '') ?? 'Hospedeira';

  let subtitulo: string | null;
  if (nivel === 'CAMPO') subtitulo = 'Campo inteiro';
  else if (nivel === 'GRUPO') {
    const dir = tipoGrupo === 'REGIONAL' ? null : dirHosp.get(id ?? '');
    subtitulo = `${tipoGrupo === 'REGIONAL' ? 'Regional' : 'Hospedeira'}${dir ? ` · dirigente ${dir}` : ''}`;
  } else {
    const dir = dirLocal.get(alvo?.id ?? '') ?? alvo?.currentLeaderName ?? null;
    subtitulo = dir ? `Dirigente ${dir}` : null;
  }

  return {
    nivel,
    id: id ?? null,
    titulo,
    subtitulo,
    periodo,
    totais: {
      igrejas: igrejas.length,
      cultos: registros.length,
      concluidos,
      pendentes: registros.length - concluidos,
      ...comVisibilidade(somaDe(registros)),
    },
    filhos,
  };
}
