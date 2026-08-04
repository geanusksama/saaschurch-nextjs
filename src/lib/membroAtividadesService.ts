/**
 * "Minha vida na igreja" — o que abre nos ícones do perfil do membro.
 *
 * São três consultas independentes que a tela mostra em modais: núcleo
 * familiar (filhos), presenças e inscrições em eventos. Ficam separadas do
 * membroPerfilService porque só carregam quando a pessoa toca no ícone — o
 * perfil abre sem esperar por elas.
 *
 * Presenças vêm de DUAS origens que não se conversam no banco:
 *  - `event_attendance`: check-in num evento cadastrado (tem o evento junto);
 *  - `face_presencas`: a passagem no leitor facial da igreja. Essa tabela NÃO
 *    tem member_id — o leitor grava o ROL. Por isso a busca é pelo ROL, e um
 *    membro sem ROL simplesmente não tem essa origem.
 * As duas viram uma lista só, ordenada da mais recente para a mais antiga.
 *
 * Inscrições saem de `event_registrations`. O acompanhamento de compra de
 * ingresso (pedidos/QR Code) ainda não entra aqui: quando existir, é mais um
 * bloco desta mesma resposta.
 */

import { prisma } from './prisma';

export interface AtividadeFamiliar {
  id: string;
  /** FILHO | CONJUGE | PAI_MAE | IRMAO — mesmos valores do painel */
  tipo: string;
  /** rótulo pronto para a tela ("Filho(a)", "Cônjuge"...) */
  parentesco: string;
  name: string;
  birthDate: string | null;
  /** idade em anos cheios, quando há data de nascimento */
  idade: number | null;
  gender: string | null;
  photoUrl: string | null;
  /** true quando o filho também tem cadastro de membro */
  ehMembro: boolean;
  rol: number | null;
}

export interface AtividadePresenca {
  id: string;
  /** quando aconteceu — ISO completo, a tela formata */
  data: string;
  titulo: string;
  origem: 'evento' | 'leitor';
  detalhe: string | null;
}

export interface AtividadeInscricao {
  id: string;
  eventoId: string;
  titulo: string;
  inicio: string | null;
  local: string | null;
  status: string | null;
  pagamento: string | null;
  valor: number | null;
  compareceu: boolean;
  inscritoEm: string;
}

/**
 * Dados de dízimos e ofertas da SEDE DO CAMPO do membro — é o mesmo cadastro
 * (`headquarters`) que o app mostrava no perfil da igreja: chave PIX, banco,
 * CNPJ e contatos. Não é um meio de pagamento nosso: a tela só exibe a chave
 * para a pessoa copiar e transferir pelo banco dela.
 */
export interface AtividadeDoacao {
  churchName: string | null;
  pix: string | null;
  bank: string | null;
  cnpj: string | null;
  whatsapp: string | null;
  contact: string | null;
  email: string | null;
  endereco: string | null;
  site: string | null;
  instagram: string | null;
}

export interface MembroAtividades {
  familia: AtividadeFamiliar[];
  inscricoes: AtividadeInscricao[];
  doacao: AtividadeDoacao | null;
  /**
   * Para os selinhos de contagem nos ícones do perfil. Presenças entram só
   * como número: a lista é grande (uma linha por passagem no leitor) e vem
   * paginada por getMembroPresencas.
   */
  totais: { familia: number; presencas: number; inscricoes: number };
}

/** Uma página de presenças, já com o total do período para a tela mostrar. */
export interface PaginaPresencas {
  itens: AtividadePresenca[];
  total: number;
  pagina: number;
  porPagina: number;
  temMais: boolean;
}

/** Rótulo do parentesco na tela. */
const PARENTESCO: Record<string, string> = {
  FILHO: 'Filho(a)',
  CONJUGE: 'Cônjuge',
  PAI_MAE: 'Pai/Mãe',
  IRMAO: 'Irmão(ã)',
};

/** Tamanho padrão da página de presenças. */
export const PRESENCAS_POR_PAGINA = 15;

