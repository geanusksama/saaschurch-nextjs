# Novo Church App — Documentação Completa para Integração MRM

> **Propósito deste documento:** Passar para o agente de desenvolvimento do sistema MRM (painel administrativo web) tudo que ele precisa saber sobre o app Flutter, o banco Supabase, as regras de negócio e os CRUDs que precisam ser implementados no backend/admin para que o app funcione 100%.

---

## 1. Visão Geral do Projeto

O **Novo Church App** é um aplicativo mobile/web em Flutter para membros de uma rede de igrejas (Assembleia de Deus Campinas — MRM). Ele se conecta a um backend **Supabase** (PostgreSQL + Auth + Storage).

### Características gerais
- App único Flutter (`lib/main.dart`, ~22 mil linhas) — todos os módulos em um só arquivo
- Multi-tenant: cada **headquarters** (campo/sede) tem seus próprios eventos, membros e conteúdo
- Autenticação via Supabase Auth (email/senha)
- Armazenamento de fotos no Supabase Storage (bucket `dados`)
- Temas claro e escuro
- Sem push notifications implementadas ainda

### Stack
| Camada | Tecnologia |
|---|---|
| App | Flutter 3.x / Dart |
| Backend | Supabase (PostgreSQL 15, GoTrue Auth, PostgREST, Storage) |
| Banco | PostgreSQL com Row Level Security (RLS) |
| Storage | Supabase Storage — bucket `dados` |
| Autenticação | Supabase Auth (email/senha) |
| Packages Flutter | supabase_flutter, file_picker, qr_flutter, audioplayers, share_plus, url_launcher, google_fonts, webview_flutter |

### Variáveis de ambiente (dart-define)
```
SUPABASE_URL=https://ysibqnwgitakofehdxvd.supabase.co
SUPABASE_ANON_KEY=eyJ...
WEBSITE_URL=https://www.adcampinas.com.br
PORTAL_BASE_URL=https://www.adcampinas.com.br
```

---

## 2. Arquitetura de Dados — Hierarquia Multi-Tenant

```
fields (campos geográficos)
  └─ regionais
       └─ headquarters (sede/campo — ex: AD Campinas)
            └─ churches (igrejas locais)
                 └─ members (membros)
                 └─ events (eventos)
                 └─ ministries (ministérios)
```

Cada membro pertence a uma `church`, que pertence a uma `headquarters`. O `headquarters_id` é o identificador principal de multi-tenancy usado no app.

---

## 3. Telas do App (Screens) e Navegação

### Estrutura Principal

```
MainShell (scaffold com bottom nav — 4 abas)
├── [0] HomeDashboard      — Grade de módulos, últimos eventos, feed rápido
├── [1] FeedScreen         — Feed social (requer login)
├── [2] HistoryScreen      — História da denominação
└── [3] ProfileScreen      — Perfil do membro (requer login)
```

### Navegação a partir do HomeDashboard (módulos)

| Módulo | Tela | Descrição |
|---|---|---|
| Bíblia | `BibliaScreen` | WebView com leitor bíblico externo |
| Igreja | `IgrejaScreen` | Vídeos, Shorts, Podcasts, Ao Vivo |
| Endereço | `EnderecoScreen` | Localização da sede, mapa, horários |
| Ministérios | `MinisterioScreen` | Grid de ministérios carregados do DB |
| Site | `ModuleWebViewScreen` | Abre `WEBSITE_URL` em webview |
| Rádio | `RadioScreen` | Player de rádio com animação |
| Agenda Anual | `AgendaAnualScreen` | Calendário de eventos do `tbeventos` |
| Eventos | `EventosScreen` | Grade de eventos com compra de ingressos |
| Minhas Compras | `MinhasComprasScreen` | Histórico de pedidos do usuário |
| Pão Diário | `MensagensScreen` | Mensagens devocionais com áudio |
| Testemunhos | `TestemunhosScreen` | Histórias de membros |
| Ajuda Pastoral | `AjudaPastoralScreen` | Formulário de contato pastoral |
| Liderança | `LiderancaScreen` | Bispos, pastores, diáconos |
| Painel Admin | `AdminPanelScreen` | Acesso restrito a líderes/admins |

### Fluxo de Eventos (tela completa)

```
EventosScreen
  ├── Filtro por departamento (chips)
  ├── Busca por texto
  └── EventoDetailScreen (detalhe do evento)
       ├── SeatPickerScreen (evento COM_ASSENTO)
       │    └── CheckoutScreen
       │         └── Tela de sucesso com QR codes
       └── _FreeTicketSheet (evento LIVRE — bottom sheet)
            └── CheckoutScreen
                 └── Tela de sucesso
```

### Tela de Perfil — Opções do Drawer

```
ProfileScreen (drawer)
├── Editar Perfil → EditarPerfilPage
├── Meus Ingressos → MeusIngressosScreen
├── Minhas Compras → MinhasComprasScreen
├── Agenda Anual → AgendaAnualScreen
├── Liderança → LiderancaScreen
└── Painel Admin → AdminPanelScreen (se canOpenAdminPanel)
```

---

## 4. Modelos de Dados Flutter (Classes)

### `MembroData` — Membro autenticado
```dart
String id              // UUID do registro em members
String nome            // full_name
String tituloeclesiastico  // ecclesiastical_title
String situacao        // membership_status
String? idigreja       // church_id UUID
String igreja          // churches.name (via join)
String campo           // '' (não usado ainda)
String foto            // photo_url ou ''
String email
String contato         // phone
int? rol               // número de rol do membro
```

