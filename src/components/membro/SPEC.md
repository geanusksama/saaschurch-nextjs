# Portal "Sou Membro" — SPEC Técnico

**Versão:** 1.0  
**Data:** 2026-06-17  
**Projeto:** saaschurch-nextjs (adcampinas.com.br)

---

## 1. Visão Geral

Portal mobile-first imersivo para membros da AD Campinas acessarem sua ficha, feed, agenda e recursos da igreja diretamente pelo browser — com experiência idêntica ao app Flutter novoChurch.

### Proposta de valor
- Membro acessa sem instalar app: abre o navegador, toca "Sou Membro", autentica em 30 segundos
- Experiência app-like: tela cheia, dark mode, bottom nav, animações
- Dados reais do MRM: foto, ROL, título eclesiástico, igreja, situação de membresia

---

## 2. Fluxo de Autenticação

```
Home pública → clica "Sou Membro"
     ↓
Modal — Passo 1: ROL + CPF
     ↓ POST /api/membro/lookup
Retorna: nome, foto_masked, telefone_masked, challenge_token (JWT 10min)
     ↓
Modal — Passo 2: Confirmar telefone
     ↓ POST /api/membro/send-otp
Envia código 6 dígitos via WhatsApp (primeira instância ativa do sistema)
Retorna: otp_token (JWT com hash do código, 10min)
     ↓
Modal — Passo 3: Digitar código recebido
     ↓ POST /api/membro/verify
Verifica código → emite member_token (JWT 7 dias)
     ↓
Navega para /membro/perfil
```

### Tokens JWT (Node crypto, sem pacote externo)
- **challenge_token**: `{ member_id, phone_masked, exp: +10min }` — identifica o membro encontrado
- **otp_token**: `{ member_id, phone, code_hash (bcrypt-like via HMAC-SHA256), exp: +10min }` — prova que o OTP foi enviado
- **member_token**: `{ sub: member_id, name, photo_url, church_id, campo_id, rol, exp: +7dias }` — sessão do membro
- Todos assinados com `MEMBRO_JWT_SECRET` (ou `NEXTAUTH_SECRET` como fallback)
- Armazenados em `localStorage` como `membro_token` e `membro_data`

---

## 3. API Routes

### `POST /api/membro/lookup`
- Pública (sem auth)
- Body: `{ rol: number, cpf: string }`
- Busca membro por `rol` + `cpf` (normaliza CPF: remove pontos/traços)
- Retorna: `{ challenge_token, name, photo_url, phone_masked }`
- Erro 404: membro não encontrado
- Erro 400: CPF inválido

### `POST /api/membro/send-otp`
- Pública (sem auth)
- Body: `{ challenge_token, phone: string }` (phone = confirmação do usuário)
- Verifica challenge_token
- Gera código 6 dígitos aleatório
- Usa primeira instância WhatsApp ativa do sistema (Z-API)
- Armazena hash do código no otp_token (JWT)
- Retorna: `{ otp_token }`

### `POST /api/membro/verify`
- Pública (sem auth)
- Body: `{ otp_token, code: string }`
- Verifica otp_token + hash do código
- Busca dados completos do membro
- Retorna: `{ member_token, member: { id, full_name, photo_url, ecclesiastical_title, membership_status, rol, church: { name }, campo: { name } } }`

---

## 4. Rotas React Router

```
/membro                    → MembroRoot (auth guard)
/membro/perfil             → MembroPerfil
/membro/menu               → MembroMenu
/membro/feed               → MembroFeed
/membro/historia           → MembroHistoria
/membro/pregacoes          → MembroPregacoes
/membro/agenda             → MembroAgenda
/membro/pao-diario         → MembroPaoDiario
/membro/testemunhos        → MembroTestemunhos
/membro/lideranca          → MembroLideranca
/membro/ministerios        → MembroMinisteios
/membro/eventos            → MembroEventos
/membro/pastoral           → MembroPastoral
```

---

## 5. Design System

