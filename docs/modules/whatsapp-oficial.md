# WhatsApp Oficial (Meta Cloud API) — módulo

Situação em 23/11/2026: **Etapa 1 (base), Etapa 2 (modelos) e Etapa 3 (envio em massa) prontas no código**. Ainda não estão liberadas para as igrejas (ver "Pendências").
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

## 8. Etapa 3: envio em massa

Situação: código pronto (23/11/2026). A fila só anda em uma igreja depois da Scheduled Task da seção 8.7. Não liberado para as igrejas (ver seção 7.5).

### 8.1 Tabelas e status

Migration `20261124040000_meta_whatsapp_envio` (`prisma/migrations/`). Está no `baseline/` (`05_tables.sql`, tabelas `meta_whatsapp_disparos`, `meta_whatsapp_envios` e `meta_whatsapp_exclusoes`; manifest `fa5cd82742e71000`), então o `migrate-self` cria as tabelas nas igrejas no deploy.

- `meta_whatsapp_disparos`: um disparo por envio em massa. Guarda modelo (nome, idioma, categoria), `filtros` e `valores` (JSON), `status`, `motivo`, `agendado_para`, `total`, `criado_por`. A chave de idempotência do cliente é o próprio `id` do disparo; em `valores.chave` ela fica só como registro (ver 8.6).
- `meta_whatsapp_envios`: uma linha por pessoa do disparo (`origem` membro ou interessado, `ref_id`, `nome`, `telefone` com 13 dígitos E.164, `parametros` JSON, `wamid`, `status`, `erro_codigo`, `erro`, `enviado_em`).
- `meta_whatsapp_exclusoes`: lista de exclusão do campo (telefone e motivo).

Status do disparo (CHECK no banco): `agendado`, `enviando`, `aguardando_limite`, `pausado`, `concluido`, `cancelado`.

Status do envio (CHECK no banco): `pendente`, `enviado`, `entregue`, `lido`, `falhou`, `ignorado`. Nunca regride: a ordem é `pendente` < `enviado` < `entregue` < `lido`; `falhou` só sobrescreve `pendente` ou `enviado`; `ignorado` não muda (`podeAvancarStatus` em `src/lib/meta/servicoEnvio.ts`).

**Marca de reserva (sem coluna nova):** envio `pendente` com `erro_codigo = -1` está reservado por uma rodada da fila ("em envio"). `atualizado_em` guarda quando foi reservado. A rota de detalhe não devolve o -1: a tela mostra "enviando" e `erroCodigo` sai nulo (`statusDoEnvio` e `MARCA_EM_ENVIO` em `src/lib/meta/envio.ts`; `RESERVADO` em `src/lib/meta/envioRepo.ts`). Pendente livre é `erro_codigo IS NULL`.

Observação: o comentário da migration ainda diz que a rodada põe `now() + 2 min` na reserva. O código usa a marca -1 com `atualizado_em` (cabeçalho de `envioRepo.ts`). Vale o código.

### 8.2 Público

Montado no servidor (`montarPublico`, `listarContatos` e `contarPublico` em `envioRepo.ts`). Pelo menos um dos dois grupos precisa estar escolhido.

- **Membros**: só cadastros sem `deleted_at`, de igrejas do campo. Filtros: igreja, situação (`membership_status`), título eclesiástico (casa pelo texto ou pela FK) e mês de aniversário.
- **Interessados** (leads): só leads sem `deleted_at`, com telefone, de igrejas do campo. Filtros: igreja, origem (`source`) e período de cadastro (data inicial e final, dia inteiro no fuso -03:00).
- **Celular válido só**: `normalizarTelefoneBR` aceita 55 + DDD + celular de 9 dígitos começando com 9. Fixo não entra (conta como "sem celular"). Membro usa o celular e, se não houver, o telefone; interessado usa o telefone.
- **Sem repetir telefone**: `deduplicarPorTelefone`. Membro vence interessado.
- **Lista de exclusão**: quem está em `meta_whatsapp_exclusoes` do campo fica de fora (contado à parte).
- **Teto**: 20.000 pessoas por grupo (`LIMITE_PUBLICO`). Acima disso, o disparo é recusado com a orientação de dividir com filtros.
- O nome da mensagem é o nome preferido ou o primeiro nome do cadastro (`primeiroNome`). Parâmetros são saneados: a Meta recusa quebra de linha, tab ou mais de 4 espaços seguidos (`sanearParametro`).

