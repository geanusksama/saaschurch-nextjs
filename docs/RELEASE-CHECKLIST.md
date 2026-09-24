# Antes de subir para o Git

O saaschurch é **um código só rodando contra um banco por igreja**. Um `git
push` atualiza o front de todas elas ao mesmo tempo. Os bancos, não — eles só
mudam se o `baseline/` mudar junto.

É daí que vem a regra mais importante deste arquivo.

---

## 1. Mexeu no schema? Regere o baseline. Sempre.

**O `migrate-self.mjs` aplica o `baseline/`, NÃO as migrations do Prisma.**

Criar `prisma/migrations/<data>_<nome>/migration.sql` resolve o *seu* banco e
mais nada. Se o baseline não for regerado, o deploy leva o front novo para
todas as igrejas e deixa os bancos delas para trás — a tela nova quebra em
todo mundo menos em você.

### O caminho completo

```bash
# 1. aplicar a migration no banco de REFERÊNCIA (o de origem do baseline)
#    — pelo prisma migrate, ou rodando o SQL direto
npx prisma migrate resolve --applied <nome_da_migration>   # se aplicou o SQL na mão

# 2. regerar o baseline a partir desse banco
cd ../painelchurch
npm run baseline:dump

# 3. copiar para o saaschurch (é o que vai no deploy)
cp baseline/*.sql baseline/manifest.json ../saaschurch-nextjs/baseline/

# 4. conferir que a estrutura nova entrou
grep -c "<nome_da_tabela>" ../saaschurch-nextjs/baseline/05_tables.sql

# 5. commitar nos DOIS repositórios
#    saaschurch-nextjs → é o que o deploy das igrejas aplica
#    painelchurch      → é o que cria o banco de uma igreja nova
```

### Aplicar UMA migration no banco de referência

`prisma migrate dev` não serve aqui (ele quer sincronizar o histórico inteiro
contra produção). O caminho seguro é aplicar só o arquivo e depois registrar:

```bash
npx prisma db execute --file prisma/migrations/<nome>/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied <nome>
```

Dois tropeços que já custaram tempo:

- **Rode de dentro de `saaschurch-nextjs`.** Fora dela o `npx prisma` baixa o
  CLI novo da plataforma Prisma, que não tem `db execute` e responde
  `CLI.UNKNOWN_COMMAND`.
- **Pare o `next dev` antes de qualquer `prisma generate`** (seção 6). Coluna
  nova sem `generate` dá "does not exist in type ...Select" no typecheck.

A versão em `baseline/manifest.json` **tem que mudar**. É o carimbo que o
`migrate-self` compara com `public._painelchurch_baseline` no banco de cada
igreja: versões iguais ⇒ ele não faz nada.

A versão é o hash dos arquivos 01–14 **e da parte fixa do `99_version.sql`**
(desde 2026-09-24; antes, mudar só o 99 não mudava a versão e não chegava às
igrejas). A tabela do carimbo tem RLS: leitura aberta, escrita só pela conexão
direta — antes o anon conseguia trocar o carimbo.

### Por que o baseline mora em dois lugares

| Repositório | Papel |
| --- | --- |
| `painelchurch/baseline` | saída do gerador; usada para **criar** o banco de uma igreja nova |
| `saaschurch-nextjs/baseline` | vai no deploy; usada para **atualizar** o banco de cada igreja |

Deixar os dois em versões diferentes é como ter dois schemas. Copie sempre.

---

## 2. O `.env` local aponta para PRODUÇÃO

`DIRECT_URL` / `DATABASE_URL` apontam para o projeto Supabase
`ysibqnwgitakofehdxvd` — o **banco de origem do baseline**, que está na lista
`PROTECTED_REFS` do `migrate-self.mjs`. Não existe banco de desenvolvimento
separado.

Consequência: um `prisma migrate dev` distraído altera o banco do qual o
baseline de todas as igrejas é extraído. Confirme antes de rodar qualquer DDL.

---

## 3. Migration tem que ser aditiva e idempotente

O `migrate-self` roda o baseline inteiro em bancos que já estão em produção,
repetidas vezes. Escreva sempre:

- `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`
- `ALTER TABLE ... ADD CONSTRAINT` guardado por consulta ao `pg_constraint`
- nada de `DROP`, nada de `ALTER COLUMN` destrutivo em tabela existente

### E quando o certo é justamente REMOVER?

Aí o baseline gerado não resolve, e o problema é silencioso: `create ... if not
exists` nunca derruba nem afrouxa o que já está no banco da igreja. Se você tira
um unique, um default ou uma constraint no banco de referência, o dump apenas
**para de mencionar** aquilo — e cada igreja segue com o objeto antigo, barrando
o que o código novo já permite.

Nesses casos o DROP vai à mão em **`baseline/98_patches.sql`**, aplicado pelo
`migrate-self` depois de todo o resto (tolerante, fora de transação). Esse
arquivo não sai do `baseline:dump` e não é sobrescrito por ele.

