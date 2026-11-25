import type { Linha } from './tipos';
import { CARGO_TXT, consultar, IGREJA_TXT, JOIN_CARGO, Sql, uuid, type Executor, type Filtros } from './base';
import { limitesSql, periodo } from './servidorSecretaria2';

/** Relatórios de Tesouraria sobre livro_caixa, contas a pagar, anuidades e cultos. */

const int = (v: string | undefined, min: number, max: number) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : undefined; };
const num = (v: string | undefined) => { const n = Number(String(v ?? '').replace(',', '.')); return v && Number.isFinite(n) ? n : undefined; };
const MES_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
/** Repasse de congregação no nosso plano de contas. */
const REPASSE = `(lc.plano_de_conta ilike '%REPASS%' or lc.plano_de_conta ilike '%RETORN%')`;
const DIZIMO = `lc.plano_de_conta ilike '%DIZIM%'`;
const RECEITA = `case when lc.tipo = 'RECEITA' then lc.valor else 0 end`;
const DESPESA = `case when lc.tipo = 'DESPESA' then lc.valor else 0 end`;
const CONTA = `coalesce(b.nome, nullif(lc.conta_caixa,''), 'Sem conta')`;
const FROM_LC = `from livro_caixa lc join churches c on c.id = lc.church_id join regionais r on r.id = c.regional_id
  left join regionais rg on rg.id = c.regional_id left join bancos b on b.id = lc.banco_id left join departamentos d on d.id = lc.departamento_id
  left join members m on m.id = lc.member_id`;

/** Filtros comuns de lançamento. `semPeriodo` deixa o período de fora (extrato/resumo calculam saldo anterior). */
function ondeLanc(s: Sql, campoId: string, f: Filtros, semPeriodo = false): string[] {
  const onde = [`r.campo_id = ${s.p(campoId)}::uuid`, 'lc.deleted_at is null', 'c.deleted_at is null'];
  if (!semPeriodo) onde.push(...periodo(s, 'lc.data_lancamento', f));
  if (uuid(f.igreja)) onde.push(`lc.church_id = ${s.p(f.igreja)}::uuid`);
  if (uuid(f.regional)) onde.push(`c.regional_id = ${s.p(f.regional)}::uuid`);
  if (f.zona?.trim()) onde.push(`c.zone = ${s.p(f.zona.trim())}`);
  if (uuid(f.banco)) onde.push(`lc.banco_id = ${s.p(f.banco)}::uuid`);
  if (f.forma?.trim()) onde.push(`lc.forma_pg = ${s.p(f.forma.trim())}`);
  if (uuid(f.departamento)) onde.push(`lc.departamento_id = ${s.p(f.departamento)}::uuid`);
  if (f.grupoContas === '01' || f.grupoContas === '02') onde.push(`lc.plano_de_conta like ${s.p(`${f.grupoContas}.%`)}`);
  if (f.plano?.trim()) onde.push(`lc.plano_de_conta = ${s.p(f.plano.trim())}`);
  if (f.tipo === 'RECEITA' || f.tipo === 'DESPESA') onde.push(`lc.tipo = ${s.p(f.tipo)}`);
  return onde;
}

const COLS_LANC = `lc.data_lancamento as data, lc.num_lancamento as "numLancamento", lc.num_doc as "numDoc", lc.plano_de_conta as plano,
  coalesce(nullif(lc.referencia,''), lc.obs) as historico, coalesce(m.full_name, lc.favorecido) as favorecido, ${CONTA} as conta,
  d.nome as departamento, lc.forma_pg as forma, lc.tipo_documento as "tipoDocumento", lc.operador, ${IGREJA_TXT} as igreja,
  coalesce(rg.name,'') as regional, ${RECEITA} as receita, ${DESPESA} as despesa`;

