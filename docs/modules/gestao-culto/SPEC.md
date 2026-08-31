# Gestão de Culto — Especificação Técnica

Status: aprovado para implementação · Data: 27/08/2026
PRD: [PRD.md](PRD.md) · Plano: [PLANO-DESENVOLVIMENTO.md](PLANO-DESENVOLVIMENTO.md)

---

## 0. Realidade do sistema (medida, não suposta)

Tudo abaixo foi apurado em 27/08/2026 no banco de produção e no código, não
assumido. É o que sustenta as decisões da seção 1.

### 0.1 Hierarquia de igrejas

O modelo hospedeira/anexa **já existe** em `prisma/schema.prisma:150-160`:

```prisma
/// Igreja central da regional que recebe as demais como anexas.
isHost       Boolean @default(false) @map("is_host")
/// Zona geográfica (Zona Leste, Zona Sul, ...), usada em filtro e relatório.
zone         String? @db.VarChar(60)
/// Preenchido nas anexas, apontando para a hospedeira.
hostChurchId String? @map("host_church_id") @db.Uuid
```

Mas está **quase vazio** — as igrejas estão *preparadas* para serem organizadas
por hospedeira, e a organização ainda não foi feita:

| Medição | Valor |
|---|---|
| Igrejas ativas | 126 |
| `is_host = true` | **1** (AD Campinas - SEDE) |
| `host_church_id` preenchido | **3** (JD São Pedro I, JD São Fernando, Barão Geraldo) |
| Sem hospedeira e não hospedeira | **122** |
| `zone` preenchido | 1 |
| Regionais ativas | 25 (maiores: Regional 05, Regional 10, Curitiba, com 10-11 igrejas) |
| Campo | 1 (`Campinas`) |

### 0.2 Usuários e funções

| Medição | Valor |
|---|---|
| `profile_type = church` | 262 |
| `profile_type = campo` | 18 |
| `profile_type = master` | 2 |
| `profile_type = admin` | 1 |
| Usuários com `church_id` | 214 |
| Role `tesoureiro` | 100 usuários |
| Role `secretario` | 74 usuários |
| Role `camposec` / `campotes` | 12 / 2 |
| **Role de dirigente** | **não existe** |
| `churches.lead_pastor_id` preenchido | **0 de 126** |
| `churches.current_leader_name` preenchido | 85 (texto livre, sem FK) |

Distribuição de usuários por igreja:

| Usuários na igreja | Igrejas |
|---|---|
| 0 | 30 |
| 1 | 35 |
| 2 | 41 |
| 3 | 18 |
| 7 | 1 |
| 36 | 1 (a sede) |

### 0.3 O que já existe de dado de culto

- `livro_caixa` — contábil, 4.340 lançamentos em 82 igrejas nos últimos 60 dias.
- `church_presence_tickets` — 3 registros, todos de 23/06/2026. Praticamente sem uso.
- Nenhuma tabela com `culto` no nome:
  `SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%culto%'` → **0 linhas**.

### 0.4 Isolamento

RLS está **desligado** nas tabelas de negócio (`pg_class.relrowsecurity = false`
em `churches`, `users`, `members`, `livro_caixa`). O isolamento é feito na
aplicação, por `withAuth` (`src/lib/auth.ts:110`) mais filtro de escopo por
campo/igreja. Padrão canônico: `src/app/api/presence-tickets/route.ts:17-56`.

`src/lib/auth.ts:39` já tem `isRestrictedToOwnChurch`, que trava em `church_id`
quem tem `profile_type = church` **ou** role cujo nome contém `secret`/`tesour`.

---

## 1. Decisões

### D1 — Nenhum perfil novo; posições anexam usuários existentes

O pedido dizia "acho que não vai ser preciso criar perfil". Confirmado: as roles
`tesoureiro` (100 usuários) e `secretario` (74) já existem e já estão atribuídas.
Criar `profile_type` novo obrigaria a reclassificar 262 usuários e mexeria no
`resolvePermission` (`src/lib/resolvePermission.ts`), que trata role como
whitelist — risco alto em produção por ganho zero.

Mas **role não basta**: role diz o *ofício*, não *em qual igreja e em qual papel
deste fluxo*. E o dirigente simplesmente não existe como usuário hoje
(`lead_pastor_id` = 0 em 126 igrejas). Daí a tabela nova `culto_posicoes`, que é
exatamente o "procuro a pessoa e anexo na posição" do pedido.

`church_function_history` **não serve**: ela anexa `member_id`, não `user_id`
(`prisma/schema.prisma:279-281`). Quem envia e quem aprova precisa **logar**, e
membro não loga.

### D2 — Financeiro e Presença são SEMPRE exigidos

**Revisada em 27/08/2026.** A primeira versão derivava a obrigatoriedade das
posições anexadas, para não travar as igrejas pequenas (30 igrejas têm 0
usuários, 35 têm 1, 41 têm 2).

Na tela o efeito colateral ficou evidente: igreja com só o tesoureiro anexado
fechava o culto com um bloco só e aparecia **"Concluído" exibindo apenas o
ícone de tesouraria** — sem ninguém ter contado a presença. Um fechamento de
culto sem contagem de gente não é fechamento.

Regra atual: `FINANCEIRO` e `PRESENCA` são sempre exigidos. `EXTRA` continua
opcional — só é cobrado se houver alguém anexado àquele papel.

**O preço, conhecido e aceito:** igreja sem secretário anexado fica travada em
"Aguardando envio" até alguém assumir o papel `PRESENCA`. O e2e trava esse
comportamento numa asserção, para ninguém "consertar" isso por engano.

