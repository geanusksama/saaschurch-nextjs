/**
 * Marca botões de ação com <Permissao> — fase 2 da SPEC permissoes-granulares.
 *
 * Só toca arquivos com UM dono comprovado (scripts/analisar-donos-permissoes.mjs):
 * todas as rotas que usam o arquivo são guardadas pelo mesmo item de menu,
 * nenhuma é livre e o arquivo não é alcançado por página pública. Assim
 * "herda = <dono>.view" é verdadeiro para quem já vê o botão hoje — marcar não
 * muda o acesso de ninguém.
 *
 * Herança, nesta ordem (fato do código, não palpite):
 *   1. a trava que já está na frente do botão: canCreate('x') → x.create,
 *      canEdit/canDelete/canView idem, pode('a.b.c') → a.b.c; também via
 *      constante (const podeEditar = canEdit('x')) e PERM_KEY literal;
 *   2. sem trava: "<dono>.view".
 * Trava dinâmica que não dá para resolver → o botão fica pendente.
 *
 * Fica pendente (revisão manual): botão sem rótulo legível, botão dentro de
 * *Trigger/asChild (o Radix precisa do elemento direto).
 *
 *   node scripts/marcar-permissoes.mjs --donos=<json> [--aplicar] [--arquivo=<rel>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_PERMISSION_MODULES } from '../src/app-ui/system/permissionCatalog.ts';
import {
  HANDLER,
  PALAVRAS,
  ehBotaoDeAcao,
  jaMarcado,
  semComentarios,
  separarBotao,
  textoVisivel,
  tituloDe,
} from './lib/botoes.mjs';

const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? '').slice(n.length + 3) || null;
const APLICAR = process.argv.includes('--aplicar');
const DONOS = JSON.parse(fs.readFileSync(arg('donos'), 'utf8'));
const SO = arg('arquivo');
const MODULOS = new Set(DEFAULT_PERMISSION_MODULES.map((m) => m.key));
const ACAO_CAN = { View: 'view', Create: 'create', Edit: 'edit', Delete: 'delete' };

const VERBO_PT = {
  save: 'Salvar', salvar: 'Salvar', delete: 'Excluir', excluir: 'Excluir', remove: 'Remover', remover: 'Remover',
  export: 'Exportar', exportar: 'Exportar', print: 'Imprimir', imprimir: 'Imprimir', download: 'Baixar', baixar: 'Baixar',
  import: 'Importar', importar: 'Importar', create: 'Criar', criar: 'Criar', novo: 'Novo', add: 'Adicionar',
  adicionar: 'Adicionar', edit: 'Editar', editar: 'Editar', duplicate: 'Duplicar', duplicar: 'Duplicar',
  approve: 'Aprovar', aprovar: 'Aprovar', reject: 'Reprovar', reprovar: 'Reprovar', send: 'Enviar', enviar: 'Enviar',
  gerar: 'Gerar', generate: 'Gerar', lancar: 'Lançar', estornar: 'Estornar',
};

const slug = (t) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'acao';
const humano = (arq) =>
  path.basename(arq).replace(/\.tsx$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');

/** Rótulo = o que a pessoa lê; senão title; senão o verbo do handler em português. */
function rotuloDe(bloco) {
  const { abertura, corpo } = separarBotao(bloco);
  const visivel = textoVisivel(corpo);
  const titulo = tituloDe(abertura);
  // Estado de "carregando" não é rótulo: "Salvando..." → fica o "Salvar".
  const pedacos = visivel.split(/\s{2,}|\s(?=[A-ZÀ-Ú])/).map((p) => p.trim()).filter(Boolean);
  const comAcao = [visivel, ...pedacos, titulo].find((c) => c && PALAVRAS.test(c) && c.length <= 50);
  if (comAcao) return comAcao.replace(/\s*\.{3}$/, '');
  if (titulo) return titulo;
  if (visivel && visivel.length <= 40 && /[A-Za-zÀ-ú]{3}/.test(visivel)) return visivel;
  const h = abertura.match(/onClick=\{[^}]*?\b(?:handle)?([a-z]+)([A-Z]\w*)?/);
  if (h && HANDLER.test(abertura)) {
    const verbo = VERBO_PT[h[1].toLowerCase()];
    if (verbo) return h[2] ? `${verbo} (${h[2].replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()})` : verbo;
  }
  return null;
}