### `_Evento` — Evento
```dart
String id
String title           // nome
String description     // descricao
DateTime date          // data_inicio
DateTime? endDate      // data_fim
String location        // local
String imageEmoji      // icon_emoji
TipoEvento tipo        // LIVRE | COM_ASSENTO
int totalIngressos     // capacidade_total
int ingressosVendidos  // capacidade_total - quantidade_disponivel
double defaultPrice    // valor_ingresso
String categoria       // 'Culto', 'Jovens', 'Infantil', etc.
String? departmentId   // FK event_departments
List<_EvSeatRow> rows  // grid de assentos (preenchido local)
List<_SalaConfig> salas
bool isActive
```

### `_OrderSummary` — Pedido (Minhas Compras)
```dart
String id              // UUID de event_orders
String numeroPedido    // numero_pedido
String eventoId
String eventoNome      // events.nome (via join)
String eventoEmoji     // events.icon_emoji (via join)
double total
String status          // order_status_t enum
String paymentMethod   // free|pix|credit_card|debit_card
DateTime createdAt
DateTime? eventoData   // events.data_inicio (via join — campo não existe em prod ainda)
```

### Enums do App

#### `TipoEvento`
| Valor | DB | Significado |
|---|---|---|
| `comAssentos` | `COM_ASSENTO` | Mapa de assentos numerados |
| `ingressoLivre` | `LIVRE` | Ingresso sem assento, por quantidade |

#### `SeatStatus`
| Valor | DB | Cor |
|---|---|---|
| `available` | `LIVRE` | Cinza claro |
| `reserved` | `RESERVADO` | Laranja |
| `sold` | `OCUPADO` | Vermelho |
| `blocked` | `BLOQUEADO` | Escuro |

#### `order_status_t` (DB enum)
| Valor | Label | Cor |
|---|---|---|
| `AGUARDANDO_PAGAMENTO` | Aguardando | Amarelo |
| `PAGO` | Pago | Verde |
| `CANCELADO` | Cancelado | Vermelho |
| `REEMBOLSADO` | Reembolsado | Âmbar |
| `TRANSFERIDO` | Transferido | Roxo |
| `UTILIZADO` | Utilizado | Cinza |
| `EXPIRADO` | Expirado | Cinza |

#### `UserRole` (Flutter)
| Valor | canOpenAdminPanel | Origem |
|---|---|---|
| `master` | ✅ | ecclesiastical_title = bishop ou tbperfil.is_admin |
| `admin` | ✅ | tbperfil.perfil_type = admin ou is_admin |
| `leader` | ✅ | ecclesiastical_title = leader/pastor/deacon/elder/evangelist |
| `member` | ❌ | padrão |

#### `PedidoStatus` (perfil antigo — legado)
```dart
pending, confirmed, cancelled, refunded
```

---

## 5. Schema Completo do Banco de Dados

> **IMPORTANTE:** As tabelas abaixo são o schema definitivo conforme os arquivos SQL em `sql/`. Nem todas existem em produção ainda — ver seção 9 para status de execução.

---

### 5.1 Autenticação e Membros

#### `auth.users` (gerenciado pelo Supabase Auth)
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| email | TEXT | |
| raw_user_meta_data | JSONB | pode conter `role`, `campo_id` |
| created_at | TIMESTAMPTZ | |

#### `members`
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK auth.users | vínculo auth |
| full_name | TEXT | |
| photo_url | TEXT | URL pública do Supabase Storage |
| membership_status | TEXT | active, inactive, visitor, leader, pastor, bishop, deacon, elder, evangelist |
| ecclesiastical_title | TEXT | mesmo domínio que membership_status |
| church_id | UUID FK churches | |
| email | TEXT | |
| phone | TEXT | |
| rol | INTEGER | número de rol do membro |
| deleted_at | TIMESTAMPTZ | soft delete |

**Relações:** `members → churches → headquarters`

#### `churches`
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| name | TEXT | |
| headquarters_id | UUID FK headquarters | |
| regional_id | UUID FK regionais | |

#### `headquarters`
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| name | TEXT | ex: "AD Campinas" |
| instagram | TEXT | |
| youtube | TEXT | |
| field_id | UUID FK fields | |
| show | BOOLEAN | visível no dropdown de cadastro |

#### `regionais`
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| campo_id / headquarters_id | UUID | |

#### `fields`
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| name | TEXT | |

---

### 5.2 CRM / Permissões

#### `users` (tabela CRM — separada de auth.users)
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | igual ao auth.users.id |
| email | TEXT | |
| campo_id | UUID FK headquarters | |
| church_id | UUID FK churches | |
| profile_type | TEXT | admin, operator, viewer |
| is_admin | BOOLEAN | |
| role_id | UUID FK roles | |
| permissions | JSONB | permissões individuais |
| deleted_at | TIMESTAMPTZ | |

#### `roles`
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| name | TEXT | ex: "Secretário", "Pastor" |
| permissions | JSONB | mapa { "modulo.acao": true } |
| deleted_at | TIMESTAMPTZ | |

**RPC:** `get_my_crm_profile()` → retorna `profile_type`, `is_admin`, `role_name`, `user_permissions` (JSONB), `role_permissions` (JSONB)

**Chaves de permissão usadas no app:**
```
crm_pipeline.view         notifications.view        events.view
attendance.view           daily_bread.view          services.view
churches.view             members.view              baptism.view
consecration.view         transfer.view             credentials.view
requirements.view         reports.view              birthdays.view
cashbook.view             finance_entries.view      cash_flow.view
spreadsheets.view         finance_reports.view
system_users.view         system_roles.view
```

---

### 5.3 Agenda / Eventos Legado (tbeventos)