Na interface, os dois ícones aparecem **sempre**: cinza quando falta, verde
quando chegou. Mostrar só os blocos "exigidos" era o que escondia a ausência.

### D3 — Nível hospedeira é opcional, com fallback para a Regional

122 das 126 igrejas ainda não têm hospedeira. Se o rollup exigisse hospedeira, o
painel do presidente nasceria mostrando 4 igrejas de 126.

Agrupamento no painel do presidente:

1. `host_church_id` preenchido → agrupa sob a hospedeira.
2. `is_host = true` → é ela mesma o grupo.
3. Nenhum dos dois → agrupa sob a **Regional** (grupo do tipo `REGIONAL`).

E na máquina de estados: sem hospedeira, `APROVADO_LOCAL` é terminal e vira
`CONCLUIDO` direto. À medida que o cadastro de hospedeiras for preenchido, as
igrejas migram de grupo sozinhas — nenhuma migração de dado é necessária. Isso
é requisito, não paliativo: a organização por hospedeiras vai acontecer aos
poucos e o painel tem que funcionar durante toda a transição.

### D4 — Não encosta no Livro Caixa

O bloco financeiro do culto é **controle gerencial pós-culto**, não lançamento
contábil. Gravar em `livro_caixa` duplicaria receita já lançada pelo tesoureiro
e sujaria 331 mil linhas de histórico contábil. As duas coisas convivem; a
conciliação entre elas fica para a etapa de relatórios.

### D5 — Colunas tipadas, não JSON

Os blocos guardam números que vão virar relatório e soma por período. Ficam como
colunas nomeadas em `culto_lancamentos`, anuláveis, preenchidas conforme o
`bloco` da linha. Um `payload JSONB` impediria `SUM()` e índice.

### D6 — Isolamento na aplicação, como no resto do sistema

Nada de RLS só neste módulo (ver 0.4). O escopo é resolvido em
`src/lib/cultoScope.ts` e aplicado em toda rota via `withAuth`.

---

## 2. Modelo de dados

Quatro tabelas novas. Migration **aditiva**: só `CREATE TABLE`, não altera
nenhuma tabela existente.

### 2.1 `culto_posicoes` — quem ocupa qual papel

```sql
CREATE TABLE culto_posicoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campo_id    UUID     NOT NULL REFERENCES campos(id)  ON DELETE CASCADE,
  church_id   UUID              REFERENCES churches(id) ON DELETE CASCADE, -- NULL só para PRESIDENTE
  user_id     UUID     NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  -- FINANCEIRO | PRESENCA | EXTRA | APROVADOR_LOCAL | APROVADOR_HOSPEDEIRA | PRESIDENTE
  papel       VARCHAR(30) NOT NULL,
  titulo      VARCHAR(120),        -- rótulo livre: "Tesoureiro", "Dirigente", "Contador de presença"
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  created_by  UUID REFERENCES users(id)
);
```

- **Mais de uma pessoa no mesmo papel é permitido** — é o "pode ter outra pessoa
  do mesmo nível do dirigente que pode aprovar" do pedido. Basta uma delas aprovar.
- `PRESIDENTE` tem `church_id = NULL` e vale para o campo inteiro.
- `APROVADOR_HOSPEDEIRA` é cadastrado **na igreja hospedeira** e alcança as filhas.

### 2.2 `culto_registros` — o culto de uma igreja

```sql
CREATE TABLE culto_registros (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campo_id       UUID NOT NULL REFERENCES campos(id)   ON DELETE CASCADE,
  regional_id    UUID          REFERENCES regionais(id),
  church_id      UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  host_church_id UUID          REFERENCES churches(id),  -- congelado na abertura
  data_culto     DATE NOT NULL,
  -- Período do culto. Sem hora não dá para consolidar por faixa de horário nem
  -- separar o culto da manhã do da noite. NULL nos registros anteriores à
  -- coluna: carimbar horário inventado seria fabricar informação.
  hora_inicio    TIME,
  hora_fim       TIME,
  tipo_culto     VARCHAR(60) NOT NULL DEFAULT 'CULTO',
  -- ABERTO | AGUARDANDO_LOCAL | APROVADO_LOCAL | CONCLUIDO | REJEITADO
  status         VARCHAR(30) NOT NULL DEFAULT 'ABERTO',
  observacao     TEXT,
  -- A palavra do Pastor Presidente. Fica no registro, e não numa aprovação,
  -- porque ele não é nível de aprovação (só existem LOCAL e HOSPEDEIRA) — ele
  -- comenta o culto, aprovado ou não, e é o parecer que fecha o relatório.
  observacao_presidente TEXT,
  concluido_em   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  created_by     UUID REFERENCES users(id)
);
```

Único por `(church_id, data_culto, tipo_culto, COALESCE(hora_inicio,'00:00'))`
entre os não deletados. A hora entrou na chave porque, sem ela, o culto da
manhã e o da noite do mesmo domingo com o mesmo tipo colidiam — só dava para
registrar um dos dois.

Filtros: `hora_de` / `hora_ate` na listagem. Cultos sem hora ficam de fora
quando a faixa é usada; não dá para afirmar que um culto sem horário informado
aconteceu às 19h.

`host_church_id` é **congelado na abertura**: quando a igreja for anexada a uma
hospedeira (ou trocar de hospedeira), o histórico do culto de hoje continua
contando para a hospedeira certa. Mesmo princípio já usado em
`church_leader_history.distance_km` (`prisma/schema.prisma:348-350`).

### 2.3 `culto_lancamentos` — um por bloco

