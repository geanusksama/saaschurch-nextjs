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
