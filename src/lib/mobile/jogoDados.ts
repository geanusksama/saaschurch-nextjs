/**
 * Conteúdo dos jogos do App Igreja v3 — o JSON que o app lê em
 * appv3_jogos_conteudo.dados (appv3/app/lib/features/games/jogos_page.dart):
 *
 *   QUIZ      {pergunta, opcoes[4], correta}        correta = índice 0..3
 *   VF        {afirmacao, verdadeiro}
 *   FORCA     {palavra, dica}
 *   CRUZADAS  {grade[], numeros{índice: rótulo}, horizontais[], verticais[]}
 *             grade: uma string por linha, '.' = casa preta; índice = linha*colunas+coluna
 *
 * Ninguém digita JSON: o painel mostra um formulário por jogo e estas funções
 * montam e validam o JSON. Nas cruzadas a pessoa informa só as palavras (com
 * dica, direção e posição) e a grade sai daqui; a lista vai junto em
 * `palavras` (o app ignora) para a edição reabrir o formulário.
 *
 * Sem import de servidor: roda na tela e na API (que valida de novo).
 */

export type Jogo = 'QUIZ' | 'VF' | 'FORCA' | 'CRUZADAS';

export interface PalavraCruzada {
  palavra: string;
  dica: string;
  direcao: 'H' | 'V';
  /** 1 = primeira linha/coluna */
  linha: number;
  coluna: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dados = Record<string, any>;

const MAX_GRADE = 12;

/** Maiúsculas sem acento nem espaço: é o que o teclado do jogo digita. */
export function letras(s: string): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
}

export function vazioDoJogo(jogo: string): Dados {
  switch (jogo) {
    case 'VF': return { afirmacao: '', verdadeiro: true };
    case 'FORCA': return { palavra: '', dica: '' };
    case 'CRUZADAS': return { palavras: [{ palavra: '', dica: '', direcao: 'H', linha: 1, coluna: 1 }] };
    default: return { pergunta: '', opcoes: ['', '', '', ''], correta: 0 };
  }
}

/** Monta grade, números e listas de dicas a partir das palavras. */
export function montarCruzada(palavrasBrutas: PalavraCruzada[]): { dados?: Dados; erro?: string } {
  const palavras = palavrasBrutas
    .map((p) => ({ ...p, palavra: letras(p.palavra), dica: String(p.dica ?? '').trim(), linha: Number(p.linha), coluna: Number(p.coluna) }))
    .filter((p) => p.palavra || p.dica);
  if (palavras.length < 2) return { erro: 'Cadastre pelo menos 2 palavras.' };
  for (const [i, p] of palavras.entries()) {
    const n = `Palavra ${i + 1}`;
    if (p.palavra.length < 2) return { erro: `${n}: precisa de pelo menos 2 letras.` };
    if (!p.dica) return { erro: `${n}: escreva a dica.` };
    if (!Number.isInteger(p.linha) || !Number.isInteger(p.coluna) || p.linha < 1 || p.coluna < 1) return { erro: `${n}: linha e coluna começam em 1.` };
  }
  let linhas = 0, colunas = 0;
  for (const p of palavras) {
    linhas = Math.max(linhas, p.direcao === 'V' ? p.linha + p.palavra.length - 1 : p.linha);
    colunas = Math.max(colunas, p.direcao === 'H' ? p.coluna + p.palavra.length - 1 : p.coluna);
  }
  if (linhas > MAX_GRADE || colunas > MAX_GRADE) return { erro: `A grade passou de ${MAX_GRADE}×${MAX_GRADE} (cabe no celular). Mude a posição ou encurte as palavras.` };

  const g: string[][] = Array.from({ length: linhas }, () => Array(colunas).fill('.'));
  for (const [i, p] of palavras.entries()) {
    for (let k = 0; k < p.palavra.length; k++) {
      const l = p.linha - 1 + (p.direcao === 'V' ? k : 0);
      const c = p.coluna - 1 + (p.direcao === 'H' ? k : 0);
      if (g[l][c] !== '.' && g[l][c] !== p.palavra[k]) {
        return { erro: `Palavra ${i + 1} (${p.palavra}) cruza outra na linha ${l + 1}, coluna ${c + 1} com letra diferente (${g[l][c]} × ${p.palavra[k]}).` };
      }
      g[l][c] = p.palavra[k];
    }
  }

  // Número por casa inicial, em ordem de leitura; H e V na mesma casa dividem o número.
  const inicios = [...new Set(palavras.map((p) => (p.linha - 1) * colunas + (p.coluna - 1)))].sort((a, b) => a - b);
  const numeroDe = new Map(inicios.map((idx, i) => [idx, i + 1]));
  const numeros: Record<string, string> = {};
  for (const [idx, n] of numeroDe) numeros[String(idx)] = String(n);
  const dicas = (dir: 'H' | 'V') =>
    palavras
      .filter((p) => p.direcao === dir)
      .map((p) => ({ n: numeroDe.get((p.linha - 1) * colunas + (p.coluna - 1))!, dica: p.dica }))
      .sort((a, b) => a.n - b.n)
      .map((x) => `${x.n}. ${x.dica}`);

  return {
    dados: {
      grade: g.map((r) => r.join('')),
      numeros,
      horizontais: dicas('H'),
      verticais: dicas('V'),
      palavras: palavras.map(({ palavra, dica, direcao, linha, coluna }) => ({ palavra, dica, direcao, linha, coluna })),
    },
  };
}

