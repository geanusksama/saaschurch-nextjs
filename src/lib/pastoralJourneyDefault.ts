/**
 * Cronograma de Acompanhamento — 1º Mês (matriz padrão).
 *
 * Transcrição de docs/cronograma_acompanhamento_01.pdf: 13 etapas × 3 perfis.
 * É apenas a SEMENTE — depois de criada, a matriz é editável na tela
 * (aba Cronograma → Matriz). Mexer aqui não altera cronogramas já criados.
 *
 * Agendamento é sempre relativo ao dia do acolhimento, nunca ao calendário:
 *   weekday = 0 domingo … 6 sábado (null = usa apenas min_offset_days)
 *   data = primeira ocorrência do weekday a partir de
 *          acolhimento + (week_number - 1) × 7 + min_offset_days
 */

export const JOURNEY_PROFILES = ['novo_convertido', 'reconciliado', 'outra_igreja'] as const;
export type JourneyProfile = (typeof JOURNEY_PROFILES)[number];

export const JOURNEY_PROFILE_LABELS: Record<JourneyProfile, string> = {
  novo_convertido: 'Novo Convertido',
  reconciliado: 'Reconciliado',
  outra_igreja: 'Vindo de Outra Igreja',
};

export const JOURNEY_PROFILE_COLORS: Record<JourneyProfile, string> = {
  novo_convertido: '#22c55e',
  reconciliado: '#f59e0b',
  outra_igreja: '#3b82f6',
};

export interface DefaultStep {
  code: string;
  momentLabel: string;
  channel: string;
  programLabel: string;
  weekNumber: number;
  /** 0=domingo … 6=sábado; null = agenda só por min_offset_days */
  weekday: number | null;
  minOffsetDays: number;
  sendTime: string;
  messages: Record<JourneyProfile, string>;
}

export const DEFAULT_JOURNEY_NAME = 'Cronograma de Acompanhamento — 1º Mês';

