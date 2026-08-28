# Home Pública Configurável — SPEC técnica

Referência do produto: [PRD.md](./PRD.md)

## 1. Onde o dado mora

O SaaS roda **um banco por igreja** (`scripts/migrate-self.mjs`). O chaveamento
lógico continua sendo o **campo** (`campos`), como já faz o Peniel
(`peniel_configs.campo_id UNIQUE`). Duas tabelas novas — e uma decisão de não
criar uma terceira (§1.5).

### 1.1 `home_configs` — uma linha por campo

Arquivo: `prisma/schema.prisma`, model `HomeConfig`.

| Grupo | Colunas |
| --- | --- |
| Identidade | `site_title`, `site_description`, `favicon_url`, `logo_url`, `watermark_url` |
| PWA | `pwa_name`, `pwa_short_name`, `pwa_icon_192`, `pwa_icon_512`, `pwa_icon_maskable` |
| Hero | `hero_eyebrow`, `hero_title`, `hero_text`, `verse_ref`, `verse_label`, `verse_text`, `show_verse` |
| Aparência | `bg_dark`, `bg_light`, `accent_color`, `default_dark`, `show_symbols`, `show_spotlights`, `watermark_opacity`, `symbol_colors` (JSONB `string[]`) |
| Atendimento | `services_config` (JSONB) |

```jsonc
// services_config — botão flutuante da secretaria
{ "enabled": true,
  "title": "Atendimento AD Campinas",
  "hidden": ["jovem", "infantil"],           // ids de FAB_OPTIONS ocultos
  "labels": { "emergencial": "Urgência" } }  // renomes opcionais
```

### 1.2 `home_cards` — um registro por ícone da home

Model `HomeCard`, `@@unique([configId, key])`, `@@index([configId, sortOrder])`.

`key`, `action`, `title`, `subtitle` (`"\n"` vira `<br>`), `url`, `icon`,
`icon_color`, `hover_color`, `visible`, `pulse`, `live_dot`, `full_width`,
`sort_order`.

### 1.3 Ações possíveis de um cartão

| `action` | Efeito ao clicar | Origem do conteúdo |
| --- | --- | --- |
| `membro` | abre `MembroLogin` | fluxo intocado |
| `peniel` | abre `PenielRegistrationModal` | fluxo intocado |
| `gf` | animação de círculo → `/gf` | fluxo intocado |
| `pwa` | renderiza `<InstallAppCard>` | **padrão da plataforma** (§1.4) |
| `link` | `<a href target="_blank">` | `url` do cartão ou apelido `sede:` |
| `maps` | Google Maps do endereço | `headquarters` |
| `agenda` | bloco de dias de culto | `church_schedule` |
| `verse` | abre o modal do versículo | `home_configs` |

### 1.4 Cartões que a igreja não pode apagar

- `PROTECTED_ACTIONS = ['membro', 'peniel', 'gf']` — podem ser **ocultados**,
  não apagados. Some sem querer o "Sou Membro" e a igreja se tranca para fora
  do Portal do Membro.
- `LOCKED_ACTIONS = ['pwa']` — "Instalar o app" é **padrão da plataforma**: não
  se apaga nem se oculta, e o texto é do próprio componente (ele muda entre
  Android e iPhone e some sozinho se o app já está instalado). Ocultá-lo só
  tiraria o atalho de quem quer instalar. A trava é aplicada em três camadas:
  `mergeHomeCard` força `visible: true`, `mergeHomeCards` repõe o cartão se
  sumir da lista, e o `PUT` faz o mesmo antes de gravar.

### 1.5 O que NÃO fica aqui — e por quê

Endereço, telefone, WhatsApp, e-mail, redes sociais e a programação de culto
**já são cadastrados** em Sistema → Informações da Igreja
(`headquarters` + `church_schedule`, telas com abas *Dados Gerais*,
*Programação*, *Como Chegar*, *Redes Sociais*).

