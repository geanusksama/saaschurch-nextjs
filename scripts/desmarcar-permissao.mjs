/**
 * Desfaz uma marcação <Permissao> gerada pelo marcador, devolvendo o botão
 * exatamente como era (remove o embrulho e a indentação extra de 2 espaços).
 * Para os casos revisados à mão como NÃO sendo ação (Voltar/Cancelar,
 * escolher ícone, buscar UF...).
 *
 *   node scripts/desmarcar-permissao.mjs <arquivo>:<linha-do-Permissao> [...]
 */
import fs from 'node:fs';

const porArquivo = new Map();
for (const a of process.argv.slice(2)) {
  const i = a.lastIndexOf(':');
  const arq = a.slice(0, i);
  porArquivo.set(arq, [...(porArquivo.get(arq) ?? []), Number(a.slice(i + 1))]);
}

for (const [arq, linhas] of porArquivo) {
  let s = fs.readFileSync(arq, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  // De baixo para cima: as linhas de cima não mudam de número.
  for (const linha of [...linhas].sort((a, b) => b - a)) {
    const L = s.split(nl);
    const ini = linha - 1;
    const m = L[ini].match(/^(\s*)<Permissao\b[^>]*>\s*$/);
    if (!m) throw new Error(`${arq}:${linha} não é uma abertura <Permissao> de linha única: ${L[ini].trim().slice(0, 80)}`);
    const indent = m[1];
    const fim = L.findIndex((l, j) => j > ini && l === `${indent}</Permissao>`);
    if (fim < 0) throw new Error(`${arq}:${linha} sem </Permissao> na mesma indentação`);
    const dentro = L.slice(ini + 1, fim).map((l) => (l.startsWith(indent + '  ') ? indent + l.slice(indent.length + 2) : l));
    if (!dentro[0].trimStart().startsWith('<button')) throw new Error(`${arq}:${linha} conteúdo não começa com <button>`);
    L.splice(ini, fim - ini + 1, ...dentro);
    s = L.join(nl);
    console.log(`desmarcado ${arq}:${linha}`);
  }
  fs.writeFileSync(arq, s);
}