Na criação, o público é gravado de uma vez (`criarDisparoComEnvios`), com uma linha `pendente` por pessoa.

### 8.3 Fila (cron)

- Rota `GET /api/cron/meta-envio`. Agendada em `vercel.json` como `* * * * *` (todo minuto). Proteção: `CRON_SECRET` em `Authorization: Bearer` ou em `x-cron-secret`; sem ele, 401.
- Sem disparo ativo no campo, a rota responde na hora, sem ler a configuração (`camposComDisparoAtivo`).
- Uma rodada por campo, 3 campos por vez, prazo total de 45 s. Erro de um campo não para os outros. Tabela ausente (`P2021`) responde 200 com `tabela ausente`.
- **Ordem da rodada** (`processarFila`): varre reservas vencidas; lê os disparos ativos (`enviando`, `aguardando_limite` e `agendado` com data já chegada; mais antigos primeiro); pega o token; lê o status do número; aplica as regras de parada; envia.
- **Lote**: no máximo 60 envios por rodada (`MAX_LOTE`), nunca acima do limite restante.
- **Simultâneos**: 5 POSTs ao mesmo tempo (`CONCORRENCIA_ENVIO`). Cada item grava logo após o próprio POST. A cada 10 envios (`CHECAR_STATUS_A_CADA`) a rodada confere se o disparo continua `enviando`; se foi pausado ou cancelado, para.
- **Limite diário restante**: limite do nível do número (`limiteDiario`, ex.: `TIER_250`, `TIER_2K`; nível desconhecido vale 250; `TIER_UNLIMITED` não tem teto) menos os envios do campo com `enviado_em` nas últimas 24 h. É uma aproximação: a Meta conta do jeito dela. Quando zera, os disparos viram `aguardando_limite` (com motivo) e voltam sozinhos quando o limite liberar.
- **Reserva**: a rodada reserva o lote antes de enviar. Quem não chegou a ter o POST começado volta a pendente livre no fim da rodada (`liberarReserva`).

### 8.4 Regras de parada e erros

Antes do envio, ao ler o status do número:

| Situação | O que acontece |
|---|---|
| Qualidade `RED` | Todos os disparos ativos do campo ficam `pausado` com o motivo de qualidade vermelha, e há alerta em `meta_alertas`. |
| Token recusado (código 190 na leitura do status, ou cifra que não abre) | Conexão marcada com erro; disparos ativos pausados; alerta. |
| Falha ao ler o status (rede, etc.) | A rodada termina sem enviar; tenta no minuto seguinte. |

Durante o envio, pela resposta da Meta (`CODIGOS_PARAR_DISPARO`, `CODIGOS_PARAR_MODELO`, `CODIGO_LIMITE_SPAM` e `CODIGOS_LIMITE_CHAMADAS` em `src/lib/meta/envio.ts`):

| Código | Efeito |
|---|---|
| 131031 (conta bloqueada ou restringida), 131042 (problema de pagamento), 368 (restrição temporária por violação de política), 190 (token) | Recusa explícita: a pessoa volta à fila (nada saiu) e **todos os disparos ativos do campo pausam** com a mensagem do código, com alerta. Com 190 a conexão também é marcada com erro. |
| 131048 (limite de spam do número) | Recusa explícita: a pessoa volta à fila e **todos os disparos ativos do campo pausam** com motivo, com alerta. |
| 132015 (modelo pausado pela Meta), 132016 (modelo desativado), 132001 (modelo inexistente nesse idioma), 132000 e 132012 (valores que não batem com o modelo) | Recusa explícita que vale para o disparo inteiro: a pessoa volta à fila e **só aquele disparo pausa** com motivo em português, com alerta. Retomar tenta de novo; se o modelo continuar com problema, pausa outra vez sem queimar ninguém. |
| 130429 (limite de vazão), 4 e 80007 (limite de chamadas da app ou da conta) | Recusa explícita: a pessoa volta à fila e a **rodada termina**; os disparos não pausam. |
| Outro código da Meta por pessoa (ex.: 131026) | Só aquela pessoa vira `falhou`, com o código e a mensagem da Meta. A rodada segue. |
| Tempo esgotado, erro de rede, erro sem código, ou resposta sem id da mensagem | Ambíguo: aquela pessoa vira `falhou` ("A Meta não respondeu a tempo. Não reenviamos para não cobrar duas vezes." ou "A Meta respondeu sem o id da mensagem."), conta no limite do dia e a rodada termina. |

