/**
 * Relatório impresso da Gestão de Culto.
 *
 * Monta um HTML próprio e manda para o diálogo de impressão do navegador, como
 * o resto do sistema já faz (ver src/app-ui/ebd/EbdRelatorios.tsx). Imprimir a
 * tela direto não serve: o Kanban, o organograma e os filtros não cabem numa
 * folha, e o que o dirigente leva para a reunião é uma tabela.
 *
 * As colunas são escolhidas por quem imprime — cada nível olha uma coisa: a
 * hospedeira quer status e pendência, o tesoureiro quer dízimo e oferta, o
 * secretário quer a contagem de presença. Fixar um conjunto só obrigaria a
 * imprimir tudo e riscar o resto à mão.
 */
import {
  fmtData,
  fmtHora,
  fmtMoeda,
  ROTULO_BLOCO,
  ROTULO_STATUS,
  type Registro,
} from './cultoApi';

export type Orientacao = 'retrato' | 'paisagem';

export interface ColunaRelatorio {
  chave: string;
  titulo: string;
  /** O que vai na célula. Já vem pronto para exibir. */
  valor: (r: Registro) => string;
  /** Alinha à direita e permite somar no rodapé. */
  numero?: boolean;
  /** Número cru da soma; sem isto a coluna não entra no total. */
  soma?: (r: Registro) => number | null;
  /** Vem marcada quando o modal abre. */
  padrao?: boolean;
  grupo: 'Culto' | 'Financeiro' | 'Presença' | 'Observações';
}

const fin = (r: Registro) => r.lancamentos.find((l) => l.bloco === 'FINANCEIRO');
const pre = (r: Registro) => r.lancamentos.find((l) => l.bloco === 'PRESENCA');

/** Número do lançamento como texto; vazio vira traço, não zero. */
function num(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : String(v);
}

