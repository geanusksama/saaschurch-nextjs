import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { generateSqlBackup, backupsDir } from "@/lib/backup-helper";
import { supabaseAdmin } from "@/lib/supabase-admin";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const body = await req.json().catch(() => ({}));
      const cloudStorage = body.cloudStorage === true;
      
      const startTime = Date.now();
      const sql = await generateSqlBackup();
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(1) + "s";
      
      const now = new Date();
      // Format YYYY-MM-DD_HHMMSS
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timestamp = `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
      
      const filename = `backup_${timestamp}.sql`;
      
      // Save locally
      const localPath = path.join(backupsDir, filename);
      fs.writeFileSync(localPath, sql, "utf-8");
      
      let cloudPath: string | undefined = undefined;
      
      if (cloudStorage) {
        const { error } = await supabaseAdmin.storage
          .from("dados")
          .upload(`backups/${filename}`, Buffer.from(sql), {
            contentType: "text/plain",
            upsert: true,
          });
        
        if (error) {
          console.error("Supabase backup upload failed:", error);
        } else {
          cloudPath = `backups/${filename}`;
        }
      }
      
      return NextResponse.json({
        success: true,
        filename,
        cloudPath,
        duration,
        size: sql.length,
      });
    } catch (error: any) {
      console.error("Create backup failed:", error);
      return NextResponse.json({ error: error?.message || "Erro ao criar backup." }, { status: 500 });
    }
  });
}
