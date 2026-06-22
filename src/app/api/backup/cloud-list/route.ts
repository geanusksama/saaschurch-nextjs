import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { listCloudBackups } from "@/lib/backup-helper";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const cloudBackups = await listCloudBackups();
      return NextResponse.json(cloudBackups);
    } catch (error: any) {
      console.error("List cloud backups failed:", error);
      return NextResponse.json({ error: error?.message || "Erro ao listar backups na nuvem." }, { status: 500 });
    }
  });
}
