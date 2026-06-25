# SaasChurch Next.js — Project Overview

O **SaasChurch** é uma plataforma SaaS multitenant para gestão eclesiástica completa. Ela atende a redes de igrejas locais, integrando o painel de gestão administrativa web (MRM), o portal público institucional com CMS de departamentos, e o aplicativo móvel dos membros (novoChurch).

---

## 🛠️ Stack Tecnológica

O projeto foi construído utilizando tecnologias modernas e eficientes no ecossistema web:

* **Core**: Next.js 15 (React 19) rodando em ambiente Node.js.
* **Estilização**: Tailwind CSS v4 para estilização altamente customizável e responsiva.
* **Lógica e Roteamento**: React Router v7 para controle fino de rotas SPA no painel.
* **Banco de Dados**: PostgreSQL executado no **Supabase** (integrando Auth, Storage e Realtime).
* **Camada ORM**: Prisma ORM para mapeamentos de tabelas e queries relacionais no backend.
* **Gerenciamento de Estado**: Zustand para estados locais no frontend e TanStack Query v5 para sincronização e cache de requisições de API.
* **Animações**: Framer Motion v12 para micro-animações premium e transições fluidas no portal.

---

## 🏗️ Estrutura de Diretórios do Projeto

O código do projeto segue uma organização modularizada (Padrão MCP):

```
saaschurch-nextjs/
├── docs/                      # Central de documentação e PRDs
│   ├── architecture/          # Desenho do sistema, RLS e fluxos
│   ├── database/              # Dicionários de dados e esquemas SQL
│   ├── modules/               # Regras e requisitos por módulo (EBD, Stripe, etc)
│   └── _pendente-revisao/     # Rascunhos e backups arquivados
├── prisma/                    # Esquema Prisma e migrações do banco
├── public/                    # Assets estáticos (logos, imagens, ícones)
├── src/
│   ├── app-ui/                # Módulos administrativos (livro caixa, secretaria)
│   ├── components/            # Componentes de apresentação reutilizáveis
│   │   ├── app-ui/            # Componentes exclusivos da área administrativa
│   │   └── public/            # Componentes visíveis no portal público
│   ├── spa/                   # Roteador SPA React Router e páginas
│   └── lib/                   # Clientes SDK (Supabase, helpers de contexto)
├── package.json               # Gerenciador de dependências npm
└── tsconfig.json              # Configurações do compilador TypeScript
```

---

## 🛡️ Regras de Isolamento Multi-Tenant

A segurança e o isolamento de dados são cruciais no SaasChurch. O sistema adota uma hierarquia geográfica estrita:

```
Fields (Campos/Convenção)
  └─ Regionais (Sub-regiões)
       └─ Headquarters (Sedes administrativamente independentes)
            └─ Churches (Igrejas locais)
```

### Regras de Ouro
1. **Filtro por Contexto:** Toda consulta à base de dados no escopo de igrejas deve ser obrigatoriamente filtrada por `church_id` obtido a partir dos metadados do token JWT do usuário logado.
2. **Perfis de Acesso (`profileType`):**
   * `master`: Acesso irrestrito a todos os campos e igrejas.
   * `admin`: Acesso completo ao campo administrativo (`headquarters_id`).
   * `campo`: Restrito ao campo e às regionais pertencentes.
   * `church`: Restrito à igreja local específica do usuário.

---

## 🔌 Módulos Core do Sistema

1. **Secretaria Eclesiástica ([secretaria.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/secretaria.md)):**
   * CRUD completo de membros e integração com ROL.
   * Kanban de processos (Batismo, Consagração, Transferência, Credenciamento) integrado a uma **Matriz de Regras**, que atualiza automaticamente os registros no banco ao mover os cards de coluna.

2. **Módulo Financeiro ([financeiro.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/financeiro.md)):**
   * Tesouraria integrada através do Livro Caixa.
   * Validação rígida de status de caixa mensal (Aberto/Fechado).
   * Dashboards com breakdown de categorias por plano de contas e análise preditiva de dízimos/ofertas.

3. **Eventos e Ingressos ([EVENTOS_ARQUITETURA_COMPRA.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/architecture/EVENTOS_ARQUITETURA_COMPRA.md)):**
   * Cadastro de eventos livres ou com mapa interativo de assentos.
   * Reserva temporária no Supabase Realtime (TTL de 5 minutos).
   * Check-in de segurança por QR Code.

4. **Gestão EBD ([ebd.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/ebd.md)):**
   * Controle trimestral de currículos e distribuição de revistas eclesiásticas.
   * Lógica de estoque (entradas/saídas) integrado a geração de débitos nas contas das igrejas destinatárias.

5. **Portal Público Imersivo & CMS ([MCP_SPEC.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/architecture/MCP_SPEC.md)):**
   * Shell interativo que replica a experiência mobile no navegador.
   * CMS visual para páginas de departamentos com templates e paletas customizadas.