**Nada que pode ter saído é reenviado.** Depois que o POST começa, o envio só termina como `enviado` ou `falhou`. A única exceção é a recusa explícita da Meta, que volta à fila porque nada saiu. Isso evita cobrar duas vezes.

**Varredura de reservas (10 min):** no início de cada rodada, reservas `pendente` com `erro_codigo = -1` e `atualizado_em` mais antigo que 10 minutos viram `falhou` com a mensagem "Envio não confirmado — não reenviado para evitar cobrança dupla." (`varrerReservasVencidas`). Os contadores do disparo são recalculados.

Quando a rodada pausa um disparo, o motivo fica gravado no próprio disparo e aparece na tela. Retomar volta o disparo para `enviando` (ou `agendado`, se a data ainda não chegou).

### 8.5 Webhook: status e pedidos de SAIR

Rota `POST /api/meta/whatsapp/webhook` (mesma da seção 4). A assinatura é validada sobre o corpo bruto. Assinatura inválida responde **401**. Com assinatura válida responde **200** na hora e processa depois (`after`). Erro interno de processamento também responde 200 e vai ao log.

- **Statuses** (`sent`, `delivered`, `read`, `failed`): localizam o envio pelo `wamid`, no campo dono do `phone_number_id`, e avançam o status sem regredir (8.1). Falha da Meta grava o código e a mensagem. Até três tentativas em caso de disputa.
- **Pedido de SAIR**: mensagem de texto recebida cujo conteúdo, depois de tirar acentos, pôr em minúsculas e aparar espaços, é exatamente `sair`, `parar`, `stop`, `cancelar` ou `descadastrar` (`ehPedidoDeSair`). A palavra precisa vir sozinha: "quero sair" não conta. Efeito: o telefone entra na lista de exclusão do campo (motivo "Pediu para sair pelo WhatsApp") e os envios `pendente` livres desse telefone viram `ignorado`. O telefone de quem escreveu é normalizado (`telefoneDoWaId`), inclusive no caso de celular sem o 9.
- Cada evento é independente: o erro de um não impede os outros.

### 8.6 Rotas e permissões

Pasta `src/app/api/meta/whatsapp/envio/`. Todas exigem usuário autenticado e campo ativo.

| Método e rota | Permissão | O que faz |
|---|---|---|
| `GET /api/meta/whatsapp/envio` | `whatsapp_oficial.envio.view` | Lista os disparos do campo. |
| `POST /api/meta/whatsapp/envio` | `whatsapp_oficial.envio.criar` | Cria o disparo (201). |
| `POST /api/meta/whatsapp/envio/publico` | `whatsapp_oficial.envio.view` | Conta o público ao vivo (membros e interessados), sem gravar. |
| `GET /api/meta/whatsapp/envio/opcoes` | `whatsapp_oficial.envio.view` | Modelos aprovados, igrejas, situações, títulos e origens para os filtros. |
| `GET /api/meta/whatsapp/envio/[id]` | `whatsapp_oficial.envio.view` | Detalhe do disparo com as pessoas paginadas (`?pagina=` e `?porPagina=`, máximo 100). Telefone mascarado (ex.: `+55 19 9****-6683`). Id fora do formato UUID responde 404. |
| `PATCH /api/meta/whatsapp/envio/[id]` | `whatsapp_oficial.envio.controlar` | Corpo `{ "acao": "pausar" }`, `"retomar"` ou `"cancelar"`. Outra ação responde 400. |