> Tabela legada usada pela `AgendaAnualScreen`. Não é a mesma que `events`.

#### `tbeventos`
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| evento | TEXT | nome do evento |
| datareal | TIMESTAMPTZ | data/hora completa |
| dia | INTEGER | |
| mes | INTEGER | |
| ano | INTEGER | |
| dia_semana | TEXT | "Segunda", "Terça", etc. |
| horario | TEXT | ex: "19:30" |
| local | TEXT | |
| obs | TEXT | |
| ministerio | TEXT | |
| departamento | TEXT | |
| campo | TEXT | |
| regional | TEXT | |
| igreja | TEXT | |
| mostrar | BOOLEAN | visível no app |
| icon_name | TEXT | nome do ícone Material |
| church_id | UUID FK churches | |
| headquarters_id | UUID FK headquarters | |
| audience_scope | TEXT | todos, membros, líderes |

**CRUDs necessários no MRM:**
- **CREATE:** formulário de novo evento de agenda
- **READ:** listagem filtrada por campo/igreja/mês/ano
- **UPDATE:** editar evento
- **DELETE:** soft delete (mostrar = false) ou hard delete

---

### 5.4 Módulo de Eventos (Schema Novo — sql/24)

> Estas são as tabelas do novo sistema de eventos com ingressos, QR codes e pagamento.

#### `events` — Evento principal
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| headquarters_id | UUID | sem FK rígida (compatibilidade) |
| church_id | UUID | |
| nome | TEXT NOT NULL | título do evento |
| descricao | TEXT | |
| imagem_url | TEXT | imagem de capa |
| banner_url | TEXT | banner |
| icon_emoji | VARCHAR(20) | ex: ⛪ 🎵 |
| icon_name | VARCHAR(50) | nome do ícone Material |
| categoria | TEXT | 'Culto', 'Jovens', 'Infantil', 'Missões', etc. |
| tipo_evento | ev_tipo_t | `LIVRE` \| `COM_ASSENTO` |
| local | TEXT | nome do local |
| endereco_completo | TEXT | |
| latitude | NUMERIC(9,6) | |
| longitude | NUMERIC(9,6) | |
| data_inicio | TIMESTAMPTZ | **COLUNA NÃO EXISTE EM PROD AINDA** |
| data_fim | TIMESTAMPTZ | |
| capacidade_total | INTEGER | |
| quantidade_disponivel | INTEGER | decrementado a cada venda |
| evento_pago | BOOLEAN | false = gratuito |
| valor_ingresso | NUMERIC(10,2) | preço padrão |
| status | ev_status_t | `RASCUNHO` \| `PUBLICADO` \| `ENCERRADO` \| `CANCELADO` |
| permite_transferencia | BOOLEAN | default true |
| permite_cancelamento | BOOLEAN | default true |
| permite_reembolso | BOOLEAN | default false |
| limite_por_usuario | SMALLINT | max ingressos por pessoa (default 4) |
| observacoes | TEXT | |
| department_id | UUID FK event_departments | adicionado pela migration 25 |
| created_by | UUID FK auth.users | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ | soft delete |

**Índices:** headquarters_id, status+deleted_at, data_inicio, categoria, department_id

**CRUDs necessários no MRM:**
- **CREATE:** formulário completo com upload de imagem, tipo, setores, preço
- **READ:** listagem paginada filtrada por status/campo/categoria/data
- **UPDATE:** editar todas as informações + publicar/encerrar/cancelar
- **DELETE:** soft delete (deleted_at)
- **PUBLICAR:** status RASCUNHO → PUBLICADO
- **ENCERRAR:** status PUBLICADO → ENCERRADO

---

#### `event_departments` — Departamentos de eventos
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| church_id | UUID NOT NULL | multi-tenant |
| nome | VARCHAR(150) | ex: "Jovens", "Louvor" |
| descricao | TEXT | |
| icone | VARCHAR(255) | nome do ícone Material |
| cor | VARCHAR(50) | hex ex: '#6366F1' |
| imagem | VARCHAR(500) | banner do departamento |
| slug | VARCHAR(150) | gerado automaticamente do nome |
| ordem | INTEGER | ordenação |
| ativo | BOOLEAN | |
| created_by | UUID | |
| created_at / updated_at | TIMESTAMPTZ | |

**RPC disponíveis:**
- `fn_get_departments(p_church_id UUID)` → lista com contagem de eventos
- `fn_delete_department(p_dept_id UUID, p_force BOOLEAN)` → exclui com verificação
- `fn_transfer_dept_events(p_from_dept UUID, p_to_dept UUID)` → move eventos entre depts

**CRUDs necessários no MRM:**
- **CREATE:** novo departamento com ícone, cor e imagem
- **READ:** listar por church_id com contagem de eventos (usar `fn_get_departments`)
- **UPDATE:** editar nome, ícone, cor, ordem, imagem
- **DELETE:** via `fn_delete_department` (impede se tiver eventos, ou força com p_force=true)
- **REORDER:** drag-and-drop que atualiza o campo `ordem`

---

#### `event_sectors` — Setores (usado quando COM_ASSENTO)
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK events | |
| nome | TEXT | ex: "Plateia", "VIP", "Camarote" |
| preco | NUMERIC(10,2) | preço específico do setor |
| quantidade | INTEGER | capacidade do setor |
| cor_hex | VARCHAR(7) | cor de exibição no mapa |
| ordem | SMALLINT | |
| created_at | TIMESTAMPTZ | |

**CRUDs necessários no MRM:**
- **CREATE:** adicionar setor a um evento
- **READ:** listar setores de um evento
- **UPDATE:** editar nome, preço, cor
- **DELETE:** remover setor (libera assentos)

