import type { Linha } from './tipos';
import { CARGO_TXT, consultar, IGREJA_TXT, JOIN_CARGO, JOIN_PESSOA, ondePessoa, Sql, uuid, type Executor, type Filtros } from './base';

/** Relatórios de Secretaria baseados em pessoas, familiares e ocorrências. */

const MES_NOME = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const int = (v: string | undefined, min: number, max: number) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : undefined; };
const data = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const UF: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão',
  MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};
const PARENTESCO: Record<string, string> = { CONJUGE: 'Cônjuge', FILHO: 'Filho(a)', PAI_MAE: 'Pai / Mãe', IRMAO: 'Irmão(ã)', OUTRO: 'Outro' };

// ─── 4 - Aniversariantes ─────────────────────────────────────────────────────
const aniversariantes: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = ondePessoa(s, campoId, { ...f, situacao: 'ativos' });
  onde.push('m.birth_date is not null');
  if (f.hoje === '1') onde.push(`to_char(m.birth_date,'MM-DD') = to_char(current_date,'MM-DD')`);
  else {
    const mes = int(f.mes, 1, 12);
    if (mes) onde.push(`extract(month from m.birth_date) = ${s.p(mes)}`);
    const di = int(f.diaInicial, 1, 31), dfim = int(f.diaFinal, 1, 31);
    if (di) onde.push(`extract(day from m.birth_date) >= ${s.p(di)}`);
    if (dfim) onde.push(`extract(day from m.birth_date) <= ${s.p(dfim)}`);
  }
  const ls = await consultar(`
    select extract(month from m.birth_date)::int as mes, extract(day from m.birth_date)::int as dia, m.rol as matricula, m.full_name as nome,
      ${CARGO_TXT} as cargo, m.birth_date as nascimento, date_part('year', age(current_date, m.birth_date))::int as idade,
      coalesce(nullif(m.mobile,''), nullif(m.phone,'')) as telefone, ${IGREJA_TXT} as igreja
    from members m ${JOIN_PESSOA} ${JOIN_CARGO}
    where ${onde.join(' and ')} order by mes, dia, m.full_name`, s.params);
  ls.forEach((l) => { l.mesNome = MES_NOME[Number(l.mes) - 1] ?? ''; });
  return ls;
};

// ─── 5 - Aniversariantes do Dia ──────────────────────────────────────────────
const aniversariantesDia: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = ondePessoa(s, campoId, { ...f, situacao: 'ativos' });
  onde.push('m.birth_date is not null');
  if (f.periodo === 'mes') onde.push('extract(month from m.birth_date) = extract(month from current_date)');
  else if (f.periodo === 'semana') onde.push(`to_char(m.birth_date,'MM-DD') in (select to_char(d,'MM-DD') from generate_series(date_trunc('week', current_date)::date - 1, date_trunc('week', current_date)::date + 5, interval '1 day') d)`);
  else onde.push(`to_char(m.birth_date,'MM-DD') = to_char(current_date,'MM-DD')`);
  return consultar(`
    select m.rol as matricula, ${CARGO_TXT} as cargo, m.full_name as nome, coalesce(nullif(m.mobile,''), nullif(m.phone,'')) as telefone,
      ${IGREJA_TXT} as igreja, m.email, m.birth_date as nascimento
    from members m ${JOIN_PESSOA} ${JOIN_CARGO}
    where ${onde.join(' and ')} order by to_char(m.birth_date,'MM-DD'), m.full_name`, s.params);
};

