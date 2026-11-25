import { MESES, type ColunaDef, type FiltroDef, type GrupoDef, type TotalDef } from './tipos';

/**
 * Relatórios de Tesouraria (Financeiro na origem), na ordem de lá, com os
 * termos e valores daqui: RECEITA/DESPESA, ROL, Título, Regional, Conta (banco
 * ou conta caixa), Forma de pagamento (espécie de lá).
 * Levantamento completo: migracao_ibirite/scripts/shots/rel_forms_Financeiro.json.
 */

const PERIODO = [{ valor: 'hoje', rotulo: 'Hoje' }, { valor: 'ontem', rotulo: 'Ontem' }, { valor: 'semana', rotulo: 'Semana Atual' }, { valor: 'semana_anterior', rotulo: 'Semana Anterior' }, { valor: 'mes', rotulo: 'Mês Atual' }, { valor: 'mes_anterior', rotulo: 'Mês Anterior' }, { valor: 'datas', rotulo: 'Período informado' }];
const fPeriodo = (padrao = 'mes'): FiltroDef => ({ id: 'periodo', rotulo: 'Período', tipo: 'opcao', opcoes: PERIODO, padrao });
const fIni: FiltroDef = { id: 'dataInicial', rotulo: 'Data Inicial', tipo: 'data' };
const fFim: FiltroDef = { id: 'dataFinal', rotulo: 'Data Final', tipo: 'data' };
const fRegional: FiltroDef = { id: 'regional', rotulo: 'Regional', tipo: 'regional' };
const fZona: FiltroDef = { id: 'zona', rotulo: 'Zona', tipo: 'zona' };
const fIgreja: FiltroDef = { id: 'igreja', rotulo: 'Igreja', tipo: 'igreja' };
const fConta: FiltroDef = { id: 'banco', rotulo: 'Conta', tipo: 'banco' };
const fDepto: FiltroDef = { id: 'departamento', rotulo: 'Departamento', tipo: 'departamento' };
const fPlano: FiltroDef = { id: 'plano', rotulo: 'Plano de Contas', tipo: 'plano_conta' };
const fForma: FiltroDef = { id: 'forma', rotulo: 'Forma de Pagamento', tipo: 'forma_pagamento' };
const fTipo: FiltroDef = { id: 'tipo', rotulo: 'Tipo da Conta', tipo: 'opcao', opcoes: [{ valor: 'RECEITA', rotulo: 'RECEITA' }, { valor: 'DESPESA', rotulo: 'DESPESA' }] };
const fGrupoContas: FiltroDef = { id: 'grupoContas', rotulo: 'Grupo de Contas', tipo: 'opcao', opcoes: [{ valor: '01', rotulo: '01 - Receitas' }, { valor: '02', rotulo: '02 - Despesas' }] };
const fAgruparIgrejas: FiltroDef = { id: 'agrupar', rotulo: 'Agrupar Igrejas', tipo: 'marcar', padrao: '1' };
const fAno: FiltroDef = { id: 'ano', rotulo: 'Ano', tipo: 'ano', padrao: String(new Date().getFullYear()) };
const fTitulo: FiltroDef = { id: 'cargo', rotulo: 'Título', tipo: 'titulo' };
const fSituacao: FiltroDef = { id: 'situacao', rotulo: 'Situação', tipo: 'opcao', opcoes: [{ valor: 'todos', rotulo: 'Todos' }, { valor: 'ativos', rotulo: 'ATIVO' }, { valor: 'inativos', rotulo: 'DESLIGADO' }], padrao: 'ativos' };
const fObreiros: FiltroDef = { id: 'obreiros', rotulo: 'Obreiros', tipo: 'opcao', opcoes: [{ valor: 'sim', rotulo: 'Obreiros (Cooperador ou acima)' }, { valor: 'nao', rotulo: 'Não Obreiros' }] };

