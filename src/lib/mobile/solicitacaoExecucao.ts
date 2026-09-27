/**
 * Painel Mobile › Secretaria — "Aprovar e executar" uma solicitação do app.
 *
 * Mudar o status só avisa a pessoa (gatilho appv3_alerta_status). Quando o
 * pedido é algo que o sistema sabe fazer, a aprovação também grava:
 *
 *   Atualização de cadastro → members (nome, nascimento, estado civil, endereço)
 *   Cadastro de família     → member_family_relationships (filho, cônjuge, pai/mãe, irmão)
 *   Grupo familiar          → cell_group_members (troca de GF se já estiver em outro)
 *   Ministério              → ministry_members
 *   Matrícula na EBD        → appv3_ebd_matriculas SOLICITADA → ATIVA
 *
 * O resto (carta, certificado, documento, atendimento pastoral, pedido de
 * correção, link de atualização) é trabalho da secretaria: `plano` devolve
 * `manual` explicando o que fazer, e o status continua sendo trocado à mão.
 *
 * `planejar` e `executar` usam a mesma montagem, então o que a tela mostra
 * como "vai mudar" é exatamente o que é gravado.
 */
import { prisma } from '@/lib/prisma';
import { assignCellGroupTag, removeCellGroupTag } from '@/lib/cellGroupService';
import { ErroMobile } from './recursosServidor';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface Mudanca { rotulo: string; de: string | null; para: string }

export interface PlanoExecucao {
  /** Há algo que o sistema grava ao aprovar. */
  executavel: boolean;
  mudancas: Mudanca[];
  /** O que fica para a secretaria fazer à mão. */
  manual: string[];
}

const ABERTOS = ['EM_ANALISE', 'AGUARDANDO_LINK', 'LINK_ENVIADO'];

interface Montagem {
  plano: PlanoExecucao;
  gravar?: (tx: Tx) => Promise<void>;
  /** Depois da transação (tags do GF). */
  depois?: () => Promise<void>;
  /** Ocorrência no histórico do membro. */
  historico?: string;
}

const txt = (v: unknown) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim());
const norm = (s: string | null) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const dataBr = (d: Date | null) => (d ? d.toISOString().slice(0, 10).split('-').reverse().join('/') : null);

async function membroDa(row: Row) {
  if (!row.memberId) return null;
  return prisma.member.findFirst({ where: { id: row.memberId, deletedAt: null } });
}

const SEM_MEMBRO = 'A conta do app não está vinculada a um membro (rol). Vincule a pessoa ao cadastro antes de aprovar.';

// ── Atualização de cadastro ──────────────────────────────────────────────────
/** "Rua X, 123, Bairro" (formato que o app mostra) → colunas do endereço. */
function partesEndereco(s: string): { addressStreet: string; addressNumber: string | null; addressNeighborhood?: string } | null {
  const p = s.split(',').map((x) => x.trim()).filter(Boolean);
  const numero = (x: string) => /^(\d+[\w-]*|s\/?n)$/i.test(x);
  if (p.length === 3 && numero(p[1])) return { addressStreet: p[0], addressNumber: p[1], addressNeighborhood: p[2] };
  if (p.length === 2 && numero(p[1])) return { addressStreet: p[0], addressNumber: p[1] };
  return null;
}

