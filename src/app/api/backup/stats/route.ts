import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { backupsDir } from "@/lib/backup-helper";
import fs from "fs";
import path from "path";

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "Agora mesmo";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }
      
      const localFiles = fs.readdirSync(backupsDir).filter(f => f.endsWith(".sql"));
      let totalSize = 0;
      let lastBackupDate: Date | null = null;
      
      for (const filename of localFiles) {
        const filePath = path.join(backupsDir, filename);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
        
        if (!lastBackupDate || stats.mtime > lastBackupDate) {
          lastBackupDate = stats.mtime;
        }
      }
      
      const totalSizeGB = (totalSize / (1024 * 1024 * 1024)).toFixed(3);
      const lastBackupAge = lastBackupDate ? getTimeAgo(lastBackupDate) : "Nenhum backup";
      
      return NextResponse.json({
        total: localFiles.length,
        totalSizeGB,
        lastBackupAge,
        nextBackup: "Agendado",
      });
    } catch (error: any) {
      console.error("Backup stats failed:", error);
      return NextResponse.json({ error: error?.message || "Erro ao obter estatísticas." }, { status: 500 });
    }
  });
}
