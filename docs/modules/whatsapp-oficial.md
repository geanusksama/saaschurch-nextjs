# WhatsApp Oficial (Meta Cloud API) — módulo

Situação em 23/11/2026: **Etapa 1 (base) e Etapa 2 (modelos) prontas no código**. Ainda não estão liberadas para as igrejas (ver "Pendências").
Spec: `docs/superpowers/specs/2026-11-23-whatsapp-oficial-meta-design.md` (com o "Adendo aprovado pelo dono").
Plano: `docs/superpowers/plans/2026-11-23-whatsapp-oficial-etapa1-base.md`.

## 1. O que é e o que não é

- É o caminho **oficial** da Meta para WhatsApp: cada igreja conecta o **próprio número** pelo botão "Conectar com a Meta" (Embedded Signup v4) na tela **WhatsApp Oficial**.
- **Uma conexão por campo** (igreja). Uma igreja nunca vê o número de outra.
- O token de cada número fica **criptografado** no banco da própria igreja.
- A Etapa 1 só conecta, mostra status (número, qualidade, limite diário) e desconecta. Ainda **não envia** mensagens.
- **Não é** a Z-API. O módulo Z-API (telas, rotas, tabelas, crons) continua como está; nada é compartilhado com ele (exceção: o aviso do monitor usa uma instância Z-API só para mandar o alerta ao dono).

## 2. Fatos fixos da conta Meta

| Item | Valor |
|---|---|
| App | "ZionByte", ID `3371798666355530` |
| Portfólio empresarial | ZionByte, `business_id` `2291140898081009` |
| Papel | Tech Provider (independente), não Solution Partner |
| Política de privacidade | https://zionbyte.com.br/privacidade |
| Termos | https://zionbyte.com.br/termos |
| Exclusão de dados | https://zionbyte.com.br/exclusao-de-dados |

As três páginas ficam no site da ZionByte (não neste projeto) e já estão cadastradas no app.

## 3. Variáveis de ambiente

Lista derivada do código (`src/lib/meta/*`, `src/app/api/meta/**`, `src/app/api/cron/meta-monitor`). Valores nunca ficam neste documento.

Valores do app (ID, configuração do Embedded Signup, versão da Graph, token do webhook, chave secreta) vivem na **configuração central**: tabela `meta_app_config` no banco do **base** (Campinas), editada na tela do master. As demais igrejas leem do base. As variáveis `META_APP_ID` etc. servem só de **reserva** quando a central não responde ou o campo está vazio.

| Variável | Onde vale | Obrigatória? | Para que serve |
|---|---|---|---|
| `META_TOKEN_ENCRYPTION_KEY` | todas | **Sim** | Chave (hex, 64 caracteres) que cifra os tokens da Meta no banco. Cada implantação pode ter a sua. No base também cifra a chave secreta do app em `meta_app_config`. Sem ela, nada funciona. Gerar com `openssl rand -hex 32`. Trocar a chave invalida tokens já gravados. |
| `META_CALLBACK_BASE_URL` | todas | **Sim** | Endereço público HTTPS da própria igreja (sem barra final). Vira o `override_callback_uri` do webhook (`<base>/api/meta/whatsapp/webhook`). Sem ela a conexão e o webhook respondem 503. |
| `CRON_SECRET` | todas | **Sim** (para o monitor) | Segredo dos crons. A rota `/api/cron/meta-monitor` recusa (401) sem ele. Já existe nas igrejas por causa dos outros crons. |
| `META_CONFIG_BASE` | só base | Sim no base | `1` marca esta implantação como base: lê a configuração do próprio banco e serve a rota `/api/meta/app-config`. Nas igrejas, não definir. |
| `META_CONFIG_SYNC_TOKEN` | base e igrejas | Sim | Segredo compartilhado (**igual no base e nas igrejas**) da rota servidor-a-servidor `GET /api/meta/app-config` (cabeçalho `x-meta-config-token`). |
| `META_CONFIG_URL` | só igrejas (não-base) | Sim nas igrejas | Endereço HTTPS do base de onde ler a configuração central. Cache de 5 min; se o base cair, usa o valor anterior por até 1 h (sem liberar a conexão) e depois o ambiente. |
| `META_APP_ID` | base (reserva: todas) | Opcional | Reserva do ID do app (`3371798666355530`). |
| `META_APP_SECRET` | base (reserva: todas) | Opcional | Reserva da chave secreta do app. |
| `META_ES_CONFIG_ID` | base (reserva: todas) | Opcional | Reserva do ID de configuração do Embedded Signup. |
| `META_WEBHOOK_VERIFY_TOKEN` | base (reserva: todas) | Opcional | Reserva do token de verificação do webhook. Se vazio em todas as fontes, a rota recusa. |
| `META_GRAPH_VERSION` | base (reserva: todas) | Opcional | Reserva da versão da Graph API (formato `v27.0`). |
| `META_ALERTA_WHATSAPP` | só base (onde roda o monitor com alertas) | Opcional | Número (só dígitos) do dono que recebe o aviso de alerta novo. Sem ele o alerta só aparece na tela. |
| `META_ALERTA_INSTANCIA_ID` | só base | Opcional | ID da instância Z-API (`whatsapp_instances`, ativa e conectada) que envia o aviso. Sem ela usa a conectada mais antiga; pode sair de instância de outro campo. |