Duplicar isso em `home_configs` criaria duas verdades para o mesmo dado: a
igreja mudaria o endereço numa tela e o outro continuaria no ar. A home **lê**
desses registros; a tela de configuração da home mostra em leitura, com atalho
para Informações da Igreja.

Para os links de rede social, o cartão guarda um **apelido** em vez da URL:

```
url = "sede:instagram" | "sede:youtube" | "sede:facebook"
    | "sede:tiktok"    | "sede:site"    | "sede:whatsapp"
```

`resolveCardUrl(card, sede)` traduz na hora de renderizar. Rede ainda não
cadastrada ⇒ o cartão vira um bloco sem clique, não um `<a>` quebrado. Quem
preferir um endereço fixo escolhe "Endereço digitado aqui" no editor.

## 2. Defaults — a home de hoje virando código

`src/lib/homeConfig.ts` exporta `DEFAULT_HOME_CONFIG`, `DEFAULT_HOME_CARDS` e
`DEFAULT_HOME_SEDE` com **exatamente** o conteúdo atual (REINAR, João 3:16, os
9 cartões, os links e a programação da AD Campinas). Sem linha no banco, a API
devolve o default e a home fica igual — é isso que permite subir a mudança sem
migrar nada.

O merge é por campo: `null`/vazio mantém o default. A lista de cartões do banco,
se existir, **substitui** a default inteira — senão não haveria como apagar um
cartão (ele voltaria pelo merge).

## 3. Semeadura (nada mockado)

`ensureHomeConfig(campoId)` em `src/lib/homeConfigServer.ts`, chamado pelo
`GET /api/home-config` (autenticado):

1. linha inexistente ⇒ cria com os defaults, usando o **nome real da igreja**
   (`headquarters.name`) em `site_title`, `pwa_name`, `pwa_short_name` e no
   título do atendimento — e cria os 9 cartões;
2. linha existente sem cartão (edição interrompida) ⇒ repõe os cartões;
3. linha completa ⇒ devolve como está, sem sobrescrever nada.

O `GET` público **nunca grava** — tráfego de visitante não semeia banco.

## 4. API

### `GET /api/public/home-config` — público, sem auth

```
?campoId=<uuid> | ?campo=<nome>   (opcional; resolve por resolvePublicCampoId)
→ 200 { campoId, config: {...}, cards: [...], sede: {...} }
```

- `Cache-Control: public, max-age=60, stale-while-revalidate=300`.
- Nunca 500 para o visitante: qualquer erro ⇒ default com `{ fallback: true }`.
  Home fora do ar por causa de configuração é inaceitável.

### `GET /api/home-config` — autenticado, `master | admin | campo`

Mesma forma, sem cache, semeando na primeira visita. Se a gravação da semente
falhar, devolve o que der para editar com `seedFailed: true` em vez de 500.

### `PUT /api/home-config` — autenticado, `master | admin | campo`

Body `{ config, cards }`. Transação:

1. `upsert` de `home_configs` por `campoId`
2. `deleteMany` dos cartões que sumiram
3. `upsert` dos enviados, com `sort_order` = posição no array

Validação: cores `^#[0-9a-fA-F]{6}$`, URL `http(s)://`, `/caminho` ou `sede:`,
`icon` dentro do catálogo, `action` dentro do enum, `key` único, título ≤160.
Entrada inválida ⇒ 400 com a lista de erros; nada é gravado pela metade.

### Upload de imagens

Reaproveita `POST /api/upload` (`folder=home`) — já converte para PNG, limita a
5MB e devolve URL pública do bucket `dados`. Sem endpoint novo.

## 5. Frontend

### 5.1 `src/lib/homeConfig.ts` (isomórfico)

Tipos, defaults, merge/saneamento, `HOME_ICON_CATALOG` (valor + rótulo em
português + cor da pastilha + categoria), `resolveCardUrl`, `mapsUrlFor`,
`whatsappUrlFor`, `PROTECTED_ACTIONS` / `LOCKED_ACTIONS`.

### 5.2 `src/components/public/homeIcons.tsx`