// ─── 1, 4, 6, 12, 13 - listas de lançamentos ─────────────────────────────────
const ORDEM_LIVRO: Record<string, string> = {
  lancamento: 'igreja, conta, lc.num_lancamento, lc.data_lancamento', data: 'igreja, conta, lc.data_lancamento, lc.num_lancamento', documento: 'igreja, conta, lc.num_doc, lc.data_lancamento',
};
const livro: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = ondeLanc(s, campoId, f);
  const li = int(f.lancInicial, 0, 1e9), lf = int(f.lancFinal, 0, 1e9);
  if (li != null) onde.push(`lc.num_lancamento ~ '^[0-9]+$' and lc.num_lancamento::bigint >= ${s.p(li)}`);
  if (lf != null) onde.push(`lc.num_lancamento ~ '^[0-9]+$' and lc.num_lancamento::bigint <= ${s.p(lf)}`);
  return consultar(`select ${COLS_LANC} ${FROM_LC} where ${onde.join(' and ')} order by ${ORDEM_LIVRO[f.ordem ?? ''] ?? ORDEM_LIVRO.lancamento}`, s.params);
};
const balanceteAnalitico: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = ondeLanc(s, campoId, f);
  if (f.favorecido?.trim()) onde.push(`coalesce(m.full_name, lc.favorecido) ilike ${s.p(`%${f.favorecido.trim()}%`)}`);
  return consultar(`select ${COLS_LANC} ${FROM_LC} where ${onde.join(' and ')} order by lc.plano_de_conta, lc.data_lancamento, lc.num_lancamento`, s.params);
};
const balanceteSintetico: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = ondeLanc(s, campoId, f);
  const ig = f.agrupar === '1' ? IGREJA_TXT : "'Todas as igrejas'";
  return consultar(`select ${ig} as igreja, lc.plano_de_conta as plano, count(*)::int as qtde, sum(${RECEITA}) as receita, sum(${DESPESA}) as despesa
    ${FROM_LC} where ${onde.join(' and ')} group by 1, 2 order by 1, 2`, s.params);
};
const diario: Executor = async (rel, campoId, f) => {
  const s = new Sql();
  const onde = ondeLanc(s, campoId, f);
  if (f.usuario?.trim()) onde.push(`lc.operador ilike ${s.p(`%${f.usuario.trim()}%`)}`);
  const ig = f.agrupar === '1' ? IGREJA_TXT : "'Todas as igrejas'";
  if (rel === 'analitico') return consultar(`select ${COLS_LANC} ${FROM_LC} where ${onde.join(' and ')} order by igreja, lc.data_lancamento, lc.num_lancamento`, s.params);
  if (rel === 'diario') return consultar(`select ${ig} as igreja, lc.data_lancamento as data, lc.plano_de_conta as plano, count(*)::int as qtde, sum(${RECEITA}) as receita, sum(${DESPESA}) as despesa
    ${FROM_LC} where ${onde.join(' and ')} group by 1, 2, 3 order by 1, 2, 3`, s.params);
  const ls = await consultar(`select ${ig} as igreja, lc.data_lancamento as data, count(*)::int as qtde, sum(${RECEITA}) as receita, sum(${DESPESA}) as despesa
    ${FROM_LC} where ${onde.join(' and ')} group by 1, 2 order by 1, 2`, s.params);
  ls.forEach((l) => { l.saldoDia = Number(l.receita) - Number(l.despesa); });
  return ls;
};
const ORDEM_CONSULTA: Record<string, string> = { documento: 'lc.num_doc, lc.data_lancamento', lancamento: 'lc.num_lancamento, lc.data_lancamento', data: 'lc.data_lancamento, lc.num_lancamento', forma: 'lc.forma_pg, lc.data_lancamento' };
const consulta: Executor = async (rel, campoId, f) => {
  const s = new Sql();
  const onde = ondeLanc(s, campoId, f);
  if (rel.startsWith('pix')) onde.push(`lc.forma_pg ilike '%pix%'`);
  if (['MEMBRO', 'IGREJA', 'PF', 'PJ'].includes(f.tipoPessoa ?? '')) onde.push(`lc.tipo_pessoa = ${s.p(f.tipoPessoa)}`);
  if (f.pessoa?.trim()) onde.push(`coalesce(m.full_name, lc.favorecido) ilike ${s.p(`%${f.pessoa.trim()}%`)}`);
  if (f.tipoDocumento?.trim()) onde.push(`lc.tipo_documento ilike ${s.p(`%${f.tipoDocumento.trim()}%`)}`);
  if (f.numDoc?.trim()) onde.push(`lc.num_doc = ${s.p(f.numDoc.trim())}`);
  if (f.numLancamento?.trim()) onde.push(`lc.num_lancamento = ${s.p(f.numLancamento.trim())}`);
  const vi = num(f.valorInicial), vf = num(f.valorFinal);
  if (vi != null) onde.push(`lc.valor >= ${s.p(vi)}`);
  if (vf != null) onde.push(`lc.valor <= ${s.p(vf)}`);
  return consultar(`select ${COLS_LANC} ${FROM_LC} where ${onde.join(' and ')} order by ${ORDEM_CONSULTA[f.ordem ?? ''] ?? ORDEM_CONSULTA.documento}`, s.params);
};
const conciliacao: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = [...ondeLanc(s, campoId, f), `lc.tipo = 'RECEITA'`, `lc.forma_pg ilike '%pix%'`];
  return consultar(`select ${COLS_LANC} ${FROM_LC} where ${onde.join(' and ')} order by conta, lc.data_lancamento`, s.params);
};

