/**
 * Quem guarda cada arquivo de tela hoje — base factual das permissões
 * granulares. Usado pela auditoria (build) e pelo marcador.
 *
 * 1. Trava do menu: a rota do painel é guardada pelo PRIMEIRO item de
 *    appNavigation (ordem declarada) cujo path casa (exact, ou igual/prefixo)
 *    — exatamente o isCurrentPathAllowed do AppUI.
 * 2. Rota sem trava no menu: vale a ENTRADA real da tela —
 *    a) card de Configurações (SystemSettings só mostra o card com canView da
 *       chave dele), ou
 *    b) links (to="/app-ui/...", navigate('/app-ui/...')) que só existem em
 *       arquivos de UM dono do menu.
 *    Sem entrada única, a rota fica "sem trava" e o marcador não toca.
 * 3. Só o bloco "/app-ui" do router é painel. O que as rotas de fora (site,
 *    portal, campanha, GF, área do membro) e as páginas do Next alcançam é
 *    PÚBLICO. A moldura (AppUI.tsx) é painel sem trava.
 * 4. Arquivo que nada disso alcança não renderiza: é código morto.
 */
import fs from 'node:fs';
import path from 'node:path';

export function analisarDonos(raiz = process.cwd()) {
  const R = (p) => path.resolve(raiz, p);
  const norm = (p) => path.relative(raiz, p).split(path.sep).join('/');
  const ler = (p) => fs.readFileSync(p, 'utf8');

  function resolver(deDir, spec) {
    const base = spec.startsWith('@/') ? R('src/' + spec.slice(2)) : path.resolve(deDir, spec);
    for (const e of ['', '.tsx', '.ts', '/index.tsx', '/index.ts']) {
      const p = base + e;
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    }
    return null;
  }
  const ehBarril = (arq) => /export\s*\{[^}]+\}\s*from/.test(ler(arq));

  /**
   * Arquivos que um símbolo importado de `arq` realmente puxa. Barril
   * (index.tsx com `export { X } from './X'`): segue só o X; componente
   * definido no próprio barril: só o que ele usa. Sem isso, importar UMA tela
   * de Configurações "alcançaria" todas as telas do barril.
   */
  function arquivosDoSimbolo(arq, nome, prof = 0) {
    if (!ehBarril(arq) || prof > 5) return [arq];
    const txt = ler(arq);
    const re = [...txt.matchAll(/export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)].find((m) =>
      m[1].split(',').some((p) => p.trim().split(/\s+as\s+/).pop() === nome),
    );
    if (re) {
      const alvo = resolver(path.dirname(arq), re[2]);
      return alvo ? arquivosDoSimbolo(alvo, nome, prof + 1) : [];
    }
    const ini = txt.search(new RegExp(`export\\s+(?:const|function|class)\\s+${nome}\\b`));
    if (ini < 0) return [arq]; // não sei de onde vem: conservador, o barril todo
    const resto = txt.slice(ini + 1);
    const fim = resto.search(/\nexport\s/);
    const corpo = fim < 0 ? resto : resto.slice(0, fim);
    const usados = new Set([...corpo.matchAll(/\b([A-Z]\w+)/g)].map((m) => m[1]));
    const out = [];
    for (const m of txt.matchAll(/import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]+)\})?\s+from\s+['"]((?:\.{1,2}|@)\/[^'"]+)['"]/g)) {
      const nomes = [m[1], ...(m[2] ?? '').split(',').map((n) => n.trim().split(/\s+as\s+/).pop())].filter(Boolean);
      if (nomes.some((n) => usados.has(n))) {
        const r = resolver(path.dirname(arq), m[3]);
        if (r) out.push(r);
      }
    }
    return out;
  }

  const cacheImp = new Map();
  function importsDe(arq) {
    if (cacheImp.has(arq)) return cacheImp.get(arq);
    const out = [];
    const txt = ler(arq);
    for (const m of txt.matchAll(/(?:import|export)\s+(?:type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\}|\*(?:\s+as\s+\w+)?)?\s*from\s+['"]((?:\.{1,2}|@)\/[^'"]+)['"]/g)) {
      const r = resolver(path.dirname(arq), m[3]);
      if (!r || !/\.tsx?$/.test(r)) continue;
      const nomes = (m[2] ?? '').split(',').map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]).filter(Boolean);
      if (m[2] !== undefined && nomes.length && ehBarril(r)) {
        for (const n of nomes) out.push(...arquivosDoSimbolo(r, n));
      } else {
        out.push(r);
      }
    }
    cacheImp.set(arq, out);
    return out;
  }
  function alcance(raizes) {
    const vis = new Set();
    const pilha = [...raizes];
    while (pilha.length) {
      const a = pilha.pop();
      if (!a || vis.has(a)) continue;
      vis.add(a);
      pilha.push(...importsDe(a));
    }
    return vis;
  }

  // Menu.
  const appuiArq = R('src/components/app-ui/AppUI.tsx');
  const appui = ler(appuiArq);
  const ini = appui.indexOf('export const appNavigation');
  const navTxt = appui.slice(ini, appui.indexOf('\n];', ini));
  const itens = [...navTxt.matchAll(/\{[^{}]*?path:\s*'([^']+)'[^{}]*?\}/g)].map((m) => ({
    path: m[1],
    permKey: (m[0].match(/permKey:\s*'([^']+)'/) ?? [])[1] ?? null,
    exact: /exact:\s*true/.test(m[0]),
  }));
  const guardaMenu = (rota) =>
    itens.find((i) => (i.exact ? rota === i.path : rota === i.path || rota.startsWith(i.path + '/')))?.permKey ?? null;

  // Cards de Configurações.
  const cards = new Map();
  for (const m of ler(R('src/components/app-ui/SystemSettings.tsx')).matchAll(/path:\s*'([^']+)'[^}\n]*?permKey:\s*'([^']+)'/g)) {
    cards.set(m[1], m[2]);
  }

  // Router. O mapa guarda o nome ORIGINAL de cada import: o router usa
  // apelidos (AuditLog as SystemAuditLog) e o barril só conhece o original.
  const routes = ler(R('src/spa/routes.tsx'));
  const imports = new Map(); // apelido -> { spec, original }
  for (const m of routes.matchAll(/import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]+)\})?\s+from\s+"([^"]+)"/g)) {
    if (m[1]) imports.set(m[1], { spec: m[3], original: 'default' });
    if (m[2]) for (const n of m[2].split(',')) {
      const [original, apelido] = n.trim().split(/\s+as\s+/);
      if (original) imports.set(apelido ?? original, { spec: m[3], original });
    }
  }
  /** Arquivo de entrada do import (pode ser um barril). */
  const arqDe = (nome) => { const i = imports.get(nome); return i ? resolver(R('src/spa'), i.spec) : null; };
  /** Raízes do grafo para o componente: só o que o símbolo de fato puxa. */
  const raizesDe = (nome) => {
    const i = imports.get(nome);
    const arq = arqDe(nome);
    if (!arq) return [];
    return i.original === 'default' ? [arq] : arquivosDoSimbolo(arq, i.original);
  };
  const iniApp = routes.indexOf('path: "/app-ui"');
  const abre = routes.indexOf('children: [', iniApp) + 'children: '.length;
  let prof = 0;
  let fecha = abre;
  for (let i = abre; i < routes.length; i++) {
    if (routes[i] === '[') prof++;
    else if (routes[i] === ']') { prof--; if (prof === 0) { fecha = i; break; } }
  }
  const blocoApp = routes.slice(abre, fecha + 1);
  const rotas = [...blocoApp.matchAll(/\{\s*path:\s*"([^"]+)",\s*Component:\s*(\w+)/g)].map((m) => ({ rota: '/app-ui/' + m[1], arq: arqDe(m[2]), raizes: raizesDe(m[2]) }));
  const idx = (blocoApp.match(/index:\s*true,\s*Component:\s*(\w+)/) ?? [])[1];
  if (idx) rotas.push({ rota: '/app-ui', arq: arqDe(idx), raizes: raizesDe(idx) });

  // Público.
  const foraApp = routes.slice(routes.indexOf('createBrowserRouter([')).replace(blocoApp, '');
  const nomesPub = new Set([...[...foraApp.matchAll(/Component:\s*(\w+)/g)].map((m) => m[1]), ...[...foraApp.matchAll(/<([A-Z]\w+)/g)].map((m) => m[1])]);
  nomesPub.delete('AppUI');
  nomesPub.delete('ErrorBoundary');
  const raizesPub = [...nomesPub].flatMap(raizesDe).filter(Boolean);
  (function paginas(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'api' && e.name !== '(spa)') paginas(p); }
      else if (/^(page|layout)\.tsx$/.test(e.name)) raizesPub.push(p);
    }
  })(R('src/app'));
  const publicos = alcance(raizesPub);

  // 1ª passada: travas do menu.
  const donosDe = new Map(); // arquivo -> { chaves:Set, semTrava:Set, entrada:Set }
  const marcar = (raizes, chave, rota, tipo) => {
    for (const a of alcance(raizes)) {
      const e = donosDe.get(a) ?? { chaves: new Set(), semTrava: new Set(), entrada: new Set() };
      if (chave) { e.chaves.add(chave); if (tipo) e.entrada.add(`${rota} ← ${tipo}`); }
      else e.semTrava.add(rota);
      donosDe.set(a, e);
    }
  };
  const semMenu = [];
  for (const r of rotas) {
    if (!r.arq) continue;
    const g = guardaMenu(r.rota);
    if (g) marcar(r.raizes, g, r.rota, null);
    else semMenu.push(r);
  }

  // 2ª passada: entrada real das rotas sem trava no menu. Procura o link em
  // TODO arquivo que renderiza no painel (com trava, sem trava e a moldura):
  // a entrada só vale se TODOS os que linkam têm o mesmo dono único — um
  // único link numa tela livre (Central de Configurações, moldura) derruba.
  const painel = new Set([...donosDe.keys(), ...alcance([appuiArq])].filter((a) => !publicos.has(a)));
  const semTravaRotas = new Set(semMenu.map((r) => r.arq).filter(Boolean));
  const textos = new Map([...painel].map((a) => [a, ler(a)]));
  const moldura = alcance([appuiArq]);
  const resolvidas = [];
  for (const r of semMenu) {
    let dono = cards.get(r.rota) ?? null;
    let tipo = dono ? `card de Configurações (${dono})` : null;
    if (!dono) {
      // Qualquer texto com o caminho conta como link — inclusive listas de
      // menu ({ path: '/app-ui/config/roles' } + to={item.path}).
      const padrao = new RegExp(
        `["'\`]${r.rota.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:\w+/g, '[^"\'\`/]+')}(?:["'\`?/])`,
      );
      const donosLink = new Set();
      let linkLivre = false;
      for (const [a, t] of textos) {
        if (!padrao.test(t)) continue;
        const e = donosDe.get(a);
        if (!e || e.semTrava.size || moldura.has(a) || semTravaRotas.has(a) || e.chaves.size !== 1) linkLivre = true;
        else donosLink.add([...e.chaves][0]);
      }
      if (!linkLivre && donosLink.size === 1) { dono = [...donosLink][0]; tipo = `links só em telas de ${dono}`; }
    }
    resolvidas.push({ ...r, dono, tipo });
  }
  for (const r of resolvidas) marcar(r.raizes, r.dono, r.rota, r.tipo);
  // Moldura do painel: sem trava, alcançada por qualquer usuário logado.
  marcar([appuiArq], null, '(moldura AppUI)', null);

  const json = {};
  for (const [a, e] of donosDe) {
    if (!a.endsWith('.tsx')) continue;
    json[norm(a)] = {
      donos: [...e.chaves].sort(),
      rotasSemTrava: [...e.semTrava].sort(),
      entrada: [...e.entrada].sort(),
      publico: publicos.has(a),
    };
  }
  for (const a of publicos) if (a.endsWith('.tsx') && !json[norm(a)]) json[norm(a)] = { donos: [], rotasSemTrava: [], entrada: [], publico: true };
  return { arquivos: json, rotasSemMenu: resolvidas.map((r) => ({ rota: r.rota, dono: r.dono, tipo: r.tipo })) };
}

/** Arquivo que renderiza no painel (não é público nem código morto). */
export function ehDoPainel(info) {
  return Boolean(info) && !info.publico;
}
