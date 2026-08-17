# Quero ser Membro — adesão e ficha

Módulo da **Secretaria**. Rota: `/app-ui/membership-requests`.
Permissão: `membership_requests` (grupo **Secretaria**).

Quem aprova é a secretaria, não a gestão pastoral: a tela vive no menu Secretaria e tem
chave própria na matriz. O que o pastoral empresta é só o **card de acompanhamento** —
ver "Relação com o pipeline pastoral", no fim.

O caminho inteiro: portal público → verificação do WhatsApp → agendamento da entrevista →
ficha → avaliação da secretaria → membro com ROL.

---

## 1. Fluxo público

A pessoa abre o menu de serviços na home e escolhe **Quero ser Membro**. Desde
2026-08-17 há **duas abas**, e as duas terminam no mesmo lugar (OTP → agenda → pedido):

### Aba "Dados básicos" — rápida, ficha depois

Nome, WhatsApp, **campo/região**, estado civil, igreja evangélica anterior (dropdown com
as mais comuns ou "Outra") e observações. A ficha chega depois, pelo link no WhatsApp.

### Aba "Ficha completa" — já envia tudo

O pedido nasce pronto para avaliação: `form_data` e `form_submitted_at` são gravados na
própria criação.

- **Igreja escolhida por busca**, não por rolagem: `GET /api/public/churches` traz todas
  as ativas, de qualquer campo. Ela **substitui** a escolha de campo.
- Obrigatórios: nome, sobrenome, nascimento, sexo, estado civil, CPF (dígito verificador
  conferido no cliente e no servidor), nome do pai, nome da mãe, cônjuge quando
  casado(a), e o endereço inteiro — CEP (que preenche o resto via ViaCEP), rua, número,
  bairro, cidade e UF.
- Opcionais: RG, e-mail, naturalidade, título eclesiástico (declarativo — quem define o
  título é a matriz, na aprovação), batismo e data, desde quando frequenta, contato de
  emergência, observações e **foto do rosto**.
- Fora de propósito: título/zona/seção eleitoral (não entram no cadastro de membresia) e
  formação/profissão (a pessoa atualiza depois, pelo portal do membro).
- A foto sobe **depois** de o pedido existir — o `formToken` devolvido pela criação é a
  credencial do upload. Falha na foto não invalida a adesão: a pessoa reenvia pelo link.

Nas duas abas: telefone incompleto é barrado antes de gastar um OTP, e a posição na fila
da coluna "POR FAZER" é exibida no fim.

### Verificação de WhatsApp (OTP)

1. A pessoa informa nome e WhatsApp.
2. A plataforma pega a primeira instância Z-API ativa e conectada e envia um código de 6
   dígitos.
3. O cliente recebe um JWT com o hash do código e o telefone; a validação é no servidor.
4. Com o código certo, a solicitação é gravada.

---

## 2. Quem avalia × onde o membro nasce

A pessoa escolhe a igreja em que quer se membrar, mas **quem entrevista e decide é a
igreja SEDE do campo daquela igreja**. O caminho é igreja → `regional_id` → `campo_id` →
sede (`resolveSedeChurchOfChurch`, em `src/lib/sedeResolver.ts`).

| coluna de `new_member_requests` | papel |
|---|---|
| `church_id` / `target_church_id` | igreja **SEDE**, que avalia e é dona do card |
| `desired_church_id` | igreja **escolhida**, onde o membro é criado na aprovação |

Exemplo real: adesão pedida para *01-002-018 BARAO GERALDO* (Regional 02, campo
Campinas) é avaliada por *AD Campinas - SEDE*; aprovada, o membro é cadastrado em Barão
Geraldo, **não** na sede.

Sem sede identificável, o pedido fica **na própria igreja escolhida** — mandar para a
sede padrão jogaria um pedido de outro campo (ou de outro estado) na mesa errada. O
motivo fica na timeline do card. Pedido antigo, e pedido vindo da aba de dados básicos,
ficam com `desired_church_id` nulo e entram pela igreja que recebeu, como antes.

> O cadastro de campo/regional é a fonte disso. Igreja pendurada no regional errado vai
> para a sede errada: hoje as igrejas "AD Aguaí" estão no campo Campinas, então os
> pedidos delas caem na sede de Campinas. É dado, não código.

---

## 3. Painel da Secretaria

`view` vê a lista, `edit` **aprova/reprova** (sem ele a ficha abre em leitura, sem os
botões de decisão nem o campo de observação), `create` reenvia o link da ficha pelo
WhatsApp.

A lista traz busca por nome, filtro por status (Pendente/Aprovado/Reprovado), por
**estado da ficha** (`submitted` = há o que avaliar; `awaiting` = ainda não preencheu) e
por período. A coluna "Avalia / Destino" mostra a sede e, quando diferente, a igreja em
que o membro vai nascer.

A decisão acontece no `MembershipReviewModal`, que mostra a ficha inteira e a foto:

