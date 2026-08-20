/**
 * Renderização do conteúdo de uma mensagem do assistente de IA.
 *
 * A IA responde em markdown — tabelas, títulos, negrito, listas. Sem isto o
 * chat mostrava o texto cru: `**`, `###` e `|---|---|` na cara de quem
 * perguntou, com a tabela desmontada. Aqui o markdown vira HTML de verdade.
 *
 * É um renderizador PEQUENO e proposital, não um parser de markdown completo:
 * cobre o que a IA usa nas respostas (título, negrito, itálico, código,
 * tabela, lista, citação, link e imagem) e ignora o resto. Nada de HTML vindo
 * do texto é interpretado — o conteúdo entra sempre como texto do React, então
 * não há caminho para injeção.
 *
 * Vivia dentro do widget AiChatAssistant. O widget saiu da barra superior —
 * o chat agora é a tela Assistentes (Finanças) — e este pedaço ficou.
 */
import React from 'react';

/**
 * Formatação dentro de uma linha: **negrito**, *itálico*, `código`, links e
 * imagens.
 *
 * Reentrante de propósito: a IA escreve o link dentro do negrito
 * (`**[Baixar PDF](/temp-reports/x.pdf)**`). Sem reprocessar o miolo, o ramo
 * do negrito engolia o link e ele virava texto cru — clicável em lugar nenhum.
 */
function renderInline(texto: string, keyBase: string, profundidade = 0): React.ReactNode[] {
  const partes: React.ReactNode[] = [];
  // Um regex só, para a ordem de precedência ficar explícita e previsível.
  const regex = /(!?)\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|(?<!\*)\*([^*\n]+)\*(?!\*)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(texto)) !== null) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    const chave = `${keyBase}-${m.index}`;

    if (m[2] !== undefined && m[3] !== undefined) {
      const rotulo = m[2];
      const url = m[3];
      // URL relativa do sistema resolvida contra o host atual
      let absoluta = url;
      if (url.startsWith('/')) {
        absoluta = window.location.origin + url;
      } else if (url.includes('temp-reports/')) {
        absoluta = `${window.location.origin}/temp-reports/${url.split('temp-reports/').pop()}`;
      }

      const ehImagem = m[1] === '!' || /\.(svg|png|jpe?g|gif|webp)$/i.test(url.split('?')[0]);
      if (ehImagem) {
        // Gráfico gerado pela IA: aparece na conversa. Como link, o usuário
        // teria de abrir outra aba para ver o que acabou de pedir.
        partes.push(
          <a key={chave} href={absoluta} target="_blank" rel="noopener noreferrer" className="block my-2" title="Abrir em tamanho cheio">
            <img src={absoluta} alt={rotulo} className="max-w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white" />
          </a>
        );
      } else {
        partes.push(
          <a
            key={chave}
            href={absoluta}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold underline inline-flex items-center gap-1 mx-0.5"
            download
          >
            {rotulo}
          </a>
        );
      }
    } else if (m[4] !== undefined || m[5] !== undefined) {
      const miolo = (m[4] ?? m[5]) as string;
      partes.push(
        <strong key={chave} className="font-bold">
          {profundidade < 3 ? renderInline(miolo, `${chave}-b`, profundidade + 1) : miolo}
        </strong>
      );
    } else if (m[6] !== undefined) {
      partes.push(
        <code key={chave} className="px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/70 text-[0.9em] font-mono">
          {m[6]}
        </code>
      );
    } else if (m[7] !== undefined) {
      partes.push(
        <em key={chave}>
          {profundidade < 3 ? renderInline(m[7], `${chave}-i`, profundidade + 1) : m[7]}
        </em>
      );
    }

    ultimo = regex.lastIndex;
  }

  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

/** Linha de tabela markdown → células, sem os pipes das pontas. */
function celulas(linha: string): string[] {
  return linha.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
}

const ehLinhaTabela = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const ehSeparadorTabela = (l: string) => /^\s*\|[\s:|-]+\|\s*$/.test(l);

export function renderMessageContent(content: string) {
  if (!content) return null;

  const linhas = content.split('\n');
  const blocos: React.ReactNode[] = [];
  let i = 0;

  while (i < linhas.length) {
    const linha = linhas[i];

    // ── Tabela ──
    if (ehLinhaTabela(linha) && i + 1 < linhas.length && ehSeparadorTabela(linhas[i + 1])) {
      const cabecalho = celulas(linha);
      i += 2;
      const corpo: string[][] = [];
      while (i < linhas.length && ehLinhaTabela(linhas[i])) {
        corpo.push(celulas(linhas[i]));
        i++;
      }
      blocos.push(
        // Tabela larga rola dentro do próprio balão, sem esticar o chat.
        <div key={`tab-${i}`} className="my-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800">
                {cabecalho.map((c, idx) => (
                  <th key={idx} className="text-left font-bold px-2.5 py-1.5 whitespace-nowrap border-b border-slate-200 dark:border-slate-700">
                    {renderInline(c, `th-${idx}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corpo.map((linhaCorpo, l) => (
                <tr key={l} className="odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-800/40">
                  {linhaCorpo.map((c, idx) => (
                    <td key={idx} className="px-2.5 py-1.5 align-top border-b border-slate-100 dark:border-slate-800">
                      {renderInline(c, `td-${l}-${idx}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // ── Título ──
    const titulo = linha.match(/^(#{1,6})\s+(.*)$/);
    if (titulo) {
      const nivel = titulo[1].length;
      blocos.push(
        <p key={`h-${i}`} className={`font-bold mt-3 mb-1 ${nivel <= 2 ? 'text-base' : 'text-sm'}`}>
          {renderInline(titulo[2], `h-${i}`)}
        </p>
      );
      i++;
      continue;
    }

    // ── Linha divisória ──
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(linha)) {
      blocos.push(<hr key={`hr-${i}`} className="my-3 border-slate-200 dark:border-slate-700" />);
      i++;
      continue;
    }

    // ── Lista (com marcador ou numerada) ──
    if (/^\s*([-*+]|\d+\.)\s+/.test(linha)) {
      const numerada = /^\s*\d+\.\s+/.test(linha);
      const itens: string[] = [];
      while (i < linhas.length && /^\s*([-*+]|\d+\.)\s+/.test(linhas[i])) {
        itens.push(linhas[i].replace(/^\s*([-*+]|\d+\.)\s+/, ''));
        i++;
      }
      const Lista: any = numerada ? 'ol' : 'ul';
      blocos.push(
        <Lista key={`li-${i}`} className={`my-1.5 pl-5 space-y-0.5 ${numerada ? 'list-decimal' : 'list-disc'}`}>
          {itens.map((item, idx) => <li key={idx}>{renderInline(item, `li-${i}-${idx}`)}</li>)}
        </Lista>
      );
      continue;
    }

    // ── Citação ──
    if (/^\s*>\s?/.test(linha)) {
      blocos.push(
        <p key={`q-${i}`} className="my-1.5 pl-3 border-l-2 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400">
          {renderInline(linha.replace(/^\s*>\s?/, ''), `q-${i}`)}
        </p>
      );
      i++;
      continue;
    }

    // ── Linha em branco ──
    if (!linha.trim()) {
      blocos.push(<div key={`br-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // ── Parágrafo ──
    blocos.push(<p key={`p-${i}`} className="my-0.5">{renderInline(linha, `p-${i}`)}</p>);
    i++;
  }

  return <>{blocos}</>;
}
