import { kanScopeFilter } from "@/lib/helpers";

/** Quantos cards cada coluna traz no primeiro carregamento. */
export const BOARD_PAGE_SIZE = 40;
/** Quantos cards a rolagem da coluna busca por vez. */
export const BOARD_LOAD_MORE_SIZE = 10;

/**
 * Colunas do card carregadas junto no board. Mantido aqui para que a rota do
 * board e a de "carregar mais" devolvam exatamente o mesmo formato — se as duas
 * divergirem, o card que chega pela rolagem renderiza diferente do resto.
 */
export const BOARD_CARD_INCLUDE = {
  church: { select: { id: true, name: true, code: true } },
  destinationChurch: { select: { id: true, name: true, code: true } },
  member: {
    select: {
      id: true,
      fullName: true,
      ecclesiasticalTitle: true,
      membershipStatus: true,
      rol: true,
      memberType: true,
    },
  },
  service: { select: { sigla: true, description: true } },
  column: { select: { id: true, name: true, columnIndex: true, color: true } },
} as const;

/**
 * Ordenacao do board. O desempate por `id` NAO e decorativo: a paginacao e por
 * OFFSET, e sem um criterio total a ordem de linhas com o mesmo `openedAt` pode
 * mudar entre uma pagina e a seguinte — a rolagem repetiria um card e engoliria
 * outro.
 */
export const BOARD_ORDER_BY = [
  { openedAt: "desc" as const },
  { id: "desc" as const },
];

/**
 * Monta o filtro de cards do board a partir da querystring.
 *
 * Vive fora da rota porque a tela do kanban e a rolagem infinita precisam do
 * filtro IDENTICO. O trecho de escopo abaixo ja foi um vazamento de dados; uma
 * segunda copia dele em outra rota seria a chance de reabrir o buraco.
 */
export function buildBoardCardWhere(
  user: Parameters<typeof kanScopeFilter>[0],
  stageId: number,
  searchParams: URLSearchParams,
) {
  const scope = kanScopeFilter(user) as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cardWhere: Record<string, any> = { stageId, deletedAt: null, ...scope };

  const churchId = searchParams.get("churchId");
  // Lista separada por virgula, para o filtro de multiplas igrejas da tela.
  // `churchId` (uma so) continua aceito — outros chamadores ainda usam.
  const churchIds = (searchParams.get("churchIds") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const campoId = searchParams.get("campoId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = searchParams.get("q");

  // O filtro da tela so pode RESTRINGIR dentro do escopo, nunca substitui-lo.
  // Antes `cardWhere.churchId = churchId` sobrescrevia o churchId que
  // kanScopeFilter tinha fixado, entao um perfil preso a uma igreja (church,
  // secretaria, tesouraria) via cards de qualquer outra so passando o id na
  // query. Com selecao multipla o vazamento seria de varias de uma vez.
  const scopedChurchId = typeof scope.churchId === "string" ? scope.churchId : null;
  const requestedChurchIds = churchIds.length ? churchIds : churchId ? [churchId] : [];

  if (scopedChurchId) {
    cardWhere.churchId = scopedChurchId;
  } else if (requestedChurchIds.length === 1) {
    cardWhere.churchId = requestedChurchIds[0];
  } else if (requestedChurchIds.length > 1) {
    cardWhere.churchId = { in: requestedChurchIds };
  }
  if (campoId) cardWhere.church = { ...(cardWhere.church || {}), regional: { campoId } };
  if (from || to) {
    cardWhere.openedAt = {};
    if (from) cardWhere.openedAt.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      cardWhere.openedAt.lte = toDate;
    }
  }
  if (q) {
    cardWhere.OR = [
      { protocol: { contains: q, mode: "insensitive" } },
      { candidateName: { contains: q, mode: "insensitive" } },
    ];
  }

  // Exclude cards for PF and PJ members
  cardWhere.AND = [
    {
      OR: [
        { memberId: null },
        {
          member: {
            OR: [{ memberType: null }, { memberType: { notIn: ["PF", "PJ", "pf", "pj"] } }],
          },
        },
      ],
    },
  ];

  return cardWhere;
}