const moeda = (id: string, rotulo: string, larg = '130px'): ColunaDef => ({ id, rotulo, tipo: 'moeda', larg });
const data: ColunaDef = { id: 'data', rotulo: 'Data', tipo: 'data', larg: '100px' };
const numLanc: ColunaDef = { id: 'numLancamento', rotulo: 'Nº Lanç.', larg: '90px' };
const numDoc: ColunaDef = { id: 'numDoc', rotulo: 'Nº Doc.', larg: '100px' };
const plano: ColunaDef = { id: 'plano', rotulo: 'Plano de Contas', larg: 'minmax(200px,1.2fr)' };
const historico: ColunaDef = { id: 'historico', rotulo: 'Histórico', larg: 'minmax(220px,1.6fr)' };
const favorecido: ColunaDef = { id: 'favorecido', rotulo: 'Favorecido / Contribuinte', larg: 'minmax(200px,1.2fr)' };
const igreja: ColunaDef = { id: 'igreja', rotulo: 'Igreja', larg: 'minmax(220px,1.4fr)' };
const rol: ColunaDef = { id: 'matricula', rotulo: 'ROL', tipo: 'numero', larg: '80px' };
const nome: ColunaDef = { id: 'nome', rotulo: 'Nome', larg: 'minmax(220px,1.6fr)' };
const titulo: ColunaDef = { id: 'cargo', rotulo: 'Título', larg: 'minmax(120px,.8fr)' };
const fone: ColunaDef = { id: 'telefone', rotulo: 'Telefone', larg: '140px' };
const receita = moeda('receita', 'Receita');
const despesa = moeda('despesa', 'Despesa');
const totRD: TotalDef[] = [{ rotulo: 'Total de Receitas', tipo: 'soma', coluna: 'receita' }, { rotulo: 'Total de Despesas', tipo: 'soma', coluna: 'despesa' }];
const mesesCols = (prefixo = 'm'): ColunaDef[] => ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, i) => ({ id: `${prefixo}${i + 1}`, rotulo: m, tipo: 'moeda' as const, larg: '96px' }));

const filtrosLanc: FiltroDef[] = [fPeriodo(), fIni, fFim, fRegional, fZona, fIgreja, fConta, fForma, fDepto, fGrupoContas, fPlano, fTipo];

const LIVRO: GrupoDef = {
  id: 'livro', nome: '1 - Livro de Lançamentos Financeiros',
  filtros: [{ id: 'ordem', rotulo: 'Ordem', tipo: 'opcao', padrao: 'lancamento', opcoes: [{ valor: 'lancamento', rotulo: 'Igreja, Conta, Nº Lançamento' }, { valor: 'data', rotulo: 'Igreja, Conta, Data e Nº Lançamento' }, { valor: 'documento', rotulo: 'Igreja, Conta, Nº Documento' }], largura: 2 }, fAgruparIgrejas, ...filtrosLanc, { id: 'lancInicial', rotulo: 'Nº Lanç. Inicial', tipo: 'numero' }, { id: 'lancFinal', rotulo: 'Nº Lanç. Final', tipo: 'numero' }],
  relatorios: [{ id: 'lista', nome: 'Livro de Lançamentos Financeiros', titulo: 'Livro de Lançamentos Financeiros', colunas: [data, numLanc, numDoc, plano, historico, favorecido, { id: 'conta', rotulo: 'Conta', larg: '140px' }, receita, despesa], agruparPor: 'igreja', totais: totRD, orientacao: 'landscape' }],
};

const EXTRATO: GrupoDef = {
  id: 'extrato', nome: '2 - Extrato de Conta Corrente', filtros: [fIgreja, fConta, fDepto, fPeriodo(), fIni, fFim],
  relatorios: [{ id: 'lista', nome: 'Extrato de Conta Corrente', titulo: 'Extrato de Conta Corrente', colunas: [data, numLanc, plano, historico, moeda('credito', 'Crédito'), moeda('debito', 'Débito'), moeda('saldo', 'Saldo')], agruparPor: 'conta', totais: [{ rotulo: 'Total de Créditos', tipo: 'soma', coluna: 'credito' }, { rotulo: 'Total de Débitos', tipo: 'soma', coluna: 'debito' }], orientacao: 'landscape', nota: 'A primeira linha de cada conta é o saldo anterior ao período.' }],
};

