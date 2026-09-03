import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { getLookup, type LookupConfig } from "@/lib/lookupRegistry";

/**
 * CRUD genérico das listas auxiliares (dropdowns) do sistema.
 *
 * Segurança: tabela e colunas vêm SEMPRE do registro em lookupRegistry.ts.
 * Nada vindo do cliente é interpolado em SQL — valores usam parâmetros ($1, $2...).
 */

function canManage(user: { profileType: string }, cfg?: { churchField?: string }) {
  if (user.profileType === "master" || user.profileType === "admin") return true;
  // Lista isolada por igreja é da congregação: quem tem perfil de igreja
  // mantém o próprio cadastro sem precisar ser admin do campo. O escopo é
  // garantido por `igrejaDoUsuario`, que prende esse perfil à igreja dele.
  return Boolean(cfg?.churchField) && user.profileType === "church";
}

/**
 * Campo em que a lista deve ser lida/gravada.
 *
 * O `?campoId=` da URL só vale para master — é ele que troca de contexto entre
 * campos na tela. Para qualquer outro perfil o campo vem do próprio usuário,
 * senão bastaria trocar o querystring para ver o cadastro de outro campo.
 */
/**
 * Traduz o erro cru do Postgres em mensagem que o usuário entende.
 *
 * Sem isso, tentar repetir um código já usado devolve
 * "duplicate key value violates unique constraint bancos_campo_codigo_key" na
 * tela — o operador não tem como saber que precisa trocar o código.
 */
export function erroLegivel(e: unknown, padrao: string) {
  const bruto = e instanceof Error ? e.message : "";

  // O Prisma não repassa o texto "duplicate key" do Postgres: para violação de
  // unicidade ele manda `Code: 23505` com "Key (col)=(valor) already exists".
  const duplicado = /`23505`|duplicate key|unique constraint|already exists/i.test(bruto);
  if (duplicado) {
    if (/codigo/i.test(bruto)) {
      return { error: "Já existe um item com este código neste campo. Use outro código." };
    }
    if (/\bnome\b|\bname\b/i.test(bruto)) {
      return { error: "Já existe um item com este nome." };
    }
    return { error: "Já existe um item com estes dados." };
  }
  if (/is of type integer but expression is of type text|`42804`/i.test(bruto)) {
    return { error: "Um campo numérico recebeu texto. Confira os valores informados." };
  }
  if (/not-null constraint|`23502`/i.test(bruto)) {
    return { error: "Um campo obrigatório ficou em branco." };
  }
  if (/foreign key|`23503`/i.test(bruto)) {
    return { error: "Um dos valores selecionados não existe mais. Recarregue a página." };
  }
  return { error: padrao };
}

/**
 * Igreja em que a lista deve ser lida/gravada.
 *
 * Perfil de igreja fica preso à PRÓPRIA igreja: nem passando `?churchId=` ele
 * enxerga o cadastro de outra congregação. Quem administra acima da igreja
 * (master, admin do campo, campo) escolhe a igreja na tela — continua limitado
 * ao campo dele pelo filtro de `campoField`.
 */
export function igrejaDoUsuario(
  user: { profileType: string; churchId: string | null },
  churchIdPedido?: string | null
) {
  if (user.profileType === "church") return user.churchId || null;
  return churchIdPedido || user.churchId || null;
}

export function campoDoUsuario(
  user: { profileType: string; campoId: string | null },
  campoIdPedido?: string | null
) {
  if (user.profileType === "master") return campoIdPedido || user.campoId || null;
  return user.campoId || null;
}

/**
 * Converte o body do cliente em colunas/valores válidos para a tabela.
 *
 * Devolve também o `cast` de cada coluna. Sem isso, o Prisma manda todo
 * parâmetro como texto e o Postgres recusa a gravação numa coluna integer
 * ("column ordem is of type integer but expression is of type text") — o
 * parâmetro sozinho não dá contexto para o banco inferir o tipo.
 */
export function buildWritableValues(cfg: LookupConfig, body: Record<string, unknown>) {
  const cols: string[] = [];
  const values: unknown[] = [];
  const casts: string[] = [];
  for (const field of cfg.fields) {
    if (!(field.key in body)) continue;
    const raw = body[field.key];
    let value: unknown;
    let cast = "";
    if (field.type === "boolean") {
      value = !!raw;
    } else if (field.type === "number") {
      const n = raw === "" || raw === null || raw === undefined ? null : Number(raw);
      value = n === null || Number.isNaN(n) ? null : String(Math.trunc(n));
      cast = "::int";
    } else {
      value = raw === "" || raw === undefined ? null : String(raw);
    }
    cols.push(field.key);
    values.push(value);
    casts.push(cast);
  }
  return { cols, values, casts };
}

