import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { backupsDir, formatBytes, listCloudBackups, BackupEntry } from "@/lib/backup-helper";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }
      
      const localFiles = fs.readdirSync(backupsDir).filter(f => f.endsWith(".sql"));
      const cloudBackups = await listCloudBackups().catch(() => []);
      const cloudBackupNames = new Set(cloudBackups.map(c => c.name));
      
      const backups: BackupEntry[] = localFiles.map(filename => {
        const filePath = path.join(backupsDir, filename);
        const stats = fs.statSync(filePath);
        const hasCloud = cloudBackupNames.has(filename);
        
        return {
          id: filename,
          filename,
          date: stats.mtime.toISOString(),
          size: formatBytes(stats.size),
          type: "Manual",
          status: "Sucesso",
          duration: "1s",
          cloudPath: hasCloud ? `backups/${filename}` : undefined,
        };
      });
      
      // Sort by date descending
      backups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      return NextResponse.json(backups);
    } catch (error: any) {
      console.error("List backups failed:", error);
      return NextResponse.json({ error: error?.message || "Erro ao listar backups." }, { status: 500 });
    }
  });
}
