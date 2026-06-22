import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { restoreSqlBackup } from "@/lib/backup-helper";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      
      if (!file) {
        return NextResponse.json({ error: "Nenhum arquivo fornecido." }, { status: 400 });
      }
      
      const sql = await file.text();
      const statements = await restoreSqlBackup(sql);
      
      return NextResponse.json({ success: true, statements });
    } catch (error: any) {
      console.error("Local restore failed:", error);
      return NextResponse.json({ error: error?.message || "Erro durante a restauração do backup." }, { status: 500 });
    }
  });
}
