/**
 * Simulação ponta a ponta do Engajamento (fotos do Instagram → rostos →
 * relatório de presença por domingos).
 *
 * Importa o código de produção (src/lib/engajamento/rostos.ts e
 * comparacao.ts) e confere:
 *   1. AGRUPAMENTO — dois rostos parecidos viram a mesma pessoa; um diferente
 *      vira outra; a mesma pessoa em outra publicação cai na pessoa existente.
 *   2. RELATÓRIO — quem aparecia nos domingos de antes e não aparece nos
 *      últimos é AUSENTE; quem aparece nos dois é CONSTANTE; foto de sábado
 *      não conta com "só domingos".
 *   3. CORREÇÕES — juntar duas pessoas soma os cultos; nome dado à pessoa
 *      aparece no relatório.
 *   4. ISOLAMENTO — nada disso aparece no campo Aguaí.
 *
 * Os vetores de rosto são sintéticos (128 números), não de gente real. Grava
 * só nas tabelas engajamento_* com prefixo [E2E] e apaga tudo no fim,
 * inclusive os recortes no storage (--keep preserva).
 *
 * Uso: npx tsx scripts/e2e-engajamento.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

// a lib do storage lê as variáveis na importação: carregar o .env antes
for (const arq of ['.env.local', '.env']) {
  const p = path.resolve(process.cwd(), arq);
  if (!fs.existsSync(p)) continue;
  for (const linha of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const { PrismaClient } = await import('@prisma/client');
const { gravarRostos, juntarPessoas, distancia, LIMIAR } = await import('../src/lib/engajamento/rostos.ts');
const { comparar, classificar } = await import('../src/lib/engajamento/comparacao.ts');
const { supabaseAdmin } = await import('../src/lib/supabase-admin.ts');

const prisma = new PrismaClient();
const KEEP = process.argv.includes('--keep');
const PREFIXO = '[E2E-ENGAJ]';
const CAMPINAS = '7e1cfbf6-f7b5-48d0-8926-7ed272e07e1d';
const AGUAI = 'be2f95ec-cf98-4e81-b4c6-428018b5cbc3';

let falhas = 0;
let passes = 0;
function ok(condicao, descricao, detalhe) {
  if (condicao) { passes += 1; console.log(`  ✓ ${descricao}`); }
  else { falhas += 1; console.log(`  ✗ ${descricao}${detalhe !== undefined ? ` → obtido: ${JSON.stringify(detalhe)}` : ''}`); }
}

// vetores sintéticos: base aleatória normalizada + ruído pequeno
let semente = 7;
const aleatorio = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647 - 0.5; };
const normalizar = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
const vetor = () => normalizar(Array.from({ length: 128 }, aleatorio));
const variar = (v, ruido) => normalizar(v.map((x) => x + aleatorio() * ruido));
// JPEG pequeno e válido, só para o recorte
const { default: sharp } = await import('sharp');
const JPEG = 'data:image/jpeg;base64,' + (await sharp({ create: { width: 8, height: 8, channels: 3, background: '#888' } }).jpeg().toBuffer()).toString('base64');
const rosto = (descritor, imagemIndice = 0) => ({ imagemIndice, descritor, caixa: { x: 1, y: 1, w: 50, h: 50 }, pontuacao: 0.9, foto: JPEG });

const ymd = (d) => d.toISOString().slice(0, 10);
const somar = (dia, n) => { const d = new Date(`${dia}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const hoje = ymd(new Date(Date.now() - 3 * 3_600_000));
const ultimoDomingo = somar(hoje, -new Date(`${hoje}T12:00:00Z`).getUTCDay());
const recIni = somar(ultimoDomingo, -14);
const refFim = somar(recIni, -1);
const refIni = somar(refFim, -83);
const domingoAntigo = somar(recIni, -7);          // domingo na referência
const sabadoAntigo = somar(domingoAntigo, -1);    // sábado na referência
const base = { refIni, refFim, recIni, recFim: hoje, campoId: CAMPINAS };

const publicacoes = [];
async function novaPublicacao(dia) {
  const [p] = await prisma.$queryRawUnsafe(`
    INSERT INTO engajamento_publicacoes (campo_id, origem, tipo, titulo, data_evento, imagens)
    VALUES ($1::uuid, 'MANUAL', 'MANUAL', $2, $3::date, '[]'::jsonb) RETURNING id`, CAMPINAS, `${PREFIXO} ${dia}`, dia);
  publicacoes.push(p.id);
  return p.id;
}

try {
  console.log(`\nAntes: ${refIni}..${refFim} · agora: ${recIni}..${hoje} · domingo antigo ${domingoAntigo}`);
  const [{ n: pessoasAntes }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int n FROM engajamento_pessoas WHERE campo_id = $1::uuid`, CAMPINAS);

  console.log('\n1. Regras puras');
  const ana = vetor();
  const beto = vetor();
  ok(distancia(ana, variar(ana, 0.02)) < LIMIAR, 'mesmo rosto com ruído fica abaixo do limiar');
  ok(distancia(ana, beto) > LIMIAR, 'rostos diferentes ficam acima do limiar', distancia(ana, beto));
  const p = { refIni: '2026-01-01', refFim: '2026-03-31', recIni: '2026-04-01', recFim: '2026-04-30' };
  ok(classificar(5, 0, 0, p) === 'AUSENTE', 'vinha e sumiu = AUSENTE');
  ok(classificar(0, 2, 0, p) === 'NOVO', 'primeira presença = NOVO');

  console.log('\n2. Agrupamento de rostos');
  const pubAntiga = await novaPublicacao(domingoAntigo);
  const r1 = await gravarRostos(CAMPINAS, pubAntiga, [rosto(variar(ana, 0.02)), rosto(variar(beto, 0.02)), rosto(variar(ana, 0.02), 1)]);
  ok(r1.rostos === 3 && r1.pessoasNovas === 2, '3 rostos (Ana 2×, Beto 1×) → 2 pessoas novas', r1);

  const pubRecente = await novaPublicacao(ultimoDomingo);
  const r2 = await gravarRostos(CAMPINAS, pubRecente, [rosto(variar(beto, 0.02))]);
  ok(r2.pessoasNovas === 0, 'Beto em outra publicação cai na pessoa que já existe', r2);

  const pubSabado = await novaPublicacao(sabadoAntigo);
  const carlos = vetor();
  await gravarRostos(CAMPINAS, pubSabado, [rosto(carlos)]);

  const pessoas = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT r.pessoa_id FROM engajamento_rostos r WHERE r.publicacao_id = ANY($1::uuid[])`, publicacoes);
  ok(pessoas.length === 3, 'Ana, Beto e Carlos = 3 pessoas', pessoas.length);
  const [{ id: idAna }] = await prisma.$queryRawUnsafe(`
    SELECT pessoa_id AS id FROM engajamento_rostos WHERE publicacao_id = $1::uuid AND imagem_indice = 1`, pubAntiga);
  const [{ id: idBeto }] = await prisma.$queryRawUnsafe(`
    SELECT pessoa_id AS id FROM engajamento_rostos WHERE publicacao_id = $1::uuid`, pubRecente);

  const refazer = await gravarRostos(CAMPINAS, pubRecente, [rosto(variar(beto, 0.02))]);
  const [{ n: rostosRecente }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int n FROM engajamento_rostos WHERE publicacao_id = $1::uuid`, pubRecente);
  ok(refazer.pessoasNovas === 0 && rostosRecente === 1, 'analisar de novo a mesma publicação não duplica rosto');

  console.log('\n3. Relatório por domingos');
  await prisma.$executeRawUnsafe(`UPDATE engajamento_pessoas SET nome = $2 WHERE id = $1::uuid`, idAna, `${PREFIXO} Ana`);
  const dom = await comparar({ ...base, soDomingos: true });
  const linhaAna = dom.find((l) => l.pessoaId === idAna);
  const linhaBeto = dom.find((l) => l.pessoaId === idBeto);
  ok(linhaAna?.situacao === 'AUSENTE' && linhaAna?.diasRef === 1 && linhaAna?.diasRec === 0, 'Ana: domingo antigo e nada agora = AUSENTE', linhaAna);
  ok(linhaAna?.nome === `${PREFIXO} Ana`, 'nome dado à pessoa aparece no relatório');
  ok(linhaBeto?.situacao === 'CONSTANTE' && linhaBeto?.diasRec === 1, 'Beto: antes e agora = CONSTANTE', linhaBeto);
  ok(!dom.some((l) => l.diasRef > 0 && l.ultimaPresenca === sabadoAntigo), 'foto de sábado não conta com "só domingos"');
  const todos = await comparar({ ...base, soDomingos: false });
  ok(todos.some((l) => l.ultimaPresenca === sabadoAntigo), 'sem "só domingos" a foto de sábado conta');

  console.log('\n4. Juntar pessoas');
  await juntarPessoas(CAMPINAS, idAna, idBeto, null);
  const junto = (await comparar({ ...base, soDomingos: true })).find((l) => l.pessoaId === idAna);
  ok(junto && junto.diasRef === 1 && junto.diasRec === 1 && junto.situacao === 'CONSTANTE', 'Ana+Beto juntos: 1 antes, 1 agora', junto);
  const [{ n: betoExiste }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int n FROM engajamento_pessoas WHERE id = $1::uuid`, idBeto);
  ok(betoExiste === 0, 'a pessoa juntada deixa de existir');

  console.log('\n5. Isolamento por campo');
  const aguai = await comparar({ ...base, campoId: AGUAI, soDomingos: false });
  ok(!aguai.some((l) => l.pessoaId === idAna), 'pessoa de Campinas não aparece em Aguaí');

  const [{ n: pessoasDepois }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int n FROM engajamento_pessoas WHERE campo_id = $1::uuid`, CAMPINAS);
  console.log(`\n  (pessoas no campo: antes do teste ${pessoasAntes}, agora ${pessoasDepois})`);
} catch (e) {
  falhas += 1;
  console.error('ERRO:', e);
} finally {
  if (!KEEP && publicacoes.length) {
    const ids = (await prisma.$queryRawUnsafe(`SELECT DISTINCT pessoa_id AS id FROM engajamento_rostos WHERE publicacao_id = ANY($1::uuid[]) AND pessoa_id IS NOT NULL`, publicacoes)).map((r) => r.id);
    await prisma.$executeRawUnsafe(`DELETE FROM engajamento_publicacoes WHERE id = ANY($1::uuid[])`, publicacoes);
    if (ids.length) await prisma.$executeRawUnsafe(`DELETE FROM engajamento_pessoas WHERE id = ANY($1::uuid[])`, ids);
    const recortes = [];
    for (const pub of publicacoes) {
      const { data } = await supabaseAdmin.storage.from('dados').list(`engajamento/${CAMPINAS}`, { search: `rosto_${pub}` });
      recortes.push(...(data ?? []).map((f) => `engajamento/${CAMPINAS}/${f.name}`));
    }
    if (recortes.length) await supabaseAdmin.storage.from('dados').remove(recortes);
    const [{ n: sobrou }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int n FROM engajamento_rostos WHERE publicacao_id = ANY($1::uuid[])`, publicacoes);
    console.log(`\nLimpeza: ${publicacoes.length} publicações, ${ids.length} pessoas e ${recortes.length} recortes apagados; rostos restantes = ${sobrou}`);
  }
  await prisma.$disconnect();
  console.log(`\n${passes} ok, ${falhas} falha(s)`);
  process.exit(falhas ? 1 : 0);
}
