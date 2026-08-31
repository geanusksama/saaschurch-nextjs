import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { getLookup, type LookupConfig } from "@/lib/lookupRegistry";
import { buildWritableValues, campoDoUsuario, igrejaDoUsuario, erroLegivel } from "../route";
import type { AuthUser } from "@/lib/auth";

function canManage(user: { profileType: string }, cfg?: { churchField?: string }) {
  if (user.profileType === "master" || user.profileType === "admin") return true;
  // Lista por igreja: o perfil de igreja mantém o próprio cadastro. O escopo
  // é conferido em itemForaDaIgreja antes de qualquer escrita.
  return Boolean(cfg?.churchField) && user.profileType === "church";
}

/**
 * Numa lista isolada por igreja, editar/excluir só vale para item da PRÓPRIA
 * igreja. Vale inclusive para master: aqui o id não é escapatória, porque o
 * cadastro de horário de uma congregação não é assunto de outra.
 */
async function itemForaDaIgreja(cfg: LookupConfig, id: string, user: AuthUser) {
  if (!cfg.churchField) return false;
  // Master e admin do campo administram várias igrejas — para eles o limite é
  // o campo, conferido em itemForaDoCampo. O perfil de igreja só mexe no seu.
  if (user.profileType !== "church") return false;
  const churchId = igrejaDoUsuario(user, null);
  if (!churchId) return true;
  const linhas = await prisma.$queryRawUnsafe<Array<{ existe: boolean }>>(
    `SELECT true AS existe FROM "${cfg.table}" WHERE id = $1::uuid AND "${cfg.churchField}" = $2::uuid LIMIT 1`,
    id,
    churchId
  );
  return linhas.length === 0;
}

/**
 * Numa lista isolada por campo, editar/excluir só vale para item do próprio
 * campo. Sem esta checagem, bastaria conhecer o id para mexer no cadastro de
 * outro campo — o filtro da listagem sozinho não protege a escrita.
 */
async function itemForaDoCampo(cfg: LookupConfig, id: string, user: AuthUser) {
  if (!cfg.campoField) return false;
  if (user.profileType === "master") return false;
  // Numa lista por igreja, o perfil de igreja é conferido por itemForaDaIgreja:
  // exigir campo aqui travaria quem não tem campo preenchido no cadastro.
  if (cfg.churchField && user.profileType === "church") return false;
  const campoId = campoDoUsuario(user, null);
  if (!campoId) return true;
  const linhas = await prisma.$queryRawUnsafe<Array<{ existe: boolean }>>(
    `SELECT true AS existe FROM "${cfg.table}" WHERE id = $1::uuid AND "${cfg.campoField}" = $2::uuid LIMIT 1`,
    id,
    campoId
  );
  return linhas.length === 0;
}

// PATCH /api/lookups/[key]/[id] — atualiza item
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string; id: string }> }) {
  return withAuth(req, async (user) => {
    const { key, id } = await params;
    const cfg = getLookup(key);
    if (!cfg) return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
    if (!canManage(user, cfg)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

    if (await itemForaDoCampo(cfg, id, user)) {
      return NextResponse.json({ error: "Este item pertence a outro campo." }, { status: 403 });
    }

    if (await itemForaDaIgreja(cfg, id, user)) {
      return NextResponse.json({ error: "Este item pertence a outra igreja." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { cols, values, casts } = buildWritableValues(cfg, body);
    if (!cols.length) return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });

    const setClause = cols.map((c, i) => `"${c}" = $${i + 1}${casts[i]}`).join(", ");
    try {
      const updated = await prisma.$queryRawUnsafe(
        `UPDATE "${cfg.table}" SET ${setClause} WHERE id = $${cols.length + 1}::uuid RETURNING id`,
        ...values,
        id
      );
      if (!Array.isArray(updated) || updated.length === 0) {
        return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
      }
      return NextResponse.json(serializeBigInts(updated));
    } catch (e) {
      return NextResponse.json(erroLegivel(e, "Erro ao atualizar item."), { status: 400 });
    }
  });
}

// DELETE /api/lookups/[key]/[id] — exclui (lógica quando a tabela tem deleted_at)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ key: string; id: string }> }) {
  return withAuth(req, async (user) => {
    const { key, id } = await params;
    const cfg = getLookup(key);
    if (!cfg) return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
    if (!canManage(user, cfg)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

    if (await itemForaDoCampo(cfg, id, user)) {
      return NextResponse.json({ error: "Este item pertence a outro campo." }, { status: 403 });
    }

    if (await itemForaDaIgreja(cfg, id, user)) {
      return NextResponse.json({ error: "Este item pertence a outra igreja." }, { status: 403 });
    }

    try {
      if (cfg.softDelete) {
        await prisma.$executeRawUnsafe(
          `UPDATE "${cfg.table}" SET deleted_at = now() WHERE id = $1::uuid`,
          id
        );
      } else {
        await prisma.$executeRawUnsafe(`DELETE FROM "${cfg.table}" WHERE id = $1::uuid`, id);
      }
      return new NextResponse(null, { status: 204 });
    } catch (e) {
      // FK em uso (ex.: função já atribuída a membros) → orienta a desativar.
      const raw = e instanceof Error ? e.message : "";
      const inUse = /foreign key|violates|referenced/i.test(raw);
      return NextResponse.json(
        {
          error: inUse
            ? "Este item está em uso e não pode ser excluído. Desative-o em vez de excluir."
            : "Erro ao excluir item.",
        },
        { status: inUse ? 409 : 500 }
      );
    }
  });
}