// GET /api/lookups/[key] — lista todos os itens
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  return withAuth(req, async (user) => {
    const { key } = await params;
    const cfg = getLookup(key);
    if (!cfg) return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });

    const selectCols = ["id", ...cfg.fields.map((f) => f.key)].join(", ");
    const filtros: string[] = [];
    const valores: unknown[] = [];

    if (cfg.softDelete) filtros.push("deleted_at IS NULL");

    // Isolamento por campo: cada campo enxerga só o próprio cadastro.
    if (cfg.campoField) {
      const campoId = campoDoUsuario(user, new URL(req.url).searchParams.get("campoId"));
      if (campoId) {
        valores.push(campoId);
        filtros.push(`"${cfg.campoField}" = $${valores.length}::uuid`);
      } else if (user.profileType !== "master" && !cfg.churchField) {
        // Sem campo definido e sem ser master: não há escopo para devolver.
        // Quando a lista é por igreja, o filtro de igreja abaixo já dá o
        // escopo — exigir campo aqui deixaria o usuário sem cadastro nenhum.
        return NextResponse.json([]);
      }
    }

    // Lista que É o campo (tabela `campos`): o escopo é a própria linha. Master
    // administra todos; qualquer outro perfil só enxerga o campo em que opera.
    if (cfg.selfCampo && user.profileType !== "master") {
      const campoId = campoDoUsuario(user, null);
      if (!campoId) return NextResponse.json([]);
      valores.push(campoId);
      filtros.push(`id = $${valores.length}::uuid`);
    }

    // Isolamento por igreja: mais estreito que o de campo. Sem igreja definida
    // não há o que devolver — misturar o cadastro de todas seria justamente o
    // que este filtro existe para impedir.
    if (cfg.churchField) {
      const churchId = igrejaDoUsuario(user, new URL(req.url).searchParams.get("churchId"));
      if (!churchId) return NextResponse.json([]);
      valores.push(churchId);
      filtros.push(`"${cfg.churchField}" = $${valores.length}::uuid`);
    }

    const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
    const rows = await prisma.$queryRawUnsafe(
      `SELECT ${selectCols} FROM "${cfg.table}" ${where} ORDER BY ${cfg.orderBy}`,
      ...valores
    );
    return NextResponse.json(serializeBigInts(rows));
  });
}

// POST /api/lookups/[key] — cria item
export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  return withAuth(req, async (user) => {
    const { key } = await params;
    const cfg = getLookup(key);
    if (!cfg) return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
    if (!canManage(user, cfg)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

    const body = await req.json().catch(() => ({}));

    for (const f of cfg.fields) {
      if (f.required && !String(body[f.key] ?? "").trim()) {
        return NextResponse.json({ error: `${f.label} é obrigatório.` }, { status: 400 });
      }
    }

    const { cols, values, casts } = buildWritableValues(cfg, body);
    if (!cols.length) return NextResponse.json({ error: "Nada para salvar." }, { status: 400 });

    // O campo é carimbado pelo servidor, nunca aceito do corpo da requisição.
    if (cfg.campoField) {
      const campoId = campoDoUsuario(user, body.campoId as string | undefined);
      if (!campoId && !cfg.churchField) {
        return NextResponse.json(
          { error: "Não foi possível identificar o campo. Selecione um campo antes de cadastrar." },
          { status: 400 }
        );
      }
      // Numa lista por igreja o campo é só apoio ao filtro: se o usuário não
      // tem campo, a coluna fica nula e a igreja continua identificando a linha.
      if (campoId) {
        cols.push(cfg.campoField);
        values.push(campoId);
        casts.push("::uuid");
      }
    }

    // A igreja também é carimbada pelo servidor. Para perfil de igreja o corpo
    // é ignorado de propósito: ele só cadastra para si.
    if (cfg.churchField) {
      const churchId = igrejaDoUsuario(user, body.churchId as string | undefined);
      if (!churchId) {
        return NextResponse.json(
          { error: "Não foi possível identificar a igreja. Selecione uma igreja antes de cadastrar." },
          { status: 400 }
        );
      }
      cols.push(cfg.churchField);
      values.push(churchId);
      casts.push("::uuid");
    }

    const placeholders = cols.map((_, i) => `$${i + 1}${casts[i]}`).join(", ");
    const quoted = cols.map((c) => `"${c}"`).join(", ");
    try {
      const inserted = await prisma.$queryRawUnsafe(
        `INSERT INTO "${cfg.table}" (${quoted}) VALUES (${placeholders}) RETURNING id`,
        ...values
      );
      return NextResponse.json(serializeBigInts(inserted), { status: 201 });
    } catch (e) {
      return NextResponse.json(erroLegivel(e, "Erro ao criar item."), { status: 400 });
    }
  });
}