Observações:
- Não existe variável para o interruptor de liberação: ele fica no banco, na tela do master.
- `META_LEADS_CONFIG_ID` aparece no spec, mas só será usado na Etapa 5 (leads); hoje nada lê essa variável.
- O código lê a configuração incompleta como erro ("Configuração da Meta incompleta: …" lista os nomes que faltam).

## 4. Subir uma igreja nova (Coolify)

1. Criar o app e o banco da igreja pelo procedimento normal (ver `docs/infra/MIGRACAO-VILASOLANGE-COOLIFY.md`). As três tabelas (`meta_whatsapp_conexoes`, `meta_app_config` e `meta_alertas`) já estão no `baseline/` (commits 9f78c53 e 9a19ee3 no painelchurch; conferido com `grep` em `05_tables.sql`), então o `migrate-self` as cria no banco da igreja no deploy. Não rode as migrations do Prisma na igreja nova.
2. Em **Environment Variables** do app, cadastrar (igreja não-base): `META_TOKEN_ENCRYPTION_KEY` (gerar uma nova), `META_CALLBACK_BASE_URL` (HTTPS do domínio da igreja), `META_CONFIG_URL` (HTTPS do base), `META_CONFIG_SYNC_TOKEN` (mesmo valor do base) e `CRON_SECRET`. **Não** definir `META_CONFIG_BASE`.
3. **Scheduled Task** do app, nome `cron-meta-monitor`, frequência `0 11 * * *` (diário, 11:00 UTC), comando:
   `curl -fsS -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/meta-monitor`
   (mesmo padrão dos crons `cron-contabilidade`, `cron-whatsapp-ai`, `cron-pastoral-cronograma`). Na Vercel o agendamento já está em `vercel.json`. Cuidado para não rodar em dobro se a mesma igreja estiver nos dois lugares.
4. No **app Meta** (developers.facebook.com, app ZionByte), incluir o **domínio da igreja** (HTTPS) em **Allowed domains** do Embedded Signup e em **Valid OAuth redirect URIs** (Facebook Login for Business). Sem isso o popup de conexão não abre. Só o dono/administrador do app faz.
5. Subir o deploy e conferir: `GET /api/cron/meta-monitor` sem segredo deve dar 401.
6. Como a igreja conecta: usuário com permissão abre **WhatsApp Oficial**. O botão **"Conectar com a Meta"** só aparece se o master ligou **"Liberar conexão para as igrejas"** na tela Meta – App oficial; desligado, a tela mostra "Em breve". Ao concluir o Embedded Signup (clicar em "Concluir"), o servidor troca o código, registra o número e assina o webhook apontando para `META_CALLBACK_BASE_URL`. A tela mostra número, qualidade e limite diário, com botão **Desconectar**.