const colsProg: ColunaDef[] = [{ id: 'vencimento', rotulo: 'Vencimento', tipo: 'data', larg: '110px' }, { id: 'numero', rotulo: 'Nº', larg: '90px' }, { id: 'parcela', rotulo: 'Parcela', larg: '80px' }, { id: 'descricao', rotulo: 'Descrição', larg: 'minmax(220px,1.4fr)' }, { id: 'credor', rotulo: 'Credor', larg: 'minmax(180px,1.2fr)' }, plano, moeda('valor', 'Valor'), moeda('pago', 'Pago'), moeda('saldo', 'Saldo'), { id: 'status', rotulo: 'Situação', larg: '100px' }];
const PROGRAMACAO: GrupoDef = {
  id: 'programacao', nome: '3 - Programação Financeira',
  filtros: [fAgruparIgrejas, { id: 'agruparConta', rotulo: 'Agrupar Conta', tipo: 'marcar' }, fConta, fZona, fIgreja, fDepto, fPlano, { id: 'credor', rotulo: 'Credor', tipo: 'texto' }, { id: 'status', rotulo: 'Situação', tipo: 'opcao', opcoes: ['PENDENTE', 'PARCIAL', 'PAGO', 'ATRASADO', 'CANCELADA'].map((v) => ({ valor: v, rotulo: v })) }, fPeriodo(), fIni, fFim],
  relatorios: [{ id: 'lista', nome: 'Programação Financeira', titulo: 'Programação Financeira (Contas a Pagar)', colunas: colsProg, agruparPor: 'igreja', totais: [{ rotulo: 'Total Previsto', tipo: 'soma', coluna: 'valor' }, { rotulo: 'Total Pago', tipo: 'soma', coluna: 'pago' }, { rotulo: 'Saldo a Pagar', tipo: 'soma', coluna: 'saldo' }], orientacao: 'landscape' }],
};

const BAL_ANALITICO: GrupoDef = {
  id: 'balancete_analitico', nome: '4 - Balancete Analítico', filtros: [fAgruparIgrejas, ...filtrosLanc, { id: 'favorecido', rotulo: 'Fornecedor / Favorecido', tipo: 'texto' }],
  relatorios: [{ id: 'lista', nome: 'Balancete Analítico', titulo: 'Balancete Analítico', colunas: [data, numLanc, numDoc, historico, favorecido, igreja, receita, despesa], agruparPor: 'plano', totais: totRD, orientacao: 'landscape' }],
};
const BAL_SINTETICO: GrupoDef = {
  id: 'balancete_sintetico', nome: '5 - Balancete Sintético', filtros: [fAgruparIgrejas, ...filtrosLanc],
  relatorios: [{ id: 'lista', nome: 'Balancete Sintético', titulo: 'Balancete Sintético', colunas: [plano, { id: 'qtde', rotulo: 'Lançamentos', tipo: 'numero', larg: '110px' }, receita, despesa], agruparPor: 'igreja', totais: totRD }],
};

const DIARIO: GrupoDef = {
  id: 'diario', nome: '6 - Diário de Financeiro', filtros: [fAgruparIgrejas, ...filtrosLanc, { id: 'usuario', rotulo: 'Usuário (operador)', tipo: 'texto' }],
  relatorios: [
    { id: 'analitico', nome: 'Analítico', titulo: 'Diário Financeiro - Analítico', colunas: [data, numLanc, plano, historico, favorecido, { id: 'operador', rotulo: 'Usuário', larg: 'minmax(140px,1fr)' }, receita, despesa], agruparPor: 'igreja', totais: totRD, orientacao: 'landscape' },
    { id: 'sintetico', nome: 'Sintético', titulo: 'Diário Financeiro - Sintético', colunas: [data, { id: 'qtde', rotulo: 'Lançamentos', tipo: 'numero', larg: '110px' }, receita, despesa, moeda('saldoDia', 'Saldo do dia')], agruparPor: 'igreja', totais: totRD },
    { id: 'diario', nome: 'Diário Financeiro', titulo: 'Diário Financeiro', colunas: [data, plano, { id: 'qtde', rotulo: 'Lançamentos', tipo: 'numero', larg: '110px' }, receita, despesa], agruparPor: 'igreja', totais: totRD },
  ],
};

