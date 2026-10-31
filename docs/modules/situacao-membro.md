# Situação do membro (`members.membership_status`)

## Regra (decisão do dono, 31/10/2026)

- **INATIVO não existe.** Todo INATIVO vira **DESLIGADO**, qualquer que seja o cargo ou título.
- Grafias erradas de desligado (`Desigado`, `Desligamento de Membros`, `Suspenso`, `Desligado`)
  viram **DESLIGADO**.
- Grafias de aguardando (`AGUARDANDO_ATIVACAO`, `AGUARDANDO ATIVAÇÃO`, `Aguadando Ativação`...)
  viram **AGUARDANDO ATIVACAO**; `Ativo` vira **ATIVO**.
- **EXCLUIDO** e **Carta de Mudança** continuam existindo, porque têm rotina própria (exclusão de
  membros e desligamento por carta).
- Outros valores que aparecerem ficam como estão, para uma mudança futura.

Fonte única no código: `src/lib/situacaoMembro.ts` (`normalizarSituacaoMembro`).

## Causa da divergência busca × perfil

O selo do perfil (`MemberProfile.tsx`, `statusLabel`) testava `status.includes("ATIVO")`.
Como `"INATIVO".includes("ATIVO")` é verdadeiro, todo INATIVO aparecia como **Ativo** no perfil,
enquanto a busca mostrava o valor real (INATIVO). Exemplos: ROL 29834 e ROL 10073.

## Correção de dados — banco de Campinas (`ysibqnwgitakofehdxvd`), 31/10/2026

Backup (id + valor antigo de cada linha alterada):
`backups/status-membros-campinas-2026-10-31T18-17-38-533Z.json`.

| De | Para | Linhas |
|---|---|---|
| INATIVO | DESLIGADO | 498 |
| Desligamento de Membros | DESLIGADO | 13 |
| Desigado | DESLIGADO | 10 |
| Desligado | DESLIGADO | 4 |
| Suspenso (ROL 25248) | DESLIGADO | 1 |
| Ativo | ATIVO | 6 |
| AGUARDANDO_ATIVACAO / AGUARDANDO ATIVAÇÃO / Aguardando Ativação / Aguadando Ativação | AGUARDANDO ATIVACAO | 265 |

Na primeira passada, EXCLUIDO (84) e Carta de Mudança (6) também tinham sido convertidos. Por
decisão do dono, foram **restaurados ao valor exato anterior** a partir do backup, no mesmo dia.

Só a coluna `membership_status` foi alterada; `updated_at` não foi tocado.

Matriz de serviços (`kan_matrix_rules.new_status`): regras 203, 204 e 206, de
`Aguadando Ativação` para `Aguardando Ativação` (erro de digitação). A regra 260 (Exclusão de
Membros → Aprovado) continua `Excluido`.

## Código (vale para todas as igrejas no próximo deploy)

- Gravação passa por `normalizarSituacaoMembro`: regras da matriz (`kanMatrix.ts`, ocorrências,
  batismo, consagração, transferência), PATCH `/api/members/[id]`, cadastro
  `/api/churches/[id]/members` e as duas importações.
- Perfil: selo e bolinha verde por comparação exata.
- Dropdowns: "Inativo" virou "Desligado" (MemberEdit, MemberEditDrawer, MemberRegistration,
  filtro de Aniversariantes). Na lista de membros, os rótulos "Inativo(s)" viraram "Desligado(s)".
- Matriz: "Nova situação" deixou de ser texto livre e virou lista (Aguardando Ativação / Ativo /
  Desligado / Excluido).
- Aniversariantes: o filtro "Aguardando" nunca encontrava ninguém (comparava `AGUARDANDO` com
  `AGUARDANDO ATIVACAO`). Corrigido.

Verificação: typecheck (`tsconfig.check.json`) e eslint apresentaram exatamente os mesmos
erros já existentes no HEAD (476 e 86); nenhum novo. O E2E de escrita **não** foi rodado, porque
grava no banco de produção e havia secretários editando membros naquele momento.

## Fora do escopo (não alterado)

- `src/app/api/dashboard/route.ts` conta membros com `membershipStatus != "INATIVO"`, o que
  inclui desligados nessa contagem. Já era assim antes desta mudança.
- `src/app/api/membro/membros/route.ts` filtra `not: 'inactive'`, valor que não existe no banco.
