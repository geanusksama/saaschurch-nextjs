# Isolamento por campo e campos navegáveis

Implantado em 2026-10-13, depois da migração de Aguaí (membrosweb). Migration
`20261013120000_isolamento_campo`, baseline `d23a12c3d91c0f1a`.

## A regra

**O campo ativo do usuário filtra tudo, para todo perfil — master inclusive.**

O campo ativo é `users.campo_id` (`AuthUser.campoId`). Estando em Aguaí, nada
de Campinas aparece: membro, lançamento, conta a pagar, credor, contador, culto,
sede, notificação. Para ver outro campo, troca-se de campo pelo seletor
"Alternar Campo".

A única exceção é o **master sem campo** (conta global, sem lotação): esse
continua sem filtro. Todo master com campo fica preso a ele.

## Quem troca de campo

| Quem | Para onde | Senha |
|---|---|---|
| master | qualquer campo | senha do campo (`campos.access_password_hash`) |
| qualquer outro perfil | só os campos que o master liberou em `user_campos` | nenhuma — a liberação é a autorização |

Admin **não** troca de campo por conta própria (antes trocava com a senha do
campo). Precisa ser liberado pelo master, como qualquer usuário.

O seletor aparece:
- para o master, depois do destravamento em Configurações (regra antiga,
  `lib/campoVisibility.ts`);
- para quem tem mais de um campo liberado (`canSwitchField` em
  `GET /api/context-switcher/options`), sem destravar nada.

## Liberar campos para um usuário (tela do master)

Em **Sistema → Usuários → Novo/Editar**, o master vê o quadro "Campos que pode
navegar" (`src/app-ui/system/CamposNavegaveis.tsx`). Para cada campo marcado,
escolhe a igreja em que o usuário fica naquele campo.

A igreja é necessária para perfil igreja, secretaria e tesouraria: esses perfis
só enxergam a própria igreja (`isRestrictedToOwnChurch`), então sem a igreja do
outro campo eles entrariam nele e não veriam nada.

Também na tela do usuário: ao escolher o campo do cadastro, regional e igreja
são recarregadas daquele campo (`/api/regionais?campoId=`,
`/api/churches?fieldId=`). Antes vinham só do campo em que o master estava, e
cadastrar alguém de Aguaí estando em Campinas deixava as listas vazias.

## Tabela `user_campos`

Uma linha por (usuário, campo), com a lotação (`church_id`, `regional_id`) que
o usuário assume ao entrar no campo.

- O campo do cadastro entra sempre que houver algum extra — senão quem sai dele
  não conseguiria voltar.
- Lista de extras vazia = nenhuma linha = seletor some, usuário preso ao campo.
- RLS ligado **sem política**: o navegador não lê nem grava. Só a API (Prisma)
  mexe, e só o master manda `camposNavegaveis` em `POST/PATCH /api/users`.

Código: `src/lib/camposNavegaveis.ts`.

## A troca (`POST /api/context-switcher/verify-field`)

1. guarda a lotação atual na linha do campo de onde o usuário sai;
2. grava em `users.campo_id/church_id/regional_id` a lotação do campo destino
   (a guardada; senão a atual, se for do destino; senão nenhuma — nunca uma
   igreja de outro campo);
3. esquece a sessão em cache (`esquecerSessao`, `lib/auth.ts`) para a próxima
   requisição já ler o campo novo;
4. devolve a lotação; o front grava em `mrm_user`, limpa filtros guardados
   (`secretaria-*-filters`, `secretaria-cache`, `mrm_permissions`) e recarrega.

Antes, escolher um campo **sem** senha trocava só no navegador — o servidor
continuava no campo antigo. Agora toda troca passa pelo servidor.

`GET /api/context-switcher/options` devolve o campo e a lotação do servidor
(`activeFieldId`, `activeChurchId`, `activeRegionalId` e nomes). O `AppUI`
compara com o `mrm_user` guardado no navegador; se estiver diferente, corrige,
limpa os filtros guardados e recarrega **uma vez**. Isso cobre quem trocou de
campo em outro aparelho ou antes desta versão — caso real de 2026-10-13: o
master estava em Aguaí no banco, mas o navegador ainda tinha a AD Campinas -
SEDE, a tela de Membros abria com ela marcada e a barreira devolvia 403. Não
há laço: `/api/auth/me` e o login gravam esses campos com o mesmo critério.

## Gestão de Culto

As posições do usuário (`culto_posicoes`: tesoureiro, secretário, dirigente,
presidente) valem só no campo ativo (`getCultoScope` e `visao-bloqueada`
filtram por `campo_id`). O master anexado como dirigente/presidente em
Campinas não vê esses cards — nem tem poder de presidente — estando em Aguaí.

## Camada 1 — rotas `/api` (Prisma)

`src/lib/campoAtivo.ts`:

- **`barreiraDeCampo`**, chamada pelo `withAuth` em toda rota autenticada:
  querystring com `campoId`/`fieldId`, `churchId`/`churchIds`,
  `regionalId`/`regionalIds` (e variações) apontando para fora do campo ativo →
  `403 { code: "FORA_DO_CAMPO" }`. Pega até rota que esqueceu de filtrar.
  Exceção: rotas de **estrutura** para o master (`/api/regionais`,
  `/api/churches`, `/api/campos*`, `/api/users*`, `/api/context-switcher*`),
  que ele usa para cadastrar usuário de outro campo. Nenhuma delas devolve dado
  de trabalho.
