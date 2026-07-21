# LISTAS AUXILIARES (LOOKUPS) — CRUD GENÉRICO

## 1. VISÃO GERAL

Várias telas do sistema usam dropdowns alimentados por tabelas de apoio (plano de
contas, formas de pagamento, tipos de documento...). Antes, essas listas **só
podiam ser alteradas direto no banco** — não havia nenhuma tela de manutenção.

Em vez de criar uma tela quase idêntica para cada lista, existe **um CRUD dirigido
por configuração**: registrar uma lista nova em um arquivo já cria a tela e a API.

**Acesso:** Configurações → seção **"Listas e Cadastros Auxiliares"**
**Rota:** `/app-ui/config/:lookupKey`

---

## 2. ARQUIVOS

| Arquivo | Papel |
|---|---|
| `src/lib/lookupRegistry.ts` | **Registro único.** Define tabela, campos, ordenação, flag de "ativo", avisos e chave de permissão de cada lista. |
| `src/app/api/lookups/[key]/route.ts` | `GET` (listar) e `POST` (criar). |
| `src/app/api/lookups/[key]/[id]/route.ts` | `PATCH` (atualizar) e `DELETE` (excluir). |
| `src/app-ui/system/LookupCrud.tsx` | Tela genérica (busca, tabela, modal, toggle de ativo, ConfirmDialog). |
| `src/components/app-ui/SystemSettings.tsx` | Cards da seção em Configurações. |
| `src/app-ui/system/permissionCatalog.ts` | Chaves de permissão. |

---

## 3. LISTAS REGISTRADAS

| Chave (`lookupKey`) | Tabela | Campo "ativo" | Observação |
|---|---|---|---|
| `chart-of-accounts` | `plano_de_contas` | `ativo` | Tem `tipo` (RECEITA/DESPESA) e `considera_dizimo`. |
| `payment-methods` | `forma_pagamento` | `mostrar` | |
| `document-types` | `tipo_documento` | `ativo` | Flags `disponivel_receita` / `disponivel_despesa`. |
| `cost-centers` | `centro_de_custo` | `mostrar` | |
| `church-functions` | `church_function_catalog` | `is_active` | Catálogo global de funções (ver `secretaria.md` §2.14). |
| `ecclesiastical-titles` | `ecclesiastical_titles` | `is_active` | Única com exclusão **lógica** (`deleted_at`). |

> **Não são lookups:** `churches`, `members`, `livro_caixa`, `app_events`,
> `event_*`, `feed_*` — são entidades de negócio com telas próprias.

---

## 4. COMO ADICIONAR UMA LISTA NOVA

Basta acrescentar uma entrada em `src/lib/lookupRegistry.ts`. **Nenhuma tela ou
rota nova é necessária.**

```ts
"minha-lista": {
  key: "minha-lista",
  table: "minha_tabela",
  label: "Minha Lista",
  description: "Texto exibido no topo da tela.",
  orderBy: "nome",
  permKey: "settings_minha_lista",
  activeField: "ativo",          // opcional: habilita o toggle rápido
  softDelete: false,             // true = usa deleted_at em vez de DELETE
  warning: "Texto de alerta.",   // opcional
  fields: [
    { key: "nome",  label: "Nome",  type: "text",    required: true, inList: true },
    { key: "ativo", label: "Ativo", type: "boolean", inList: true },
  ],
},
```

Depois: registrar a chave de permissão (`settings_minha_lista`) em
`permissionCatalog.ts` e adicionar o card em `SystemSettings.tsx`.

> ⚠️ **Sem a chave de permissão a tela fica visível para todos** — `usePermissions`
> retorna `true` para módulo desconhecido (`usePermissions.ts`, função `resolve`).

**Tipos de campo:** `text` · `boolean` · `select` (com `options`).
`inList: true` faz o campo virar coluna da listagem.

---

## 5. SEGURANÇA

- **Allowlist:** o nome da tabela e das colunas vêm **sempre** do registro. Nada
  vindo do cliente é interpolado em SQL; os valores viajam como parâmetros
  (`$1, $2...`). Uma `key` desconhecida devolve `404`.
- **Escrita restrita:** `POST`, `PATCH` e `DELETE` exigem `profileType`
  `master` ou `admin`; leitura exige apenas autenticação.
- **FK em uso:** ao tentar excluir um item referenciado (ex.: função já atribuída
  a um membro), a API devolve **409** com a mensagem orientando a **desativar**
  em vez de excluir.

---

## 6. ARMADILHA CONHECIDA — VÍNCULO POR NOME

`livro_caixa` grava **plano de contas** (`plano_de_conta`) e **forma de pagamento**
(`forma_pg`) como **texto**, não por `id`.

Consequência: **renomear** um item não atualiza os lançamentos já registrados —
o histórico continua com o nome antigo e deixa de casar com a lista atual.

Por isso as telas dessas duas listas exibem um aviso fixo recomendando
**desativar o item e criar um novo** em vez de renomear. Ao mexer nessas tabelas,
preserve esse comportamento.