```sql
CREATE TABLE culto_lancamentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id  UUID NOT NULL REFERENCES culto_registros(id) ON DELETE CASCADE,
  bloco        VARCHAR(20) NOT NULL,      -- FINANCEIRO | PRESENCA | EXTRA
  enviado_por  UUID REFERENCES users(id),
  enviado_em   TIMESTAMPTZ,

  -- bloco FINANCEIRO
  total_dizimos  DECIMAL(15,2),
  total_ofertas  DECIMAL(15,2),
  qtd_dizimos    INT,
  qtd_ofertas    INT,

  -- bloco PRESENCA
  qtd_homens          INT,
  qtd_mulheres        INT,
  qtd_jovens          INT,
  qtd_adolescentes    INT,
  qtd_criancas        INT,
  qtd_visitantes      INT,
  qtd_conversoes      INT,
  qtd_reconciliacoes  INT,
  qtd_familias        INT,
  cadeiras_vazias     INT,

  -- bloco EXTRA
  texto      TEXT,
  anexo_url  VARCHAR(500),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Único por `(registro_id, bloco)` — um bloco por registro, que é o que o diagrama
mostra (três caixas, uma por frente). Reenvio é `UPDATE`, não linha nova, e só é
aceito enquanto o registro estiver em `ABERTO` ou `REJEITADO`.

**Colunas que saíram das telas, mas continuam no banco.** A igreja parou de
contar por faixa etária e de somar envelope de oferta, então `qtd_jovens`,
`qtd_adolescentes`, `qtd_familias` e `qtd_ofertas` sumiram do formulário, do
detalhe, do resumo e do relatório. As colunas ficam: apagá-las jogaria fora o
que já foi lançado. O formulário de presença hoje é:

| Grupo | Campos |
|---|---|
| Descrição do culto | Homens, Mulheres, Crianças |
| Detalhes do culto | Visitantes, Conversões, Reconciliações, Cadeiras vazias |

E o financeiro, nesta ordem — a contagem antes do valor, que é como se conta o
envelope: **Qtd. de dízimos**, **Valor total de dízimos**, **Valor total de
ofertas**.

### 2.4 `culto_aprovacoes` — a decisão de cada nível

```sql
CREATE TABLE culto_aprovacoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id  UUID NOT NULL REFERENCES culto_registros(id) ON DELETE CASCADE,
  nivel        VARCHAR(20) NOT NULL,   -- LOCAL | HOSPEDEIRA
  decisao      VARCHAR(20) NOT NULL,   -- APROVADO | REJEITADO
  aprovador_id UUID REFERENCES users(id),
  motivo       TEXT,                   -- obrigatório quando REJEITADO
  decidido_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Único por `(registro_id, nivel)` — uma decisão viva por nível, o `UNIQUE` faz o
upsert. O histórico de quem aprovou e quando fica no `audit_logs`, gravado
automaticamente pelo `withAuth` (`src/lib/auth.ts:170-176`).

---

### 2.5 `horario_culto` — os horários de cada igreja

```sql
CREATE TABLE horario_culto (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campo_id    UUID REFERENCES campos(id)   ON DELETE CASCADE,
  church_id   UUID REFERENCES churches(id) ON DELETE CASCADE,
  codigo      VARCHAR(60)  NOT NULL,   -- MANHA, TARDE, NOITE
  nome        VARCHAR(120) NOT NULL,   -- "Culto da manhã"
  hora_inicio VARCHAR(5),              -- "09:00"
  hora_fim    VARCHAR(5),              -- "11:00"
  descricao   TEXT,
  ordem       INTEGER NOT NULL DEFAULT 0,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  ...
);
-- unicidade POR IGREJA: duas igrejas podem ter cada uma o seu "NOITE"
CREATE UNIQUE INDEX ON horario_culto (church_id, codigo) WHERE deleted_at IS NULL;
```

É uma lista auxiliar registrada em `src/lib/lookupRegistry.ts`, mas com uma
diferença: as outras são isoladas **por campo**; esta é **por igreja**
(`churchField: "church_id"`). O horário do culto é da congregação — uma tem
três cultos, outra tem um — e uma igreja não vê nem edita o da outra.

Duas consequências no CRUD genérico:

- `igrejaDoUsuario()` prende o perfil `church` à própria igreja: mandar
  `?churchId=` de outra congregação não muda nada. Master e admin escolhem a
  igreja na tela.
- `canManage()` passou a aceitar o perfil `church` quando a lista tem
  `churchField`. A igreja mantém o próprio cadastro sem ser admin do campo.

**O cadastro não fica em Configurações.** Ele abre num modal a partir da
engrenagem ao lado do dropdown, na própria tela de lançamento
(`HorariosCultoModal.tsx`): quem lança o culto é quem sabe os horários dele, e
pôr a lista no menu de configurações obrigaria a liberar acesso administrativo
para toda igreja. O código (`CULTO_DA_MANHA`) é gerado do nome; quem cadastra
digita só nome, início e fim.

Escolher um horário no lançamento preenche Início e Fim; sem `hora_fim`
cadastrado, o Fim cai em início + 1h. Depois disso é tudo manual — o cadastro
é ponto de partida, não regra.

### 2.6 `culto_visao_bloqueada` — o cadeado do organograma

```sql
CREATE TABLE culto_visao_bloqueada (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campo_id   UUID REFERENCES campos(id),
  church_id  UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  blocos     VARCHAR(20)[] NOT NULL DEFAULT ARRAY['FINANCEIRO','PRESENCA','EXTRA'],
  motivo     TEXT,
  created_by UUID REFERENCES users(id),
  ...
);
CREATE UNIQUE INDEX ON culto_visao_bloqueada (church_id);
```

Uma linha significa: **quem dirige aquele nó não vê os valores lançados abaixo
dele**. Continua enxergando os cultos, o status, o que falta enviar e continua
aprovando; o que some são os números.

