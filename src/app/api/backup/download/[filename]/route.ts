import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { backupsDir } from "@/lib/backup-helper";
import { supabaseAdmin } from "@/lib/supabase-admin";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  return withAuth(req, async () => {
    try {
      const { filename } = await params;
      const localPath = path.join(backupsDir, filename);
      
      let fileBuffer: Buffer;
      
      if (fs.existsSync(localPath)) {
        fileBuffer = fs.readFileSync(localPath);
      } else {
        // Fallback to cloud
        const { data, error } = await supabaseAdmin.storage
          .from("dados")
          .download(`backups/${filename}`);
          
        if (error || !data) {
          return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
        }
        
        fileBuffer = Buffer.from(await data.arrayBuffer());
      }
      
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } catch (error: any) {
      console.error("Download backup failed:", error);
      return NextResponse.json({ error: error?.message || "Erro ao baixar backup." }, { status: 500 });
    }
  });
}
