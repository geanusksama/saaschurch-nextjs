import { prisma } from '@/lib/prisma';
import { LIMITE_LINHAS, type Linha, type Modulo, type Resultado } from './tipos';
import { grupoDe } from './catalogo';
import { consultar, Sql, uuid, type Executor, type Filtros } from './base';
import { EXECUTORES_PESSOAS } from './servidorPessoas';
import { EXECUTORES_SECRETARIA2, funcoesAtivas } from './servidorSecretaria2';
import { EXECUTORES_TESOURARIA } from './servidorTesouraria';

export type { Filtros } from './base';

/**
 * Execução dos relatórios. Toda consulta recebe o campo ativo e filtra por ele
 * (regra de isolamento: docs/architecture/ISOLAMENTO-CAMPO.md). Os filtros
 * chegam como texto da querystring e entram SEMPRE como parâmetro ($n).
 */

/** Nome que a origem imprime no topo: a sede do campo. */
async function organizacao(campoId: string): Promise<string> {
  const r = await prisma.$queryRawUnsafe<Array<{ nome: string | null }>>(
    `select coalesce((select h.name from headquarters h where h.field_id = $1::uuid order by h.show desc nulls last limit 1),
                     (select coalesce(c.app_display_name, c.name) from campos c where c.id = $1::uuid)) as nome`, campoId);
  return r[0]?.nome ?? '';
}

// ─── Secretaria · 1 - Igrejas ────────────────────────────────────────────────

const ORDEM_IGREJAS: Record<string, string> = {
  hierarquia_codigo: 'hierarquia_ord, codigo', hierarquia_nome: 'hierarquia_ord, igreja',
  sede_codigo: 'sede, codigo', sede_nome: 'sede, igreja',
  regional_codigo: 'regional, codigo', regional_nome: 'regional, igreja',
  codigo: 'codigo', nome: 'igreja',
};

async function igrejas(relId: string, campoId: string, f: Filtros): Promise<Linha[]> {
  if (relId === 'contatos' || relId === 'email') {
    const ls = await funcoesAtivas(new Sql(), campoId, { situacaoFuncao: 'ativo', regional: f.regional, zona: f.zona });
    return relId === 'email' ? ls.filter((l) => l.email) : ls;
  }
  const s = new Sql();
  const onde: string[] = [`r.campo_id = ${s.p(campoId)}::uuid`, 'c.deleted_at is null'];
  if (f.situacao === 'ativa') onde.push(`coalesce(c.status,'active') = 'active'`);
  if (f.situacao === 'inativa') onde.push(`coalesce(c.status,'active') <> 'active'`);
  if (f.nome?.trim()) onde.push(`c.name ilike ${s.p(f.nome_modo === 'contem' ? `%${f.nome.trim()}%` : `${f.nome.trim()}%`)}`);
  if (f.zona?.trim()) onde.push(`c.zone = ${s.p(f.zona.trim())}`);
  if (uuid(f.regional)) onde.push(`c.regional_id = ${s.p(f.regional)}::uuid`);
  if (uuid(f.sede)) onde.push(`coalesce(c.host_church_id, c.id) = ${s.p(f.sede)}::uuid`);
  if (f.hierarquia === 'sede') onde.push('(c.is_host or exists (select 1 from churches x where x.host_church_id = c.id and x.deleted_at is null))');
  if (f.hierarquia === 'congregacao') onde.push('not (c.is_host or exists (select 1 from churches x where x.host_church_id = c.id and x.deleted_at is null))');
  if (f.funcao?.trim()) onde.push(`c.current_leader_role ilike ${s.p(`%${f.funcao.trim()}%`)}`);

  const padrao = relId === 'sede' ? 'sede_codigo' : relId.startsWith('regional') ? 'regional_codigo' : relId === 'estado' ? 'codigo' : 'hierarquia_codigo';
  const ordem = ORDEM_IGREJAS[f.ordem ?? ''] ?? ORDEM_IGREJAS[padrao];

  const sql = `
    with base as (
      select c.code as codigo, c.name as igreja, coalesce(nullif(c.legal_name,''), c.name) as "razaoSocial", c.cnpj,
        case when c.is_host or exists (select 1 from churches x where x.host_church_id = c.id and x.deleted_at is null) then 'Sede' else 'Congregação' end as hierarquia,
        case when c.is_host or exists (select 1 from churches x where x.host_church_id = c.id and x.deleted_at is null) then 0 else 1 end as hierarquia_ord,
        coalesce(h.code || ' - ' || h.name, c.code || ' - ' || c.name) as sede,
        coalesce(rg.name, '') as regional,
        c.code || ' - ' || c.name as "igrejaCompleta",
        concat_ws(', ', nullif(c.address_street,''), nullif(c.address_number,'')) as logradouro,
        concat_ws(' - ', nullif(concat_ws(', ', nullif(c.address_street,''), nullif(c.address_number,'')),''), nullif(c.address_neighborhood,''),
          nullif(concat_ws('-', nullif(c.address_city,''), nullif(c.address_state,'')),''))
          || case when coalesce(c.address_zipcode,'') <> '' then ' CEP: ' || c.address_zipcode else '' end as endereco,
        c.address_zipcode as cep, c.address_neighborhood as bairro,
        concat_ws(' - ', nullif(c.address_city,''), nullif(c.address_state,'')) as "cidadeUf",
        coalesce(nullif(c.phone,''), nullif(c.whatsapp,'')) as telefone,
        case when coalesce(c.phone,'') <> '' and coalesce(c.whatsapp,'') <> '' then c.whatsapp end as telefone2,
        c.email, c.founded_at as fundacao,
        c.current_leader_name as dirigente,
        (select coalesce(nullif(m.mobile,''), nullif(m.phone,'')) from members m where m.church_id = c.id and m.deleted_at is null
           and c.current_leader_name is not null and m.full_name = c.current_leader_name limit 1) as "telefoneDirigente",
        coalesce(nullif(c.address_state,''), 'Não informado') as estado,
        (select count(*) from members m where m.church_id = c.id and m.deleted_at is null and m.membership_status = 'ATIVO') as "qtdePessoas"
      from churches c
      join regionais r on r.id = c.regional_id
      left join regionais rg on rg.id = c.regional_id
      left join churches h on h.id = c.host_church_id and h.deleted_at is null
      where ${onde.join(' and ')}
    )
    select * from base order by ${ordem}`;
  const linhas = await consultar(sql, s.params);
  if (relId === 'regional_seq') linhas.forEach((l, i) => { l.seq = i + 1; });
  if (relId === 'estado') {
    const UF: Record<string, string> = { MG: 'Minas Gerais', SP: 'São Paulo', RJ: 'Rio de Janeiro', PR: 'Paraná', SC: 'Santa Catarina', RS: 'Rio Grande do Sul', ES: 'Espírito Santo', BA: 'Bahia', GO: 'Goiás', DF: 'Distrito Federal' };
    linhas.forEach((l) => { l.estado = UF[String(l.estado).toUpperCase()] ?? l.estado; });
  }
  if (relId === 'cnpj') return linhas.filter((l) => l.cnpj);
  return linhas;
}