---

#### `event_rows` — Fileiras dentro de um setor
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK events | |
| sector_id | UUID FK event_sectors | |
| nome | TEXT | ex: "A", "B", "FRENTE" |
| ordem | SMALLINT | |
| created_at | TIMESTAMPTZ | |

---

#### `event_seats` — Assentos individuais
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK events | |
| sector_id | UUID FK event_sectors | |
| row_id | UUID FK event_rows | |
| numero | SMALLINT | número do assento |
| status | seat_status_t | `LIVRE` \| `RESERVADO` \| `OCUPADO` \| `BLOQUEADO` |
| reservado_por | UUID FK auth.users | quem reservou |
| reservado_em | TIMESTAMPTZ | |
| reserva_expira | TIMESTAMPTZ | TTL da reserva (5 min) |
| order_item_id | UUID FK event_order_items | circular FK |
| created_at | TIMESTAMPTZ | |
| **UNIQUE** | (event_id, sector_id, row_id, numero) | |

**Índices:** event_id, event_id+sector_id, event_id+status, reservado_por, reserva_expira

**CRUDs necessários no MRM:**
- **CREATE BULK:** gerar todos os assentos de um setor automaticamente
- **READ:** mapa visual de assentos com status em tempo real
- **UPDATE:** bloquear/desbloquear assentos individualmente
- **DELETE:** remover assentos ao deletar setor

---

#### `event_cart` — Carrinho (TTL = 5 minutos)
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK auth.users | |
| event_id | UUID FK events | |
| seat_id | UUID FK event_seats | NULL para eventos LIVRE |
| sector_id | UUID FK event_sectors | |
| qty | SMALLINT | > 1 apenas para LIVRE |
| unit_price | NUMERIC(10,2) | |
| expires_at | TIMESTAMPTZ | now() + 5 minutos |
| created_at | TIMESTAMPTZ | |

**Regra de negócio:** Ao expirar, os assentos devem ser liberados automaticamente (via cron ou trigger). A função `app_cleanup_expired_reservations()` faz isso.

---

#### `event_orders` — Pedido consolidado
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK auth.users | comprador |
| event_id | UUID FK events | |
| numero_pedido | TEXT UNIQUE | formato: `PED-XXXXXXXX` |
| buyer_name | TEXT | nome do comprador no momento da compra |
| buyer_email | TEXT | |
| buyer_phone | TEXT | |
| subtotal | NUMERIC(10,2) | |
| desconto | NUMERIC(10,2) | |
| total | NUMERIC(10,2) | |
| payment_method | TEXT | `free` \| `pix` \| `credit_card` \| `debit_card` |
| payment_ref | TEXT | referência do pagamento externo |
| status | order_status_t | ver enum acima |
| notas | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| cancelled_at | TIMESTAMPTZ | |

**CRUDs necessários no MRM:**
- **READ:** listar todos os pedidos de um evento com filtros de status/data
- **UPDATE status:** confirmar, cancelar, reembolsar pedido
- **EXPORT:** exportar lista de compradores para CSV

---

#### `event_order_items` — Ingressos individuais (1 por assento)
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| order_id | UUID FK event_orders | |
| event_id | UUID FK events | |
| seat_id | UUID FK event_seats | NULL para LIVRE |
| sector_id | UUID FK event_sectors | |
| sector_nome | TEXT | snapshot do nome do setor |
| row_nome | TEXT | snapshot da fileira |
| seat_numero | SMALLINT | snapshot do número |
| unit_price | NUMERIC(10,2) | |
| qty | SMALLINT | 1 para assentos, N para LIVRE |
| created_at | TIMESTAMPTZ | |

---

#### `event_qrcodes` — QR Code digital por ingresso
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| order_item_id | UUID FK event_order_items | |
| user_id | UUID FK auth.users | dono atual do ingresso |
| event_id | UUID FK events | |
| ticket_code | TEXT UNIQUE | formato: `TK-XXXXXXXXXXXXXXXXXXXXXXXXXXXX` |
| qr_payload | TEXT | JSON/texto embutido no QR code |
| is_used | BOOLEAN | false = não utilizado |
| used_at | TIMESTAMPTZ | |
| checked_in_by | UUID FK auth.users | quem fez o check-in |
| issued_at | TIMESTAMPTZ | |
| cancelled_at | TIMESTAMPTZ | |

**CRUDs necessários no MRM:**
- **READ:** listar QR codes de um evento
- **CHECK-IN:** scanner lê `ticket_code`, valida e marca `is_used = true` + `used_at` + `checked_in_by`
- **UPDATE:** cancelar ingresso

---

#### `event_ticket_transfer` — Histórico de transferências de ingressos
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| qrcode_id | UUID FK event_qrcodes | |
| event_id | UUID FK events | |
| from_user_id | UUID FK auth.users | quem transferiu |
| to_user_id | UUID FK auth.users | quem recebeu |
| to_member_rol | TEXT | ROL do membro destino |
| transferred_at | TIMESTAMPTZ | |
| accepted_at | TIMESTAMPTZ | NULL = pendente |
| rejected_at | TIMESTAMPTZ | NULL = não rejeitou |

**Regra:** transferência precisa ser aceita pelo destinatário. Até aceitar, o ingresso continua com o remetente.

---

#### `event_notifications` — Notificações de ingresso
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK auth.users | destinatário |
| event_id | UUID FK events | |
| qrcode_id | UUID FK event_qrcodes | |
| transfer_id | UUID FK event_ticket_transfer | |
| tipo | TEXT | `ticket_received` \| `reminder` \| `update` |
| titulo | TEXT | ex: "🎁 Você recebeu um ingresso!" |
| mensagem | TEXT | |
| lida | BOOLEAN | false = não lida |
| aceita | BOOLEAN | NULL=pendente, TRUE=aceito, FALSE=recusado |
| created_at | TIMESTAMPTZ | |

