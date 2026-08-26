# Seed do sistema (sem dados de igreja/membro)

Arquivos SQL pra popular, num banco novo (depois de rodar
`supabase/rebuild-full-schema.sql`), tudo que é **catálogo/config do
sistema** — não depende de nenhuma igreja ou membro específico, então roda
igual em qualquer tenant novo.

## Ordem de execução

Cole no SQL Editor do Supabase, um arquivo de cada vez (ou todos em sequência
num único paste — todos são idempotentes, `ON CONFLICT ... DO NOTHING`,
menos o `08`, que tem uma nota própria sobre isso):

| # | Arquivo | O que cria | Depende de |
|---|---|---|---|
| 00 | `00_usuario_master.sql` | Usuário master de acesso ao sistema (login) — **edite email/senha no topo do arquivo antes de rodar** | nada |
| 01 | `01_titulos_eclesiasticos.sql` | Títulos eclesiásticos (Congregado, Membro, Pastor, ...) | nada |
| 02 | `02_catalogos_financeiros.sql` | Tipos de credor, natureza de despesa, tipo de departamento, tipo de conta bancária | nada |
| 03 | `03_zonas.sql` | Zonas geográficas (Zona Norte, Zona Sul, ...) | nada |
| 04 | `04_pipeline_secretaria.sql` | Pipelines (Secretaria, Evento, Tesouraria) | nada |
| 05 | `05_servicos.sql` | Catálogo de serviços (Admissão, Batismo, Consagração, ...) | nada |
| 06 | `06_etapas.sql` | Etapas de cada pipeline | 04, 05 |
| 07 | `07_colunas.sql` | Colunas de cada etapa | 06 |
| 08 | `08_matriz_regras.sql` | Matriz de decisão (regras de automação do Kanban) | 05, 06 |

## Fora desta pasta — cadastro manual, é de cada igreja

Campo, Regional, Igreja, Usuários (além do master), Membros, Bancos,
Departamentos, Plano de Contas, Credores. Ver seção 4 de
`MIGRACAO_SUPABASE_VERCEL.md` pra ordem de cadastro desses.

## Nota sobre o campo `campo` dos arquivos 04/06

Os pipelines e etapas trazem um campo de texto livre `campo` com o valor
`'campinas'` — é só um rótulo descritivo da origem dos dados (não é FK, não
afeta nenhum outro cadastro), pode renomear ou ignorar.
