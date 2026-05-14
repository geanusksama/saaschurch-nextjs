import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const { searchParams } = new URL(req.url);
    const campoId = searchParams.get("campoId");
    const active = searchParams.get("active");

    let where = `WHERE TRUE`;
    const params: unknown[] = [];
    if (campoId) { params.push(campoId); where += ` AND campo_id = $${params.length}::uuid`; }
    if (active !== null) { params.push(active === "true"); where += ` AND active = $${params.length}`; }

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT e.*, (SELECT COUNT(*)::int FROM app_daily_bread_likes l WHERE l.entry_id = e.id) AS likes_count
       FROM app_daily_bread_entries e ${where} ORDER BY e.published_at DESC`,
      ...params
    );
    return NextResponse.json(serializeBigInts(rows));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin" && user.profileType !== "campo") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const { campoId, headquartersId, churchId, audienceScope = "headquarters", title, summary, bodyText, bibleReference, audioUrl, audioDurationSeconds = 0, accentHex = "#7c3aed", iconName = "BookOpen", isFeatured = false, active = true, publishedAt } = body;
    if (!campoId || !title || !summary || !bodyText || !bibleReference) {
      return NextResponse.json({ error: "campoId, title, summary, bodyText e bibleReference são obrigatórios" }, { status: 400 });
    }
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `INSERT INTO app_daily_bread_entries (campo_id, headquarters_id, church_id, audience_scope, title, summary, body_text, bible_reference, audio_url, audio_duration_seconds, accent_hex, icon_name, is_featured, active, published_at)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      campoId, headquartersId || null, churchId || null, audienceScope, title, summary, bodyText, bibleReference, audioUrl || null, audioDurationSeconds, accentHex, iconName, isFeatured, active, publishedAt ? new Date(publishedAt) : new Date()
    );
    return NextResponse.json(serializeBigInts(rows[0]), { status: 201 });
  });
}