function idadeEm(anos: Date | null): number | null {
  if (!anos) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - anos.getFullYear();
  const mes = hoje.getMonth() - anos.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < anos.getDate())) idade--;
  return idade >= 0 ? idade : null;
}

/**
 * Cadastro de dízimos/ofertas da sede do campo.
 *
 * Busca pelo CAMPO (`headquarters.field_id`) — é o caminho confiável, o mesmo
 * motivo documentado em sedeResolver.ts: `churches.headquarters_id` está sujo
 * (igrejas de campos diferentes apontando para a mesma sede). Só se o campo não
 * tiver cadastro é que caímos no ponteiro da igreja.
 */
async function buscarDoacao(campoId: string | null, churchId: string): Promise<AtividadeDoacao | null> {
  const hq =
    (campoId
      ? await prisma.legacyChurchHeadquarters.findFirst({ where: { fieldId: campoId } })
      : null) ??
    (await prisma.church.findUnique({ where: { id: churchId }, select: { headquarters: true } }))?.headquarters ??
    null;

  if (!hq) return null;

  const endereco = [
    [hq.street, hq.number].filter(Boolean).join(', '),
    hq.neighborhood,
    hq.city,
    hq.state,
  ].filter(Boolean).join(', ');

  return {
    churchName: hq.churchName,
    pix: hq.pix,
    bank: hq.bank,
    cnpj: hq.cnpj,
    whatsapp: hq.whatsapp,
    contact: hq.contact,
    email: hq.email,
    endereco: endereco || null,
    site: hq.site,
    instagram: hq.instagram,
  };
}

export async function getMembroAtividades(memberId: string): Promise<MembroAtividades | null> {
  const membro = await prisma.member.findFirst({
    where: { id: memberId, deletedAt: null },
    select: { id: true, rol: true, churchId: true, campoId: true },
  });
  if (!membro) return null;

  const [familia, totalEvento, totalLeitor, inscricoes, doacao] = await Promise.all([
    // o núcleo inteiro (filhos, cônjuge, pais, irmãos), não só os filhos
    prisma.memberFamilyRelationship.findMany({
      where: { memberId, deletedAt: null },
      select: {
        id: true,
        relationshipType: true,
        relatedName: true,
        relatedBirthDate: true,
        relatedGender: true,
        relatedMember: { select: { id: true, fullName: true, photoUrl: true, birthDate: true, rol: true } },
      },
      orderBy: [{ relationshipType: 'asc' }, { relatedBirthDate: 'asc' }],
    }),
    prisma.eventAttendance.count({ where: { memberId, present: true } }),
    // o leitor facial grava o ROL, não o id do membro
    membro.rol ? prisma.facePresenca.count({ where: { rol: membro.rol } }) : Promise.resolve(0),
    prisma.eventRegistration.findMany({
      where: { memberId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        paymentAmount: true,
        checkedIn: true,
        registrationDate: true,
        event: {
          select: { id: true, title: true, startDatetime: true, locationName: true, locationAddress: true },
        },
      },
      orderBy: { registrationDate: 'desc' },
    }),
    buscarDoacao(membro.campoId, membro.churchId),
  ]);

  const nucleo: AtividadeFamiliar[] = familia.map((f) => {
    // O cadastro do filho-membro manda; `related_*` cobre a criança que ainda
    // não tem ficha própria.
    const nascimento = f.relatedMember?.birthDate ?? f.relatedBirthDate ?? null;
    return {
      id: f.id,
      tipo: f.relationshipType,
      parentesco: PARENTESCO[f.relationshipType] ?? f.relationshipType,
      name: f.relatedMember?.fullName ?? f.relatedName ?? 'Sem nome',
      birthDate: nascimento ? nascimento.toISOString().slice(0, 10) : null,
      idade: idadeEm(nascimento),
      gender: f.relatedGender,
      photoUrl: f.relatedMember?.photoUrl ?? null,
      ehMembro: !!f.relatedMember,
      rol: f.relatedMember?.rol ?? null,
    };
  });

  const lista: AtividadeInscricao[] = inscricoes.map((i) => ({
    id: i.id,
    eventoId: i.event.id,
    titulo: i.event.title,
    inicio: i.event.startDatetime ? i.event.startDatetime.toISOString() : null,
    local: i.event.locationName || i.event.locationAddress || null,
    status: i.status,
    pagamento: i.paymentStatus,
    valor: i.paymentAmount === null ? null : Number(i.paymentAmount),
    compareceu: i.checkedIn,
    inscritoEm: i.registrationDate.toISOString(),
  }));

  return {
    familia: nucleo,
    inscricoes: lista,
    doacao,
    totais: { familia: nucleo.length, presencas: totalEvento + totalLeitor, inscricoes: lista.length },
  };
}

