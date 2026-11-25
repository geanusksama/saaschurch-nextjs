import { MESES, MODO_TEXTO, SITUACAO_IGREJA, type ColunaDef, type FiltroDef, type GrupoDef } from './tipos';

/**
 * Relatórios de Secretaria, na ordem e com os nomes da origem.
 * Levantamento completo (filtros e opções de lá): migracao_ibirite/scripts/shots/rel_forms_Secretaria.json.
 */

const codigo: ColunaDef = { id: 'codigo', rotulo: 'Código', larg: '120px' };
const igreja: ColunaDef = { id: 'igreja', rotulo: 'Descrição da Igreja', larg: 'minmax(200px,1.2fr)' };
const endereco: ColunaDef = { id: 'endereco', rotulo: 'Endereço', larg: 'minmax(320px,2.4fr)' };
const telefone: ColunaDef = { id: 'telefone', rotulo: 'Telefone', larg: '140px' };
const qtdePessoas: ColunaDef = { id: 'qtdePessoas', rotulo: 'Qtde Pessoas', tipo: 'numero', larg: '110px' };
const totaisIgreja = [
  { rotulo: 'Quantidade de Igrejas', tipo: 'contagem' as const },
  { rotulo: 'Quantidade de Pessoas', tipo: 'soma' as const, coluna: 'qtdePessoas' },
];

const IGREJAS: GrupoDef = {
  id: 'igrejas',
  nome: '1 - Igrejas',
  filtros: [
    {
      id: 'ordem', rotulo: 'Ordem', tipo: 'opcao', padrao: 'hierarquia_codigo', largura: 2, opcoes: [
        { valor: 'hierarquia_codigo', rotulo: 'Hierarquia e Código da Igreja (R1,R3)' },
        { valor: 'hierarquia_nome', rotulo: 'Hierarquia e Nome da Igreja (R1,R3)' },
        { valor: 'sede_codigo', rotulo: 'Sede, Código da Igreja (R2)' },
        { valor: 'sede_nome', rotulo: 'Sede, Nome da Igreja (R2)' },
        { valor: 'regional_codigo', rotulo: 'Regional, Código da Igreja' },
        { valor: 'regional_nome', rotulo: 'Regional, Nome da Igreja' },
        { valor: 'codigo', rotulo: 'Somente Código da Igreja' },
        { valor: 'nome', rotulo: 'Somente Nome da Igreja' },
      ],
    },
    { id: 'agrupar', rotulo: 'Agrupar', tipo: 'marcar', padrao: '1' },
    { id: 'nome', rotulo: 'Nome', tipo: 'texto_modo', opcoes: MODO_TEXTO, largura: 3 },
    { id: 'zona', rotulo: 'Zona', tipo: 'zona' },
    { id: 'situacao', rotulo: 'Situação', tipo: 'opcao', opcoes: SITUACAO_IGREJA, padrao: 'ativa' },
    { id: 'regional', rotulo: 'Regional', tipo: 'regional' },
    { id: 'sede', rotulo: 'Sede', tipo: 'sede' },
    { id: 'hierarquia', rotulo: 'Hierarquia', tipo: 'opcao', opcoes: [{ valor: 'sede', rotulo: 'Sede' }, { valor: 'congregacao', rotulo: 'Congregação' }] },
    { id: 'funcao', rotulo: 'Função', tipo: 'texto' },
  ],
  relatorios: [
    {
      id: 'hierarquia', nome: 'Por Hierarquia (R1)', titulo: 'Relação de Igrejas Agrupadas por Hierarquia',
      colunas: [codigo, igreja, endereco, telefone, qtdePessoas], agruparPor: 'hierarquia', totais: totaisIgreja, orientacao: 'landscape',
    },
    {
      id: 'sede', nome: 'Por Sede (R2)', titulo: 'Relação de Igrejas Agrupadas por Sede',
      colunas: [codigo, igreja, endereco, telefone, qtdePessoas], agruparPor: 'sede', totais: totaisIgreja, orientacao: 'landscape',
    },
    {
      id: 'estado', nome: 'Lista de Igrejas por Estado', titulo: 'Relação de Igrejas por Estado',
      colunas: [codigo, { id: 'igrejaCompleta', rotulo: 'Igreja', larg: 'minmax(240px,1.6fr)' }, { id: 'telefone', rotulo: 'Telefone Igreja', larg: '140px' }, { id: 'dirigente', rotulo: 'Dirigente', larg: 'minmax(180px,1fr)' }, { id: 'telefoneDirigente', rotulo: 'Telefone Dirigente', larg: '150px' }],
      agruparPor: 'estado', totais: [{ rotulo: 'Quantidade de Igrejas', tipo: 'contagem' }], orientacao: 'landscape',
    },
    {
      id: 'agenda', nome: 'Agenda de Igrejas (R3)', titulo: 'Agenda de Igrejas',
      colunas: [{ id: 'igrejaCompleta', rotulo: 'Igreja', larg: 'minmax(220px,1.4fr)' }, { id: 'logradouro', rotulo: 'Endereço', larg: 'minmax(220px,1.4fr)' }, { id: 'cep', rotulo: 'Cep', larg: '100px' }, { id: 'bairro', rotulo: 'Bairro', larg: 'minmax(140px,1fr)' }, { id: 'cidadeUf', rotulo: 'Cidade / Uf', larg: 'minmax(160px,1fr)' }, telefone, { id: 'telefone2', rotulo: 'Telefone', larg: '140px' }],
      orientacao: 'landscape',
    },
    {
      id: 'contatos', nome: 'Contatos da Igreja', titulo: 'Relação de Contatos da Igreja',
      colunas: [{ id: 'matricula', rotulo: 'ROL', tipo: 'numero', larg: '80px' }, { id: 'nome', rotulo: 'Nome', larg: 'minmax(220px,1.6fr)' }, telefone, { id: 'funcao', rotulo: 'Função', larg: 'minmax(140px,1fr)' }],
      agruparPor: 'igrejaCompleta', totais: [{ rotulo: 'Quantidade de Contatos', tipo: 'contagem' }],
      nota: 'Pessoas com função ativa na igreja (cadastro de funções).',
    },
    {
      id: 'email', nome: 'Relação de Email', titulo: 'Relação de E-mail',
      colunas: [{ id: 'matricula', rotulo: 'ROL', tipo: 'numero', larg: '80px' }, { id: 'nome', rotulo: 'Nome', larg: 'minmax(220px,1.6fr)' }, { id: 'funcao', rotulo: 'Função', larg: 'minmax(120px,.8fr)' }, telefone, { id: 'email', rotulo: 'E-mail', larg: 'minmax(200px,1.2fr)' }, { id: 'igrejaCompleta', rotulo: 'Igreja', larg: 'minmax(200px,1.2fr)' }],
      totais: [{ rotulo: 'Total de Registros Impressos', tipo: 'contagem' }],
      nota: 'Pessoas com função ativa na igreja (cadastro de funções).',
    },
    {
      id: 'cnpj', nome: 'Relação de CNPJ', titulo: 'Relação de CNPJ',
      colunas: [codigo, igreja, { id: 'razaoSocial', rotulo: 'Razão Social', larg: 'minmax(200px,1.2fr)' }, { id: 'cnpj', rotulo: 'CNPJ', larg: '170px' }, { id: 'cidadeUf', rotulo: 'Cidade / Uf', larg: 'minmax(160px,1fr)' }],
      totais: [{ rotulo: 'Total de Igrejas', tipo: 'contagem' }],
    },
    {
      id: 'regional', nome: 'Por Regional', titulo: 'Relação de Igrejas por Regional',
      colunas: [codigo, igreja, endereco, telefone, qtdePessoas], agruparPor: 'regional', totais: totaisIgreja, orientacao: 'landscape',
    },
    {
      id: 'regional_seq', nome: 'Por Regional - Sequencial', titulo: 'Relação de Igrejas por Regional',
      colunas: [{ id: 'seq', rotulo: 'Seq.', tipo: 'numero', larg: '60px' }, codigo, igreja, endereco, telefone, qtdePessoas], agruparPor: 'regional', totais: totaisIgreja, orientacao: 'landscape',
    },
    {
      id: 'ficha', nome: 'Ficha Cadastral da Igreja', titulo: 'Ficha Cadastral da Igreja',
      colunas: [codigo, igreja, { id: 'hierarquia', rotulo: 'Hierarquia', larg: '130px' }, { id: 'sede', rotulo: 'Sede', larg: 'minmax(160px,1fr)' }, { id: 'regional', rotulo: 'Regional', larg: 'minmax(140px,1fr)' }, { id: 'fundacao', rotulo: 'Fundação', tipo: 'data', larg: '110px' }, { id: 'cnpj', rotulo: 'CNPJ', larg: '170px' }, endereco, telefone, { id: 'email', rotulo: 'E-mail', larg: 'minmax(180px,1fr)' }, { id: 'dirigente', rotulo: 'Dirigente', larg: 'minmax(180px,1fr)' }, qtdePessoas],
      orientacao: 'landscape',
    },
  ],
};

