import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT e.*, (SELECT COUNT(*)::int FROM app_daily_bread_likes l WHERE l.entry_id = e.id) AS likes_count
       FROM app_daily_bread_entries e WHERE e.id = $1::uuid`,
      id
    );
    if (!rows.length) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json(serializeBigInts(rows[0]));
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin" && user.profileType !== "campo") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const fieldMap: Record<string, string> = {
      title: "title", summary: "summary", bodyText: "body_text", bibleReference: "bible_reference",
      audioUrl: "audio_url", audioDurationSeconds: "audio_duration_seconds", accentHex: "accent_hex",
      iconName: "icon_name", isFeatured: "is_featured", active: "active",
      audienceScope: "audience_scope", publishedAt: "published_at",
      headquartersId: "headquarters_id", churchId: "church_id",
    };
    const sets: string[] = [];
    const queryParams: unknown[] = [id];
    for (const [jsKey, sqlCol] of Object.entries(fieldMap)) {
      if (body[jsKey] !== undefined) {
        queryParams.push(jsKey === "publishedAt" ? new Date(body[jsKey]) : body[jsKey]);
        sets.push(`${sqlCol} = $${queryParams.length}`);
      }
    }
    if (!sets.length) return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    sets.push(`updated_at = NOW()`);
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `UPDATE app_daily_bread_entries SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING *`,
      ...queryParams
    );
    if (!rows.length) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json(serializeBigInts(rows[0]));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin" && user.profileType !== "campo") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const { id } = await params;
    await prisma.$queryRawUnsafe(`DELETE FROM app_daily_bread_entries WHERE id = $1::uuid`, id);
    return new NextResponse(null, { status: 204 });
  });
}
