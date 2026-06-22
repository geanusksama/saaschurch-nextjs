import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { restoreSqlBackup } from "@/lib/backup-helper";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const body = await req.json().catch(() => ({}));
      const { path } = body;
      
      if (!path) {
        return NextResponse.json({ error: "Caminho do arquivo na nuvem não fornecido." }, { status: 400 });
      }
      
      const { data, error } = await supabaseAdmin.storage
        .from("dados")
        .download(path);
        
      if (error || !data) {
        console.error("Download from Supabase failed:", error);
        return NextResponse.json({ error: "Erro ao baixar arquivo do Supabase Storage." }, { status: 400 });
      }
      
      const sql = await data.text();
      const statements = await restoreSqlBackup(sql);
      
      return NextResponse.json({ success: true, statements });
    } catch (error: any) {
      console.error("Cloud restore failed:", error);
      return NextResponse.json({ error: error?.message || "Erro durante a restauração do backup." }, { status: 500 });
    }
  });
}
