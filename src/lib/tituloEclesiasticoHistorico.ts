/**
 * Último título eclesiástico que um membro teve, lido do histórico.
 *
 * Serve à readmissão: quem volta para a igreja não pode voltar como congregado
 * se já era pastor. A matriz de decisão, com `restorePreviousTitle` ligado, usa
 * isto no lugar do título fixo da regra.
 *
 * ── O critério é o MAIS RECENTE ─────────────────────────────────────────────
 *
 * O último título gravado é, com certeza, o que a pessoa tinha quando saiu.
 * Não se procura o "maior nível": além de ser a mesma coisa na carreira normal
 * (que só sobe), o mais recente respeita sozinho a variante de gênero — se está
 * gravado DIACONISA, volta DIACONISA; se está EVANGELISTA, volta EVANGELISTA.
 * Nada é inferido a partir do sexo do membro.
 *
 * ── Por que o título ATUAL não entra na disputa ─────────────────────────────
 *
 * Seria sempre o mais recente e venceria tudo. Um readmitido ontem está como
 * CONGREGADO com data de ontem; incluí-lo devolveria CONGREGADO e o problema
 * continuaria de pé. Só o histórico conta.
 *
 * ── Por que ler as DUAS colunas do histórico ────────────────────────────────
 *
 * `member_title_history` tem `previous_title` e `new_title`, mas o dado legado
 * está torto: em 10.419 registros o `new_title` vale literalmente "SIM" e o
 * título de verdade está em `previous_title`. Ler só uma das colunas perderia
 * a maior parte do histórico da igreja.
 *
 * ── Por que não há lista de valores a ignorar ───────────────────────────────
 *
 * Levantamento das duas colunas contra o catálogo (13/08/2026): fora do
 * catálogo aparecem só SIM (10.419), NOVO (6), AGUARDANDO ATIVACAO (2) e
 * DEV TER (1). Todo o resto casa. Então o próprio catálogo é o filtro: o que
 * não casa não é título e não entra na disputa.
 *
 * O casamento ignora acento e caixa, porque a base tem PRESBÍTERO/PRESBITERO e
 * DIÁCONO/DIACONO convivendo.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/** Tira acento e caixa, para casar o texto gravado com o nome do catálogo. */
const SEM_ACENTO = (coluna: string) =>
  `upper(translate(${coluna}, 'ÁÀÂÃÉÊÍÓÔÕÚÜÇáàâãéêíóôõúüç', 'AAAAEEIOOOUUCAAAAEEIOOOUUC'))`;

export type TituloEncontrado = {
  /** Nome exatamente como está no catálogo — é o que vai para o cadastro. */
  nome: string;
  id: string;
  level: number;
  /** Quando esse título foi registrado. */
  quando: Date | null;
};

/**
 * Último título do histórico do membro, ou null quando não há nenhum
 * reconhecível — nesse caso quem chama decide (a readmissão cai no título fixo
 * da regra).
 */
export async function ultimoTituloDoHistorico(
  db: Db,
  memberId: string
): Promise<TituloEncontrado | null> {
  const linhas = await db.$queryRawUnsafe<
    Array<{ id: string; nome: string; level: number; quando: Date | null }>
  >(
    `
    WITH catalogo AS (
      SELECT id, name, level, ${SEM_ACENTO("name")} AS chave
      FROM ecclesiastical_titles
      WHERE deleted_at IS NULL
    ),
    candidatos AS (
      -- Legado: o título real costuma estar em previous_title.
      SELECT ${SEM_ACENTO("previous_title")} AS chave, created_at, 0 AS prioridade
      FROM member_title_history
      WHERE member_id = $1::uuid AND previous_title IS NOT NULL

      UNION ALL

      -- Mesma linha, mesma data: o "novo" foi o que passou a vigorar, então
      -- ganha do "anterior". É o que impede quem virou MEMBRO de voltar como
      -- CONGREGADO, já que a promoção grava os dois com o mesmo created_at.
      SELECT ${SEM_ACENTO("new_title")} AS chave, created_at, 1 AS prioridade
      FROM member_title_history
      WHERE member_id = $1::uuid AND new_title IS NOT NULL
    )
    SELECT c.id::text AS id, c.name AS nome, c.level AS level, cand.created_at AS quando
    FROM candidatos cand
    JOIN catalogo c ON c.chave = cand.chave
    ORDER BY cand.created_at DESC NULLS LAST, cand.prioridade DESC
    LIMIT 1
    `,
    memberId
  );

  const achado = linhas[0];
  if (!achado) return null;
  return {
    id: achado.id,
    nome: achado.nome,
    level: Number(achado.level),
    quando: achado.quando ?? null,
  };
}

/**
 * Título que a regra da matriz deve aplicar.
 *
 * Com `restorePreviousTitle` ligado, tenta o último título do histórico; o
 * `newTitle` da regra vira apenas a rede de segurança para quem não tem
 * histórico nenhum. Sem a flag, o comportamento é o de sempre: título fixo.
 */
export async function resolverTituloDaRegra(
  db: Db,
  regra: { changeTitle: boolean; newTitle: string | null; restorePreviousTitle?: boolean },
  memberId: string
): Promise<{ titulo: string | null; restaurado: TituloEncontrado | null }> {
  if (!regra.changeTitle) return { titulo: null, restaurado: null };

  if (regra.restorePreviousTitle) {
    const encontrado = await ultimoTituloDoHistorico(db, memberId);
    if (encontrado) return { titulo: encontrado.nome, restaurado: encontrado };
    // Sem histórico reconhecível: cai no título fixo da regra, se houver.
    return { titulo: regra.newTitle ?? null, restaurado: null };
  }

  return { titulo: regra.newTitle ?? null, restaurado: null };
}
