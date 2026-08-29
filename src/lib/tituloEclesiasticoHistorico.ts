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

/** De onde saiu o título que foi aplicado. Vai para o rastro no histórico. */
export type OrigemDoTitulo = "CONFIRMADO" | "HISTORICO" | "FIXO";

export type TituloResolvido = {
  titulo: string | null;
  restaurado: TituloEncontrado | null;
  origem: OrigemDoTitulo | null;
};

/**
 * Título que a regra da matriz deve aplicar.
 *
 * Ordem de precedência:
 *
 * 1. `restorePreviousTitle` ligado — a regra diz "o título vem do passado do
 *    membro". Só aí vale o `tituloConfirmado`: o que a secretaria escolheu na
 *    tela olhando o histórico. Qual título a pessoa recupera é decisão humana,
 *    não dedução. Ele só entra se casar com o catálogo; texto solto é ignorado,
 *    para não gravar lixo no cadastro. Sem confirmação, cai no último título do
 *    histórico — é o caminho de quem não passa pela tela (importações, API).
 * 2. `newTitle` — o título fixo da regra.
 *
 * O `tituloConfirmado` NÃO atropela uma regra de título fixo. Isso importa na
 * coluna "Readmissão cancelada" do READMEM, que grava CONGREGADO fixo
 * (change_title=true, restore_previous_title=false): o título confirmado para o
 * caso de aprovação não pode vazar para o cancelamento.
 */
export async function resolverTituloDaRegra(
  db: Db,
  regra: { changeTitle: boolean; newTitle: string | null; restorePreviousTitle?: boolean },
  memberId: string,
  tituloConfirmado?: string | null
): Promise<TituloResolvido> {
  if (!regra.changeTitle) return { titulo: null, restaurado: null, origem: null };

  if (regra.restorePreviousTitle) {
    if (tituloConfirmado) {
      const doCatalogo = await normalizarTituloDoCatalogo(db, tituloConfirmado);
      if (doCatalogo) return { titulo: doCatalogo.nome, restaurado: doCatalogo, origem: "CONFIRMADO" };
    }
    const encontrado = await ultimoTituloDoHistorico(db, memberId);
    if (encontrado) return { titulo: encontrado.nome, restaurado: encontrado, origem: "HISTORICO" };
    // Sem histórico reconhecível: cai no título fixo da regra, se houver.
    return { titulo: regra.newTitle ?? null, restaurado: null, origem: "FIXO" };
  }

  return { titulo: regra.newTitle ?? null, restaurado: null, origem: "FIXO" };
}

/**
 * Todos os títulos reconhecíveis do histórico do membro, do mais recente para o
 * mais antigo, sem repetir o mesmo título.
 *
 * É o que a secretaria vê no modal de confirmação da readmissão: em vez de o
 * sistema decidir sozinho, a lista é mostrada e a pessoa escolhe para qual
 * título o readmitido volta. A varredura é a mesma de
 * `ultimoTituloDoHistorico` — as duas colunas, porque o legado gravou o título
 * real em `previous_title` — e o catálogo continua sendo o filtro.
 */
export async function historicoDeTitulos(
  db: Db,
  memberId: string
): Promise<TituloEncontrado[]> {
  return db.$queryRawUnsafe<TituloEncontrado[]>(
    `
    WITH catalogo AS (
      SELECT id, name, level, ${SEM_ACENTO("name")} AS chave
      FROM ecclesiastical_titles
      WHERE deleted_at IS NULL
    ),
    candidatos AS (
      SELECT ${SEM_ACENTO("previous_title")} AS chave, created_at, 0 AS prioridade
      FROM member_title_history
      WHERE member_id = $1::uuid AND previous_title IS NOT NULL

      UNION ALL

      SELECT ${SEM_ACENTO("new_title")} AS chave, created_at, 1 AS prioridade
      FROM member_title_history
      WHERE member_id = $1::uuid AND new_title IS NOT NULL
    ),
    casados AS (
      SELECT c.id, c.name, c.level, cand.created_at, cand.prioridade
      FROM candidatos cand
      JOIN catalogo c ON c.chave = cand.chave
    )
    SELECT DISTINCT ON (id)
      id::text AS id, name AS nome, level AS level, created_at AS quando
    FROM casados
    ORDER BY id, created_at DESC NULLS LAST, prioridade DESC
    `,
    memberId
  ).then((linhas) =>
    linhas
      .map((l) => ({ ...l, level: Number(l.level), quando: l.quando ?? null }))
      .sort((a, b) => {
        const da = a.quando ? new Date(a.quando).getTime() : 0;
        const db_ = b.quando ? new Date(b.quando).getTime() : 0;
        if (db_ !== da) return db_ - da;
        return b.level - a.level;
      })
  );
}

/**
 * Confere um título escolhido na tela contra o catálogo e devolve o nome
 * exatamente como está lá.
 *
 * A tela manda texto; o cadastro precisa do nome canônico (a base tem
 * PRESBÍTERO e PRESBITERO convivendo). Devolve null quando o texto não é um
 * título do catálogo — quem chama recusa a operação em vez de gravar lixo.
 */
export async function normalizarTituloDoCatalogo(
  db: Db,
  titulo: string
): Promise<TituloEncontrado | null> {
  const texto = (titulo || "").trim();
  if (!texto) return null;
  const linhas = await db.$queryRawUnsafe<
    Array<{ id: string; nome: string; level: number }>
  >(
    `
    SELECT id::text AS id, name AS nome, level AS level
    FROM ecclesiastical_titles
    WHERE deleted_at IS NULL AND ${SEM_ACENTO("name")} = ${SEM_ACENTO("$1::text")}
    LIMIT 1
    `,
    texto
  );
  const achado = linhas[0];
  if (!achado) return null;
  return { id: achado.id, nome: achado.nome, level: Number(achado.level), quando: null };
}
