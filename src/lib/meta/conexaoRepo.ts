import { prisma } from '../prisma'
import { ErroServico, MSG_DUPLICADO } from './servicoConexao'
import type { ConexaoRegistro, DadosSalvar } from './servicoConexao'

export async function buscarConexaoDoCampo(campoId: string): Promise<ConexaoRegistro | null> {
  return prisma.metaWhatsappConexao.findUnique({
    where: { campoId },
    select: {
      campoId: true, wabaId: true, phoneNumberId: true, numero: true, nomeExibicao: true,
      tokenCifrado: true, pinCifrado: true, status: true, ultimoErro: true,
    },
  })
}

export async function buscarPorPhoneNumberId(phoneNumberId: string): Promise<{ campoId: string } | null> {
  return prisma.metaWhatsappConexao.findUnique({ where: { phoneNumberId }, select: { campoId: true } })
}

export async function salvarConexao(d: DadosSalvar): Promise<void> {
  const dados = {
    wabaId: d.wabaId,
    phoneNumberId: d.phoneNumberId,
    numero: d.numero,
    nomeExibicao: d.nomeExibicao,
    tokenCifrado: d.tokenCifrado,
    pinCifrado: d.pinCifrado,
    status: 'conectado',
    ultimoErro: null,
    conectadoPor: d.conectadoPor,
    conectadoEm: new Date(),
  }
  try {
    await prisma.metaWhatsappConexao.upsert({
      where: { campoId: d.campoId },
      create: { campoId: d.campoId, ...dados },
      update: dados,
    })
  } catch (e) {
    // Corrida: outro campo ligou o mesmo número entre a checagem e a gravação.
    if ((e as { code?: string })?.code === 'P2002') throw new ErroServico(409, MSG_DUPLICADO)
    throw e
  }
}

export async function marcarErro(campoId: string, msg: string): Promise<void> {
  await prisma.metaWhatsappConexao.updateMany({ where: { campoId }, data: { status: 'erro', ultimoErro: msg } })
}

export async function desconectar(campoId: string): Promise<void> {
  // Desconexão suave: guarda número e PIN (a reconexão reaproveita o PIN); só descarta o token.
  await prisma.metaWhatsappConexao.updateMany({
    where: { campoId },
    data: { status: 'desconectado', tokenCifrado: '', ultimoErro: null },
  })
}
