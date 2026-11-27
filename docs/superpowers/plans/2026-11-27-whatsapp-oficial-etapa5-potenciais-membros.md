# Etapa 5 — Potenciais membros (formulários de anúncio do Facebook/Instagram)

Data: 27/11/2026. Pedido do dono: "quero criar um anúncio, ele aparecer no Instagram, e quando a pessoa preencher, aparecer no meu sistema". No sistema o nome é **Potenciais membros**, nunca "leads".

Base: design aprovado em 23/11 (`docs/superpowers/specs/2026-11-23-whatsapp-oficial-meta-design.md`): cadastros chegam por **cron** (sem webhook `leadgen`), entram no **pipeline pastoral**, cada formulário é ligado a uma igreja (sem ligação → sede do campo), token de Página criptografado por campo.

## Fatos verificados na documentação da Meta (27/11/2026)

Lidas: `developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/`, a referência da permissão `leads_retrieval` e a página de teste/diagnóstico de Lead Ads.

- Para ler cadastros: token de Página ou de usuário "de alguém que pode anunciar na Página"; permissões `leads_retrieval`, `ads_management`, `pages_show_list`, `pages_read_engagement`, `pages_manage_ads` (e `pages_manage_metadata` só para webhook — não usamos, mas a configuração pede para o caso de virmos a usar). `leads_retrieval` depende de "Ads Management Standard Access".
- Cadastro: `GET /{lead-id}` ou `GET /{form-id}/leads` → `id`, `created_time`, `ad_id`, `form_id`, `field_data: [{name, values[]}]`.
- Filtro por data documentado: `filtering=[{"field":"time_created","operator":"GREATER_THAN","value":<unix>}]` (exemplo no endpoint do anúncio; **no do formulário, conferir no teste real** — se não aceitar, paginar do mais novo e parar no último id já gravado).
- A ferramenta de teste de cadastros **não funciona com o app em modo de desenvolvimento**. Teste real = anúncio de verdade do dono (ou depois da publicação do app).
- **Instagram**: a documentação lida não menciona. Não há campo que diga se veio do Instagram ou do Facebook. Confirmar com anúncio real só no Instagram.
- Antes da análise do app (App Review), as permissões valem para quem tem papel no app (o dono). As igrejas só usam depois da análise dessas permissões, com vídeo.

## O que depende do dono (fora do código)

1. No app ZionByte → Login do Facebook para Empresas → **Configurações**: criar a configuração "Potenciais membros" (token de acesso do usuário), com as permissões acima. Passar o **ID da configuração** para mim (vai na aba App, campo novo).
2. Instagram ligado à Página da igreja (Meta Business Suite → Configurações → Perfis do Instagram).
3. Criar o anúncio com objetivo **Cadastros**, posicionamento Instagram, formulário instantâneo com nome e telefone.
4. Depois de funcionar: vídeo para a análise das permissões de Página/cadastros.

## Banco (aditivo; regra nº 1: baseline)

Migration `20261127010000_meta_potenciais_membros`:

- `meta_paginas`: `id`, `campo_id` (FK campos, cascade), `page_id`, `page_nome`, `token_cifrado`, `status` (`ativa`|`erro`|`desconectada`), `conectado_por`, `conectado_em`, `ultima_leitura_em`, `erro_mensagem`. Único `(campo_id, page_id)`. RLS ligado sem política.
- `meta_formularios`: `id`, `campo_id`, `page_id`, `form_id`, `nome`, `status_meta`, `church_id` (igreja de destino, null = sede), `ativo` (padrão true), `ultimo_cadastro_em`, `atualizado_em`. Único `(campo_id, form_id)`.
- `meta_potenciais_membros`: `id`, `campo_id`, `lead_id`, `form_id`, `page_id`, `ad_id`, `church_id`, `nome`, `telefone`, `email`, `respostas` (jsonb, `field_data` como veio), `criado_meta_em`, `recebido_em`, `attendance_id` (card no pipeline), `situacao` (`novo`|`duplicado`|`sem_telefone`). Único `(campo_id, lead_id)` → nunca grava o mesmo cadastro duas vezes.