// ─── 2 - Extrato e 11 - Resumo (com saldo anterior) ──────────────────────────
const extrato: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = ondeLanc(s, campoId, f, true);
  const [a, b] = limitesSql(s, f);
  const pIni = a ?? "'1900-01-01'::date", pFim = b ?? "'2999-12-31'::date";
  const ls = await consultar(`
    with base as (select ${COLS_LANC}, lc.id ${FROM_LC} where ${onde.join(' and ')} and lc.data_lancamento <= (${pFim}))
    select igreja || ' — ' || conta as conta, null::date as data, null as "numLancamento", null as plano, 'Saldo anterior' as historico,
      null::numeric as credito, null::numeric as debito, sum(receita - despesa) as saldo_ini, 0 as ord
      from base where data < (${pIni}) group by 1
    union all
    select igreja || ' — ' || conta, data, "numLancamento", plano, historico, receita, despesa, null, 1
      from base where data >= (${pIni})
    order by 1, ord, 2, 3`, s.params);
  let atual = ''; let saldo = 0;
  return ls.map((l) => {
    if (l.conta !== atual) { atual = String(l.conta); saldo = 0; }
    saldo += l.ord === 0 ? Number(l.saldo_ini ?? 0) : Number(l.credito ?? 0) - Number(l.debito ?? 0);
    return { conta: l.conta, data: l.data, numLancamento: l.numLancamento, plano: l.plano, historico: l.historico, credito: l.credito, debito: l.debito, saldo: Math.round(saldo * 100) / 100 };
  });
};
const resumo: Executor = async (rel, campoId, f) => {
  const s = new Sql();
  const onde = ondeLanc(s, campoId, f, true);
  const [a, b] = limitesSql(s, f);
  const pIni = a ?? "'1900-01-01'::date", pFim = b ?? "'2999-12-31'::date";
  const chave = rel === 'contas' ? `${IGREJA_TXT}, ${CONTA}` : IGREJA_TXT;
  const ls = await consultar(`select ${IGREJA_TXT} as igreja, ${rel === 'contas' ? CONTA : "''"} as conta,
      sum(case when lc.data_lancamento < (${pIni}) then ${RECEITA} - ${DESPESA} else 0 end) as "saldoAnterior",
      sum(case when lc.data_lancamento >= (${pIni}) then ${RECEITA} else 0 end) as receita,
      sum(case when lc.data_lancamento >= (${pIni}) then ${DESPESA} else 0 end) as despesa
    ${FROM_LC} where ${onde.join(' and ')} and lc.data_lancamento <= (${pFim}) group by ${chave} order by 1, 2`, s.params);
  ls.forEach((l) => { l.saldoAtual = Math.round((Number(l.saldoAnterior) + Number(l.receita) - Number(l.despesa)) * 100) / 100; });
  return ls;
};

// ─── 3 e 10 - Programação Financeira (contas a pagar) ────────────────────────
const FROM_CP = `from parcelas_contas_pagar p join contas_pagar cp on cp.id = p.conta_pagar_id join churches c on c.id = cp.church_id
  join regionais r on r.id = c.regional_id left join credores cr on cr.id = cp.credor_id left join plano_de_contas pc on pc.id = cp.plano_de_conta_id
  left join bancos b on b.id = cp.banco_id`;