Quem tranca é o **Pastor Presidente** (e master/admin), pelo ícone de cadeado
no nó do Organograma — é quem enxerga a árvore inteira. Um dirigente de
hospedeira não consegue se destrancar (`POST /api/culto/visao-bloqueada`
recusa com 403).

A trava não é da tela: `getCultoScope` deixa de incluir os blocos daquele nó e
`podarLancamentos()` já roda em toda rota que devolve registro. Duas regras
importantes:

- **O papel de lançador não é afetado.** Quem é tesoureiro continua vendo o
  Financeiro que ele mesmo lança, mesmo com o nó trancado — o cadeado limita a
  visão *para cima*, não o próprio trabalho.
- `visaoCampo` alarga o alcance de **igrejas**, não o de blocos: quem tem o nó
  trancado continua sem os valores mesmo enxergando o campo inteiro.

Efeito na tela: um bloco enviado cujos valores foram podados aparece como
**enviado · visão limitada**, nunca como "pendente". `blocosEnviados` é
calculado **antes** da poda justamente para isso — dizer "ainda não enviado"
seria mentira, e o culto pode até já estar aprovado por causa dele.

---

## 3. Máquina de estados

| De | Evento | Para | Guarda |
|---|---|---|---|
| — | abertura do registro | `ABERTO` | — |
| `ABERTO` | último bloco exigido enviado | `AGUARDANDO_LOCAL` | todo papel lançador ativo da igreja tem linha em `culto_lancamentos` com `enviado_em` |
| `ABERTO` | bloco enviado, ainda falta outro | `ABERTO` | — |
| `AGUARDANDO_LOCAL` | `APROVADO` no nível `LOCAL` | `APROVADO_LOCAL` **ou** `CONCLUIDO` | vira `CONCLUIDO` direto quando a igreja não tem hospedeira (D3) |
| `AGUARDANDO_LOCAL` | `REJEITADO` no nível `LOCAL` | `REJEITADO` | `motivo` obrigatório |
| `APROVADO_LOCAL` | `APROVADO` no nível `HOSPEDEIRA` | `CONCLUIDO` | grava `concluido_em` |
| `APROVADO_LOCAL` | `REJEITADO` no nível `HOSPEDEIRA` | `REJEITADO` | apaga a aprovação `LOCAL` — o dirigente local reavalia |
| `REJEITADO` | bloco reenviado | `ABERTO`, e reavalia | — |
| `CONCLUIDO` | — | terminal | só `master` reabre |

**Cor**: `CONCLUIDO` = verde. Todo o resto = vermelho para quem está acima. É
literalmente o que o diagrama pede.

**Os rótulos dizem de quem se espera a decisão.** "Aguardando aprovação" não
informava se a bola estava com a congregação ou com a hospedeira, e quem cobrava
tinha de adivinhar:

| Status | Rótulo |
|---|---|
| `ABERTO` | Aguardando envio |
| `AGUARDANDO_LOCAL` | **Aguardando o dirigente da congregação** |
| `APROVADO_LOCAL` | **Aguardando o dirigente hospedeiro** |
| `CONCLUIDO` | Concluído |
| `REJEITADO` | Devolvido |

Os dois rótulos vivem em `cultoApi.ts` (front) e `cultoScope.ts` (servidor) —
mudar num só faz a tela e o relatório discordarem. A coluna do Kanban continua
se chamando "Aguardando aprovação" porque ela agrupa os dois estados; a pastilha
dentro do card diz qual é.

No detalhe do culto, uma faixa âmbar completa a informação com o **nome** de
quem decide e o que vem depois — inclusive o caso em que a igreja não é anexa de
ninguém e a aprovação local **já conclui** o culto (`temNivelHospedeira`, hoje
122 das 126 igrejas).

---

## 4. Matriz de visibilidade

Resolvida em `src/lib/cultoScope.ts`. `master`/`admin` enxergam tudo do campo.

| Papel do usuário | Registros que enxerga | Blocos que enxerga | Pode enviar | Pode aprovar |
|---|---|---|---|---|
| `FINANCEIRO` | só da própria igreja | **só FINANCEIRO** | FINANCEIRO | não |
| `PRESENCA` | só da própria igreja | **só PRESENCA** | PRESENCA | não |
| `EXTRA` | só da própria igreja | **só EXTRA** | EXTRA | não |
| `APROVADOR_LOCAL` | só da própria igreja | todos | não | nível `LOCAL` |
| `APROVADOR_HOSPEDEIRA` | própria igreja + as que têm `host_church_id` = sua igreja | todos | não | nível `HOSPEDEIRA` |
| `PRESIDENTE` | todo o campo | todos (leitura) | não | **não** — "fica só olhando no nível topo" |

O perfil `campo` do sistema dá visão do campo inteiro **apenas para quem não
tem posição no culto**. O dirigente da hospedeira alcança a hospedeira e as
filhas dela pela POSIÇÃO, não pelo perfil — inclusive com `profile_type =
church`. Se o perfil mandasse, bastaria ser `campo` para ver as 126 igrejas, e
o nível da hospedeira perderia o sentido.
| `master` / `admin` | todo o campo | todos | sim | ambos os níveis |

Um usuário pode acumular papéis (tesoureiro **e** dirigente numa igreja pequena,
o que é o caso comum: 35 igrejas têm um único usuário). A visibilidade é a
**união** dos papéis, e a permissão de aprovar também.

Blindagem: o `GET` de um registro **remove do JSON** os blocos que o usuário não
pode ver. Não é `display:none` no front — o dado não sai do servidor.