export const DEFAULT_JOURNEY_STEPS: DefaultStep[] = [
  {
    code: 'd1',
    momentLabel: 'D+1 (até 24h após o acolhimento)',
    channel: 'WhatsApp (individual)',
    programLabel: 'Primeiro contato individual',
    weekNumber: 1,
    weekday: null,
    minOffsetDays: 1,
    sendTime: '09:00',
    messages: {
      novo_convertido:
        'Seja bem-vindo(a) à família! Deus tem um propósito lindo para sua vida a partir de agora.\n\n"Se alguém está em Cristo, é nova criação; as coisas antigas já passaram." (2 Coríntios 5:17)',
      reconciliado:
        'Que alegria ter você de volta! O Pai está de braços abertos esperando por você.\n\n"Este meu filho estava morto, e reviveu; se havia perdido, e foi achado." (Lucas 15:24)',
      outra_igreja:
        'Seja muito bem-vindo(a) à nossa igreja! Estamos felizes em ter você conosco nesta família.\n\n"Vós sois o corpo de Cristo e, individualmente, membros dele." (1 Coríntios 12:27)',
    },
  },
  {
    code: 's1_ensino',
    momentLabel: 'Semana 1 · Véspera do culto de ensino (quarta)',
    channel: 'WhatsApp',
    programLabel: 'Culto de ensino: direção para os primeiros passos',
    weekNumber: 1,
    weekday: 2,
    minOffsetDays: 0,
    sendTime: '09:00',
    messages: {
      novo_convertido:
        'Amanhã tem culto de ensino, uma noite que vai te dar direção pra essa nova caminhada com Jesus e te mostrar os próximos passos. Não pode faltar!\n\n"Ensina-me o teu caminho, e guiar-me-ei na tua verdade." (Salmos 86:11)',
      reconciliado:
        'Amanhã tem culto de ensino, um momento de direção pra você recomeçar com clareza os próximos passos dessa nova caminhada. Vem com a gente!\n\n"Este é o caminho, andai por ele." (Isaías 30:21)',
      outra_igreja:
        'Amanhã tem culto de ensino, um direcionamento importante pra você entender os próximos passos aqui na igreja. Vai enriquecer bastante sua caminhada!\n\n"Guiar-te-ei com os meus olhos." (Salmos 32:8)',
    },
  },
  {
    code: 's1_domingo',
    momentLabel: 'Semana 1 · Véspera de domingo',
    channel: 'WhatsApp',
    programLabel: 'Escola Bíblica 8h + cultos 9h30/18h30',
    weekNumber: 1,
    weekday: 6,
    minOffsetDays: 0,
    sendTime: '09:00',
    messages: {
      novo_convertido:
        'Domingo tem Escola Bíblica às 8h e culto às 9h30 — ótimo jeito de aprender mais sobre sua nova vida em Cristo. Te esperamos lá!\n\n"Buscai, pois, em primeiro lugar, o seu reino." (Mateus 6:33)',
      reconciliado:
        'Domingo é dia de recomeçar. Escola Bíblica às 8h e culto às 9h30. Vem se alimentar da Palavra que restaura.\n\n"Sara-me, Senhor, e sararei; salva-me, e serei salvo." (Jeremias 17:14)',
      outra_igreja:
        'Domingo temos Escola Bíblica às 8h e cultos às 9h30 e 18h30. Ótima chance de já ir se conectando com a igreja.\n\n"Perseveravam na doutrina dos apóstolos e na comunhão." (Atos 2:42)',
    },
  },
  {
    code: 's1_posculto',
    momentLabel: 'Semana 1 · Pós-culto (segunda)',
    channel: 'Ligação / áudio WhatsApp',
    programLabel: 'Feedback pessoal da primeira semana',
    weekNumber: 1,
    weekday: 1,
    minOffsetDays: 3,
    sendTime: '10:00',
    messages: {
      novo_convertido:
        'Como foi seu final de semana na igreja? Qualquer dúvida sobre sua nova caminhada com Jesus, pode me chamar!\n\n"Ensina-me a fazer a tua vontade." (Salmos 143:10)',
      reconciliado:
        'Fico feliz que você esteve com a gente. Como está se sentindo nesse recomeço? Estou aqui pra te ajudar no que precisar.\n\n"Não temas, porque eu sou contigo." (Isaías 41:10)',
      outra_igreja:
        'Que bom te ver na igreja! Como está sendo essa adaptação até aqui? Quero te ajudar a se sentir parte da família.\n\n"Sede unânimes entre vós." (Romanos 12:16)',
    },
  },
  {
    code: 's2_ensino',
    momentLabel: 'Semana 2 · Véspera do culto de ensino (quarta)',
    channel: 'WhatsApp',
    programLabel: 'Culto de ensino + apresentação dos Grupos Familiares (GFs)',
    weekNumber: 2,
    weekday: 2,
    minOffsetDays: 0,
    sendTime: '09:00',
    messages: {
      novo_convertido:
        'Amanhã tem culto de ensino, mais um direcionamento pros seus próximos passos! Essa semana também vamos te falar dos Grupos Familiares (GFs) — um novo passo pra caminhar mais de perto com outros irmãos.\n\n"Crescei na graça e no conhecimento de nosso Senhor." (2 Pedro 3:18)',
      reconciliado:
        'Amanhã tem culto de ensino, direção pra reconstrução da sua fé. Também vamos te apresentar os Grupos Familiares (GFs) — um próximo passo importante nessa nova caminhada.\n\n"Ele restaura a minha alma." (Salmos 23:3)',
      outra_igreja:
        'Amanhã tem culto de ensino! Essa semana também vamos te falar dos Grupos Familiares (GFs) — um jeito de se conectar ainda mais com a igreja no seu dia a dia.\n\n"Sede bondosos uns para com os outros." (Efésios 4:32)',
    },
  },
  {
    code: 's2_domingo',
    momentLabel: 'Semana 2 · Véspera de domingo',
    channel: 'WhatsApp',
    programLabel: 'Escola Bíblica + culto — reforço dos GFs',
    weekNumber: 2,
    weekday: 6,
    minOffsetDays: 0,
    sendTime: '09:00',
    messages: {
      novo_convertido:
        'Domingo tem Escola Bíblica e culto — já pensou em conversar com um líder sobre seu batismo e sobre entrar em um Grupo Familiar? Vamos juntos nessa jornada!\n\n"Arrependei-vos, e cada um de vós seja batizado." (Atos 2:38)',
      reconciliado:
        'Domingo é mais um dia pra se firmar na graça de Deus. Vem com a gente na Escola Bíblica e no culto — e já pensa em entrar em um Grupo Familiar!\n\n"A tua misericórdia, Senhor, é infinita." (Salmos 36:5)',
      outra_igreja:
        'Domingo tem Escola Bíblica e culto. Que tal já conhecer um Grupo Familiar (GF) da igreja essa semana?\n\n"Repartiam entre si tudo... tinham tudo em comum." (Atos 2:44-45)',
    },
  },
  {
    code: 's2_digital',
    momentLabel: 'Semana 2 · Conteúdo digital',
    channel: 'Instagram / YouTube',
    programLabel: 'Vídeo de apoio + convite aos GFs',
    weekNumber: 2,
    weekday: 4,
    minOffsetDays: 0,
    sendTime: '15:00',
    messages: {
      novo_convertido:
        'Separamos um vídeo especial no nosso canal do YouTube sobre os primeiros passos na fé. Vale a pena assistir!\n\n"A tua palavra é lâmpada para os meus pés." (Salmos 119:105)',
      reconciliado:
        'Vem ver esse vídeo no nosso YouTube sobre restauração e graça — vai tocar seu coração.\n\n"A minha benignidade não se apartará de ti." (Isaías 54:10)',
      outra_igreja:
        'Publicamos um vídeo no YouTube sobre vida em comunidade e Grupos Familiares. Dá uma olhada quando puder!\n\n"Há um só corpo e um só Espírito." (Efésios 4:4)',
    },
  },
  {
    code: 's3_ensino',
    momentLabel: 'Semana 3 · Véspera do culto de ensino (quarta)',
    channel: 'WhatsApp',
    programLabel: 'Culto de ensino: direção pra vida de oração',
    weekNumber: 3,
    weekday: 2,
    minOffsetDays: 0,
    sendTime: '09:00',
    messages: {
      novo_convertido:
        'Amanhã tem culto de ensino! Vamos falar sobre oração — um direcionamento essencial pros seus próximos passos com Deus.\n\n"Orai sem cessar." (1 Tessalonicenses 5:17)',
      reconciliado:
        'Amanhã tem culto de ensino, um novo direcionamento pra buscar mais intimidade com Deus em oração.\n\n"Perto está o Senhor de todos os que o invocam." (Salmos 145:18)',
      outra_igreja:
        'Amanhã tem culto de ensino! Um bom direcionamento pro seu próximo passo: servir em algum ministério da igreja.\n\n"Cada um administre aos outros o dom como o recebeu." (1 Pedro 4:10)',
    },
  },
  {
    code: 's3_domingo',
    momentLabel: 'Semana 3 · Véspera de domingo',
    channel: 'WhatsApp',
    programLabel: 'Escola Bíblica + culto — ministérios em foco',
    weekNumber: 3,
    weekday: 6,
    minOffsetDays: 0,
    sendTime: '09:00',
    messages: {
      novo_convertido:
        'Domingo tem Escola Bíblica e culto. Estamos organizando um momento de batismo em breve — quer fazer parte?\n\n"Fomos sepultados com ele na morte, pelo batismo." (Romanos 6:4)',
      reconciliado:
        'Domingo é dia de continuar firme. Vem participar da Escola Bíblica e do culto com a gente!\n\n"Prossigo para o alvo." (Filipenses 3:14)',
      outra_igreja:
        'Domingo tem Escola Bíblica e culto. Vamos te apresentar às áreas de ministério da igreja nesta semana?\n\n"Há diversidade de ministérios, mas o mesmo Senhor." (1 Coríntios 12:5)',
    },
  },
  {
    code: 's3_discipulado',
    momentLabel: 'Semana 3 · Convite ministério/discipulado',
    channel: 'WhatsApp + presencial',
    programLabel: 'Discipulado individual + descoberta de dons',
    weekNumber: 3,
    weekday: 4,
    minOffsetDays: 0,
    sendTime: '15:00',
    messages: {
      novo_convertido:
        'Vamos marcar um momento de discipulado só nosso, pra aprofundar sua caminhada com Jesus?\n\n"Fazei discípulos... ensinando-os a guardar todas as coisas." (Mateus 28:19-20)',
      reconciliado:
        'Que tal fazermos um momento de discipulado, pra fortalecer esse novo caminhar com Deus?\n\n"Restaurai tal homem com espírito de mansidão." (Gálatas 6:1)',
      outra_igreja:
        'Vamos conversar sobre qual ministério combina mais com seus dons? A igreja cresce quando cada um serve.\n\n"Todo o corpo, bem ajustado, efetua o seu crescimento." (Efésios 4:16)',
    },
  },
  {
    code: 's4_ensino',
    momentLabel: 'Semana 4 · Véspera do culto de ensino (quarta)',
    channel: 'WhatsApp',
    programLabel: 'Culto de ensino: direção pra fechar o mês',
    weekNumber: 4,
    weekday: 2,
    minOffsetDays: 0,
    sendTime: '09:00',
    messages: {
      novo_convertido:
        'Amanhã tem culto de ensino! Já é seu primeiro mês com a gente — mais um direcionamento pros seus próximos passos na fé.\n\n"Aquele que começou boa obra em vós a aperfeiçoará." (Filipenses 1:6)',
      reconciliado:
        'Amanhã tem culto de ensino. Olha só, um mês já se passou desde seu recomeço — Deus é fiel e continua te direcionando!\n\n"Grande é a tua fidelidade." (Lamentações 3:23)',
      outra_igreja:
        'Amanhã tem culto de ensino! Um mês já se passou — vamos te dar direção pros seus próximos passos aqui na família.\n\n"Somos concidadãos dos santos, e da família de Deus." (Efésios 2:19)',
    },
  },
  {
    code: 's4_domingo',
    momentLabel: 'Semana 4 · Véspera de domingo',
    channel: 'WhatsApp',
    programLabel: 'Escola Bíblica + culto — encaminhamentos finais',
    weekNumber: 4,
    weekday: 6,
    minOffsetDays: 0,
    sendTime: '09:00',
    messages: {
      novo_convertido:
        'Domingo tem Escola Bíblica e culto — vamos fechar esse mês combinando a data do seu batismo!\n\n"Aquele que crer e for batizado será salvo." (Marcos 16:16)',
      reconciliado:
        'Domingo é dia de celebrar essa restauração com a igreja toda. Vem com a gente!\n\n"O Senhor te abençoe e te guarde." (Números 6:24)',
      outra_igreja:
        'Domingo tem Escola Bíblica e culto. Vamos ver juntos em qual Grupo Familiar ou ministério você vai se conectar?\n\n"Edificai-vos a vós mesmos." (Judas 1:20)',
    },
  },
  {
    code: 's4_fechamento',
    momentLabel: 'Semana 4 · Fechamento do mês',
    channel: 'Ligação / encontro presencial',
    programLabel: 'Balanço do mês + próximos passos',
    weekNumber: 4,
    weekday: 1,
    minOffsetDays: 3,
    sendTime: '10:00',
    messages: {
      novo_convertido:
        'Parabéns por esse primeiro mês de caminhada! Vamos marcar seu batismo e te conectar a um Grupo Familiar pra continuar crescendo.\n\n"Como convém aos santos." (Efésios 5:3)',
      reconciliado:
        'Um mês de recomeço! Como você está se sentindo? Vamos te conectar a um Grupo Familiar pra você não caminhar sozinho(a).\n\n"Duas pessoas são melhores do que uma." (Eclesiastes 4:9)',
      outra_igreja:
        'Um mês com a gente! Vamos fechar esse ciclo te conectando definitivamente a um Grupo Familiar e um ministério.\n\n"Perseveravam unânimes, todos os dias." (Atos 2:46)',
    },
  },
];

export const WEEKDAY_LABELS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];
