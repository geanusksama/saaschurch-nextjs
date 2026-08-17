# Módulo de Atendimento Pastoral

Funcionamento, regras de negócio e arquitetura técnica do Módulo de Atendimento Pastoral
da plataforma AD Campinas.

> **"Quero ser Membro" tem documento próprio:** [quero-ser-membro.md](quero-ser-membro.md).
> A adesão é da **Secretaria** — é ela que avalia e aprova. O que o pastoral empresta é o
> card de acompanhamento, descrito na seção 2 daquele documento e resumido aqui em
> "Cards de adesão".

---

## 1. Visão Geral

O módulo é a ponte entre visitantes/membros e o corpo pastoral. Duas partes:
1. **Portal Público (acolhimento):** solicitação rápida de 14 tipos de atendimento
   pastoral, com verificação de WhatsApp.
2. **Kanban Pastoral:** pastores e secretários acompanham as solicitações num quadro
   dedicado e agendam atividades (ligações, visitas, reuniões).

---

## 2. Fluxo Público de Atendimento

### Tipos de Atendimento Disponíveis
O portal oferece um menu stack flutuante (FAB) adaptável (2 colunas em desktop/tablet, 1 coluna em dispositivos móveis) para selecionar as seguintes opções:
- **Visita Pastoral**, **Aconselhamento**, **Pedido de Oração**, **Atendimento Emergencial**, **Reconciliação**, **Atendimento Familiar**, **Atendimento Jovem**, **Atendimento Infantil**, **Atendimento Financeiro**, **Atendimento Ministerial**, **Atendimento Online**, **Atendimento Presencial**, **Casamento**, **Apresentação de Crianças**, além de **Já sou Membro** e **Quero ser Membro**.
*(Nota: As opções obsoletas "Discipulado" e "Follow-up" foram removidas).*

### Verificação de WhatsApp (Desafio OTP)
Para garantir a veracidade dos dados informados:
1. O solicitante digita o nome e telefone celular (WhatsApp).
2. A plataforma localiza a instância ativa conectada no WhatsApp (instância zero via Z-API) e envia um código de verificação numérico de 6 dígitos.
3. O formulário gera um token JWT criptografado contendo o hash do código e número de telefone para validação no backend.
4. Após o solicitante digitar o código correto, a solicitação de atendimento ou adesão é inserida no banco de dados.

### Cards de adesão ("Quero ser Membro")

O pedido de adesão abre um card aqui, com `attendance_type = 'quero_ser_membro'`: é dele
que saem a posição na fila, a timeline pública mandada por WhatsApp e o acompanhamento do
1º mês. Nos relatórios pastorais esses cards entram na conta de "aconselhamento"
(`isCounseling`, em `src/lib/pastoralService.ts`).

**A avaliação e a aprovação não são daqui** — são da Secretaria, em
`/app-ui/membership-requests`. Fluxo, regras de roteamento para a sede do campo, ficha e
matriz de admissão: [quero-ser-membro.md](quero-ser-membro.md).

---

## 3. Notificações Automatizadas via WhatsApp

O sistema possui duas integrações ativas com o Z-API para manter os visitantes e candidatos informados de que o atendimento está evoluindo:

1. **Movimentação no Kanban (Status do Atendimento):**
   - Sempre que o card de atendimento é arrastado para uma nova coluna no Kanban administrativo, o sistema envia uma mensagem via WhatsApp.
   - **Formato da Mensagem:** Começa com *"A Paz do Senhor Jesus! ✨"*, seguido de uma mensagem encorajadora (*"Que Deus abençoe a sua vida e fortaleça o seu coração!"*) e o novo status.
   - **Mapeamento do status FAZENDO:** Se o card for movido para a coluna "FAZENDO" (doing), o status exibido no WhatsApp será: *"Estamos preparando tudo e logo entraremos em contato"*, mantendo um tom de acolhimento amigável.
   - **Link de Acompanhamento:** Cada mensagem inclui um link da timeline pública e dinâmica do atendimento (`/pastoral/timeline/:id`).

2. **Criação de Novas Atividades:**
   - Sempre que um pastor/secretário registra uma nova atividade no painel (ex: agendamento de ligação, visita pastoral ou reunião), o sistema notifica o visitante/membro por WhatsApp para que ele saiba que seu atendimento está em andamento.
   - **Formato da Mensagem:** *"A Paz do Senhor Jesus, [Nome]! ✨ Que Deus abençoe a sua vida! Passando para informar que a sua solicitação de atendimento pastoral na AD Campinas está em andamento. Uma nova atividade foi registrada: Tipo: [Tipo] - Título: [Título]. Acompanhe pelo link..."*.

---

## 4. Painel Administrativo e Controle de Acesso

### Restrição por Perfil de Usuário
O Kanban Pastoral respeita estritamente o perfil do usuário logado:
- **Perfil Geral/Administrador:** Possui acesso total e pode filtrar cartões por regional e por igrejas.
- **Perfil de Secretaria de Igreja (`profileType === 'church'`):**
  - Os filtros de regional e igreja são ocultados e travados.
  - A visualização é restrita exclusivamente aos atendimentos associados ao `churchId` daquele usuário.

### Painel de Solicitações "Quero Ser Membro"

Fica na **Secretaria** (`/app-ui/membership-requests`), com permissão própria
(`membership_requests`, grupo Secretaria). Não é uma tela do módulo pastoral — ver
[quero-ser-membro.md](quero-ser-membro.md).

---

## 5. Estrutura de Arquivos e APIs Envolvidas

- **Frontend / Componentes:**
  - `src/components/public/PublicHome.tsx` - Menu de serviços, formulários públicos e desafio de OTP.
  - `src/components/public/PastoralTimelinePublic.tsx` - Timeline pública do atendimento.
  - `src/app-ui/pastoral/PastoralKanban.tsx` - Quadro Kanban com filtragem por papel.
  - `src/app-ui/pastoral/PastoralHub.tsx` - Hub do módulo (pipeline, envios, histórico).
- **Backend / APIs:**
  - `src/app/api/public/pastoral/send-otp/route.ts` - Geração e envio do OTP.
  - `src/app/api/public/pastoral/create-attendance/route.ts` - Criação de cartões via portal.
  - `src/app/api/public/pastoral/timeline/[id]/route.ts` - Histórico de eventos do atendimento.
  - `src/app/api/pastoral/notify-move/route.ts` - Notificação de movimentação de coluna.
  - `src/app/api/pastoral/notify-activity/route.ts` - Notificação de nova atividade.
  - `src/lib/pastoralService.ts` - Consolidação dos relatórios pastorais.

Os arquivos e rotas da adesão estão em [quero-ser-membro.md](quero-ser-membro.md).