function ondeCp(s: Sql, campoId: string, f: Filtros, semPeriodo = false) {
  const onde = [`r.campo_id = ${s.p(campoId)}::uuid`, 'cp.deleted_at is null', `p.status <> 'CANCELADA'`];
  if (!semPeriodo) onde.push(...periodo(s, 'p.data_vencimento', f));
  if (uuid(f.igreja)) onde.push(`cp.church_id = ${s.p(f.igreja)}::uuid`);
  if (uuid(f.regional)) onde.push(`c.regional_id = ${s.p(f.regional)}::uuid`);
  if (f.zona?.trim()) onde.push(`c.zone = ${s.p(f.zona.trim())}`);
  if (uuid(f.banco)) onde.push(`cp.banco_id = ${s.p(f.banco)}::uuid`);
  if (uuid(f.departamento)) onde.push(`cp.departamento_id = ${s.p(f.departamento)}::uuid`);
  if (f.plano?.trim()) onde.push(`pc.nome = ${s.p(f.plano.trim())}`);
  if (f.credor?.trim()) onde.push(`cr.nome ilike ${s.p(`%${f.credor.trim()}%`)}`);
  if (f.status) onde.push(`p.status = ${s.p(f.status)}`);
  return onde;
}
const programacao: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = ondeCp(s, campoId, f);
  const grupo = f.agruparConta === '1' ? `coalesce(b.nome, 'Sem conta')` : f.agrupar === '1' ? IGREJA_TXT : "'Todas as igrejas'";
  return consultar(`select ${grupo} as igreja, p.data_vencimento as vencimento, cp.numero, p.numero_parcela || '/' || p.total_parcelas as parcela, cp.descricao,
      cr.nome as credor, pc.nome as plano, p.valor_parcela as valor, p.valor_pago as pago, p.valor_saldo as saldo, p.status
    ${FROM_CP} where ${onde.join(' and ')} order by 1, p.data_vencimento, cp.numero`, s.params);
};
const programacaoAnual: Executor = async (rel, campoId, f) => {
  const s = new Sql();
  const onde = ondeCp(s, campoId, f, true);
  const ano = int(f.ano, 1900, 2100) ?? new Date().getFullYear();
  onde.push(`extract(year from p.data_vencimento) = ${s.p(ano)}`);
  const meses = MES_ABR.map((_, i) => `sum(case when extract(month from p.data_vencimento) = ${i + 1} then p.valor_parcela else 0 end) as m${i + 1}`).join(', ');
  const ig = rel === 'por_igreja' && f.agrupar !== '1' ? "'Todas as igrejas'" : IGREJA_TXT;
  return consultar(`select ${rel === 'resumido' ? IGREJA_TXT : ig} as igreja, ${rel === 'resumido' ? "''" : "coalesce(pc.nome, 'Sem plano')"} as plano, ${meses}, sum(p.valor_parcela) as total
    ${FROM_CP} where ${onde.join(' and ')} group by 1, 2 order by 1, 2`, s.params);
};

// ─── 7 e 17 - Repasses de congregação ────────────────────────────────────────
const repasse: Executor = async (rel, campoId, f) => {
  const s = new Sql();
  const onde = ondeLanc(s, campoId, { ...f, periodo: 'datas' }, true);
  const ano = int(f.ano, 1900, 2100) ?? new Date().getFullYear();
  onde.push(`extract(year from lc.data_lancamento) = ${s.p(ano)}`);
  const mes = int(f.mes, 1, 12);
  if (mes) onde.push(`extract(month from lc.data_lancamento) = ${s.p(mes)}`);
  if (uuid(f.sede)) onde.push(`coalesce(c.host_church_id, c.id) = ${s.p(f.sede)}::uuid`);
  const sede = `coalesce((select h.code || ' - ' || h.name from churches h where h.id = c.host_church_id), ${IGREJA_TXT})`;
  if (rel === 'geral') {
    const meses = MES_ABR.map((_, i) => `sum(case when extract(month from lc.data_lancamento) = ${i + 1} then lc.valor else 0 end) as m${i + 1}`).join(', ');
    return consultar(`select coalesce(rg.name,'') as regional, ${IGREJA_TXT} as igreja, ${meses}, sum(lc.valor) as total
      ${FROM_LC} where ${onde.join(' and ')} and ${REPASSE} group by 1, 2 order by 1, 2`, s.params);
  }
  return consultar(`select ${sede} as sede, ${IGREJA_TXT} as igreja, sum(${RECEITA}) as receita, sum(${DESPESA}) as despesa,
      sum(${RECEITA}) - sum(${DESPESA}) as saldo, sum(case when ${REPASSE} then lc.valor else 0 end) as repassado
    ${FROM_LC} where ${onde.join(' and ')} group by 1, 2 order by 1, 2`, s.params);
};
const extratoRepasses: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = [...ondeLanc(s, campoId, f), REPASSE];
  return consultar(`select ${COLS_LANC} ${FROM_LC} where ${onde.join(' and ')} order by igreja, lc.data_lancamento`, s.params);
};

