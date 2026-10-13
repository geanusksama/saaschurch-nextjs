/**
 * Campos navegáveis e troca de campo.
 *
 * Quem pode trocar de campo:
 *  - master: qualquer campo, com a senha do campo;
 *  - qualquer outro usuário: só os campos que o master liberou na tela do
 *    usuário (tabela user_campos), sem senha — a liberação já é a autorização.
 *
 * Cada linha de user_campos guarda a lotação (igreja/regional) do usuário
 * naquele campo. Trocar de campo:
 *  1. guarda a lotação atual na linha do campo de onde ele sai;
 *  2. grava em users.campo_id/church_id/regional_id a lotação do campo destino.
 * Assim a Ilca (tesouraria, presa à própria igreja) entra em Aguaí já na
 * igreja dela de Aguaí, e ao voltar para Campinas volta para a de Campinas.
 *
 * O resto do sistema continua lendo o usuário como sempre; o isolamento por
 * campo está em lib/campoAtivo.ts.
 */
import type { AuthUser } from "./auth";
import { prisma } from "./prisma";

// ─── Hierarquia de perfil ───────────────────────────────────────────────────

const NIVEL_PERFIL: Record<string, number> = { church: 1, campo: 2, admin: 3, master: 4 };

export const PERFIS_VALIDOS = Object.keys(NIVEL_PERFIL);

/**
 * Quem pode dar qual perfil. Master dá qualquer um; os demais nunca dão um
 * perfil acima do próprio, e só o master cria/promove master ou admin.
 */
export function podeAtribuirPerfil(ator: AuthUser, perfil: string) {
  if (!(perfil in NIVEL_PERFIL)) return false;
  if (ator.profileType === "master") return true;
  if (perfil === "master" || perfil === "admin") return false;
  return (NIVEL_PERFIL[perfil] ?? 99) <= (NIVEL_PERFIL[ator.profileType] ?? 0);
}

/**
 * Pode editar, excluir, trocar a senha ou as permissões deste usuário?
 * Master pode tudo; os demais só mexem em quem está no mesmo nível ou abaixo
 * — nunca num master (senão um admin trocava a senha do master e entrava
 * como ele).
 */
export function podeGerenciarUsuario(ator: AuthUser, alvo: { profileType: string | null }) {
  if (ator.profileType === "master") return true;
  if (alvo.profileType === "master") return false;
  return (NIVEL_PERFIL[alvo.profileType ?? ""] ?? 0) <= (NIVEL_PERFIL[ator.profileType] ?? 0);
}

// ─── Campos navegáveis ──────────────────────────────────────────────────────

export type CampoNavegavel = {
  campoId: string;
  campoName: string;
  churchId: string | null;
  churchName: string | null;
  regionalId: string | null;
  regionalName: string | null;
};

export async function listarCamposNavegaveis(userId: string): Promise<CampoNavegavel[]> {
  const linhas = await prisma.userCampo.findMany({
    where: { userId, campo: { deletedAt: null } },
    select: {
      campoId: true,
      churchId: true,
      regionalId: true,
      campo: { select: { name: true } },
      church: { select: { name: true } },
      regional: { select: { name: true } },
    },
    orderBy: { campo: { name: "asc" } },
  });
  return linhas.map((l) => ({
    campoId: l.campoId,
    campoName: l.campo.name,
    churchId: l.churchId,
    churchName: l.church?.name ?? null,
    regionalId: l.regionalId,
    regionalName: l.regional?.name ?? null,
  }));
}

/**
 * Lotação válida dentro de um campo: a igreja manda (regional vem dela); sem
 * igreja, a regional; nada que não pertença ao campo é aceito.
 */
async function lotacaoNoCampo(campoId: string, churchId?: string | null, regionalId?: string | null) {
  if (churchId) {
    const igreja = await prisma.church.findFirst({
      where: { id: churchId, deletedAt: null, regional: { campoId } },
      select: { id: true, regionalId: true },
    });
    if (!igreja) return null;
    return { churchId: igreja.id, regionalId: igreja.regionalId };
  }
  if (regionalId) {
    const regional = await prisma.regional.findFirst({
      where: { id: regionalId, deletedAt: null, campoId },
      select: { id: true },
    });
    if (!regional) return null;
    return { churchId: null, regionalId: regional.id };
  }
  return { churchId: null, regionalId: null };
}

export class CampoNavegavelError extends Error {}

/**
 * Grava a lista de campos que o usuário pode navegar (só o master chama).
 *
 * `extras` são os campos ALÉM do campo do cadastro. O campo do cadastro entra
 * sempre, com a lotação do cadastro — senão quem sai dele não conseguiria
 * voltar. Lista de extras vazia = o usuário fica preso ao próprio campo e o
 * seletor some para ele.
 */
