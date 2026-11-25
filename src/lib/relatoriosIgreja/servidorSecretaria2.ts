import { CARGO_TXT, consultar, HOJE, IGREJA_TXT, JOIN_CARGO, JOIN_PESSOA, ondePessoa, Sql, uuid, type Executor, type Filtros } from './base';

/** Relatórios de Secretaria: cultos, agenda pastoral, etiquetas, funções, documentos, transferências e usuários. */

const data = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const int = (v: string | undefined, min: number, max: number) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : undefined; };
const ENDERECO = `concat_ws(', ', nullif(m.address_street,''), nullif(m.address_number,''), nullif(m.address_complement,''))`;
const FONE = `coalesce(nullif(m.mobile,''), nullif(m.phone,''))`;

export function periodo(s: Sql, col: string, f: Filtros): string[] {
  const [a, b] = limitesSql(s, f);
  const out: string[] = [];
  if (a) out.push(`${col} >= ${a}`);
  if (b) out.push(`${col} < (${b}) + 1`);
  return out;
}

/** Início e fim (inclusive) do período, como expressões SQL de data em Brasília; null = sem limite. */
export function limitesSql(s: Sql, f: Filtros): [string | null, string | null] {
  const semana = `date_trunc('week', ${HOJE})::date`, mes = `date_trunc('month', ${HOJE})::date`;
  switch (f.periodo) {
    case 'hoje': return [HOJE, HOJE];
    case 'ontem': return [`${HOJE} - 1`, `${HOJE} - 1`];
    case 'semana': return [semana, `${semana} + 6`];
    case 'semana_anterior': return [`${semana} - 7`, `${semana} - 1`];
    case 'mes': return [mes, `(${mes} + interval '1 month')::date - 1`];
    case 'mes_anterior': return [`(${mes} - interval '1 month')::date`, `${mes} - 1`];
    default: {
      const di = data(f.dataInicial), df = data(f.dataFinal);
      return [di ? `${s.p(di)}::date` : null, df ? `${s.p(df)}::date` : null];
    }
  }
}

// ─── 2 - Agendamentos do Culto ───────────────────────────────────────────────
const agendamentosCulto: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = [`cr.campo_id = ${s.p(campoId)}::uuid`, 'cr.deleted_at is null', ...periodo(s, 'cr.data_culto', f)];
  if (uuid(f.igreja)) onde.push(`cr.church_id = ${s.p(f.igreja)}::uuid`);
  if (uuid(f.regional)) onde.push(`cr.regional_id = ${s.p(f.regional)}::uuid`);
  return consultar(`
    select ${IGREJA_TXT} as igreja, cr.data_culto as data,
      concat_ws(' às ', to_char(cr.hora_inicio, 'HH24:MI'), to_char(cr.hora_fim, 'HH24:MI')) as horario,
      coalesce(tc.nome, cr.tipo_culto) as "tipoCulto", cr.status, cr.observacao
    from culto_registros cr join churches c on c.id = cr.church_id
    left join tipo_culto tc on tc.codigo = cr.tipo_culto and tc.campo_id = cr.campo_id and tc.deleted_at is null
    where ${onde.join(' and ')} order by igreja, cr.data_culto, cr.hora_inicio`, s.params);
};

// ─── 3 - Agenda Pastoral (atendimentos pastorais) ────────────────────────────
const STATUS_AT: Record<string, string> = { open: 'Aberto', doing: 'Em andamento', done: 'Concluído', cancelled: 'Cancelado' };
const TIPO_AT: Record<string, string> = { followup: 'Acompanhamento', quero_ser_membro: 'Quero ser membro', apresentacao_criancas: 'Apresentação de crianças', discipulado: 'Discipulado' };
const agendaPastoral: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const quando = 'coalesce(a.sla_date, a.started_at, a.created_at)';
  const onde = [`r.campo_id = ${s.p(campoId)}::uuid`, 'a.deleted_at is null', ...periodo(s, quando, f)];
  if (uuid(f.igreja)) onde.push(`a.church_id = ${s.p(f.igreja)}::uuid`);
  const like = (col: string, v?: string) => { if (v?.trim()) onde.push(`${col} ilike ${s.p(`%${v.trim()}%`)}`); };
  like('u.full_name', f.atendente); like('coalesce(m.full_name, a.visitor_name)', f.atendido); like('a.title', f.motivo); like('a.attendance_type', f.tipo);
  if (f.status?.trim()) { const k = Object.entries(STATUS_AT).find(([, v]) => v.toLowerCase().startsWith(f.status.trim().toLowerCase()))?.[0]; onde.push(`a.status = ${s.p(k ?? f.status.trim())}`); }
  const ls = await consultar(`
    select coalesce(u.full_name, 'Sem atendente') as atendente, to_char(${quando} at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as data,
      coalesce(m.full_name, a.visitor_name) as pessoa, ${IGREJA_TXT} as igreja, a.title as motivo, a.status, a.attendance_type as tipo, null as local
    from pastoral_attendances a join churches c on c.id = a.church_id join regionais r on r.id = c.regional_id
    left join members m on m.id = a.member_id left join users u on u.id = a.responsible_user_id
    where ${onde.join(' and ')} order by atendente, ${quando}`, s.params);
  ls.forEach((l) => { l.status = STATUS_AT[String(l.status)] ?? l.status; l.tipo = TIPO_AT[String(l.tipo)] ?? l.tipo; });
  return ls;
};