Regras ao escrever lá: idempotente (`IF EXISTS`), só estrutura (nunca dado),
datado e com o porquê — quem ler depois precisa saber se a linha ainda serve.

Dois casos que já morderam, os dois pela mesma raiz:

- **DEFAULT em coluna existente.** `add column if not exists` não altera coluna
  que já existe. Hoje o gerador emite `05d_defaults.sql` com `alter column set
  default` de tudo, então default novo replica sozinho — não precisa de patch.
- **Unique afrouxado.** O índice antigo continua vivo na igreja. Precisa de
  patch.

### Default, CHECK ou índice NÃO podem chamar função própria

O `migrate-self` (e o provisionamento do painelchurch) cria as tabelas
(`05_tables`) e os índices (`08`) **antes** das funções (`04_functions`) — de
propósito, porque há função que retorna tipo de tabela. Então coluna com
`default minha_funcao()`, CHECK ou índice que chame função do schema `public`
quebra em todo banco que ainda não tem a função: o arquivo inteiro é
revertido e o deploy aborta.

Já aconteceu (2026-09-24, preview da advilasolange): 9 colunas `perfil_id
default appv3_meu_perfil_id()` do app v3. Correção: gatilho `BEFORE INSERT`
(criado no `10`, depois das funções). Views, políticas RLS e gatilhos podem
chamar função própria — vêm depois do `04`.

Conferir antes de regerar o baseline (tem que voltar vazio):

```sql
select d.classid::regclass, p.proname
  from pg_depend d
  join pg_proc p on p.oid = d.refobjid and d.refclassid = 'pg_proc'::regclass
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
 where d.classid in ('pg_attrdef'::regclass, 'pg_constraint'::regclass)
    or (d.classid = 'pg_class'::regclass and exists (select 1 from pg_index i where i.indexrelid = d.objid));
```

**Preview também roda o `migrate-self` no banco da igreja.** Um push em
branch já aplica o baseline nos bancos dos projetos Vercel que fazem preview —
e os arquivos tolerantes (`05b`–`05d`, `98_patches`) ficam aplicados mesmo
quando os transacionais são revertidos. Não suba baseline sem a checagem
acima.

---

## 4. Latência do banco: cuidado com transação interativa

O pooler do Supabase responde em **~700 ms por ida e volta** a partir daqui. A
transação interativa do Prisma tem limite padrão de **5 segundos**.

Ou seja: **7 statements sequenciais dentro de `$transaction` já estouram.**
Quando estoura, o erro não é só o 500 daquela rota — a conexão fica envenenada
(`Transaction not found`, depois `Server has closed the connection`) e rotas
vizinhas passam a falhar sem explicação.

```ts
// ✗ um upsert por item: N idas ao banco dentro da transação
for (const item of itens) await tx.tabela.upsert({ ... });

// ✓ substituição em lote: 2 statements, independente do tamanho da lista
await tx.tabela.deleteMany({ where: { paiId } });
await tx.tabela.createMany({ data: itens.map(...) });
```

Se realmente precisar de muitos statements, passe `{ timeout, maxWait }` —
mas prefira reduzir o número de idas ao banco.

Medição relacionada: a latência alta é **daqui**, não da Vercel. Não conclua
que a produção é lenta com base em número medido nesta máquina.

---

## 5. Cache em rota que alimenta tela de configuração

Se existe uma tela onde alguém edita e uma rota pública que lê o resultado, a
rota **não pode** ter `stale-while-revalidate` generoso. A pessoa salva, abre a
página e continua vendo o estado antigo, sem saber se errou ou se é cache.

Regra prática: rota lida por página que reflete configuração editável ⇒
`Cache-Control: no-store`, e `fetch(..., { cache: 'no-store' })` no cliente. Uma
consulta por chave única não é o gargalo de nada.

E se a rota/página do App Router lê o banco para montar `metadata` ou o
manifesto, marque `export const dynamic = "force-dynamic"` — senão o Next
renderiza no build e congela o valor da igreja que existia naquele momento.

---

## 6. `prisma generate` com o `next dev` rodando quebra no Windows

O dev server segura `query_engine-windows.dll.node`. O `generate` falha no
rename (`EPERM`), **deixa o `node_modules/.prisma/client` num estado quebrado**
e o worker de SSR passa a morrer com "Jest worker encountered N child process
exceptions".

Ordem certa:

```bash
# parar o next dev primeiro
npx prisma generate
rm -f node_modules/.prisma/client/query_engine-windows.dll.node.tmp*   # sobras
npm run dev
```

---

## 7. Favicon, título e manifesto têm dono único

Vêm de `home_configs` (Sistema → Home Pública). Não recrie
`src/app/favicon.ico` nem `public/manifest.webmanifest`: os dois têm
precedência sobre a configuração e a anulariam em silêncio.

Também não volte a sincronizar favicon a partir do `localStorage`
(`mrm_branding`): aquilo só trocava o ícone no navegador de quem salvou a
marca, e visitante nenhum via.

