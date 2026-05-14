import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function parseDateFields(datareal: string) {
  const d = new Date(datareal + "T12:00:00Z");
  return { dia: d.getUTCDate(), mes: MONTHS_PT[d.getUTCMonth()], ano: d.getUTCFullYear(), diaSemana: WEEKDAYS_PT[d.getUTCDay()] };
}

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const { searchParams } = new URL(req.url);
    const campoId = searchParams.get("campoId");
    const year = searchParams.get("year");
    const where: Record<string, unknown> = {};
    if (campoId) where.campoId = campoId;
    if (year) where.ano = Number(year);
    const events = await prisma.tbEvento.findMany({ where, orderBy: [{ datareal: "asc" }] });
    return NextResponse.json(serializeBigInts(events));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin" && user.profileType !== "campo") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const { evento, datareal, horario, local, obs, ministerio, mostrar = true, reservar = false, tipo = "gratuito", preco = 0, iconName, campoId, departamento, audienceScope = "headquarters" } = body;
    if (!evento || !datareal || !campoId) return NextResponse.json({ error: "evento, datareal e campoId são obrigatórios" }, { status: 400 });
    const dateFields = parseDateFields(datareal);
    const created = await prisma.tbEvento.create({
      data: { evento, datareal: new Date(datareal + "T12:00:00Z"), ...dateFields, horario: horario || null, local: local || null, obs: obs || null, ministerio: ministerio || null, mostrar, reservar, tipo, preco, iconName: iconName || null, campoId, departamento: departamento || null, audienceScope },
    });
    return NextResponse.json(serializeBigInts(created), { status: 201 });
  });
}
