# Index de Documentação — SaasChurch

Bem-vindo ao centro de documentação unificado do **SaasChurch**. Este repositório de conhecimento organiza e categoriza todas as especificações técnicas, modelos de dados e arquitetura do sistema.

---

## 🗂️ Estrutura de Pastas e Links Diretos

### 📊 Modelos de Dados e Banco de Dados (`docs/database/`)
* [Referência de Tabelas do App Móvel](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/database/APP_TABELAS_APP.md) — Dicionário de dados, mapeamento de tabelas Supabase e filtros para integração com Flutter.
* [Tabelas de Referência Eclesiástica](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/database/APP_TABELAS_REFERENCIA.md) — Mapeamento e consultas para cadastros de congregações, contatos e calendários anuais.

### 📐 Arquitetura de Software e Especificações (`docs/architecture/`)
* [Arquitetura de Eventos e Venda de Ingressos](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/architecture/EVENTOS_ARQUITETURA_COMPRA.md) — Documentação completa da lógica de venda de ingressos, concorrência de assentos e fluxo de check-in via QR Code.
* [Especificações de Compra e Transições](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/architecture/SPEC_DETALHE_COMPRA.md) — Requisitos e diagramas detalhados das transições de estados durante o processo de compra de ingressos.
* [MCP SPEC — Portal e CMS de Departamentos](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/architecture/MCP_SPEC.md) — Padrão MCP (Módulo-Componente-Página) do frontend Next.js, arquitetura do mini-site e banco de dados do CMS.
* [Documentação Completa do App Flutter](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/architecture/NOVO_CHURCH_APP_DOCUMENTACAO_COMPLETA.md) — Visão geral da integração de dados do aplicativo móvel com o painel administrativo MRM.

### 🧩 Especificações de Módulos Core (`docs/modules/`)
* [Gestão EBD (Escola Bíblica Dominical)](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/ebd.md) — PRD detalhado cobrando cadastros, estoques, separação, entregas e integração de débitos financeiros da EBD.
* [Módulo Financeiro e Tesouraria](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/financeiro.md) — Engenharia reversa completa do Livro Caixa, status de caixas mensais, relatórios analíticos e dashboards.
* [Módulo de Secretaria Eclesiástica](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/secretaria.md) — Documentação da gestão de membros, pipeline Kanban de processos, matriz de decisões e emissão de credenciais.
* [Quero ser Membro — adesão e ficha](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/quero-ser-membro.md) — Fluxo público de adesão (dados básicos × ficha completa), roteamento do pedido para a igreja sede do campo, avaliação da Secretaria e a matriz CAD que transforma o candidato em membro com ROL.
* [Campanhas da Secretaria](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/campanhas-secretaria.md) — Formulários dinâmicos enviados aos membros, seletor de campos do cadastro em chips e a aprovação que grava no cadastro.
* [Atendimento Pastoral](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/pastoral.md) — Portal público de solicitações, Kanban pastoral, notificações por WhatsApp e timeline pública.
* [Integração de Pagamentos com Stripe](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/strip.md) — PRD para doações recorrentes, assinaturas, fluxos de compras no app e webhooks do Stripe.
* [Listas Auxiliares (Lookups) — CRUD Genérico](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/configuracoes-listas.md) — Manutenção das listas que alimentam dropdowns (plano de contas, formas de pagamento, tipos de documento, centros de custo, funções, títulos) e como registrar uma lista nova.
* [GF (Grupos Familiares)](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/gf-grupos-familiares.md) — Cadastro com CEP/mapa, anexação de membros e de contatos importados com trava de um GF por pessoa, tags no perfil, aviso ao líder por WhatsApp com síntese da IA e link público, e parecer de consolidação em PDF.
* [Gestão de Culto — PRD](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/gestao-culto/PRD.md) — Fechamento pós-culto: o tesoureiro lança dízimos e ofertas, a secretaria lança a contagem de presença, cada um sem ver o bloco do outro; o dirigente aprova, o dirigente da hospedeira aprova as filhas e o resumo verde/vermelho sobe até o Pastor Presidente.
* [Gestão de Culto — SPEC](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/gestao-culto/SPEC.md) — Tabelas `culto_posicoes`/`culto_registros`/`culto_lancamentos`/`culto_aprovacoes`, máquina de estados, matriz de visibilidade e as decisões medidas no banco (D1 a D6).
* [Home Pública Configurável — PRD](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/home-publica/PRD.md) — A home ("REINAR") deixa de ser de uma igreja só: logo, favicon, título da aba, textos, cores e os ícones passam a ser configuráveis por igreja, e endereço/cultos/redes continuam vindo de Informações da Igreja.
* [Home Pública Configurável — SPEC](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/home-publica/SPEC.md) — Tabelas `home_configs`/`home_cards`, apelidos `sede:` para não duplicar redes sociais, cartões travados, semeadura com dado real e o manifesto do PWA gerado por rota.

### 💬 Comunicação e WhatsApp (`docs/whatsapp-system/`)
* [Sistema WhatsApp do SaaS Church](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/whatsapp-system/README.md) — Documentação consolidada da integração Z-API, endpoints, banco de dados, fluxos, regras críticas e resumo para outra IA.

### 📂 Arquivos Pendentes de Revisão (`docs/_pendente-revisao/`)
* [Cópia do Arquivo de Arquitetura de Compra](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/_pendente-revisao/EVENTOS_ARQUITETURA_COMPRA%20copy.md) — Cópia redundante arquivada para evitar perda de rascunhos.

---

## 📈 Guias Gerais Relacionados
* [PROJECT_OVERVIEW.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/PROJECT_OVERVIEW.md) — Visão geral técnica do ecossistema SaasChurch Next.js.
* [ORGANIZATION_REPORT.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/ORGANIZATION_REPORT.md) — Relatório detalhado das movimentações e categorização da documentação.