O Embedded Signup só funciona em **HTTPS no domínio liberado** (localhost não funciona para o fluxo real).

## 5. Tela do master "Meta – App oficial" (`system/meta-app`)

Só no sistema base, só para master. Permissão de edição: `meta_app.config.editar`.

- **Liberar conexão para as igrejas** (interruptor): desligado, todas as igrejas veem "Em breve"; ligado, aparece "Conectar com a Meta".
- **ID do app**, **Configuração do Embedded Signup**, **Versão da Graph API** (ex.: `v27.0`), **Token do webhook**: valores centrais lidos por todas as igrejas (cache de até 5 min). Salvar grava só o que foi preenchido.
- **Chave secreta**: só mostra "definida / não definida". Para trocar, digitar a nova e salvar; vazio mantém a atual. Nunca é exibida.
- **Status**: presença do ID e da configuração, versão da Graph, botão **Testar webhook** (faz o desafio de verificação contra a própria rota), links para a verificação da empresa e a análise do app na Meta.
- **Alertas**: o monitor diário grava alertas (versão da Graph perto de desativar ou desconhecida, conexão com erro/token recusado, qualidade do número média ou baixa, webhook sem resposta, falha temporária do monitor). Cada alerta tem **Marcar como resolvido**; os que trazem proposta (ex.: atualizar a versão da Graph) têm **Aprovar**, que aplica a mudança e resolve o alerta.
- **O monitor nunca muda nada sozinho**: só registra, avisa o dono pelo WhatsApp (se `META_ALERTA_WHATSAPP` estiver definido) e propõe. A mudança só acontece quando o master clica em Aprovar. A tabela de versões da Graph e seus prazos de desativação fica no código (`VERSOES_GRAPH` em `src/lib/meta/monitorMeta.ts`); hoje só tem `v27.0`, sem data de desativação (nenhuma data foi inventada) — atualizar quando a Meta divulgar.

## 6. Pendências conhecidas (23/11/2026)

- **Migrations `20261124010000_meta_app_config` e `20261124020000_meta_alertas` ainda não aplicadas** em produção (nem `migrate resolve`, `prisma generate` e baseline). Aguardam o "sim" do dono. Só a `..000000_meta_whatsapp_conexoes` foi aplicada (baseline dela no painelchurch, commit 9f78c53, branch `feat/baseline-site-eventos`).
- **Baseline** das duas migrations acima ainda por fazer. O `scripts/dump-baseline.mjs` do painelchurch tem caminhos `D:/` fixos e não roda no Linux sem contorno.
- **Verificação da empresa na Meta parada**: aguardando as bases públicas atualizarem o telefone no cadastro do MEI (atualizado pelo dono em 23/11; CCMEI em `/mnt/dados/projetos/FRONTBACK/ccmei.pdf`).
- **App Review (vídeos)** só depois do fluxo real funcionar ponta a ponta; é pedido ao fim da Etapa 3. Até lá o app fica em modo de desenvolvimento com o número de teste (sandbox de 90 dias).
- **Embedded Signup só funciona em HTTPS no domínio liberado** no app Meta; o teste real é no domínio de Campinas.
- **Teste ponta a ponta autenticado** (`scripts/e2e-meta-whatsapp.mjs`) exige `MRM_TOKEN`; não foi executado por completo. Testes unitários: `node --test scripts/teste-meta-whatsapp.mjs`.
- Configuração do app Meta, variáveis na Vercel de Campinas e o teste real com o número de teste (Task 7, passos 1, 2 e 4) são feitos com o dono, fora do código.
- Menores adiados: tipar o retorno do Graph (alguns `any` em `graph.ts`); aviso do `mesclarComEnv` a cada requisição pode inundar o log; sem `META_ALERTA_INSTANCIA_ID` o aviso pode sair de instância de qualquer campo.

## 7. Etapa 2: central "Meta Oficial" e modelos de mensagem

### 7.1 Central "Meta Oficial"

