import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const date = new URL(req.url).searchParams.get("date");
    if (date) {
      const note = await prisma.userNote.findUnique({
        where: { userId_date: { userId: user.id, date } },
      });
      return NextResponse.json(note ?? { content: "" });
    }
    const notes = await prisma.userNote.findMany({
      where: { userId: user.id },
      select: { date: true },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(notes);
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { date, content } = await req.json().catch(() => ({}));
    if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });
    const note = await prisma.userNote.upsert({
      where: { userId_date: { userId: user.id, date } },
      update: { content: content ?? "", updatedAt: new Date() },
      create: { userId: user.id, date, content: content ?? "" },
    });
    return NextResponse.json(note);
  });
}
