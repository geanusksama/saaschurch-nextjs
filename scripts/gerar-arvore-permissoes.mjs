/**
 * Varre o código e gera a árvore de permissões granulares.
 *
 * Acha cada `<Permissao chave=... rotulo=... herda=...>` e cada
 * `definirPermissao({ chave, rotulo, herda })` em src/, confere e escreve
 * src/lib/permissoes/arvore.generated.ts — a lista que a tela de Grupos de
 * usuários mostra com check/uncheck e que o resolvedor usa para herdar.
 *
 * A árvore é sempre a do código: botão marcado aparece, botão sem marcação não
 * existe para o sistema. Ver docs/modules/permissoes-granulares/SPEC.md (D6).
 *
 * Recusa (sai com erro):
 *   - chave fora do formato "modulo.tela.componente";
 *   - mesma chave com rótulo ou herança diferentes em dois lugares;
 *   - `herda` que não é chave de módulo do catálogo nem outra chave granular;
 *   - ciclo de herança;
 *   - atributo que não é texto literal (o script não executa o código).
 *
 * Uso:
 *   npx tsx scripts/gerar-arvore-permissoes.mjs          # gera
 *   npx tsx scripts/gerar-arvore-permissoes.mjs --check  # só confere (CI)
 */
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_PERMISSION_MODULES } from '../src/app-ui/system/permissionCatalog.ts';

const RAIZ = process.cwd();
const SRC = path.join(RAIZ, 'src');
const SAIDA = path.join(SRC, 'lib', 'permissoes', 'arvore.generated.ts');
const CHECK = process.argv.includes('--check');
const ACOES = ['view', 'create', 'edit', 'delete'];
const FORMATO = /^[a-z0-9_]+(\.[a-z0-9_]+){2,}$/;

const chavesDeModulo = new Set(
  DEFAULT_PERMISSION_MODULES.flatMap((m) => ACOES.map((a) => `${m.key}.${a}`)),
);

function arquivos(dir) {
  const saida = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) saida.push(...arquivos(p));
    else if (/\.(tsx?|mjs)$/.test(e.name) && !e.name.endsWith('.generated.ts')) saida.push(p);
  }
  return saida;
}

/** Tira comentários de bloco e de linha inteira — exemplos em comentário não contam. */
function semComentarios(txt) {
  return txt
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, ' '));
}

/** Do índice `i` até o fechamento no mesmo nível de chaves/parênteses. */
function recorte(txt, i, fecha) {
  let prof = 0;
  let aspas = null;
  for (let j = i; j < txt.length; j++) {
    const c = txt[j];
    if (aspas) {
      if (c === aspas && txt[j - 1] !== '\\') aspas = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') aspas = c;
    else if (c === '{' || c === '(') prof++;
    else if (c === '}' || c === ')') {
      if (prof === 0 && c === fecha) return txt.slice(i, j + 1);
      prof--;
    } else if (c === fecha && prof === 0) return txt.slice(i, j + 1);
  }
  return null;
}

const erros = [];
const achadas = new Map();

function linhaDe(txt, i) {
  return txt.slice(0, i).split('\n').length;
}

function registrar(def, onde) {
  for (const campo of ['chave', 'rotulo', 'herda']) {
    if (typeof def[campo] !== 'string' || !def[campo].trim()) {
      erros.push(`${onde}: "${campo}" ausente ou não literal`);
      return;
    }
  }
  if (!FORMATO.test(def.chave)) {
    erros.push(`${onde}: chave "${def.chave}" fora do formato modulo.tela.componente`);
    return;
  }
  const antes = achadas.get(def.chave);
  if (antes) {
    if (antes.rotulo !== def.rotulo || antes.herda !== def.herda) {
      erros.push(`${onde}: "${def.chave}" já definida em ${antes.arquivo} com outro rótulo/herança`);
    }
    return;
  }
  achadas.set(def.chave, { ...def, arquivo: onde.replace(/:\d+$/, '') });
}

for (const arq of arquivos(SRC)) {
  const rel = path.relative(RAIZ, arq).replace(/\\/g, '/');
  if (rel.startsWith('src/lib/permissoes/')) continue;
  const txt = semComentarios(fs.readFileSync(arq, 'utf8'));

  for (const m of txt.matchAll(/<Permissao\b/g)) {
    const tag = recorte(txt, m.index, '>');
    const onde = `${rel}:${linhaDe(txt, m.index)}`;
    if (!tag) {
      erros.push(`${onde}: <Permissao> sem fechamento`);
      continue;
    }
    const attr = {};
    for (const a of tag.matchAll(/\b(chave|rotulo|herda)=(?:"([^"]*)"|'([^']*)'|\{)/g)) {
      attr[a[1]] = a[2] ?? a[3];
    }
    registrar(attr, onde);
  }

  for (const m of txt.matchAll(/\bdefinirPermissao\(/g)) {
    const corpo = recorte(txt, m.index + 'definirPermissao'.length, ')');
    const onde = `${rel}:${linhaDe(txt, m.index)}`;
    const attr = {};
    for (const a of (corpo ?? '').matchAll(/\b(chave|rotulo|herda)\s*:\s*(?:'([^']*)'|"([^"]*)")/g)) {
      attr[a[1]] = a[2] ?? a[3];
    }
    registrar(attr, onde);
  }
}

// Herança: tem que chegar a uma chave de módulo, sem ciclo.
for (const def of achadas.values()) {
  const vistas = new Set([def.chave]);
  let atual = def.herda;
  while (!chavesDeModulo.has(atual)) {
    const pai = achadas.get(atual);
    if (!pai) {
      erros.push(`${def.arquivo}: "${def.chave}" herda de "${atual}", que não existe`);
      break;
    }
    if (vistas.has(atual)) {
      erros.push(`${def.arquivo}: ciclo de herança em "${def.chave}"`);
      break;
    }
    vistas.add(atual);
    atual = pai.herda;
  }
}

if (erros.length) {
  console.error(`Árvore de permissões com ${erros.length} erro(s):`);
  for (const e of erros) console.error(`  - ${e}`);
  process.exit(1);
}

const lista = [...achadas.values()].sort((a, b) => a.chave.localeCompare(b.chave));
const conteudo = `/**
 * GERADO por scripts/gerar-arvore-permissoes.mjs — não edite à mão.
 * Rode \`npm run permissoes:arvore\` depois de marcar ou desmarcar um componente.
 */
import type { DefPermissao } from './definir';

export const COMPONENTES_PERMISSAO: DefPermissao[] = ${JSON.stringify(lista, null, 2)};
`;

const atual = fs.existsSync(SAIDA) ? fs.readFileSync(SAIDA, 'utf8') : '';
if (CHECK) {
  if (atual !== conteudo) {
    console.error('arvore.generated.ts desatualizado: rode `npm run permissoes:arvore`.');
    process.exit(1);
  }
  console.log(`Árvore em dia: ${lista.length} componente(s).`);
} else {
  if (atual !== conteudo) fs.writeFileSync(SAIDA, conteudo);
  console.log(`Árvore gerada: ${lista.length} componente(s) → ${path.relative(RAIZ, SAIDA)}`);
}