async function cadastro(row: Row): Promise<Montagem> {
  const dados = (row.dados ?? {}) as Record<string, unknown>;
  if (dados.canal || dados.destino) {
    return { plano: { executavel: false, mudancas: [], manual: [`A pessoa pediu o link de atualização por ${dados.canal ?? 'mensagem'} (${dados.destino ?? '—'}). Cole o link no campo abaixo e mude para "Link enviado".`] } };
  }
  const m = await membroDa(row);
  if (!m) return { plano: { executavel: false, mudancas: [], manual: [SEM_MEMBRO] } };

  const data: Record<string, unknown> = {};
  const mudancas: Mudanca[] = [];
  const manual: string[] = [];
  const muda = (rotulo: string, de: string | null, para: string, campos: Record<string, unknown>) => {
    if (norm(de) === norm(para)) return;
    mudancas.push({ rotulo, de, para });
    Object.assign(data, campos);
  };

  for (const [chave, bruto] of Object.entries(dados)) {
    const v = txt(bruto);
    if (!v) continue;
    switch (chave) {
      case 'Nome completo':
        muda(chave, m.fullName, v, { fullName: v.slice(0, 255) });
        break;
      case 'Data de nascimento': {
        const r = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        const d = r ? new Date(`${r[3]}-${r[2]}-${r[1]}T00:00:00.000Z`) : null;
        if (!d || Number.isNaN(d.getTime()) || d.getUTCDate() !== Number(r![1])) { manual.push(`Data de nascimento "${v}" não é uma data válida.`); break; }
        muda(chave, dataBr(m.birthDate), v, { birthDate: d });
        break;
      }
      case 'Estado civil':
        muda(chave, m.maritalStatus, v, { maritalStatus: v.slice(0, 20) });
        break;
      case 'Endereço': {
        const atual = [m.addressStreet, m.addressNumber].filter(Boolean).join(', ');
        const atualCompleto = [atual || null, m.addressNeighborhood].filter(Boolean).join(', ') || null;
        const e = partesEndereco(v);
        if (!e) { manual.push(`Endereço "${v}": não deu para separar rua, número e bairro. Ajuste no cadastro do membro.`); break; }
        muda(chave, atualCompleto, v, e);
        break;
      }
      case 'Celular':
        muda(chave, m.mobile, v, { mobile: v.replace(/\D/g, '').slice(0, 20) });
        break;
      case 'E-mail':
        muda(chave, m.email, v, { email: v.toLowerCase().slice(0, 255) });
        break;
      default:
        manual.push(`${chave}: ${v} — este campo não é gravado automaticamente.`);
    }
  }

  if (!mudancas.length) return { plano: { executavel: false, mudancas, manual: manual.length ? manual : ['O cadastro já está com esses dados. Basta concluir.'] } };
  return {
    plano: { executavel: true, mudancas, manual },
    gravar: async (tx) => { await tx.member.update({ where: { id: m.id }, data: { ...data, updatedAt: new Date() } }); },
    historico: mudancas.map((x) => `${x.rotulo}: ${x.de ?? '—'} → ${x.para}`).join(' · '),
  };
}

// ── Cadastro de família ──────────────────────────────────────────────────────
/** Parentesco do app → tipo do cadastro (os 4 que o perfil do membro mostra). */
function tipoFamilia(parentesco: string): string | null {
  const p = norm(parentesco);
  if (p.startsWith('filh')) return 'FILHO';
  if (p.startsWith('cônj') || p.startsWith('conj')) return 'CONJUGE';
  if (p === 'pai' || p === 'mãe' || p === 'mae') return 'PAI_MAE';
  if (p.startsWith('irm')) return 'IRMAO';
  return null;
}

async function familia(row: Row): Promise<Montagem> {
  const dados = (row.dados ?? {}) as Record<string, unknown>;
  const nome = txt(dados.nome);
  if (dados.pedido === 'correção' || dados.vinculo_atual) {
    return { plano: { executavel: false, mudancas: [], manual: [`Pedido de correção de ${nome ?? 'familiar'} (hoje: ${dados.vinculo_atual ?? '—'}). Corrija na aba Família do membro.`] } };
  }
  const m = await membroDa(row);
  if (!m) return { plano: { executavel: false, mudancas: [], manual: [SEM_MEMBRO] } };
  const parentesco = txt(dados.parentesco) ?? '';
  const tipo = tipoFamilia(parentesco);
  if (!nome || !tipo) {
    return { plano: { executavel: false, mudancas: [], manual: [`${nome ?? 'Familiar'} como "${parentesco}": o cadastro da igreja só registra filho, cônjuge, pai/mãe e irmão. Anote à mão se precisar.`] } };
  }
  const existentes = await prisma.memberFamilyRelationship.findMany({
    where: { memberId: m.id, deletedAt: null },
    select: { relatedName: true, relatedMember: { select: { fullName: true } } },
  });
  if (existentes.some((r) => norm(r.relatedName ?? r.relatedMember?.fullName ?? null) === norm(nome))) {
    return { plano: { executavel: false, mudancas: [], manual: [`${nome} já está na família do membro. Basta concluir.`] } };
  }
  return {
    plano: { executavel: true, mudancas: [{ rotulo: `Família (${parentesco})`, de: null, para: nome }], manual: [] },
    gravar: async (tx) => {
      await tx.memberFamilyRelationship.create({
        data: { memberId: m.id, relationshipType: tipo, relatedName: nome.slice(0, 255), notes: `Pedido do app #SEC-${row.protocolo}` },
      });
    },
    historico: `Família: ${nome} (${parentesco})`,
  };
}