O cadeado da seção 2.6 age exatamente aqui: com o nó trancado, o
`APROVADOR_LOCAL`/`APROVADOR_HOSPEDEIRA` daquele nó sai da coluna "todos" e
passa a não ver bloco nenhum pelos papéis de aprovação — mas continua vendo o
bloco de que ele é lançador, se acumular os dois papéis.

---

## 5. API

Tudo sob `src/app/api/culto/`, tudo com `withAuth`.

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/api/culto/posicoes?church_id=` | lista posições (quem está anexado onde) |
| `POST` | `/api/culto/posicoes` | anexa usuário a papel/igreja |
| `PATCH` | `/api/culto/posicoes/[id]` | ativa/desativa, troca título |
| `DELETE` | `/api/culto/posicoes/[id]` | soft delete |
| `GET` | `/api/culto/meus-papeis` | papéis do usuário logado, para o front decidir o que renderizar |
| `GET` | `/api/culto/registros?de=&ate=&church_id=&status=` | lista já filtrada pelo escopo, com blocos podados |
| `POST` | `/api/culto/registros` | abre o registro do culto |
| `GET` | `/api/culto/registros/[id]` | detalhe com blocos permitidos + aprovações |
| `PATCH` | `/api/culto/registros/[id]` | edita data/tipo/observação (só em `ABERTO`); `observacaoPresidente` é a exceção — só o Pastor Presidente escreve, e pode escrever com o culto já fechado, que é quando ele lê o consolidado |
| `DELETE` | `/api/culto/registros/[id]` | soft delete (só `master`) |
| `PUT` | `/api/culto/registros/[id]/lancamentos` | upsert do **próprio** bloco e reavalia o status |
| `POST` | `/api/culto/registros/[id]/aprovacoes` | `{ nivel, decisao, motivo }` |
| `GET` | `/api/culto/painel?de=&ate=` | rollup hierárquico do nível do usuário |
| `GET` | `/api/culto/resumo?nivel=&id=&tipo_grupo=&de=&ate=` | consolidado de um nó e a lista do nível abaixo, com as observações de cada voz nos nós do tipo CULTO |
| `GET` | `/api/culto/visao-bloqueada` | nós com o cadeado ligado + se o usuário pode mexer |
| `POST` | `/api/culto/visao-bloqueada` | `{ churchId, bloqueado }` — só Pastor Presidente / master |
| `GET` | `/api/lookups/horarios-culto?churchId=` | horários daquela igreja (CRUD genérico, isolado por `church_id`) |

### 5.1 Formato do `/api/culto/painel`

É o card da imagem 2, montado no servidor:

```jsonc
{
  "nivel": "PRESIDENTE",              // ou HOSPEDEIRA | LOCAL
  "periodo": { "de": "2026-08-01", "ate": "2026-08-31" },
  "grupos": [
    {
      "tipo": "HOSPEDEIRA",           // ou REGIONAL (fallback D3)
      "id": "...", "nome": "AD Campinas - SEDE",
      "dirigente": "Pr. Fulano",      // nome do APROVADOR_HOSPEDEIRA ativo
      "totalIgrejas": 4,
      "concluidas": [{ "churchId": "...", "nome": "JD Sao Pedro I", "dirigente": "Pr. X" }],
      "pendentes":  [{ "churchId": "...", "nome": "Barao Geraldo", "dirigente": "Pr. W", "status": "ABERTO" }],
      "cor": "VERMELHO"               // VERDE só quando pendentes = []
    }
  ]
}
```

---

## 6. Telas

Rotas registradas em `src/spa/routes.tsx`, itens em `appNavigation`
(`src/components/app-ui/AppUI.tsx:281`). A tela de Apps
(`src/components/app-ui/AppHome.tsx:148`) monta os ícones a partir dessa mesma
lista, então o módulo aparece lá sozinho.

Seção nova no sidebar: **Gestão de Culto**.

| Sidebar | Rota | O que é |
|---|---|---|
| **Hospedeiro** | `/app-ui/culto` | 3 cards de acompanhamento: Presidente, Dirigente da Hospedeira, Dirigente da Igreja |
| **Gestão** | `/app-ui/culto/gestao` | Kanban, Tabela, Painel e Organograma |
| **Lançamentos** | `/app-ui/culto/lancar` | 2 cards: Tesoureiro e Secretário → cada um abre o modal do seu formulário |
| **Posições** | `/app-ui/culto/posicoes` | anexar usuários aos papéis |

Permissão: `culto_gestao` nas três primeiras, `culto_posicoes` na última.

**Quem lança não passa pela tela de gestão.** Os cards de Tesoureiro e
Secretário saíram do hub e viraram a tela `Lançamentos`: dois cards que abrem
direto o modal com os campos daquele bloco. O modal **abre o culto sozinho** se
o dia ainda não existir — quem lança não deveria precisar "criar o culto" antes
de digitar os números. Por isso o botão "Abrir culto" saiu da tela de gestão:
não era dela.

### 6.0 Início — um card grande por papel

Porta de entrada. Cada pessoa clica no card dela e cai direto na visão certa,
sem precisar saber o que é Kanban ou organograma:

| Card | Abre | O que a pessoa vê |
|---|---|---|
| **Pastor Presidente** | `?visao=organograma` | árvore do campo inteiro |
| **Dirigente da Hospedeira** | `?visao=tabela` | as igrejas filhas aninhadas, com a situação de cada uma |
| **Dirigente da Igreja** | `?visao=kanban` | a própria igreja e o que o tesoureiro e o secretário já enviaram |
| **Tesoureiro** | `?visao=kanban&bloco=FINANCEIRO` | Kanban com um aviso de quantos cultos esperam o lançamento dele |
| **Secretário** | `?visao=kanban&bloco=PRESENCA` | idem, para a contagem de presença |

Os cards dos papéis que a pessoa **não** ocupa aparecem apagados, dizendo
"você não está anexado a esta posição" — em vez de sumirem sem explicação.
`master`/`admin` abrem todos. Quem não tem posição nenhuma recebe a instrução
de procurar o administrador do campo.

### 6.0.1 Cada papel vê o que é dele

Não é só permissão de tela: as **visões disponíveis mudam por papel**.

| Papel | Visões |
|---|---|
| Tesoureiro / Secretário | **nenhuma visão de gestão** — cai direto em `CultoMeusLancamentos`, uma lista dos cultos do período com "falta lançar / enviado / devolvido" e o formulário |
| Dirigente da igreja | Kanban e Tabela, só a própria igreja: ele confere o que o tesoureiro e o secretário lançaram |
| Dirigente da hospedeira | Kanban, Tabela e **Organograma** — tudo daí pra baixo |
| Pastor Presidente / master | **todas**, e ele escolhe até que nível descer |

Implementado em `modosPermitidos()` (`GestaoCulto.tsx`). Se a URL pedir uma
visão que o papel não tem (`?visao=organograma` num tesoureiro), cai na
primeira permitida — o link de um card nunca leva alguém para onde não deve.

Isto é conforto de interface, não segurança: o isolamento de dados continua
sendo feito no servidor (seção 4). Esconder a aba não protege nada sozinho.

### 6.1 Gestão de Culto

Uma tela só, que se adapta ao nível de quem entrou (vem de `/api/culto/meus-papeis`).

**Filtro fixo no topo**: intervalo de datas `de`/`ate` (padrão: mês corrente),
igreja, tipo de culto, status. É o "consulta em intervalos de datas pra eu
consultar os dias de culto" do pedido.

**Modo Kanban** — colunas 1:1 com o status:

| Coluna | Status |
|---|---|
| Aguardando envio | `ABERTO` |
| Aguardando Aprovação | `AGUARDANDO_LOCAL` |
| Aprovado pelo Dirigente | `APROVADO_LOCAL` |
| Concluído | `CONCLUIDO` |
| Devolvido | `REJEITADO` |

Card = igreja + data + tipo, com uma pastilha por bloco (verde = enviado, cinza =
falta) e borda verde/vermelha.

**Modo Tabela** — aninhada nos níveis, expandindo:

```
▸ Hospedeira / Regional         concluídas 3 / 5   ●
    ▸ Igreja Filha 1            CONCLUIDO          ●
        Financeiro  R$ 1.240,00 dízimos · R$ 380,00 ofertas
        Presença    42 H · 60 M · 12 jovens · 8 cadeiras vazias
    ▸ Igreja Filha 2            ABERTO             ●
