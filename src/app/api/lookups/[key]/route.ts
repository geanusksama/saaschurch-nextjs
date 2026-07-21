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

function canManage(user: { profileType: string }) {
  return user.profileType === "master" || user.profileType === "admin";
}

/** Converte o body do cliente em colunas/valores válidos para a tabela. */
export function buildWritableValues(cfg: LookupConfig, body: Record<string, unknown>) {
  const cols: string[] = [];
  const values: unknown[] = [];
  for (const field of cfg.fields) {
    if (!(field.key in body)) continue;
    const raw = body[field.key];
    let value: unknown;
    if (field.type === "boolean") value = !!raw;
    else value = raw === "" || raw === undefined ? null : String(raw);
    cols.push(field.key);
    values.push(value);
  }
  return { cols, values };
}

// GET /api/lookups/[key] — lista todos os itens
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  return withAuth(req, async () => {
    const { key } = await params;
    const cfg = getLookup(key);
    if (!cfg) return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });

    const selectCols = ["id", ...cfg.fields.map((f) => f.key)].join(", ");
    const where = cfg.softDelete ? "WHERE deleted_at IS NULL" : "";
    const rows = await prisma.$queryRawUnsafe(
      `SELECT ${selectCols} FROM "${cfg.table}" ${where} ORDER BY ${cfg.orderBy}`
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
    if (!canManage(user)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

    const body = await req.json().catch(() => ({}));

    for (const f of cfg.fields) {
      if (f.required && !String(body[f.key] ?? "").trim()) {
        return NextResponse.json({ error: `${f.label} é obrigatório.` }, { status: 400 });
      }
    }

    const { cols, values } = buildWritableValues(cfg, body);
    if (!cols.length) return NextResponse.json({ error: "Nada para salvar." }, { status: 400 });

    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    const quoted = cols.map((c) => `"${c}"`).join(", ");
    try {
      const inserted = await prisma.$queryRawUnsafe(
        `INSERT INTO "${cfg.table}" (${quoted}) VALUES (${placeholders}) RETURNING id`,
        ...values
      );
      return NextResponse.json(serializeBigInts(inserted), { status: 201 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao criar item.";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  });
}
