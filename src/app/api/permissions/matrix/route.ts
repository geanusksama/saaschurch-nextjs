import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    try {
      const row = await prisma.setting.findFirst({
        where: { settingKey: "permissions_matrix", churchId: null },
      });
      if (!row?.settingValue) return NextResponse.json(null);
      return NextResponse.json(JSON.parse(row.settingValue as string));
    } catch {
      return NextResponse.json(null);
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master") {
      return NextResponse.json({ error: "Apenas o master pode salvar a matriz de permissões." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const serialized = JSON.stringify(body);
    await prisma.setting.upsert({
      where: { settingKey_churchId: { settingKey: "permissions_matrix", churchId: null } },
      update: { settingValue: serialized },
      create: { settingKey: "permissions_matrix", churchId: null, settingValue: serialized },
    });
    return NextResponse.json({ success: true });
  });
}