export async function salvarCamposNavegaveis(
  usuario: { id: string; campoId: string | null; churchId: string | null; regionalId: string | null },
  extras: Array<{ campoId: string; churchId?: string | null; regionalId?: string | null }>,
) {
  const desejadas = new Map<string, { churchId: string | null; regionalId: string | null }>();

  for (const extra of extras) {
    if (!extra?.campoId || extra.campoId === usuario.campoId) continue;
    const campo = await prisma.campo.findFirst({ where: { id: extra.campoId, deletedAt: null }, select: { id: true, name: true } });
    if (!campo) throw new CampoNavegavelError("Campo não encontrado.");
    const lotacao = await lotacaoNoCampo(campo.id, extra.churchId, extra.regionalId);
    if (!lotacao) throw new CampoNavegavelError(`A igreja/regional escolhida não pertence ao campo ${campo.name}.`);
    desejadas.set(campo.id, lotacao);
  }

  if (desejadas.size && usuario.campoId) {
    desejadas.set(usuario.campoId, { churchId: usuario.churchId, regionalId: usuario.regionalId });
  }

  // Poucas linhas por usuário: deleteMany + upserts em sequência, sem
  // transação interativa (ver AGENTS.md: ~7 statements estouram o limite).
  await prisma.userCampo.deleteMany({
    where: { userId: usuario.id, campoId: { notIn: Array.from(desejadas.keys()) } },
  });
  for (const [campoId, lotacao] of desejadas) {
    await prisma.userCampo.upsert({
      where: { userId_campoId: { userId: usuario.id, campoId } },
      create: { userId: usuario.id, campoId, ...lotacao },
      update: lotacao,
    });
  }
}

// ─── Troca de campo ─────────────────────────────────────────────────────────

export type ResultadoTroca = {
  campo: { id: string; name: string };
  churchId: string | null;
  churchName: string | null;
  regionalId: string | null;
  regionalName: string | null;
};

/**
 * Pode entrar neste campo sem a senha do campo? Sim quando o master liberou
 * (linha em user_campos). O master continua passando pela senha.
 */
export async function campoLiberadoParaUsuario(userId: string | null, campoId: string) {
  if (!userId) return false;
  const linha = await prisma.userCampo.findUnique({
    where: { userId_campoId: { userId, campoId } },
    select: { id: true },
  });
  return Boolean(linha);
}

export async function trocarDeCampo(user: AuthUser, campoDestinoId: string): Promise<ResultadoTroca> {
  const campo = await prisma.campo.findFirst({
    where: { id: campoDestinoId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!campo) throw new CampoNavegavelError("Campo não encontrado.");
  if (!user.id) throw new CampoNavegavelError("Usuário sem cadastro.");

  const atual = await prisma.user.findUnique({
    where: { id: user.id },
    select: { campoId: true, churchId: true, regionalId: true },
  });

  // 1. Guarda a lotação do campo de onde ele sai, para a volta.
  if (atual?.campoId && atual.campoId !== campo.id) {
    await prisma.userCampo.upsert({
      where: { userId_campoId: { userId: user.id, campoId: atual.campoId } },
      create: { userId: user.id, campoId: atual.campoId, churchId: atual.churchId, regionalId: atual.regionalId },
      update: { churchId: atual.churchId, regionalId: atual.regionalId },
    });
  }

  // 2. Lotação no campo destino: a guardada; senão, a atual se ela já for do
  //    campo destino; senão, nenhuma. Nunca uma igreja de outro campo.
  const guardada = await prisma.userCampo.findUnique({
    where: { userId_campoId: { userId: user.id, campoId: campo.id } },
    select: { churchId: true, regionalId: true },
  });
  let lotacao: { churchId: string | null; regionalId: string | null } | null = null;
  if (guardada) lotacao = await lotacaoNoCampo(campo.id, guardada.churchId, guardada.regionalId);
  if (!lotacao && atual?.churchId) lotacao = await lotacaoNoCampo(campo.id, atual.churchId, null);
  if (!lotacao && atual?.regionalId) lotacao = await lotacaoNoCampo(campo.id, null, atual.regionalId);
  lotacao ??= { churchId: null, regionalId: null };

  const atualizado = await prisma.user.update({
    where: { id: user.id },
    data: { campoId: campo.id, churchId: lotacao.churchId, regionalId: lotacao.regionalId },
    select: {
      churchId: true,
      regionalId: true,
      church: { select: { name: true } },
      regional: { select: { name: true } },
    },
  });

  return {
    campo,
    churchId: atualizado.churchId,
    churchName: atualizado.church?.name ?? null,
    regionalId: atualizado.regionalId,
    regionalName: atualizado.regional?.name ?? null,
  };
}