| Token | Valor |
|-------|-------|
| Background | `#0d0f17` |
| Surface | `rgba(255,255,255,0.05)` |
| Border | `rgba(255,255,255,0.08)` |
| Accent (teal) | `#2dd4bf` |
| Accent glow | `rgba(45,212,191,0.25)` |
| Text primary | `#f1f5f9` |
| Text secondary | `rgba(255,255,255,0.45)` |
| Bottom nav height | `64px` |
| Safe area bottom | `env(safe-area-inset-bottom, 0px)` |

**Bottom Navigation** (5 itens, centro especial):
```
[Menu]  [Feed]  [❤ Teal]  [História]  [Perfil]
```

---

## 6. Telas

### 6.1 MembroPerfil (tela inicial após login)
- Avatar grande com nome e título eclesiástico
- Status badge (Ativo / Congregado / etc.)
- Cards: ROL, Igreja, Campo, Data de batismo
- Botão "Sair"

### 6.2 MembroMenu (grid como Flutter app)
Grid 3 colunas com ícones circulares:
- Bíblia, Igreja, Pregações
- Ministério, Site, Rádio
- Agenda Anual, Eventos, Compras
- Pão Diário, Testemunhos, Atend. Past.
- Liderança

### 6.3 MembroFeed
- Posts do campo (tabela `feed_posts`, filtrado por `campo_id`)
- Pull-to-refresh
- Card com foto do autor, texto, data, likes

### 6.4 MembroHistoria
- Timeline hardcoded da história da AD Campinas (1936–atual)
- Matching com o app Flutter

### 6.5 MembroPregacoes
- Lista de pregações da tabela `app_media_items`
- Filtro: sermão, podcast, clipe
- Link para YouTube/externo

### 6.6 MembroAgenda
- Calendário com eventos da tabela `tbeventos`
- Vista por mês

### 6.7 MembroPaoDiario
- Devocionais de hoje da tabela `app_daily_bread_entries`
- Leitura bíblica + mensagem

### 6.8 MembroTestemunhos
- Feed de testemunhos da tabela `app_testemunhos`

### 6.9 MembroLideranca
- Lista de bispos, pastores, diáconos da tabela `app_lideranca`

### 6.10 MembroMinisterios
- Lista da tabela `ministries` filtrado pelo campo do membro

### 6.11 MembroPastoral
- Formulário de solicitação de atendimento pastoral
- Tabela `pastoral_attendances`

---

## 7. Banco de Dados — Novas Tabelas Necessárias

Nenhuma tabela nova necessária.  
O OTP é armazenado em JWT assinado (stateless) — sem necessidade de tabela.

---

## 8. Variáveis de Ambiente

```env
MEMBRO_JWT_SECRET=<secret-forte-minimo-32-chars>
```

Se não definida, usa `NEXTAUTH_SECRET` como fallback.

---

## 9. Segurança

- Rate limiting: verificar por IP (3 tentativas por CPF por 5 min) — implementado via header check simples
- Código OTP expira em 10 minutos
- Member token expira em 7 dias
- CPF normalizado antes de comparar (remove `.` e `-`)
- Telefone mascarado na resposta (ex: `(**) *****-1234`)
- HTTPS obrigatório em produção (Vercel)

---

## 10. Arquivos Criados

```
src/lib/membroJwt.ts
src/app/api/membro/lookup/route.ts
src/app/api/membro/send-otp/route.ts
src/app/api/membro/verify/route.ts
src/components/membro/MembroProvider.tsx
src/components/membro/MembroLogin.tsx
src/components/membro/MembroRoot.tsx
src/components/membro/MembroShell.tsx
src/components/membro/perfil/MembroPerfil.tsx
src/components/membro/menu/MembroMenu.tsx
src/components/membro/feed/MembroFeed.tsx
src/components/membro/historia/MembroHistoria.tsx
src/components/membro/pregacoes/MembroPregacoes.tsx
src/components/membro/agenda/MembroAgenda.tsx
src/components/membro/pao-diario/MembroPaoDiario.tsx
src/components/membro/testemunhos/MembroTestemunhos.tsx
src/components/membro/lideranca/MembroLideranca.tsx
src/components/membro/ministerios/MembroMinisteios.tsx
```

**Modificados:**
```
src/spa/routes.tsx                        — adiciona /membro/* 
src/components/public/PublicHome.tsx      — adiciona botão "Sou Membro"
```
