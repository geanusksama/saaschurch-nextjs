import { prisma } from "./prisma";
import { supabaseAdmin } from "./supabase-admin";
import fs from "fs";
import path from "path";

export const backupsDir = path.join(process.cwd(), "backups");

// Ensure local backups directory exists
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

export interface BackupEntry {
  id: string;
  filename: string;
  date: string;
  size: string;
  type: string;
  status: string;
  duration: string;
  cloudPath?: string;
}

export interface CloudBackup {
  name: string;
  path: string;
  size: string;
  date: string;
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function formatValue(val: any, dataType: string): string {
  if (val === null || val === undefined) {
    return "NULL";
  }
  if (Array.isArray(val)) {
    const elements = val.map(item => {
      if (item === null || item === undefined) return "NULL";
      if (typeof item === "boolean") return item ? "true" : "false";
      if (typeof item === "number") return String(item);
      const str = item instanceof Date ? item.toISOString() : String(item);
      return `'${str.replace(/'/g, "''")}'`;
    });
    return `ARRAY[${elements.join(", ")}]`;
  }
  if (dataType === "boolean") {
    return val ? "true" : "false";
  }
  if (["integer", "bigint", "smallint", "numeric", "double precision", "real"].includes(dataType)) {
    return String(val);
  }
  if (dataType === "jsonb" || dataType === "json") {
    const jsonStr = typeof val === "string" ? val : JSON.stringify(val);
    const escaped = jsonStr.replace(/'/g, "''");
    return `'${escaped}'::jsonb`;
  }
  if (dataType === "bytea") {
    if (Buffer.isBuffer(val)) {
      return `\'\\\\x${val.toString("hex")}\'`;
    }
    if (val && typeof val === "object" && val.type === "Buffer" && Array.isArray(val.data)) {
      return `\'\\\\x${Buffer.from(val.data).toString("hex")}\'`;
    }
    return "NULL";
  }
  
  const str = val instanceof Date ? val.toISOString() : String(val);
  const escaped = str.replace(/'/g, "''");
  return `'${escaped}'`;
}

/**
 * Generates SQL script containing database truncate and insert statements.
 */
export async function generateSqlBackup(): Promise<string> {
  // Query all tables in public schema except migrations
  const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE '_prisma_migrations'
    ORDER BY table_name;
  `);

  let sql = "";
  sql += `-- SaaSChurch Database Backup\n`;
  sql += `-- Generated at: ${new Date().toISOString()}\n\n`;
  sql += `BEGIN;\n`;
  sql += `SET session_replication_role = 'replica';\n\n`;

  // Truncate all tables
  sql += `-- Truncate tables\n`;
  for (const t of tables) {
    sql += `TRUNCATE TABLE "${t.table_name}" CASCADE;\n`;
  }
  sql += `\n`;

  // Dump data
  for (const t of tables) {
    const tableName = t.table_name;
    const columns = await prisma.$queryRawUnsafe<{ column_name: string; data_type: string }[]>(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = $1
        AND data_type <> 'tsvector'
        AND (is_generated IS NULL OR is_generated <> 'ALWAYS')
      ORDER BY ordinal_position;
    `, tableName);

    if (columns.length === 0) continue;

    const colNames = columns.map(c => `"${c.column_name}"`).join(", ");
    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT ${colNames} FROM "${tableName}";`);

    if (rows.length > 0) {
      sql += `-- Data for ${tableName} (${rows.length} rows)\n`;
      for (const row of rows) {
        const values = columns.map(col => formatValue(row[col.column_name], col.data_type));
        sql += `INSERT INTO "${tableName}" (${colNames}) VALUES (${values.join(", ")});\n`;
      }
      sql += `\n`;
    }
  }

  sql += `SET session_replication_role = 'origin';\n`;
  sql += `COMMIT;\n`;

  return sql;
}

/**
 * Restores the SQL script into the database.
 */
export async function restoreSqlBackup(sql: string): Promise<number> {
  const statementsCount = (sql.match(/INSERT INTO|TRUNCATE TABLE/g) || []).length;
  await prisma.$executeRawUnsafe(sql);
  return statementsCount;
}

/**
 * Lists all backups from the Supabase Cloud Storage.
 */
export async function listCloudBackups(): Promise<CloudBackup[]> {
  const { data, error } = await supabaseAdmin.storage.from("dados").list("backups");
  if (error || !data) return [];
  
  return data
    .filter(f => f.name.endsWith(".sql"))
    .map(f => ({
      name: f.name,
      path: `backups/${f.name}`,
      size: formatBytes(f.metadata?.size || 0),
      date: f.created_at || new Date().toISOString(),
    }));
}
