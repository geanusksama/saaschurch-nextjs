# Campanhas da Secretaria

Módulo criado em 2026-07-30. Rota: `/app-ui/secretariat/campaigns`.
Permissão: `secretaria_campanhas` (grupo **Secretaria**).

Uma campanha é um pedido da secretaria a um grupo de pessoas. Dois formatos:

| `kind` | O que é | Recebe resposta? |
|---|---|---|
| `form` | Formulário dinâmico (atualização de dados, envio de documento) | Sim, e passa por aprovação |
| `broadcast` | Comunicado: texto + imagem + link/vídeo | Não |

---

## Ciclo completo

```
criar campanha ──► compartilhar link  ─┐
       │                               ├──► pessoa preenche ──► resposta pendente
       └──► anexar pessoas ──► enviar ─┘                              │
                                                     ┌────────────────┴────────────────┐
                                              APROVAR                            REPROVAR
                                       grava no cadastro                 WhatsApp com o motivo
                                       + ocorrência no perfil            + link para corrigir
                                                                                  │
                                                                         pessoa corrige e reenvia
```

---

## Banco de dados

Migration: `supabase/migrations/20260730_secretaria_campaigns.sql` — **aplicada** em
2026-07-30 (aditiva: só cria 3 tabelas). Aplicador:
`npx tsx scripts/apply-secretaria-campaigns.mjs`.

### `secretaria_campaigns`
Campos que importam:

- `form_schema` (jsonb) — array de perguntas; ver `SecretariaCampaignField`.
- `share_token` — credencial do link avulso: `/campanha/<share_token>`.
- `require_identification` — quando `true`, o link avulso exige **ROL + CPF**.
- `instance_id` — instância Z-API usada no disparo.
- `target_count` / `sent_count` / `response_count` — cache; a fonte da verdade são
  as tabelas filhas, recontadas por `refreshCampaignCounters()`.

### `secretaria_campaign_targets`
Uma linha por pessoa anexada. `UNIQUE (campaign_id, member_id)` — anexar é sempre
incremental e nunca duplica, mesmo com dois secretários anexando ao mesmo tempo.

- `token` — o link individual: `/campanha/<share_token>/<token>`, que já abre
  identificado.
- `dispatch_campaign_id` / `dispatch_recipient_id` — ponteiro para o envio em massa,
  usado na reconciliação.
- `status`: `pending → sending → sent | failed`, depois `responded → approved | rejected`.

### `secretaria_campaign_responses`
Uma linha por pessoa **por campanha** — o reenvio depois de reprovado sobrescreve a
mesma linha, não cria outra.

- `answers` (jsonb) — `{ "<fieldId>": valor }`.
- `files` (jsonb) — `[{ fieldId, url, fileName, mimeType, size }]`.
- `applied_fields` (jsonb) — o que a aprovação de fato gravou: `[{ field, label, from, to }]`.

As três tabelas têm RLS ligado sem policy: o acesso passa sempre pelas rotas `/api`
com `supabaseAdmin`, que aplicam o escopo do usuário.

---

## Arquivos

| Arquivo | Função |
|---|---|
| `src/lib/secretariaCampaignFields.ts` | Tipos das perguntas e o **de-para com `members`** (`MEMBER_FIELD_MAP`) + validação do schema |
| `src/lib/secretariaCampaignService.ts` | Tokens, validação da resposta, `applyApprovalToMember`, contadores |
| `src/lib/secretariaCampaignScope.ts` | Escopo de visibilidade e resolução do público-alvo |
| `src/app-ui/secretaria/SecretariaCampaigns.tsx` | Tela principal: lista, detalhe, envio |
| `src/app-ui/secretaria/CampaignBuilderModal.tsx` | Criar/editar campanha + construtor do formulário |
| `src/app-ui/secretaria/AttachAudienceModal.tsx` | Filtro regional/zona/igreja/título/situação |
| `src/app-ui/secretaria/CampaignResponseDrawer.tsx` | Conferência e decisão |
| `src/components/public/CampanhaFormPublic.tsx` | O formulário que a pessoa preenche |

### Rotas

