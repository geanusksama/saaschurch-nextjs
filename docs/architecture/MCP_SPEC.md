# MCP SPEC — Portal Público & CMS de Departamentos
## saaschurch-nextjs · Revisão 1.0 · 2026-06-09

---

## 1. Visão Geral

Este documento especifica a arquitetura e os módulos do **Portal Público Interativo** e do **CMS de Departamentos** do sistema saaschurch-nextjs.

O objetivo é transformar o site institucional em uma **plataforma digital imersiva**, onde o visitante experimenta a navegação do aplicativo novoChurch diretamente no navegador, e cada departamento possui um mini-site completo gerenciado por CMS visual.

---

## 2. Padrão MCP (Módulo / Componente / Página)

Todo feature novo segue a estrutura:

```
src/
  app-ui/[módulo]/          ← lógica de negócio, fetchers, formulários
  components/public/[mod]/  ← componentes de apresentação (público)
  components/app-ui/[mod]/  ← componentes de apresentação (admin)
  spa/routes.tsx            ← registro de rotas React Router
```

### Regras do padrão MCP
| Camada | Responsabilidade | Pode usar supabase? | Pode usar navigate? |
|--------|-----------------|---------------------|---------------------|
| Página (Page) | Layout e composição | Não | Sim |
| Módulo (Module) | Lógica e dados | Sim | Sim |
| Componente (Component) | Apresentação pura | Não | Não |

---

## 3. Módulos Novos

### 3.1 `portal` — Portal Público Imersivo
**Rota raiz:** `/portal`

| Sub-rota | Componente | Descrição |
|----------|-----------|-----------|
| `/portal` | `PortalExperience` | Shell com transição app-mode |
| `/portal/home` | `AppModeHome` | Grid de tiles do app |
| `/portal/dept/:slug` | `DepartmentMiniSite` | Mini-site do departamento |
| `/portal/dept/:slug/agenda` | `DeptAgenda` | Agenda do depto |
| `/portal/dept/:slug/noticias` | `DeptNews` | Notícias do depto |
| `/portal/dept/:slug/galeria` | `DeptGallery` | Galeria do depto |
| `/portal/dept/:slug/equipe` | `DeptTeam` | Equipe do depto |
| `/portal/dept/:slug/contato` | `DeptContact` | Contato do depto |

---

### 3.2 `cms` — CMS Visual de Departamentos
**Rota raiz:** `/app-ui/cms`

| Sub-rota | Componente | Descrição |
|----------|-----------|-----------|
| `/app-ui/cms` | `CMSDashboard` | Painel geral do CMS |
| `/app-ui/cms/departamentos` | `CMSDepartmentList` | Lista de departamentos |
| `/app-ui/cms/departamentos/:id` | `CMSDepartmentEdit` | Config do depto |
| `/app-ui/cms/departamentos/:id/builder` | `CMSPageBuilder` | Construtor visual |
| `/app-ui/cms/templates` | `CMSTemplates` | Biblioteca de templates |
| `/app-ui/cms/media` | `CMSMediaLibrary` | Biblioteca de mídia |
| `/app-ui/cms/blocos` | `CMSBlockLibrary` | Biblioteca de blocos |

---

## 4. Departamentos Suportados

| Slug | Nome | Tema | Layout Base |
|------|------|------|-------------|
| `cibe` | CIBE | Roxo/Dourado | Hero + Grid |
| `jovens` | Frente Jovem | Neon/Escuro | Hero Vídeo + Feed |
| `varaos` | Varões | Azul/Cinza | Minimalista |
| `adolescentes` | Adolescentes | Laranja/Roxo | Cards coloridos |
| `ebd` | EBD | Azul/Branco | Acadêmico |
| `infantil` | Infantil | Colorido | Lúdico |
| `missoes` | Missões | Terroso/Dourado | Magazine |
| `louvor` | Louvor | Preto/Dourado | Escuro |
| `familia` | Família | Verde/Bege | Caloroso |
| `casais` | Casais | Rosé/Dourado | Elegante |

---

## 5. Especificação de Componentes de Bloco (CMS)

### 5.1 Hero Blocks
```typescript
type HeroVariant = 
  | 'centered'      // texto centrado, bg imagem/vídeo
  | 'split'         // texto esquerda, imagem direita
  | 'video'         // hero com vídeo de fundo autoplay
  | 'carousel'      // slideshow de heroes
  | 'parallax'      // efeito parallax no scroll
  | 'glass'         // glassmorphism sobre imagem
  | 'animated-bg'   // fundo com partículas/gradiente animado

interface HeroBlock {
  variant: HeroVariant;
  title: string;
  subtitle?: string;
  cta?: { label: string; href: string; variant: 'primary' | 'outline' };
  media?: { type: 'image' | 'video'; url: string };
  overlay?: { color: string; opacity: number };
  height?: 'sm' | 'md' | 'lg' | 'full';
}
```

### 5.2 Content Blocks
```typescript
type BlockType = 
  | 'hero'
  | 'text'
  | 'image'
  | 'video'
  | 'gallery'
  | 'cards'
  | 'carousel'
  | 'events'
  | 'team'
  | 'testimonials'
  | 'faq'
  | 'form'
  | 'schedule'
  | 'products'
  | 'news'
  | 'map'
  | 'social'
  | 'pdf'
  | 'divider'
  | 'spacer'
  | 'countdown'

interface ContentBlock {
  id: string;
  type: BlockType;
  order: number;
  visible: boolean;
  config: Record<string, unknown>;
  theme?: Partial<BlockTheme>;
}
```