- **Idempotência do POST**: o corpo pode trazer `chave` (UUID). A chave vira o **id do disparo** (e fica também em `valores.chave`, só como registro). O INSERT do disparo é o primeiro da transação, então um segundo pedido com a mesma chave, mesmo chegando enquanto o primeiro ainda grava, bate na chave primária (P2002) e não grava nada. Repetir a mesma chave no mesmo campo devolve o disparo que já existe (`repetido: true`, com `total`, `enviados`, `entregues`, `lidos` e `falhos` reais), sem criar outro. Chave já usada em outro campo responde 409. A tela gera a chave ao avançar para a Revisão (com reserva via `crypto.getRandomValues` quando a página não está em HTTPS). Resposta 5xx ou erro de rede deixa a tela em "não confirmado": o botão de disparar continua bloqueado, "Tentar de novo" reenvia com a mesma chave e "Ver lista de disparos" mostra o que existe.
- **Pausar** só vale para disparo em andamento (`enviando`, `aguardando_limite`, `agendado`). **Retomar** só vale para `pausado`. **Cancelar** vale para os em andamento e os pausados: os envios que ainda não saíram viram `ignorado` e o disparo fica `cancelado`. Cancelar não pode ser desfeito.
- Chaves do catálogo (`src/app-ui/system/MetaOficial.tsx`, `definirPermissao`): `whatsapp_oficial.envio.view` (herda `whatsapp_oficial.view`), `whatsapp_oficial.envio.criar` e `whatsapp_oficial.envio.controlar` (herdam `whatsapp_oficial.envio.view`).

### 8.7 Tela e Coolify

- Central **Meta Oficial**, aba **Envio** (`?aba=envio`; componentes em `src/app-ui/system/metaOficial/Envio.tsx`):
  - Lista de disparos com progresso e selo de status, e o botão **Novo disparo**.
  - **Novo disparo** em 3 passos: 1 Público (contagem ao vivo), 2 Modelo (só aprovados; preenche as variáveis de data e texto livre), 3 Revisão (quantidade e confirmação).
  - Detalhe (`DetalheDisparo.tsx`): contadores, lista de pessoas paginada e os botões **Pausar**, **Retomar** e **Cancelar**, cada um com confirmação no próprio painel.
- **Coolify**: criar, em **cada igreja**, a Scheduled Task do app com nome `cron-meta-envio` e frequência `* * * * *` (todo minuto), comando:
  `curl -fsS -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/meta-envio`
  Mesmo padrão das outras tarefas da seção 4. Cuidado para não rodar em dobro se a mesma igreja estiver nos dois lugares. Na Vercel o agendamento já está em `vercel.json`.

### 8.8 Teste

- **Regra do dono: só com o número de teste da Meta** (seção 7.6). Nada de envio para número real nem de cobrança no cartão.
- Teste executado em 23/11/2026 pelo desenvolvimento contra o banco de Campinas com Graph falso (sem envio real): **9 cenários OK**, dados apagados no fim. O roteiro desse teste não está no repositório.
- Testes unitários das regras puras e do serviço com repositório falso (telefone, SAIR, parâmetros, lote, mascaramento, paginação, idempotência com P2002, códigos de parada): `node --test scripts/teste-meta-whatsapp.mjs`.

## 9. Próximas etapas

1. **Base** (feita): configuração do app, conectar número, tela de status.
2. **Modelos** (feita no código; ver seção 7): listar modelos da conta com status e categoria; criar modelo e enviar à aprovação da Meta; status atualizado por cron.
3. **Envio em massa** (feita no código; ver seção 8): fila por cron, em lotes, com modelo aprovado, limite diário, qualidade do número e lista de exclusão ("SAIR"); acompanhamento enviado/entregue/lido/falhou.
4. **Respostas**: webhook de mensagens recebidas e caixa de conversas própria, com janela de 24 h.
5. **Leads de anúncio**: conectar Página do Facebook/Instagram e trazer leads dos formulários para o pipeline pastoral, com origem "Anúncio".

