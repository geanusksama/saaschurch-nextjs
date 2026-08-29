/**
 * Readmissão: qual título a pessoa recupera ao voltar.
 *
 * O sistema decidia isso sozinho — pegava o último título do histórico — e
 * errava em casos reais: quem era PRESBITERO voltou DIACONO, quem já era MEMBRO
 * voltou CONGREGADO, quem era EVANGELISTA voltou MEMBRO. O histórico legado é
 * torto demais (título real gravado em `previous_title`, linhas com "SIM" no
 * lugar do título, datas empatadas) para uma dedução automática ser confiável.
 *
 * Então a decisão passou a ser humana: ao escolher um serviço de readmissão,
 * a tela mostra o histórico de títulos do membro e a secretaria confirma para
 * qual deles ele volta. O que foi confirmado é o que vale, na ocorrência rápida
 * (aplicada na hora) e no card do kanban (gravado em `intended_title` e usado
 * quando o card é movido).
 *
 * ── Os grupos de título vêm do NÍVEL do catálogo ────────────────────────────
 *
 * `ecclesiastical_titles` (seed em
 * prisma/migrations/20260430214500_ecclesiastical_titles_and_member_defaults):
 *
 *   0  CONGREGADO, MEMBRO
 *   1  COOPERADOR, COOPERADORA
 *   2  DIACONO, DIACONISA
 *   3  PRESBITERO
 *   4  EVANGELISTA, MISSIONARIA, MISSIONARIO
 *   5  PASTOR, PASTORA
 *  47  BISPO
 *
 * Daí o recorte de cada serviço: READOBR (obreiros) são os níveis 2 e 3;
 * READOMN (ministros) é 4 para cima; READMEM (membros) é 0 e 1.
 *
 * O nível é usado — e não `is_ecclesiastical_minister` ou `allow_men` /
 * `allow_women` — porque essas colunas estão inconsistentes na base: PASTOR tem
 * `is_ecclesiastical_minister = false` e `allow_men = false`, MISSIONARIA tem
 * `allow_men = true`. O nível é o único campo coerente com a hierarquia.
 *
 * O recorte só ordena a lista de sugestões do catálogo. Nenhum título que esteja
 * no histórico do membro é escondido: se a pessoa foi PASTOR e a secretaria abre
 * uma readmissão de obreiro, PASTOR aparece assim mesmo, porque esconder o que
 * de fato aconteceu é o que produziu os erros que este módulo corrige.
 */

/** Recorte de títulos esperado por um serviço de readmissão. */
export type EscopoDeTitulo = "MEMBRO" | "OBREIRO" | "MINISTRO";

const SEM_ACENTO = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

/** Faixa de `level` do catálogo que cada recorte aceita. */
export const FAIXA_DE_NIVEL: Record<EscopoDeTitulo, { min: number; max: number }> = {
  MEMBRO: { min: 0, max: 1 },
  OBREIRO: { min: 2, max: 3 },
  MINISTRO: { min: 4, max: Number.MAX_SAFE_INTEGER },
};

export const ROTULO_DO_ESCOPO: Record<EscopoDeTitulo, string> = {
  MEMBRO: "Membros",
  OBREIRO: "Obreiros (diácono, diaconisa, presbítero)",
  MINISTRO: "Ministros (evangelista, missionária, pastor)",
};

type ServicoBasico = { sigla?: string | null; description?: string | null };

/**
 * O serviço é uma readmissão?
 *
 * As três siglas de produção são READMEM, READOBR e READOMN (ver
 * prisma/sql/readmissao_restaura_titulo.sql). A descrição é conferida junto
 * para o caso de a igreja cadastrar uma readmissão com outra sigla.
 */
export function ehServicoDeReadmissao(service: ServicoBasico | null | undefined): boolean {
  if (!service) return false;
  const sigla = SEM_ACENTO(service.sigla || "");
  if (["READMEM", "READOBR", "READOMN"].includes(sigla)) return true;
  return SEM_ACENTO(service.description || "").includes("READMISS");
}

/**
 * Recorte de títulos do serviço, ou null quando não dá para afirmar qual é —
 * nesse caso a tela mostra o catálogo inteiro em vez de chutar um grupo.
 */
export function escopoDoServico(service: ServicoBasico | null | undefined): EscopoDeTitulo | null {
  if (!service) return null;
  const sigla = SEM_ACENTO(service.sigla || "");
  if (sigla === "READMEM") return "MEMBRO";
  if (sigla === "READOBR") return "OBREIRO";
  if (sigla === "READOMN") return "MINISTRO";

  const descricao = SEM_ACENTO(service.description || "");
  if (!descricao.includes("READMISS")) return null;
  if (descricao.includes("MINISTRO")) return "MINISTRO";
  if (descricao.includes("OBREIRO")) return "OBREIRO";
  if (descricao.includes("MEMBRO")) return "MEMBRO";
  return null;
}

/** O título cabe no recorte do serviço? Usado só para ordenar e avisar. */
export function tituloCabeNoEscopo(level: number, escopo: EscopoDeTitulo | null): boolean {
  if (!escopo) return true;
  const faixa = FAIXA_DE_NIVEL[escopo];
  return level >= faixa.min && level <= faixa.max;
}
