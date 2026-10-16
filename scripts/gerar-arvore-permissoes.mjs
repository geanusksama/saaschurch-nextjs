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
/**
 * Chaves de módulo lidas do catálogo COMO TEXTO — este script roda no build
 * da Vercel (permissoes:check), e importar o .ts direto só funciona no Node
 * 23.6+. O repositório não fixa a versão do Node, então nada de .ts aqui.
 */
const catalogoTxt = fs.readFileSync(path.join(process.cwd(), 'src/app-ui/system/permissionCatalog.ts'), 'utf8');
const iniCatalogo = catalogoTxt.indexOf('export const DEFAULT_PERMISSION_MODULES');
const fimCatalogo = catalogoTxt.indexOf('\n];', iniCatalogo);
const DEFAULT_PERMISSION_MODULES = [...catalogoTxt.slice(iniCatalogo, fimCatalogo).matchAll(/\bkey:\s*'([a-z0-9_]+)'/g)].map((m) => ({ key: m[1] }));
if (DEFAULT_PERMISSION_MODULES.length < 50) {
  console.error(`Catálogo lido com só ${DEFAULT_PERMISSION_MODULES.length} módulos — formato mudou?`);
  process.exit(1);
}

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

/**
 * Onde o código usa as travas genéricas de cada tela (canCreate('members'),
 * 'members.edit'...). A tela de grupos só mostra "Criar/Editar/Excluir" de uma
 * tela quando alguma linha de código usa essa trava — ação que nada usa não
 * controla nada e só confundiria (o "Excluir" do Dashboard).
 *
 * Chamada dinâmica (canCreate(PERM_KEY), canEdit(def.permKey)) não dá para
 * ler: nesse arquivo, a ação vale para toda tela citada nele. Mostra a mais,
 * nunca esconde uma que funciona.
 */
const MAPA_ACAO = { Create: 'create', Edit: 'edit', Delete: 'delete' };
const usos = new Map(); // "members.create" -> Set(arquivos)
function anotarUso(modulo, acao, arquivo) {
  const chave = `${modulo}.${acao}`;
  if (!chavesDeModulo.has(chave)) return;
  if (!usos.has(chave)) usos.set(chave, new Set());
  usos.get(chave).add(arquivo);
}
const modulosDoCatalogo = new Set(DEFAULT_PERMISSION_MODULES.map((m) => m.key));

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
    // Começa depois do '(' de abertura: o recorte procura o ')' no mesmo nível.
    const corpo = recorte(txt, m.index + 'definirPermissao('.length, ')');
    const onde = `${rel}:${linhaDe(txt, m.index)}`;
    const attr = {};
    for (const a of (corpo ?? '').matchAll(/\b(chave|rotulo|herda)\s*:\s*(?:'([^']*)'|"([^"]*)")/g)) {
      attr[a[1]] = a[2] ?? a[3];
    }
    registrar(attr, onde);
  }

  // Travas genéricas com texto literal.
  for (const m of txt.matchAll(/\bcan(Create|Edit|Delete)\(\s*['"]([a-z0-9_]+)['"]/g)) {
    anotarUso(m[2], MAPA_ACAO[m[1]], rel);
  }
  for (const m of txt.matchAll(/['"`]([a-z0-9_]+)\.(create|edit|delete)['"`]/g)) {
    anotarUso(m[1], m[2], rel);
  }
  // Travas genéricas dinâmicas: vale para toda tela citada no arquivo.
  const dinamicas = new Set(
    [...txt.matchAll(/\bcan(Create|Edit|Delete)\(\s*(?!['"\s)])/g)].map((m) => MAPA_ACAO[m[1]]),
  );
  if (dinamicas.size) {
    // As chaves podem estar no próprio arquivo ou num importado direto
    // (MobileRecurso lê as de src/lib/mobile/definicoes.ts).
    const textos = [txt];
    for (const imp of txt.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const base = path.resolve(path.dirname(arq), imp[1]);
      const alvo = ['.ts', '.tsx', '/index.ts', '/index.tsx', ''].map((e) => base + e).find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
      if (alvo) textos.push(semComentarios(fs.readFileSync(alvo, 'utf8')));
    }
    const citados = new Set(
      textos
        .flatMap((t) => [...t.matchAll(/['"]([a-z0-9_]+)['"]/g)].map((m) => m[1]))
        .filter((k) => modulosDoCatalogo.has(k)),
    );
    for (const k of citados) for (const a of dinamicas) anotarUso(k, a, rel);
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
const acoesEmUso = Object.fromEntries(
  [...usos.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, [...v].sort()]),
);
const conteudo = `/**
 * GERADO por scripts/gerar-arvore-permissoes.mjs — não edite à mão.
 * Rode \`npm run permissoes:arvore\` depois de marcar ou desmarcar um componente.
 */
import type { DefPermissao } from './definir';

export const COMPONENTES_PERMISSAO: DefPermissao[] = ${JSON.stringify(lista, null, 2)};

/** Ações genéricas de tela que o código usa de fato, com os arquivos. */
export const ACOES_GENERICAS_EM_USO: Record<string, string[]> = ${JSON.stringify(acoesEmUso, null, 2)};
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
  console.log(`Árvore gerada: ${lista.length} componente(s), ${Object.keys(acoesEmUso).length} ação(ões) genérica(s) em uso → ${path.relative(RAIZ, SAIDA)}`);
}
