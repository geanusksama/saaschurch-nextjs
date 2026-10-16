/**
 * Confere as marcações já aplicadas: cada <Permissao> gerado deve embrulhar
 * EXATAMENTE um <button> (com ou sem filhos). Pega o defeito em que um
 * `<button ... />` fazia o marcador engolir o botão seguinte junto — JSX
 * válido, que o TypeScript não acusa, mas com o segundo botão escondido sob
 * a chave do primeiro.
 *
 *   node scripts/verificar-marcacoes.mjs   (sai com erro se achar problema)
 */
import fs from 'node:fs';
import path from 'node:path';
import { encontrarBotoes, semComentarios } from './lib/botoes.mjs';

const RAIZ = process.cwd();
const arquivos = [];
(function andar(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) andar(p);
    else if (e.name.endsWith('.tsx')) arquivos.push(p);
  }
})(path.join(RAIZ, 'src'));

let blocos = 0;
const problemas = [];
for (const arq of arquivos) {
  const txt = semComentarios(fs.readFileSync(arq, 'utf8'));
  const rel = path.relative(RAIZ, arq).split(path.sep).join('/');
  let i = txt.indexOf('<Permissao ');
  while (i >= 0) {
    // fim da abertura do <Permissao ...>
    const abre = txt.indexOf('>', i);
    // fechamento correspondente (sem aninhamento de <Permissao> nas marcações geradas)
    const fecha = txt.indexOf('</Permissao>', abre);
    if (fecha < 0) { problemas.push(`${rel}: <Permissao> sem fechamento`); break; }
    const dentro = txt.slice(abre + 1, fecha);
    if (!dentro.includes('<Permissao ')) {
      blocos++;
      const botoes = encontrarBotoes(dentro);
      const sobra = botoes.length === 1 ? dentro.replace(botoes[0].bloco, '').trim() : null;
      // Exceção: um único componente (<ReportsTabButton ... />) embrulhado à mão.
      const componenteUnico = botoes.length === 0 && /^<[A-Z]\w*\b[\s\S]*\/>$/.test(dentro.trim()) && !dentro.includes('<button');
      if (!componenteUnico && (botoes.length !== 1 || sobra)) {
        const linha = txt.slice(0, i).split('\n').length;
        problemas.push(`${rel}:${linha}: ${botoes.length} botão(ões) dentro${sobra ? ' + conteúdo extra' : ''}`);
      }
    }
    i = txt.indexOf('<Permissao ', i + 10);
  }
}
if (problemas.length) {
  console.error(`${problemas.length} <Permissao> com problema (de ${blocos}):`);
  for (const p of problemas) console.error('  - ' + p);
  process.exit(1);
}
console.log(`Marcações ok: ${blocos} <Permissao>, cada um com exatamente um botão.`);
