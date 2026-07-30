/**
 * Markdown mínimo dos artigos da Central de Ajuda.
 *
 * Só o que os artigos realmente usam: `##`, `###`, listas com `- `, listas
 * numeradas, **negrito**, `código` e imagens `![alt](url)`. Uma biblioteca
 * inteira para isso seria peso morto — e um renderizador irrestrito num texto
 * que a IA também produz abriria porta para HTML injetado.
 *
 * Imagem serve para os prints das telas: coloque o arquivo em `public/help/` e
 * referencie como `![Tela de Campanhas vazia](/help/campanhas-vazia.png)`.
 */

interface Props {
  text: string;
  /** versão apertada, usada dentro do balão de resposta da IA */
  compacto?: boolean;
}

const IMG_RE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;

/**
 * Junta as linhas que são continuação da anterior.
 *
 * Os artigos são escritos com quebra em ~80 colunas para caberem no código. Sem
 * isso, a segunda linha de um item de lista virava parágrafo solto fora do
 * marcador — era o que aparecia na tela: "batismo, consagração, transferência"
 * pendurado embaixo do item.
 *
 * Quebra de bloco = linha em branco, cabeçalho, imagem ou início de item.
 */
function juntarLinhas(linhas: string[]): string[] {
  const inicioDeBloco = (l: string) =>
    !l.trim() ||
    l.startsWith('#') ||
    l.trim().startsWith('- ') ||
    /^\d+\.\s/.test(l.trim()) ||
    IMG_RE.test(l.trim());

  const saida: string[] = [];
  for (const linha of linhas) {
    const anterior = saida[saida.length - 1];
    if (
      saida.length &&
      anterior?.trim() &&
      !inicioDeBloco(linha) &&
      !IMG_RE.test(anterior.trim())
    ) {
      saida[saida.length - 1] = `${anterior.replace(/\s+$/, '')} ${linha.trim()}`;
      continue;
    }
    saida.push(linha);
  }
  return saida;
}

export function HelpMarkdown({ text, compacto = false }: Props) {
  const linhas = juntarLinhas(text.trim().split('\n'));
  const corpo = compacto ? 'text-[13px]' : 'text-sm';

  const inline = (s: string) =>
    s
      .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
      .map((parte, i) => {
        if (parte.startsWith('**') && parte.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold text-slate-800 dark:text-slate-100">
              {parte.slice(2, -2)}
            </strong>
          );
        }
        if (parte.startsWith('`') && parte.endsWith('`')) {
          return (
            <code key={i} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em] dark:bg-slate-700">
              {parte.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{parte}</span>;
      });

  const blocos: React.ReactNode[] = [];
  let lista: string[] = [];
  let numerada = false;

  const fecharLista = () => {
    if (!lista.length) return;
    const Tag = numerada ? 'ol' : 'ul';
    blocos.push(
      <Tag key={`l-${blocos.length}`} className="my-3 space-y-1.5 pl-5">
        {lista.map((item, i) => (
          <li
            key={i}
            className={`${numerada ? 'list-decimal' : 'list-disc'} ${corpo} leading-relaxed text-slate-600 dark:text-slate-300`}
          >
            {inline(item)}
          </li>
        ))}
      </Tag>
    );
    lista = [];
  };

  linhas.forEach((linha, i) => {
    const l = linha.trim();

    const img = l.match(IMG_RE);
    if (img) {
      fecharLista();
      blocos.push(
        <figure key={i} className="my-4">
          {/* next/image nao serve aqui: o caminho vem do texto do artigo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img[2]}
            alt={img[1]}
            loading="lazy"
            className="w-full rounded-lg border border-slate-200 shadow-sm dark:border-slate-700"
          />
          {img[1] ? (
            <figcaption className="mt-1.5 text-center text-[11px] text-slate-400">{img[1]}</figcaption>
          ) : null}
        </figure>
      );
      return;
    }

    if (l.startsWith('- ')) {
      if (numerada) fecharLista();
      numerada = false;
      lista.push(l.slice(2));
      return;
    }
    const num = l.match(/^\d+\.\s+(.*)$/);
    if (num) {
      if (!numerada) fecharLista();
      numerada = true;
      lista.push(num[1]);
      return;
    }

    fecharLista();
    if (!l) return;

    if (l.startsWith('### ')) {
      blocos.push(
        <h4 key={i} className="mb-1 mt-5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {l.slice(4)}
        </h4>
      );
    } else if (l.startsWith('## ')) {
      blocos.push(
        <h3 key={i} className="mb-1 mt-6 text-base font-bold text-slate-800 dark:text-slate-100">
          {l.slice(3)}
        </h3>
      );
    } else {
      blocos.push(
        <p key={i} className={`my-3 ${corpo} leading-relaxed text-slate-600 dark:text-slate-300`}>
          {inline(l)}
        </p>
      );
    }
  });
  fecharLista();

  return <div>{blocos}</div>;
}

export default HelpMarkdown;
