# Módulo de Atendimento Pastoral & Quero ser Membro

Este documento descreve o funcionamento, regras de negócio e arquitetura técnica do Módulo de Atendimento Pastoral e solicitações de filiação/adesão ("Quero ser Membro") implementados na plataforma AD Campinas.

---

## 1. Visão Geral

O módulo foi desenvolvido para fornecer uma ponte de comunicação direta, segura e acolhedora entre visitantes/membros e o corpo pastoral da igreja. É dividido em duas partes fundamentais:
1. **Portal Público (Frontend de Acolhimento):** Permite a solicitação rápida de 16 tipos diferentes de atendimento pastoral, além de solicitações formais de adesão de novos membros com escolha de data de entrevista.
2. **Painel Administrativo (Secretaria e Kanban Pastoral):** Permite que pastores e secretários acompanhem as solicitações por meio de um Kanban dedicado, agendem atividades (ligações, visitas, reuniões) e processem a aprovação/reprovação de novos membros com preenchimento automático da ficha cadastral.

---

## 2. Fluxo Público de Atendimento & Adesão

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

### Solicitação de Adesão (Quero ser Membro)
Além dos dados básicos, a solicitação de adesão exige:
- Estado Civil (Casado/Solteiro).
- Igreja evangélica anterior (seleção em dropdown com as igrejas mais comuns ou opção "Outra").
- Observações adicionais (para informações sobre o histórico de fé do candidato).
- Agendamento de data de entrevista (calendário integrado).
- Exibição em tempo real da posição na fila de espera da coluna "POR FAZER".

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
A tela de administração de novos membros permite:
- Paginação, buscas textuais por nome e filtros por status (Pendente, Aprovado, Reprovado) e período.
- **Aprovação:** Ao clicar em "Aprovar", o status da solicitação muda para "Aprovado", o card no Kanban é automaticamente movido para a coluna final "CONCLUÍDO", e o secretário é redirecionado para a tela de registro de membros com os campos pré-preenchidos (Nome, Sobrenome, WhatsApp, Estado Civil, Notas com histórico da igreja anterior e data da entrevista realizada).
- **Reprovação:** Ao reprovar, o status da solicitação muda para "Reprovado" e o card é movido para a coluna "CANCELADO".

---

## 5. Estrutura de Arquivos e APIs Envolvidas

- **Frontend / Componentes:**
  - `src/components/public/PublicHome.tsx` - Menu FAB de 16 opções, formulários públicos e desafios de OTP.
  - `src/components/public/PastoralTimelinePublic.tsx` - Visualização pública da timeline do atendimento.
  - `src/app-ui/pastoral/PastoralKanban.tsx` - Quadro Kanban com regras de filtragem por papel.
  - `src/app-ui/ecclesiastical/QueroSerMembroRequests.tsx` - Painel de aprovação das fichas de filiação.
- **Backend / APIs:**
  - `src/app/api/public/pastoral/send-otp/route.ts` - Geração e envio do OTP.
  - `src/app/api/public/pastoral/create-attendance/route.ts` - Criação de cartões de atendimento via portal.
  - `src/app/api/public/pastoral/create-membership-request/route.ts` - Criação de solicitações de membro e cálculo de fila de espera.
  - `src/app/api/public/pastoral/timeline/[id]/route.ts` - Histórico de eventos do atendimento.
  - `src/app/api/pastoral/notify-move/route.ts` - Gatilho de notificação de movimentação de colunas.
  - `src/app/api/pastoral/notify-activity/route.ts` - Gatilho de notificação de nova atividade criada.
  - `src/app/api/membership-requests/route.ts` & `[id]/route.ts` - Listagem e aprovação de novos membros.
