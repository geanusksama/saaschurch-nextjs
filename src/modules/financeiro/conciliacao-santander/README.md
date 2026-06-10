# Módulo de Conciliação Bancária Santander

## Visão Geral

Módulo responsável por conectar o sistema MRM Church CRM diretamente à API Santander para consulta de contas, saldos e extratos, armazenamento seguro de movimentos bancários, comparação com o Livro Caixa e transformação de movimentos em lançamentos financeiros.

Elimina o processo manual onde o responsável financeiro acessava mais de 70 contas Santander individualmente para baixar e comparar extratos.

## Status

- **Fase atual:** Fase 1 — Documentação e Modelagem
- **Versão:** 1.0.0
- **Aprovação de segurança:** pendente (em preparação para auditoria Santander)

## Estrutura do Módulo

```
conciliacao-santander/
├── README.md              ← Este arquivo
├── SPEC.md                ← Especificação funcional
├── SDD.md                 ← Design técnico e arquitetura
├── DATABASE.md            ← Modelo de dados e tabelas
├── API.md                 ← Endpoints internos do SAAS
├── SECURITY.md            ← Segurança, criptografia e auditoria
├── MCP.md                 ← Contrato para agentes MCP
├── SKILL.md               ← Skill de uso do módulo
├── ROADMAP.md             ← Roadmap por fases
├── docs/                  ← Documentos de referência
├── sql/                   ← Migrations SQL
├── dtos/                  ← Objetos de transferência de dados
├── services/
│   ├── santander/         ← Serviços da API Santander
│   └── febraban240/       ← Parser do layout FEBRABAN 240
├── repositories/          ← Acesso ao banco de dados
├── backend/               ← Lógica de negócio do backend
├── frontend/              ← Componentes React
├── jobs/                  ← Jobs de automação
└── tests/                 ← Testes unitários e integração
```

## Documentos Técnicos de Referência

| Documento | Descrição |
|-----------|-----------|
| `docs/user_guide_contas_saldo_extrato_api_v6.pdf` | API oficial Santander — Contas, Saldos e Movimentos |
| `docs/Layout_Febraban_240_Conta_Max.pdf` | Layout FEBRABAN 240 posições Santander |

## Permissões Necessárias

| Permissão | Descrição |
|-----------|-----------|
| `financeiro.santander.visualizar` | Visualizar tela e movimentos |
| `financeiro.santander.configurar` | Cadastrar e editar credenciais |
| `financeiro.santander.consultar` | Consultar API Santander |
| `financeiro.santander.importar` | Importar movimentos |
| `financeiro.santander.conciliar` | Conciliar movimentos |
| `financeiro.santander.lancar_livro_caixa` | Inserir no Livro Caixa |
| `financeiro.santander.ignorar` | Ignorar movimentos |
| `financeiro.santander.exportar` | Exportar relatórios |
| `financeiro.santander.auditoria` | Acessar logs de auditoria |

## Integração com Módulos Existentes

- **Livro Caixa:** nova aba `Banco / Santander` — sem quebrar fluxo existente
- **Autenticação:** usa `withAuth()` do sistema atual
- **Permissões:** estende `permissionCatalog.ts` existente
- **Prisma:** novas tabelas sem alterar modelos existentes

## Contato

Sistema: MRM Church CRM  
Módulo: Conciliação Bancária Santander  
Sujeito a auditoria pelo Banco Santander
