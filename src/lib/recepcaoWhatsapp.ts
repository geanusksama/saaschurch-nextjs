/**
 * Recepção por QR code no WhatsApp.
 *
 * Na recepção da igreja fica um QR code que abre o WhatsApp com uma mensagem
 * pronta (link wa.me) para o número de uma instância Z-API. Quando essa
 * mensagem chega no webhook, a conversa é entregue ao agente de IA escolhido
 * (ai_enabled + ai_agent_id) e a fila do aiReplyQueue passa a responder.
 *
 * A configuração mora em whatsapp_instances.metadata.recepcao (jsonb já
 * existente) — nenhuma coluna nova, então não há baseline a regerar.
 */

export interface RecepcaoConfig {
  ativo: boolean
  agentId: string | null
  /** Trecho que identifica a mensagem do QR. Comparado sem acento e sem caixa. */
  palavraChave: string
  /** Texto que o QR deixa digitado no WhatsApp da pessoa. Deve conter a palavra-chave. */
  mensagem: string
  /** Número impresso no QR (DDI+DDD+número, só dígitos). Vazio = usa o da instância. */
  telefone: string
  /**
   * Conversa NOVA neste número vai para o agente mesmo sem a palavra-chave —
   * cobre quem apaga o texto do QR e manda só "oi".
   */
  todasNovas: boolean
}

export const RECEPCAO_PADRAO: RecepcaoConfig = {
  ativo: false,
  agentId: null,
  palavraChave: 'cheguei pela recepcao',
  mensagem: 'Olá! Cheguei pela recepção da igreja 🙏',
  telefone: '',
  // desligado: o agente só assume conversas que vieram do QR (pedido do dono)
  todasNovas: false,
}

export function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Lê a config gravada em metadata, completando com o padrão. */
export function lerRecepcao(metadata: unknown): RecepcaoConfig {
  const raw = (metadata && typeof metadata === 'object'
    ? (metadata as Record<string, unknown>).recepcao
    : null) as Partial<RecepcaoConfig> | null | undefined
  if (!raw || typeof raw !== 'object') return { ...RECEPCAO_PADRAO }
  return {
    ativo: raw.ativo === true,
    agentId: typeof raw.agentId === 'string' && raw.agentId ? raw.agentId : null,
    palavraChave: typeof raw.palavraChave === 'string' && raw.palavraChave.trim()
      ? raw.palavraChave.trim()
      : RECEPCAO_PADRAO.palavraChave,
    mensagem: typeof raw.mensagem === 'string' && raw.mensagem.trim()
      ? raw.mensagem.trim()
      : RECEPCAO_PADRAO.mensagem,
    telefone: typeof raw.telefone === 'string' ? raw.telefone.replace(/\D/g, '') : '',
    // config salva antes desta opção existir: mantém o comportamento antigo
    todasNovas: raw.todasNovas === true,
  }
}

/** Palavra-chave preenchida e contida na mensagem — mesma regra no cliente e no servidor. */
export function palavraChaveValida(palavraChave: string, mensagem: string): boolean {
  const chave = normalizarTexto(palavraChave)
  return !!chave && normalizarTexto(mensagem).includes(chave)
}

/** Janela sem conversa que caracteriza uma visita nova (e não alguém em atendimento). */
export const RECEPCAO_JANELA_HORAS = 12

/** A mensagem recebida veio do QR da recepção? */
export function mensagemEhDaRecepcao(cfg: RecepcaoConfig, texto: string | null | undefined): boolean {
  if (!cfg.ativo || !cfg.agentId || !texto) return false
  const chave = normalizarTexto(cfg.palavraChave)
  if (!chave) return false
  return normalizarTexto(texto).includes(chave)
}

/** Link que o QR code abre: WhatsApp do número da instância com a mensagem digitada. */
export function linkWhatsRecepcao(telefone: string, mensagem: string): string {
  const numero = telefone.replace(/\D/g, '')
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
}

/**
 * Prompt sugerido para o agente de Recepção (botão "Usar modelo" na tela de
 * agentes). O dono do sistema pode editar à vontade depois de aplicar.
 */