- **Aprovar** cria o membro na `desired_church_id` (ou na igreja do pedido, se não
  houver), com o `regional_id` daquela igreja e número de **ROL** global (maior + 1), e
  avisa pelo WhatsApp. CPF já cadastrado **bloqueia** a aprovação, de propósito.
- **Reprovar** exige o motivo, que vai por WhatsApp, e move o card para "CANCELADO".

### A matriz é quem promove

O membro nasce `AGUARDANDO ATIVACAO` / `CONGREGADO`. Quem o transforma em MEMBRO é a
**matriz do serviço CAD**, via `openAdmissionCard` → `applyMatrixRule` nas colunas 1 e 2
— o mesmo efeito de arrastar o card de Cadastro para "Aprovado":

| coluna | situação | título | ocorrência |
|---|---|---|---|
| 1 Pendente | Aguardando Ativação | CONGREGADO | "Cadastro" |
| 2 Aprovado | Ativo | **MEMBRO** | "Admissão concluida" |

A matriz grava `member_title_history` (CONGREGADO → MEMBRO) e `member_event_history`.
Gravar `ATIVO` na mão no insert mascarava a matriz não ter rodado; hoje, se ela não
rodar, o membro é ativado como rede de segurança **e a tela avisa**
(`matrixApplied: false`) para conferirem o serviço CAD no pipeline.

Aprovar conclui o **cadastro**, não o acolhimento: por padrão o card continua no
pipeline recebendo o cronograma do 1º mês. `closeProcess` é a exceção que encerra os
dois de uma vez.

---

## 4. Banco

Migrations (as duas **aplicadas**):

- `supabase/migrations/20260728_membership_form.sql` — ficha: `form_token`, `form_data`,
  `form_submitted_at`, `documents`, campos da avaliação e `target_church_id`.
- `supabase/migrations/20260817_membership_desired_church.sql` — `desired_church_id`
  (+ FK para `churches`), que separa quem avalia de onde o membro nasce.

> **Cuidado com embed do PostgREST:** `new_member_requests` tem **duas** FKs para
> `churches`. `select('*, churches(name)')` volta `PGRST201` (ambíguo) e derruba a rota
> inteira em 500 — é preciso nomear a constraint:
> `churches!new_member_requests_church_id_fkey(name)`.

---

## 5. Arquivos

| Arquivo | Função |
|---|---|
| `src/components/public/PublicHome.tsx` | Menu de serviços, as duas abas, OTP e agendamento |
| `src/components/public/MembershipFullFormFields.tsx` | Campos da ficha completa + combobox de igrejas |
| `src/components/public/MembershipFormPublic.tsx` | A mesma ficha, aberta pelo link com token |
| `src/components/public/fichaHelpers.ts` | Validação de CPF e busca de CEP (máscaras em `src/lib/masks.ts`) |
| `src/app-ui/ecclesiastical/QueroSerMembroRequests.tsx` | Lista das solicitações |
| `src/app-ui/ecclesiastical/MembershipReviewModal.tsx` | Avaliação da ficha e decisão |
| `src/lib/sedeResolver.ts` | `resolveSedeChurchOfCampo` / `resolveSedeChurchOfChurch` |
| `src/lib/memberAdmission.ts` + `src/lib/kanMatrix.ts` | Card de admissão e aplicação da matriz |

### Rotas

Públicas (credencial = OTP ou token da URL):
- `POST /api/public/pastoral/send-otp`
- `POST /api/public/pastoral/create-membership-request` — cria, roteia para a sede, grava a ficha e devolve `formToken`
- `GET /api/public/churches` — igrejas ativas para o combobox
- `GET/POST /api/public/membership-form/[token]` e `POST .../photo`

Admin (`withAuth`):
- `GET /api/membership-requests` — listagem (+ `desired_church_name`)
- `GET/PUT /api/membership-requests/[id]`
- `POST /api/membership-requests/[id]/review` — a decisão
- `POST /api/membership-requests/[id]/send-form` — reenvia o link pelo WhatsApp

> `handleApprove`/`handleReject` (PUT em `/api/membership-requests/[id]`) continuam no
> arquivo da lista mas não estão ligados a nenhum botão — resquício do fluxo antigo, que
> redirecionava para o cadastro com os campos pré-preenchidos.

---

## 6. Relação com o pipeline pastoral

O pedido também abre um card em `pastoral_attendances` com
`attendance_type = 'quero_ser_membro'`. É dele que saem a **posição na fila**, a
**timeline pública** enviada por WhatsApp e o acompanhamento do 1º mês.

Consequência a conhecer: esses cards aparecem no Kanban de Gestão Pastoral e, nos
relatórios pastorais, entram na conta de "aconselhamento"
(`isCounseling` em `src/lib/pastoralService.ts`). A **aprovação**, essa sim, é exclusiva
da Secretaria.

Ver `docs/modules/pastoral.md` para o módulo de atendimento pastoral em si.
