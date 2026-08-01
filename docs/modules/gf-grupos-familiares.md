# GF (Grupos Familiares)

Módulo reescrito em 2026-08-01. Rota: `/app-ui/cells`.
Permissões: `cells` e `cell_group_members` (grupo **GF (Grupos Familiares)**).

O GF é o grupo que se reúne na casa de alguém. O módulo existe para responder três
perguntas que a consolidação faz toda semana:

1. Quem já está em um grupo?
2. **Quem ainda não está** — e por quê?
3. O líder sabe quem vai chegar, e o que já foi conversado com essa pessoa?

A terceira é a que muda o resultado: encaminhar alguém sem contexto faz o líder começar
do zero uma conversa que a igreja já teve.

---

## Ciclo completo

```
cadastrar GF (líder, CEP/mapa, cor, imagem)
        │
        ├──► anexar pessoa do CADASTRO ────┐
        │                                   ├──► trava: um GF ativo por pessoa
        └──► anexar contato de IMPORTAÇÃO ─┘              │
                                                          ▼
                                      tag do GF entra no perfil do membro
                                                          │
                                                          ▼
                             líder recebe no WhatsApp: síntese da IA + link público
                                                          │
                                                          ▼
                                   /gf-resumo/<token> — sem login, só o token
```

Em paralelo, na tela de Envio em Massa: **Parecer PDF** dos contatos selecionados.

---

## Banco de dados

Migration: `supabase/migrations/20260801_gf_module.sql` — **aplicada** em 2026-08-01.
Aditiva, exceto por uma troca de índice descrita abaixo.

### `cell_groups` (Prisma)
Ganhou o endereço estruturado, no mesmo formato de `members` — sem os campos separados o
`LocationPicker` não tem onde gravar e a distância até o membro não sai:

`address_street`, `address_number`, `address_complement`, `address_neighborhood`,
`address_city`, `address_state`, `address_zipcode`.

`address` (texto livre) continua existindo e passa a guardar o **rótulo montado**
(`buildAddressLabel`), porque telas antigas leem esse campo direto.

> `color` e `photo` estavam no `schema.prisma` desde sempre mas **nunca existiram no
> banco** — o formulário antigo enviava os dois e a rota descartava, então ninguém viu.
> A migration criou as colunas. Ao mexer em `cell_groups`, confira o banco de verdade
> antes de confiar no schema.

### `cell_group_members` — troca de índice
A constraint `UNIQUE (cell_group_id, member_id, is_active)` virou índice parcial:

```sql
CREATE UNIQUE INDEX cell_group_members_active_unique
  ON cell_group_members (cell_group_id, member_id) WHERE is_active;
```

**Por quê:** no Postgres o `false` também é valor, então a versão antiga permitia apenas
UMA saída do mesmo GF. Quem saísse, voltasse e saísse de novo batia em violação de
unicidade. O Prisma não declara índice parcial, então o `@@unique` saiu do
`schema.prisma` e **só o banco garante a regra** — não reintroduza o `@@unique`.

### `member_tags` — tag ligada ao GF
Ganhou `cell_group_id` (FK com `ON DELETE CASCADE`). Tag criada junto com o GF morre com
ele; tag avulsa da secretaria fica com `cell_group_id` nulo e sobrevive.

As tabelas `member_tags` / `member_tag_assignments` já existiam no Prisma e nunca tinham
sido usadas em tela nenhuma — este módulo é o primeiro consumidor.

### `whatsapp_import_rows` — vínculo com o GF
`cell_group_id`, `cell_group_assigned_at`, `cell_group_assigned_by`.

É o que impede o mesmo contato de entrar em dois GFs e o que permite o filtro
**"quem ainda está sem GF"** (`cell_group_id IS NULL`).

### `cell_group_share_links` (nova, Supabase)
Um registro por pessoa anexada. `token` (uuid aleatório) é a **única** chave de acesso ao
resumo público.

Colunas: `cell_group_id`, `member_id`, `import_row_id`, `contact_name`, `contact_phone`,
`created_by`.