Admin (`withAuth`):
- `GET/POST /api/secretaria/campaigns`
- `GET/PATCH/DELETE /api/secretaria/campaigns/[id]`
- `GET/POST /api/secretaria/campaigns/audience` — opções dos filtros / prévia do público
- `GET/POST/DELETE /api/secretaria/campaigns/[id]/targets`
- `POST /api/secretaria/campaigns/[id]/send` — prepara a fila; `GET` reconcilia
- `GET /api/secretaria/campaigns/[id]/responses`
- `GET/PATCH /api/secretaria/campaign-responses/[responseId]` — a decisão

Públicas (sem auth, credencial = token da URL):
- `GET/POST /api/public/campanha/[token]`
- `POST /api/public/campanha/[token]/upload`

SPA: `/campanha/:token` e `/campanha/:token/:targetToken`.

---

## Regras que não podem ser violadas

1. **A aprovação só escreve no que está em `MEMBER_FIELD_MAP`.** ROL, igreja, título e
   situação de membresia estão fora da lista de propósito — essas mudanças têm processo
   próprio (transferência, consagração, matriz do pipeline).
2. **A pergunta precisa estar mapeada.** Sem `memberField`, a resposta fica só na
   campanha. É o secretário que decide isso ao montar o formulário.
3. **O formulário trava na primeira resposta.** `PATCH` com `formSchema` devolve 409 se
   já houver resposta — mudar o schema deixaria as respostas antigas órfãs.
4. **Nada que veio do cliente entra sem passar pelo schema publicado.** `validateAnswers`
   descarta chave que não é pergunta; anexar pessoas relê os membros pelo escopo, mesmo
   quando a tela manda a lista de ids pronta.
5. **ROL e CPF juntos, nunca só o ROL.** O ROL é sequencial e adivinhável; o par é o que
   impede alguém de abrir a ficha de outra pessoa pelo link avulso. A mensagem de erro é
   genérica para o link não virar um verificador de "este CPF é membro?".
6. **CPF duplicado bloqueia a aprovação inteira**, e a resposta NÃO é marcada como
   aprovada — senão o dado ficaria "aprovado" e não gravado.
7. **Reprovar exige o motivo.** É ele que vai no WhatsApp junto com o link.

---

## Envio por WhatsApp

O envio **não** é reimplementado: `POST /[id]/send` monta uma campanha em
`whatsapp_campaigns` com um destinatário por pessoa e devolve `processUrl`. A tela chama
`POST /api/whatsapp/campaigns/<id>/process` em laço, respeitando o `waitMs` da resposta —
é esse laço que garante o cooldown de 5 s por instância (risco de ban do número).
Ver [[project_whatsapp_module]] / `docs/modules/whatsapp-mass-send/`.

Depois do laço, `GET /[id]/send` copia o resultado (`sent` / `failed`) de volta para os
alvos. **A aba precisa ficar aberta durante o envio.**

Variáveis do texto: `nome`, `primeiro_nome`, `telefone`, `igreja`, `regional`, `rol`,
`cargo`, `campanha` e **`link`** — esta última vira o link individual da pessoa.

Vídeo entra como link no fim da mensagem: a Z-API não envia vídeo por URL.

---

## Tipos de pergunta

`text`, `textarea`, `number`, `date`, `email`, `phone`, `cpf`, `select`, `radio`,
`checkbox`, `image` (foto, com `capture` no celular), `file` (PDF).

Limites de upload: imagem 8 MB, PDF 15 MB. Arquivos vão para o bucket `dados`, em
`campanhas/<campaignId>/`. O caminho é montado no servidor, nunca vem do cliente.

Os anexos só sobem **no envio do formulário** — quem desiste no meio não deixa arquivo
órfão no storage.

---

## E2E

`npx tsx scripts/e2e-campanhas-secretaria.mjs` — 69 checagens, cobrindo o caminho
completo (criar → anexar por filtro → preencher → reprovar → corrigir → aprovar → conferir
o cadastro) e as travas. Roda contra o banco real criando os próprios dados com prefixo
`[E2E]` e limpando no fim; `--keep` preserva.

Duas armadilhas que já morderam e estão resolvidas no script:
- `SELECT * FROM members` falha no Prisma por causa da coluna `tsvector` — selecione as
  colunas explicitamente.
- CPF fixo de exemplo já pertence a cadastro real (coluna única) — o script sorteia e
  confere antes de usar.