## 10. Comunicação unificada (28/11/2026)

O número oficial da Meta passou a ser usável nas telas que já existiam em Comunicação → Gestão. Migrations: `20261128000000_comunicacao_oficial` e `20261128010000_meta_precos`. Baseline do trabalho: `3722a19e8d96f01f`.

- **Instância por campo**: cada campo com número oficial conectado ganha uma instância espelho (a "instância oficial") ao lado das da Z-API. Ela aparece nos seletores de instância das telas de Comunicação. Quem já tinha conexão antes da migration recebe a instância pelo script `scripts/backfill-instancia-oficial.mjs`, rodado na publicação.
- **Envio em Massa** (Comunicação → Gestão → Envio em Massa): com a instância oficial escolhida, o envio usa modelo aprovado, mostra o valor estimado (quantidade × preço da categoria) e mantém os destinatários na fila oficial. Ao escolher uma instância Z-API, a tela exige o aceite do risco de bloqueio do número antes de disparar.
- **Cronograma**: cada passo pode ter seu modelo; a jornada tem teto mensal de mensagens (`whatsapp_oficial.conexao.teto`). Ao ligar a jornada, a estimativa de custo aparece com o texto padrão por categoria (marketing, utilidade, autenticação).
- **Conversas e agente de IA**: mensagens recebidas no número oficial entram na Caixa e o agente responde pelo número oficial enquanto a janela de 24 h está aberta.
- **SAIR**: o pedido de SAIR feito no número oficial vale também para a Z-API do mesmo campo (e o inverso fica como já era).
- **Preços e medidor**: tabela central de preços por categoria e moeda (editada pelo master em Meta Oficial → App; os campos leem dela, com cache de 5 min). O medidor do mês soma as mensagens cobradas (entregues e cobráveis) por categoria × preço. A Meta cobra no cartão do campo; o sistema só estima.
- **Chaves de permissão**: `whatsapp_oficial.campanha.enviar` (disparar pelo número oficial), `whatsapp_oficial.conexao.teto` (definir o teto mensal), `whatsapp_oficial.modelos.sugerir` (sugerir modelo) e `meta_app.precos.editar` (editar a tabela de preços, master).
- **Central Meta Oficial**: a aba **Envio** virou um cartão-atalho para Comunicação → Gestão. Não há parâmetro de URL para abrir a aba Envio em Massa direto; o atalho leva à página `/app-ui/pastoral-kanban` e o usuário clica na aba. Modelos, Conexão e App seguem como antes.

### 10.1 Limitações conhecidas

- Avisos aos líderes (repasses) enviados pelo número oficial falham fora da janela de 24 h. Precisa de decisão do dono (modelo aprovado para repasse, ou manter o repasse na Z-API).
- No número oficial não existem botões, reações nem confirmação de leitura nas conversas.
- A mídia do WhatsApp fica no bucket público `dados`.
- O medidor só conta a partir de agora; não há histórico retroativo.
- A moeda mostrada é a da tabela de preços (USD preferida); não há conversão.

### 10.2 Roteiro do dia da troca (Campinas)

Para o dono, quando for trocar o número de Campinas da Z-API para a Meta:

1. Desligar (desconectar) a Z-API do número de Campinas. Um número não pode estar nos dois ao mesmo tempo.
2. Em Meta Oficial → Conexão, clicar em **Conectar com a Meta** e concluir o fluxo com esse número.
3. Conferir se a instância oficial apareceu. Se não apareceu, rodar `node scripts/backfill-instancia-oficial.mjs` (pelo desenvolvimento).
4. Em Comunicação → Gestão → Envio em Massa, conferir que a instância oficial está na lista.
5. Enviar um modelo de teste para o próprio número e conferir entrega e o valor estimado.
6. Mandar uma mensagem de um celular para o número e conferir que ela cai na Caixa e que o agente responde.