**CRUDs necessários no MRM:**
- **READ:** painel de notificações por evento
- **CREATE:** disparar notificação para membros (ex: lembrete do evento)

---

#### `event_refunds` — Solicitações de reembolso
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| order_id | UUID FK event_orders | |
| user_id | UUID FK auth.users | |
| event_id | UUID FK events | |
| motivo | TEXT | |
| status | TEXT | `SOLICITADO` \| `APROVADO` \| `NEGADO` \| `PROCESSADO` |
| valor | NUMERIC(10,2) | |
| notas_admin | TEXT | observações do admin |
| requested_at | TIMESTAMPTZ | |
| resolved_at | TIMESTAMPTZ | |
| resolved_by | UUID FK auth.users | admin que resolveu |

**CRUDs necessários no MRM:**
- **READ:** fila de solicitações de reembolso
- **UPDATE:** aprovar/negar/processar reembolso
- **WORKFLOW:** aprovação muda status do pedido para `REEMBOLSADO`

---

### 5.5 Conteúdo / Pão Diário

#### `app_daily_bread_entries` — Mensagens devocionais
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| title | TEXT | |
| summary | TEXT | resumo curto |
| body_text | TEXT | texto completo |
| bible_reference | TEXT | ex: "João 3:16" |
| audio_url | TEXT | URL do arquivo de áudio |
| audio_duration_seconds | INTEGER | |
| accent_hex | VARCHAR(7) | cor de destaque |
| icon_name | TEXT | ícone Material |
| published_at | TIMESTAMPTZ | data de publicação |
| is_featured | BOOLEAN | destaque no topo |
| active | BOOLEAN | visível no app |
| campo_id | UUID FK headquarters | multi-tenant |

#### `app_daily_bread_likes` — Curtidas no pão diário
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| entry_id | UUID FK app_daily_bread_entries | |
| member_id | UUID FK members | |
| liked_at | TIMESTAMPTZ | |

**CRUDs necessários no MRM:**
- **CREATE:** publicar nova mensagem com texto, áudio, referência bíblica
- **READ:** listar mensagens por campo, filtrar por data/destaque
- **UPDATE:** editar, ativar/desativar, marcar como destaque
- **DELETE:** soft delete (active = false)
- **UPLOAD ÁUDIO:** envio de arquivo de áudio para Supabase Storage

---

### 5.6 Ministérios e Liderança

#### `ministries`
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| name | TEXT | |
| description | TEXT | |
| phone | TEXT | |
| color | TEXT | hex |
| icon | TEXT | nome do ícone |
| is_active | BOOLEAN | |
| church_id | UUID FK churches | |
| deleted_at | TIMESTAMPTZ | |

**CRUDs necessários no MRM:**
- **CREATE/UPDATE/DELETE:** gerenciar ministérios por igreja

---

### 5.7 Cadastro/Registro

#### `app_cadastros` — Rastreamento de cadastros no app
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| auth_user_id | UUID FK auth.users | |
| email | TEXT | |
| campo_name | TEXT | nome do campo selecionado |
| is_member | BOOLEAN | já é membro da DB |
| status | TEXT | `pendente` \| `active` \| `rejected` |

---

### 5.8 Agenda Presencial (tbeventos)

Veja seção 5.3. O app também tem:

#### `church_schedule` — Horários de culto
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| headquarters_id | UUID FK headquarters | FK adicionada pela migration 17 |
| dia_semana | TEXT | |
| horario | TIME | |
| tipo_culto | TEXT | |
| descricao | TEXT | |

#### `church_access_info` — Informações de acesso/localização
| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| headquarters_id | UUID FK headquarters | FK adicionada pela migration 17 |
| tipo | TEXT | endereço, transporte, estacionamento |
| descricao | TEXT | |

---

## 6. Supabase Storage

### Bucket `dados` (público)

| Path | Uso |
|---|---|
| `profiles/{member_id}/photo.jpg` | Foto de perfil do membro |

**Operações do app:**
- **UPLOAD:** `uploadBinary(path, bytes, upsert: true, contentType: image/jpeg)`
- **GET URL:** `getPublicUrl(path)` + cache-buster `?t={timestamp}`
- **UPDATE:** upsert sobrescreve o arquivo

**Regras de acesso:** bucket deve ser público para leitura. Upload requer autenticação.

**CRUDs necessários no MRM:**
- Configurar bucket público no Supabase Dashboard
- Eventual moderação de fotos inadequadas

---

## 7. RPC Functions (Supabase PostgreSQL)

| Função | Parâmetros | Retorno | Uso |
|---|---|---|---|
| `get_my_crm_profile()` | — | profile_type, is_admin, role_name, user_permissions, role_permissions | Login → carrega permissões do CRM |
| `fn_get_departments(p_church_id UUID)` | church_id | tabela de departments com contagem | EventosScreen → chips de filtro |
| `fn_delete_department(p_dept_id UUID, p_force BOOLEAN)` | dept_id, force | JSONB {ok, error, count} | Admin → deletar departamento |
| `fn_transfer_dept_events(p_from_dept UUID, p_to_dept UUID)` | from, to | INTEGER (qtd transferida) | Admin → mover eventos entre depts |
| `app_cleanup_expired_reservations()` | — | INTEGER (qtd liberada) | Cron job a cada 1 min |

**Funções a criar (ainda não implementadas):**