// ── Grupo familiar ───────────────────────────────────────────────────────────
async function grupo(row: Row): Promise<Montagem> {
  const dados = (row.dados ?? {}) as Record<string, unknown>;
  const m = await membroDa(row);
  if (!m) return { plano: { executavel: false, mudancas: [], manual: [SEM_MEMBRO] } };
  const gf = dados.cell_group_id
    ? await prisma.cellGroup.findFirst({ where: { id: String(dados.cell_group_id), deletedAt: null }, select: { id: true, name: true } })
    : null;
  if (!gf) return { plano: { executavel: false, mudancas: [], manual: [`O GF ${dados.grupo ?? ''} não existe mais. Combine com a pessoa outro grupo.`] } };
  const atual = await prisma.cellGroupMember.findFirst({
    where: { memberId: m.id, isActive: true },
    include: { cellGroup: { select: { id: true, name: true } } },
  });
  if (atual?.cellGroupId === gf.id) return { plano: { executavel: false, mudancas: [], manual: [`Já participa do GF ${gf.name}. Basta concluir.`] } };
  return {
    plano: { executavel: true, mudancas: [{ rotulo: 'Grupo familiar', de: atual?.cellGroup.name ?? null, para: gf.name }], manual: [] },
    gravar: async (tx) => {
      if (atual) await tx.cellGroupMember.update({ where: { id: atual.id }, data: { isActive: false, leftAt: new Date() } });
      await tx.cellGroupMember.create({ data: { cellGroupId: gf.id, memberId: m.id, role: 'member', joinedAt: new Date() } });
    },
    depois: async () => {
      if (atual) await removeCellGroupTag(atual.cellGroupId, m.id);
      await assignCellGroupTag(gf.id, m.id);
    },
    historico: `GF: ${atual?.cellGroup.name ?? '—'} → ${gf.name}`,
  };
}

// ── Ministério ───────────────────────────────────────────────────────────────
async function ministerio(row: Row): Promise<Montagem> {
  const dados = (row.dados ?? {}) as Record<string, unknown>;
  const m = await membroDa(row);
  if (!m) return { plano: { executavel: false, mudancas: [], manual: [SEM_MEMBRO] } };
  const min = dados.ministry_id
    ? await prisma.ministry.findFirst({ where: { id: String(dados.ministry_id), deletedAt: null, isActive: true }, select: { id: true, name: true } })
    : null;
  if (!min) return { plano: { executavel: false, mudancas: [], manual: [`O ministério ${dados.ministerio ?? ''} não está ativo.`] } };
  const ja = await prisma.ministryMember.findFirst({ where: { ministryId: min.id, memberId: m.id, isActive: true } });
  if (ja) return { plano: { executavel: false, mudancas: [], manual: [`Já participa de ${min.name}. Basta concluir.`] } };
  return {
    plano: { executavel: true, mudancas: [{ rotulo: 'Ministério', de: null, para: min.name }], manual: [] },
    gravar: async (tx) => {
      await tx.ministryMember.create({ data: { ministryId: min.id, memberId: m.id, role: 'Participante', joinedAt: new Date(), isActive: true } });
    },
    historico: `Ministério: ${min.name}`,
  };
}

