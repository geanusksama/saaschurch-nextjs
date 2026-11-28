# Ibirité: donos dos objetos do banco (corrigido em 28/11/2026)

## O problema

Em 27/11/2026 um baseline novo derrubou Ibirité (503, app reiniciando sem parar). O start do Coolify roda
`MIGRATE_ON_BUILD=1 node scripts/migrate-self.mjs && npm start`, e o `migrate-self` conecta como `postgres`
(usuário do app, **não** superusuário). Todos os objetos de `public` e `app` tinham sido criados pelo
painelchurch como `supabase_admin` (341 tabelas, 21 sequências, 74 funções, 13 tipos, 1 view, schema `app`),
então cada `alter`/`create index`/`alter publication` falhava com `must be owner of …` e o script abortava.

A Vila Solange não tem o problema: o banco dela foi criado pelo próprio `migrate-self` (dono `postgres`).

## O que foi feito

Numa transação única, como `supabase_admin` (dentro do container `supabase-db-pvvk9h2w0puupcjuz4x1ddva`):
`alter schema app`, `alter table`, `alter sequence` (só as não ligadas a tabela), `alter view`, `alter routine`
e `alter type`/`alter domain` dos objetos de `public` e `app` → `owner to postgres`. 435 objetos.
Nenhum objeto de extensão estava em `public`/`app`; a publicação `supabase_realtime` já era de `postgres`.

Depois, o `migrate-self` com o baseline `32aeeaa948f71d98` rodou dentro do container do app, sem nenhum erro,
e carimbou o banco nessa versão.

## Como conferir

```sql
select 'tabelas', tableowner, count(*) from pg_tables where schemaname in ('public','app') group by 2
union all select 'funcoes', proowner::regrole::text, count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where nspname in ('public','app') group by 2;
```
Esperado: só `postgres`.

## Para campos novos

Banco provisionado pelo painelchurch como `supabase_admin` precisa desta mesma transferência antes do primeiro
deploy com `migrate-self`. (Corrigir o painelchurch para criar como `postgres` fica como pendência.)