const REPASSE: GrupoDef = {
  id: 'repasse', nome: '7 - Repasse de Congregação',
  filtros: [{ id: 'sede', rotulo: 'Igreja Sede', tipo: 'sede' }, { id: 'igreja', rotulo: 'Congregação', tipo: 'igreja' }, fRegional, fConta, fDepto, fPlano, fAno, { id: 'mes', rotulo: 'Mês', tipo: 'opcao', opcoes: MESES }],
  relatorios: [
    { id: 'previsao', nome: 'Previsão para Repasse de Congregação', titulo: 'Previsão para Repasse de Congregação', colunas: [igreja, receita, despesa, moeda('saldo', 'Saldo (base do repasse)'), moeda('repassado', 'Já repassado')], agruparPor: 'sede', totais: [{ rotulo: 'Total de Receitas', tipo: 'soma', coluna: 'receita' }, { rotulo: 'Saldo', tipo: 'soma', coluna: 'saldo' }, { rotulo: 'Já repassado', tipo: 'soma', coluna: 'repassado' }], nota: 'Repasse = lançamentos com plano de contas de repasse ou retorno de saldo (ex.: "SALDO RETORNA").' },
    { id: 'geral', nome: 'Repasses de Congregação - Geral (R1)', titulo: 'Repasses de Congregação - Geral', colunas: [igreja, ...mesesCols(), moeda('total', 'Total')], agruparPor: 'regional', totais: [{ rotulo: 'Total de Repasses', tipo: 'soma', coluna: 'total' }], orientacao: 'landscape', nota: 'Repasse = lançamentos com plano de contas de repasse ou retorno de saldo (ex.: "SALDO RETORNA").' },
  ],
};

const COMPARATIVO: GrupoDef = {
  id: 'comparativo', nome: '8 - Comparativo de Despesa x Receita',
  filtros: [{ id: 'ordem', rotulo: 'Ordem', tipo: 'opcao', padrao: 'codigo', opcoes: [{ valor: 'codigo', rotulo: 'Código da Igreja' }, { valor: 'nome', rotulo: 'Nome da Igreja' }, { valor: 'receita_asc', rotulo: 'Receita Asc' }, { valor: 'receita_desc', rotulo: 'Receita Desc' }, { valor: 'despesa_asc', rotulo: 'Despesa Asc' }, { valor: 'despesa_desc', rotulo: 'Despesa Desc' }] }, { id: 'agrupar', rotulo: 'Agrupar por Regional', tipo: 'marcar' }, { id: 'semLancamento', rotulo: 'Não incluir igreja sem lançamento', tipo: 'marcar', padrao: '1' }, fPeriodo(), fIni, fFim, fRegional, fZona, fIgreja, fConta, fDepto, fGrupoContas, fPlano],
  relatorios: [{ id: 'lista', nome: 'Comparativo de Despesa x Receita', titulo: 'Comparativo de Despesa x Receita', colunas: [igreja, receita, despesa, moeda('saldo', 'Saldo'), { id: 'percentual', rotulo: 'Despesa / Receita', tipo: 'percentual', larg: '140px' }], agruparPor: 'regional', totais: totRD }],
};

const RESULTADO_ANUAL: GrupoDef = {
  id: 'resultado_anual', nome: '9 - Resultado Financeiro Anual', filtros: [fAno, fAgruparIgrejas, fRegional, fZona, fIgreja, fConta, fDepto, fPlano, fTipo],
  relatorios: [
    { id: 'por_igreja', nome: 'Por Igreja', titulo: 'Resultado Financeiro Anual por Igreja', colunas: [plano, ...mesesCols(), moeda('total', 'Total')], agruparPor: 'igreja', totais: [{ rotulo: 'Total', tipo: 'soma', coluna: 'total' }], orientacao: 'landscape', nota: 'Receitas positivas, despesas negativas.' },
    { id: 'por_conta', nome: 'Por Conta', titulo: 'Resultado Financeiro Anual por Conta', colunas: [igreja, ...mesesCols(), moeda('total', 'Total')], agruparPor: 'plano', totais: [{ rotulo: 'Total', tipo: 'soma', coluna: 'total' }], orientacao: 'landscape', nota: 'Receitas positivas, despesas negativas.' },
    { id: 'resumido', nome: 'Resumido', titulo: 'Resultado Financeiro Anual - Resumido', colunas: [{ id: 'tipoConta', rotulo: 'Tipo', larg: '120px' }, ...mesesCols(), moeda('total', 'Total')], agruparPor: 'igreja', orientacao: 'landscape' },
  ],
};

const PROGRAMACAO_ANUAL: GrupoDef = {
  id: 'programacao_anual', nome: '10 - Programação Financeira Anual', filtros: [fAno, fAgruparIgrejas, fRegional, fZona, fIgreja, fDepto, fPlano],
  relatorios: [
    { id: 'por_igreja', nome: 'Por Igreja', titulo: 'Programação Financeira Anual por Igreja', colunas: [plano, ...mesesCols(), moeda('total', 'Total')], agruparPor: 'igreja', totais: [{ rotulo: 'Total', tipo: 'soma', coluna: 'total' }], orientacao: 'landscape' },
    { id: 'por_conta', nome: 'Por Conta', titulo: 'Programação Financeira Anual por Conta', colunas: [igreja, ...mesesCols(), moeda('total', 'Total')], agruparPor: 'plano', totais: [{ rotulo: 'Total', tipo: 'soma', coluna: 'total' }], orientacao: 'landscape' },
    { id: 'resumido', nome: 'Resumido', titulo: 'Programação Financeira Anual - Resumido', colunas: [igreja, ...mesesCols(), moeda('total', 'Total')], totais: [{ rotulo: 'Total', tipo: 'soma', coluna: 'total' }], orientacao: 'landscape' },
  ],
};

