# saaschurch-nextjs

Um código só rodando contra **um banco Supabase por igreja**. Um `git push`
atualiza o front de todas ao mesmo tempo.

## REGRA Nº 1 — mexeu no schema, regere o baseline

**O `scripts/migrate-self.mjs` aplica o `baseline/`, NÃO as migrations do
Prisma.** Criar a migration resolve só o banco de referência. Sem regerar o
baseline, o deploy leva o front novo para todas as igrejas e deixa os bancos
delas para trás — a tela nova quebra em todo mundo menos em quem desenvolveu.

Toda vez que criar tabela, coluna, índice ou constraint:

```bash
# 1. aplicar no banco de referência e registrar
npx prisma migrate resolve --applied <nome_da_migration>

# 2. regerar
cd ../painelchurch && npm run baseline:dump

# 3. copiar para o que vai no deploy
cp baseline/*.sql baseline/manifest.json ../saaschurch-nextjs/baseline/

# 4. conferir
grep -c "<tabela_nova>" ../saaschurch-nextjs/baseline/05_tables.sql

# 5. commitar nos DOIS repositórios (saaschurch e painelchurch)
```

A versão em `baseline/manifest.json` **tem que mudar** — é o carimbo que o
`migrate-self` compara com `public._painelchurch_baseline` em cada igreja.
Versões iguais ⇒ ele não faz nada.

## Outras armadilhas conhecidas

O checklist completo, com o porquê de cada item, está em
**[docs/RELEASE-CHECKLIST.md](docs/RELEASE-CHECKLIST.md)**. Leia antes de subir.
Resumo do que já mordeu:

- **O baseline só CRIA — remoção não replica sozinha.** `create ... if not
  exists` nunca derruba nem afrouxa objeto que já está no banco da igreja.
  Quando você REMOVE ou afrouxa algo (um unique, um default, uma constraint), o
  dump só para de mencionar — e a igreja continua com o objeto antigo. O DROP
  correspondente vai à mão em `baseline/98_patches.sql`, que o `migrate-self`
  aplica no fim. Idempotente, datado e explicado.
- **O `.env` local aponta para PRODUÇÃO** (`ysibqnwgitakofehdxvd`, o banco de
  origem do baseline). Não existe banco de dev separado. Confirme antes de
  qualquer DDL.
- **Transação interativa estoura em ~7 statements.** O pooler responde em
  ~700 ms por ida e volta e o limite do Prisma é 5 s. Use `deleteMany` +
  `createMany` no lugar de um `upsert` por item. Quando estoura, a conexão fica
  envenenada e rotas vizinhas passam a falhar sem explicação.
- **Rota que alimenta tela de configuração não pode ter cache.** A pessoa salva
  e continua vendo o estado antigo. Use `no-store` nos dois lados.
- **Página que lê o banco para `metadata`/manifesto precisa de
  `export const dynamic = "force-dynamic"`**, senão o Next congela o valor no
  build.
- **`prisma generate` com o `next dev` rodando quebra no Windows** e deixa o
  client corrompido (o SSR passa a morrer com "Jest worker encountered N child
  process exceptions"). Pare o dev antes.
- **Favicon, título e manifesto têm dono único** em `home_configs`. Não recrie
  `src/app/favicon.ico` nem `public/manifest.webmanifest`: têm precedência e
  anulam a configuração em silêncio.
- **Typecheck e GET 200 não cobrem gravação.** Rode o E2E de escrita
  (`scripts/e2e-*.mjs`) antes de dizer que está pronto. Eles gravam no banco de
  referência e restauram no fim — confirme que ninguém está editando a tela.