---

## 8. Teste ponta a ponta antes de dizer "pronto"

Typecheck e um `curl` de leitura **não** cobrem gravação. O bug de transação
da seção 4 passou por typecheck limpo e por um GET 200 — e quebrava em todo
salvamento.

Há E2E prontos em `scripts/e2e-*.mjs`. Eles obtêm sessão por magic link com o
service role (não precisam de senha) e cobrem gravação de verdade.

**Estes testes ESCREVEM no banco de referência e restauram no fim.** Se alguém
estiver com a tela aberta editando, a restauração desfaz o que a pessoa salvou.
Por isso o `e2e-home-publica.mjs` exige confirmação explícita:

```bash
E2E_CONFIRMO=sim node scripts/e2e-home-publica.mjs
```

Confirme que ninguém está usando a tela antes de rodar.

---

## 9. Lista que cresce precisa de teto no banco, não no JavaScript

Um `findMany` sem `take` devolve a tabela inteira. Enquanto a base é pequena
ninguém percebe; quando ela cresce, a tela não fica "um pouco mais lenta" — ela
passa a arrastar dezenas de MB por request e a derramar disco temporário no
Postgres.

Foi o que aconteceu no board da Secretaria. Uma etapa tinha 42 mil cards; a
rota carregava todos, com todas as colunas (incluindo `metadata`, `attachments`
e `justification`, os campos gordos), ordenava por `opened_at` e só então
agrupava por coluna **em JavaScript**:

```ts
// ✗ traz a etapa inteira para jogar quase tudo fora no cliente
const cards = await prisma.kanCard.findMany({ where, include, orderBy });
const grouped = colunas.map((col) => ({
  ...col,
  cards: cards.filter((c) => c.columnIndex === col.columnIndex),
}));

// ✓ uma consulta por coluna, cada uma com teto, em paralelo
const [counts, ...pages] = await Promise.all([
  prisma.kanCard.groupBy({ by: ["columnIndex"], where, _count: { _all: true } }),
  ...colunas.map((col) => prisma.kanCard.findMany({
    where: { ...where, columnIndex: col.columnIndex },
    include, orderBy, take: 40,
  })),
]);
```

Medido no banco de referência, etapa com 42.393 cards:

| | antes | depois |
|---|---|---|
| tempo dentro do Postgres | 1.201 ms | 0,5–29 ms |
| payload JSON | 60,6 MB | 0,18 MB |
| disco temporário | 2,4 GB derramados | zero |

Como achar as outras: `pg_stat_statements` denuncia sozinho. Query com
`temp_blks_written` alto é lista sem teto até prova em contrário.

```sql
select round(mean_exec_time::numeric,1) as media_ms, calls,
       round((temp_blks_read+temp_blks_written)*8192/1024.0/1024.0,1) as temp_mb,
       left(query, 120) as query
from pg_stat_statements
where temp_blks_written > 0
order by temp_blks_written desc limit 10;
```

### Três detalhes que quebram na prática

**Paginação por `OFFSET` precisa de ordem total.** `ORDER BY opened_at DESC`
sozinho não desempata linhas com a mesma data: entre uma página e a seguinte a
ordem pode mudar, repetindo um registro e engolindo outro. Sempre acrescente um
critério único — `[{ openedAt: "desc" }, { id: "desc" }]`.

**O `skip` sai do que já está carregado, não de um contador de páginas.** Se um
item sair da lista no meio do caminho (movido, arquivado), o contador de páginas
passa a pular registros; o tamanho do array carregado, não.

**O total mostrado na tela vem do `count`, não do `length`.** Senão toda coluna
cheia exibe "40" e a pessoa acha que perdeu dados.

### O filtro de escopo mora em UM lugar

Quando a paginação vira uma segunda rota, ela precisa do **mesmo** `where` da
primeira — inclusive o recorte por igreja/campo. Copiar aquele bloco é como se
reabre um vazamento de dados já corrigido. Extraia para um módulo e importe nos
dois lados (`board/cardFilter.ts` é o exemplo).

---

## Resumo — checklist

- [ ] Migration aditiva e idempotente em `prisma/migrations/`
- [ ] Migration aplicada no banco de referência e registrada (`migrate resolve`)
- [ ] `npm run baseline:dump` no painelchurch
- [ ] `baseline/` copiado para o saaschurch e versão do `manifest.json` mudou
- [ ] Estrutura nova conferida dentro do `05_tables.sql`
- [ ] Commit nos **dois** repositórios
- [ ] Nenhuma transação com mais de ~5 statements sequenciais
- [ ] Rotas de configuração sem cache; páginas com metadata do banco em `force-dynamic`
- [ ] `npx tsc --noEmit` limpo
- [ ] E2E de gravação executado e passando
- [ ] Nenhum `findMany` sem `take` em rota de listagem que cresce
- [ ] Paginação com ordem total (campo + `id`) e total vindo de `count`