// ─── Filtros e colunas comuns de pessoas ─────────────────────────────────────
const fRegional: FiltroDef = { id: 'regional', rotulo: 'Regional', tipo: 'regional' };
const fZona: FiltroDef = { id: 'zona', rotulo: 'Zona', tipo: 'zona' };
const fIgreja: FiltroDef = { id: 'igreja', rotulo: 'Igreja', tipo: 'igreja' };
const SITUACAO_PESSOA = [{ valor: 'todos', rotulo: 'Todos' }, { valor: 'ativos', rotulo: 'ATIVO' }, { valor: 'inativos', rotulo: 'DESLIGADO' }];
const fSituacao: FiltroDef = { id: 'situacao', rotulo: 'Situação', tipo: 'opcao', opcoes: SITUACAO_PESSOA, padrao: 'ativos' };
const TIPO_OCORRENCIA = [{ valor: 'todas', rotulo: 'Todas' }, { valor: 'Entrada', rotulo: 'Entrada' }, { valor: 'Saída', rotulo: 'Saída' }, { valor: 'Normal', rotulo: 'Normal' }];
const mes = () => String(new Date().getMonth() + 1);

const matricula: ColunaDef = { id: 'matricula', rotulo: 'ROL', tipo: 'numero', larg: '90px' };
const nome: ColunaDef = { id: 'nome', rotulo: 'Nome', larg: 'minmax(220px,1.6fr)' };
const cargo: ColunaDef = { id: 'cargo', rotulo: 'Título', larg: 'minmax(130px,.9fr)' };
const fone: ColunaDef = { id: 'telefone', rotulo: 'Telefone', larg: '140px' };
const igrejaPessoa: ColunaDef = { id: 'igreja', rotulo: 'Igreja', larg: 'minmax(200px,1.2fr)' };
const contagem = (rotulo: string) => [{ rotulo, tipo: 'contagem' as const }];

const ANIVERSARIANTES: GrupoDef = {
  id: 'aniversariantes', nome: '4 - Aniversariantes',
  filtros: [
    { id: 'mes', rotulo: 'Mês', tipo: 'opcao', opcoes: MESES, padrao: mes() },
    { id: 'diaInicial', rotulo: 'Dia Inicial', tipo: 'numero', padrao: '1' },
    { id: 'diaFinal', rotulo: 'Dia Final', tipo: 'numero', padrao: '31' },
    { id: 'hoje', rotulo: 'Hoje', tipo: 'marcar' },
    fRegional, fZona, fIgreja,
  ],
  relatorios: [{
    id: 'lista', nome: 'Aniversariantes', titulo: 'Relação de Aniversariantes',
    colunas: [{ id: 'dia', rotulo: 'Dia', tipo: 'numero', larg: '60px' }, matricula, nome, cargo, { id: 'nascimento', rotulo: 'Nascimento', tipo: 'data', larg: '110px' }, { id: 'idade', rotulo: 'Idade', tipo: 'numero', larg: '70px' }, fone, igrejaPessoa],
    agruparPor: 'mesNome', totais: contagem('Quantidade de Aniversariantes'),
  }],
};

const ANIVERSARIANTES_DIA: GrupoDef = {
  id: 'aniversariantes_dia', nome: '5 - Aniversariantes do Dia',
  filtros: [{ id: 'periodo', rotulo: 'Período', tipo: 'opcao', padrao: 'dia', opcoes: [{ valor: 'dia', rotulo: 'Dia' }, { valor: 'semana', rotulo: 'Semana' }, { valor: 'mes', rotulo: 'Mês' }] }, fIgreja],
  relatorios: [{
    id: 'lista', nome: 'Relação de Aniversariantes do Dia', titulo: 'Relação de Aniversariantes do Dia',
    colunas: [matricula, cargo, nome, fone, igrejaPessoa, { id: 'email', rotulo: 'E-mail', larg: 'minmax(180px,1fr)' }, { id: 'nascimento', rotulo: 'Nascimento', tipo: 'data', larg: '110px' }],
    totais: contagem('Quantidade de Aniversariantes'),
  }],
};

const FAMILIARES: GrupoDef = {
  id: 'familiares', nome: '7 - Familiares',
  filtros: [
    { id: 'ordem', rotulo: 'Ordem', tipo: 'opcao', padrao: 'matricula', opcoes: [{ valor: 'matricula', rotulo: 'ROL' }, { valor: 'nome', rotulo: 'Nome' }] },
    fIgreja,
    { id: 'pessoa', rotulo: 'Pessoa', tipo: 'texto' },
    { id: 'parentesco', rotulo: 'Parentesco', tipo: 'opcao', opcoes: [{ valor: 'CONJUGE', rotulo: 'Cônjuge' }, { valor: 'FILHO', rotulo: 'Filho(a)' }, { valor: 'PAI_MAE', rotulo: 'Pai / Mãe' }, { valor: 'IRMAO', rotulo: 'Irmão(ã)' }, { valor: 'OUTRO', rotulo: 'Outro' }] },
    { id: 'anivInicial', rotulo: 'Aniversário Inicial', tipo: 'data' },
    { id: 'anivFinal', rotulo: 'Aniversário Final', tipo: 'data' },
    fSituacao,
  ],
  relatorios: [{
    id: 'lista', nome: 'Familiares', titulo: 'Relação de Familiares',
    colunas: [{ id: 'familiar', rotulo: 'Familiar', larg: 'minmax(220px,1.5fr)' }, { id: 'parentesco', rotulo: 'Parentesco', larg: '120px' }, { id: 'nascimentoFamiliar', rotulo: 'Nascimento', tipo: 'data', larg: '110px' }, { id: 'sexoFamiliar', rotulo: 'Sexo', larg: '100px' }],
    agruparPor: 'pessoa', totais: contagem('Quantidade de Familiares'),
  }],
};

