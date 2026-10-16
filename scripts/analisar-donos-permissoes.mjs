/**
 * Quem guarda cada arquivo de tela hoje — base factual da marcação (fase 2).
 *
 * Reproduz a trava real do AppUI: a rota é guardada pelo PRIMEIRO item de
 * appNavigation (na ordem declarada) cujo path casa (exact, ou igual/prefixo).
 * Depois sobe pelo grafo de imports (relativos) a partir do componente de cada
 * rota, para saber quais travas alcançam cada arquivo .tsx.
 *
 * Só o que está DENTRO do bloco "/app-ui" do router é painel. Tudo que é
 * alcançado pelas rotas de fora (site, portal, campanha, GF, área do membro) e
 * pelas páginas do Next é PÚBLICO — o marcador nunca toca, senão o botão
 * sumiria para o visitante sem login.
 *
 * Saída (--saida=<arquivo>): por arquivo, as chaves de módulo que guardam as
 * rotas que o usam ("donos"), as rotas sem trava e se é público. Um botão só
 * herda "<dono>.view" com segurança se o arquivo tem UM dono, nenhuma rota
 * sem trava e não é público.
 */
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.cwd();
const norm = (p) => path.relative(RAIZ, p).split(path.sep).join('/');
const saidaArg = process.argv.find((a) => a.startsWith('--saida='));

// 1. Itens do menu, na ordem.
const appui = fs.readFileSync('src/components/app-ui/AppUI.tsx', 'utf8');
const ini = appui.indexOf('export const appNavigation');
const fim = appui.indexOf('\n];', ini);
const navTxt = appui.slice(ini, fim);
const itens = [...navTxt.matchAll(/\{[^{}]*?path:\s*'([^']+)'[^{}]*?\}/g)].map((m) => ({
  path: m[1],
  permKey: (m[0].match(/permKey:\s*'([^']+)'/) ?? [])[1] ?? null,
  exact: /exact:\s*true/.test(m[0]),
}));

function guarda(rota) {
  const it = itens.find((i) => (i.exact ? rota === i.path : rota === i.path || rota.startsWith(i.path + '/')));
  return it?.permKey ?? null;
}

// 2. Imports do router.
const routes = fs.readFileSync('src/spa/routes.tsx', 'utf8');
const imports = new Map();
for (const m of routes.matchAll(/import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]+)\})?\s+from\s+"([^"]+)"/g)) {
  if (m[1]) imports.set(m[1], m[3]);
  if (m[2]) for (const n of m[2].split(',')) { const nome = n.trim().split(/\s+as\s+/).pop(); if (nome) imports.set(nome, m[3]); }
}
function resolver(deDir, spec) {
  const base = path.resolve(deDir, spec.replace(/^@\//, path.relative(deDir, path.resolve('src')) + '/'));
  for (const e of ['', '.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const p = base + e;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}
const arqDe = (nome) => { const spec = imports.get(nome); return spec ? resolver(path.resolve('src/spa'), spec) : null; };

// 3. Bloco /app-ui (painel) x resto (público).
const iniApp = routes.indexOf('path: "/app-ui"');
const abre = routes.indexOf('children: [', iniApp) + 'children: '.length;
let prof = 0;
let fecha = abre;
for (let i = abre; i < routes.length; i++) {
  if (routes[i] === '[') prof++;
  else if (routes[i] === ']') { prof--; if (prof === 0) { fecha = i; break; } }
}
const blocoApp = routes.slice(abre, fecha + 1);
const rotas = [...blocoApp.matchAll(/\{\s*path:\s*"([^"]+)",\s*Component:\s*(\w+)/g)].map((m) => ({
  rota: '/app-ui/' + m[1],
  arq: arqDe(m[2]),
}));
const indexApp = (blocoApp.match(/index:\s*true,\s*Component:\s*(\w+)/) ?? [])[1];
if (indexApp) rotas.push({ rota: '/app-ui', arq: arqDe(indexApp) });

const routerTxt = routes.slice(routes.indexOf('createBrowserRouter(['));
const foraApp = routerTxt.replace(blocoApp, '');
const nomesPublicos = new Set([
  ...[...foraApp.matchAll(/Component:\s*(\w+)/g)].map((m) => m[1]),
  ...[...foraApp.matchAll(/<([A-Z]\w+)/g)].map((m) => m[1]),
]);
nomesPublicos.delete('AppUI'); // a moldura do painel é citada fora do bloco de filhos
nomesPublicos.delete('ErrorBoundary');
const raizesPublicas = [...nomesPublicos].map(arqDe).filter(Boolean);
function paginasNext(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'api' && e.name !== '(spa)') out.push(...paginasNext(p)); }
    else if (/^(page|layout)\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}
raizesPublicas.push(...paginasNext(path.resolve('src/app')));

// 4. Grafo de imports (relativos e @/).
const cacheImp = new Map();
function importsDe(arq) {
  if (cacheImp.has(arq)) return cacheImp.get(arq);
  const txt = fs.readFileSync(arq, 'utf8');
  const out = [];
  for (const m of txt.matchAll(/from\s+['"]((?:\.{1,2}|@)\/[^'"]+)['"]/g)) {
    const r = resolver(path.dirname(arq), m[1]);
    if (r && /\.tsx?$/.test(r)) out.push(r);
  }
  cacheImp.set(arq, out);
  return out;
}

const publicos = new Set();
{
  const pilha = [...raizesPublicas];
  while (pilha.length) {
    const a = pilha.pop();
    if (publicos.has(a)) continue;
    publicos.add(a);
    pilha.push(...importsDe(a));
  }
}

const donos = new Map();
for (const { rota, arq } of rotas) {
  if (!arq) continue;
  const g = guarda(rota);
  const vistos = new Set();
  const pilha = [arq];
  while (pilha.length) {
    const a = pilha.pop();
    if (vistos.has(a)) continue;
    vistos.add(a);
    const e = donos.get(a) ?? { chaves: new Set(), semTrava: new Set() };
    if (g) e.chaves.add(g);
    else e.semTrava.add(rota);
    donos.set(a, e);
    pilha.push(...importsDe(a));
  }
}

const json = {};
for (const [a, e] of donos) {
  if (!a.endsWith('.tsx')) continue;
  json[norm(a)] = { donos: [...e.chaves].sort(), rotasSemTrava: [...e.semTrava].sort(), publico: publicos.has(a) };
}
for (const a of publicos) if (a.endsWith('.tsx') && !json[norm(a)]) json[norm(a)] = { donos: [], rotasSemTrava: [], publico: true };
if (saidaArg) fs.writeFileSync(saidaArg.slice(8), JSON.stringify(json, null, 1));

const vals = Object.values(json);
console.log('itens de menu:', itens.length, '| rotas do painel:', rotas.length, '| raízes públicas:', raizesPublicas.length);
console.log('  arquivos públicos:', vals.filter((v) => v.publico).length);
console.log('  1 dono, sem rota livre, não público:', vals.filter((v) => v.donos.length === 1 && !v.rotasSemTrava.length && !v.publico).length);
console.log('  vários donos:', vals.filter((v) => v.donos.length > 1).length);
console.log('  com rota sem trava:', vals.filter((v) => v.rotasSemTrava.length).length);