| Função | Parâmetros | O que deve fazer |
|---|---|---|
| `fn_checkout(p_user_id, p_event_id, p_seat_ids[], p_payment_method)` | — | Cria pedido, itens, QR codes, atualiza assentos atomicamente |
| `fn_cancel_order(p_order_id)` | — | Cancela pedido, libera assentos, cancela QR codes |
| `fn_checkin_ticket(p_ticket_code, p_checker_id)` | — | Valida QR code, marca used, retorna dados do ingresso |
| `fn_request_refund(p_order_id, p_motivo)` | — | Cria registro em event_refunds, não reembolsa ainda |
| `fn_transfer_ticket(p_qrcode_id, p_to_member_rol)` | — | Cria transferência pendente, notifica destinatário |

---

## 8. Regras de Negócio Detalhadas

### 8.1 Autenticação e Membership

1. **Login:** Supabase Auth (email/senha). Após login, busca `members` por `user_id` (FK) ou `email` como fallback.
2. **Vinculação:** Membro pode informar ROL + CPF para vincular sua conta Auth ao registro em `members`.
3. **Cadastro:** Seleciona o campo no dropdown (carregado de `headquarters WHERE show = true`), cria conta Auth, cria registro em `app_cadastros`.
4. **Perfil:** Membro pode editar nome, email, telefone e foto. Foto vai para Storage, URL salva em `members.photo_url`.
5. **Roles:** Derivados de `ecclesiastical_title` do membro OU do perfil CRM (`get_my_crm_profile`). O CRM tem precedência.

### 8.2 Eventos e Ingressos

1. **Tipos de evento:**
   - **LIVRE:** sem assento numerado. Usuário escolhe quantidade (até `limite_por_usuario`). Ticket não tem setor/fileira.
   - **COM_ASSENTO:** mapa visual de setores → fileiras → assentos. Usuário seleciona até 4 assentos por vez (configurável por evento).

2. **Fluxo de compra:**
   ```
   EventoDetail → SeatPicker/FreeSheet → CheckoutScreen
     → Cria event_orders (status: AGUARDANDO_PAGAMENTO)
     → Cria event_order_items (1 por assento/ingresso)
     → Gera event_qrcodes (1 por item)
     → Atualiza event_seats status para OCUPADO
     → Decrementa events.quantidade_disponivel
     → Atualiza event_orders.status para PAGO (se free)
   ```

3. **Reserva temporária:** Ao selecionar assento, reservar por 5 minutos (`event_cart`). Após expirar, liberar automaticamente.

4. **Limite por usuário:** `events.limite_por_usuario` (default: 4 ingressos por pessoa por evento).

5. **Cancelamento:**
   - Permitido se `events.permite_cancelamento = true`
   - Status do pedido muda para CANCELADO
   - Assentos voltam para LIVRE
   - QR codes ficam cancelados

6. **Reembolso:**
   - Apenas se `events.permite_reembolso = true`
   - Cria registro em `event_refunds`
   - Admin aprova/nega no MRM

7. **Transferência de ingresso:**
   - Apenas se `events.permite_transferencia = true`
   - Remetente informa ROL do destinatário
   - Busca membro pelo ROL, cria notificação
   - Destinatário aceita → QR code muda `user_id`

8. **QR Code:** Contém JSON `{ticket_code, event_id, seat_label, member_name}`. Check-in valida `ticket_code` na tabela `event_qrcodes`.

9. **Categorias:** Campo livre em `events.categoria`. Valores típicos: "Culto", "Jovens", "Infantil", "Missões", "Louvor", "Mulheres", "Homens", "Conferência", "Geral".

### 8.3 Pão Diário

1. Exibe mensagens do dia com texto, versículo bíblico e áudio.
2. Filtrado por `campo_id` (headquarters).
3. Usuário pode curtir (registro em `app_daily_bread_likes`).
4. Admin publica mensagens no MRM com data futura.

### 8.4 Multi-Tenancy

1. Tudo é filtrado por `headquarters_id` (campo/sede).
2. `SessionController.headquartersId` é carregado via: `members → churches → headquarters`.
3. Eventos sem `headquarters_id` são exibidos para todos.
4. Membros de igrejas locais (churches) veem eventos da sua sede.

---

## 9. Status de Execução das Migrations SQL

| Arquivo | Descrição | Status em Prod |
|---|---|---|
| `sql/15_app_daily_bread.sql` | Tabelas pão diário | ✅ Executado |
| `sql/16_app_eventos_ingressos.sql` | Schema antigo de eventos app | ⚠️ Parcial |
| `sql/17_headquarters_fk_constraints.sql` | FKs church_schedule e church_access_info | ❓ Não confirmado |
| `sql/18_create_missing_app_tables.sql` | Tabelas diversas | ❓ Não confirmado |
| `sql/19_app_membros_auth_v2.sql` | Membros auth v2 | ❓ Não confirmado |
| `sql/20_app_cadastros.sql` | Tabela app_cadastros | ❓ Não confirmado |
| `sql/21_tbperfil_app_access.sql` | Perfil app access | ❓ Não confirmado |
| `sql/22_crm_profile_rpc.sql` | RPC get_my_crm_profile | ❓ Não confirmado |
| `sql/23_app_events_buildings.sql` | Salas de eventos | ❓ Não confirmado |
| `sql/24_events_complete.sql` | **Schema completo de eventos** | ❌ NÃO executado |
| `sql/25_event_departments.sql` | Departamentos de eventos | ❌ NÃO executado |
| `sql/26_events_headquarters_backfill.sql` | Adiciona headquarters_id a events | ❌ NÃO executado |