## Servidor

- `src/lib/meta/potenciais.ts` (puro, testável): extrair nome/telefone/e-mail do `field_data` (nomes padrão da Meta `full_name`, `first_name`+`last_name`, `phone_number`, `email`; resto vai para "respostas"), normalizar telefone BR (reaproveitar `normalizarTelefoneBR` de `envio.ts`), montar o texto do card.
- `src/lib/meta/servicoPotenciais.ts` com dependências injetadas:
  - `conectarPagina(code)`: troca o `code` do popup por token de usuário (`/oauth/access_token`), estende para longa duração, lista `GET /me/accounts` → grava cada Página escolhida com o token de Página cifrado.
  - `sincronizarFormularios(campo)`: `GET /{page}/leadgen_forms` → upsert em `meta_formularios` (sem apagar a escolha de igreja).
  - `lerCadastros(campo)`: para cada formulário ativo, `GET /{form}/leads` desde `ultimo_cadastro_em` (com folga de 10 min) → para cada cadastro novo (insert com `ON CONFLICT DO NOTHING` em `(campo_id, lead_id)`): cria card no pipeline pastoral da igreja de destino com `attendance_type = 'potencial_membro'`, checando duplicado com `findLiveAttendance` (se já houver card vivo do mesmo telefone, só registra na linha do tempo dele e marca `duplicado`).
  - Token recusado pela Meta → Página `erro` + alerta `pagina_erro` (vai ao master pelo encaminhamento já feito).
- Cron `GET /api/cron/meta-potenciais` (`CRON_SECRET`), a cada 10 min, 3 campos por vez, prazo 45 s; tabela ausente → 200 `tabela ausente`. `vercel.json` + Scheduled Task `cron-meta-potenciais` (`*/10 * * * *`) nas igrejas do Coolify.
- Rotas (todas com `withAuth`, campo ativo e `exigirPermissao`):
  - `GET /api/meta/potenciais` — Páginas, formulários e últimos 100 recebidos do campo (paginado).
  - `POST /api/meta/potenciais/pagina` (conectar) e `DELETE /api/meta/potenciais/pagina/[id]` (desconectar).
  - `PATCH /api/meta/potenciais/formularios/[id]` — igreja de destino e ativo.
  - `POST /api/meta/potenciais/sincronizar` — força leitura agora.
- Configuração central: campo novo `leadsConfigId` (aba App, master), reserva `META_LEADS_CONFIG_ID`.

## Pipeline pastoral

- Tipo novo `potencial_membro`, rótulo "Potencial membro", nos mapas de rótulos do pipeline (ler cada um antes de mexer).
- Card: nome, telefone, observação com o formulário e as respostas; linha do tempo "Recebido do formulário <nome> (anúncio Facebook/Instagram)".

## Tela (aba "Potenciais membros" da central Meta Oficial, no lugar de "Leads")

- Página conectada: nome, situação, botão **Conectar Página** (popup da Meta com a configuração `leadsConfigId`) e **Desconectar**.
- Formulários: nome, situação na Meta, igreja de destino (lista das igrejas do campo), ativo.
- Recebidos: nome, telefone mascarado, formulário, igreja, data, situação, link para o card no pipeline. Botão **Buscar agora**.
- Permissões (regra nº 2): `whatsapp_oficial.potenciais.view`, `.conectar`, `.configurar`; `npm run permissoes:arvore`.

## Testes

- Unitários em `scripts/teste-meta-whatsapp.mjs`: extração do `field_data`, telefone, montagem do card, dedupe por `lead_id`, Página com token recusado.
- E2E de escrita (`scripts/e2e-meta-potenciais.mjs`): cria formulário/cadastro simulados no banco de referência, roda o processamento com Graph falso, confere card no pipeline e limpa tudo no fim.
- Teste real: anúncio do dono só no Instagram → confirmar que chega (fecha a dúvida do Instagram).

## Fora desta etapa

- Mensagem automática de boas-vindas pelo WhatsApp oficial ao potencial membro (depende de modelo aprovado; fica como opção depois).
- Criar anúncio pelo sistema (permissões e projeto à parte).