- `igrejaDoCampoWhere`, `igrejaNoCampoAtivo`, `regionalNoCampoAtivo`,
  `sedeNoCampoAtivo`, `itemDaSedeNoCampoAtivo`, `filtroDoCampoAtivo` — para
  montar `where` e conferir ids que chegam no caminho ou no corpo.

Helpers centrais que passaram a obedecer ao campo ativo também para o master:
`assertChurchAccess` e `resolveScopedFieldId`/`kanScopeFilter` (`helpers.ts`),
`escopoDeIgrejas`/`podeAcessarIgreja` (`contasPagarScope.ts`),
`escopoDoDashboard` (`financeDashboardScope.ts`).

**Regra para rota nova:** nunca `if (user.profileType !== "master") filtrar`.
Use os helpers acima, ou `if (user.profileType !== "master" || user.campoId)`.
Id que chega no corpo (`churchId`, `regionalId`) não passa pela barreira —
confira com `igrejaNoCampoAtivo`/`regionalNoCampoAtivo`.

## Camada 2 — navegador (Supabase direto, RLS)

Livro Caixa, Diretoria, Planilha e outras telas leem `livro_caixa`, `members`,
`churches` e `regionais` direto do navegador. A política antiga era só
`fn_usuario_sistema()` ("é usuário do sistema?") — qualquer logado lia todos os
campos. Agora:

- `fn_meu_campo_id()` — campo ativo do usuário logado (mesmo critério do
  `auth.ts`: `users.campo_id`, ou campo da regional, ou da regional da igreja);
- `fn_igrejas_do_meu_campo()` — ids das igrejas desse campo;
- `regionais`: `campo_id = fn_meu_campo_id()`;
- `churches`, `members`, `livro_caixa`: id/church_id em
  `fn_igrejas_do_meu_campo()` — leitura **e** gravação (`with check`);
- `users`: só leitura, do próprio campo ou o próprio cadastro;
- `roles`: só leitura.

Prisma conecta como `postgres` e o `supabaseAdmin` usa `service_role`: nenhum
dos dois passa por RLS, então rotas e serviços não mudam de comportamento.

Medido no ensaio (master em Aguaí, papel `authenticated`): 1 regional, 9
igrejas, 544 membros, 16.851 lançamentos — de 354.603 no banco. Consulta típica
do Livro Caixa: 7 ms.

## Falhas de segurança corrigidas junto

| Onde | Falha | Correção |
|---|---|---|
| RLS `users` / `roles` | qualquer usuário logado gravava `profile_type='master'` ou outro `campo_id` no próprio cadastro pela API REST do Supabase | só leitura para `authenticated` |
| `PATCH /api/users/[id]` | corpo inteiro ia para o `update` (perfil, permissões, e-mail…) | lista de campos permitidos; perfil/função/admin só o master; ninguém mexe em master se não for master |
| `POST /api/users` | perfil campo/admin criava conta master | `podeAtribuirPerfil` |
| `POST /api/users/[id]/reset-password` | admin trocava a senha de um master do mesmo campo | `podeGerenciarUsuario` |
| `PATCH /api/users/[id]/permissions` | usuário editava as próprias permissões e as de master | idem + bloqueio de autoedição |
| `POST /api/users/create-supabase-auth` | criava login para e-mail de master importado sem login | `podeGerenciarUsuario` pelo perfil do e-mail |
| `PATCH /api/credential-requests/[id]` | sem nenhuma conferência | `assertChurchAccess` |
| `GET /api/churches/[id]` (pública) | devolvia `access_password_hash` do campo | `omit` do hash |
| `POST /api/notifications` | qualquer usuário mandava aviso para outro campo pelo corpo | campo ativo |
| contadores da contabilidade | lista e rotas por id mostravam contadores (com telefone e hash) de todos os campos | filtro pelo campo ativo |
| sede (`headquarters`) | admin/campo de outro campo editava horários e acessos | `sedeNoCampoAtivo` |
| `POST/PATCH /api/churches` | criava/movia igreja para regional de outro campo | `regionalNoCampoAtivo` |

## Pendências conhecidas (não tratadas aqui)

- **WhatsApp** (conversas, campanhas, importações, instâncias): o escopo é por
  dono (`owner_user_id`), não por campo; o master vê de todos.
- **Logs de auditoria** (`/api/audit-logs`): só master, sem filtro de campo.
- **RLS das outras ~245 tabelas** continua `fn_usuario_sistema()` — com
  gravação liberada para qualquer usuário logado pela API REST. As telas que
  usam essas tabelas direto do navegador (pastoral, eventos, app, WhatsApp)
  ainda dependem do filtro feito na própria tela.
- **`campos` com `select using (true)` para `anon`**: a coluna
  `access_password_hash` é legível pela chave pública. Revogar a coluna não se
  sustenta (o baseline regrava `grant select` na tabela inteira); o caminho é
  mover o hash para uma tabela sem acesso público.
- O cache de sessão (`auth.ts`, 10 s) é por instância: na Vercel, outra
  instância pode servir o campo antigo por até 10 s depois da troca.

## Teste

`node scripts/e2e-isolamento-campo.mjs` (com `npm run dev` rodando): cria 3
campos `[E2E]`, uma tesoureira, libera um segundo campo, troca e confere API e
RLS nos dois lados, tenta escalar perfil — 29 verificações. Apaga tudo no fim.