// ─── 8 - Mala Direta - Etiquetas ─────────────────────────────────────────────
const malaDireta: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = ondePessoa(s, campoId, f);
  const rols = (f.matriculas ?? '').split(',').map((x) => x.trim()).filter((x) => /^\d+$/.test(x)).map(Number).slice(0, 2000);
  if (rols.length) onde.push(`m.rol = any(${s.p(rols)}::int[])`);
  if (uuid(f.cargo)) onde.push(`m.ecclesiastical_title_id = ${s.p(f.cargo)}::uuid`);
  if (f.obreiros === 'sim') onde.push('coalesce(et.level,0) >= 1');
  if (f.obreiros === 'nao') onde.push('coalesce(et.level,0) < 1');
  for (const [k, col] of [['bairro', 'address_neighborhood'], ['cidade', 'address_city'], ['estado', 'address_state']] as const) {
    if (f[k]?.trim()) onde.push(`m.${col} ilike ${s.p(`%${f[k].trim()}%`)}`);
  }
  return consultar(`
    select m.rol as matricula, m.full_name as nome, ${ENDERECO} as endereco,
      concat_ws(' - ', nullif(m.address_neighborhood,''), nullif(concat_ws('/', nullif(m.address_city,''), nullif(m.address_state,'')),'')) as "bairroCidade",
      m.address_zipcode as cep, ${IGREJA_TXT} as igreja
    from members m ${JOIN_PESSOA} ${JOIN_CARGO} where ${onde.join(' and ')}
    order by ${f.ordem === 'nome' ? 'm.full_name' : 'm.rol nulls last, m.full_name'}`, s.params);
};

// ─── 10 - Agendamento de Ocorrência (requerimentos em andamento) ─────────────
const agendamentoOcorrencia: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = [`r.campo_id = ${s.p(campoId)}::uuid`, 'k.deleted_at is null', `k.status not in ('concluido','finalizado','cancelado','reprovado','admissão_cancelada','batizado','consagrado')`, ...periodo(s, 'k.opened_at', f)];
  if (uuid(f.igreja)) onde.push(`k.church_id = ${s.p(f.igreja)}::uuid`);
  if (uuid(f.regional)) onde.push(`c.regional_id = ${s.p(f.regional)}::uuid`);
  if (f.zona?.trim()) onde.push(`c.zone = ${s.p(f.zona.trim())}`);
  const sv = int(f.servico, 1, 1_000_000);
  if (sv) onde.push(`k.service_id = ${s.p(sv)}`);
  if (f.sexo) onde.push(`m.gender = ${s.p(f.sexo)}`);
  return consultar(`
    select coalesce(ks.description, ks.servico, ks.sigla) as ocorrencia, coalesce(ks.description, ks.servico, ks.sigla) || ' — ' || ${IGREJA_TXT} as "ocorrenciaIgreja",
      k.protocol as protocolo, m.rol as matricula, coalesce(m.full_name, k.candidate_name) as nome, k.intended_title as "tituloPretendido",
      k.opened_at::date as abertura, coalesce(k.status_label, k.status) as status, ${IGREJA_TXT} as igreja
    from kan_cards k join kan_services ks on ks.id = k.service_id join churches c on c.id = k.church_id join regionais r on r.id = c.regional_id
    left join members m on m.id = k.member_id
    where ${onde.join(' and ')} order by ocorrencia, igreja, nome`, s.params);
};

