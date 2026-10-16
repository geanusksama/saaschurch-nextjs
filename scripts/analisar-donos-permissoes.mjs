/**
 * Relatório de quem guarda cada arquivo de tela (ver scripts/lib/donos.mjs).
 *
 *   node scripts/analisar-donos-permissoes.mjs [--saida=<json>] [--rotas]
 */
import fs from 'node:fs';
import { analisarDonos } from './lib/donos.mjs';

const { arquivos, rotasSemMenu } = analisarDonos();
const saida = process.argv.find((a) => a.startsWith('--saida='));
if (saida) fs.writeFileSync(saida.slice(8), JSON.stringify(arquivos, null, 1));

const vals = Object.values(arquivos);
console.log('arquivos alcançados:', vals.length, '| públicos:', vals.filter((v) => v.publico).length);
console.log('  painel, 1 dono, sem rota livre:', vals.filter((v) => !v.publico && v.donos.length === 1 && !v.rotasSemTrava.length).length);
console.log('  painel, vários donos:', vals.filter((v) => !v.publico && v.donos.length > 1).length);
console.log('  painel, com rota sem trava:', vals.filter((v) => !v.publico && v.rotasSemTrava.length).length);
const sem = rotasSemMenu.filter((r) => !r.dono);
console.log(`rotas sem trava no menu: ${rotasSemMenu.length} — entrada resolvida: ${rotasSemMenu.length - sem.length}, sem entrada única: ${sem.length}`);
if (process.argv.includes('--rotas')) {
  for (const r of rotasSemMenu) console.log(`  ${r.dono ? 'OK ' : '-- '} ${r.rota}${r.tipo ? '  ← ' + r.tipo : ''}`);
}