const RESUMO: GrupoDef = {
  id: 'resumo', nome: '11 - Resumo Financeiro', filtros: [fPeriodo(), fIni, fFim, fRegional, fIgreja, fConta, fDepto],
  relatorios: [
    { id: 'igrejas', nome: 'Resumo Financeiro - Igrejas', titulo: 'Resumo Financeiro - Igrejas', colunas: [igreja, moeda('saldoAnterior', 'Saldo Anterior'), receita, despesa, moeda('saldoAtual', 'Saldo Atual')], totais: [{ rotulo: 'Saldo Anterior', tipo: 'soma', coluna: 'saldoAnterior' }, ...totRD, { rotulo: 'Saldo Atual', tipo: 'soma', coluna: 'saldoAtual' }] },
    { id: 'contas', nome: 'Resumo Financeiro - Contas', titulo: 'Resumo Financeiro - Contas', colunas: [{ id: 'conta', rotulo: 'Conta', larg: 'minmax(200px,1.2fr)' }, moeda('saldoAnterior', 'Saldo Anterior'), receita, despesa, moeda('saldoAtual', 'Saldo Atual')], agruparPor: 'igreja', totais: [{ rotulo: 'Saldo Anterior', tipo: 'soma', coluna: 'saldoAnterior' }, ...totRD, { rotulo: 'Saldo Atual', tipo: 'soma', coluna: 'saldoAtual' }] },
  ],
};

const CONSULTA: GrupoDef = {
  id: 'consulta', nome: '12 - Consulta de Lançamentos',
  filtros: [{ id: 'ordem', rotulo: 'Ordem', tipo: 'opcao', padrao: 'documento', opcoes: [{ valor: 'documento', rotulo: 'Nº Documento' }, { valor: 'lancamento', rotulo: 'Nº Lançamento' }, { valor: 'data', rotulo: 'Data' }, { valor: 'forma', rotulo: 'Forma de Pagamento' }] }, ...filtrosLanc,
    { id: 'tipoPessoa', rotulo: 'Vínculo', tipo: 'opcao', opcoes: [{ valor: 'MEMBRO', rotulo: 'Membro' }, { valor: 'IGREJA', rotulo: 'Igreja / Congregação' }, { valor: 'PF', rotulo: 'Pessoa Física' }, { valor: 'PJ', rotulo: 'Fornecedor (PJ)' }] },
    { id: 'pessoa', rotulo: 'Pessoa / Favorecido', tipo: 'texto' }, { id: 'tipoDocumento', rotulo: 'Tipo Documento', tipo: 'texto' },
    { id: 'numDoc', rotulo: 'Nº Documento', tipo: 'texto' }, { id: 'numLancamento', rotulo: 'Nº Lançamento', tipo: 'texto' },
    { id: 'valorInicial', rotulo: 'Valor Inicial', tipo: 'numero' }, { id: 'valorFinal', rotulo: 'Valor Final', tipo: 'numero' }],
  relatorios: [
    { id: 'simples', nome: 'Consulta Lançamentos - Relação Simples', titulo: 'Consulta de Lançamentos', colunas: [data, numLanc, numDoc, plano, favorecido, receita, despesa], totais: totRD, orientacao: 'landscape' },
    { id: 'completa', nome: 'Consulta Lançamentos - Relação Completa', titulo: 'Consulta de Lançamentos - Completa', colunas: [data, numLanc, numDoc, { id: 'tipoDocumento', rotulo: 'Tipo Doc.', larg: '110px' }, plano, historico, favorecido, { id: 'forma', rotulo: 'Forma', larg: '110px' }, { id: 'conta', rotulo: 'Conta', larg: '130px' }, { id: 'departamento', rotulo: 'Departamento', larg: '130px' }, igreja, { id: 'operador', rotulo: 'Usuário', larg: '130px' }, receita, despesa], totais: totRD, orientacao: 'landscape' },
    { id: 'pix_simples', nome: 'Consulta Integração Pix - Relação Simples', titulo: 'Consulta de Lançamentos Pix', colunas: [data, numLanc, plano, favorecido, receita, despesa], totais: totRD, nota: 'Lançamentos com forma de pagamento Pix.' },
    { id: 'pix_completa', nome: 'Consulta Integração Pix - Relação Completa', titulo: 'Consulta de Lançamentos Pix - Completa', colunas: [data, numLanc, numDoc, plano, historico, favorecido, { id: 'conta', rotulo: 'Conta', larg: '130px' }, igreja, receita, despesa], totais: totRD, orientacao: 'landscape', nota: 'Lançamentos com forma de pagamento Pix.' },
  ],
};