---

## Duas origens, uma lista

Uma pessoa chega ao GF por dois caminhos, e a diferença é onde mora a trava:

| Origem | Onde fica o vínculo | Trava de GF único |
|---|---|---|
| Membro do cadastro | `cell_group_members` (`is_active`) | índice parcial + checagem na rota |
| Contato de lista importada | `whatsapp_import_rows.cell_group_id` | checagem na rota |

Na tela isso aparece como **uma lista só** ("Pessoas do GF"), com a origem virando
etiqueta. Duas seções separadas davam a impressão de que nada tinha sido anexado quando
só havia contatos importados.

A trava é **regra de aplicação**, não de schema: `409` quando a pessoa já está em outro
grupo, e a transferência só acontece com `force: true` — decisão explícita de quem está
na tela, com a saída registrada no histórico (`left_at`).

---

## Tags no perfil

`ensureCellGroupTag()` cria a tag sob demanda, com o nome `GF <nome do grupo>` e a cor do
próprio GF. Ela entra no perfil de quem participa (`MemberProfile`, badge colorido) e sai
quando a pessoa é desanexada ou transferida.

Se a secretaria já tinha criado à mão uma tag com esse nome, o módulo **adota** a
existente em vez de estourar erro de duplicidade (`UNIQUE (church_id, name)`).

---

## Aviso ao líder e resumo público

Ao anexar alguém, `notifyLeaderOfNewContact()` (`src/lib/cellGroupNotify.ts`):

1. cria o registro em `cell_group_share_links`;
2. monta o parecer com `buildGfContactReport()`;
3. envia ao WhatsApp do líder: nome, telefone, **síntese da IA**, pontos positivos, aviso
   de "ainda não respondeu" e o link do resumo completo.

**Falha de envio não derruba a anexação.** A pessoa já entrou no GF; refazer o vínculo só
porque o WhatsApp caiu deixaria o cadastro inconsistente. O erro é logado.

### O link nunca sai como localhost
Quem recebe é uma pessoa de verdade, e `localhost` não abre no celular dela:

| Origem da anexação | Link gerado |
|---|---|
| `npm run dev` (localhost) | `NEXT_PUBLIC_APP_URL` (domínio público) |
| Preview da Vercel | o próprio domínio do preview |
| Produção | domínio público |

### Página pública
`/gf-resumo/:token` — sem autenticação, tema claro forçado (mesmo motivo do formulário de
campanha: no modo escuro o navegador reescreve as cores dos campos nativos). Mostra só
**aquele** contato: nada de listar o GF inteiro nem o cadastro da igreja.

---

## Parecer de consolidação em PDF

Na aba de Envio em Massa (Gestão Pastoral), botão **Parecer PDF** — vale para qualquer
Fonte (Membros, Pipeline ou Listas importadas), porque o que amarra o parecer é o
**telefone**: é por ele que se acha a conversa. A origem só diz em que GF a pessoa está.

O PDF traz, por contato: situação no GF, síntese da conversa, pontos positivos e
negativos, contagem de tentativas sem resposta, links enviados, se o endereço da igreja
já foi mandado, o que poderia melhorar e o motivo provável de não estar em GF.

Decisões que valem registrar:

- **O resumo é gerado sob demanda**, na hora do export — não há cache. Cada contato é uma
  chamada de IA, então a rota processa em série e tem **teto de 40 contatos**; acima disso
  estoura o timeout da plataforma.
- **A conversa só é lida nas instâncias que o usuário enxerga**
  (`getAccessibleInstanceIds`). Sem isso bastaria mandar um telefone qualquer para ler o
  atendimento de outra igreja.
- **Reações do WhatsApp não entram no relatório.** `whatsapp_messages` não guarda reações
  — não existe coluna nem uso de `metadata` para isso. Preferimos omitir a inventar dado.
- **"Links enviados"** sai de regex de URL nas mensagens `outbound`; link de mapa também
  serve como prova de que o endereço foi enviado.