// ─── 8 - Comparativo, 20 - Ranking, 21 - Trimestral, 9 - Resultado Anual ─────
const ORDEM_COMP: Record<string, string> = { codigo: 'regional, c.code', nome: 'regional, c.name', receita_asc: 'regional, receita', receita_desc: 'regional, receita desc', despesa_asc: 'regional, despesa', despesa_desc: 'regional, despesa desc' };
const comparativo: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = ondeLanc(s, campoId, f);
  const rgCol = f.agrupar === '1' ? `coalesce(rg.name,'')` : "'Todas as regionais'";
  const somas = `select lc.church_id, sum(${RECEITA}) as receita, sum(${DESPESA}) as despesa ${FROM_LC} where ${onde.join(' and ')} group by lc.church_id`;
  const ondeIg = [`r.campo_id = ${s.p(campoId)}::uuid`, 'c.deleted_at is null'];
  if (uuid(f.igreja)) ondeIg.push(`c.id = ${s.p(f.igreja)}::uuid`);
  if (uuid(f.regional)) ondeIg.push(`c.regional_id = ${s.p(f.regional)}::uuid`);
  if (f.zona?.trim()) ondeIg.push(`c.zone = ${s.p(f.zona.trim())}`);
  if (f.semLancamento === '1') ondeIg.push('x.church_id is not null');
  const ls = await consultar(`select ${rgCol} as regional, ${IGREJA_TXT} as igreja, c.code, c.name, coalesce(x.receita, 0) as receita, coalesce(x.despesa, 0) as despesa
    from churches c join regionais r on r.id = c.regional_id left join regionais rg on rg.id = c.regional_id left join (${somas}) x on x.church_id = c.id
    where ${ondeIg.join(' and ')} order by ${ORDEM_COMP[f.ordem ?? ''] ?? ORDEM_COMP.codigo}`, s.params);
  ls.forEach((l) => { l.saldo = Number(l.receita) - Number(l.despesa); l.percentual = Number(l.receita) ? Math.round((Number(l.despesa) / Number(l.receita)) * 10000) / 100 : null; });
  return ls;
};
const ranking: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = ondeLanc(s, campoId, { ...f, tipo: f.tipo === 'DESPESA' ? 'DESPESA' : 'RECEITA' });
  const ls = await consultar(`select ${IGREJA_TXT} as igreja, sum(lc.valor) as valor ${FROM_LC} where ${onde.join(' and ')} group by 1 order by 2 desc`, s.params);
  const total = ls.reduce((t, l) => t + Number(l.valor), 0);
  const out = f.top10 === '1' ? ls.slice(0, 10) : ls;
  out.forEach((l, i) => { l.posicao = i + 1; l.percentual = total ? Math.round((Number(l.valor) / total) * 10000) / 100 : 0; });
  return out;
};
const trimestral: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const mes = int(f.mes, 1, 12) ?? new Date().getMonth() + 1;
  const ano = int(f.ano, 1900, 2100) ?? new Date().getFullYear();
  const fimMes = new Date(ano, mes, 0); const iniMes = new Date(ano, mes - 3, 1);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const onde = ondeLanc(s, campoId, { ...f, periodo: 'datas', dataInicial: iso(iniMes), dataFinal: iso(fimMes) });
  const ms = [0, 1, 2].map((k) => new Date(ano, mes - 3 + k, 1));
  const cols = ms.map((d, k) => `sum(case when date_trunc('month', lc.data_lancamento) = ${s.p(iso(d))}::date then lc.valor else 0 end) as m${k + 1}`).join(', ');
  const rot = ms.map((d) => `${MES_ABR[d.getMonth()]}/${d.getFullYear()}`).join(' · ');
  const ls = await consultar(`select lc.tipo || ' (' || ${s.p(rot)} || ')' as "tipoConta", ${IGREJA_TXT} as igreja, ${cols}, sum(lc.valor) as total
    ${FROM_LC} where ${onde.join(' and ')} group by 1, 2 order by 1 desc, 2`, s.params);
  return ls;
};
const resultadoAnual: Executor = async (rel, campoId, f) => {
  const s = new Sql();
  const onde = ondeLanc(s, campoId, { ...f, periodo: 'datas' }, true);
  const ano = int(f.ano, 1900, 2100) ?? new Date().getFullYear();
  onde.push(`extract(year from lc.data_lancamento) = ${s.p(ano)}`);
  const sinal = `case when lc.tipo = 'DESPESA' then -lc.valor else lc.valor end`;
  const meses = MES_ABR.map((_, i) => `sum(case when extract(month from lc.data_lancamento) = ${i + 1} then ${sinal} else 0 end) as m${i + 1}`).join(', ');
  const ig = f.agrupar === '1' || rel === 'por_conta' ? IGREJA_TXT : "'Todas as igrejas'";
  if (rel === 'resumido') return consultar(`select ${ig} as igreja, lc.tipo as "tipoConta", ${meses}, sum(${sinal}) as total ${FROM_LC} where ${onde.join(' and ')} group by 1, 2 order by 1, 2 desc`, s.params);
  return consultar(`select ${ig} as igreja, lc.plano_de_conta as plano, ${meses}, sum(${sinal}) as total ${FROM_LC} where ${onde.join(' and ')} group by 1, 2 order by ${rel === 'por_conta' ? '2, 1' : '1, 2'}`, s.params);
};

