/**
 * Aplica a migration 20260730_secretaria_campaigns.sql.
 *
 * O supabase-js não dá conta de DDL; o caminho que funciona neste projeto é
 * `prisma.$executeRawUnsafe`, statement a statement.
 *
 *   npx tsx scripts/apply-secretaria-campaigns.mjs
 */

import { readFileSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });

const prisma = new PrismaClient();
const sql = readFileSync('supabase/migrations/20260730_secretaria_campaigns.sql', 'utf8');

// separa por ';' no fim da linha, ignorando comentários soltos
const statements = sql
  .split(/;\s*$/m)
  .map(s => s.trim())
  .filter(s => s && !s.split('\n').every(l => l.trim().startsWith('--') || !l.trim()));

let ok = 0;
let falhou = 0;

for (const [i, stmt] of statements.entries()) {
  const rotulo = stmt.split('\n').find(l => l.trim() && !l.trim().startsWith('--'))?.slice(0, 70) ?? `stmt ${i}`;
  try {
    await prisma.$executeRawUnsafe(stmt);
    ok++;
    console.log(`  ok   ${rotulo}`);
  } catch (e) {
    falhou++;
    console.error(`  FALHA ${rotulo}\n        ${e.message.split('\n')[0]}`);
  }
}

console.log(`\nRESULTADO: ${ok} aplicados · ${falhou} falharam`);
await prisma.$disconnect();
process.exit(falhou ? 1 : 0);