> **Ação imediata:** Executar `24`, `25` e `26` no Supabase SQL Editor para que o módulo de eventos funcione completamente.

---

## 10. CRUDs Necessários no Sistema MRM (Painel Admin)

Esta seção lista **o que o sistema administrativo MRM precisa implementar** para que o app funcione 100%.

### 10.1 Gestão de Eventos

#### CRUD Completo de Eventos (`events`)
```
Criar evento:
  - Nome, descrição, categoria, tipo (LIVRE/COM_ASSENTO)
  - Data início/fim, local, lat/lng
  - Capacidade total, preço, pago/gratuito
  - Regras: transferência, cancelamento, reembolso, limite por usuário
  - Upload de imagem/banner (Supabase Storage)
  - Associar a headquarters_id e department_id
  - Status inicial: RASCUNHO

Publicar evento:
  - Status RASCUNHO → PUBLICADO
  - Validar que tem data, local, capacidade

Encerrar/cancelar evento:
  - Status → ENCERRADO ou CANCELADO
  - Se cancelar: notificar compradores, iniciar reembolsos automaticamente

Editar evento:
  - Permitir edição enquanto RASCUNHO
  - Edições limitadas quando PUBLICADO (não pode reduzir capacidade abaixo das vendas)

Deletar evento:
  - Soft delete (deleted_at)
  - Bloquear se tiver pedidos PAGO
```

#### Gestão de Setores (`event_sectors`)
```
Criar setor:
  - Nome, preço, quantidade, cor
  - Associado a um evento COM_ASSENTO

Editar setor:
  - Nome, cor, preço (se não houver assentos vendidos)

Excluir setor:
  - Bloquear se tiver assentos OCUPADOS

Gerar assentos em lote:
  - Informar número de fileiras e assentos por fileira
  - Criar event_rows + event_seats automaticamente
```

#### Mapa de Assentos (`event_seats`)
```
Visualizar mapa:
  - Grid visual mostrando status de cada assento em tempo real
  - Cores: LIVRE (verde), RESERVADO (amarelo), OCUPADO (vermelho), BLOQUEADO (cinza)

Bloquear/desbloquear assentos:
  - Click no assento → mudar status entre LIVRE e BLOQUEADO

Liberar reservas expiradas:
  - Botão manual ou automático via cron
```

#### Gestão de Departamentos (`event_departments`)
```
Criar departamento:
  - Nome, ícone (Material icon name), cor hex, imagem, ordem

Listar departamentos:
  - Ordenados por `ordem`
  - Mostrar contagem de eventos

Editar:
  - Nome, ícone, cor, imagem

Reordenar:
  - Drag-and-drop que atualiza `ordem`

Excluir:
  - Usar fn_delete_department(id, force)
  - Se force=false e tiver eventos: mostrar aviso
  - Se force=true: mover eventos para sem-departamento
```

### 10.2 Gestão de Pedidos e Check-in

#### Lista de Pedidos (`event_orders`)
```
Listar pedidos de um evento:
  - Filtrar por status, data, payment_method
  - Mostrar: numero_pedido, buyer_name, buyer_email, total, status

Detalhes do pedido:
  - Ingressos individuais (event_order_items)
  - QR codes gerados (event_qrcodes)

Ações manuais:
  - Confirmar pedido AGUARDANDO → PAGO
  - Cancelar pedido → CANCELADO (liberar assentos)
  - Aprovar/negar reembolso

Exportar lista:
  - CSV com nome, email, assentos, total
```

#### Check-in Scanner
```
Interface de scanner:
  - Input de texto para ticket_code (ou câmera QR no mobile)
  - Chamar fn_checkin_ticket(ticket_code, checker_id)
  - Exibir: nome do membro, assento, evento
  - Marcar is_used = true, used_at, checked_in_by

Listagem de check-ins:
  - Ver quem já entrou
  - Contagem presentes / total
```

#### Fila de Reembolsos (`event_refunds`)
```
Ver solicitações pendentes:
  - Filtrar por status: SOLICITADO, APROVADO, NEGADO, PROCESSADO

Aprovar reembolso:
  - status → APROVADO
  - Muda order → REEMBOLSADO
  - Libera assentos

Negar reembolso:
  - status → NEGADO
  - Adicionar notas_admin com justificativa

Processar reembolso:
  - status → PROCESSADO
  - Registrar data e responsável
```

### 10.3 Pão Diário (`app_daily_bread_entries`)

```
Criar mensagem:
  - Título, resumo, texto completo, versículo bíblico
  - Data de publicação (pode ser futura)
  - Upload de áudio (Supabase Storage → audio_url)
  - Ícone e cor accent
  - Associar a campo_id (headquarters)
  - Marcar como destaque (is_featured)

Listar mensagens:
  - Filtrar por campo, data, destaque
  - Status: ativa/inativa

Editar/Desativar:
  - Editar conteúdo antes da data de publicação
  - Desativar: active = false

Ver engajamento:
  - Contagem de curtidas por mensagem
```

### 10.4 Agenda Anual (`tbeventos`)

```
Criar evento de agenda:
  - Nome, data completa, horário
  - Local, observações
  - Ministerio, departamento, campo, regional, igreja
  - Ícone (icon_name Material)
  - Audiência: todos / membros / líderes
  - mostrar = true

Editar / Excluir evento de agenda

Filtros na listagem:
  - Por mês/ano, campo, igleja, departamento
```

### 10.5 Ministérios (`ministries`)

```
CRUD completo:
  - Nome, descrição, telefone de contato
  - Ícone, cor
  - Associar a church_id
  - Ativar/desativar (is_active)
  - Soft delete (deleted_at)
```