/** Constantes do arquivo: PERM_KEY = 'x' e podeX = canEdit('x'). */
function constantes(txt) {
  const strings = new Map();
  for (const m of txt.matchAll(/const\s+(\w+)\s*=\s*['"]([a-z0-9_.]+)['"]/g)) strings.set(m[1], m[2]);
  const travas = new Map();
  for (const m of txt.matchAll(/const\s+(\w+)\s*=\s*([^;\n]{0,200})/g)) {
    const usos = [...m[2].matchAll(/\bcan(View|Create|Edit|Delete)\(\s*(?:['"]([a-z0-9_]+)['"]|(\w+))\s*\)/g)];
    if (usos.length !== 1) continue;
    const mod = usos[0][2] ?? strings.get(usos[0][3]);
    if (mod) travas.set(m[1], `${mod}.${ACAO_CAN[usos[0][1]]}`);
  }
  return { strings, travas };
}

/** A trava que já protege o botão, se houver; 'DINAMICA' se não dá para ler. */
function travaNaFrente(txt, i, consts) {
  let antes = txt.slice(Math.max(0, i - 400), i);
  const corte = Math.max(antes.lastIndexOf('</'), antes.lastIndexOf('/>'), antes.lastIndexOf('<button'));
  if (corte >= 0) antes = antes.slice(corte);
  const lit = [...antes.matchAll(/\bcan(View|Create|Edit|Delete)\(\s*(?:['"]([a-z0-9_]+)['"]|(\w+))\s*\)/g)].pop();
  if (lit) {
    const mod = lit[2] ?? consts.strings.get(lit[3]);
    return mod ? `${mod}.${ACAO_CAN[lit[1]]}` : 'DINAMICA';
  }
  const pd = [...antes.matchAll(/\bpode\(\s*['"]([a-z0-9_.]+)['"]\s*\)/g)].pop();
  if (pd) return pd[1];
  for (const [nome, chave] of consts.travas) if (new RegExp(`\\b${nome}\\b`).test(antes)) return chave;
  return null;
}

const relatorio = [];
const pendentes = [];
let totalMarcados = 0;

for (const [rel, info] of Object.entries(DONOS)) {
  if (SO && rel !== SO) continue;
  // Público (site, portal, membro): nunca — o botão sumiria para quem não tem login.
  if (info.publico || info.donos.length !== 1 || info.rotasSemTrava.length) continue;
  const dono = info.donos[0];
  if (!MODULOS.has(dono) || !fs.existsSync(rel)) continue;
  const original = fs.readFileSync(rel, 'utf8');
  const limpo = semComentarios(original);
  const consts = constantes(limpo);
  const arqSlug = slug(path.basename(rel).replace(/\.tsx$/, '').replace(/([a-z])([A-Z])/g, '$1_$2'));

  const alvos = [];
  for (const m of limpo.matchAll(/<button\b[\s\S]*?<\/button>/g)) {
    const bloco = m[0];
    if (!ehBotaoDeAcao(bloco) || jaMarcado(limpo, m.index)) continue;
    const antes = limpo.slice(Math.max(0, m.index - 200), m.index);
    if (/(asChild|Trigger)[^<>]*>\s*$/.test(antes)) { pendentes.push(`${rel}: dentro de Trigger/asChild`); continue; }
    const rot = rotuloDe(bloco);
    if (!rot) { pendentes.push(`${rel}: botão sem rótulo legível`); continue; }
    const trava = travaNaFrente(limpo, m.index, consts);
    if (trava === 'DINAMICA') { pendentes.push(`${rel}: trava dinâmica não resolvida (${rot})`); continue; }
    const herda = trava ?? `${dono}.view`;
    if (herda.split('.').length === 2 && !MODULOS.has(herda.split('.')[0])) {
      pendentes.push(`${rel}: trava com módulo fora do catálogo (${herda})`);
      continue;
    }
    alvos.push({ ini: m.index, fim: m.index + bloco.length, rot, herda });
  }
  if (!alvos.length) continue;

  // Chave por rótulo. Mesma chave só se rótulo E herança forem iguais (o
  // script da árvore recusa a mesma chave com rótulo diferente); senão, sufixo.
  const usadas = new Map();
  for (const a of alvos) {
    a.rotulo = `${a.rot.replace(/["{}<>]/g, '')} — ${humano(rel)}`.slice(0, 90);
    const assinatura = `${a.rotulo}|${a.herda}`;
    const base = `${dono}.${arqSlug}.${slug(a.rot)}`;
    let k = base;
    let n = 2;
    while (usadas.has(k) && usadas.get(k) !== assinatura) k = `${base}_${n++}`;
    usadas.set(k, assinatura);
    a.chave = k;
  }

  // De trás para frente (semComentarios preserva as posições do original).
  let s = original;
  for (const a of [...alvos].sort((x, y) => y.ini - x.ini)) {
    const bloco = s.slice(a.ini, a.fim);
    if (!bloco.startsWith('<button') || !bloco.endsWith('</button>')) throw new Error(`${rel}: posição desalinhada`);
    const linhaIni = s.lastIndexOf('\n', a.ini) + 1;
    const indent = s.slice(linhaIni, a.ini).match(/^\s*/)[0];
    const { abertura } = separarBotao(bloco);
    const key = (abertura.match(/\skey=(\{[^}]*\}|"[^"]*")/) ?? [])[1];
    const novo =
      `<Permissao${key ? ` key=${key}` : ''} chave="${a.chave}" rotulo="${a.rotulo}" herda="${a.herda}">\n` +
      `${indent}  ${bloco.replace(/\n/g, '\n  ')}\n${indent}</Permissao>`;
    s = s.slice(0, a.ini) + novo + s.slice(a.fim);
  }
  if (!/import\s*\{[^}]*\bPermissao\b[^}]*\}\s*from/.test(s)) {
    let imp = path.relative(path.dirname(rel), 'src/lib/permissoes/Permissao').split(path.sep).join('/');
    if (!imp.startsWith('.')) imp = './' + imp;
    const ultimaImport = [...s.matchAll(/^import[\s\S]*?from\s+['"][^'"]+['"];?[ \t]*$/gm)].pop();
    const pos = ultimaImport ? ultimaImport.index + ultimaImport[0].length : 0;
    s = s.slice(0, pos) + `\nimport { Permissao } from '${imp}';` + s.slice(pos);
  }
  totalMarcados += alvos.length;
  relatorio.push(...alvos.map((a) => `${rel} | ${a.chave} | ${a.herda} | ${a.rotulo}`));
  if (APLICAR) fs.writeFileSync(rel, s);
}

console.log(relatorio.join('\n'));
console.log(`\n${APLICAR ? 'MARCADOS' : 'SIMULAÇÃO'}: ${totalMarcados} botão(ões). Pendentes para revisão: ${pendentes.length}`);
for (const p of pendentes) console.log('  pendente:', p);