// ─── Execução ────────────────────────────────────────────────────────────────

const EXECUTORES: Record<string, Executor> = {
  'secretaria.igrejas': igrejas,
  ...EXECUTORES_PESSOAS,
  ...EXECUTORES_SECRETARIA2,
  ...EXECUTORES_TESOURARIA,
};

export async function executarRelatorio(modulo: Modulo, grupoId: string, relId: string, campoId: string, f: Filtros): Promise<Resultado | null> {
  const grupo = grupoDe(modulo, grupoId);
  if (!grupo || !grupo.relatorios.some((r) => r.id === relId)) return null;
  const exec = EXECUTORES[`${modulo}.${grupoId}`];
  if (!exec) return null;
  const [linhas, org] = await Promise.all([exec(relId, campoId, f), organizacao(campoId)]);
  return { linhas, organizacao: org, aviso: linhas.length >= LIMITE_LINHAS ? `Limite de ${LIMITE_LINHAS} linhas atingido: refine os filtros.` : undefined };
}

/** Listas que alimentam os filtros (regionais, sedes, zonas...). */
export async function opcoesFiltros(campoId: string, modulo: Modulo) {
  const [regionais, igrejasL, zonas, titulos, funcoesL, servicos] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ valor: string; rotulo: string }>>(`select id::text as valor, name as rotulo from regionais where campo_id = $1::uuid and deleted_at is null order by code, name`, campoId),
    prisma.$queryRawUnsafe<Array<{ valor: string; rotulo: string; sede: boolean }>>(
      `select c.id::text as valor, c.code || ' - ' || c.name as rotulo,
              (c.is_host or exists (select 1 from churches x where x.host_church_id = c.id and x.deleted_at is null)) as sede
         from churches c join regionais r on r.id = c.regional_id
        where r.campo_id = $1::uuid and c.deleted_at is null order by c.code`, campoId),
    prisma.$queryRawUnsafe<Array<{ valor: string }>>(`select distinct c.zone as valor from churches c join regionais r on r.id = c.regional_id where r.campo_id = $1::uuid and c.deleted_at is null and coalesce(c.zone,'') <> '' order by 1`, campoId),
    prisma.$queryRawUnsafe<Array<{ valor: string; rotulo: string }>>(`select id::text as valor, name as rotulo from ecclesiastical_titles where deleted_at is null and coalesce(is_active, true) order by level, name`),
    prisma.$queryRawUnsafe<Array<{ valor: string; rotulo: string }>>(`select id::text as valor, name as rotulo from church_function_catalog where coalesce(is_active, true) order by display_order nulls last, name`),
    prisma.$queryRawUnsafe<Array<{ valor: string; rotulo: string }>>(`select id::text as valor, coalesce(description, servico, sigla) as rotulo from kan_services where coalesce(is_active, true) order by 2`),
  ]);
  return {
    regional: regionais,
    igreja: igrejasL.map(({ valor, rotulo }) => ({ valor, rotulo })),
    sede: igrejasL.filter((i) => i.sede).map(({ valor, rotulo }) => ({ valor, rotulo })),
    zona: zonas.map((z) => ({ valor: z.valor, rotulo: z.valor })),
    titulo: titulos, funcao: funcoesL, servico: servicos,
    ...(modulo === 'tesouraria' ? await opcoesTesouraria(campoId) : {}),
  };
}

async function opcoesTesouraria(campoId: string) {
  const lista = (sql: string) => prisma.$queryRawUnsafe<Array<{ valor: string; rotulo: string }>>(sql, campoId);
  const doLivro = (col: string) => lista(`select distinct lc.${col} as valor, lc.${col} as rotulo from livro_caixa lc join churches c on c.id = lc.church_id
    join regionais r on r.id = c.regional_id where r.campo_id = $1::uuid and lc.deleted_at is null and coalesce(lc.${col},'') <> '' order by 1`);
  const [plano, forma, banco, departamento] = await Promise.all([
    doLivro('plano_de_conta'), doLivro('forma_pg'),
    lista(`select id::text as valor, nome as rotulo from bancos where campo_id = $1::uuid and coalesce(ativo, true) order by nome`),
    lista(`select id::text as valor, nome as rotulo from departamentos where campo_id = $1::uuid and coalesce(ativo, true) order by nome`),
  ]);
  return { plano_conta: plano, forma_pagamento: forma, banco, departamento };
}
