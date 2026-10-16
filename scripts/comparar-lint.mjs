/**
 * Compara o lint de arquivos entre o commit atual (HEAD) e a cópia de
 * trabalho, por arquivo relativo + regra. Usado para provar que uma marcação
 * em massa não introduz problema novo.
 *
 *   node scripts/comparar-lint.mjs <arquivo> [...]
 * Sai com erro se alguma (arquivo, regra) piorar.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const arquivos = process.argv.slice(2);
if (!arquivos.length) { console.error('informe os arquivos'); process.exit(1); }

function contar(raiz, lista) {
  let saida = '[]';
  try {
    saida = execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['eslint', '-f', 'json', ...lista], { cwd: raiz, encoding: 'utf8', maxBuffer: 1 << 28, shell: process.platform === 'win32' });
  } catch (e) {
    saida = e.stdout || '[]'; // eslint sai com 1 quando há erro de lint
  }
  const c = {};
  for (const f of JSON.parse(saida)) {
    const rel = path.relative(raiz, f.filePath).split(path.sep).join('/');
    for (const m of f.messages) {
      const k = `${rel} ${m.ruleId ?? '(parse)'}`;
      c[k] = (c[k] ?? 0) + 1;
    }
  }
  return c;
}

// Cópia do HEAD com os mesmos arquivos (só eles), num diretório temporário
// dentro do projeto, para o eslint achar a mesma configuração.
const tmp = fs.mkdtempSync(path.join(process.cwd(), '.tmp-lint-'));
try {
  for (const a of arquivos) {
    const destino = path.join(tmp, a);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, execFileSync('git', ['show', `HEAD:${a}`], { encoding: 'utf8', maxBuffer: 1 << 28 }));
  }
  const antes = contar(process.cwd(), arquivos.map((a) => path.relative(process.cwd(), path.join(tmp, a))));
  const antesNorm = {};
  for (const [k, v] of Object.entries(antes)) antesNorm[k.replace(/^\.tmp-lint-[^/]+\//, '')] = v;
  const depois = contar(process.cwd(), arquivos);
  const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  console.log(`lint HEAD: ${total(antesNorm)} | agora: ${total(depois)}`);
  const pioras = [...new Set([...Object.keys(antesNorm), ...Object.keys(depois)])].filter((k) => (depois[k] ?? 0) > (antesNorm[k] ?? 0));
  for (const k of pioras) console.log(`  PIOROU ${k}: ${antesNorm[k] ?? 0} → ${depois[k]}`);
  if (pioras.length) process.exitCode = 1;
  else console.log('nenhum (arquivo, regra) piorou');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