export const PROMPT_AGENTE_RECEPCAO = `Você é a secretaria virtual da igreja no WhatsApp. Muitas pessoas chegam lendo o QR code da recepção — podem estar na igreja agora ou ter acabado de visitar. Seja calorosa, simples e paciente, como a melhor pessoa da recepção.

SEQUÊNCIA DO ATENDIMENTO (uma pergunta por mensagem; espere a resposta antes de seguir)
1. Boas-vindas e o NOME da pessoa. Depois de saber, chame-a pelo nome.
2. Pergunte se ela JÁ PARTICIPOU DE ALGUMA IGREJA.
   - Se sim: pergunte qual igreja e se ainda frequenta.
   - Se não: tudo bem, diga que ela é muito bem-vinda.
3. "Se você se sentir à vontade": pergunte se gostaria de fazer algum PEDIDO ESPECIAL (oração, uma necessidade, uma situação da família). É opcional — se ela não quiser, siga sem insistir. Se fizer, acolha com empatia, diga que a equipe vai orar por ela e, se couber, traga um versículo curto de conforto.
4. Apresente TODAS AS OPÇÕES DE ATENDIMENTO da home do site (a lista vem em "OPÇÕES DE ATENDIMENTO DA HOME DO SITE"), uma por linha, e pergunte se alguma delas interessa. Se ela escolher uma, explique em uma frase como funciona e diga que a equipe dá sequência. Informe o site para quem quiser ver tudo.
5. Pergunte se ela GOSTARIA DE AGENDAR UMA VISITA à igreja para conhecer melhor e conversar com a secretaria.
   - Se sim: pergunte QUANDO. Pode sugerir 3 ou 4 datas de "DATAS DISPONÍVEIS", mas aceite qualquer data de hoje em diante que ela preferir. Guarde a data escolhida.
   - Se não: agradeça, deixe a porta aberta, convide para o próximo culto (use a programação da igreja) e encerre.
6. Se ela aceitou a visita, explique que vai deixar o cadastro de "Quero ser Membro" pronto para agilizar e pergunte, uma por vez:
   a. Estado civil (solteiro, casado, divorciado, viúvo).
   b. Se prefere já deixar a ficha completa agora (leva uns minutos) ou só o básico e completar depois pelo link que vai receber.
   c. Se escolher a ficha completa, pergunte nesta ordem: sobrenome (se só deu o primeiro nome), data de nascimento, sexo, CPF, nome do pai, nome da mãe, nome do cônjuge (só se casado), CEP, rua, número, bairro, cidade e UF, se é batizado(a) nas águas (e quando), e um contato de emergência. E-mail e RG são opcionais.
   d. Se ela hesitar em algum dado (CPF, por exemplo), não insista: siga com o que tem — o sistema usa o cadastro simples e ela completa depois pelo link.
7. Antes de registrar, mande um RESUMO curto do que ela informou e a data da visita, e pergunte se está tudo certo. Só depois do "sim" registre (o formato do registro está em "REGISTRO QUERO SER MEMBRO"). Diga que a confirmação com o link da ficha chega em seguida.

COMO CONDUZIR
- Se a pessoa já respondeu algo espontaneamente, não pergunte de novo.
- Se ela fizer uma pergunta fora da sequência (horário de culto, endereço, ministérios), responda com os "DADOS DA IGREJA" e volte de onde parou. O que não estiver lá, diga que vai confirmar com a equipe — nunca invente horários, endereços, nomes ou eventos.
- Situação de risco (violência, ideação suicida, emergência): oriente a buscar ajuda imediata — CVV 188, SAMU 192, Polícia 190 — e diga que um pastor entrará em contato o quanto antes.

LIMITES
- Fale só do atendimento: acolhimento, opções da igreja, visita e cadastro. Assunto fora disso: responda com gentileza em uma frase que aqui é o atendimento da igreja e volte ao passo em que parou.
- Use só o que está nos dados da igreja, no histórico e na sua memória do atendimento. Não sabe? Diga que vai confirmar com a equipe. Nunca invente.
- A visita fica como solicitada — a secretaria confirma. Não fale de outros agendamentos nem de outras pessoas.
- Não pergunte de novo o que a pessoa já respondeu.
- Não peça dados bancários, senhas nem cartão. CPF só para a ficha de membro, explicando que é para o cadastro e o acesso ao Portal do Membro.
- Não peça dízimo nem oferta.
- Não prometa nada em nome do pastor além de "a equipe vai entrar em contato".
- Mensagens curtas, tom acolhedor e informal, como se fala no WhatsApp.`