const CONCILIACAO: GrupoDef = {
  id: 'conciliacao', nome: '13 - Consulta Conciliação de Recebimentos', filtros: [fRegional, fIgreja, fPeriodo(), fIni, fFim],
  relatorios: [{ id: 'lista', nome: 'Conciliação de Recebimentos Pix', titulo: 'Conciliação de Recebimentos Pix', colunas: [data, numLanc, plano, favorecido, { id: 'conta', rotulo: 'Conta', larg: '140px' }, igreja, receita], agruparPor: 'conta', totais: [{ rotulo: 'Total Recebido', tipo: 'soma', coluna: 'receita' }], nota: 'Na origem é a conciliação do gateway de pagamento de lá; aqui mostra os recebimentos Pix lançados.' }],
};

const ORDEM_DIZ = { id: 'ordem', rotulo: 'Ordem', tipo: 'opcao' as const, padrao: 'igreja_rol', opcoes: [{ valor: 'igreja_rol', rotulo: 'Igreja | ROL | Título' }, { valor: 'igreja_nome', rotulo: 'Igreja | Nome | Título' }, { valor: 'igreja_titulo_rol', rotulo: 'Igreja | Título | ROL' }, { valor: 'igreja_titulo_nome', rotulo: 'Igreja | Título | Nome' }] };
const filtrosPessoaFin: FiltroDef[] = [fRegional, fZona, fIgreja, fTitulo, { id: 'funcao', rotulo: 'Função', tipo: 'funcao' }, fObreiros, fSituacao];
const DIZIMISTAS: GrupoDef = {
  id: 'dizimistas', nome: '14 - Dizimistas e Contribuintes',
  filtros: [ORDEM_DIZ, { id: 'mostrarValor', rotulo: 'Mostrar Valor do Dízimo', tipo: 'marcar', padrao: '1' }, { id: 'mostrarTelefone', rotulo: 'Mostrar telefone do dizimista', tipo: 'marcar' }, fAgruparIgrejas, ...filtrosPessoaFin, fPeriodo('mes'), fIni, fFim, { ...fAno, so: ['anual', 'anual_pessoa'] }],
  relatorios: [
    { id: 'mensal', nome: 'Mensal', titulo: 'Relação de Dizimistas', colunas: [rol, nome, titulo, fone, { id: 'qtde', rotulo: 'Contribuições', tipo: 'numero', larg: '120px' }, moeda('valor', 'Valor')], agruparPor: 'igreja', totais: [{ rotulo: 'Quantidade de Dizimistas', tipo: 'contagem' }, { rotulo: 'Total', tipo: 'soma', coluna: 'valor' }] },
    { id: 'mensal_pessoa', nome: 'Mensal - Igreja da Pessoa', titulo: 'Relação de Dizimistas (igreja da pessoa)', colunas: [rol, nome, titulo, fone, { id: 'qtde', rotulo: 'Contribuições', tipo: 'numero', larg: '120px' }, moeda('valor', 'Valor')], agruparPor: 'igreja', totais: [{ rotulo: 'Quantidade de Dizimistas', tipo: 'contagem' }, { rotulo: 'Total', tipo: 'soma', coluna: 'valor' }] },
    { id: 'funcao', nome: 'por Título', titulo: 'Relação de Dizimistas por Título', colunas: [rol, nome, igreja, fone, moeda('valor', 'Valor')], agruparPor: 'cargo', totais: [{ rotulo: 'Quantidade de Dizimistas', tipo: 'contagem' }, { rotulo: 'Total', tipo: 'soma', coluna: 'valor' }] },
    { id: 'anual', nome: 'Anual', titulo: 'Relação Anual de Dizimistas', colunas: [rol, nome, titulo, ...mesesCols(), moeda('total', 'Total')], agruparPor: 'igreja', totais: [{ rotulo: 'Quantidade de Dizimistas', tipo: 'contagem' }, { rotulo: 'Total', tipo: 'soma', coluna: 'total' }], orientacao: 'landscape' },
    { id: 'anual_pessoa', nome: 'Anual - Igreja da Pessoa', titulo: 'Relação Anual de Dizimistas (igreja da pessoa)', colunas: [rol, nome, titulo, ...mesesCols(), moeda('total', 'Total')], agruparPor: 'igreja', totais: [{ rotulo: 'Quantidade de Dizimistas', tipo: 'contagem' }, { rotulo: 'Total', tipo: 'soma', coluna: 'total' }], orientacao: 'landscape' },
  ],
};
const NAO_DIZIMISTAS: GrupoDef = {
  id: 'nao_dizimistas', nome: '15 - Não Dizimistas', filtros: [ORDEM_DIZ, fAgruparIgrejas, ...filtrosPessoaFin, fPeriodo('mes'), fIni, fFim],
  relatorios: [
    { id: 'lista', nome: 'Não Dizimistas', titulo: 'Relação de Não Dizimistas', colunas: [rol, nome, titulo, fone, { id: 'ultimoDizimo', rotulo: 'Último dízimo', tipo: 'data', larg: '120px' }], agruparPor: 'igreja', totais: [{ rotulo: 'Quantidade de Pessoas', tipo: 'contagem' }] },
    { id: 'por_titulo', nome: 'Por Título', titulo: 'Relação de Não Dizimistas por Título', colunas: [rol, nome, igreja, fone, { id: 'ultimoDizimo', rotulo: 'Último dízimo', tipo: 'data', larg: '120px' }], agruparPor: 'cargo', totais: [{ rotulo: 'Quantidade de Pessoas', tipo: 'contagem' }] },
  ],
};

