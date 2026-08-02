/**
 * Perfil do membro logado no Portal "Sou Membro" — o join eclesiástico que a
 * tela de perfil mostra além do que já vem no member_token.
 *
 * A sessão (localStorage) guarda só a ficha básica devolvida pelo /verify. Aqui
 * buscamos o que muda com o tempo e o que exige join: funções na igreja,
 * ministérios, batismo e o Grupo Familiar — seja porque a pessoa LIDERA um GF,
 * seja porque PARTICIPA de um.
 *
 * A regra de "enriquecer" da tela: se houver GF, a tela ganha o bloco do grupo
 * (com líderes, horário, endereço e quantos participam); se houver vida
 * eclesiástica (função/ministério/batismo), ganha o bloco eclesiástico. Sem
 * nada disso, a tela fica só com o resumo do membro — nenhum card vazio.
 *
 * Extraído para cá (e não escrito dentro da rota) para o E2E exercitar a mesma
 * consulta que roda em produção — mesmo padrão de gfPublicListService.ts.
 */

import { prisma } from './prisma';

export interface PerfilLeader {
  id: string;
  name: string;
  phone: string | null;
  photoUrl: string | null;
  /** true para o líder principal (position 0 / cell_groups.leader_id) */
  principal: boolean;
}

export interface PerfilGf {
  id: string;
  name: string;
  description: string | null;
  cellType: string | null;
  meetingDay: string | null;
  /** só HH:mm — o DateTime cru sairia deslocado pelo fuso do servidor */
  meetingTime: string | null;
  color: string | null;
  photo: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZipcode: string | null;
  latitude: number | null;
  longitude: number | null;
  leaders: PerfilLeader[];
  /** participantes ativos (não conta os líderes que não estão na lista) */
  memberCount: number;
  /** como esta pessoa se liga ao GF */
  vinculo: 'lider' | 'participante';
  /** data de entrada, quando o vínculo é de participante */
  joinedAt: string | null;
}

export interface PerfilFuncao {
  id: string;
  name: string;
  abbreviation: string | null;
  department: string | null;
  startDate: string | null;
  /** função que vale para o campo inteiro, não só para a igreja */
  isCampoWide: boolean;
}

export interface PerfilMinisterio {
  id: string;
  name: string;
  role: string | null;
  color: string | null;
  joinedAt: string | null;
  /** a pessoa é a líder deste ministério */
  isLeader: boolean;
}

export interface PerfilBatismo {
  date: string | null;
  location: string | null;
  ministerName: string | null;
  certificateNumber: string | null;
}

export interface MembroPerfilPayload {
  member: {
    id: string;
    fullName: string;
    preferredName: string | null;
    photoUrl: string | null;
    coverPhotoUrl: string | null;
    ecclesiasticalTitle: string | null;
    membershipStatus: string | null;
    membershipDate: string | null;
    baptismDate: string | null;
    rol: number | null;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    birthDate: string | null;
    gender: string | null;
    maritalStatus: string | null;
    nationality: string | null;
    fatherName: string | null;
    motherName: string | null;
    spouseName: string | null;
    occupation: string | null;
    addressStreet: string | null;
    addressNumber: string | null;
    addressNeighborhood: string | null;
    addressCity: string | null;
    addressState: string | null;
    churchName: string | null;
    campoName: string | null;
    regionalName: string | null;
  };
  gf: PerfilGf | null;
  funcoes: PerfilFuncao[];
  ministerios: PerfilMinisterio[];
  batismo: PerfilBatismo | null;
  /** atalho para o front: tem algo eclesiástico para mostrar? */
  temVidaEclesiastica: boolean;
}

const dia = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const num = (d: unknown) => (d === null || d === undefined ? null : Number(d));

/** Telefone preferido de um membro: celular na frente do fixo. */
const fone = (m: { mobile?: string | null; phone?: string | null }) => m.mobile || m.phone || null;

