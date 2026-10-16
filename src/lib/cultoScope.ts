/**
 * Gestão de Culto — resolução de escopo e visibilidade.
 *
 * Esta é a peça que garante o isolamento pedido no diagrama: "o tesoureiro que
 * está do lado não vê, nem o secretário vê". Um lançador enxerga apenas o
 * PRÓPRIO bloco da PRÓPRIA igreja. Só quem aprova vê o conjunto.
 *
 * A poda acontece aqui, no servidor. Nada de esconder no front — o bloco que o
 * usuário não pode ver não sai do banco para a resposta.
 *
 * Ver docs/modules/gestao-culto/SPEC.md, seção 4.
 */
import { prisma } from './prisma';
import type { AuthUser } from './auth';
import { filtroDoCampoAtivo } from './campoAtivo';

export const PAPEIS = [
  'FINANCEIRO',
  'PRESENCA',
  'EXTRA',
  'APROVADOR_LOCAL',
  'APROVADOR_HOSPEDEIRA',
  'PRESIDENTE',
] as const;
export type Papel = (typeof PAPEIS)[number];

/** Papéis que lançam dados. Cada um responde por um bloco de mesmo nome. */
export const PAPEIS_LANCADORES: Papel[] = ['FINANCEIRO', 'PRESENCA', 'EXTRA'];

export const BLOCOS = ['FINANCEIRO', 'PRESENCA', 'EXTRA'] as const;
export type Bloco = (typeof BLOCOS)[number];

export const NIVEIS = ['LOCAL', 'HOSPEDEIRA'] as const;
export type Nivel = (typeof NIVEIS)[number];

export const STATUS = [
  'ABERTO',
  'AGUARDANDO_LOCAL',
  'APROVADO_LOCAL',
  'CONCLUIDO',
  'REJEITADO',
] as const;
export type Status = (typeof STATUS)[number];

export const ROTULO_PAPEL: Record<Papel, string> = {
  FINANCEIRO: 'Tesoureiro (financeiro)',
  PRESENCA: 'Secretário / contagem de presença',
  EXTRA: 'Complemento (outro responsável)',
  APROVADOR_LOCAL: 'Dirigente da igreja',
  APROVADOR_HOSPEDEIRA: 'Dirigente da hospedeira',
  PRESIDENTE: 'Pastor Presidente',
};