const EXTRATO_CONTRIB: GrupoDef = {
  id: 'extrato_contribuintes', nome: '16 - Extrato de Contribuintes',
  filtros: [{ id: 'ordem', rotulo: 'Ordem', tipo: 'opcao', padrao: 'rol', opcoes: [{ valor: 'rol', rotulo: 'Igreja, ROL, Data' }, { valor: 'nome', rotulo: 'Igreja, Nome, Data' }] }, { id: 'mostrarValor', rotulo: 'Mostrar Valor', tipo: 'marcar', padrao: '1' }, fIgreja, fPlano, fTitulo, { id: 'matricula', rotulo: 'ROL', tipo: 'numero' }, { id: 'pessoa', rotulo: 'Nome', tipo: 'texto' }, fPeriodo('mes'), fIni, fFim],
  relatorios: [{ id: 'lista', nome: 'Extrato de Contribuintes', titulo: 'Extrato de Contribuintes', colunas: [data, numLanc, plano, historico, igreja, moeda('valor', 'Valor')], agruparPor: 'pessoa', totais: [{ rotulo: 'Total', tipo: 'soma', coluna: 'valor' }] }],
};
const EXTRATO_REPASSES: GrupoDef = {
  id: 'extrato_repasses', nome: '17 - Extrato de Repasses', filtros: [{ id: 'igreja', rotulo: 'Congregação', tipo: 'igreja' }, fPlano, fPeriodo('mes'), fIni, fFim],
  relatorios: [{ id: 'lista', nome: 'Extrato de Repasses', titulo: 'Extrato de Repasses', colunas: [data, numLanc, plano, historico, receita, despesa], agruparPor: 'igreja', totais: totRD, nota: 'Repasse = lançamentos com plano de contas de repasse ou retorno de saldo (ex.: "SALDO RETORNA").' }],
};

const ANUIDADES: GrupoDef = {
  id: 'anuidades', nome: '18 - Posição de Anuidades', filtros: [{ id: 'ano', rotulo: 'Ano', tipo: 'ano' }, fRegional, fIgreja, fTitulo, { id: 'matricula', rotulo: 'ROL', tipo: 'numero' }, { id: 'pessoa', rotulo: 'Nome da Pessoa', tipo: 'texto' }],
  relatorios: [{ id: 'lista', nome: 'Posição de Anuidades', titulo: 'Posição de Anuidades', colunas: [rol, { id: 'matriculaConamad', rotulo: 'Matrícula Conamad', larg: '130px' }, nome, titulo, { id: 'ano', rotulo: 'Ano', larg: '70px' }, moeda('valor', 'Valor'), { id: 'situacao', rotulo: 'Situação', larg: '110px' }], agruparPor: 'igreja', totais: [{ rotulo: 'Quantidade', tipo: 'contagem' }, { rotulo: 'Total', tipo: 'soma', coluna: 'valor' }], nota: 'Anuidades da convenção (módulo Conamad).' }],
};

