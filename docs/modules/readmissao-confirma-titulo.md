# Readmissão — a secretaria confirma o título de retorno

Data: 29/08/2026 · Módulo: Secretaria › Ocorrência Rápida e Requerimentos

Continuação de [readmissao-restaura-titulo.md](./readmissao-restaura-titulo.md).
Aquela correção fez o sistema **deduzir** o título de retorno a partir do
histórico. Esta faz a **secretaria confirmar** qual é.

## O problema

A dedução automática errou em produção. Casos reportados em 29/08/2026:

| Membro | ROL | O que o histórico mostra | Ficou como |
|---|---|---|---|
| JOSE ANTONIO RIBEIRO | 21843 | PRESBÍTERO → DIACONO (17/02/2026) | DIACONO |
| ROBSON SOUZA DE JESUS ARRUDA | 32093 | PRESBITERO → MEMBRO (09/01/2022) | CONGREGADO |
| ALEXANDRE DE OLIVEIRA SILVA | 16478 | PRESBITERO (2016), EVANGELISTA (2017) | MEMBRO |

A causa não é um bug de uma linha: o histórico legado não sustenta uma dedução
automática. `member_title_history` grava o título real ora em `previous_title`,
ora em `new_title` (10.419 linhas com o literal `"SIM"` no lugar do título),
com datas empatadas na mesma linha e lançamentos fora de ordem cronológica. O
"último título" calculado sobre essa base às vezes é o título *de saída*, às
vezes é o *de entrada* — e o membro volta rebaixado.

Além disso, a ocorrência rápida mostrava a ação da matriz como
`Título → CONGREGADO` (o valor de reserva da regra), o que dava a entender que o
título fixo seria aplicado.

## A solução

O título de retorno virou **decisão humana registrada**, não dedução.

Ao escolher um serviço de readmissão — na Ocorrência Rápida do perfil do membro
ou na abertura do Requerimento — abre um modal com o **histórico de títulos
eclesiásticos daquela pessoa**. A secretaria olha e confirma para qual título
ela volta. Só depois disso a operação é aceita.

- **Ocorrência rápida:** o título confirmado é aplicado na hora, junto com as
  demais ações da matriz.
- **Requerimento (kanban):** o título confirmado fica gravado no card, em
  `kan_cards.intended_title`. Quando o card é movido para a coluna que troca o
  título, é esse valor que a matriz aplica — sem recalcular nada.

### Ordem de precedência do título

Em `resolverTituloDaRegra` (`src/lib/tituloEclesiasticoHistorico.ts`):

1. **`restore_previous_title` ligado** — a regra diz que o título vem do passado
   do membro. Só aí vale o **título confirmado** pela secretaria; ele só entra
   se casar com o catálogo (`ecclesiastical_titles`), ignorando acento e caixa,
   e texto solto é recusado, para não gravar lixo no cadastro. Sem confirmação,
   cai no último título do histórico — o caminho de quem não passa pela tela.
2. **`new_title`** — o título fixo da regra.

O título confirmado **não** atropela uma regra de título fixo. Isso importa na
coluna "Readmissão cancelada" do READMEM, que grava CONGREGADO fixo
(`change_title = true`, `restore_previous_title = false`): o título confirmado
para o caso de aprovação não pode vazar para o cancelamento.

Por consequência, a confirmação só é **exigida** (nas telas e na API) quando o
serviço tem alguma regra ativa com `change_title` **e** `restore_previous_title`.
Estado medido no banco em 29/08/2026 — as três readmissões têm essa regra na
coluna 2 ("Aprovado"):

| Serviço | Col. | `change_status` | `change_title` | `restore_previous_title` | `new_title` |
|---|---|---|---|---|---|
| READMEM (19) | 2 | Ativo | sim | **sim** | MEMBRO |
| READMEM (19) | 3 | Aguardando Ativação | sim | não | CONGREGADO |
| READOBR (20) | 2 | Ativo | sim | **sim** | CONGREGADO |
| READOMN (21) | 2 | Ativo | sim | **sim** | CONGREGADO |

### Os grupos de título vêm do NÍVEL do catálogo

O serviço define o recorte de títulos que a tela sugere:

| Serviço | Recorte | `level` | Títulos |
|---|---|---|---|
| READMEM | Membros | 0–1 | CONGREGADO, MEMBRO, COOPERADOR, COOPERADORA |
| READOBR | Obreiros | 2–3 | DIACONO, DIACONISA, PRESBITERO |
| READOMN | Ministros | ≥ 4 | EVANGELISTA, MISSIONARIA, MISSIONARIO, PASTOR, PASTORA, BISPO |