### 10.6 Gestão de Membros (`members`)

```
Listar membros:
  - Filtrar por church_id, headquarters_id, membership_status
  - Buscar por nome, email, ROL

Detalhes do membro:
  - Dados completos
  - Histórico de compras (event_orders)
  - Ingressos ativos (event_qrcodes WHERE is_used = false)

Editar membro:
  - Status (active/inactive/visitor)
  - Título eclesiástico
  - Vinculação com conta Auth (user_id)

Associar conta Auth:
  - Buscar auth.users pelo email
  - Atualizar members.user_id

Soft delete:
  - deleted_at = now()
```

### 10.7 Notificações de Ingresso (`event_notifications`)

```
Painel de notificações por evento:
  - Ver pendentes de resposta (aceita IS NULL)
  - Transferências aguardando aceite

Disparo manual de notificações:
  - Lembrete de evento (tipo: reminder)
  - Aviso de mudança (tipo: update)
  - Segmentar por: todos compradores / setor específico
```

---

## 11. Relatórios Necessários no MRM

| Relatório | Dados | Agrupamento |
|---|---|---|
| Vendas por evento | Total arrecadado, nº pedidos, nº ingressos | Por forma de pagamento |
| Ocupação de assentos | % ocupado por setor | Por evento |
| Check-in ao vivo | Presentes vs total | Por evento, atualização em tempo real |
| Histórico de membro | Eventos comprados, cancelamentos | Por membro |
| Reembolsos solicitados | Total solicitado, aprovado, negado | Por período/evento |
| Engajamento Pão Diário | Visualizações, curtidas | Por mensagem/semana |

---

## 12. Considerações de Segurança (RLS)

### Políticas necessárias

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| events | Todos (PUBLICADO) | service_role + auth admin | service_role + dono | service_role |
| event_orders | Dono (user_id) | auth users | Dono (cancel) / service_role | Não |
| event_qrcodes | Dono (user_id) | service_role | service_role | Não |
| event_cart | Dono (user_id) | auth users | Dono | Dono |
| event_departments | Todos (ativo) | auth admins | auth admins | auth admins |
| app_daily_bread_entries | Todos (active) | service_role | service_role | service_role |
| members | Dono (user_id) | service_role | Dono + admins | Admins |
| ministries | Todos (is_active) | admins | admins | admins |

> O app usa a `anon_key` para queries do app. Operações admin devem usar `service_role` no backend do MRM.

---

## 13. Temas e Identidade Visual

### Paleta Modo Claro (AppPalette)
| Variável | Hex |
|---|---|
| background | `#F0F3FB` |
| surface | `#FFFFFF` |
| surfaceRaised | `#F8FAFF` |
| accent | `#1A1D3D` (azul escuro) |
| secondary | `#4A56C1` |
| textPrimary | `#0F1228` |
| textMuted | `#6B7599` |
| border | `#DDE3F0` |
| success | `#22C55E` |
| error | `#EF4444` |
| warning | `#F59E0B` |

### Paleta Modo Escuro (DP)
| Variável | Hex |
|---|---|
| background | `#0D0E1A` |
| surface | `#14162A` |
| surfaceRaised | `#1C1F38` |
| accent | `#4DD9C0` (teal) |
| secondary | `#6E78C8` |
| textPrimary | `#ECF0FF` |
| textMuted | `#8892B0` |
| border | `#252845` |

---

## 14. Padrões de UI do App

- **Header global:** `_GlobalHeader` — exibe foto + nome do membro + sino de notificações + botão de voltar (onBack). **Todo painel de admin deve seguir esse padrão** ou usar `_SubScreenHeader`.
- **Botão primário:** `FilledButton` largo, altura mínima 52px, largura total
- **Cores suaves:** sem gradientes fortes nos elementos de UI; usar `surfaceContainerHighest` para fundos de chips/banners
- **Bottom navigation:** 4 abas (Home, Feed, História, Perfil)
- **Fontes:** Google Fonts — Poppins (títulos), Inter/Lato (corpo)

---

## 15. Próximos Passos / Pendências

### Urgente (bloqueia funcionalidade)
1. ✅ Executar `sql/24_events_complete.sql` em produção
2. ✅ Executar `sql/25_event_departments.sql` em produção
3. ✅ Executar `sql/26_events_headquarters_backfill.sql` em produção
4. Adicionar coluna `data_inicio` à tabela `events` em produção (incluída no sql/24)
5. Implementar `fn_checkout()` no banco para criar pedido atomicamente
6. Implementar `fn_checkin_ticket()` para o scanner de QR code

### MRM — Funcionalidades que desbloqueiam o app
1. CRUD de eventos (MRM cria, app consome)
2. CRUD de departamentos de eventos
3. Gestão de setores e assentos
4. Fila de reembolsos
5. Scanner de check-in
6. CRUD de pão diário com upload de áudio
7. CRUD de agenda anual (`tbeventos`)
8. CRUD de ministérios

### Melhorias futuras no app
- Push notifications (Supabase Realtime ou FCM)
- Pagamento online (PIX via gateway externo)
- Feed social completo (posts, comentários, stories)
- Testemunhos completo
- ✅ Ajuda pastoral (formulário de envio) e solicitações de filiação ("Quero ser Membro") via Z-API e OTP
- Perfil eclesiástico completo (batismo, consagração, transferência)

---

## 16. Módulo de Atendimento Pastoral & Quero Ser Membro

O módulo completo de acolhimento pastoral para visitantes e membros, bem como o fluxo de solicitações de filiação ("Quero ser Membro") foi implementado e está documentado em detalhes no arquivo [docs/modules/pastoral.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/pastoral.md).