```

**Modo Painel** (para `PRESIDENTE`/`master`): a grade de cards da imagem 2.

**Modo Organograma** — árvore desenhada de cima para baixo, com caixas e
ramificações em T; cada nó abre no `[+]`:

```
                    ┌──────────┐
                    │  Campo   │
                    └────┬─────┘
          ┌──────────────┼──────────────┐
    ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐
    │Hospedeira │  │Hospedeira │  │ Regional  │
    └─────┬─────┘  └───────────┘  └───────────┘
    ┌─────┴─────┐
    │  Igreja   │  →  e abaixo os cultos do período
    └───────────┘
```

A árvore é **n-ária**, não binária: uma hospedeira chega a ter 11 filhas. Ela
cresce na horizontal conforme abre e o contêiner rola. Clicar no nome de um nó
abre o resumo consolidado dele (seção 6.3); clicar num culto abre o detalhe.

Estrutura antiga, em lista indentada:

```
[−] Campinas                         18 grupos · 116 igrejas · 11 concluídas · 105 pendentes
     [+] 01-005-016 - BAIRRO DA ROSEIRA   hospedeira   ● 2/10   dirigente Fulano
          [+] 01-005-031 - JD DAS BANDEIRAS   ● 1/1 cultos · Concluído · Sicrano
               ● 23/08/2026 · CULTO · Concluído   [Financeiro] [Presença]  R$ 1.240,00 dízimos
          [+] 01-005-026 - CAMPOS ELISEOS     ● 0/1 cultos · Aguardando aprovação
     [+] Regional 13                      regional     ● 0/4
```

As igrejas pendentes vêm primeiro dentro do grupo — é o que o presidente
precisa ver. Clicar num culto abre o mesmo detalhe das outras visões.

### 6.3 Modal de resumo — clicar mostra tudo pra baixo

Clicar num nó abre o **consolidado daquele nível** e a lista do nível
imediatamente abaixo, com trilha de navegação para descer e voltar:

```
Campo   →  hospedeiras / regionais   (clicar num grupo desce)
Grupo   →  igrejas                   (clicar numa igreja desce)
Igreja  →  cultos do período         (clicar num culto abre o detalhe)
Culto   →  gaveta com os blocos e as aprovações
```

O modal mostra, para o nó aberto: igrejas, cultos, concluídos, pendentes, o
**financeiro somado** (dízimos, ofertas e as quantidades) e a **presença
somada** (público, cada faixa, conversões, reconciliações, famílias, cadeiras
vazias). Cada linha do nível de baixo já vem com o próprio total ao lado.

**A soma respeita a matriz de visibilidade da seção 4.** Um tesoureiro que abra
o resumo recebe o financeiro consolidado e a presença vem `null` — o bloco que
ele não pode ver não entra nem na conta, e o escopo de igrejas dele também é
aplicado antes de somar. Isso é `montarResumo` em `src/lib/cultoResumo.ts`.

Onde se clica:

| Visão | O que abre o resumo |
|---|---|
| Painel | cabeçalho do card (grupo) e cada igreja listada |
| Organograma | o nome do campo, do grupo e da igreja (o `[+]` continua só expandindo) |
| Tabela | link "resumo" na linha do grupo e na linha da igreja |
| Topo da tela | botão **Resumo do campo**, para quem tem visão de campo |

Cuidado que o teste cobre: um grupo `REGIONAL` junta apenas as igrejas
**soltas** daquela regional. As que já têm hospedeira pertencem ao grupo dela —
sem esse recorte a igreja apareceria em dois grupos e o total do campo sairia
inflado. O e2e verifica que a soma dos filhos bate com o total do pai.

### 6.3.1 As cores de status não seguem o tema

`src/app/globals.css` (linhas ~225-400) tem uma camada de tema que repinta à
força **toda** classe de cor do Tailwind com a cor escolhida pelo usuário:

```css
.app-shell [class*="bg-emerald-500"], .app-shell [class*="bg-rose-500"], …
  { background-color: var(--theme-strong-bg) !important; }