/**
 * Monta o GF a mostrar no perfil.
 *
 * Liderança vem primeiro: quem lidera vê o próprio grupo mesmo que não esteja
 * na lista de participantes (o líder normalmente não é `cell_group_member`).
 * Só depois é que procuramos o GF em que a pessoa participa.
 */
async function buscarGf(memberId: string): Promise<PerfilGf | null> {
  const selectGf = {
    id: true,
    name: true,
    description: true,
    cellType: true,
    meetingDay: true,
    meetingTime: true,
    color: true,
    photo: true,
    addressStreet: true,
    addressNumber: true,
    addressComplement: true,
    addressNeighborhood: true,
    addressCity: true,
    addressState: true,
    addressZipcode: true,
    latitude: true,
    longitude: true,
    leaderId: true,
    leader: { select: { id: true, fullName: true, phone: true, mobile: true, photoUrl: true } },
    leaders: {
      orderBy: { position: 'asc' as const },
      select: {
        member: { select: { id: true, fullName: true, phone: true, mobile: true, photoUrl: true } },
      },
    },
    _count: { select: { members: { where: { isActive: true } } } },
  };

  // 1) lidera? (lista nova de líderes ou o leader_id antigo)
  const comoLider = await prisma.cellGroup.findFirst({
    where: {
      deletedAt: null,
      status: 'active',
      OR: [{ leaderId: memberId }, { leaders: { some: { memberId } } }],
    },
    select: selectGf,
    orderBy: { name: 'asc' },
  });

  // 2) participa?
  const comoMembro = comoLider
    ? null
    : await prisma.cellGroupMember.findFirst({
        where: { memberId, isActive: true, cellGroup: { deletedAt: null, status: 'active' } },
        select: { joinedAt: true, cellGroup: { select: selectGf } },
        orderBy: { joinedAt: 'desc' },
      });

  const c = comoLider ?? comoMembro?.cellGroup;
  if (!c) return null;

  // A lista nova manda; o leader_id antigo cobre GF que ainda não foi reeditado.
  const leaders: PerfilLeader[] = c.leaders.length
    ? c.leaders.map((l, i) => ({
        id: l.member.id,
        name: l.member.fullName,
        phone: fone(l.member),
        photoUrl: l.member.photoUrl ?? null,
        principal: i === 0,
      }))
    : c.leader
      ? [{
          id: c.leader.id,
          name: c.leader.fullName,
          phone: fone(c.leader),
          photoUrl: c.leader.photoUrl ?? null,
          principal: true,
        }]
      : [];

  return {
    id: c.id,
    name: c.name,
    description: c.description,
    cellType: c.cellType,
    meetingDay: c.meetingDay,
    // toISOString() (não String()!): senão 19:50 sai 16:50 em UTC-3
    meetingTime: c.meetingTime ? c.meetingTime.toISOString().slice(11, 16) : null,
    color: c.color,
    photo: c.photo,
    addressStreet: c.addressStreet,
    addressNumber: c.addressNumber,
    addressComplement: c.addressComplement,
    addressNeighborhood: c.addressNeighborhood,
    addressCity: c.addressCity,
    addressState: c.addressState,
    addressZipcode: c.addressZipcode,
    latitude: num(c.latitude),
    longitude: num(c.longitude),
    leaders,
    memberCount: c._count.members,
    vinculo: comoLider ? 'lider' : 'participante',
    joinedAt: dia(comoMembro?.joinedAt),
  };
}