// ─── 14, 15, 16 - Dizimistas e contribuintes ─────────────────────────────────
const ORDEM_DIZ: Record<string, string> = { igreja_rol: 'igreja, matricula nulls last', igreja_nome: 'igreja, nome', igreja_titulo_rol: 'igreja, nivel desc, matricula nulls last', igreja_titulo_nome: 'igreja, nivel desc, nome' };
function ondeMembroFin(s: Sql, campoId: string, f: Filtros) {
  const onde = [`r.campo_id = ${s.p(campoId)}::uuid`, 'm.deleted_at is null'];
  if (uuid(f.igreja)) onde.push(`m.church_id = ${s.p(f.igreja)}::uuid`);
  if (uuid(f.regional)) onde.push(`c.regional_id = ${s.p(f.regional)}::uuid`);
  if (f.zona?.trim()) onde.push(`c.zone = ${s.p(f.zona.trim())}`);
  if (uuid(f.cargo)) onde.push(`m.ecclesiastical_title_id = ${s.p(f.cargo)}::uuid`);
  if (uuid(f.funcao)) onde.push(`exists (select 1 from church_function_history fh where fh.member_id = m.id and fh.function_id = ${s.p(f.funcao)}::uuid and fh.is_active and fh.deleted_at is null)`);
  if (f.obreiros === 'sim') onde.push('coalesce(et.level,0) >= 1');
  if (f.obreiros === 'nao') onde.push('coalesce(et.level,0) < 1');
  if (f.situacao === 'ativos') onde.push(`m.membership_status = 'ATIVO'`);
  if (f.situacao === 'inativos') onde.push(`coalesce(m.membership_status,'') <> 'ATIVO'`);
  return onde;
}
const PESSOA_FIN = `m.rol as matricula, m.full_name as nome, ${CARGO_TXT} as cargo, coalesce(et.level,0) as nivel, coalesce(nullif(m.mobile,''), nullif(m.phone,'')) as telefone`;
const dizimistas: Executor = async (rel, campoId, f) => {
  const s = new Sql();
  const onde = ondeMembroFin(s, campoId, f);
  const igrejaPessoa = rel.endsWith('_pessoa');
  const igCol = f.agrupar === '1' || rel === 'funcao' ? (igrejaPessoa ? IGREJA_TXT : `(select x.code || ' - ' || x.name from churches x where x.id = lc.church_id)`) : "'Todas as igrejas'";
  const lcOnde = [`lc.deleted_at is null`, `lc.member_id = m.id`, `lc.tipo = 'RECEITA'`, DIZIMO];
  let sql: string;
  if (rel.startsWith('anual')) {
    const ano = int(f.ano, 1900, 2100) ?? new Date().getFullYear();
    lcOnde.push(`extract(year from lc.data_lancamento) = ${s.p(ano)}`);
    const meses = MES_ABR.map((_, i) => `sum(case when extract(month from lc.data_lancamento) = ${i + 1} then lc.valor else 0 end) as m${i + 1}`).join(', ');
    sql = `select ${igCol} as igreja, ${PESSOA_FIN}, ${meses}, sum(lc.valor) as total
      from members m join churches c on c.id = m.church_id join regionais r on r.id = c.regional_id ${JOIN_CARGO}
      join livro_caixa lc on ${lcOnde.join(' and ')}
      where ${onde.join(' and ')} group by 1, m.id, m.rol, m.full_name, et.name, m.ecclesiastical_title, et.level, m.mobile, m.phone`;
  } else {
    lcOnde.push(...periodo(s, 'lc.data_lancamento', f));
    sql = `select ${igCol} as igreja, ${PESSOA_FIN}, count(lc.id)::int as qtde, sum(lc.valor) as valor
      from members m join churches c on c.id = m.church_id join regionais r on r.id = c.regional_id ${JOIN_CARGO}
      join livro_caixa lc on ${lcOnde.join(' and ')}
      where ${onde.join(' and ')} group by 1, m.id, m.rol, m.full_name, et.name, m.ecclesiastical_title, et.level, m.mobile, m.phone`;
  }
  const ls = await consultar(`select * from (${sql}) x order by ${rel === 'funcao' ? 'nivel desc, cargo, nome' : ORDEM_DIZ[f.ordem ?? ''] ?? ORDEM_DIZ.igreja_rol}`, s.params);
  ls.forEach((l: Linha) => { if (f.mostrarValor !== '1') { l.valor = null; l.total = null; } if (f.mostrarTelefone !== '1') l.telefone = null; });
  return ls;
};
const naoDizimistas: Executor = async (rel, campoId, f) => {
  const s = new Sql();
  const onde = ondeMembroFin(s, campoId, f);
  const per = periodo(s, 'lc.data_lancamento', f);
  onde.push(`not exists (select 1 from livro_caixa lc where lc.member_id = m.id and lc.deleted_at is null and lc.tipo = 'RECEITA' and ${DIZIMO}${per.length ? ` and ${per.join(' and ')}` : ''})`);
  const igCol = f.agrupar === '1' ? IGREJA_TXT : "'Todas as igrejas'";
  return consultar(`select * from (select ${igCol} as igreja, ${PESSOA_FIN},
      (select max(lc.data_lancamento) from livro_caixa lc where lc.member_id = m.id and lc.deleted_at is null and lc.tipo = 'RECEITA' and ${DIZIMO}) as "ultimoDizimo"
    from members m join churches c on c.id = m.church_id join regionais r on r.id = c.regional_id ${JOIN_CARGO}
    where ${onde.join(' and ')}) x order by ${rel === 'por_titulo' ? 'nivel desc, cargo, nome' : ORDEM_DIZ[f.ordem ?? ''] ?? ORDEM_DIZ.igreja_rol}`, s.params);
};
const extratoContribuintes: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = [...ondeLanc(s, campoId, f), 'lc.member_id is not null', `lc.tipo = 'RECEITA'`];
  if (uuid(f.cargo)) onde.push(`m.ecclesiastical_title_id = ${s.p(f.cargo)}::uuid`);
  const rol = int(f.matricula, 0, 1e9);
  if (rol != null) onde.push(`m.rol = ${s.p(rol)}`);
  if (f.pessoa?.trim()) onde.push(`m.full_name ilike ${s.p(`%${f.pessoa.trim()}%`)}`);
  const ls = await consultar(`select coalesce(m.rol::text || ' - ', '') || m.full_name as pessoa, ${COLS_LANC}, lc.valor
    ${FROM_LC} where ${onde.join(' and ')} order by igreja, ${f.ordem === 'nome' ? 'm.full_name' : 'm.rol nulls last'}, lc.data_lancamento`, s.params);
  if (f.mostrarValor !== '1') ls.forEach((l) => { l.valor = null; });
  return ls;
};