/** "SECRETARIO(a)" → "secretario": sem acento, sem "(a)", minúsculo. */
function normalizarFuncao(txt: string): string {
  return txt
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Função da igreja (church_function_catalog) → papel do culto. Nome exato,
 * depois de normalizado: "TESOUREIRA CIBE" e "SECRETARIA CIBE" são do
 * departamento e "ESPOSA DE DIRIGENTE"/"CANDIDATO A DIRIGENTE..." não dirigem —
 * nenhum deles pode virar posição por aproximação.
 *
 * O dirigente da hospedeira é o mesmo dirigente de congregação, só que da
 * igreja que hospeda; quem decide se vale é a rota, que sabe se a igreja é
 * hospedeira.
 */
const PAPEIS_DA_FUNCAO: Record<string, Papel[]> = {
  'dirigente de congregacao': ['APROVADOR_LOCAL', 'APROVADOR_HOSPEDEIRA'],
  tesoureiro: ['FINANCEIRO'],
  secretario: ['PRESENCA'],
  'segundo secretario': ['PRESENCA'],
};

export function papeisDaFuncao(nomeFuncao: string | null | undefined): Papel[] {
  return PAPEIS_DA_FUNCAO[normalizarFuncao(nomeFuncao ?? '')] ?? [];
}

export const ROTULO_STATUS: Record<Status, string> = {
  ABERTO: 'Aguardando envio',
  // O status diz de QUEM se espera a decisão. "Aguardando aprovação" não
  // informava se a bola estava com o dirigente da congregação ou com o da
  // hospedeira, e quem cobrava tinha de adivinhar.
  AGUARDANDO_LOCAL: 'Aguardando o dirigente da congregação',
  APROVADO_LOCAL: 'Aguardando o dirigente hospedeiro',
  CONCLUIDO: 'Concluído',
  REJEITADO: 'Devolvido',
};

export interface PosicaoDoUsuario {
  papel: Papel;
  churchId: string | null;
  titulo: string | null;
}

export interface CultoScope {
  /** Papéis que o usuário ocupa. Pode acumular (tesoureiro E dirigente). */
  papeis: Papel[];
  /** Igrejas cujos registros ele pode LER. `null` = campo inteiro. */
  churchIds: string[] | null;
  /** Blocos que ele pode ler. Vazio só se ele não puder ver nenhum. */
  blocosVisiveis: Bloco[];
  /** Blocos que ele pode ENVIAR, e em qual igreja. */
  podeEnviar: { bloco: Bloco; churchId: string }[];
  /** Níveis em que ele pode decidir, e sobre quais igrejas. */
  podeAprovar: { nivel: Nivel; churchIds: string[] }[];
  /** Vê tudo do campo em modo leitura (presidente, master, admin). */
  visaoCampo: boolean;
  /** Master/admin: podem tudo, inclusive corrigir por cima. */
  irrestrito: boolean;
  campoId: string | null;
  posicoes: PosicaoDoUsuario[];
}

/**
 * Igrejas que uma hospedeira alcança: ela própria mais as que a apontam em
 * `host_church_id`.
 */
export async function igrejasDaHospedeira(hostChurchId: string): Promise<string[]> {
  const filhas = await prisma.church.findMany({
    where: { hostChurchId, deletedAt: null },
    select: { id: true },
  });
  return [hostChurchId, ...filhas.map((c) => c.id)];
}

/**
 * Monta o escopo do usuário logado a partir das posições em que ele foi
 * anexado, mais o perfil do sistema.
 *
 * master/admin não precisam de posição: já enxergam o campo inteiro no resto
 * do sistema e continuam enxergando aqui.
 */
/**
 * Nós do organograma com o cadeado ligado.
 *
 * Uma linha em culto_visao_bloqueada quer dizer: quem dirige AQUELE nó não vê
 * os valores lançados abaixo dele. Ele continua com os cultos, o status e o
 * poder de aprovar — some o número. A poda em si é feita por podarLancamentos,
 * que já roda em toda rota que devolve registro.
 */
async function nosBloqueados(): Promise<Map<string, Bloco[]>> {
  const linhas = await prisma.$queryRawUnsafe<Array<{ church_id: string; blocos: string[] }>>(
    `SELECT church_id, blocos FROM culto_visao_bloqueada`,
  );
  return new Map(linhas.map((l) => [l.church_id, (l.blocos ?? []) as Bloco[]]));
}

export async function getCultoScope(user: AuthUser): Promise<CultoScope> {
  const irrestrito = user.profileType === 'master' || user.profileType === 'admin';

  const posicoesRaw = user.id
    ? await prisma.cultoPosicao.findMany({
        // Só as posições do campo ativo: estando em Aguaí, o anexo de
        // dirigente em Campinas não vale (nem aparece) — lib/campoAtivo.ts.
        where: { userId: user.id, isActive: true, deletedAt: null, ...filtroDoCampoAtivo(user) },
        select: { papel: true, churchId: true, titulo: true },
      })
    : [];

  const bloqueados = await nosBloqueados();
  /** Blocos que este nó ainda pode ver, depois do cadeado. */
  const blocosLiberados = (churchId: string): Bloco[] => {
    const escondidos = bloqueados.get(churchId);
    if (!escondidos) return [...BLOCOS];
    return BLOCOS.filter((b) => !escondidos.includes(b));
  };

  const posicoes: PosicaoDoUsuario[] = posicoesRaw.map((p) => ({
    papel: p.papel as Papel,
    churchId: p.churchId,
    titulo: p.titulo,
  }));

  const papeis = Array.from(new Set(posicoes.map((p) => p.papel)));

  const scope: CultoScope = {
    papeis,
    churchIds: [],
    blocosVisiveis: [],
    podeEnviar: [],
    podeAprovar: [],
    visaoCampo: false,
    irrestrito,
    campoId: user.campoId,
    posicoes,
  };

  if (irrestrito) {
    scope.churchIds = null;
    scope.blocosVisiveis = [...BLOCOS];
    scope.visaoCampo = true;
    scope.podeAprovar = [
      { nivel: 'LOCAL', churchIds: [] },
      { nivel: 'HOSPEDEIRA', churchIds: [] },
    ];
    return scope;
  }

  const churchIds = new Set<string>();
  const blocos = new Set<Bloco>();
  const aprovaLocal = new Set<string>();
  const aprovaHospedeira = new Set<string>();

  for (const pos of posicoes) {
    if (pos.papel === 'PRESIDENTE') {
      // O presidente é o topo da árvore e é ele quem põe o cadeado nos outros;
      // não faria sentido ele se trancar por acidente.
      scope.visaoCampo = true;
      for (const b of BLOCOS) blocos.add(b);
      continue;
    }
    if (!pos.churchId) continue;

    if (PAPEIS_LANCADORES.includes(pos.papel)) {
      churchIds.add(pos.churchId);
      blocos.add(pos.papel as Bloco);
      scope.podeEnviar.push({ bloco: pos.papel as Bloco, churchId: pos.churchId });
      continue;
    }

    if (pos.papel === 'APROVADOR_LOCAL') {
      churchIds.add(pos.churchId);
      // Cadeado no nó da congregação: ele aprova sem ver os valores.
      for (const b of blocosLiberados(pos.churchId)) blocos.add(b);
      aprovaLocal.add(pos.churchId);
      continue;
    }

    if (pos.papel === 'APROVADOR_HOSPEDEIRA') {
      const alcance = await igrejasDaHospedeira(pos.churchId);
      for (const id of alcance) {
        churchIds.add(id);
        aprovaHospedeira.add(id);
      }
      // Cadeado no nó da hospedeira: ela acompanha as filhas pelo status, sem
      // os números que as congregações lançaram.
      for (const b of blocosLiberados(pos.churchId)) blocos.add(b);
      continue;
    }
  }

  // Fallback para quem ainda não foi anexado a nenhuma posição: o usuário de
  // igreja continua vendo o próprio registro (sem bloco nenhum, só o status).
  // Sem isso ele veria uma tela vazia sem entender por quê. Ver seção 4 da SPEC.
  if (posicoes.length === 0 && user.churchId) {
    churchIds.add(user.churchId);
  }

  // O perfil `campo` dá visão do campo inteiro APENAS para quem não foi anexado
  // a nenhuma posição do culto.
  //
  // O dirigente da hospedeira costuma precisar do perfil `campo` para enxergar
  // fora da própria igreja (o perfil `church` trava em church_id). Mas o
  // alcance dele AQUI é o grupo dele — a hospedeira mais as filhas —, não o
  // campo todo. Quem manda é a posição, não o perfil; senão bastaria ter perfil
  // de campo para ver as 126 igrejas.
  if (posicoes.length === 0 && user.profileType === 'campo') {
    scope.visaoCampo = true;
  }
  scope.churchIds = scope.visaoCampo ? null : Array.from(churchIds);
  // `visaoCampo` alarga o alcance de IGREJAS, não o de blocos: quem tem o nó
  // trancado continua sem os valores mesmo enxergando o campo inteiro.
  scope.blocosVisiveis =
    scope.visaoCampo && blocos.size === 0 ? [...BLOCOS] : Array.from(blocos);

  if (aprovaLocal.size) {
    scope.podeAprovar.push({ nivel: 'LOCAL', churchIds: Array.from(aprovaLocal) });
  }
  if (aprovaHospedeira.size) {
    scope.podeAprovar.push({ nivel: 'HOSPEDEIRA', churchIds: Array.from(aprovaHospedeira) });
  }

  return scope;
}

/** Filtro Prisma de igrejas para o `where` das consultas de registro. */
export function filtroDeIgrejas(scope: CultoScope): Record<string, unknown> {
  if (scope.churchIds === null) return {};
  if (scope.churchIds.length === 0) return { churchId: { in: ['00000000-0000-0000-0000-000000000000'] } };
  return { churchId: { in: scope.churchIds } };
}

export function podeVerBloco(scope: CultoScope, bloco: string): boolean {
  return scope.blocosVisiveis.includes(bloco as Bloco);
}

export function podeEnviarBloco(scope: CultoScope, bloco: string, churchId: string): boolean {
  if (scope.irrestrito) return true;
  return scope.podeEnviar.some((p) => p.bloco === bloco && p.churchId === churchId);
}

/**
 * Pastor Presidente (ou master/admin): o topo da árvore. Pode concluir o culto
 * de uma vez, aprovando pelos dirigentes — decisão do dono do sistema em
 * 2026-09-28, que revê o "presidente só olha" do desenho original.
 */
export function ehPresidente(scope: CultoScope): boolean {
  return scope.irrestrito || scope.posicoes.some((p) => p.papel === 'PRESIDENTE');
}

export function podeAprovarNivel(scope: CultoScope, nivel: string, churchId: string): boolean {
  if (scope.irrestrito) return true;
  const entrada = scope.podeAprovar.find((p) => p.nivel === nivel);
  if (!entrada) return false;
  return entrada.churchIds.includes(churchId);
}

/**
 * Remove do objeto do lançamento os blocos que o usuário não pode ver.
 * Chamado em TODA rota que devolve registro — é a blindagem da seção 4.
 */
export function podarLancamentos<T extends { bloco: string }>(
  scope: CultoScope,
  lancamentos: T[],
): T[] {
  return lancamentos.filter((l) => podeVerBloco(scope, l.bloco));
}
