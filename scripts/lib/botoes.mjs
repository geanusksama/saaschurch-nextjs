/**
 * O que é um "botão de ação" — definição ÚNICA usada pela auditoria
 * (scripts/auditar-permissoes.mjs) e pelo marcador (scripts/marcar-permissoes.mjs).
 * Se os dois divergissem, a foto da auditoria contaria uma coisa e o marcador
 * marcaria outra.
 */

export const PALAVRAS =
  /\b(Salvar|Atualizar modelo|Excluir|Remover|Apagar|Exportar|Imprimir|Excel|PDF|CSV|Baixar|Download|Importar|Novo|Nova|Adicionar|Cadastrar|Criar|Editar|Duplicar|Aprovar|Reprovar|Recusar|Enviar|Gerar|Lançar|Estornar|Conciliar|Transferir|Publicar)\b/i;

/** Verbo de ação no nome da função chamada pelo onClick. */
export const HANDLER =
  /onClick=\{[^}]*?\b(?:handle)?(save|salvar|delete|excluir|remove|remover|export|exportar|print|imprimir|download|baixar|import|importar|create|criar|novo|add|adicionar|edit|editar|duplicate|duplicar|approve|aprovar|reject|reprovar|send|enviar|gerar|generate|lancar|estornar)/i;

export function semComentarios(txt) {
  return txt
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, ' '));
}

/**
 * Separa <button ...atributos...> do conteúdo. O fim da abertura é o ">" no
 * nível zero de chaves e fora de aspas — o "=>" de um onClick NÃO fecha a tag.
 */
export function separarBotao(bloco) {
  if (/\/>\s*$/.test(bloco) && !/<\/button>\s*$/.test(bloco)) return { abertura: bloco, corpo: '' };
  let prof = 0;
  let aspas = null;
  for (let i = 7; i < bloco.length; i++) {
    const c = bloco[i];
    if (aspas) {
      if (c === aspas && bloco[i - 1] !== '\\') aspas = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') aspas = c;
    else if (c === '{') prof++;
    else if (c === '}') prof--;
    else if (c === '>' && prof === 0) {
      return {
        abertura: bloco.slice(0, i + 1),
        corpo: bloco.slice(i + 1).replace(/<\/button>\s*$/, ''),
      };
    }
  }
  return { abertura: bloco, corpo: '' };
}

/** Texto que a pessoa lê no botão (sem código, sem tags, sem classes). */
export function textoVisivel(corpo) {
  // 1º as tags (ícones, spinners) com seus atributos: className não é texto.
  let t = corpo.replace(/<[^<>]*>/g, ' ');
  // Operando de comparação não é texto da tela (salvando === 'sede').
  t = t
    .replace(/(===|!==|==|!=)\s*(['"])[^'"]*\2/g, ' ')
    .replace(/(['"])[^'"]*\1\s*(===|!==|==|!=)/g, ' ');
  // Expressões, de dentro para fora: só os textos literais contam
  // ({x ? 'Salvando...' : 'Salvar'}); o literal sobe entre aspas para o nível de cima.
  for (let i = 0; i < 6 && /\{[^{}]*\}/.test(t); i++) {
    t = t.replace(/\{[^{}]*\}/g, (m) =>
      ' ' + [...m.matchAll(/(['"])([^'"`{}<>$]{1,60})\1/g)].map((x) => x[2].trim()).filter(Boolean).map((x) => `'${x}'`).join(' ') + ' ',
    );
  }
  return (
    t
      .replace(/'/g, ' ')
      .replace(/&#?\w+;/g, ' ') // entidade HTML (&#128438;) não é texto do rótulo
      .replace(/[{}`$]/g, ' ')
      // Estado de espera não é rótulo: "Salvando..." / "Excluindo…".
      .replace(/\b[\wÀ-ú]+(?:ando|endo|indo)\s*(?:\.{3}|…)/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export function tituloDe(abertura) {
  return (abertura.match(/\b(?:title|aria-label)=["']([^"'$`]{2,60})["']/) ?? [])[1] ?? '';
}

/** É botão de ação? Texto visível, title/aria-label ou verbo do handler. */
export function ehBotaoDeAcao(bloco) {
  const { abertura, corpo } = separarBotao(bloco);
  return PALAVRAS.test(textoVisivel(corpo)) || PALAVRAS.test(tituloDe(abertura)) || HANDLER.test(abertura);
}

/** Fim da tag de abertura que começa em `ini` (">" fora de chaves/aspas). */
function fimDaAbertura(txt, ini) {
  let prof = 0;
  let aspas = null;
  for (let i = ini + 1; i < txt.length; i++) {
    const c = txt[i];
    if (aspas) {
      if (c === aspas && txt[i - 1] !== '\\') aspas = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') aspas = c;
    else if (c === '{') prof++;
    else if (c === '}') prof--;
    else if (c === '>' && prof === 0) return i;
  }
  return -1;
}

/**
 * Todos os <button> do texto, cada um com o bloco EXATO: `<button ... />`
 * (fecha em si) termina na própria tag — um regex até o próximo
 * `</button>` engolia o botão seguinte junto e quebrava o JSX.
 */
export function encontrarBotoes(txt) {
  const out = [];
  let i = txt.indexOf('<button');
  while (i >= 0) {
    if (/[\s>/]/.test(txt[i + 7] ?? '')) {
      const fimAb = fimDaAbertura(txt, i);
      if (fimAb < 0) break;
      let fim;
      if (txt[fimAb - 1] === '/') fim = fimAb + 1;
      else {
        const fecha = txt.indexOf('</button>', fimAb);
        if (fecha < 0) break;
        fim = fecha + '</button>'.length;
      }
      out.push({ index: i, bloco: txt.slice(i, fim), autoFecha: txt[fimAb - 1] === '/' });
      i = txt.indexOf('<button', i + 7);
    } else {
      i = txt.indexOf('<button', i + 7);
    }
  }
  return out;
}

/** Já está dentro de um <Permissao> aberto antes dele? */
export function jaMarcado(txt, indice) {
  const antes = txt.slice(Math.max(0, indice - 400), indice);
  const ab = antes.lastIndexOf('<Permissao');
  return ab >= 0 && ab > antes.lastIndexOf('</Permissao>');
}