### 5.3 Page Schema (persistido no Supabase)
```typescript
interface DepartmentPage {
  id: string;
  department_id: string;
  slug: string;
  title: string;
  template: string;
  blocks: ContentBlock[];
  theme: PageTheme;
  meta: PageMeta;
  published: boolean;
  created_at: string;
  updated_at: string;
}

interface PageTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  darkMode: boolean;
}
```

---

## 6. Especificação de Animações e Transições

### 6.1 Transição Home → Portal App Mode
- **Tipo:** Zoom progressivo + slide horizontal
- **Duração:** 600ms
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (spring)
- **Sequência:**
  1. Phone mockup → escala 1 → 1.15 (150ms)
  2. Background → fade para preto (200ms)
  3. Interface app → slide from bottom (300ms, delay 200ms)
  4. Grid tiles → stagger fade in (50ms por tile)

### 6.2 Transição Portal → Mini-site Depto
- **Tipo:** Morphing do tile → tela cheia
- **Duração:** 500ms
- **Sequência:**
  1. Tile clicado → scale 1.1 (100ms)
  2. Overlay cor do depto → expand from tile (300ms)
  3. Conteúdo do depto → fade in (200ms, delay 250ms)

### 6.3 Navegação Interna de Mini-site
- **Tipo:** Slide horizontal entre seções
- **Duração:** 400ms
- **Easing:** spring(1, 100, 10, 0)

---

## 7. Stack Técnica

| Tecnologia | Uso | Versão |
|-----------|-----|--------|
| Next.js | Framework | 15.x |
| React Router | SPA routing | 7.x |
| Motion (Framer) | Animações | 12.x |
| Supabase | Banco + Auth | 2.x |
| React Query | Cache/fetch | 5.x |
| Radix UI | Componentes UI | varies |
| Lucide React | Ícones | varies |
| Tailwind CSS | Estilos | 4.x |

---

## 8. Schema Supabase (tabelas novas)

```sql
-- Departamentos com configuração de mini-site
CREATE TABLE department_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  cover_url TEXT,
  theme JSONB DEFAULT '{}',
  blocks JSONB DEFAULT '[]',
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Conteúdo por seção (notícias, eventos, galeria, equipe)
CREATE TABLE department_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'news' | 'event' | 'photo' | 'team_member' | 'testimony'
  title TEXT,
  body TEXT,
  media_url TEXT,
  meta JSONB DEFAULT '{}',
  published BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Formulários de contato/inscrição dos departamentos
CREATE TABLE department_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 9. Fluxos de Usuário

### 9.1 Visitante → App Experience
```
HomePage
  └─ clica no smartphone
      └─ transição zoom
          └─ PortalExperience (app shell)
              ├─ AppModeHome (grid de tiles)
              │   ├─ clica em módulo (Igreja, Eventos, Rádio...)
              │   │   └─ abre seção interna
              │   └─ clica em departamento (CIBE, Jovens...)
              │       └─ transição morphing
              │           └─ DepartmentMiniSite
              │               ├─ Hero
              │               ├─ Agenda
              │               ├─ Notícias
              │               ├─ Galeria
              │               └─ Contato
              └─ botão voltar → retorna ao grid
```

### 9.2 Admin → CMS Builder
```
/app-ui/cms
  └─ seleciona departamento
      └─ CMSDepartmentEdit
          ├─ aba Aparência (tema, cores, logo)
          ├─ aba Conteúdo (blocos drag-and-drop)
          │   └─ CMSPageBuilder
          │       ├─ painel esquerdo: biblioteca de blocos
          │       ├─ centro: canvas de preview
          │       └─ direito: propriedades do bloco selecionado
          └─ aba Publicação (preview, publish)
```

---

## 10. Arquivos do Módulo

```
src/
  components/public/portal/
    PortalExperience.tsx       # shell principal do portal app-mode
    AppModeHome.tsx            # grid de tiles com todos os módulos
    AppModeNav.tsx             # barra de navegação inferior (estilo app)
    DepartmentMiniSite.tsx     # renderizador genérico de mini-site
    DeptHero.tsx               # componente hero polimórfico
    DeptBlockRenderer.tsx      # renderizador de blocos CMS
    departments/
      DeptCIBE.tsx
      DeptJovens.tsx
      DeptVaraos.tsx
      DeptEBD.tsx
      DeptInfantil.tsx
      DeptMissoes.tsx
      DeptLouvor.tsx
      DeptFamilia.tsx
      DeptCasais.tsx
      DeptAdolescentes.tsx

  app-ui/cms/
    CMSDashboard.tsx           # dashboard do CMS
    CMSDepartmentList.tsx      # lista de departamentos
    CMSDepartmentEdit.tsx      # edição de departamento
    CMSPageBuilder.tsx         # construtor visual
    CMSBlockLibrary.tsx        # biblioteca de blocos
    CMSTemplates.tsx           # templates prontos
    CMSMediaLibrary.tsx        # biblioteca de mídia
    blocks/
      HeroEditor.tsx
      TextEditor.tsx
      GalleryEditor.tsx
      CardsEditor.tsx
      EventsEditor.tsx
      TeamEditor.tsx
      FormEditor.tsx
```

---

## 11. Critérios de Aceite

- [ ] Transição home → portal em ≤ 600ms, 60fps
- [ ] Todos os 10 departamentos com mini-site próprio
- [ ] CMS permite adicionar/remover/reordenar blocos sem código
- [ ] Preview em tempo real no page builder
- [ ] Cada departamento com paleta de cores independente
- [ ] Responsivo mobile-first
- [ ] Sem reload de página em nenhuma navegação
- [ ] Animações respeitam `prefers-reduced-motion`