const fOcorrencia: FiltroDef = { id: 'ocorrencia', rotulo: 'Ocorrência', tipo: 'texto' };
const fTipoOco: FiltroDef = { id: 'tipoOcorrencia', rotulo: 'Tipo da Ocorrência', tipo: 'opcao', opcoes: TIPO_OCORRENCIA, padrao: 'todas' };
const fDataIni: FiltroDef = { id: 'dataInicial', rotulo: 'Data Inicial', tipo: 'data' };
const fDataFim: FiltroDef = { id: 'dataFinal', rotulo: 'Data Final', tipo: 'data' };
const colsOco: ColunaDef[] = [{ id: 'data', rotulo: 'Data', tipo: 'data', larg: '100px' }, matricula, nome, cargo, { id: 'ocorrencia', rotulo: 'Ocorrência', larg: 'minmax(160px,1fr)' }, { id: 'tipo', rotulo: 'Tipo', larg: '90px' }, igrejaPessoa, { id: 'local', rotulo: 'Local', larg: 'minmax(140px,1fr)' }];

const HISTORICO_OCORRENCIA: GrupoDef = {
  id: 'historico_ocorrencia', nome: '9 - Histórico de Ocorrência',
  filtros: [fDataIni, fDataFim, { id: 'agrupar', rotulo: 'Agrupar', tipo: 'marcar', padrao: '1' }, { id: 'observacoes', rotulo: 'Imprimir Observações', tipo: 'marcar' }, fRegional, fZona, fIgreja, fOcorrencia, fTipoOco],
  relatorios: [
    { id: 'por_igreja', nome: 'Por Igreja', titulo: 'Histórico de Ocorrências por Igreja', colunas: colsOco, agruparPor: 'igreja', totais: contagem('Quantidade de Ocorrências'), orientacao: 'landscape' },
    { id: 'por_ocorrencia', nome: 'Por Ocorrência', titulo: 'Histórico de Ocorrências por Ocorrência', colunas: colsOco, agruparPor: 'ocorrencia', totais: contagem('Quantidade de Ocorrências'), orientacao: 'landscape' },
    { id: 'sint_igreja', nome: 'Sintético - Por Igreja', titulo: 'Histórico de Ocorrências - Sintético por Igreja', colunas: [igrejaPessoa, { id: 'ocorrencia', rotulo: 'Ocorrência', larg: 'minmax(180px,1fr)' }, { id: 'qtde', rotulo: 'Qtde', tipo: 'numero', larg: '90px' }], agruparPor: 'igreja', totais: [{ rotulo: 'Quantidade de Ocorrências', tipo: 'soma', coluna: 'qtde' }] },
    { id: 'sint_ocorrencia', nome: 'Sintético - Por Ocorrência', titulo: 'Histórico de Ocorrências - Sintético por Ocorrência', colunas: [{ id: 'ocorrencia', rotulo: 'Ocorrência', larg: 'minmax(180px,1fr)' }, igrejaPessoa, { id: 'qtde', rotulo: 'Qtde', tipo: 'numero', larg: '90px' }], agruparPor: 'ocorrencia', totais: [{ rotulo: 'Quantidade de Ocorrências', tipo: 'soma', coluna: 'qtde' }] },
  ],
};

