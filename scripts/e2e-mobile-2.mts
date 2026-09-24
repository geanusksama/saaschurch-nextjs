/**
 * E2E do painel Mobile — jogos sem JSON, categorias, filtros/período/página.
 * Banco do .env (REFERÊNCIA/produção). O que cria é inativo/não publicado e
 * sai no fim, mesmo com falha.
 *
 *   npx tsx scripts/e2e-mobile-2.mts
 */
import { prisma } from '../src/lib/prisma';
import { montarCruzada, palavrasDaCruzada } from '../src/lib/mobile/jogoDados';
import { atualizar, criar, excluir, listar } from '../src/lib/mobile/recursosServidor';

const campo = (await prisma.campo.findFirst({ where: { name: 'Campinas' }, select: { id: true } }))!.id;
const ctx = { campoId: campo, igreja: null };
let falhas = 0;
const ok = (m: string) => console.log('OK   ', m);
const falha = (m: string) => { falhas++; console.log('FALHA', m); };
async function espera(nome: string, f: () => Promise<unknown>, trecho: string) {
  try { await f(); falha(`${nome}: devia recusar`); } catch (e) {
    (e as Error).message.includes(trecho) ? ok(`${nome} recusado: "${(e as Error).message}"`) : falha(`${nome}: ${(e as Error).message}`);
  }
}
const lixo: { tabela: 'jogo' | 'cat' | 'prod'; id: string }[] = [];

try {
  // 1) cruzada do seed: desmontar em palavras e remontar dá a mesma grade
  const seed = await prisma.appV3JogoConteudo.findFirst({ where: { campoId: campo, jogo: 'CRUZADAS' } });
  if (seed) {
    const d = seed.dados as Record<string, unknown>;
    const pal = palavrasDaCruzada(d);
    const r = montarCruzada(pal);
    const igual = JSON.stringify(r.dados?.grade) === JSON.stringify(d.grade) && JSON.stringify(r.dados?.numeros) === JSON.stringify(d.numeros);
    igual ? ok(`cruzada do seed remontada igual (${pal.map((p) => p.palavra).join(', ')})`) : falha(`cruzada remontada difere: ${JSON.stringify(r)}`);
  }
  const conflito = montarCruzada([
    { palavra: 'PEDRO', dica: 'a', direcao: 'H', linha: 1, coluna: 1 },
    { palavra: 'MARIA', dica: 'b', direcao: 'V', linha: 1, coluna: 1 },
  ]);
  conflito.erro?.includes('letra diferente') ? ok('cruzamento com letra diferente recusado') : falha('conflito não detectado');

  // 2) jogos pelo formulário (sem JSON digitado)
  const q = await criar('jogos', { jogo: 'QUIZ', ativo: false, dados: { pergunta: 'E2E?', opcoes: ['a', 'b', 'c', 'd'], correta: 2 } }, ctx);
  lixo.push({ tabela: 'jogo', id: String(q.id) });
  const qd = (await prisma.appV3JogoConteudo.findUnique({ where: { id: String(q.id) } }))!.dados as Record<string, unknown>;
  qd.correta === 2 && (qd.opcoes as string[]).length === 4 ? ok('quiz gravado no formato do app') : falha(`quiz: ${JSON.stringify(qd)}`);
  await espera('quiz sem alternativa', () => criar('jogos', { jogo: 'QUIZ', ativo: false, dados: { pergunta: 'x', opcoes: ['a', '', 'c', 'd'], correta: 0 } }, ctx), 'alternativas');
  const cz = await criar('jogos', { jogo: 'CRUZADAS', ativo: false, dados: { palavras: [
    { palavra: 'Pedro', dica: 'Apóstolo', direcao: 'H', linha: 1, coluna: 1 },
    { palavra: 'Paulo', dica: 'Romanos', direcao: 'V', linha: 1, coluna: 1 },
  ] } }, ctx);
  lixo.push({ tabela: 'jogo', id: String(cz.id) });
  const czd = (await prisma.appV3JogoConteudo.findUnique({ where: { id: String(cz.id) } }))!.dados as Record<string, unknown>;
  (czd.grade as string[])[0] === 'PEDRO' && (czd.verticais as string[])[0] === '1. Romanos' ? ok(`cruzada montada: ${(czd.grade as string[]).join('/')}`) : falha(`cruzada: ${JSON.stringify(czd)}`);

  // 3) categorias
  const cat = await criar('categorias-produto', { nome: 'E2E Categoria', ativo: false }, ctx);
  lixo.push({ tabela: 'cat', id: String(cat.id) });
  await espera('categoria repetida', () => criar('categorias-produto', { nome: 'e2e categoria' }, ctx), 'Unique');
  const prod = await criar('produtos', { nome: 'E2E Produto', preco: '1', categoria: 'e2e CATEGORIA', ativo: false }, ctx);
  lixo.push({ tabela: 'prod', id: String(prod.id) });
  prod.categoria === 'E2E Categoria' ? ok('produto usa a grafia do cadastro') : falha(`categoria gravada: ${prod.categoria}`);
  await espera('categoria inexistente', () => criar('produtos', { nome: 'x', preco: '1', categoria: 'Não existe', ativo: false }, ctx), 'não está cadastrada');
  await atualizar('categorias-produto', String(cat.id), { nome: 'E2E Renomeada' }, ctx);
  const p2 = await prisma.appV3Produto.findUnique({ where: { id: String(prod.id) } });
  p2?.categoria === 'E2E Renomeada' ? ok('renomear categoria atualizou o produto') : falha(`produto ficou com ${p2?.categoria}`);
  await espera('excluir categoria em uso', () => excluir('categorias-produto', String(cat.id), ctx), 'em uso');

  // 4) filtros, período e tamanho de página
  const pag = await listar('jogos', ctx, new URLSearchParams({ pageSize: '10', f_jogo: 'QUIZ' }));
  pag.pageSize === 10 && pag.linhas.every((l: Record<string, unknown>) => l.jogo === 'QUIZ') ? ok(`filtro + 10 por página (${pag.total} quiz)`) : falha('filtro/página');
  const ev = await listar('eventos', ctx, new URLSearchParams({ de: '2026-11-01', ate: '2026-11-30' }));
  ev.linhas.every((l: Record<string, unknown>) => { const t = new Date(l.inicio as string).getTime(); return t >= Date.parse('2026-11-01T03:00:00Z') && t < Date.parse('2026-12-01T03:00:00Z'); }) ? ok(`período de novembro: ${ev.total} evento(s)`) : falha('período');
  const pub = await listar('eventos', ctx, new URLSearchParams({ f_publicado: 'true' }));
  pub.linhas.every((l: Record<string, unknown>) => l.publicado === true) ? ok(`filtro publicado: ${pub.total}`) : falha('filtro bool');
} catch (e) {
  falha(`inesperado: ${(e as Error).message}`);
} finally {
  for (const l of lixo.reverse()) {
    if (l.tabela === 'jogo') await prisma.appV3JogoConteudo.delete({ where: { id: l.id } }).catch(() => {});
    if (l.tabela === 'prod') await prisma.appV3Produto.delete({ where: { id: l.id } }).catch(() => {});
    if (l.tabela === 'cat') await prisma.appV3Categoria.delete({ where: { id: l.id } }).catch(() => {});
  }
  await prisma.$disconnect();
}
console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