const CONTAGEM_OFERTAS: GrupoDef = {
  id: 'contagem_ofertas', nome: '19 - Contagem de Ofertas', filtros: [fIgreja, { id: 'tipoCulto', rotulo: 'Culto / Evento', tipo: 'texto' }, fPeriodo('mes'), fIni, fFim],
  relatorios: [{ id: 'lista', nome: 'Contagem de Ofertas', titulo: 'Contagem de Ofertas', colunas: [data, { id: 'culto', rotulo: 'Culto / Evento', larg: 'minmax(160px,1fr)' }, { id: 'qtdeDizimos', rotulo: 'Qtde Dízimos', tipo: 'numero', larg: '110px' }, moeda('dizimos', 'Dízimos'), { id: 'qtdeOfertas', rotulo: 'Qtde Ofertas', tipo: 'numero', larg: '110px' }, moeda('ofertas', 'Ofertas'), moeda('total', 'Total')], agruparPor: 'igreja', totais: [{ rotulo: 'Total de Dízimos', tipo: 'soma', coluna: 'dizimos' }, { rotulo: 'Total de Ofertas', tipo: 'soma', coluna: 'ofertas' }, { rotulo: 'Total Geral', tipo: 'soma', coluna: 'total' }], nota: 'Valores lançados no registro de culto.' }],
};

const RANKING: GrupoDef = {
  id: 'ranking', nome: '20 - Ranking Financeiro', filtros: [{ id: 'tipo', rotulo: 'Tipo da Conta', tipo: 'opcao', padrao: 'RECEITA', opcoes: [{ valor: 'RECEITA', rotulo: 'RECEITA' }, { valor: 'DESPESA', rotulo: 'DESPESA' }] }, { id: 'top10', rotulo: 'Top 10', tipo: 'marcar' }, fRegional, fZona, fPlano, fPeriodo('mes'), fIni, fFim],
  relatorios: [{ id: 'lista', nome: 'Ranking Financeiro', titulo: 'Ranking Financeiro', colunas: [{ id: 'posicao', rotulo: 'Posição', tipo: 'numero', larg: '80px' }, igreja, moeda('valor', 'Valor'), { id: 'percentual', rotulo: '%', tipo: 'percentual', larg: '90px' }], totais: [{ rotulo: 'Quantidade de Igrejas', tipo: 'contagem' }, { rotulo: 'Valor Total', tipo: 'soma', coluna: 'valor' }] }],
};

const TRIMESTRAL: GrupoDef = {
  id: 'trimestral', nome: '21 - Análise Financeira Trimestral', filtros: [{ id: 'mes', rotulo: 'Mês final', tipo: 'opcao', opcoes: MESES, padrao: String(new Date().getMonth() + 1) }, fAno, fRegional, fZona, fIgreja],
  relatorios: [{ id: 'lista', nome: 'Listagem', titulo: 'Análise Financeira Trimestral', colunas: [igreja, moeda('m1', 'Mês 1'), moeda('m2', 'Mês 2'), moeda('m3', 'Mês 3'), moeda('total', 'Total')], agruparPor: 'tipoConta', totais: [{ rotulo: 'Total', tipo: 'soma', coluna: 'total' }], nota: 'Mês 1, Mês 2 e Mês 3 são os três meses que terminam no mês escolhido.' }],
};

export const GRUPOS_TESOURARIA: GrupoDef[] = [LIVRO, EXTRATO, PROGRAMACAO, BAL_ANALITICO, BAL_SINTETICO, DIARIO, REPASSE, COMPARATIVO, RESULTADO_ANUAL, PROGRAMACAO_ANUAL, RESUMO, CONSULTA, CONCILIACAO, DIZIMISTAS, NAO_DIZIMISTAS, EXTRATO_CONTRIB, EXTRATO_REPASSES, ANUIDADES, CONTAGEM_OFERTAS, RANKING, TRIMESTRAL];