// ─── 7 - Familiares ──────────────────────────────────────────────────────────
const familiares: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = ondePessoa(s, campoId, f);
  onde.push('fr.deleted_at is null');
  if (f.pessoa?.trim()) onde.push(`m.full_name ilike ${s.p(`%${f.pessoa.trim()}%`)}`);
  if (f.parentesco && PARENTESCO[f.parentesco]) onde.push(`fr.relationship_type = ${s.p(f.parentesco)}`);
  const ai = data(f.anivInicial), af = data(f.anivFinal);
  const nasc = 'coalesce(rm.birth_date, fr.related_birth_date)';
  if (ai) onde.push(`to_char(${nasc},'MM-DD') >= to_char(${s.p(ai)}::date,'MM-DD')`);
  if (af) onde.push(`to_char(${nasc},'MM-DD') <= to_char(${s.p(af)}::date,'MM-DD')`);
  const ls = await consultar(`
    select m.rol as matricula, m.full_name as nome_pessoa, coalesce(m.rol::text || ' - ', '') || m.full_name as pessoa,
      coalesce(rm.full_name, fr.related_name) as familiar, fr.relationship_type as parentesco, ${nasc} as "nascimentoFamiliar",
      coalesce(rm.gender, fr.related_gender) as "sexoFamiliar"
    from member_family_relationships fr
    join members m on m.id = fr.member_id
    ${JOIN_PESSOA}
    left join members rm on rm.id = fr.related_member_id
    where ${onde.join(' and ')}
    order by ${f.ordem === 'nome' ? 'm.full_name' : 'm.rol nulls last, m.full_name'}, fr.relationship_type`, s.params);
  ls.forEach((l) => { l.parentesco = PARENTESCO[String(l.parentesco)] ?? l.parentesco; });
  return ls;
};

// ─── Ocorrências (9, 11, 23) ─────────────────────────────────────────────────
function ondeOcorrencia(s: Sql, campoId: string, f: Filtros) {
  const onde = [`r.campo_id = ${s.p(campoId)}::uuid`, 'm.deleted_at is null'];
  if (uuid(f.igreja)) onde.push(`o.church_id = ${s.p(f.igreja)}::uuid`);
  if (uuid(f.regional)) onde.push(`c.regional_id = ${s.p(f.regional)}::uuid`);
  if (f.zona?.trim()) onde.push(`c.zone = ${s.p(f.zona.trim())}`);
  if (f.ocorrencia?.trim()) onde.push(`o.name ilike ${s.p(`%${f.ocorrencia.trim()}%`)}`);
  if (f.tipoOcorrencia && f.tipoOcorrencia !== 'todas') onde.push(`coalesce(o.metadata->>'tipo','Normal') = ${s.p(f.tipoOcorrencia)}`);
  const di = data(f.dataInicial), df = data(f.dataFinal);
  if (di) onde.push(`o.occurred_at >= ${s.p(di)}::date`);
  if (df) onde.push(`o.occurred_at < ${s.p(df)}::date + 1`);
  return onde;
}
const FROM_OCO = `from member_occurrences o join members m on m.id = o.member_id join churches c on c.id = o.church_id join regionais r on r.id = c.regional_id ${JOIN_CARGO}`;

const historicoOcorrencia: Executor = async (rel, campoId, f) => {
  const s = new Sql();
  const onde = ondeOcorrencia(s, campoId, f);
  if (rel.startsWith('sint_')) {
    return consultar(`select ${IGREJA_TXT} as igreja, o.name as ocorrencia, count(*)::int as qtde ${FROM_OCO} where ${onde.join(' and ')}
      group by 1, 2 order by ${rel === 'sint_igreja' ? '1, 2' : '2, 1'}`, s.params);
  }
  return consultar(`
    select o.occurred_at::date as data, m.rol as matricula, m.full_name as nome, ${CARGO_TXT} as cargo, o.name as ocorrencia,
      coalesce(o.metadata->>'tipo','Normal') as tipo, ${IGREJA_TXT} as igreja, coalesce(nullif(o.metadata->>'localidade',''), o.member_city) as local
      ${f.observacoes === '1' ? ', o.message as observacao' : ''}
    ${FROM_OCO} where ${onde.join(' and ')}
    order by ${rel === 'por_igreja' ? 'igreja, data, nome' : 'ocorrencia, data, nome'}`, s.params);
};

const anualOcorrencias: Executor = async (rel, campoId, f) => {
  const s = new Sql();
  const onde = ondeOcorrencia(s, campoId, f);
  const ano = int(f.ano, 1900, 2100) ?? new Date().getFullYear();
  onde.push(`extract(year from o.occurred_at) = ${s.p(ano)}`);
  const meses = Array.from({ length: 12 }, (_, i) => `count(*) filter (where extract(month from o.occurred_at) = ${i + 1})::int as m${i + 1}`).join(', ');
  return consultar(`select ${IGREJA_TXT} as igreja, o.name as ocorrencia, ${meses}, count(*)::int as total ${FROM_OCO}
    where ${onde.join(' and ')} group by 1, 2 order by ${rel === 'por_igreja' ? '1, 2' : '2, 1'}`, s.params);
};