export const COLUNAS_RELATORIO: ColunaRelatorio[] = [
  // A igreja vem primeiro: é por ela que se procura a linha na folha.
  { chave: 'igreja', titulo: 'Igreja', grupo: 'Culto', padrao: true, valor: (r) => r.church.name },
  { chave: 'data', titulo: 'Data', grupo: 'Culto', padrao: true, valor: (r) => fmtData(r.dataCulto) },
  {
    chave: 'horario',
    titulo: 'Horário',
    grupo: 'Culto',
    padrao: true,
    valor: (r) => fmtHora(r.horaInicio, r.horaFim) || '—',
  },
  {
    chave: 'status',
    titulo: 'Status',
    grupo: 'Culto',
    padrao: true,
    valor: (r) => ROTULO_STATUS[r.status],
  },
  {
    chave: 'hospedeira',
    titulo: 'Hospedeira',
    grupo: 'Culto',
    valor: (r) => r.hostChurch?.name ?? (r.church.isHost ? r.church.name : '—'),
  },
  { chave: 'regional', titulo: 'Regional', grupo: 'Culto', valor: (r) => r.regional?.name ?? '—' },
  {
    chave: 'dirigente',
    titulo: 'Dirigente',
    grupo: 'Culto',
    valor: (r) => r.church.currentLeaderName ?? '—',
  },
  {
    chave: 'pendencia',
    titulo: 'Falta enviar',
    grupo: 'Culto',
    padrao: true,
    valor: (r) =>
      r.blocosFaltando.length ? r.blocosFaltando.map((b) => ROTULO_BLOCO[b]).join(', ') : '—',
  },
  {
    chave: 'observacao',
    titulo: 'Obs. do culto',
    grupo: 'Culto',
    valor: (r) => r.observacao ?? '—',
  },
  // Uma coluna por voz: cada nível escreve num lugar diferente, e no papel eles
  // precisam aparecer separados para se saber de quem é o recado.
  {
    chave: 'obsTesoureiro',
    titulo: 'Obs. do tesoureiro',
    grupo: 'Observações',
    valor: (r) => fin(r)?.observacao ?? '—',
  },
  {
    chave: 'obsSecretario',
    titulo: 'Obs. do secretário',
    grupo: 'Observações',
    valor: (r) => pre(r)?.observacao ?? '—',
  },
  {
    chave: 'obsDirigente',
    titulo: 'Obs. do dirigente',
    grupo: 'Observações',
    valor: (r) => {
      const a = r.aprovacoes.find((x) => x.nivel === 'LOCAL');
      if (!a) return '—';
      const quem = a.aprovador?.fullName ? ` (${a.aprovador.fullName})` : '';
      return `${a.decisao === 'REJEITADO' ? 'Devolvido' : 'Aprovado'}${quem}${a.motivo ? `: ${a.motivo}` : ''}`;
    },
  },
  {
    chave: 'obsHospedeira',
    titulo: 'Obs. do hospedeiro',
    grupo: 'Observações',
    valor: (r) => {
      const a = r.aprovacoes.find((x) => x.nivel === 'HOSPEDEIRA');
      if (!a) return '—';
      const quem = a.aprovador?.fullName ? ` (${a.aprovador.fullName})` : '';
      return `${a.decisao === 'REJEITADO' ? 'Devolvido' : 'Aprovado'}${quem}${a.motivo ? `: ${a.motivo}` : ''}`;
    },
  },
  {
    chave: 'obsPresidente',
    titulo: 'Obs. do presidente',
    grupo: 'Observações',
    valor: (r) => r.observacaoPresidente ?? '—',
  },

  {
    chave: 'dizimos',
    titulo: 'Dízimos',
    grupo: 'Financeiro',
    padrao: true,
    numero: true,
    valor: (r) => fmtMoeda(fin(r)?.totalDizimos ?? null),
    soma: (r) => Number(fin(r)?.totalDizimos ?? 0),
  },
  {
    chave: 'ofertas',
    titulo: 'Ofertas',
    grupo: 'Financeiro',
    padrao: true,
    numero: true,
    valor: (r) => fmtMoeda(fin(r)?.totalOfertas ?? null),
    soma: (r) => Number(fin(r)?.totalOfertas ?? 0),
  },
  {
    chave: 'qtdDizimos',
    titulo: 'Qtd. dízimos',
    grupo: 'Financeiro',
    numero: true,
    valor: (r) => num(fin(r)?.qtdDizimos),
    soma: (r) => fin(r)?.qtdDizimos ?? 0,
  },

  {
    chave: 'homens',
    titulo: 'Homens',
    grupo: 'Presença',
    padrao: true,
    numero: true,
    valor: (r) => num(pre(r)?.qtdHomens),
    soma: (r) => pre(r)?.qtdHomens ?? 0,
  },
  {
    chave: 'mulheres',
    titulo: 'Mulheres',
    grupo: 'Presença',
    padrao: true,
    numero: true,
    valor: (r) => num(pre(r)?.qtdMulheres),
    soma: (r) => pre(r)?.qtdMulheres ?? 0,
  },
  {
    chave: 'criancas',
    titulo: 'Crianças',
    grupo: 'Presença',
    padrao: true,
    numero: true,
    valor: (r) => num(pre(r)?.qtdCriancas),
    soma: (r) => pre(r)?.qtdCriancas ?? 0,
  },
  {
    chave: 'visitantes',
    titulo: 'Visitantes',
    grupo: 'Presença',
    padrao: true,
    numero: true,
    valor: (r) => num(pre(r)?.qtdVisitantes),
    soma: (r) => pre(r)?.qtdVisitantes ?? 0,
  },
  {
    chave: 'conversoes',
    titulo: 'Conversões',
    grupo: 'Presença',
    padrao: true,
    numero: true,
    valor: (r) => num(pre(r)?.qtdConversoes),
    soma: (r) => pre(r)?.qtdConversoes ?? 0,
  },
  {
    chave: 'reconciliacoes',
    titulo: 'Reconciliações',
    grupo: 'Presença',
    numero: true,
    valor: (r) => num(pre(r)?.qtdReconciliacoes),
    soma: (r) => pre(r)?.qtdReconciliacoes ?? 0,
  },
  {
    chave: 'cadeiras',
    titulo: 'Cadeiras vazias',
    grupo: 'Presença',
    numero: true,
    valor: (r) => num(pre(r)?.cadeirasVazias),
    soma: (r) => pre(r)?.cadeirasVazias ?? 0,
  },
];

function escapar(valor: string): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface OpcoesRelatorio {
  registros: Registro[];
  /** Chaves de COLUNAS_RELATORIO, na ordem em que devem sair. */
  colunas: string[];
  orientacao: Orientacao;
  titulo: string;
  /** "25/08/2026 a 31/08/2026", já formatado. */
  periodo: string;
  /** Linha de rodapé com a soma das colunas numéricas. */
  totalizar: boolean;
  /**
   * Agrupa por hospedeira/regional e abre, sob cada culto, o que ainda falta
   * e quem já enviou. É o "organograma" no papel: quem cobra precisa ver, na
   * mesma folha, qual igreja está devendo e o que exatamente está devendo.
   */
  detalhar: boolean;
}