export async function getMembroPerfil(memberId: string): Promise<MembroPerfilPayload | null> {
  const member = await prisma.member.findFirst({
    where: { id: memberId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      preferredName: true,
      photoUrl: true,
      coverPhotoUrl: true,
      ecclesiasticalTitle: true,
      membershipStatus: true,
      membershipDate: true,
      baptismDate: true,
      rol: true,
      email: true,
      phone: true,
      mobile: true,
      birthDate: true,
      gender: true,
      maritalStatus: true,
      nationality: true,
      fatherName: true,
      motherName: true,
      spouseName: true,
      occupation: true,
      addressStreet: true,
      addressNumber: true,
      addressNeighborhood: true,
      addressCity: true,
      addressState: true,
      church: {
        select: {
          name: true,
          regional: { select: { name: true, campo: { select: { name: true } } } },
        },
      },
    },
  });
  if (!member) return null;

  const [gf, funcoesRaw, ministeriosRaw, batismoRaw] = await Promise.all([
    buscarGf(memberId),
    // função vigente = ativa e sem data de saída (o histórico fica no painel)
    prisma.churchFunctionHistory.findMany({
      where: { memberId, isActive: true, endDate: null, deletedAt: null },
      select: {
        id: true,
        department: true,
        startDate: true,
        isCampoWide: true,
        function: { select: { name: true, abbreviation: true } },
      },
      orderBy: { startDate: 'desc' },
    }),
    prisma.ministryMember.findMany({
      where: { memberId, isActive: true, ministry: { deletedAt: null, isActive: true } },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        ministry: { select: { id: true, name: true, color: true, leaderId: true } },
      },
      orderBy: { joinedAt: 'desc' },
    }),
    prisma.baptism.findFirst({
      where: { memberId, deletedAt: null },
      select: {
        baptismDate: true,
        location: true,
        certificateNumber: true,
        minister: { select: { fullName: true } },
      },
      orderBy: { baptismDate: 'desc' },
    }),
  ]);

  const funcoes: PerfilFuncao[] = funcoesRaw.map((f) => ({
    id: f.id,
    name: f.function.name ?? '—',
    abbreviation: f.function.abbreviation ?? null,
    department: f.department,
    startDate: dia(f.startDate),
    isCampoWide: f.isCampoWide,
  }));

  const ministerios: PerfilMinisterio[] = ministeriosRaw.map((m) => ({
    id: m.ministry.id,
    name: m.ministry.name,
    role: m.role,
    color: m.ministry.color,
    joinedAt: dia(m.joinedAt),
    isLeader: m.ministry.leaderId === memberId,
  }));

  // O batismo pode estar só no campo do cadastro (members.baptism_date), sem
  // registro na tabela de batismos — nesse caso mostramos o que existe.
  const batismo: PerfilBatismo | null = batismoRaw
    ? {
        date: dia(batismoRaw.baptismDate),
        location: batismoRaw.location,
        ministerName: batismoRaw.minister?.fullName ?? null,
        certificateNumber: batismoRaw.certificateNumber,
      }
    : member.baptismDate
      ? { date: dia(member.baptismDate), location: null, ministerName: null, certificateNumber: null }
      : null;

  return {
    member: {
      id: member.id,
      fullName: member.fullName,
      preferredName: member.preferredName,
      photoUrl: member.photoUrl,
      coverPhotoUrl: member.coverPhotoUrl,
      ecclesiasticalTitle: member.ecclesiasticalTitle,
      membershipStatus: member.membershipStatus,
      membershipDate: dia(member.membershipDate),
      baptismDate: dia(member.baptismDate),
      rol: member.rol,
      email: member.email,
      phone: member.phone,
      mobile: member.mobile,
      birthDate: dia(member.birthDate),
      gender: member.gender,
      maritalStatus: member.maritalStatus,
      nationality: member.nationality,
      fatherName: member.fatherName,
      motherName: member.motherName,
      spouseName: member.spouseName,
      occupation: member.occupation,
      addressStreet: member.addressStreet,
      addressNumber: member.addressNumber,
      addressNeighborhood: member.addressNeighborhood,
      addressCity: member.addressCity,
      addressState: member.addressState,
      churchName: member.church?.name ?? null,
      campoName: member.church?.regional?.campo?.name ?? null,
      regionalName: member.church?.regional?.name ?? null,
    },
    gf,
    funcoes,
    ministerios,
    batismo,
    temVidaEclesiastica: funcoes.length > 0 || ministerios.length > 0 || !!batismo,
  };
}