const rankingOcorrencia: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = ondeOcorrencia(s, campoId, f);
  const ano = int(f.ano, 1900, 2100), mes = int(f.mes, 1, 12);
  if (ano) onde.push(`extract(year from o.occurred_at) = ${s.p(ano)}`);
  if (mes) onde.push(`extract(month from o.occurred_at) = ${s.p(mes)}`);
  const ls = await consultar(`select ${IGREJA_TXT} as igreja, count(*)::int as qtde ${FROM_OCO} where ${onde.join(' and ')} group by 1 order by 2 desc, 1`, s.params);
  const total = ls.reduce((t, l) => t + Number(l.qtde), 0);
  ls.forEach((l, i) => { l.posicao = i + 1; l.percentual = total ? Math.round((Number(l.qtde) / total) * 10000) / 100 : 0; });
  return ls;
};

// ─── 13 - Faixa Etária ───────────────────────────────────────────────────────
const FAIXA = `case when m.birth_date is null then 'Sem data de nascimento'
  when age(current_date, m.birth_date) < interval '12 years' then '00 a 11 anos'
  when age(current_date, m.birth_date) < interval '18 years' then '12 a 17 anos'
  when age(current_date, m.birth_date) < interval '30 years' then '18 a 29 anos'
  when age(current_date, m.birth_date) < interval '45 years' then '30 a 44 anos'
  when age(current_date, m.birth_date) < interval '60 years' then '45 a 59 anos'
  else '60 anos ou mais' end`;
const faixaEtaria: Executor = async (rel, campoId, f) => {
  const s = new Sql();
  const onde = ondePessoa(s, campoId, f);
  return consultar(`select ${rel === 'por_igreja' ? `${IGREJA_TXT}` : "'Todas as igrejas'"} as igreja, ${FAIXA} as faixa,
      count(*) filter (where m.gender = 'Masculino')::int as masculino, count(*) filter (where m.gender = 'Feminino')::int as feminino, count(*)::int as qtde
    from members m ${JOIN_PESSOA} where ${onde.join(' and ')} group by 1, 2 order by 1, 2`, s.params);
};

// ─── 15 e 22 - Estatística de Cargos ─────────────────────────────────────────
const estatisticaCargos: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = ondePessoa(s, campoId, f);
  const ig = f.agrupar === '1' ? IGREJA_TXT : "'Todas as igrejas'";
  return consultar(`select ${ig} as igreja, ${CARGO_TXT} as cargo, min(coalesce(et.level, 0)) as nivel,
      count(*) filter (where m.gender = 'Masculino')::int as masculino, count(*) filter (where m.gender = 'Feminino')::int as feminino, count(*)::int as qtde
    from members m ${JOIN_PESSOA} ${JOIN_CARGO} where ${onde.join(' and ')}
    group by 1, 2 order by 1, ${f.ordem === 'total' ? 'qtde desc' : 'nivel desc, cargo'}`, s.params);
};
const graficoCargos: Executor = async (rel, campoId, f) => {
  const ls = await estatisticaCargos(rel, campoId, { ...f, ordem: 'total' });
  const total = new Map<string, number>();
  ls.forEach((l) => total.set(String(l.igreja), (total.get(String(l.igreja)) ?? 0) + Number(l.qtde)));
  ls.forEach((l) => { const t = total.get(String(l.igreja)) ?? 0; l.percentual = t ? Math.round((Number(l.qtde) / t) * 10000) / 100 : 0; });
  return ls;
};

// ─── 16 - Qtde Cadastros por Mês ─────────────────────────────────────────────
const cadastrosMes: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = ondePessoa(s, campoId, { ...f, situacao: 'todos' });
  const ano = int(f.ano, 1900, 2100) ?? new Date().getFullYear();
  onde.push(`extract(year from coalesce(m.membership_date, m.created_at)) = ${s.p(ano)}`);
  const ig = f.agrupar === '1' ? IGREJA_TXT : "'Todas as igrejas'";
  const ls = await consultar(`select ${ig} as igreja, extract(month from coalesce(m.membership_date, m.created_at))::int as mes, count(*)::int as qtde
    from members m ${JOIN_PESSOA} where ${onde.join(' and ')} group by 1, 2 order by 1, 2`, s.params);
  ls.forEach((l) => { l.mesNome = MES_NOME[Number(l.mes) - 1] ?? ''; });
  return ls;
};