/**
 * Presenças de um período, paginadas.
 *
 * As duas origens (evento e leitor) são tabelas diferentes, sem chave comum e
 * sem como o banco ordenar as duas juntas — então filtramos por data em cada
 * uma, juntamos em memória e só aí cortamos a página. É correto porque o filtro
 * de data é obrigatório na tela (um mês por vez): o volume trazido é o do
 * período, não o histórico inteiro.
 *
 * `inicio` e `fim` são dias (AAAA-MM-DD) e o intervalo INCLUI os dois: o fim
 * vira o instante final daquele dia, senão as presenças da tarde do último dia
 * ficariam de fora.
 */
export async function getMembroPresencas(
  memberId: string,
  opcoes: { inicio?: string | null; fim?: string | null; pagina?: number; porPagina?: number } = {},
): Promise<PaginaPresencas | null> {
  const membro = await prisma.member.findFirst({
    where: { id: memberId, deletedAt: null },
    select: { id: true, rol: true },
  });
  if (!membro) return null;

  const pagina = Math.max(1, Math.floor(opcoes.pagina ?? 1));
  const porPagina = Math.min(100, Math.max(1, Math.floor(opcoes.porPagina ?? PRESENCAS_POR_PAGINA)));

  const de = opcoes.inicio ? new Date(`${opcoes.inicio}T00:00:00`) : null;
  const ate = opcoes.fim ? new Date(`${opcoes.fim}T23:59:59.999`) : null;
  const periodo = de || ate ? { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) } : undefined;

  const [doEvento, doLeitor] = await Promise.all([
    prisma.eventAttendance.findMany({
      where: { memberId, present: true, ...(periodo ? { checkinDatetime: periodo } : {}) },
      select: {
        id: true,
        checkinDatetime: true,
        checkinMethod: true,
        event: { select: { title: true, startDatetime: true, locationName: true } },
      },
      orderBy: { checkinDatetime: 'desc' },
    }),
    membro.rol
      ? prisma.facePresenca.findMany({
          where: { rol: membro.rol, ...(periodo ? { horario: periodo } : {}) },
          select: { id: true, horario: true, camera: true, igrejaRegional: true },
          orderBy: { horario: 'desc' },
        })
      : Promise.resolve([]),
  ]);

  const todas: AtividadePresenca[] = [
    ...doEvento.map((p) => ({
      id: p.id,
      data: (p.checkinDatetime ?? p.event.startDatetime).toISOString(),
      titulo: p.event.title,
      origem: 'evento' as const,
      detalhe: p.event.locationName || (p.checkinMethod ? `check-in: ${p.checkinMethod}` : null),
    })),
    ...doLeitor.map((p) => ({
      id: p.id,
      data: p.horario.toISOString(),
      titulo: 'Presença registrada no leitor',
      origem: 'leitor' as const,
      detalhe: p.camera || p.igrejaRegional || null,
    })),
  ].sort((a, b) => (a.data < b.data ? 1 : -1));

  const inicioCorte = (pagina - 1) * porPagina;
  const itens = todas.slice(inicioCorte, inicioCorte + porPagina);

  return {
    itens,
    total: todas.length,
    pagina,
    porPagina,
    temMais: inicioCorte + itens.length < todas.length,
  };
}