// ── Matrícula na EBD ─────────────────────────────────────────────────────────
async function ebd(row: Row): Promise<Montagem> {
  const dados = (row.dados ?? {}) as Record<string, unknown>;
  const mat = dados.turma_id
    ? await prisma.appV3EbdMatricula.findFirst({ where: { turmaId: String(dados.turma_id), perfilId: row.perfilId }, include: { turma: { select: { nome: true } } } })
    : null;
  if (!mat) return { plano: { executavel: false, mudancas: [], manual: ['A matrícula não foi encontrada (a turma pode ter sido excluída).'] } };
  if (mat.status === 'ATIVA') return { plano: { executavel: false, mudancas: [], manual: [`Matrícula em ${mat.turma.nome} já está ativa. Basta concluir.`] } };
  return {
    plano: { executavel: true, mudancas: [{ rotulo: `EBD · ${mat.turma.nome}`, de: mat.status === 'CANCELADA' ? 'Cancelada' : 'Solicitada', para: 'Ativa' }], manual: [] },
    gravar: async (tx) => { await tx.appV3EbdMatricula.update({ where: { id: mat.id }, data: { status: 'ATIVA' } }); },
  };
}

const MANUAL: Record<string, string> = {
  'Carta de recomendação': 'Emita a carta, cole o link do documento abaixo e conclua.',
  'Certificado de batismo': 'Emita o certificado, cole o link abaixo (ou combine a retirada na resposta) e conclua.',
  'Envio de documento': 'Confira o anexo e guarde no cadastro do membro, se for o caso; depois conclua.',
  'Atendimento pastoral': 'Encaminhe ao pastor e responda à pessoa com o combinado.',
};

async function montar(row: Row): Promise<Montagem> {
  switch (row.tipo) {
    case 'Atualização de cadastro': return cadastro(row);
    case 'Cadastro de família': return familia(row);
    case 'Grupo familiar': return grupo(row);
    case 'Ministério': return ministerio(row);
    case 'Matrícula na EBD': return ebd(row);
    default: return { plano: { executavel: false, mudancas: [], manual: [MANUAL[row.tipo] ?? 'Faça o atendimento e mude o status para avisar a pessoa.'] } };
  }
}

/** O que "Aprovar e executar" faria, para a tela mostrar antes do clique. */
export async function planejar(row: Row): Promise<PlanoExecucao | null> {
  if (!ABERTOS.includes(row.status)) return null;
  return (await montar(row)).plano;
}

/**
 * Grava o pedido e conclui a solicitação na mesma transação. A troca de
 * status para CONCLUIDA dispara o alerta no app (gatilho do banco).
 */
export async function executar(row: Row, resposta: string | null, userId: string | null) {
  if (!ABERTOS.includes(row.status)) throw new ErroMobile('Esta solicitação já foi encerrada.', 409);
  const mt = await montar(row);
  if (!mt.plano.executavel || !mt.gravar) throw new ErroMobile(mt.plano.manual[0] ?? 'Nada a executar nesta solicitação.', 409);

  await prisma.$transaction(async (tx) => {
    // trava contra dois cliques/duas abas: só conclui quem ainda está aberta
    const r = await tx.appV3Solicitacao.updateMany({
      where: { id: row.id, status: { in: ABERTOS } },
      data: { status: 'CONCLUIDA', atualizadoEm: new Date(), ...(resposta ? { resposta } : {}) },
    });
    if (r.count === 0) throw new ErroMobile('Esta solicitação já foi encerrada.', 409);
    await mt.gravar!(tx);
  });

  if (mt.depois) await mt.depois().catch((e) => console.error('[solicitacao] pós-execução', e));
  if (mt.historico && row.memberId && row.churchId) {
    await prisma.memberEventHistory.create({
      data: {
        memberId: row.memberId,
        churchId: row.churchId,
        serviceGroup: 'APP',
        serviceName: 'Secretaria do app',
        action: 'SOLICITAÇÃO APROVADA',
        notes: `#SEC-${row.protocolo} ${row.tipo} · ${mt.historico}`,
        metadata: { source: 'APPV3_SOLICITACAO', solicitacaoId: row.id, mudancas: mt.plano.mudancas as unknown as object[] },
        createdBy: userId,
      },
    }).catch((e) => console.error('[solicitacao] ocorrência não registrada', e));
  }
  return mt.plano;
}