// ─── 20 e 21 - Por Estado ────────────────────────────────────────────────────
const porEstado = (tabela: 'members' | 'churches'): Executor => async (_rel, campoId, f) => {
  const s = new Sql();
  let sql: string;
  if (tabela === 'members') {
    const onde = ondePessoa(s, campoId, f);
    sql = `select upper(coalesce(nullif(trim(m.address_state),''),'--')) as sigla, count(*)::int as qtde from members m ${JOIN_PESSOA} where ${onde.join(' and ')} group by 1 order by 2 desc`;
  } else {
    const onde = [`r.campo_id = ${s.p(campoId)}::uuid`, 'c.deleted_at is null'];
    if (f.situacao === 'ativa') onde.push(`coalesce(c.status,'active') = 'active'`);
    if (f.situacao === 'inativa') onde.push(`coalesce(c.status,'active') <> 'active'`);
    sql = `select upper(coalesce(nullif(trim(c.address_state),''),'--')) as sigla, count(*)::int as qtde from churches c join regionais r on r.id = c.regional_id where ${onde.join(' and ')} group by 1 order by 2 desc`;
  }
  const ls = await consultar(sql, s.params);
  ls.forEach((l) => { l.estado = UF[String(l.sigla)] ?? 'Não informado'; });
  return ls;
};

// ─── 24 - Histórico de Crescimento ───────────────────────────────────────────
const crescimento: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const anoI = int(f.anoInicial, 1900, 2100) ?? new Date().getFullYear() - 4;
  const anoF = Math.max(anoI, int(f.anoFinal, 1900, 2100) ?? new Date().getFullYear());
  const ondeM = ondePessoa(s, campoId, { ...f, situacao: 'todos' });
  const pI = s.p(anoI), pF = s.p(anoF);
  const ls = await consultar(`
    with pessoas as (
      select m.id, ${IGREJA_TXT} as igreja, coalesce(m.membership_date, m.created_at)::date as entrada,
        (select min(o.occurred_at)::date from member_occurrences o where o.member_id = m.id and o.metadata->>'tipo' = 'Saída') as saida
      from members m ${JOIN_PESSOA} where ${ondeM.join(' and ')}
    ), anos as (select generate_series(${pI}::int, ${pF}::int) as ano)
    select p.igreja, a.ano::text as ano,
      count(*) filter (where extract(year from p.entrada) = a.ano)::int as entradas,
      count(*) filter (where extract(year from p.saida) = a.ano)::int as saidas,
      count(*) filter (where p.entrada <= make_date(a.ano, 12, 31) and (p.saida is null or p.saida > make_date(a.ano, 12, 31)))::int as acumulado,
      count(*) filter (where p.entrada <= make_date(a.ano - 1, 12, 31) and (p.saida is null or p.saida > make_date(a.ano - 1, 12, 31)))::int as anterior
    from pessoas p cross join anos a group by 1, 2 order by 1, 2`, s.params);
  ls.forEach((l: Linha) => {
    l.saldo = Number(l.entradas) - Number(l.saidas);
    l.crescimento = Number(l.anterior) ? Math.round(((Number(l.acumulado) - Number(l.anterior)) / Number(l.anterior)) * 10000) / 100 : null;
  });
  return ls;
};

// ─── 6 - Pessoas ─────────────────────────────────────────────────────────────
const ORDEM_PESSOAS: Record<string, string> = {
  igreja_codigo_matricula: 'c.code, m.rol nulls last, m.full_name', igreja_codigo_nome: 'c.code, m.full_name',
  igreja_nome_matricula: 'c.name, m.rol nulls last, m.full_name', igreja_nome_nome: 'c.name, m.full_name',
  igreja_cargo_asc: 'c.code, coalesce(et.level,0), m.full_name', igreja_cargo_desc: 'c.code, coalesce(et.level,0) desc, m.full_name',
  regional_igreja_matricula: 'rg.name, c.code, m.rol nulls last, m.full_name', regional_igreja_nome: 'rg.name, c.code, m.full_name',
};
const FICHA_BRANCO = ['ROL', 'Nome', 'Título', 'Data de Nascimento', 'Sexo', 'Estado Civil', 'CPF', 'RG', 'Nome do Pai', 'Nome da Mãe', 'Cônjuge', 'Endereço', 'Bairro', 'Cidade / UF', 'CEP', 'Telefone', 'Celular', 'E-mail', 'Profissão', 'Naturalidade', 'Data de Batismo', 'Membro desde', 'Igreja'];