/** Ramo da arvorezinha de detalhe, com o traço de árvore certo no fim. */
function ramos(itens: string[]): string {
  return itens
    .map((t, i) => `<div class="ramo">${i === itens.length - 1 ? '└' : '├'}─ ${t}</div>`)
    .join('');
}

/** O que este culto ainda deve, quem já entregou e o que o dirigente disse. */
function detalheDoCulto(r: Registro): string {
  const linhas: string[] = [];

  if (r.blocosFaltando.length) {
    linhas.push(
      `<strong>Falta enviar:</strong> ${r.blocosFaltando.map((b) => ROTULO_BLOCO[b]).join(', ')}`,
    );
  }

  for (const l of r.lancamentos) {
    const quem = l.enviadoPorUser?.fullName;
    const quando = l.enviadoEm ? new Date(l.enviadoEm).toLocaleString('pt-BR') : null;
    linhas.push(
      `${ROTULO_BLOCO[l.bloco]} enviado${quem ? ` por ${quem}` : ''}${quando ? ` em ${quando}` : ''}` +
        (l.observacao ? ` — "${l.observacao}"` : ''),
    );
  }

  for (const a of r.aprovacoes) {
    const quem = a.aprovador?.fullName ?? 'dirigente';
    linhas.push(
      a.decisao === 'REJEITADO'
        ? `<strong>Devolvido</strong> por ${quem}${a.motivo ? `: ${a.motivo}` : ''}`
        : `Aprovado (${a.nivel === 'LOCAL' ? 'igreja' : 'hospedeira'}) por ${quem}`,
    );
  }

  if (r.observacao) linhas.push(`Observação do culto: ${r.observacao}`);
  if (r.observacaoPresidente) {
    linhas.push(`<strong>Pastor Presidente:</strong> ${r.observacaoPresidente}`);
  }
  if (!linhas.length) linhas.push('Nada pendente.');
  return ramos(linhas.map(escapar2));
}

/** Escapa só o texto, preservando o <strong> que montamos acima. */
function escapar2(t: string): string {
  return t
    .replace(/&/g, '&amp;')
    .replace(/<(?!\/?strong>)/g, '&lt;');
}