// ─── 18 - Anuidades e 19 - Contagem de Ofertas ───────────────────────────────
const anuidades: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = [`a.campo_id = ${s.p(campoId)}::uuid`];
  const ano = int(f.ano, 1900, 2100);
  if (ano) onde.push(`a.ano_referencia = ${s.p(ano)}`);
  if (uuid(f.igreja)) onde.push(`m.church_id = ${s.p(f.igreja)}::uuid`);
  if (uuid(f.regional)) onde.push(`c.regional_id = ${s.p(f.regional)}::uuid`);
  if (uuid(f.cargo)) onde.push(`m.ecclesiastical_title_id = ${s.p(f.cargo)}::uuid`);
  const rol = int(f.matricula, 0, 1e9);
  if (rol != null) onde.push(`m.rol = ${s.p(rol)}`);
  if (f.pessoa?.trim()) onde.push(`coalesce(m.full_name, a.nome) ilike ${s.p(`%${f.pessoa.trim()}%`)}`);
  return consultar(`select coalesce(${IGREJA_TXT}, a.igreja, 'Sem igreja') as igreja, m.rol as matricula, a.matricula as "matriculaConamad", coalesce(m.full_name, a.nome) as nome,
      coalesce(et.name, a.titulo) as cargo, a.ano_referencia as ano, a.valor, a.situacao
    from conamad_anuidades a left join conamad_ministros cm on cm.id = a.ministro_id left join members m on m.id = cm.member_id
    left join churches c on c.id = m.church_id ${JOIN_CARGO}
    where ${onde.join(' and ')} order by igreja, nome, a.ano_referencia`, s.params);
};
const contagemOfertas: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = [`cr.campo_id = ${s.p(campoId)}::uuid`, 'cr.deleted_at is null', ...periodo(s, 'cr.data_culto', f)];
  if (uuid(f.igreja)) onde.push(`cr.church_id = ${s.p(f.igreja)}::uuid`);
  if (f.tipoCulto?.trim()) onde.push(`coalesce(tc.nome, cr.tipo_culto) ilike ${s.p(`%${f.tipoCulto.trim()}%`)}`);
  const ls = await consultar(`select ${IGREJA_TXT} as igreja, cr.data_culto as data, coalesce(tc.nome, cr.tipo_culto) as culto,
      sum(coalesce(cl.qtd_dizimos,0))::int as "qtdeDizimos", sum(coalesce(cl.total_dizimos,0)) as dizimos,
      sum(coalesce(cl.qtd_ofertas,0))::int as "qtdeOfertas", sum(coalesce(cl.total_ofertas,0)) as ofertas
    from culto_registros cr join churches c on c.id = cr.church_id join culto_lancamentos cl on cl.registro_id = cr.id
    left join tipo_culto tc on tc.codigo = cr.tipo_culto and tc.campo_id = cr.campo_id and tc.deleted_at is null
    where ${onde.join(' and ')} group by 1, 2, 3 order by 1, 2`, s.params);
  ls.forEach((l) => { l.total = Number(l.dizimos) + Number(l.ofertas); });
  return ls;
};

export const EXECUTORES_TESOURARIA: Record<string, Executor> = {
  'tesouraria.livro': livro,
  'tesouraria.extrato': extrato,
  'tesouraria.programacao': programacao,
  'tesouraria.balancete_analitico': balanceteAnalitico,
  'tesouraria.balancete_sintetico': balanceteSintetico,
  'tesouraria.diario': diario,
  'tesouraria.repasse': repasse,
  'tesouraria.comparativo': comparativo,
  'tesouraria.resultado_anual': resultadoAnual,
  'tesouraria.programacao_anual': programacaoAnual,
  'tesouraria.resumo': resumo,
  'tesouraria.consulta': consulta,
  'tesouraria.conciliacao': conciliacao,
  'tesouraria.dizimistas': dizimistas,
  'tesouraria.nao_dizimistas': naoDizimistas,
  'tesouraria.extrato_contribuintes': extratoContribuintes,
  'tesouraria.extrato_repasses': extratoRepasses,
  'tesouraria.anuidades': anuidades,
  'tesouraria.contagem_ofertas': contagemOfertas,
  'tesouraria.ranking': ranking,
  'tesouraria.trimestral': trimestral,
};
