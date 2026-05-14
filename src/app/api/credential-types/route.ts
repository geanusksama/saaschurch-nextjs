import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

const CREDENTIAL_TYPES = [
  "Credencial de Membro",
  "Credencial de Cooperador",
  "Credencial de Cooperadora",
  "Credencial de Diacono",
  "Credencial de Diaconisa",
  "Credencial de Presbitero",
  "Credencial de Evangelista",
  "Credencial de Pastor",
  "Credencial de Pastora",
  "Credencial de Missionário",
  "Credencial de Missionária",
  "Carteirinha de Membro",
];

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    return NextResponse.json(CREDENTIAL_TYPES);
  });
}