O nível é usado — e não `is_ecclesiastical_minister`, `allow_men` ou
`allow_women` — porque essas colunas estão inconsistentes na base: PASTOR tem
`is_ecclesiastical_minister = false` e `allow_men = false`; MISSIONARIA tem
`allow_men = true`. O `level` é o único campo coerente com a hierarquia
(seed em `prisma/migrations/20260430214500_ecclesiastical_titles_and_member_defaults`).

**O recorte só ordena as sugestões do catálogo. Nenhum título do histórico do
membro é escondido.** Se a pessoa foi PASTOR e abrem uma readmissão de obreiro,
PASTOR aparece na lista, marcado como "fora do grupo do serviço" — esconder o
que de fato aconteceu é o que produziu os erros acima.

O modal também avisa quando o título escolhido é **menor** que o maior que a
pessoa já teve ("Esta pessoa já foi PASTOR..."), mas não bloqueia: rebaixamento
é uma decisão legítima da secretaria, desde que consciente.

## O que passou a ser recusado

| Caminho | Recusa | Código do erro |
|---|---|---|
| `POST /api/members/[id]/occurrences` | readmissão cuja regra restaura o título, sem `confirmedTitle` | `TITULO_READMISSAO_NAO_CONFIRMADO` |
| `POST /api/kan/cards` | readmissão com regra que restaura o título, sem `intendedTitle` | `TITULO_READMISSAO_NAO_CONFIRMADO` |
| `POST /api/kan/cards` | `intendedTitle` que não existe no catálogo | `TITULO_READMISSAO_INVALIDO` |

Isso vale para **qualquer cliente**, não só a tela web — inclusive o app. Um
cliente que abra readmissão sem confirmar o título recebe 400 em vez de aplicar
um título deduzido errado.

Cards de readmissão **já abertos** antes desta mudança não têm
`intended_title`: ao serem movidos, caem no comportamento anterior
(`restore_previous_title` → último do histórico). Nada quebra; apenas não têm a
confirmação.

## Rastro deixado

`member_title_history.source` distingue de onde veio o título:

| `source` | Significa |
|---|---|
| `OCORRENCIA_RAPIDA_CONFIRMADO` / `MATRIZ_CONFIRMADO` | confirmado pela secretaria |
| `OCORRENCIA_RAPIDA_RESTAURADO` / `MATRIZ_RESTAURADO` | deduzido do histórico |
| `OCORRENCIA_RAPIDA` / `MATRIZ` | título fixo da regra |

A observação do registro diz explicitamente
*"Título confirmado pela secretaria na readmissão: PRESBITERO"*, e a ocorrência
rápida guarda `confirmedTitle` no `metadata`.

## Onde está o código

| Arquivo | Papel |
|---|---|
| `src/lib/readmissaoTitulo.ts` | o que é readmissão, recorte por nível, rótulos |
| `src/lib/tituloEclesiasticoHistorico.ts` | histórico de títulos, normalização contra o catálogo, precedência |
| `src/app/api/members/[id]/readmission-titles/route.ts` | dados do modal (histórico + sugestão + catálogo recortado) |
| `src/components/ecclesiastical/ConfirmarTituloReadmissao.tsx` | o modal, compartilhado pelas duas telas |
| `src/components/app-ui/MemberProfile.tsx` | Ocorrência Rápida |
| `src/app-ui/ecclesiastical/Requerimentos.tsx` | abertura do Requerimento |
| `src/app/api/members/[id]/occurrences/route.ts` | aplica na hora |
| `src/app/api/kan/cards/route.ts` | grava em `intended_title` |
| `src/lib/kanMatrix.ts` | aplica ao mover o card |

## Tela de Serviços e Ocorrências: contadores em 0

Enquanto isto era testado, a lista de serviços e a Matriz de Decisão apareciam
zeradas por dezenas de segundos. **Não era perda de dado** — conferido no banco
em 29/08/2026: `kan_matrix_rules` tem 119 regras, todas com `is_active = true`,
distribuídas nos 33 serviços. O log do servidor mostrava a API achando as
regras normalmente (`encontradas: 3`, `5`, `4`...).

Era latência: a tela disparava **uma requisição por serviço** a
`/api/kan/services/:id/rules` — 33 chamadas de ~3 s cada — só para montar os
contadores, e até todas voltarem tudo aparecia como 0.

`/api/kan/services` já devolve `rules` e `stages.columns` de todos os serviços
numa única resposta. A estrutura passou a ser derivada dali com `useMemo`
(`src/app-ui/ecclesiastical/ServicesMatrix.tsx`), e as 33 requisições extras
deixaram de existir.

## Banco de dados

**Nenhuma mudança de schema.** O título confirmado é guardado em
`kan_cards.intended_title`, coluna que já existia (`VARCHAR(60)`). Não há
migration nova, nada a regerar no baseline e nada a propagar para as bases das
igrejas.
