# Permissões granulares e Grupos de usuários — SPEC

**Status:** proposta, 16/10/2026. Nada aplicado no banco.

O pedido: granularizar o acesso até o componente (o botão Exportar de uma
tela, o Salvar de outra, cada menu), e criar **Grupos de usuários** em
Configurações. O grupo leva as mesmas regras granulares e a lista de igrejas
que seus usuários podem acessar. Quando o usuário está no grupo, a regra do
grupo domina a dele. O sistema mostra a árvore de componentes de cada tela para
marcar e desmarcar.

---

## 0. Realidade do sistema (medida na adcampinas em 16/10/2026)

### 0.1 Como a permissão funciona hoje

- **Catálogo:** `src/app-ui/system/permissionCatalog.ts`, por **módulo** (≈ tela)
  × 4 ações (`view`, `create`, `edit`, `delete`) × perfil (`master`, `admin`,
  `campo`, `church`). Não existe nível de componente.
- **Resolução:** `src/lib/resolvePermission.ts`, nesta ordem:
  1. sobrescrita do usuário (`users.permissions`);
  2. função (role) como whitelist: com role e sobrescritas, o que não está no
     mapa é negado (exceto as chaves opt-out);
  3. padrão do catálogo para o perfil.
- **Junção função + usuário:** `src/lib/auth.ts:197`, `{ ...role, ...usuario }`.
  **A sobrescrita do usuário vence a da função**, o contrário do pedido.
- **Onde é aplicada:** só no front (`usePermissions`, 40 arquivos). As rotas da
  API, em geral, conferem só o perfil. **Botão escondido não está bloqueado no
  servidor.**

### 0.2 Números

| O quê | Quantidade |
|---|---|
| Funções (roles) ativas | 5 — tesoureiro (100 usuários), secretario (74), camposec (10), campotes (2), Dirigente (a) (0) |
| Regras por função | 18 a 78 chaves |
| Usuários com função | 186 |
| Usuários com sobrescrita pessoal | 248 (229 church, 17 campo, 1 admin, 1 master) |
| Telas/componentes `.tsx` | 483 |
| `<button>` no código | ≈ 3.454 |
| Rotas do SPA | 376 |
| Arquivos de rota da API que usam `user.churchId` | 68 |
| `user_campos` (troca de campo) | 4 linhas, 2 usuários |

### 0.3 O impacto de "o grupo domina"

Se a regra do grupo passasse a valer por cima da pessoal **no dia do deploy**:

| Função | Usuários afetados | Regras que mudam | Perdem acesso | Ganham acesso |
|---|---|---|---|---|
| tesoureiro | 99 | 4.728 | 2.019 | 2.709 |
| secretario | 73 | 21.290 | 2.865 | 18.425 |
| camposec | 8 | 1.163 | 908 | 255 |
| campotes | 2 | 705 | 705 | 0 |

**182 usuários mudariam de acesso de uma vez.** Daí a decisão D5.

### 0.4 Acesso por igreja hoje

Uma igreja por usuário (`users.church_id`). Perfil `church`, ou função cujo
nome contém "secret" ou "tesour", fica preso a ela (`isRestrictedToOwnChurch`,
`src/lib/auth.ts:41`). O filtro está espalhado em 68 arquivos de rota.

---

## 1. Decisões

D1 a D4 foram tomadas pelo dono em 16/10/2026.

### D1 — Grupo de usuários é novo; as funções atuais continuam categorias

**Revisada pelo dono em 16/10/2026.** Tesoureiro, secretario, camposec e
campotes são *categorias* e **não** viram grupo: os usuários delas continuam
exatamente com as regras de hoje. Grupo é coisa nova e vazia — o administrador
cria, por exemplo, "Tesoureiro geral", põe três usuários e configura.

Por isso o grupo tem tabela própria (`grupos_usuarios`), e não fica em `roles`.
Se ficasse lá, apareceria como categoria no cadastro de usuário, e um grupo
chamado "Tesoureiro geral" cairia na trava de `isRestrictedToOwnChurch`, que
procura "tesour" no nome da função. O grupo pertence a um campo (isolamento
por campo). A tela fica em **Configurações → Grupos de usuários**.

### D2 — No grupo, a sobrescrita pessoal fica guardada sem efeito

Nada é apagado de `users.permissions`. Enquanto o usuário estiver em ao menos
um grupo, vale só a regra do(s) grupo(s) — nem a sobrescrita pessoal, nem a
categoria. Se ele sair de todos os grupos, volta tudo como era.

### D3 — Vários grupos por usuário; libera se algum liberar

Permissão efetiva = OU entre os grupos do usuário. Igrejas acessíveis = união
das igrejas dos grupos.

### D4 — Bloqueio na tela e no servidor

O componente marcado some da tela, e a rota da ação (salvar, excluir,
exportar...) recusa com 403 a mesma chave. Uma única função de resolução serve
aos dois lados.

### D5 — Nenhum usuário ativo muda no deploy

Consequência de D1 e de 0.3: como nenhum usuário entra em grupo
automaticamente, os 182 de 0.3 não mudam. O grupo começa a valer para alguém
só quando o administrador o põe lá. O grupo é whitelist: vale o que foi
marcado (D6/D7), e o que não foi marcado é negado — "somente os botões e menus
que eu criar".

### D6 — A árvore de componentes sai do código, não de adivinhação

Não dá para o sistema "olhar" um botão e saber, com segurança, o que ele faz.
Cada ponto controlável é marcado no código:

```tsx
<Permissao chave="members.lista.exportar" rotulo="Exportar" herda="members.view">
  <button>Exportar</button>
</Permissao>
```