- Entrada: **Configurações → Comunicação → cartão "Meta Oficial"**. No menu lateral é um item único, "Meta Oficial", com a permissão `whatsapp_oficial`.
- Rota: `/app-ui/system/meta-oficial`, com abas em `?aba=`: `visao-geral`, `conexao`, `modelos`, `envio`, `conversas`, `leads` e `app`.
- Abas `envio`, `conversas` e `leads` ainda são "Em breve" (Etapas 3, 4 e 5).
- A aba **App** (configuração central da Meta) só aparece para master.
- Rotas antigas que redirecionam: `system/whatsapp-oficial` vai para `?aba=conexao` e `system/meta-app` vai para `?aba=app`. A tela de configuração central descrita na seção 5 passou a ser a aba App.

### 7.2 Modelos (tabela `meta_whatsapp_modelos`)

- Migration `20261124030000_meta_whatsapp_modelos` (`prisma/migrations/`). Já está no `baseline/` (`05_tables.sql`, manifest `5efc5aecf0f125da`), então o `migrate-self` cria a tabela nas igrejas no deploy.
- Uma linha por modelo e por campo: a unicidade é `(campo_id, meta_template_id)`. RLS ligado sem política: só o servidor acessa.
- Colunas principais:
  - `campo_id` (dono da linha, com `ON DELETE CASCADE`), `waba_id`, `meta_template_id` (id que a Meta devolve).
  - `nome`, `idioma` (padrão `pt_BR`), `categoria` (`MARKETING` ou `UTILITY`).
  - `status` (`APPROVED`, `PENDING`, `REJECTED`, `PAUSED`, `DISABLED`; rótulos em `ROTULO_STATUS`) e `motivo_recusa`.
  - `componentes` (JSON do template como a Meta recebe: cabeçalho, corpo, rodapé, botões).
  - `variaveis` (JSON, ver abaixo), `criado_por`, `criado_em`, `atualizado_em`, `sincronizado_em`.
- Significado de `variaveis`: são as variáveis do corpo, na ordem de `{{1}}`, `{{2}}` etc. Cada item tem `posicao`, `tipo` (`nome`, `igreja`, `data` ou `livre`) e `exemplo`. Se o cabeçalho tem variável, ela entra como **último item com `posicao: 0`** (tipo e exemplo do cabeçalho). Quem lê `variaveis` tem que tratar `posicao: 0` como cabeçalho, não como `{{0}}` do corpo.
- Regras validadas (`src/lib/meta/modelos.ts`, função `validarRascunho`; forma do corpo em `normalizarRascunho`):
  - Nome de 1 a 512 caracteres, só minúsculas, números e sublinhado (`nomeDoTitulo` converte um título para esse formato).
  - Categoria `MARKETING` ou `UTILITY`.
  - Cabeçalho de no máximo 60 caracteres, com no máximo 1 variável, que tem que ser `{{1}}` e precisa de exemplo.
  - Corpo de 1 a 1024 caracteres; não pode começar nem terminar com variável; as variáveis são sequenciais a partir de `{{1}}`, sem pular número, e cada uma precisa de exemplo.
  - Rodapé de no máximo 60 caracteres, sem variável.
  - Até 3 botões de resposta rápida, cada um de 1 a 25 caracteres.
  - Limites de forma no servidor: até 20 variáveis; exemplo de até 200 caracteres.
- **Duplicar em vez de editar.** A tela oferece "Duplicar" (abre o editor com os dados do modelo, para criar um novo). A tela também tem "Atualizar" (sincroniza com a Meta) e "Excluir", com confirmação na própria linha.

### 7.3 Rotas

| Método e rota | Permissão | O que faz |
|---|---|---|
| `GET /api/meta/whatsapp/modelos` | `whatsapp_oficial.modelos.view` | Lista os modelos do campo. Devolve `conectado: false` e lista vazia se não há conexão ativa. |
| `POST /api/meta/whatsapp/modelos` | `whatsapp_oficial.modelos.criar` | Valida o corpo e cria o modelo na Meta (201). |
| `DELETE /api/meta/whatsapp/modelos/[id]` | `whatsapp_oficial.modelos.excluir` | Exclui o modelo do campo. `id` fora do formato UUID devolve 404. |
| `POST /api/meta/whatsapp/modelos/sincronizar` | `whatsapp_oficial.modelos.view` | Puxa da Meta a lista de modelos do campo e substitui a linhas locais (mantém `variaveis` e `criado_por` dos que já existiam). |

