/**
 * E2E do painel Mobile (src/lib/mobile) contra o banco do .env — que é o de
 * REFERÊNCIA/produção. Lê todos os recursos no campo informado e faz um ciclo
 * criar → editar → excluir numa notícia NÃO publicada (o app não mostra), que
 * é apagada no fim mesmo se algo falhar.
 *
 *   npx tsx scripts/e2e-mobile.mts [campoId]
 */
import { prisma } from '../src/lib/prisma';
import { RECURSOS } from '../src/lib/mobile/definicoes';
import { atualizar, criar, excluir, listar, obter } from '../src/lib/mobile/recursosServidor';

const campo = process.argv[2] ?? (await prisma.campo.findFirst({ where: { name: 'Campinas' }, select: { id: true } }))?.id;
if (!campo) throw new Error('campo não encontrado');
const ctx = { campoId: campo, igreja: null };
let falhas = 0;

for (const chave of Object.keys(RECURSOS)) {
  const def = RECURSOS[chave];
  if (def.pai) continue;
  try {
    const p = await listar(chave, ctx, new URLSearchParams());
    let det = '';
    if (p.linhas[0]) { await obter(chave, String(p.linhas[0].id), ctx); det = ' + detalhe'; }
    for (const f of def.filhos ?? []) {
      if (p.linhas[0]) { const fp = await listar(f, ctx, new URLSearchParams({ pai: String(p.linhas[0].id), tudo: '1' })); det += ` + ${f}(${fp.total})`; }
    }
    console.log('OK  ', chave.padEnd(18), `${p.total} registros${det}`);
  } catch (e) {
    falhas++;
    console.log('FALHA', chave, (e as Error).message);
  }
}

let id: string | null = null;
try {
  const n = await criar('noticias', { titulo: 'E2E painel Mobile — apagar', publicado: false, corpo: 'teste' }, ctx);
  id = String(n.id);
  const u = (await atualizar('noticias', id, { titulo: 'E2E editado', tag: 'teste' }, ctx)) as Record<string, unknown>;
  if (u.titulo !== 'E2E editado' || u.publicado !== false) throw new Error('edição não gravou');
  // escopo: outro campo não enxerga
  const outro = await prisma.campo.findFirst({ where: { id: { not: campo }, deletedAt: null }, select: { id: true } });
  if (outro) {
    try { await obter('noticias', id, { campoId: outro.id, igreja: null }); throw new Error('VAZOU para outro campo'); }
    catch (e) { if ((e as Error).message.includes('VAZOU')) throw e; }
  }
  // lista branca: não aceita trocar o campo pelo corpo
  await atualizar('noticias', id, { campoId: outro?.id, escopo: 'MUNDIAL' }, ctx);
  const r = await prisma.appV3Noticia.findUnique({ where: { id } });
  if (r?.campoId !== campo || r?.escopo !== 'CAMPO') throw new Error('corpo conseguiu trocar campo/escopo');
  await excluir('noticias', id, ctx);
  id = null;
  console.log('OK   ciclo criar/editar/escopo/lista-branca/excluir em noticias');
} catch (e) {
  falhas++;
  console.log('FALHA ciclo:', (e as Error).message);
} finally {
  if (id) await prisma.appV3Noticia.delete({ where: { id } }).catch(() => {});
  await prisma.$disconnect();
}
console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
