/**
 * Marcação revisada à mão: para botões que o marcador automático não
 * consegue rotular (só ícone) ou que exigem decisão (herdar o botão que abre o
 * modal, embrulhar o menu inteiro). Lê uma lista JSON:
 *
 *   [{ "arquivo": "src/x.tsx", "linha": 641, "chave": "...", "rotulo": "...",
 *      "herda": "...", "envolver": "DropdownMenu" (opcional) }]
 *
 *   node scripts/marcar-manual.mjs <lista.json>
 *
 * `linha` é a linha do <button>. Com `envolver`, embrulha o elemento <X>...</X>
 * mais próximo que contém o botão (o Radix exige o botão direto no Trigger).
 */
import fs from 'node:fs';
import { encontrarBotoes } from './lib/botoes.mjs';

const lista = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const porArquivo = new Map();
for (const e of lista) porArquivo.set(e.arquivo, [...(porArquivo.get(e.arquivo) ?? []), e]);

for (const [arq, entradas] of porArquivo) {
  let s = fs.readFileSync(arq, 'utf8');
  const linhaDe = (i) => s.slice(0, i).split('\n').length;
  // Localiza tudo ANTES de alterar, depois aplica de trás para frente.
  const alvos = entradas.map((e) => {
    const b = encontrarBotoes(s).find((x) => linhaDe(x.index) === e.linha);
    if (!b) throw new Error(`${arq}:${e.linha} não começa um <button>`);
    let ini = b.index;
    let fim = b.index + b.bloco.length;
    if (e.envolver) {
      ini = s.lastIndexOf(`<${e.envolver}>`, b.index);
      const fecha = s.indexOf(`</${e.envolver}>`, fim);
      if (ini < 0 || fecha < 0) throw new Error(`${arq}:${e.linha} sem <${e.envolver}> em volta`);
      fim = fecha + `</${e.envolver}>`.length;
    }
    const antes = s.slice(Math.max(0, ini - 300), ini);
    if (/<Permissao\b[^>]*>\s*$/.test(antes)) throw new Error(`${arq}:${e.linha} já está marcado`);
    return { ...e, ini, fim };
  });
  for (const a of alvos.sort((x, y) => y.ini - x.ini)) {
    const linhaIni = s.lastIndexOf('\n', a.ini) + 1;
    const indent = s.slice(linhaIni, a.ini).match(/^\s*/)[0];
    const bloco = s.slice(a.ini, a.fim);
    const key = a.envolver ? null : (bloco.match(/^<button\b[^>]*?\skey=(\{[^}]*\}|"[^"]*")/) ?? [])[1];
    const novo =
      `<Permissao${key ? ` key=${key}` : ''} chave="${a.chave}" rotulo="${a.rotulo}" herda="${a.herda}">\n` +
      `${indent}  ${bloco.replace(/\n/g, '\n  ')}\n${indent}</Permissao>`;
    s = s.slice(0, a.ini) + novo + s.slice(a.fim);
    console.log(`marcado ${arq}:${a.linha} → ${a.chave}`);
  }
  if (!/import\s*\{[^}]*\bPermissao\b[^}]*\}\s*from/.test(s)) {
    const rel = arq.split('/').slice(1, -1).map(() => '..').join('/');
    const imp = `${rel}/lib/permissoes/Permissao`.replace(/^\/?/, '');
    const ultimaImport = [...s.matchAll(/^import[\s\S]*?from\s+['"][^'"]+['"];?[ \t]*$/gm)].pop();
    const pos = ultimaImport ? ultimaImport.index + ultimaImport[0].length : 0;
    s = s.slice(0, pos) + `\nimport { Permissao } from '${imp.startsWith('.') ? imp : './' + imp}';` + s.slice(pos);
  }
  fs.writeFileSync(arq, s);
}