const ANUAL_OCORRENCIAS: GrupoDef = {
  id: 'anual_ocorrencias', nome: '11 - Anual de Ocorrências',
  filtros: [{ id: 'ano', rotulo: 'Ano', tipo: 'ano', padrao: String(new Date().getFullYear()) }, fRegional, fZona, fIgreja, fOcorrencia, fTipoOco],
  relatorios: ['por_igreja', 'por_ocorrencia'].map((id) => ({
    id, nome: id === 'por_igreja' ? 'Por Igreja' : 'Por Ocorrência', titulo: 'Relatório Anual de Ocorrências',
    colunas: [{ id: id === 'por_igreja' ? 'ocorrencia' : 'igreja', rotulo: id === 'por_igreja' ? 'Ocorrência' : 'Igreja', larg: 'minmax(200px,1.4fr)' },
      ...['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, i) => ({ id: `m${i + 1}`, rotulo: m, tipo: 'numero' as const, larg: '56px' })),
      { id: 'total', rotulo: 'Total', tipo: 'numero', larg: '70px' }],
    agruparPor: id === 'por_igreja' ? 'igreja' : 'ocorrencia', totais: [{ rotulo: 'Total de Ocorrências', tipo: 'soma' as const, coluna: 'total' }], orientacao: 'landscape' as const,
  })),
};

const RANKING_OCORRENCIA: GrupoDef = {
  id: 'ranking_ocorrencia', nome: '23 - Ranking de Ocorrência',
  filtros: [fZona, fIgreja, fOcorrencia, { id: 'ano', rotulo: 'Ano', tipo: 'ano', padrao: String(new Date().getFullYear()) }, { id: 'mes', rotulo: 'Mês', tipo: 'opcao', opcoes: MESES }],
  relatorios: [{
    id: 'lista', nome: 'Listagem', titulo: 'Ranking de Ocorrência',
    colunas: [{ id: 'posicao', rotulo: 'Posição', tipo: 'numero', larg: '80px' }, igrejaPessoa, { id: 'qtde', rotulo: 'Quantidade', tipo: 'numero', larg: '110px' }, { id: 'percentual', rotulo: '%', tipo: 'percentual', larg: '90px' }],
    totais: [{ rotulo: 'Quantidade de Igrejas', tipo: 'contagem' }, { rotulo: 'Total de Ocorrências', tipo: 'soma', coluna: 'qtde' }],
  }],
};

const FAIXA_ETARIA: GrupoDef = {
  id: 'faixa_etaria', nome: '13 - Faixa Etária',
  filtros: [fIgreja, fSituacao],
  relatorios: [
    { id: 'geral', nome: 'Qtde de Pessoas por Faixa Etária - Geral', titulo: 'Quantidade de Pessoas por Faixa Etária', colunas: [{ id: 'faixa', rotulo: 'Faixa Etária', larg: 'minmax(180px,1fr)' }, { id: 'masculino', rotulo: 'Masculino', tipo: 'numero', larg: '110px' }, { id: 'feminino', rotulo: 'Feminino', tipo: 'numero', larg: '110px' }, { id: 'qtde', rotulo: 'Total', tipo: 'numero', larg: '90px' }], totais: [{ rotulo: 'Total de Pessoas', tipo: 'soma', coluna: 'qtde' }] },
    { id: 'por_igreja', nome: 'Qtde Pessoas por Faixa Etária - por Igreja', titulo: 'Quantidade de Pessoas por Faixa Etária - por Igreja', colunas: [{ id: 'faixa', rotulo: 'Faixa Etária', larg: 'minmax(180px,1fr)' }, { id: 'masculino', rotulo: 'Masculino', tipo: 'numero', larg: '110px' }, { id: 'feminino', rotulo: 'Feminino', tipo: 'numero', larg: '110px' }, { id: 'qtde', rotulo: 'Total', tipo: 'numero', larg: '90px' }], agruparPor: 'igreja', totais: [{ rotulo: 'Quantidade de Pessoas', tipo: 'soma', coluna: 'qtde' }] },
  ],
};

const ESTATISTICA_CARGOS: GrupoDef = {
  id: 'estatistica_cargos', nome: '15 - Estatística de Títulos',
  filtros: [{ id: 'ordem', rotulo: 'Ordem', tipo: 'opcao', padrao: 'cargo', opcoes: [{ valor: 'cargo', rotulo: 'Título' }, { valor: 'total', rotulo: 'Total' }] }, { id: 'agrupar', rotulo: 'Agrupar Igrejas', tipo: 'marcar' }, fIgreja, fRegional, fSituacao],
  relatorios: [{
    id: 'lista', nome: 'Estatística de Títulos', titulo: 'Estatística de Títulos',
    colunas: [cargo, { id: 'masculino', rotulo: 'Masculino', tipo: 'numero', larg: '110px' }, { id: 'feminino', rotulo: 'Feminino', tipo: 'numero', larg: '110px' }, { id: 'qtde', rotulo: 'Total', tipo: 'numero', larg: '90px' }],
    agruparPor: 'igreja', totais: [{ rotulo: 'Total de Pessoas', tipo: 'soma', coluna: 'qtde' }],
  }],
};

const GRAFICO_CARGOS: GrupoDef = {
  id: 'grafico_cargos', nome: '22 - Gráfico - Estatística de Títulos',
  filtros: [fZona, fIgreja, { id: 'agrupar', rotulo: 'Agrupar', tipo: 'marcar' }, fSituacao],
  relatorios: [{
    id: 'lista', nome: 'Listagem', titulo: 'Estatística de Títulos',
    colunas: [cargo, { id: 'qtde', rotulo: 'Quantidade', tipo: 'numero', larg: '110px' }, { id: 'percentual', rotulo: '%', tipo: 'percentual', larg: '90px' }],
    agruparPor: 'igreja', totais: [{ rotulo: 'Total de Pessoas', tipo: 'soma', coluna: 'qtde' }],
  }],
};

const CADASTROS_MES: GrupoDef = {
  id: 'cadastros_mes', nome: '16 - Qtde Cadastros por Mês',
  filtros: [{ id: 'ano', rotulo: 'Ano', tipo: 'ano', padrao: String(new Date().getFullYear()) }, { id: 'agrupar', rotulo: 'Agrupar Igrejas', tipo: 'marcar' }, fZona, fIgreja],
  relatorios: [{
    id: 'lista', nome: 'Qtde Cadastros por Mês', titulo: 'Quantidade de Cadastros por Mês',
    colunas: [{ id: 'mesNome', rotulo: 'Mês', larg: 'minmax(140px,1fr)' }, { id: 'qtde', rotulo: 'Cadastros', tipo: 'numero', larg: '110px' }],
    agruparPor: 'igreja', totais: [{ rotulo: 'Total de Cadastros', tipo: 'soma', coluna: 'qtde' }],
  }],
};

const PESSOAS_ESTADO: GrupoDef = {
  id: 'pessoas_estado', nome: '20 - Pessoas por Estado', filtros: [fSituacao],
  relatorios: [{ id: 'lista', nome: 'Pessoas por Estado', titulo: 'Pessoas por Estado', colunas: [{ id: 'estado', rotulo: 'Descrição do Estado', larg: 'minmax(200px,1.4fr)' }, { id: 'sigla', rotulo: 'Sigla', larg: '80px' }, { id: 'qtde', rotulo: 'Qtde', tipo: 'numero', larg: '90px' }], totais: [{ rotulo: 'Estados', tipo: 'contagem' }, { rotulo: 'Pessoas', tipo: 'soma', coluna: 'qtde' }] }],
};
const IGREJAS_ESTADO: GrupoDef = {
  id: 'igrejas_estado', nome: '21 - Igrejas por Estado', filtros: [{ id: 'situacao', rotulo: 'Situação', tipo: 'opcao', opcoes: SITUACAO_IGREJA, padrao: 'ativa' }],
  relatorios: [{ id: 'lista', nome: 'Igrejas por Estado', titulo: 'Igrejas por Estado', colunas: [{ id: 'estado', rotulo: 'Descrição do Estado', larg: 'minmax(200px,1.4fr)' }, { id: 'sigla', rotulo: 'Sigla', larg: '80px' }, { id: 'qtde', rotulo: 'Qtde', tipo: 'numero', larg: '90px' }], totais: [{ rotulo: 'Estados', tipo: 'contagem' }, { rotulo: 'Igrejas', tipo: 'soma', coluna: 'qtde' }] }],
};

const CRESCIMENTO: GrupoDef = {
  id: 'crescimento', nome: '24 - Histórico de Crescimento',
  filtros: [fRegional, fZona, fIgreja, { id: 'anoInicial', rotulo: 'Ano Inicial', tipo: 'ano', padrao: String(new Date().getFullYear() - 4) }, { id: 'anoFinal', rotulo: 'Ano Final', tipo: 'ano', padrao: String(new Date().getFullYear()) }],
  relatorios: [{
    id: 'lista', nome: 'Histórico de Crescimento', titulo: 'Histórico de Crescimento',
    colunas: [{ id: 'ano', rotulo: 'Ano', larg: '80px' }, { id: 'entradas', rotulo: 'Entradas', tipo: 'numero', larg: '100px' }, { id: 'saidas', rotulo: 'Saídas', tipo: 'numero', larg: '100px' }, { id: 'saldo', rotulo: 'Saldo', tipo: 'numero', larg: '100px' }, { id: 'acumulado', rotulo: 'Membros no fim do ano', tipo: 'numero', larg: '170px' }, { id: 'crescimento', rotulo: 'Crescimento', tipo: 'percentual', larg: '120px' }],
    agruparPor: 'igreja', totais: [{ rotulo: 'Entradas', tipo: 'soma', coluna: 'entradas' }, { rotulo: 'Saídas', tipo: 'soma', coluna: 'saidas' }],
    nota: 'Entradas e saídas contadas pelas ocorrências do tipo Entrada e Saída de cada ano.',
  }],
};

const ORDEM_PESSOAS = [
  { valor: 'igreja_codigo_matricula', rotulo: 'Código da Igreja, ROL da Pessoa' }, { valor: 'igreja_codigo_nome', rotulo: 'Código da Igreja, Nome da Pessoa' },
  { valor: 'igreja_nome_matricula', rotulo: 'Nome da Igreja, ROL da Pessoa' }, { valor: 'igreja_nome_nome', rotulo: 'Nome da Igreja, Nome da Pessoa' },
  { valor: 'igreja_cargo_asc', rotulo: 'Código da Igreja, Título Asc, Nome da Pessoa' }, { valor: 'igreja_cargo_desc', rotulo: 'Código da Igreja, Título Des, Nome da Pessoa' },
  { valor: 'regional_igreja_matricula', rotulo: 'Regional, Código da Igreja, ROL da Pessoa (R2)' }, { valor: 'regional_igreja_nome', rotulo: 'Regional, Código da Igreja, Nome da Pessoa (R2)' },
];
const ESTADO_CIVIL = ['Solteiro(a)', 'Casado(a)', 'Viúvo(a)', 'Divorciado(a)', 'Desquitado(a)', 'Separado(a)', 'União Estável', 'Outros'].map((v) => ({ valor: v, rotulo: v }));
const nascimento: ColunaDef = { id: 'nascimento', rotulo: 'Nascimento', tipo: 'data', larg: '110px' };
const assinatura: ColunaDef = { id: 'assinatura', rotulo: 'Assinatura', larg: 'minmax(200px,1.4fr)' };
const qtdeMembros = contagem('Quantidade de Pessoas');

const PESSOAS: GrupoDef = {
  id: 'pessoas', nome: '6 - Pessoas',
  filtros: [
    { id: 'ordem', rotulo: 'Ordem', tipo: 'opcao', opcoes: ORDEM_PESSOAS, padrao: 'igreja_codigo_matricula', largura: 2 },
    { id: 'agrupar', rotulo: 'Agrupar Igrejas', tipo: 'marcar', padrao: '1' },
    { id: 'origemMembros', rotulo: 'Cadastro de Pessoas - Membros', tipo: 'marcar', padrao: '1' },
    { id: 'origemOutros', rotulo: 'Cadastro de Pessoas - Outros', tipo: 'marcar' },
    { id: 'nome', rotulo: 'Nome', tipo: 'texto_modo', opcoes: MODO_TEXTO, largura: 2 },
    { id: 'situacao', rotulo: 'Situação', tipo: 'opcao', opcoes: SITUACAO_PESSOA, padrao: 'ativos' },
    { id: 'matriculaInicial', rotulo: 'ROL Inicial', tipo: 'numero' },
    { id: 'matriculaFinal', rotulo: 'ROL Final', tipo: 'numero' },
    fRegional, fZona, fIgreja,
    { id: 'situacaoIgreja', rotulo: 'Situação da Igreja', tipo: 'opcao', opcoes: [{ valor: 'todas', rotulo: 'Todas' }, { valor: 'ativa', rotulo: 'Ativas' }, { valor: 'inativa', rotulo: 'Inativas' }], padrao: 'todas' },
    { id: 'cargo', rotulo: 'Título', tipo: 'titulo' },
    { id: 'obreiros', rotulo: 'Obreiros', tipo: 'opcao', opcoes: [{ valor: 'sim', rotulo: 'Obreiros (Cooperador ou acima)' }, { valor: 'nao', rotulo: 'Não Obreiros' }] },
    { id: 'sexo', rotulo: 'Sexo', tipo: 'opcao', opcoes: [{ valor: 'Masculino', rotulo: 'Masculino' }, { valor: 'Feminino', rotulo: 'Feminino' }] },
    { id: 'estadoCivil', rotulo: 'Estado Civil', tipo: 'opcao', opcoes: ESTADO_CIVIL },
    { id: 'secao', rotulo: 'Seção', tipo: 'texto' },
    { id: 'zonaEleitoral', rotulo: 'Zona', tipo: 'texto' },
    { id: 'anivInicial', rotulo: 'Aniversário Inicial', tipo: 'data' },
    { id: 'anivFinal', rotulo: 'Aniversário Final', tipo: 'data' },
    { id: 'idadeInicial', rotulo: 'Idade inicial', tipo: 'numero' },
    { id: 'idadeFinal', rotulo: 'Idade final', tipo: 'numero' },
    { id: 'profissao', rotulo: 'Profissão', tipo: 'texto_modo', opcoes: MODO_TEXTO },
    { id: 'tipoPessoa', rotulo: 'Tipo de Pessoa', tipo: 'opcao', opcoes: [{ valor: 'PF', rotulo: 'Pessoa Física' }, { valor: 'PJ', rotulo: 'Pessoa Jurídica' }] },
    { id: 'logradouro', rotulo: 'Logradouro', tipo: 'texto' },
    { id: 'bairro', rotulo: 'Bairro', tipo: 'texto' },
    { id: 'cidade', rotulo: 'Cidade', tipo: 'texto' },
    { id: 'estado', rotulo: 'Estado', tipo: 'texto' },
    { id: 'cadastroInicial', rotulo: 'Dt. Cadastro Inicial', tipo: 'data' },
    { id: 'cadastroFinal', rotulo: 'Dt. Cadastro Final', tipo: 'data' },
  ],
  relatorios: [
    { id: 'com_endereco', nome: 'Lista com endereços', titulo: 'Relação de Membros com Endereço', colunas: [matricula, nome, cargo, { id: 'endereco', rotulo: 'Endereço', larg: 'minmax(320px,2.4fr)' }, fone, nascimento], agruparPor: 'igreja', totais: qtdeMembros, orientacao: 'landscape' },
    { id: 'sem_endereco', nome: 'Lista sem endereços (R2)', titulo: 'Relação de Membros', colunas: [matricula, nome, cargo, fone, nascimento], agruparPor: 'igreja', totais: qtdeMembros },
    { id: 'telefones', nome: 'Lista de telefones', titulo: 'Relação de Telefones', colunas: [matricula, nome, cargo, { id: 'telefoneFixo', rotulo: 'Telefone', larg: '140px' }, { id: 'celular', rotulo: 'Celular', larg: '140px' }], agruparPor: 'igreja', totais: qtdeMembros },
    { id: 'aniversariantes', nome: 'Lista de aniversariantes (Ordem:Codigo da Igreja, Mês e Dia, Nome da Pessoa)', titulo: 'Relação de Aniversariantes', colunas: [{ id: 'diaMes', rotulo: 'Dia/Mês', larg: '80px' }, matricula, nome, cargo, nascimento, { id: 'idade', rotulo: 'Idade', tipo: 'numero', larg: '70px' }, fone], agruparPor: 'igreja', totais: qtdeMembros },
    { id: 'protocolo', nome: 'Lista para protocolo', titulo: 'Lista para Protocolo', colunas: [matricula, nome, cargo, assinatura], agruparPor: 'igreja', totais: qtdeMembros },
    { id: 'protocolo_cartorio', nome: 'Lista de protocolo para cartorio', titulo: 'Lista de Protocolo para Cartório', colunas: [matricula, nome, { id: 'rg', rotulo: 'RG', larg: '130px' }, { id: 'cpf', rotulo: 'CPF', larg: '140px' }, assinatura], agruparPor: 'igreja', totais: qtdeMembros },
    { id: 'protocolo_recebimento', nome: 'Protocolo para recebimento', titulo: 'Protocolo para Recebimento', colunas: [matricula, nome, cargo, { id: 'dataRecebimento', rotulo: 'Data', larg: '110px' }, assinatura], agruparPor: 'igreja', totais: qtdeMembros },
    { id: 'simplificada', nome: 'Lista geral simplificada', titulo: 'Lista Geral Simplificada', colunas: [matricula, nome, cargo, { id: 'situacao', rotulo: 'Situação', larg: '110px' }, igrejaPessoa], totais: qtdeMembros },
    { id: 'emails', nome: 'Lista de emails', titulo: 'Relação de E-mails', colunas: [matricula, nome, cargo, { id: 'email', rotulo: 'E-mail', larg: 'minmax(220px,1.4fr)' }], agruparPor: 'igreja', totais: qtdeMembros },
    { id: 'qtde_igreja', nome: 'Qtde de Pessoas x Igreja (R1)', titulo: 'Quantidade de Pessoas por Igreja', colunas: [{ id: 'igreja', rotulo: 'Igreja', larg: 'minmax(240px,1.6fr)' }, { id: 'qtde', rotulo: 'Qtde de Pessoas', tipo: 'numero', larg: '140px' }], agruparPor: 'regional', totais: [{ rotulo: 'Quantidade de Igrejas', tipo: 'contagem' }, { rotulo: 'Quantidade de Pessoas', tipo: 'soma', coluna: 'qtde' }] },
    { id: 'ficha_resumida', nome: 'Ficha Cadastral Resumida', titulo: 'Ficha Cadastral Resumida', colunas: [matricula, nome, cargo, nascimento, { id: 'estadoCivil', rotulo: 'Estado Civil', larg: '120px' }, { id: 'cpf', rotulo: 'CPF', larg: '140px' }, { id: 'rg', rotulo: 'RG', larg: '120px' }, { id: 'pai', rotulo: 'Pai', larg: 'minmax(180px,1fr)' }, { id: 'mae', rotulo: 'Mãe', larg: 'minmax(180px,1fr)' }, { id: 'endereco', rotulo: 'Endereço', larg: 'minmax(280px,2fr)' }, fone, { id: 'membroDesde', rotulo: 'Membro desde', tipo: 'data', larg: '120px' }, { id: 'batismo', rotulo: 'Batismo', tipo: 'data', larg: '110px' }], agruparPor: 'igreja', totais: qtdeMembros, orientacao: 'landscape' },
    { id: 'casais', nome: 'Lista de Casais', titulo: 'Relação de Casais', colunas: [matricula, nome, cargo, { id: 'conjuge', rotulo: 'Cônjuge', larg: 'minmax(220px,1.4fr)' }, { id: 'cargoConjuge', rotulo: 'Título do Cônjuge', larg: 'minmax(120px,.8fr)' }], agruparPor: 'igreja', totais: [{ rotulo: 'Quantidade de Casais', tipo: 'contagem' }] },
    { id: 'ficha_branco', nome: 'Ficha Cadastral em Branco', titulo: 'Ficha Cadastral', colunas: [{ id: 'campo', rotulo: 'Campo', larg: 'minmax(200px,1fr)' }, { id: 'valor', rotulo: 'Preenchimento', larg: 'minmax(360px,2.4fr)' }], nota: 'Formulário em branco para preencher à mão.' },
    { id: 'por_bairro', nome: 'Lista Pessoas por Bairro', titulo: 'Relação de Pessoas por Bairro', colunas: [matricula, nome, cargo, { id: 'endereco', rotulo: 'Endereço', larg: 'minmax(280px,2fr)' }, fone, igrejaPessoa], agruparPor: 'bairro', totais: qtdeMembros, orientacao: 'landscape' },
    { id: 'por_profissao', nome: 'Lista Pessoas por Profissão', titulo: 'Relação de Pessoas por Profissão', colunas: [matricula, nome, cargo, fone, igrejaPessoa], agruparPor: 'profissao', totais: qtdeMembros },
    { id: 'profissao_igreja', nome: 'Lista Pessoas por Profissão - Igreja', titulo: 'Relação de Pessoas por Profissão - Igreja', colunas: [{ id: 'profissao', rotulo: 'Profissão', larg: 'minmax(180px,1fr)' }, matricula, nome, cargo, fone], agruparPor: 'igreja', totais: qtdeMembros },
    { id: 'telefone_email', nome: 'Lista Pessoas com telefone e email', titulo: 'Relação de Pessoas com Telefone e E-mail', colunas: [matricula, nome, cargo, fone, { id: 'email', rotulo: 'E-mail', larg: 'minmax(220px,1.4fr)' }], agruparPor: 'igreja', totais: qtdeMembros },
    { id: 'adotante', nome: 'Lista Pessoas por Adotante (R3)', titulo: 'Relação de Pessoas por Adotante', colunas: [{ id: 'adotante', rotulo: 'Adotante', larg: 'minmax(200px,1.2fr)' }, matricula, nome, cargo, igrejaPessoa], agruparPor: 'adotante', totais: qtdeMembros, nota: 'O cadastro daqui não tem o campo Adotante: todas as pessoas aparecem como "Sem adotante".' },
  ],
};

const PERIODO_AGENDA = [{ valor: 'hoje', rotulo: 'Hoje' }, { valor: 'ontem', rotulo: 'Ontem' }, { valor: 'semana', rotulo: 'Semana Atual' }, { valor: 'semana_anterior', rotulo: 'Semana Anterior' }, { valor: 'mes', rotulo: 'Mês Atual' }, { valor: 'mes_anterior', rotulo: 'Mês Anterior' }, { valor: 'datas', rotulo: 'Período informado' }];

const AGENDAMENTOS_CULTO: GrupoDef = {
  id: 'agendamentos_culto', nome: '2 - Agendamentos do Culto',
  filtros: [fDataIni, fDataFim, fRegional, fIgreja],
  relatorios: [{
    id: 'lista', nome: 'Agendamentos do Culto', titulo: 'Agendamentos do Culto',
    colunas: [{ id: 'data', rotulo: 'Data', tipo: 'data', larg: '100px' }, { id: 'horario', rotulo: 'Horário', larg: '110px' }, { id: 'tipoCulto', rotulo: 'Tipo de Culto', larg: 'minmax(160px,1fr)' }, { id: 'status', rotulo: 'Situação', larg: '120px' }, { id: 'observacao', rotulo: 'Observação', larg: 'minmax(200px,1.4fr)' }],
    agruparPor: 'igreja', totais: contagem('Quantidade de Cultos'),
  }],
};

const AGENDA_PASTORAL: GrupoDef = {
  id: 'agenda_pastoral', nome: '3 - Agenda Pastoral',
  filtros: [
    { id: 'periodo', rotulo: 'Período', tipo: 'opcao', opcoes: PERIODO_AGENDA, padrao: 'mes' }, fDataIni, fDataFim,
    { id: 'atendente', rotulo: 'Atendente', tipo: 'texto' }, { id: 'atendido', rotulo: 'Atendido(a)', tipo: 'texto' },
    { id: 'status', rotulo: 'Status', tipo: 'opcao', opcoes: ['Aberto', 'Em andamento', 'Concluído', 'Cancelado'].map((v) => ({ valor: v, rotulo: v })) }, { id: 'motivo', rotulo: 'Motivo', tipo: 'texto' }, { id: 'tipo', rotulo: 'Tipo', tipo: 'texto' }, fIgreja,
  ],
  relatorios: [{
    id: 'lista', nome: 'Agenda de Atendimento', titulo: 'Agenda de Atendimento',
    colunas: [{ id: 'data', rotulo: 'Data', larg: '140px' }, { id: 'pessoa', rotulo: 'Pessoa', larg: 'minmax(200px,1.4fr)' }, igrejaPessoa, { id: 'motivo', rotulo: 'Motivo', larg: 'minmax(160px,1fr)' }, { id: 'status', rotulo: 'Status', larg: '120px' }, { id: 'tipo', rotulo: 'Tipo', larg: 'minmax(140px,1fr)' }],
    nota: 'Agenda tirada do Atendimento Pastoral (responsável = atendente).',
    agruparPor: 'atendente', totais: contagem('Atendimento(s)'), orientacao: 'landscape',
  }],
};

const MALA_DIRETA: GrupoDef = {
  id: 'mala_direta', nome: '8 - Mala Direta - Etiquetas',
  filtros: [
    { id: 'ordem', rotulo: 'Ordem', tipo: 'opcao', padrao: 'matricula', opcoes: [{ valor: 'matricula', rotulo: 'ROL' }, { valor: 'nome', rotulo: 'Nome' }] },
    fSituacao, { id: 'matriculas', rotulo: 'ROLs (exemplo: 1,45,67,89)', tipo: 'texto', largura: 2 }, fZona, fIgreja, { id: 'cargo', rotulo: 'Título', tipo: 'titulo' },
    { id: 'obreiros', rotulo: 'Obreiros', tipo: 'opcao', opcoes: [{ valor: 'sim', rotulo: 'Obreiros (Cooperador ou acima)' }, { valor: 'nao', rotulo: 'Não Obreiros' }] },
    { id: 'bairro', rotulo: 'Bairro', tipo: 'texto' }, { id: 'cidade', rotulo: 'Cidade', tipo: 'texto' }, { id: 'estado', rotulo: 'Estado', tipo: 'texto' },
  ],
  relatorios: [
    { id: 'enderecamento', nome: 'Endereçamento', titulo: 'Etiquetas - Endereçamento', formato: 'etiquetas', colunas: [nome, { id: 'endereco', rotulo: 'Endereço', larg: 'minmax(260px,2fr)' }, { id: 'bairroCidade', rotulo: 'Bairro / Cidade', larg: 'minmax(200px,1.2fr)' }, { id: 'cep', rotulo: 'CEP', larg: '100px' }], totais: contagem('Quantidade de Etiquetas') },
    { id: 'codigo_barras', nome: 'Código de Barras', titulo: 'Etiquetas - ROL', formato: 'etiquetas', colunas: [{ id: 'matricula', rotulo: 'ROL', tipo: 'numero', larg: '90px' }, nome, igrejaPessoa], totais: contagem('Quantidade de Etiquetas') },
  ],
};

const AGENDAMENTO_OCORRENCIA: GrupoDef = {
  id: 'agendamento_ocorrencia', nome: '10 - Agendamento de Ocorrência',
  filtros: [fDataIni, fDataFim, fRegional, fZona, fIgreja, { id: 'servico', rotulo: 'Ocorrência', tipo: 'servico' }, { id: 'sexo', rotulo: 'Pessoa Sexo', tipo: 'opcao', opcoes: [{ valor: 'Masculino', rotulo: 'Masculino' }, { valor: 'Feminino', rotulo: 'Feminino' }] }],
  relatorios: [
    { id: 'ocorrencia_igreja', nome: 'Agrupado por Ocorrência e Igreja (R1)', titulo: 'Agendamento de Ocorrência', colunas: [{ id: 'protocolo', rotulo: 'Protocolo', larg: '150px' }, matricula, nome, { id: 'tituloPretendido', rotulo: 'Título pretendido', larg: 'minmax(140px,1fr)' }, { id: 'abertura', rotulo: 'Abertura', tipo: 'data', larg: '100px' }, { id: 'status', rotulo: 'Situação', larg: '120px' }, igrejaPessoa], agruparPor: 'ocorrenciaIgreja', totais: contagem('Quantidade de Pessoas'), orientacao: 'landscape' },
    { id: 'ocorrencia', nome: 'Agrupado por Ocorrência (R2)', titulo: 'Agendamento de Ocorrência', colunas: [{ id: 'protocolo', rotulo: 'Protocolo', larg: '150px' }, matricula, nome, { id: 'tituloPretendido', rotulo: 'Título pretendido', larg: 'minmax(140px,1fr)' }, { id: 'abertura', rotulo: 'Abertura', tipo: 'data', larg: '100px' }, { id: 'status', rotulo: 'Situação', larg: '120px' }, igrejaPessoa], agruparPor: 'ocorrencia', totais: contagem('Quantidade de Pessoas'), orientacao: 'landscape' },
  ],
};

const fFuncao: FiltroDef = { id: 'funcao', rotulo: 'Função', tipo: 'funcao' };
const colsFuncao: ColunaDef[] = [matricula, nome, cargo, { id: 'funcao', rotulo: 'Função', larg: 'minmax(150px,1fr)' }, { id: 'inicio', rotulo: 'Início', tipo: 'data', larg: '100px' }, { id: 'fim', rotulo: 'Fim', tipo: 'data', larg: '100px' }, fone];
const FUNCOES: GrupoDef = {
  id: 'funcoes', nome: '12 - Funções Ocupacionais',
  filtros: [
    { id: 'situacaoFuncao', rotulo: 'Situação da Função', tipo: 'opcao', padrao: 'ativo', opcoes: [{ valor: 'todos', rotulo: 'Todos' }, { valor: 'ativo', rotulo: 'Ativo' }, { valor: 'inativo', rotulo: 'Inativo' }] },
    fRegional, { id: 'cargo', rotulo: 'Título', tipo: 'titulo' }, fZona, fIgreja, fFuncao, { id: 'pessoa', rotulo: 'Pessoa', tipo: 'texto' },
    { id: 'inicioDe', rotulo: 'Início da Função - de', tipo: 'data' }, { id: 'inicioAte', rotulo: 'Início da Função - até', tipo: 'data' },
    { id: 'fimDe', rotulo: 'Fim da Função - de', tipo: 'data' }, { id: 'fimAte', rotulo: 'Fim da Função - até', tipo: 'data' },
  ],
  relatorios: [
    { id: 'por_regional', nome: 'Lista Funções - Por Regional (R1)', titulo: 'Lista de Funções por Regional', colunas: [igrejaPessoa, ...colsFuncao], agruparPor: 'regional', totais: contagem('Quantidade de Pessoas'), orientacao: 'landscape' },
    { id: 'por_regional_igreja', nome: 'Lista Funções - Por Regional/Igreja (R1)', titulo: 'Lista de Funções por Regional / Igreja', colunas: colsFuncao, agruparPor: 'regionalIgreja', totais: contagem('Quantidade de Pessoas'), orientacao: 'landscape' },
    { id: 'ficha_funcao', nome: 'Ficha Cadastral Resumida - Por Função (R2)', titulo: 'Ficha Cadastral Resumida por Função', colunas: [matricula, nome, cargo, { id: 'nascimento', rotulo: 'Nascimento', tipo: 'data', larg: '110px' }, { id: 'endereco', rotulo: 'Endereço', larg: 'minmax(260px,2fr)' }, fone, igrejaPessoa], agruparPor: 'funcao', totais: contagem('Quantidade de Pessoas'), orientacao: 'landscape' },
    { id: 'ficha_regional', nome: 'Ficha Cadastral Resumida - Regional (R1)', titulo: 'Ficha Cadastral Resumida por Regional', colunas: [matricula, nome, cargo, { id: 'funcao', rotulo: 'Função', larg: 'minmax(150px,1fr)' }, { id: 'nascimento', rotulo: 'Nascimento', tipo: 'data', larg: '110px' }, { id: 'endereco', rotulo: 'Endereço', larg: 'minmax(260px,2fr)' }, fone, igrejaPessoa], agruparPor: 'regional', totais: contagem('Quantidade de Pessoas'), orientacao: 'landscape' },
    { id: 'protocolo', nome: 'Lista para Protocolo - Por Função', titulo: 'Lista para Protocolo por Função', colunas: [matricula, nome, cargo, igrejaPessoa, { id: 'assinatura', rotulo: 'Assinatura', larg: 'minmax(200px,1.4fr)' }], agruparPor: 'funcao', totais: contagem('Quantidade de Pessoas') },
    { id: 'por_igreja', nome: 'Lista Funções - Por Igreja', titulo: 'Lista de Funções por Igreja', colunas: colsFuncao, agruparPor: 'igreja', totais: contagem('Quantidade de Pessoas'), orientacao: 'landscape' },
    { id: 'casais', nome: 'Lista Funções - Casais (R1)', titulo: 'Lista de Funções - Casais', colunas: [matricula, nome, cargo, { id: 'funcao', rotulo: 'Função', larg: 'minmax(150px,1fr)' }, { id: 'conjuge', rotulo: 'Cônjuge', larg: 'minmax(200px,1.2fr)' }, igrejaPessoa], agruparPor: 'regional', totais: contagem('Quantidade de Pessoas'), orientacao: 'landscape' },
    { id: 'por_pessoa', nome: 'Lista de Funções - Por Pessoa', titulo: 'Lista de Funções por Pessoa', colunas: [{ id: 'funcao', rotulo: 'Função', larg: 'minmax(160px,1fr)' }, igrejaPessoa, { id: 'inicio', rotulo: 'Início', tipo: 'data', larg: '100px' }, { id: 'fim', rotulo: 'Fim', tipo: 'data', larg: '100px' }, { id: 'situacaoFuncao', rotulo: 'Situação', larg: '90px' }], agruparPor: 'pessoa', totais: contagem('Quantidade de Funções') },
  ],
};

const EMISSAO_DOCUMENTOS: GrupoDef = {
  id: 'emissao_documentos', nome: '14 - Consulta Emissão de Documentos',
  filtros: [
    { id: 'ordem', rotulo: 'Ordem', tipo: 'opcao', padrao: 'igreja_matricula', opcoes: [{ valor: 'igreja_matricula', rotulo: 'Igreja, ROL' }, { valor: 'igreja_nome', rotulo: 'Igreja, Nome' }, { valor: 'igreja_emissao', rotulo: 'Igreja, Emissão' }, { valor: 'igreja_validade', rotulo: 'Igreja, Validade' }] },
    fIgreja, fRegional, { id: 'matricula', rotulo: 'ROL', tipo: 'numero' }, { id: 'cargo', rotulo: 'Título', tipo: 'titulo' }, { id: 'pessoa', rotulo: 'Pessoa', tipo: 'texto' },
    { id: 'emissaoInicial', rotulo: 'Emissão Inicial', tipo: 'data' }, { id: 'emissaoFinal', rotulo: 'Emissão Final', tipo: 'data' },
    { id: 'validadeInicial', rotulo: 'Validade Inicial', tipo: 'data' }, { id: 'validadeFinal', rotulo: 'Validade Final', tipo: 'data' },
  ],
  relatorios: [{
    id: 'credencial', nome: 'Credencial', titulo: 'Consulta Emissão de Documentos - Credencial',
    colunas: [matricula, nome, cargo, { id: 'documento', rotulo: 'Documento', larg: '130px' }, { id: 'numero', rotulo: 'Número', larg: '110px' }, { id: 'via', rotulo: 'Via', larg: '60px' }, { id: 'emissao', rotulo: 'Emissão', tipo: 'data', larg: '100px' }, { id: 'validade', rotulo: 'Validade', tipo: 'data', larg: '100px' }, { id: 'situacao', rotulo: 'Situação', larg: '110px' }],
    agruparPor: 'igreja', totais: contagem('Quantidade de Documentos'), orientacao: 'landscape',
    nota: 'Aqui só a credencial tem registro de emissão; diplomas e cartas não ficam gravados.',
  }],
};

const colsTransf: ColunaDef[] = [{ id: 'protocolo', rotulo: 'Protocolo', larg: '150px' }, matricula, nome, cargo, { id: 'origem', rotulo: 'Igreja de Origem', larg: 'minmax(200px,1.2fr)' }, { id: 'destino', rotulo: 'Igreja de Destino', larg: 'minmax(200px,1.2fr)' }, { id: 'abertura', rotulo: 'Solicitado em', tipo: 'data', larg: '110px' }];
const TRANSFERENCIAS: GrupoDef = {
  id: 'transferencias_pendentes', nome: '17 - Transferências Pendentes', filtros: [fRegional, fZona, { id: 'igreja', rotulo: 'Igreja de Origem', tipo: 'igreja' }],
  relatorios: [{ id: 'lista', nome: 'Transferências Pendentes', titulo: 'Transferências Pendentes', colunas: colsTransf, agruparPor: 'origem', totais: contagem('Quantidade de Transferências'), orientacao: 'landscape' }],
};
const RECEBIMENTOS: GrupoDef = {
  id: 'recebimentos_pendentes', nome: '18 - Recebimentos Pendentes', filtros: [fRegional, fZona, { id: 'igreja', rotulo: 'Igreja de Destino', tipo: 'igreja' }],
  relatorios: [{ id: 'lista', nome: 'Recebimentos Pendentes', titulo: 'Recebimentos Pendentes', colunas: colsTransf, agruparPor: 'destino', totais: contagem('Quantidade de Recebimentos'), orientacao: 'landscape' }],
};

const USUARIOS: GrupoDef = {
  id: 'usuarios', nome: '19 - Usuários do Sistema', filtros: [fIgreja, { id: 'mes', rotulo: 'Mês do último acesso', tipo: 'opcao', opcoes: MESES, so: ['log'] }],
  relatorios: [
    { id: 'por_igreja', nome: 'Usuários por Igreja', titulo: 'Usuários por Igreja', colunas: [{ id: 'nome', rotulo: 'Nome', larg: 'minmax(220px,1.4fr)' }, { id: 'email', rotulo: 'E-mail', larg: 'minmax(220px,1.4fr)' }, { id: 'perfil', rotulo: 'Perfil', larg: '120px' }, { id: 'funcao', rotulo: 'Grupo', larg: 'minmax(140px,1fr)' }, { id: 'ativo', rotulo: 'Ativo', larg: '70px' }, { id: 'ultimoAcesso', rotulo: 'Último acesso', larg: '150px' }], agruparPor: 'igreja', totais: contagem('Quantidade de Usuários') },
    { id: 'log', nome: 'Log de Acesso de Usuários', titulo: 'Log de Acesso de Usuários', colunas: [{ id: 'ultimoAcesso', rotulo: 'Último acesso', larg: '150px' }, { id: 'nome', rotulo: 'Nome', larg: 'minmax(220px,1.4fr)' }, { id: 'email', rotulo: 'E-mail', larg: 'minmax(220px,1.4fr)' }, { id: 'ip', rotulo: 'IP', larg: '130px' }, igrejaPessoa], totais: contagem('Quantidade de Usuários'), nota: 'Aqui fica gravado só o último acesso de cada usuário, não o histórico de todos os acessos.' },
  ],
};

export const GRUPOS_SECRETARIA: GrupoDef[] = [IGREJAS, PESSOAS, AGENDAMENTOS_CULTO, AGENDA_PASTORAL, MALA_DIRETA, AGENDAMENTO_OCORRENCIA, FUNCOES, EMISSAO_DOCUMENTOS, TRANSFERENCIAS, RECEBIMENTOS, USUARIOS, ANIVERSARIANTES, ANIVERSARIANTES_DIA, FAMILIARES, HISTORICO_OCORRENCIA, ANUAL_OCORRENCIAS, FAIXA_ETARIA, ESTATISTICA_CARGOS, CADASTROS_MES, PESSOAS_ESTADO, IGREJAS_ESTADO, GRAFICO_CARGOS, RANKING_OCORRENCIA, CRESCIMENTO];