/** Agrupa como a tabela da tela: hospedeira quando existe, senão regional. */
function agrupar(registros: Registro[]): [string, Registro[]][] {
  const mapa = new Map<string, Registro[]>();
  for (const r of registros) {
    const hostId = r.hostChurchId ?? (r.church.isHost ? r.church.id : null);
    const nome = hostId
      ? `Hospedeira · ${r.hostChurch?.name ?? r.church.name}`
      : `Regional · ${r.regional?.name ?? 'Sem regional'}`;
    if (!mapa.has(nome)) mapa.set(nome, []);
    mapa.get(nome)!.push(r);
  }
  return Array.from(mapa.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

/** Monta o HTML e abre o diálogo de impressão numa janela nova. */
export function imprimirRelatorioCulto(opts: OpcoesRelatorio): boolean {
  const cols = opts.colunas
    .map((c) => COLUNAS_RELATORIO.find((x) => x.chave === c))
    .filter((c): c is ColunaRelatorio => Boolean(c));
  if (!cols.length) return false;

  const cabecalho = cols
    .map((c) => `<th class="${c.numero ? 'num' : ''}">${escapar(c.titulo)}</th>`)
    .join('');

  // Verde e negrito quando fechou; vermelho quando ainda falta alguém enviar.
  // Quem lê o relatório procura a linha vermelha primeiro.
  const classeDaLinha = (r: Registro) =>
    r.status === 'CONCLUIDO' ? 'ok' : r.blocosFaltando.length ? 'devendo' : 'andamento';

  const linhaDoCulto = (r: Registro) =>
    `<tr>${cols
      .map((c) => {
        // Só a coluna Situação recebe a cor: a linha inteira colorida virava
        // uma parede verde ou vermelha e nada se destacava.
        const classe = [c.numero ? 'num' : '', c.chave === 'status' ? classeDaLinha(r) : '']
          .filter(Boolean)
          .join(' ');
        return `<td class="${classe}">${escapar(c.valor(r))}</td>`;
      })
      .join('')}</tr>` +
    (opts.detalhar
      ? `<tr class="detalhe"><td colspan="${cols.length}">${detalheDoCulto(r)}</td></tr>`
      : '');

  let corpo: string;
  if (opts.detalhar) {
    // Com detalhe o relatório vira hierarquia: hospedeira (ou regional) na
    // faixa, as igrejas dela abaixo e, sob cada culto, o que ainda falta.
    corpo = agrupar(opts.registros)
      .map(([nome, itens]) => {
        const devendo = itens.filter((r) => r.blocosFaltando.length).length;
        const resumo = devendo
          ? `${itens.length} culto(s) · ${devendo} com pendência`
          : `${itens.length} culto(s) · tudo enviado`;
        return (
          `<tr class="grupo"><td colspan="${cols.length}">${escapar(nome)} <span class="leve">${escapar(resumo)}</span></td></tr>` +
          itens.map(linhaDoCulto).join('')
        );
      })
      .join('');
  } else {
    corpo = opts.registros.map(linhaDoCulto).join('');
  }

  // Rodapé: só as colunas que sabem somar. Moeda soma como moeda, contagem
  // como inteiro — somar "R$" com "12 pessoas" na mesma linha não diria nada.
  const rodape = opts.totalizar
    ? `<tfoot><tr>${cols
        .map((c, i) => {
          if (!c.soma) {
            return `<td>${i === 0 ? `Total — ${opts.registros.length} culto(s)` : ''}</td>`;
          }
          const total = opts.registros.reduce((acc, r) => acc + (c.soma!(r) || 0), 0);
          const texto = c.chave === 'dizimos' || c.chave === 'ofertas' ? fmtMoeda(total) : String(total);
          return `<td class="num">${escapar(texto)}</td>`;
        })
        .join('')}</tr></tfoot>`
    : '';

  const paisagem = opts.orientacao === 'paisagem';
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escapar(opts.titulo)}</title><style>
  /* @page fica FORA de @media print de propósito: dentro do bloco o Chrome
     ignora o "size" e imprime tudo em retrato, por mais que a tela diga
     paisagem. É regra de mídia paginada — só vale na impressão de qualquer
     forma. */
  @page{size:A4 ${paisagem ? 'landscape' : 'portrait'};margin:1.2cm}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#1e293b;padding:20px}
  h1{font-size:14px;font-weight:700;margin-bottom:2px}
  .sub{font-size:9px;color:#64748b;margin-bottom:10px}
  table{width:100%;border-collapse:collapse}
  th{background:#f1f5f9;padding:4px 6px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:.03em;border-bottom:2px solid #cbd5e1}
  td{padding:3px 6px;border-bottom:1px solid #e2e8f0;font-size:9.5px}
  .num{text-align:right;white-space:nowrap}
  /* O estado da linha se lê pela cor, sem precisar achar a coluna Status. */
  td.ok{color:#15803d;font-weight:700}
  td.devendo{color:#b91c1c;font-weight:700}
  td.andamento{color:#b45309}
  tfoot td{border-top:2px solid #cbd5e1;border-bottom:none;font-weight:700;background:#f8fafc}
  /* Faixa da hospedeira/regional: é o nível de cima do organograma. */
  tr.grupo td{background:#e2e8f0;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:.04em;padding:6px 8px}
  tr.grupo .leve{font-weight:400;text-transform:none;letter-spacing:0;color:#475569}
  tr.detalhe td{background:#f8fafc;padding:3px 6px 6px 22px;font-size:9px;color:#475569}
  .ramo{white-space:pre-wrap;line-height:1.5}
  /* O cabeçalho se repete a cada folha; sem isto, da segunda página em diante
     ninguém sabe que coluna é qual. */
  thead{display:table-header-group}
  tr{page-break-inside:avoid}
  @media print{body{padding:0}}
</style></head><body>
  <h1>${escapar(opts.titulo)}</h1>
  <p class="sub">${escapar(opts.periodo)} · ${opts.registros.length} culto(s) · gerado em ${new Date().toLocaleString('pt-BR')}</p>
  <table><thead><tr>${cabecalho}</tr></thead><tbody>${corpo}</tbody>${rodape}</table>
  <script>
    // Imprimiu (ou cancelou), a janela se fecha: deixar uma aba "about:blank"
    // com o relatório atrás da tela é lixo na barra do navegador.
    window.onload = function () {
      window.onafterprint = function () { window.close(); };
      window.print();
      // Safari/iOS não disparam onafterprint; o fecho tardio cobre esses casos.
      setTimeout(function () { window.close(); }, 1500);
    };
  <\/script>
</body></html>`;

  const janela = window.open('', '_blank', 'width=1024,height=768');
  if (!janela) return false;
  janela.document.write(html);
  janela.document.close();
  return true;
}
