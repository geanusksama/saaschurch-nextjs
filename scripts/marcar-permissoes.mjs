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
  encontrarBotoes,
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

/**
 * Raiz "tela_*" (catálogo: liberada e opt-out — fora de grupo nada muda) para
 * arquivo SEM dono único: pela rota livre que o alcança, ou pelos dois menus
 * que o compartilham. Sem área clara (ex.: modal de impressão usado por nove
 * módulos) → null, e o botão fica pendente para revisão manual.
 */
const AREA_DA_ROTA = [
  [/^\/app-ui\/config\/ai-agents$/, 'tela_assistentes_ia'],
  [/^\/app-ui\/config\/:lookupKey$/, 'tela_cadastros_auxiliares'],
  [/^\/app-ui\/app(\/|$)/, 'tela_app'],
  [/^\/app-ui\/cms(\/|$)/, 'tela_cms'],
  [/^\/app-ui\/(crm|lead-new|prospecting)(\/|$)/, 'tela_crm'],
  [/^\/app-ui\/(mobile|pagamentos)\//, 'tela_mobile_recursos'],
  [/^\/app-ui\/(credential-models|credential-requests|credentials-new)(\/|$)/, 'tela_credenciais'],
  [/^\/app-ui\/ministries\//, 'tela_ministerios'],
  [/^\/app-ui\/(pastoral|visit-report|counseling-session|prayer-new)(\/|$)/, 'tela_pastoral'],
  [/^\/app-ui\/(communication|whatsapp|email)(\/|$)/, 'tela_comunicacao'],
  [/^\/app-ui\/system$/, 'tela_sistema_antiga'],
  [/^\/app-ui\/cells(\/|$)/, 'tela_gf'],
  [/^\/app-ui\/stripe\//, 'tela_stripe'],
  [/^\/app-ui\/assets\//, 'tela_patrimonio'],
  [/^\/app-ui\/finance(\/|$)/, 'tela_financas'],
  [/^\/app-ui\/events\//, 'tela_eventos'],
];
const AREA_DOS_DONOS = {
  'cashbook,finance_entries': 'tela_lancamento_recibo',
  'cashbook,finance_entries,members': 'tela_lancamento_recibo',
  'culto_gestao,culto_lancar': 'tela_culto_registro',
  'settings_export,settings_import': 'tela_import_export',
  'system_grupos_usuarios,system_users': 'tela_permissoes',
  'culto_posicoes,system_users': 'tela_permissoes',
};
function areaVirtual(rel, info) {
  if (info.rotasSemTrava.some((r) => r.includes('moldura'))) return 'tela_moldura';
  if (rel.includes('/shared/')) return null; // componente de uso geral: sem área clara
  if (info.rotasSemTrava.length) {
    const areas = new Set(info.rotasSemTrava.map((r) => (AREA_DA_ROTA.find(([re]) => re.test(r)) ?? [])[1] ?? null));
    return areas.size === 1 ? [...areas][0] : null;
  }
  return AREA_DOS_DONOS[info.donos.join(',')] ?? null;
}

const relatorio = [];
const pendentes = [];
let totalMarcados = 0;

for (const [rel, info] of Object.entries(DONOS)) {
  if (SO && rel !== SO) continue;
  // Público (site, portal, membro): nunca — o botão sumiria para quem não tem login.
  if (info.publico || !fs.existsSync(rel)) continue;
  // Dono único comprovado: todo botão de ação pode ser marcado (sem trava →
  // "<dono>.view"). Sem dono único (vários donos, rota livre, moldura): SÓ o
  // botão que já tem trava explícita na frente — herdar a própria trava dá
  // exatamente o resultado de hoje, em qualquer tela.
  const donoUnico = info.donos.length === 1 && !info.rotasSemTrava.length && MODULOS.has(info.donos[0]);
  const virtual = donoUnico ? null : areaVirtual(rel, info);
  if (virtual && !MODULOS.has(virtual)) throw new Error(`${virtual} não está no catálogo`);
  const dono = donoUnico ? info.donos[0] : null;
  const original = fs.readFileSync(rel, 'utf8');
  const limpo = semComentarios(original);
  const consts = constantes(limpo);
  const arqSlug = slug(path.basename(rel).replace(/\.tsx$/, '').replace(/([a-z])([A-Z])/g, '$1_$2'));

  const alvos = [];
  for (const m of encontrarBotoes(limpo).map((b) => Object.assign([b.bloco], { index: b.index }))) {
    const bloco = m[0];
    if (!ehBotaoDeAcao(bloco) || jaMarcado(limpo, m.index)) continue;
    const antes = limpo.slice(Math.max(0, m.index - 200), m.index);
    if (/(asChild|Trigger)[^<>]*>\s*$/.test(antes)) { pendentes.push(`${rel}: dentro de Trigger/asChild`); continue; }
    const rot = rotuloDe(bloco);
    if (!rot) { pendentes.push(`${rel}: botão sem rótulo legível`); continue; }
    const trava = travaNaFrente(limpo, m.index, consts);
    // Trava literal na frente: herda ela. Dinâmica ou nenhuma: o dono único,
    // ou a raiz tela_* da área (liberada e opt-out — fora de grupo nada muda).
    const literal = trava && trava !== 'DINAMICA' ? trava : null;
    const raiz = dono ?? virtual;
    if (!literal && !raiz) { pendentes.push(`${rel}: sem dono único, sem área e sem trava (${rot})`); continue; }
    const herda = literal ?? `${raiz}.view`;
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
    // Sem dono único, a chave nasce no módulo da própria trava.
    const base = `${dono ?? virtual ?? a.herda.split('.')[0]}.${arqSlug}.${slug(a.rot)}`;
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
    if (!bloco.startsWith('<button') || !(bloco.endsWith('</button>') || bloco.endsWith('/>'))) throw new Error(`${rel}: posição desalinhada`);
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
