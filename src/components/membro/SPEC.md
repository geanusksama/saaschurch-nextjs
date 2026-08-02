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

### `GET /api/membro/perfil?token=<member_token>`
- Autenticada pelo member_token — o id vem do `sub` assinado, nunca da query
- Join eclesiástico do membro logado (`src/lib/membroPerfilService.ts`)
- Retorna: `{ member, gf, funcoes, ministerios, batismo, temVidaEclesiastica }`
  - `gf`: o Grupo Familiar que a pessoa **lidera** (`cell_group_leaders` ou o
    `leader_id` antigo) ou, se não liderar nenhum, o que ela **participa**
    (`cell_group_members` ativo). GF inativo ou excluído não conta.
  - `funcoes`: `church_function_history` vigente (ativa e sem `end_date`)
  - `ministerios`: `ministry_members` ativos de ministérios ativos
  - `batismo`: tabela `baptisms` e, na falta dela, `members.baptism_date`
- E2E: `npx tsx scripts/e2e-membro-perfil.mjs`

### `GET /api/membro/atividades?token=<member_token>`
- Autenticada igual à de cima; o que abre nos ícones da grade "Meus dados"
- `src/lib/membroAtividadesService.ts` — buscada só no primeiro toque num ícone
- Retorna: `{ filhos, presencas, inscricoes, totais }`
  - `filhos`: `member_family_relationships` do tipo `FILHO`. Filho com ficha de
    membro vem com foto e ROL; criança sem ficha vem por `related_name`
  - `presencas`: junta `event_attendance` (check-in em evento) com
    `face_presencas` (leitor facial). A tabela do leitor **não tem member_id**:
    grava o ROL, então quem não tem ROL não tem essa origem
  - `inscricoes`: `event_registrations` com status, pagamento e check-in. As
    compras de ingresso entram aqui quando o módulo existir
- E2E: mesmo script do perfil

---

## 4. Rotas React Router

```
/membro                    → MembroRoot (auth guard)
/membro/perfil             → MembroPerfil     (a tela do portal)
/membro/faceid             → MembroFaceId
/membro/membros            → MembroMembros
/membro/pastoral           → MembroPastoral
/membro/*                  → MembroEmConstrucao (curinga)
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

**Telas já migradas para o TEMA CLARO FIXO** (perfil, Face ID, Membros do Campo
e "Em construção"): a paleta única vive em `src/components/membro/theme.ts`.
Cada uma dessas rotas remove a classe `dark` do `<html>` enquanto está montada,
senão o `globals.css` reescreve `bg-white`/`text-slate-*` e o texto some — foi
exatamente o que aconteceu antes da migração. Essas telas também não usam o
MembroShell: saem direto para o perfil.

O azul `#2563eb` é o padrão. No perfil ele vira **rosa `#db2777` quando o sexo
do cadastro é feminino**; sem sexo preenchido continua azul — a tela nunca
"chuta" um gênero.

**Bottom Navigation** do MembroShell (telas ainda não migradas):
```
[Início]  [Feed]  [❤]  [História]  [Perfil]
```

---

## 6. Telas

### 6.1 MembroPerfil (tela inicial após login)

É a **tela única** do portal: o menu foi absorvido por ela. Tema claro fixo.

**Topo** — a foto do membro ocupa metade da tela. Só a foto DELE: a foto do GF
é do grupo e vive no card do Grupo Familiar, nunca como retrato de pessoa. Sem
foto, aparece a inicial do nome. Sobre a foto: voltar, curtidas e **sair da
conta**; embaixo, título eclesiástico, situação, nome com o **ROL ao lado**,
igreja e campo.

**Ações** — botão principal `Cadastrar meu rosto (Face ID)`, mais dois ícones:
3 pontinhos (ficha completa) e pessoas (Membros do Campo).

**Grade "Meus dados"** — 5 ícones por linha, agrupados por assunto:

| Devocional | Igreja e pessoas | Agenda, ingressos e minha vida |
|------------|------------------|--------------------------------|
| Bíblia, Pão diário, Pregações, Rádio, Feed | Ministério, Liderança, Igreja, História, Atend. Past. | Agenda, Inscrições, Compras, Presenças, Filhos |

Inscrições, Presenças e Filhos abrem modais com dados reais (com selinho de
contagem); os demais navegam. Rotas que ainda não existem caem em
"Em construção".

**Blocos que só aparecem se existirem** (sem card vazio):

| Se tem GF | Se tem vida eclesiástica |
|-----------|--------------------------|
| Card do Grupo Familiar: nome, tipo, horário, líderes (casal) com WhatsApp, endereço no mapa e — para quem lidera — a contagem de participantes | Funções vigentes na igreja, ministérios (marcando quando é a liderança) e batismo (data, local, ministrante) |

O bloco do GF aparece tanto para quem **lidera** quanto para quem **participa**
— muda o rótulo e a contagem. Os dados vêm de `/api/membro/perfil` e
`/api/membro/atividades`; a sessão do localStorage só tem a ficha básica.

### 6.2 Telas removidas

Sumiram de vez (arquivo, rota e link): **menu, feed, história, pregações,
agenda, pão diário, testemunhos e liderança**. Eram cascas sem nenhuma consulta
— abriam vazias e pareciam app quebrado. Os ícones delas continuam na grade
**Menu** do perfil, mas marcados `construcao: true`: em vez de navegar, abrem um
modal "Estamos preparando esta área". Quando a tela existir, troca-se o
`construcao` por um `path`.

A barra inferior do MembroShell também saiu, pelo mesmo motivo: apontava para
essas rotas. Hoje o shell é só um cabeçalho com voltar, e sobrou uma única tela
usando ele.

### 6.3 MembroFaceId, MembroMembros, MembroPastoral

As três seguem o tema claro. Membros do Campo tem o mesmo desenho do perfil
(foto no topo com base curva, dados embaixo) e pagina de **10 em 10** — a
pessoa vê um membro por tela, então lote grande só pesava.

### 6.4 Trilha do membro (a construir)

Na bandeja "Meu perfil" há um grupo de três atalhos que ainda não existem:
**Treinamento de GF, Cursos e Mundo da Bíblia** (o joystick também está na linha
de ações do perfil, em destaque). Junto deles ficam os **selos** — Líder de GF,
Líder de ministério, funções na igreja, Batizado — que nascem do cadastro e
crescem conforme a pessoa assume responsabilidades. É onde a gamificação de
cursos vai entrar.

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
src/components/membro/theme.ts
src/lib/membroPerfilService.ts
src/lib/membroAtividadesService.ts
src/app/api/membro/perfil/route.ts
src/app/api/membro/atividades/route.ts
scripts/e2e-membro-perfil.mjs
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
