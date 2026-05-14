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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin" && user.profileType !== "campo") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    for (const f of ["evento", "horario", "local", "obs", "ministerio", "mostrar", "reservar", "tipo", "preco", "iconName", "departamento", "audienceScope"]) {
      if (body[f] !== undefined) data[f] = body[f];
    }
    if (body.datareal) { data.datareal = new Date(body.datareal + "T12:00:00Z"); Object.assign(data, parseDateFields(body.datareal)); }
    const updated = await prisma.tbEvento.update({ where: { id }, data });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin" && user.profileType !== "campo") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const { id } = await params;
    await prisma.tbEvento.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  });
}