Mapa `nome → componente` (lucide + a pomba `Dove`, desenho próprio) e
`resolveHomeIcon` com fallback `Circle`. Sem ícones de marca: o lucide os
removeu na v1 e o resto do sistema já usa substitutos genéricos.

### 5.3 `src/lib/homeConfigServer.ts` (servidor)

`loadHomeSede` (lê `headquarters` do campo — a marcada com `show`, senão a
primeira — e `church_schedule` na ordem cadastrada), `loadHomePayload`
(nunca lança) e `ensureHomeConfig` (§3).

### 5.4 `PublicHome.tsx`

- estado inicial = `DEFAULT_HOME_PAYLOAD`, trocado quando a API responde:
  sem tela vazia e sem piscar;
- `bg`, cor de destaque, hero, versículo, logo e marca d'água vêm do estado;
- o grid vira `home.cards.filter(visible).map(renderCard)`; `renderCard`
  devolve **o mesmo JSX de antes** (mesmas classes, mesmos tamanhos), só com
  título/ícone/cor/destino parametrizados;
- cor de hover viaja numa variável CSS `--hv` (classe Tailwind dinâmica não
  existe em build time) com duas regras no `<style>` da página;
- `FAB_OPTIONS` continua no código como catálogo; `services_config` filtra e
  renomeia na renderização — **nenhum handler mudou**: agendamento, OTP,
  "Quero ser Membro", atendimento pastoral e o gatilho de 7 toques da
  contabilidade seguem idênticos;
- o tema padrão da igreja só é aplicado a quem nunca clicou no sol/lua (a
  preferência é lida **antes** do efeito que a persiste, senão nunca valeria).

### 5.5 Metadados e PWA (servidor)

- `src/lib/homeMetadata.ts` — `cache()` do React: `generateMetadata`,
  `generateViewport` e o manifesto compartilham uma consulta só;
- `src/app/layout.tsx` — `generateMetadata` / `generateViewport` assíncronos;
- `src/app/manifest.ts` (`MetadataRoute.Manifest`) serve `/manifest.webmanifest`.
  **`public/manifest.webmanifest` foi removido**: arquivo em `public/` tem
  precedência sobre a rota e venceria sempre.

### 5.6 Tela de edição

`src/components/app-ui/system/HomePublica.tsx`, rota
`system/home-publica`, card em `SystemSettings.tsx` (seção *Geral*) e chave
`settings_home_publica` no `permissionCatalog.ts`.

Abas: **Identidade · Texto principal · Aparência · Ícones da home ·
Atendimento · Sede e cultos** (esta última só leitura, com link para
Informações da Igreja).

O seletor de ícone é um modal com abas de categoria e pastilhas coloridas —
mesmo padrão do "Escolher Ícone" que já existe em Informações da Igreja.

## 6. Migração

`prisma/migrations/20260828120000_home_publica/migration.sql`: só
`CREATE TABLE/INDEX IF NOT EXISTS` e `ALTER … ADD CONSTRAINT` guardado por
`pg_constraint`. Aditiva, sem tocar em tabela existente, compatível com o
`migrate-self`.

Depois de mesclar: **regerar o `baseline/`** pelo painelchurch, senão os bancos
das outras igrejas não ganham as tabelas no próximo deploy.

Nenhum seed em SQL — a ausência de linha é estado válido, e a semeadura real
acontece na primeira visita à tela (§3).

## 7. Riscos e decisões

| Risco | Decisão |
| --- | --- |
| Config quebrada derruba a home | API pública com fallback; front sempre parte do default |
| Igreja apaga o "Sou Membro" | Ações internas só podem ser ocultadas |
| Igreja esconde o "Instalar o app" | Cartão travado em três camadas (§1.4) |
| Endereço/cultos ficarem desencontrados | Fonte única em Informações da Igreja |
| Ícone inválido salvo por API | Catálogo fechado no servidor; `resolveHomeIcon` cai em `Circle` |
| `generateMetadata` bate no banco a cada request | `cache()` do React + consulta por chave única |
| Bancos antigos sem as tabelas | `IF NOT EXISTS` + `catch` na leitura ⇒ default |
