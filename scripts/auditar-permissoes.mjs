/**
 * PREMISSA do repositório: todo recurso novo de tela entra na árvore de
 * componentes e permissões. Ver AGENTS.md e
 * docs/modules/permissoes-granulares/SPEC.md.
 *
 * Este script conta, por arquivo, os botões de AÇÃO (salvar, excluir,
 * exportar, imprimir, novo, editar, aprovar...) que não estão dentro de um
 * <Permissao>. A contagem de hoje fica em scripts/permissoes-pendentes.json.
 *
 *   --check     (build/CI) falha se algum arquivo tiver MAIS botões sem
 *               marcação que a foto — ou seja, se entrou botão novo sem
 *               <Permissao>. Arquivo que melhorou não falha.
 *   --atualizar regrava a foto. Só aceita reduzir: se algum arquivo piorou,
 *               recusa (marque o botão em vez de "aceitar" a piora).
 *   (sem flag)  relatório dos pendentes, do maior para o menor.
 *
 * Detecção por texto (o script lê o código, não executa): um <button> conta
 * como ação quando o texto visível, o title/aria-label ou o nome do handler
 * do onClick tem uma das palavras de ação. Botão sem texto literal e sem
 * handler com nome claro escapa — por isso a revisão continua obrigatória.
 */
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.cwd();
const SRC = path.join(RAIZ, 'src');
const FOTO = path.join(RAIZ, 'scripts', 'permissoes-pendentes.json');
const CHECK = process.argv.includes('--check');
const ATUALIZAR = process.argv.includes('--atualizar');

const PALAVRAS =
  /\b(Salvar|Atualizar modelo|Excluir|Remover|Apagar|Exportar|Imprimir|Excel|PDF|CSV|Baixar|Download|Importar|Novo|Nova|Adicionar|Cadastrar|Criar|Editar|Duplicar|Aprovar|Reprovar|Recusar|Enviar|Gerar|Lançar|Estornar|Conciliar|Transferir|Publicar)\b/i;
const HANDLER =
  /onClick=\{[^}]*\b(handle)?(save|salvar|delete|excluir|remove|remover|export|exportar|print|imprimir|download|baixar|import|importar|create|criar|novo|add|adicionar|edit|editar|duplicate|duplicar|approve|aprovar|reject|reprovar|send|enviar|gerar|generate|lancar|estornar)/i;

function arquivos(dir) {
  const saida = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) saida.push(...arquivos(p));
    else if (e.name.endsWith('.tsx')) saida.push(p);
  }
  return saida;
}

function semComentarios(txt) {
  return txt
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, ' '));
}

/** Botões de ação fora de <Permissao> no arquivo. */
function pendentesDe(txt) {
  let n = 0;
  for (const m of txt.matchAll(/<button\b[\s\S]*?<\/button>/g)) {
    const bloco = m[0];
    const visivel = bloco
      .replace(/className=(?:"[^"]*"|\{`[^`]*`\})/g, '')
      .replace(/<[^>]+>/g, ' ');
    const titulo = (bloco.match(/\b(title|aria-label)=["']([^"']*)["']/) ?? [])[2] ?? '';
    if (!PALAVRAS.test(visivel) && !PALAVRAS.test(titulo) && !HANDLER.test(bloco)) continue;
    // Dentro de <Permissao>? Olha o trecho imediatamente antes do botão.
    const antes = txt.slice(Math.max(0, m.index - 400), m.index);
    const aberto = antes.lastIndexOf('<Permissao');
    const fechado = antes.lastIndexOf('</Permissao>');
    if (aberto >= 0 && aberto > fechado) continue;
    n++;
  }
  return n;
}

const atual = {};
for (const arq of arquivos(SRC)) {
  const rel = path.relative(RAIZ, arq).split(path.sep).join('/');
  const n = pendentesDe(semComentarios(fs.readFileSync(arq, 'utf8')));
  if (n) atual[rel] = n;
}
const total = Object.values(atual).reduce((a, b) => a + b, 0);
const foto = fs.existsSync(FOTO) ? JSON.parse(fs.readFileSync(FOTO, 'utf8')) : null;

const pioras = foto
  ? Object.entries(atual)
      .filter(([f, n]) => n > (foto.arquivos[f] ?? 0))
      .map(([f, n]) => `${f}: ${foto.arquivos[f] ?? 0} → ${n}`)
  : [];

if (CHECK) {
  if (!foto) {
    console.error('Sem scripts/permissoes-pendentes.json: rode `npm run permissoes:auditoria -- --atualizar`.');
    process.exit(1);
  }
  if (pioras.length) {
    console.error('Botão de ação novo sem <Permissao> (premissa: AGENTS.md → permissões granulares):');
    for (const p of pioras) console.error(`  - ${p}`);
    console.error('Marque o botão com <Permissao chave rotulo herda> e rode `npm run permissoes:arvore`.');
    process.exit(1);
  }
  console.log(`Auditoria de permissões ok: ${total} botão(ões) de ação ainda sem marcação (foto: ${foto.total}).`);
} else if (ATUALIZAR) {
  if (pioras.length) {
    console.error('Recusado: a foto só pode diminuir. Arquivos que pioraram:');
    for (const p of pioras) console.error(`  - ${p}`);
    process.exit(1);
  }
  const ordenado = Object.fromEntries(Object.entries(atual).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(FOTO, JSON.stringify({ total, arquivos: ordenado }, null, 2) + '\n');
  console.log(`Foto gravada: ${total} botão(ões) de ação sem marcação em ${Object.keys(atual).length} arquivo(s).`);
} else {
  console.log(`${total} botão(ões) de ação sem <Permissao> em ${Object.keys(atual).length} arquivo(s):`);
  for (const [f, n] of Object.entries(atual).sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(5), f);
}