```

O seletor casa por **substring da classe**, então `bg-emerald-500` e
`text-rose-700` viram a cor do tema — com tema escuro, verde e vermelho saem
pretos. Foi o que aconteceu no organograma.

Aqui verde e vermelho não são decoração, são o **estado do culto**. Por isso
`src/app-ui/culto/cultoCores.ts` define a paleta em **hex arbitrário**
(`bg-[#059669]`), que não casa com aqueles seletores. É o mesmo recurso que o
Livro Caixa já usa para receita × despesa (`LancamentoNew.tsx:1658`).

| Tom | Quando |
|---|---|
| cinza | `ABERTO` |
| âmbar | `AGUARDANDO_LOCAL` e devoluções |
| azul | `APROVADO_LOCAL` |
| verde | `CONCLUIDO` |
| vermelho | `REJEITADO` e qualquer pendência no semáforo do rollup |

Regra: **status usa `cultoCores.ts`; o resto segue o tema.** Botão de ação
(Enviar, Aprovar) continua com a cor do tema, de propósito.

### 6.3.2 Organograma com zoom e deslocamento

A árvore fica numa tela fixa de 70vh que funciona como o editor do n8n:

- **arrastar o fundo** move a árvore (clique em botão ou caixa continua normal);
- **roda do mouse** dá zoom **no ponto do cursor**, entre 25% e 200%, para o nó
  que você está olhando não fugir da tela;
- botões de aproximar, afastar e **reenquadrar** no canto superior direito.

Com 18 grupos e até 11 filhas cada, a árvore fica maior que qualquer monitor —
sem zoom e arrasto ela seria inútil aberta.

### 6.3.3 Cabeçalho em uma linha só

Tudo numa faixa: voltar, título, papéis, seletor de visão, resumo, período,
tipo e atualizar. Sem parágrafo de apresentação e sem uma segunda linha só para
as datas. Os rótulos dos botões somem abaixo de `xl` e o campo de tipo abaixo de
`md`, restando os ícones — em tela estreita a faixa quebra sozinha.

### 6.3.4 Relatório impresso — colunas escolhidas, paisagem, detalhe

`CultoImprimirModal.tsx` + `cultoRelatorio.ts`. Imprime **exatamente os cultos
que o filtro da tela deixou na lista** — sem segunda consulta, que poderia
divergir do que está na frente do usuário.

- **Colunas por checkbox**, agrupadas em Culto / Financeiro / Presença /
  Observações. A ordem no papel é a do cadastro das colunas, não a dos cliques.
- **Orientação** retrato ou paisagem. O `@page { size: A4 landscape }` fica
  **fora** de `@media print`: dentro do bloco o Chrome ignora o `size` e imprime
  tudo em retrato.
- **"Mostrar detalhes"** agrupa por hospedeira/regional e abre, sob cada culto,
  o que falta enviar, quem já enviou (com data) e a decisão de cada nível com o
  motivo — o organograma no papel.
- **Cor só na coluna Situação**: verde negrito quando concluiu, vermelho quando
  ainda falta enviar. A linha inteira colorida virava parede e nada se
  destacava.
- A janela **se fecha sozinha** depois de imprimir ou cancelar
  (`onafterprint` + fecho tardio para quem não dispara o evento).

As cinco vozes do culto saem em colunas próprias: tesoureiro, secretário,
dirigente da congregação, dirigente hospedeiro e Pastor Presidente. Cada uma
vem de um lugar diferente do banco (`culto_lancamentos.observacao`,
`culto_aprovacoes.motivo`, `culto_registros.observacao_presidente`).

### 6.3.5 O quadro se atualiza sozinho

O culto é acompanhado a várias mãos: o tesoureiro lança de um lugar, o
secretário de outro, o dirigente aprova de um terceiro. A Gestão de Culto
recarrega **a cada 20s**, em silêncio (sem acender o "carregando", senão o
quadro pisca), e imediatamente quando a aba volta ao foco. Com a aba escondida
o relógio para.

Uma pastilha na barra mostra a hora da última atualização e desliga a recarga
com um clique — ao conferir número a número, a lista pulando debaixo do dedo
atrapalha.

É polling, não WebSocket: o Realtime do Supabase (usado no WhatsApp) exigiria
publicar `culto_registros`/`culto_lancamentos` e resolver RLS para o cliente do
navegador. 20s resolve o caso de uso sem essa dependência.

### 6.3.6 Quem não abriu culto também aparece

O quadro mostrava só o que existe: igreja que não lançou nada não tem registro
e não aparecia em coluna nenhuma — justo a que o hospedeiro precisa cobrar.

Agora a coluna "Aguardando envio" recebe, depois dos cultos abertos, um card de
**borda tracejada** para cada igreja do alcance com `status = SEM_REGISTRO` no
`/api/culto/painel`, com o nome do dirigente e a hospedeira/regional a que ela
pertence. A Tabela faz o mesmo no fim de cada grupo, e tem um bloco "Sem nenhum
culto no período" para o caso de um grupo inteiro estar zerado (ele não
apareceria, porque a tabela é montada a partir dos registros).

