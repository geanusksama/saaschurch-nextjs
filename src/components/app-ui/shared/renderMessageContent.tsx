/**
 * Renderização do conteúdo de uma mensagem do assistente de IA.
 *
 * A IA devolve links markdown ([Relatório](/temp-reports/x.pdf)) quando gera
 * PDF/Excel; sem isso o usuário veria os colchetes em vez de um link para
 * baixar o arquivo.
 *
 * Vivia dentro do widget AiChatAssistant. O widget saiu da barra superior —
 * o chat agora é a tela Assistentes (Finanças) — e este pedaço ficou.
 */
import React from 'react';

export function renderMessageContent(content: string) {
  if (!content) return null;

  // Regex to match Markdown links: [Link Text](URL)
  const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = mdLinkRegex.exec(content)) !== null) {
    const text = match[1];
    const url = match[2];
    
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    // Resolve URL to current host origin
    let absoluteUrl = url;
    if (url.startsWith('/')) {
      absoluteUrl = window.location.origin + url;
    } else if (url.includes('temp-reports/')) {
      const fileName = url.split('temp-reports/').pop();
      absoluteUrl = `${window.location.origin}/temp-reports/${fileName}`;
    }

    // Gráfico gerado pela IA: mostra a imagem na conversa. Como link, o usuário
    // teria de abrir outra aba para ver o que acabou de pedir.
    if (/\.(svg|png|jpe?g)$/i.test(url.split('?')[0])) {
      parts.push(
        <a
          key={match.index}
          href={absoluteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block my-2"
          title="Abrir em tamanho cheio"
        >
          <img
            src={absoluteUrl}
            alt={text}
            className="max-w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white"
          />
        </a>
      );
      lastIndex = mdLinkRegex.lastIndex;
      continue;
    }

    // Add the link element
    parts.push(
      <a 
        key={match.index} 
        href={absoluteUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold underline inline-flex items-center gap-1 mx-0.5"
        download
      >
        {text}
      </a>
    );

    lastIndex = mdLinkRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  if (parts.length === 0) {
    return content;
  }

  return <>{parts}</>;
}