// ─── 12 - Funções Ocupacionais (e Contatos / E-mail das igrejas) ─────────────
export async function funcoesAtivas(s: Sql, campoId: string, f: Filtros, extra: string[] = []) {
  const onde = [`r.campo_id = ${s.p(campoId)}::uuid`, 'fh.deleted_at is null', 'm.deleted_at is null', ...extra];
  if (f.situacaoFuncao === 'ativo') onde.push('fh.is_active and (fh.end_date is null or fh.end_date >= current_date)');
  if (f.situacaoFuncao === 'inativo') onde.push('not (fh.is_active and (fh.end_date is null or fh.end_date >= current_date))');
  if (uuid(f.igreja)) onde.push(`fh.church_id = ${s.p(f.igreja)}::uuid`);
  if (uuid(f.regional)) onde.push(`c.regional_id = ${s.p(f.regional)}::uuid`);
  if (f.zona?.trim()) onde.push(`c.zone = ${s.p(f.zona.trim())}`);
  if (uuid(f.cargo)) onde.push(`m.ecclesiastical_title_id = ${s.p(f.cargo)}::uuid`);
  if (uuid(f.funcao)) onde.push(`fh.function_id = ${s.p(f.funcao)}::uuid`);
  if (f.pessoa?.trim()) onde.push(`m.full_name ilike ${s.p(`%${f.pessoa.trim()}%`)}`);
  for (const [k, op, col] of [['inicioDe', '>=', 'start_date'], ['inicioAte', '<=', 'start_date'], ['fimDe', '>=', 'end_date'], ['fimAte', '<=', 'end_date']] as const) {
    const d = data(f[k]); if (d) onde.push(`fh.${col} ${op} ${s.p(d)}::date`);
  }
  return consultar(`
    select m.rol as matricula, m.full_name as nome, coalesce(m.rol::text || ' - ', '') || m.full_name as pessoa, ${CARGO_TXT} as cargo,
      coalesce(fc.name, 'Função') as funcao, fh.start_date as inicio, fh.end_date as fim,
      case when fh.is_active and (fh.end_date is null or fh.end_date >= current_date) then 'Ativo' else 'Inativo' end as "situacaoFuncao",
      ${FONE} as telefone, m.email, m.birth_date as nascimento, ${ENDERECO} as endereco,
      ${IGREJA_TXT} as igreja, ${IGREJA_TXT} as "igrejaCompleta", coalesce(rg.name,'') as regional, coalesce(rg.name,'') || ' — ' || ${IGREJA_TXT} as "regionalIgreja",
      coalesce(sp.full_name, m.spouse_name) as conjuge, '' as assinatura
    from church_function_history fh join members m on m.id = fh.member_id
    join churches c on c.id = fh.church_id join regionais r on r.id = c.regional_id left join regionais rg on rg.id = c.regional_id
    left join church_function_catalog fc on fc.id = fh.function_id ${JOIN_CARGO} left join members sp on sp.id = m.spouse_id
    where ${onde.join(' and ')} order by regional, igreja, funcao, m.full_name`, s.params);
}
const funcoes: Executor = async (rel, campoId, f) => {
  const s = new Sql();
  const ls = await funcoesAtivas(s, campoId, f, rel === 'casais' ? ['m.spouse_id is not null'] : []);
  if (rel === 'por_pessoa') ls.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  if (rel === 'ficha_funcao' || rel === 'protocolo') ls.sort((a, b) => String(a.funcao).localeCompare(String(b.funcao), 'pt-BR') || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  return ls;
};

// ─── 14 - Consulta Emissão de Documentos (credenciais) ───────────────────────
const ORDEM_DOC: Record<string, string> = { igreja_matricula: 'igreja, m.rol nulls last', igreja_nome: 'igreja, nome', igreja_emissao: 'igreja, emissao', igreja_validade: 'igreja, validade' };
const emissaoDocumentos: Executor = async (_rel, campoId, f) => {
  const s = new Sql();
  const onde = [`r.campo_id = ${s.p(campoId)}::uuid`, 'm.deleted_at is null'];
  if (uuid(f.igreja)) onde.push(`m.church_id = ${s.p(f.igreja)}::uuid`);
  if (uuid(f.regional)) onde.push(`c.regional_id = ${s.p(f.regional)}::uuid`);
  const rol = int(f.matricula, 0, 10_000_000);
  if (rol != null) onde.push(`m.rol = ${s.p(rol)}`);
  if (uuid(f.cargo)) onde.push(`m.ecclesiastical_title_id = ${s.p(f.cargo)}::uuid`);
  if (f.pessoa?.trim()) onde.push(`m.full_name ilike ${s.p(`%${f.pessoa.trim()}%`)}`);
  for (const [k, op, col] of [['emissaoInicial', '>=', 'dataemissao'], ['emissaoFinal', '<=', 'dataemissao'], ['validadeInicial', '>=', 'datavalidade'], ['validadeFinal', '<=', 'datavalidade']] as const) {
    const d = data(f[k]); if (d) onde.push(`t.${col} ${op} ${s.p(d)}::date`);
  }
  return consultar(`
    select ${IGREJA_TXT} as igreja, m.rol as matricula, m.full_name as nome, ${CARGO_TXT} as cargo, coalesce(nullif(t.tipo,''), 'Credencial') as documento,
      t.numero, t.via, t.dataemissao as emissao, t.datavalidade as validade, t.situacao
    from tbcredencial t join members m on m.id::text = t.member_id ${JOIN_PESSOA} ${JOIN_CARGO}
    where ${onde.join(' and ')} order by ${ORDEM_DOC[f.ordem ?? ''] ?? ORDEM_DOC.igreja_matricula}`, s.params);
};

// ─── 17 e 18 - Transferências / Recebimentos pendentes ───────────────────────
const transferencias = (lado: 'origem' | 'destino'): Executor => async (_rel, campoId, f) => {
  const s = new Sql();
  const igLado = lado === 'origem' ? 'k.church_id' : 'k.destination_church_id';
  const onde = [`(ro.campo_id = ${s.p(campoId)}::uuid or rd.campo_id = ${s.p(campoId)}::uuid)`, 'k.deleted_at is null', 'k.destination_church_id is not null', `k.status = 'pendente'`];
  if (uuid(f.igreja)) onde.push(`${igLado} = ${s.p(f.igreja)}::uuid`);
  if (uuid(f.regional)) onde.push(`${lado === 'origem' ? 'co' : 'cd'}.regional_id = ${s.p(f.regional)}::uuid`);
  if (f.zona?.trim()) onde.push(`${lado === 'origem' ? 'co' : 'cd'}.zone = ${s.p(f.zona.trim())}`);
  return consultar(`
    select k.protocol as protocolo, m.rol as matricula, coalesce(m.full_name, k.candidate_name) as nome, ${CARGO_TXT} as cargo,
      co.code || ' - ' || co.name as origem, cd.code || ' - ' || cd.name as destino, k.opened_at::date as abertura
    from kan_cards k join churches co on co.id = k.church_id join regionais ro on ro.id = co.regional_id
    join churches cd on cd.id = k.destination_church_id join regionais rd on rd.id = cd.regional_id
    left join members m on m.id = k.member_id ${JOIN_CARGO}
    where ${onde.join(' and ')} order by ${lado}, k.opened_at`, s.params);
};

// ─── 19 - Usuários do Sistema ────────────────────────────────────────────────
const PERFIL: Record<string, string> = { master: 'Master', admin: 'Administrador', campo: 'Campo', igreja: 'Igreja' };
const usuarios: Executor = async (rel, campoId, f) => {
  const s = new Sql();
  const onde = [`u.campo_id = ${s.p(campoId)}::uuid`, 'u.deleted_at is null'];
  if (uuid(f.igreja)) onde.push(`u.church_id = ${s.p(f.igreja)}::uuid`);
  const mes = int(f.mes, 1, 12);
  const acesso = 'coalesce(u.last_login_at, u.last_active_at)';
  if (rel === 'log') { onde.push(`${acesso} is not null`); if (mes) onde.push(`extract(month from ${acesso}) = ${s.p(mes)} and extract(year from ${acesso}) = extract(year from current_date)`); }
  const ls = await consultar(`
    select coalesce(c.code || ' - ' || c.name, 'Sem igreja') as igreja, u.full_name as nome, u.email, u.profile_type as perfil, ro.name as funcao,
      case when u.is_active then 'Sim' else 'Não' end as ativo, to_char(coalesce(u.last_login_at, u.last_active_at) at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as "ultimoAcesso", u.last_login_ip as ip
    from users u left join churches c on c.id = u.church_id left join roles ro on ro.id = u.role_id
    where ${onde.join(' and ')} order by ${rel === 'log' ? 'coalesce(u.last_login_at, u.last_active_at) desc' : 'igreja, u.full_name'}`, s.params);
  ls.forEach((l) => { l.perfil = PERFIL[String(l.perfil)] ?? l.perfil; });
  return ls;
};

export const EXECUTORES_SECRETARIA2: Record<string, Executor> = {
  'secretaria.agendamentos_culto': agendamentosCulto,
  'secretaria.agenda_pastoral': agendaPastoral,
  'secretaria.mala_direta': malaDireta,
  'secretaria.agendamento_ocorrencia': agendamentoOcorrencia,
  'secretaria.funcoes': funcoes,
  'secretaria.emissao_documentos': emissaoDocumentos,
  'secretaria.transferencias_pendentes': transferencias('origem'),
  'secretaria.recebimentos_pendentes': transferencias('destino'),
  'secretaria.usuarios': usuarios,
};
