import { definirPermissao } from '../permissoes/definir';
import { GRUPOS_SECRETARIA } from './catalogoSecretaria';
import { GRUPOS_TESOURARIA } from './catalogoTesouraria';
import type { GrupoDef, Modulo } from './tipos';

const porNumero = (gs: GrupoDef[]) => [...gs].sort((a, b) => parseInt(a.nome, 10) - parseInt(b.nome, 10));
export const GRUPOS: Record<Modulo, GrupoDef[]> = { secretaria: porNumero(GRUPOS_SECRETARIA), tesouraria: porNumero(GRUPOS_TESOURARIA) };

export function grupoDe(modulo: Modulo, grupoId: string): GrupoDef | undefined {
  return GRUPOS[modulo].find((g) => g.id === grupoId);
}

/** Aba e módulo: quem não vê a tela de origem não vê a aba. */
export const PERM_ABA: Record<Modulo, string> = {
  secretaria: definirPermissao({ chave: 'reports.relatorios_secretaria.aba', rotulo: 'Aba Relatórios de Secretaria', herda: 'reports.view' }),
  tesouraria: definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.aba', rotulo: 'Aba Relatórios de Tesouraria', herda: 'finance_reports.view' }),
};

/**
 * Um ponto da árvore por grupo; a rota recusa a mesma chave.
 * Grupo sem chave aqui não abre (a tela mostra cadeado).
 */
export const PERM_GRUPO: Record<string, string> = {
  'tesouraria.livro': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.livro', rotulo: '1 - Livro de Lançamentos Financeiros', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.extrato': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.extrato', rotulo: '2 - Extrato de Conta Corrente', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.programacao': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.programacao', rotulo: '3 - Programação Financeira', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.balancete_analitico': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.balancete_analitico', rotulo: '4 - Balancete Analítico', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.balancete_sintetico': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.balancete_sintetico', rotulo: '5 - Balancete Sintético', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.diario': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.diario', rotulo: '6 - Diário de Financeiro', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.repasse': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.repasse', rotulo: '7 - Repasse de Congregação', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.comparativo': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.comparativo', rotulo: '8 - Comparativo de Despesa x Receita', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.resultado_anual': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.resultado_anual', rotulo: '9 - Resultado Financeiro Anual', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.programacao_anual': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.programacao_anual', rotulo: '10 - Programação Financeira Anual', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.resumo': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.resumo', rotulo: '11 - Resumo Financeiro', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.consulta': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.consulta', rotulo: '12 - Consulta de Lançamentos', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.conciliacao': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.conciliacao', rotulo: '13 - Consulta Conciliação de Recebimentos', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.dizimistas': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.dizimistas', rotulo: '14 - Dizimistas e Contribuintes', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.nao_dizimistas': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.nao_dizimistas', rotulo: '15 - Não Dizimistas', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.extrato_contribuintes': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.extrato_contribuintes', rotulo: '16 - Extrato de Contribuintes', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.extrato_repasses': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.extrato_repasses', rotulo: '17 - Extrato de Repasses', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.anuidades': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.anuidades', rotulo: '18 - Posição de Anuidades', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.contagem_ofertas': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.contagem_ofertas', rotulo: '19 - Contagem de Ofertas', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.ranking': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.ranking', rotulo: '20 - Ranking Financeiro', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'tesouraria.trimestral': definirPermissao({ chave: 'finance_reports.relatorios_tesouraria.trimestral', rotulo: '21 - Análise Financeira Trimestral', herda: 'finance_reports.relatorios_tesouraria.aba' }),
  'secretaria.igrejas': definirPermissao({ chave: 'reports.relatorios_secretaria.igrejas', rotulo: '1 - Igrejas', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.pessoas': definirPermissao({ chave: 'reports.relatorios_secretaria.pessoas', rotulo: '6 - Pessoas', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.agendamentos_culto': definirPermissao({ chave: 'reports.relatorios_secretaria.agendamentos_culto', rotulo: '2 - Agendamentos do Culto', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.agenda_pastoral': definirPermissao({ chave: 'reports.relatorios_secretaria.agenda_pastoral', rotulo: '3 - Agenda Pastoral', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.mala_direta': definirPermissao({ chave: 'reports.relatorios_secretaria.mala_direta', rotulo: '8 - Mala Direta - Etiquetas', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.agendamento_ocorrencia': definirPermissao({ chave: 'reports.relatorios_secretaria.agendamento_ocorrencia', rotulo: '10 - Agendamento de Ocorrência', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.funcoes': definirPermissao({ chave: 'reports.relatorios_secretaria.funcoes', rotulo: '12 - Funções Ocupacionais', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.emissao_documentos': definirPermissao({ chave: 'reports.relatorios_secretaria.emissao_documentos', rotulo: '14 - Consulta Emissão de Documentos', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.transferencias_pendentes': definirPermissao({ chave: 'reports.relatorios_secretaria.transferencias_pendentes', rotulo: '17 - Transferências Pendentes', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.recebimentos_pendentes': definirPermissao({ chave: 'reports.relatorios_secretaria.recebimentos_pendentes', rotulo: '18 - Recebimentos Pendentes', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.usuarios': definirPermissao({ chave: 'reports.relatorios_secretaria.usuarios', rotulo: '19 - Usuários do Sistema', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.aniversariantes': definirPermissao({ chave: 'reports.relatorios_secretaria.aniversariantes', rotulo: '4 - Aniversariantes', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.aniversariantes_dia': definirPermissao({ chave: 'reports.relatorios_secretaria.aniversariantes_dia', rotulo: '5 - Aniversariantes do Dia', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.familiares': definirPermissao({ chave: 'reports.relatorios_secretaria.familiares', rotulo: '7 - Familiares', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.historico_ocorrencia': definirPermissao({ chave: 'reports.relatorios_secretaria.historico_ocorrencia', rotulo: '9 - Histórico de Ocorrência', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.anual_ocorrencias': definirPermissao({ chave: 'reports.relatorios_secretaria.anual_ocorrencias', rotulo: '11 - Anual de Ocorrências', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.faixa_etaria': definirPermissao({ chave: 'reports.relatorios_secretaria.faixa_etaria', rotulo: '13 - Faixa Etária', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.estatistica_cargos': definirPermissao({ chave: 'reports.relatorios_secretaria.estatistica_cargos', rotulo: '15 - Estatística de Títulos', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.cadastros_mes': definirPermissao({ chave: 'reports.relatorios_secretaria.cadastros_mes', rotulo: '16 - Qtde Cadastros por Mês', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.pessoas_estado': definirPermissao({ chave: 'reports.relatorios_secretaria.pessoas_estado', rotulo: '20 - Pessoas por Estado', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.igrejas_estado': definirPermissao({ chave: 'reports.relatorios_secretaria.igrejas_estado', rotulo: '21 - Igrejas por Estado', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.grafico_cargos': definirPermissao({ chave: 'reports.relatorios_secretaria.grafico_cargos', rotulo: '22 - Gráfico - Estatística de Títulos', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.ranking_ocorrencia': definirPermissao({ chave: 'reports.relatorios_secretaria.ranking_ocorrencia', rotulo: '23 - Ranking de Ocorrência', herda: 'reports.relatorios_secretaria.aba' }),
  'secretaria.crescimento': definirPermissao({ chave: 'reports.relatorios_secretaria.crescimento', rotulo: '24 - Histórico de Crescimento', herda: 'reports.relatorios_secretaria.aba' }),
};

export const permissaoGrupo = (modulo: Modulo, grupoId: string) => PERM_GRUPO[`${modulo}.${grupoId}`];