---

## Arquivos

**Serviços** — `src/lib/cellGroupService.ts` (regras e tags), `cellGroupNotify.ts` (aviso
ao líder e URL pública), `gfContactReportService.ts` (fatos da conversa + parecer da IA),
`pdfGenerator.ts` (`generateGfContactReportPdf`).

**Telas** — `src/components/app-ui/CellGroups.tsx` (tabela + modal de cadastro/edição),
`CellDetail.tsx`, `CellEdit.tsx`, `CellNew.tsx`, `cells/CellForm.tsx` (formulário
compartilhado), `cells/AttachMemberModal.tsx`, `src/components/public/GfResumoPublic.tsx`.

**API** — `/api/cell-groups` (GET, POST), `/api/cell-groups/[id]` (GET, PATCH, DELETE),
`/api/cell-groups/[id]/members` (POST, DELETE), `/api/cell-groups/[id]/contacts` (GET),
`/api/member-tags` (GET, POST) e `/api/member-tags/[id]` (PATCH, DELETE),
`/api/whatsapp/imports/report` (POST — o PDF),
`/api/public/gf-resumo/[token]` (GET, **sem auth**).

**Reaproveitados, não reescritos** — `LocationPicker` + `src/lib/geo.ts` (ViaCEP,
Nominatim e Google Maps por URL pública, **sem chave de API**), `quickSendWhatsApp`,
`generateAiText` / `loadConversationHistory`, `ConfirmDialog` / `AlertDialog`, jsPDF.

---

## Regras que não podem ser violadas

1. **Uma pessoa, um GF ativo.** Vale para membro e para contato importado. Transferir
   exige `force: true` e registra a saída — o histórico é o que permite dizer "fulano
   ficou 6 meses no GF X".
2. **Excluir GF libera as pessoas.** Vínculos são desativados, contatos importados voltam
   a `cell_group_id NULL` e a tag some do perfil. Sem isso elas ficariam presas a um grupo
   inexistente e a trava barraria o próximo encaminhamento.
3. **Falha de WhatsApp não desfaz anexação.** Ver acima.
4. **O token é a única credencial do resumo público.** A rota devolve apenas o contato
   daquele token.
5. **Link enviado a pessoa real nunca aponta para localhost.**
6. **O parecer só lê conversa de instância visível ao usuário.**
7. **Não reintroduzir `@@unique([cellGroupId, memberId, isActive])`** no `schema.prisma`.

---

## O que ainda não existe

- **Relatório de reunião.** Existia a tela "Relatórios de GF" lendo `cell_meetings`, mas
  nada no sistema inteiro gravava nessa tabela — só havia `GET /api/cell-reports`. A tela,
  a rota, o item de menu e a chave de permissão `cell_reports` foram **removidos** em
  2026-08-01. Para o módulo ter relatório de reunião de verdade falta o fluxo do líder
  registrar presença, visitantes e oferta.
- **Checagem de permissão no servidor.** Hoje `cells` e `cell_group_members` escondem os
  botões na interface, que resolve o dia a dia — mas as rotas não recusam a chamada. É o
  mesmo padrão das outras telas do sistema.
- **Gestão de tags em tela.** As rotas `/api/member-tags` existem e funcionam; não há UI.

---

## E2E

`npx tsx scripts/e2e-gf.mjs` — 42 checagens cobrindo: cadastro com endereço e
coordenadas, criação e reuso da tag, anexação de membro e de contato importado, bloqueio
de duplicidade, transferência com `force`, filtro "sem GF", geração do link público, as
três regras de domínio do link, os fatos da conversa (tentativas sem resposta, links
enviados) e o desanexar.

Roda contra o banco real criando os próprios dados com prefixo `[E2E]` e limpando no fim;
`--keep` preserva. A parte de IA **não** é exercitada (depende de chave e crédito) — o que
se testa é o cálculo dos fatos.

Armadilha já resolvida no script: `whatsapp_conversations.owner_user_id` é `NOT NULL` sem
default.