O recorte é o **período consultado**, não uma agenda de dias de culto: quem
consulta escolhe o dia em que houve culto. Numa segunda-feira o quadro ficaria
todo vermelho, e é uma pergunta que ninguém faz.

### 6.4 O período padrão é de 7 dias, não de um mês

Uma igreja conta como pendente enquanto **qualquer** culto do intervalo estiver
aberto. Com o mês inteiro como padrão isso pintava praticamente tudo de
vermelho: medido em 27/08/2026 sobre agosto, **0 de 116 igrejas** apareciam
verdes, e o painel não informava nada. Com os últimos 7 dias, que é a pergunta
real ("fecharam o culto de domingo?"), são 11 verdes e 105 vermelhas.

O padrão vive em dois lugares que precisam concordar: `periodoDaQuery`
(`src/lib/cultoService.ts`) no servidor e `periodoPadrao` (`cultoApi.ts`) no
front. Se divergirem, a tela mostra um intervalo e consulta outro.

Cada igreja também informa `totalCultos` e `cultosConcluidos`, para o painel
dizer "2 de 4 cultos" em vez de reduzir a semana inteira a um único rótulo.

### 6.2 Posições do Culto

Lista por igreja com os seis papéis. Cada papel abre um buscador de **usuários**
(nome/e-mail) para anexar. Mostra vazio explícito ("ninguém anexado") — é o que
vai acontecer nas 30 igrejas sem usuário.

---

## 7. Permissões

Duas chaves novas em `src/app-ui/system/permissionCatalog.ts`, grupo
`Gestão de Culto`:

| Chave | view | create | edit | delete |
|---|---|---|---|---|
| `culto_gestao` | full | full | full | admin |
| `culto_posicoes` | mngr | mngr | mngr | admin |

A permissão só decide se a **tela abre**. Quem vê o quê dentro dela é a matriz
da seção 4, aplicada no servidor — permissão de tela não substitui escopo.

---

## 7.1 Performance: nada de consulta em laço

Medido em 27/08/2026 contra o pooler do Supabase, a tela levava **~68 s** para
abrir. Não era falta de índice — era `blocosExigidos()` sendo chamado **dentro
de um `for`**, uma ida ao banco por igreja:

| | |
|---|---|
| Buscar os 85 registros | 3.066 ms |
| `blocosExigidos` em laço (85 igrejas) | **65.572 ms** |
| A mesma coisa em uma query | **896 ms** |
| `montarPainel` | 3.079 ms |

Cada ida ao pooler custa ~770 ms; 85 delas em série são o minuto inteiro. A
correção foi `blocosExigidosPorIgreja(churchIds)`, que resolve tudo numa
consulta. Depois: **~5 s**, quase todo em latência de rede das ~6 idas restantes.

Regra para quem mexer aqui: **nunca chame a versão de uma igreja dentro de um
laço.** O mesmo cuidado vale para o seed (`prisma/seed-culto.js`), que também
começou sequencial e foi para `createMany` + um `UPDATE` de recálculo.

## 8. Seed de teste

`prisma/seed-culto.js` (idempotente, só roda quando chamado à mão):

1. Sorteia N igrejas ativas do campo Campinas e marca como `is_host = true`.
2. Distribui as demais entre elas via `host_church_id`, respeitando a Regional
   quando possível.
3. Anexa posições a partir das roles que já existem: `tesoureiro` → `FINANCEIRO`,
   `secretario` → `PRESENCA`, e o usuário mais antigo da igreja → `APROVADOR_LOCAL`
   quando não houver outro candidato.
4. Cria registros de culto de domingos do mês corrente em estados variados, para
   a tela nascer com verde e vermelho de verdade.

O seed **não** desfaz o que já existe: a AD Campinas - SEDE e suas três anexas
atuais permanecem como estão.

---

## 9. O que esta entrega **não** faz

- Não grava em `livro_caixa` (D4).
- Não cria `profile_type` nem role nova (D1).
- Não liga RLS (D6).

Já entregue depois da primeira versão: relatório impresso (6.3.4), cadastro de
horários por igreja (2.5), cadeado de visão (2.6), observação do presidente e
atualização automática do quadro (6.3.5).

## 10. Limites conhecidos

Coisas que **não** estão feitas e foram decididas assim, não esquecidas:

- **O cadeado é por nó inteiro, não por bloco.** A coluna `blocos` já existe
  para separar ("vê a presença, não vê o dinheiro"), mas a tela ainda tranca
  tudo de uma vez.
- **Regional não tem cadeado.** O nó de regional não é uma igreja e a trava é
  por `church_id`.
- **Só o perfil `church` fica preso à própria igreja** em `igrejaDoUsuario()`.
  Um perfil `campo` sem posição pode ler os horários de outra igreja **do mesmo
  campo** montando a requisição na mão. Nenhuma tela oferece isso.
- **Não existe agenda de dias de culto.** O quadro não sabe que aquela igreja
  tem culto domingo, quarta e sexta; ele mostra ausência dentro do período
  consultado (6.3.6).
- **O relatório imprime só os cultos que existem.** As igrejas que não abriram
  culto aparecem no Kanban e na Tabela, mas ainda não saem no papel.
- **Não há observação do presidente por nível acima do campo** — ele é o topo.