const pessoas: Executor = async (rel, campoId, f) => {
  if (rel === 'ficha_branco') return FICHA_BRANCO.map((campo) => ({ campo, valor: '' }));
  const s = new Sql();
  const onde = ondePessoa(s, campoId, f);
  const membros = f.origemMembros === '1', outros = f.origemOutros === '1';
  if (membros && !outros) onde.push(`coalesce(m.member_type,'MEMBRO') = 'MEMBRO'`);
  if (outros && !membros) onde.push(`coalesce(m.member_type,'MEMBRO') <> 'MEMBRO'`);
  if (!membros && !outros) return [];
  if (f.nome?.trim()) onde.push(`m.full_name ilike ${s.p(f.nome_modo === 'comeca' ? `${f.nome.trim()}%` : `%${f.nome.trim()}%`)}`);
  const ri = int(f.matriculaInicial, 0, 10_000_000), rf = int(f.matriculaFinal, 0, 10_000_000);
  if (ri != null) onde.push(`m.rol >= ${s.p(ri)}`);
  if (rf != null) onde.push(`m.rol <= ${s.p(rf)}`);
  if (f.situacaoIgreja === 'ativa') onde.push(`coalesce(c.status,'active') = 'active'`);
  if (f.situacaoIgreja === 'inativa') onde.push(`coalesce(c.status,'active') <> 'active'`);
  if (uuid(f.cargo)) onde.push(`m.ecclesiastical_title_id = ${s.p(f.cargo)}::uuid`);
  if (f.obreiros === 'sim') onde.push('coalesce(et.level,0) >= 1');
  if (f.obreiros === 'nao') onde.push('coalesce(et.level,0) < 1');
  if (f.sexo) onde.push(`m.gender = ${s.p(f.sexo)}`);
  if (f.estadoCivil) onde.push(`m.marital_status = ${s.p(f.estadoCivil)}`);
  if (f.secao?.trim()) onde.push(`m.voter_section = ${s.p(f.secao.trim())}`);
  if (f.zonaEleitoral?.trim()) onde.push(`m.voter_zone = ${s.p(f.zonaEleitoral.trim())}`);
  const ai = data(f.anivInicial), af = data(f.anivFinal);
  if (ai) onde.push(`to_char(m.birth_date,'MM-DD') >= to_char(${s.p(ai)}::date,'MM-DD')`);
  if (af) onde.push(`to_char(m.birth_date,'MM-DD') <= to_char(${s.p(af)}::date,'MM-DD')`);
  const ii = int(f.idadeInicial, 0, 150), iff = int(f.idadeFinal, 0, 150);
  if (ii != null) onde.push(`date_part('year', age(current_date, m.birth_date)) >= ${s.p(ii)}`);
  if (iff != null) onde.push(`date_part('year', age(current_date, m.birth_date)) <= ${s.p(iff)}`);
  if (f.profissao?.trim()) onde.push(`m.occupation ilike ${s.p(f.profissao_modo === 'comeca' ? `${f.profissao.trim()}%` : `%${f.profissao.trim()}%`)}`);
  if (f.tipoPessoa === 'PJ') onde.push(`m.member_type = 'PJ'`);
  if (f.tipoPessoa === 'PF') onde.push(`coalesce(m.member_type,'MEMBRO') <> 'PJ'`);
  for (const [k, col] of [['logradouro', 'address_street'], ['bairro', 'address_neighborhood'], ['cidade', 'address_city'], ['estado', 'address_state']] as const) {
    if (f[k]?.trim()) onde.push(`m.${col} ilike ${s.p(`%${f[k].trim()}%`)}`);
  }
  const ci = data(f.cadastroInicial), cf = data(f.cadastroFinal);
  if (ci) onde.push(`coalesce(m.membership_date, m.created_at::date) >= ${s.p(ci)}::date`);
  if (cf) onde.push(`coalesce(m.membership_date, m.created_at::date) <= ${s.p(cf)}::date`);
  // Um casal por linha: com cônjuge vinculado, fica a linha do marido; com só o nome do cônjuge, a pessoa.
  if (rel === 'casais') onde.push(`(sp.id is not null or coalesce(m.spouse_name,'') <> '') and (sp.id is null or m.gender = 'Masculino' or sp.gender is distinct from 'Masculino')`);
  if (rel === 'emails') onde.push(`coalesce(m.email,'') <> ''`);
  if (rel === 'telefone_email') onde.push(`(coalesce(m.email,'') <> '' or coalesce(m.mobile,'') <> '' or coalesce(m.phone,'') <> '')`);

  const from = `from members m ${JOIN_PESSOA} left join regionais rg on rg.id = c.regional_id ${JOIN_CARGO}
    left join members sp on sp.id = m.spouse_id left join ecclesiastical_titles spt on spt.id = sp.ecclesiastical_title_id`;
  if (rel === 'qtde_igreja') {
    return consultar(`select coalesce(rg.name,'') as regional, ${IGREJA_TXT} as igreja, count(*)::int as qtde ${from} where ${onde.join(' and ')}
      group by rg.name, c.code, c.name order by rg.name, c.code`, s.params);
  }
  let ordem = ORDEM_PESSOAS[f.ordem ?? ''] ?? ORDEM_PESSOAS.igreja_codigo_matricula;
  if (rel === 'aniversariantes') ordem = `c.code, to_char(m.birth_date,'MM-DD'), m.full_name`;
  if (rel === 'por_bairro') ordem = `upper(coalesce(m.address_neighborhood,'')), m.full_name`;
  if (rel === 'por_profissao') ordem = `upper(coalesce(m.occupation,'')), m.full_name`;
  if (rel === 'profissao_igreja') ordem = `c.code, upper(coalesce(m.occupation,'')), m.full_name`;
  const ls = await consultar(`
    select m.rol as matricula, m.full_name as nome, ${CARGO_TXT} as cargo, ${IGREJA_TXT} as igreja, coalesce(rg.name,'') as regional,
      m.membership_status as situacao,
      concat_ws(' - ', nullif(concat_ws(', ', nullif(m.address_street,''), nullif(m.address_number,''), nullif(m.address_complement,'')),''), nullif(m.address_neighborhood,''),
        nullif(concat_ws('-', nullif(m.address_city,''), nullif(m.address_state,'')),''))
        || case when coalesce(m.address_zipcode,'') <> '' then ' CEP: ' || m.address_zipcode else '' end as endereco,
      coalesce(nullif(m.mobile,''), nullif(m.phone,'')) as telefone, m.phone as "telefoneFixo", m.mobile as celular, m.email,
      m.birth_date as nascimento, date_part('year', age(current_date, m.birth_date))::int as idade, to_char(m.birth_date,'DD/MM') as "diaMes",
      m.cpf, m.rg, m.father_name as pai, m.mother_name as mae, m.marital_status as "estadoCivil", m.membership_date as "membroDesde", m.baptism_date as batismo,
      coalesce(nullif(trim(m.address_neighborhood),''), 'Sem bairro') as bairro, coalesce(nullif(trim(m.occupation),''), 'Sem profissão') as profissao,
      coalesce(sp.full_name, m.spouse_name) as conjuge, coalesce(spt.name, sp.ecclesiastical_title) as "cargoConjuge",
      'Sem adotante' as adotante, '' as assinatura, '____/____/______' as "dataRecebimento"
    ${from} where ${onde.join(' and ')} order by ${ordem}`, s.params);
  return ls;
};

export const EXECUTORES_PESSOAS: Record<string, Executor> = {
  'secretaria.pessoas': pessoas,
  'secretaria.aniversariantes': aniversariantes,
  'secretaria.aniversariantes_dia': aniversariantesDia,
  'secretaria.familiares': familiares,
  'secretaria.historico_ocorrencia': historicoOcorrencia,
  'secretaria.anual_ocorrencias': anualOcorrencias,
  'secretaria.ranking_ocorrencia': rankingOcorrencia,
  'secretaria.faixa_etaria': faixaEtaria,
  'secretaria.estatistica_cargos': estatisticaCargos,
  'secretaria.grafico_cargos': graficoCargos,
  'secretaria.cadastros_mes': cadastrosMes,
  'secretaria.pessoas_estado': porEstado('members'),
  'secretaria.igrejas_estado': porEstado('churches'),
  'secretaria.crescimento': crescimento,
};