```ts
// rota da API da mesma ação
await exigirPermissao(user, 'members.lista.exportar');
```

O script `scripts/gerar-arvore-permissoes.mjs` varre o código, acha todas as
marcações e gera a árvore **módulo → tela → componente**, que a tela de grupos
mostra com check e uncheck. A árvore é sempre a do código; uma CI falha se o
arquivo gerado estiver desatualizado.

`herda` é o que garante que **marcar um botão não muda o acesso de ninguém**:
fora de grupo, a chave nova vale o mesmo que a chave de onde saiu. Dentro de
um grupo que ainda não decidiu a chave (botão marcado depois de o grupo ser
configurado), ela também herda do pai **naquele grupo**.

### D7 — Pai bloqueado bloqueia os filhos

Tela sem `view` esconde todos os botões dela, mesmo os marcados. Em grupo,
vale também para as ações genéricas da tela (Criar/Editar/Excluir ficam abaixo
da raiz na árvore): tela bloqueada bloqueia as três.

### D8 — A árvore é por tela, com os componentes reais (pedido do dono)

As colunas Ver/Criar/Editar/Excluir iguais para toda tela não serviam: o
"Excluir" do Dashboard não controla nada. A árvore (`ArvorePermissoes.tsx`,
usada no Grupo e nas Permissões do usuário) mostra:

```
Tela (raiz)                         → abre a tela / mostra no menu
├─ botões, abas e relatórios reais  → marcados com <Permissao>
└─ Criar / Editar / Excluir         → SÓ se algum arquivo usa essa trava
     └─ botões que herdam dela         genérica (canCreate('x'), 'x.edit'...)
```

Marcar a raiz marca a tela inteira; marcar um botão liga o caminho até a raiz;
desmarcar desliga tudo abaixo. No usuário, o ciclo continua padrão →
permitido → bloqueado, e na raiz vale para a tela inteira.

Quais ações genéricas "existem" sai do código (`ACOES_GENERICAS_EM_USO` no
arquivo gerado). Chamada dinâmica (`canCreate(PERM_KEY)`) não dá para ler:
nesse arquivo e nos importados diretos, a ação vale para toda tela citada —
mostra a mais, nunca esconde uma que funciona (assim o Mobile, que lê as
chaves de `src/lib/mobile/definicoes.ts`, aparece inteiro). A ação oculta
acompanha a raiz.

### D9 — Premissa: recurso novo de tela nasce na árvore

Regra nº 2 do AGENTS.md. `npm run build` roda `permissoes:check` antes de
tudo e falha se a árvore gerada estiver desatualizada ou se algum arquivo
tiver mais botões de ação sem `<Permissao>` que a foto
`scripts/permissoes-pendentes.json`. A foto só diminui.

---

## 2. Modelo de dados (fase 1)

Três tabelas novas. `roles` e `users` não são alteradas, e não há backfill.

| Tabela | Conteúdo |
|---|---|
| `grupos_usuarios` | o grupo: campo, nome, descrição, `permissions` (JSONB no mesmo formato de `roles.permissions`: `{"members.view": true, ...}`), ativo, soft delete |
| `grupos_usuarios_users` | usuário ↔ grupo, N:N (D3) |
| `grupos_usuarios_igrejas` | igrejas que os usuários do grupo acessam (D3: união). Criada na fase 1, **aplicada só na fase 3** |

As três com RLS ligada e sem política: só a API (Prisma) lê e grava, como
`user_campos` e as tabelas do Asaas. Migration
`prisma/migrations/20261016150000_grupos_usuarios` e **baseline regerado**
(AGENTS.md, regra nº 1).

---

## 3. Resolução nova

```
master                    → libera
usuário em ≥1 grupo ativo → OU de permissions[chave] entre os grupos dele;
                            chave ausente → herda do pai no mesmo grupo;
                            sem pai → negado. Categoria e sobrescrita pessoal
                            ignoradas (D2)
senão                     → regra de hoje, sem mudança
```

`herda` resolve recursivamente até a chave do módulo, e o pai negado nega o
filho (D7). A mesma função roda no front (`usePermissions`) e no servidor
(`exigirPermissao`).

---

## 4. Fases

Cada fase é um PR separado, com E2E de escrita.

| Fase | Entrega | Banco |
|---|---|---|
| **1. Fundação** | Tabelas da seção 2; resolução nova; `<Permissao>`, `usePode`, `exigirPermissao`; script da árvore; tela **Configurações → Grupos de usuários** (regras em árvore com check/uncheck, usuários do grupo); aviso na tela de permissões do usuário quando ele está em grupo | DDL + baseline |
| **2. Marcação** | Marcar os componentes **módulo por módulo**, com bloqueio no servidor nas ações. Ordem proposta: Secretaria (membros, relatórios, exportar), Finanças, Gestão de Culto, demais | só código |
| **3. Igrejas por grupo** | `grupos_usuarios_igrejas` passa a valer: filtro de igreja das 68 rotas + RLS do navegador | código, talvez RLS |

Nenhuma fase muda o acesso de quem não está em grupo (D5).

---

## 4.1 Andamento da marcação (fase 2)

Medido com `npm run permissoes:auditoria`.

| Data | Componentes na árvore | Botões de ação ainda sem marcação |
|---|---|---|
| 16/10/2026 | 33 (Relatórios de Secretaria) | 939 em 251 arquivos |

## 5. Não faz (ainda)

- Não remove `users.role_id` nem `users.permissions`.
- Não altera os perfis (`master`, `admin`, `campo`, `church`).
- Não "descobre" botões sozinho em tempo de execução (D6).
