# Migração para novo Supabase + Deploy na Vercel

Guia de referência gerado em 2026-08-24. Cobre: reconstruir a estrutura do
banco em um projeto Supabase novo, trocar as variáveis de ambiente, e subir
o deploy na Vercel.

---

## 1. Variáveis de ambiente necessárias

Arquivo de referência no repo: [`.env.example`](.env.example) (molde, sem
valores) e [`.env.vercel`](.env.vercel) (valores reais do ambiente atual,
pronto pra importar na Vercel via botão **"Import .env"**).

### Obrigatórias pra rodar

| Variável | Onde pegar |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → Connection Pooling, modo **Transaction** (porta 6543, com `?pgbouncer=true`) |
| `DIRECT_URL` | Supabase → Settings → Database → Connection Pooling, modo **Session** (porta 5432, sem `pgbouncer=true`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_URL` | igual ao acima |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → Project API keys → `anon public` |
| `SUPABASE_ANON_KEY` | igual ao acima |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → Project API keys → `service_role` (secreta) |
| `MEMBRO_JWT_SECRET` | segredo da aplicação — não muda entre bancos |
| `NEXT_PUBLIC_APP_URL` | domínio final do deploy na Vercel (ex: `https://seu-app.vercel.app`) |

### Obrigatórias por feature

| Variável | Precisa se... |
|---|---|
| `STRIPE_ENCRYPTION_KEY` | app usa Stripe (criptografa o Client Secret salvo no banco) |
| `STRIPE_WEBHOOK_SECRET` | for testar/receber webhooks do Stripe |
| `CRON_SECRET` | usa os Cron Jobs da Vercel (`vercel.json`: contabilidade, whatsapp-ai, pastoral-cronograma) |

### Opcionais (têm fallback, só setar se for usar a feature)

`FACEID_REQUIRE_APPROVAL`, `FACEID_DAO_SECRET`, `CONTABILIDADE_CRON_SECRET`,
`PASTORAL_JOURNEY_DRY_RUN`, `PUBLIC_DEFAULT_CAMPO_ID`, `NEXTAUTH_SECRET`,
`CREDENTIAL_IMAGE_BUCKET`, `CREDENTIAL_IMAGE_FALLBACK_BUCKET`.

### Preenchidas automaticamente pela Vercel — não setar

`NEXT_PUBLIC_BUILD_ID` (gerada em `next.config.ts` a partir de
`VERCEL_GIT_COMMIT_SHA`), `VERCEL_OIDC_TOKEN`, `NODE_ENV`.

### Deixado de lado por enquanto

`SANTANDER_ENCRYPTION_KEY`, `SANTANDER_CERT_BASE_DIR` — módulo de
conciliação bancária, cert path era do Linux antigo, revisar depois.

---

## 2. Reconstruir a estrutura no Supabase novo

Script pronto no repo: [`supabase/rebuild-full-schema.sql`](supabase/rebuild-full-schema.sql)
(8.6k linhas). Contém, na ordem:

1. Extensão `pgcrypto`
2. As 65 migrations do Prisma (tabelas, colunas, índices, FKs)
3. As migrations SQL cruas do Supabase (triggers, functions, módulos extras)
4. Os 4 buckets de Storage (`cultos`, `dados`, `dept-media`, `fotos`) com os
   limites/mime-types atuais
5. Policies de RLS do `storage.objects`
6. Snapshot das policies de RLS do schema `public`

> Só estrutura — sem dados de usuários. Um `INSERT` com credencial real de
> teste (`contabilidade_acessos`) foi removido de propósito; cadastre esse
> acesso manualmente no ambiente novo se precisar.

**Passos:**

1. Criar o projeto novo no [supabase.com](https://supabase.com)
2. Abrir o **SQL Editor** do projeto novo
3. Colar o conteúdo inteiro de `supabase/rebuild-full-schema.sql` e rodar
   (é só `CREATE`/`ALTER`/`INSERT ... ON CONFLICT`, seguro num banco vazio)

---

## 3. Trocar as variáveis pro banco novo

Depois que o SQL rodar sem erro no projeto novo, trocar **só estas 6**
variáveis (as outras — JWT, Stripe, cron — são segredos da aplicação,
independentes do banco):

```
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Atualizar em dois lugares:
- **Local**: `.env.local`
- **Vercel**: Project Settings → Environment Variables

---

## 4. Ordem de cadastro no banco vazio

Depois de rodar o `rebuild-full-schema.sql`, o banco tem a estrutura mas
zero registros. As tabelas abaixo são o "esqueleto" que todo o resto do
sistema referencia — cadastrar fora de ordem trava com erro de chave
estrangeira. Ordem verificada direto no `prisma/schema.prisma` (não é
achismo): para cada item, digo se a dependência é **obrigatória** (o banco
recusa salvar sem isso) ou **opcional** (o campo pode ficar em branco e ser
preenchido depois).

### Tier 0 — Catálogos globais (sem dependência nenhuma, cadastrar primeiro)

Não têm FK nenhuma, então não travam em nada — mas os formulários que os
usam mostram combo vazio até serem cadastrados:

1. **Títulos eclesiásticos** (`ecclesiastical_titles`)
2. **Tipos de credor / naturezas de despesa / tipos de departamento / tipos
   de conta bancária** — catálogos do módulo financeiro (`tipos_credor`,
   `naturezas_despesa`, `tipos_departamento`, `tipos_conta_bancaria`)

### Tier 1 — Estrutura organizacional

3. **Campo** (`campos`) — raiz, sem dependência
4. **Regional** (`regionais`) — depende de **Campo** (obrigatório)

### Tier 2 — Igreja

5. **Igreja** (`churches`) — depende de **Regional** (obrigatório)
   - "Sede" (`headquarters`) é opcional, pode entrar depois

### Tier 3 — Acesso

6. **Perfil de acesso / Role** (`roles`) — igreja é opcional aqui, pode
   cadastrar antes ou depois da igreja
7. **Usuário** (`users`) — igreja/campo/regional/role todos opcionais

### Tier 4 — Pessoas

8. **Membro** (`members`) — depende de **Igreja** (obrigatório). Título
   eclesiástico e usuário vinculado são opcionais, mas só aparecem no
   cadastro se o Tier 0/3 já estiver feito.

### Tier 5 — Financeiro (tudo abaixo depende de Igreja já existir)

9. **Banco** (`bancos`) — opcional, mas configure antes do livro caixa
10. **Departamento** (`departamentos`) — opcional
11. **Plano de Contas** (`plano_de_contas`) — opcional
12. **Credor** (`credores`) — depende de **Igreja** (obrigatório)

### Tier 6 — Secretaria / matriz de decisão (pipeline Kanban)

13. **Pipeline** (`kan_pipelines`) — raiz, sem dependência
14. **Serviço** (`kan_services`) — raiz, sem dependência (IDs fixos do
    catálogo do sistema, não é tela de cadastro comum)
15. **Etapa / Stage** (`kan_stages`) — depende de **Pipeline** (obrigatório);
    serviço é opcional
16. **Matriz de decisão** (`kan_matrix_rules`) — depende de **Serviço**
    (obrigatório); etapa é opcional
17. **Coluna** (`kan_columns`) — depende de **Etapa/Stage** (obrigatório)
18. **Card** (movimentação de membro no pipeline, `kan_cards`) — depende de
    Igreja, Etapa e Coluna já existirem

### Resumo em uma frase pra passar pro time

> Títulos eclesiásticos e catálogos financeiros primeiro (não bloqueiam nada,
> mas deixam os formulários prontos) → Campo → Regional → Igreja → Perfis de
> acesso e Usuários → Membros → Bancos/Departamentos/Plano de
> Contas/Credores → Pipeline/Serviço/Etapa → Matriz de decisão → Coluna →
> Cards.

---

## 5. Checklist final de deploy

- [ ] Projeto novo criado no Supabase
- [ ] `supabase/rebuild-full-schema.sql` rodado no SQL Editor do projeto novo, sem erros
- [ ] As 6 variáveis de conexão trocadas no `.env.local`
- [ ] `npx prisma generate` rodado local (garante que o Prisma Client bate com o schema novo)
- [ ] `npm run dev` local testado contra o banco novo
- [ ] Variáveis importadas na Vercel via `.env.vercel` (botão **Import .env**)
- [ ] As 6 variáveis de conexão atualizadas na Vercel pro banco novo
- [ ] `NEXT_PUBLIC_APP_URL` atualizada com o domínio real gerado pela Vercel
- [ ] Redeploy feito na Vercel após qualquer troca de env var
- [ ] (Depois) revisar módulo Santander — cert path era Linux, precisa de caminho Windows/novo storage
