// Teste de fumaça da árvore de permissões: transpila as telas e renderiza no Node (sem navegador).
// Uso: node scripts/smoke-arvore-permissoes.mjs
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';

const RAIZ = process.cwd();
const OUT = path.join(RAIZ, '.tmp-render');
fs.rmSync(OUT, { recursive: true, force: true });
const feitos = new Set();

function transpilar(arq) {
  const abs = path.resolve(arq);
  if (feitos.has(abs)) return;
  feitos.add(abs);
  const src = fs.readFileSync(abs, 'utf8');
  let js = ts.transpileModule(src, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: abs,
  }).outputText;
  js = js.replace(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g, (m, spec) => {
    const base = path.resolve(path.dirname(abs), spec);
    const alvo = ['.tsx', '.ts', '/index.tsx', '/index.ts'].map((e) => base + e).find((p) => fs.existsSync(p));
    if (!alvo) throw new Error(`não resolvi ${spec} em ${abs}`);
    transpilar(alvo);
    const relOut = path.relative(path.dirname(abs), alvo).replace(/\.(tsx|ts)$/, '.mjs').split(path.sep).join('/');
    return `from '${relOut.startsWith('.') ? relOut : './' + relOut}'`;
  });
  const destino = path.join(OUT, path.relative(RAIZ, abs)).replace(/\.(tsx|ts)$/, '.mjs');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, js);
}

// localStorage mínimo (os componentes leem token/usuário).
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

transpilar('src/app-ui/system/ArvorePermissoes.tsx');
transpilar('src/app-ui/system/GruposUsuarios.tsx');
transpilar('src/app-ui/system/UserPermissions.tsx');

const React = (await import('react')).default;
const { renderToString } = await import('react-dom/server');
const { MemoryRouter, Routes, Route } = await import('react-router');
const { ArvorePermissoes, RAIZES } = await import(pathToFileURL(path.join(OUT, 'src/app-ui/system/ArvorePermissoes.mjs')).href);
const GruposUsuarios = (await import(pathToFileURL(path.join(OUT, 'src/app-ui/system/GruposUsuarios.mjs')).href)).default;
const UserPermissions = (await import(pathToFileURL(path.join(OUT, 'src/app-ui/system/UserPermissions.mjs')).href)).default;

const texto = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
let falhas = 0;
const ok = (n, c, d = '') => { if (c) console.log('  ok  ', n); else { falhas++; console.log('  FALHA', n, d); } };

// Árvore em modo grupo: tela de Relatórios marcada, Exportar Excel de membros desmarcado.
const h1 = renderToString(React.createElement(ArvorePermissoes, {
  modo: 'grupo',
  valores: { 'reports.view': true, 'reports.membros.exportar_excel': false },
  onChange() {},
}));
const t1 = texto(h1);
ok('árvore (grupo) renderiza', h1.length > 1000);
ok('mostra a raiz Relatórios', t1.includes('Relatórios'));
const raizRel = RAIZES.find((r) => r.no.chave === 'reports.view');
const esperados = ['membros', 'batismo', 'consagracao', 'transferencias', 'requerimentos', 'igrejas', 'funcoes', 'presenca', 'credenciais', 'usuarios'].map((k) => `reports.${k}.abrir`).concat('reports.dashboards.aba');
ok('Relatórios tem os 10 cards + aba Dashboards como filhos diretos', esperados.every((k) => raizRel.no.filhos.some((f) => f.chave === k)), JSON.stringify(raizRel.no.filhos.map((f) => f.chave)));
const membros = raizRel.no.filhos.find((f) => f.chave === 'reports.membros.abrir');
ok('card de membros tem Exportar Excel, Imprimir e Modelos', JSON.stringify(membros?.filhos.map((f) => f.rotulo).sort()) === JSON.stringify(['Exportar Excel', 'Imprimir', 'Salvar e gerenciar modelos']), JSON.stringify(membros?.filhos.map((f) => f.rotulo)));
const dash = RAIZES.find((r) => r.no.chave === 'dashboard.view');
ok('Dashboard sem "Excluir" genérico (nada no código usa)', !dash.no.filhos.some((f) => f.chave === 'dashboard.delete'), JSON.stringify(dash.no.filhos.map((f) => f.chave)));
const ev = RAIZES.find((r) => r.no.chave === 'events.view');
ok('Agenda mostra Criar/Editar/Excluir (o código usa)', ['events.create', 'events.edit', 'events.delete'].every((k) => ev.no.filhos.some((f) => f.chave === k)));
ok('contador de liberados aparece', /\d+ de \d+ liberado/.test(t1), t1.slice(0, 200));

// Árvore em modo usuário.
const h2 = renderToString(React.createElement(ArvorePermissoes, { modo: 'usuario', profileType: 'church', valores: { 'members.view': false }, onChange() {} }));
const t2 = texto(h2);
ok('árvore (usuário) renderiza com estados', t2.includes('bloqueado') && t2.includes('padrão:'), t2.slice(0, 200));

// Telas inteiras.
const h3 = renderToString(React.createElement(GruposUsuarios));
ok('tela Grupos de Usuários renderiza', texto(h3).includes('Grupos de Usuários') && texto(h3).includes('Novo grupo'));
const h4 = renderToString(React.createElement(MemoryRouter, { initialEntries: ['/u/1'] },
  React.createElement(Routes, null, React.createElement(Route, { path: '/u/:id', element: React.createElement(UserPermissions) }))));
ok('tela Permissões do Usuário renderiza', texto(h4).includes('Carregando') || texto(h4).includes('Permissões'), texto(h4).slice(0, 200));

fs.rmSync(OUT, { recursive: true, force: true });
console.log(falhas ? `${falhas} FALHA(S)` : 'render ok');
process.exit(falhas ? 1 : 0);
