import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { backupsDir } from "@/lib/backup-helper";
import { supabaseAdmin } from "@/lib/supabase-admin";
import fs from "fs";
import path from "path";

const NOT_SUPPORTED = { error: "Operação não suportada nesta rota." };

export async function GET(req: NextRequest) {
  return withAuth(req, async () => NextResponse.json(NOT_SUPPORTED, { status: 405 }));
}

export async function POST(req: NextRequest) {
  return withAuth(req, async () => NextResponse.json(NOT_SUPPORTED, { status: 405 }));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  return withAuth(req, async () => {
    try {
      const { filename } = await params;
      const localPath = path.join(backupsDir, filename);
      
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
      
      // Also try to delete from Supabase storage
      await supabaseAdmin.storage
        .from("dados")
        .remove([`backups/${filename}`]);
        
      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error("Delete backup failed:", error);
      return NextResponse.json({ error: error?.message || "Erro ao excluir backup." }, { status: 500 });
    }
  });
}