- As três chaves de permissão `whatsapp_oficial.modelos.view`, `.criar` e `.excluir` estão no catálogo (`src/app-ui/system/permissionCatalog.ts`, grupo "WhatsApp Oficial (Meta)") e na árvore gerada (`src/lib/permissoes/arvore.generated.ts`).
- O sincronizar usa a chave `.view`, não tem chave própria. Quem pode ver a tela de modelos pode forçar a sincronização.

### 7.4 Cron de status dos modelos

- Rota: `GET /api/cron/meta-modelos`. Agendada em `vercel.json` para `15 * * * *` (todo início de hora, no minuto 15).
- Sincroniza os modelos de cada campo com conexão ativa: 3 campos por vez, prazo total de 45 s; erro de um campo não para os outros.
- Proteção: `CRON_SECRET`, em `Authorization: Bearer` ou no cabeçalho `x-cron-secret`. Sem ele, 401.
- Se a tabela `meta_whatsapp_modelos` não existe (erro Prisma `P2021`), a rota responde **200** com `{ ok: false, motivo: "tabela ausente" }`. Não derruba o cron.
- **Igrejas no Coolify**: criar a Scheduled Task do app, nome `cron-meta-modelos`, frequência `15 * * * *`, comando:
  `curl -fsS -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/meta-modelos`
  Mesmo padrão do `cron-meta-monitor` da seção 4. Cuidado para não rodar em dobro se a mesma igreja estiver nos dois lugares.

### 7.5 Conexão do master (modo de teste)

- O botão "Conectar com a Meta" é liberado pela regra do servidor em `GET /api/meta/whatsapp/config`: o campo `podeConectar` vale `true` se o interruptor "Liberar conexão para as igrejas" está ligado **ou** se o usuário é `profileType === 'master'`.
- Hoje o interruptor está **desligado**. Só o master conecta; o resto das igrejas vê "Em breve" (`src/app-ui/system/WhatsAppOficial.tsx`). A tela mostra "Modo de teste do master: as igrejas ainda veem 'Em breve'".
- Quando o interruptor for ligado, todas as igrejas passam a ver o botão de conexão.

### 7.6 Número de teste da Meta

- Número de teste no app ZionByte: **+1 555 164-9830**, phone number id `1507409935782334`, WABA `2262371601355109`.
- Destinatário de teste cadastrado: o número do dono (não registrado neste documento).
- Enquanto o app estiver em modo de desenvolvimento, só esse número de teste envia e recebe.

### 7.7 Pendências para ligar de verdade

- **Configuração do Cadastro Incorporado (config id)**: pendente. Confirmar o valor na configuração central (aba App) antes de ligar a conexão.
- **Domínio `www.adcampinas.com.br`**: precisa estar em **Allowed domains** do Embedded Signup e em **Valid OAuth redirect URIs** no app Meta. Só o dono faz.
- **Webhook**: pendente conferir o desafio de verificação e a assinatura no domínio de Campinas (o Embedded Signup só funciona em HTTPS no domínio liberado).
- **Alertas das igrejas para o master**: Etapa seguinte.

## 8. Próximas etapas

1. **Base** (feita): configuração do app, conectar número, tela de status.
2. **Modelos** (feita no código; ver seção 7): listar modelos da conta com status e categoria; criar modelo e enviar à aprovação da Meta; status atualizado por cron.
3. **Envio em massa**: fila por cron, em lotes, com modelo aprovado, limite diário, qualidade do número e lista de exclusão ("SAIR"); acompanhamento enviado/entregue/lido/falhou.
4. **Respostas**: webhook de mensagens recebidas e caixa de conversas própria, com janela de 24 h.
5. **Leads de anúncio**: conectar Página do Facebook/Instagram e trazer leads dos formulários para o pipeline pastoral, com origem "Anúncio".