/** Cruzada antiga (sem `palavras`): reconstrói a lista a partir da grade. */
export function palavrasDaCruzada(d: Dados): PalavraCruzada[] {
  if (Array.isArray(d?.palavras)) return d.palavras;
  const grade: string[] = Array.isArray(d?.grade) ? d.grade.map((r: string) => String(r).toUpperCase()) : [];
  if (!grade.length) return vazioDoJogo('CRUZADAS').palavras;
  const colunas = Math.max(...grade.map((r) => r.length));
  const cel = (l: number, c: number) => (l >= 0 && l < grade.length && c >= 0 && c < colunas ? grade[l][c] ?? '.' : '.');
  const dicaDe = (lista: unknown, n: string) => {
    const achada = (Array.isArray(lista) ? lista : []).map(String).find((t) => t.startsWith(`${n}.`) || t.startsWith(`${n} `));
    return achada ? achada.replace(/^\s*\d+\s*[.)-]?\s*/, '') : '';
  };
  const out: PalavraCruzada[] = [];
  for (const [idxS, n] of Object.entries((d.numeros ?? {}) as Record<string, string>)) {
    const idx = Number(idxS), l = Math.floor(idx / colunas), c = idx % colunas;
    const ler = (dl: number, dc: number) => {
      let s = '', k = 0;
      while (cel(l + dl * k, c + dc * k) !== '.') { s += cel(l + dl * k, c + dc * k); k++; }
      return s;
    };
    if (cel(l, c - 1) === '.' && cel(l, c + 1) !== '.') out.push({ palavra: ler(0, 1), dica: dicaDe(d.horizontais, String(n)), direcao: 'H', linha: l + 1, coluna: c + 1 });
    if (cel(l - 1, c) === '.' && cel(l + 1, c) !== '.') out.push({ palavra: ler(1, 0), dica: dicaDe(d.verticais, String(n)), direcao: 'V', linha: l + 1, coluna: c + 1 });
  }
  return out.length ? out : vazioDoJogo('CRUZADAS').palavras;
}

/** Valida (e, nas cruzadas, monta) o JSON final do jogo. */
export function prepararJogo(jogo: string, d: Dados): { dados?: Dados; erro?: string } {
  const t = (v: unknown) => String(v ?? '').trim();
  switch (jogo) {
    case 'QUIZ': {
      const opcoes = (Array.isArray(d?.opcoes) ? d.opcoes : []).map(t);
      if (!t(d?.pergunta)) return { erro: 'Escreva a pergunta.' };
      if (opcoes.length !== 4 || opcoes.some((o: string) => !o)) return { erro: 'Preencha as 4 alternativas.' };
      const correta = Number(d?.correta);
      if (!Number.isInteger(correta) || correta < 0 || correta > 3) return { erro: 'Marque a alternativa correta.' };
      return { dados: { pergunta: t(d.pergunta), opcoes, correta } };
    }
    case 'VF':
      if (!t(d?.afirmacao)) return { erro: 'Escreva a afirmação.' };
      return { dados: { afirmacao: t(d.afirmacao), verdadeiro: d?.verdadeiro === true || d?.verdadeiro === 'true' } };
    case 'FORCA': {
      const palavra = letras(d?.palavra);
      if (palavra.length < 3) return { erro: 'A palavra da forca precisa de pelo menos 3 letras.' };
      if (!t(d?.dica)) return { erro: 'Escreva a dica.' };
      return { dados: { palavra, dica: t(d.dica) } };
    }
    case 'CRUZADAS':
      return montarCruzada(Array.isArray(d?.palavras) ? d.palavras : palavrasDaCruzada(d));
    default:
      return { erro: 'Escolha o jogo.' };
  }
}

/** Texto curto para a lista do painel. */
export function resumoJogo(d: Dados): string | null {
  if (!d) return null;
  if (d.pergunta) return d.pergunta;
  if (d.afirmacao) return `${d.afirmacao} (${d.verdadeiro ? 'V' : 'F'})`;
  if (d.palavra) return `${d.palavra} — ${d.dica ?? ''}`;
  if (Array.isArray(d.grade)) return palavrasDaCruzada(d).map((p) => p.palavra).join(', ');
  return null;
}
