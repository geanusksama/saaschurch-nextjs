import type { Prisma } from "@prisma/client";

/**
 * Ocorrências geradas pela troca de dirigente.
 *
 * A aba "Histórico" do perfil do membro lê `member_event_history`; a aba "Funções"
 * lê `church_function_history`. Antes a troca só alimentava a segunda, então quem
 * assumia (ou deixava) a dirigência não ganhava nenhuma ocorrência no perfil.
 * Estas funções fecham essa lacuna e são chamadas dentro da mesma transação da
 * troca, para que histórico e função nunca fiquem fora de sincronia.
 */

export const LEADER_EVENT_GROUP = "DIRIGENTE";
export const LEADER_EVENT_SERVICE = "Troca de Dirigente";
export const LEADER_EVENT_ACTION_IN = "ASSUMIU A DIRIGENCIA";
export const LEADER_EVENT_ACTION_OUT = "DEIXOU A DIRIGENCIA";

/** Cliente Prisma ou cliente de transação — as duas formas são aceitas. */
type Db = Prisma.TransactionClient;

/**
 * A troca de dirigente escreve em 4 tabelas numa transação só, e o banco fica a
 * ~150 ms de round-trip. O limite padrão de 5 s do Prisma estoura no meio do
 * caminho e devolve 500; 20 s dá folga sem deixar a transação pendurada.
 */
export const LEADER_TX_OPTIONS = { timeout: 20000, maxWait: 10000 } as const;

function formatDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10).split("-").reverse().join("/");
}

type LeaderEventParams = {
  memberId: string;
  churchId: string;
  churchName?: string | null;
  functionName?: string | null;
  leaderHistoryId: string;
  /** Data de entrada (posse) ou de saída, conforme o tipo do evento. */
  date?: Date | string | null;
  indicatedBy?: string | null;
  changeReason?: string | null;
  userId?: string | null;
};

/** Ocorrência de posse: o membro assumiu a dirigência da igreja. */
export async function recordLeaderEntryEvent(db: Db, params: LeaderEventParams) {
  const dateLabel = formatDate(params.date);
  const notes = [
    params.functionName ? `Função: ${params.functionName}` : null,
    params.churchName ? `Igreja: ${params.churchName}` : null,
    dateLabel ? `Entrada: ${dateLabel}` : null,
    params.indicatedBy ? `Indicado por: ${params.indicatedBy}` : null,
    params.changeReason ? `Motivo: ${params.changeReason}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return db.memberEventHistory.create({
    data: {
      memberId: params.memberId,
      churchId: params.churchId,
      serviceGroup: LEADER_EVENT_GROUP,
      serviceName: LEADER_EVENT_SERVICE,
      action: LEADER_EVENT_ACTION_IN,
      notes: notes || null,
      metadata: {
        source: "TROCA_DIRIGENTE",
        movement: "ENTRADA",
        leaderHistoryId: params.leaderHistoryId,
        functionName: params.functionName || null,
        entryDate: params.date ? new Date(params.date).toISOString().slice(0, 10) : null,
      },
      createdBy: params.userId || null,
    },
  });
}

/** Ocorrência de saída: o membro deixou a dirigência da igreja. */
export async function recordLeaderExitEvent(db: Db, params: LeaderEventParams) {
  const dateLabel = formatDate(params.date);
  const notes = [
    params.functionName ? `Função: ${params.functionName}` : null,
    params.churchName ? `Igreja: ${params.churchName}` : null,
    dateLabel ? `Saída: ${dateLabel}` : null,
    params.changeReason ? `Motivo: ${params.changeReason}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return db.memberEventHistory.create({
    data: {
      memberId: params.memberId,
      churchId: params.churchId,
      serviceGroup: LEADER_EVENT_GROUP,
      serviceName: LEADER_EVENT_SERVICE,
      action: LEADER_EVENT_ACTION_OUT,
      notes: notes || null,
      metadata: {
        source: "TROCA_DIRIGENTE",
        movement: "SAIDA",
        leaderHistoryId: params.leaderHistoryId,
        functionName: params.functionName || null,
        exitDate: params.date ? new Date(params.date).toISOString().slice(0, 10) : null,
      },
      createdBy: params.userId || null,
    },
  });
}

/**
 * Remove as ocorrências geradas por uma troca específica.
 * Usado ao excluir/reescrever a movimentação, para não deixar histórico órfão.
 */
export async function removeLeaderEvents(db: Db, leaderHistoryId: string, movement?: "ENTRADA" | "SAIDA") {
  return db.memberEventHistory.deleteMany({
    where: {
      serviceGroup: LEADER_EVENT_GROUP,
      AND: [
        { metadata: { path: ["leaderHistoryId"], equals: leaderHistoryId } },
        ...(movement ? [{ metadata: { path: ["movement"], equals: movement } }] : []),
      ],
    },
  });
}

/** Converte "YYYY-MM-DD" (ou ISO) em Date, tratando string vazia como nulo. */
export function parseOptionalDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}
