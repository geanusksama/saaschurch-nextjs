# Relatório de Organização da Documentação — SaasChurch

Este documento relata formalmente a reorganização dos arquivos documentais (.md) realizada no diretório `saaschurch-nextjs` conforme solicitado nas especificações do arquivo `ajustar.md`.

---

## 📅 Resumo das Movimentações de Arquivos

Criamos uma pasta dedicada chamada `docs/` dividida em subpastas lógicas para separar as preocupações do projeto. Os arquivos originais espalhados na raiz do projeto foram movidos da seguinte forma:

| Arquivo Original | Nova Localização | Categoria / Racional |
| :--- | :--- | :--- |
| `APP_TABELAS_APP.md` | [docs/database/APP_TABELAS_APP.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/database/APP_TABELAS_APP.md) | Banco de Dados / Dicionário do Flutter |
| `APP_TABELAS_REFERENCIA.md` | [docs/database/APP_TABELAS_REFERENCIA.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/database/APP_TABELAS_REFERENCIA.md) | Banco de Dados / Tabelas Auxiliares |
| `EVENTOS_ARQUITETURA_COMPRA.md` | [docs/architecture/EVENTOS_ARQUITETURA_COMPRA.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/architecture/EVENTOS_ARQUITETURA_COMPRA.md) | Arquitetura de Software / Fluxos de Compra |
| `MCP_SPEC.md` | [docs/architecture/MCP_SPEC.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/architecture/MCP_SPEC.md) | Arquitetura de Software / Frontend & CMS |
| `NOVO_CHURCH_APP_DOCUMENTACAO_COMPLETA.md` | [docs/architecture/NOVO_CHURCH_APP_DOCUMENTACAO_COMPLETA.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/architecture/NOVO_CHURCH_APP_DOCUMENTACAO_COMPLETA.md) | Arquitetura de Software / Integração Mobile |
| `SPEC_DETALHE_COMPRA.md` | [docs/architecture/SPEC_DETALHE_COMPRA.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/architecture/SPEC_DETALHE_COMPRA.md) | Arquitetura de Software / Especificação Técnica |
| `ebd.md` | [docs/modules/ebd.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/ebd.md) | Especificação de Módulo / Escola Bíblica |
| `financeiro.md` | [docs/modules/financeiro.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/financeiro.md) | Especificação de Módulo / Tesouraria Caixa |
| `secretaria.md` | [docs/modules/secretaria.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/secretaria.md) | Especificação de Módulo / Secretaria Kanban |
| `strip.md` | [docs/modules/strip.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/modules/strip.md) | Especificação de Módulo / Integração Stripe |
| `EVENTOS_ARQUITETURA_COMPRA copy.md` | [docs/_pendente-revisao/EVENTOS_ARQUITETURA_COMPRA copy.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/docs/_pendente-revisao/EVENTOS_ARQUITETURA_COMPRA%20copy.md) | Pasta de Revisão / Arquivo Redundante |

---

## 🎯 Categorização e Racional

* **docs/database/**: Destinado a esquemas SQL, mapas conceituais do banco de dados e mapeamento de tabelas/colunas físicas. Facilita a consulta rápida do time de dados ou do desenvolvedor mobile.
* **docs/architecture/**: Destinado a documentar padrões estruturais do sistema (como o padrão MCP do Next.js), especificações técnicas complexas de fluxos concorrentes e integrações mobile robustas.
* **docs/modules/**: Destinado aos PRDs (Product Requirement Documents) e especificações funcionais das regras de negócio de cada aba ou agrupamento do sistema (Financeiro, Secretaria, EBD, Stripe).
* **docs/_pendente-revisao/**: Reservado para arquivos duplicados, rascunhos ou notas soltas que não têm um local definitivo claro, evitando a deleção de rascunhos que possam conter informações úteis (respeitando a política de não apagar dados).

---

## 🚀 Recomendações de Manutenção Futura

1. **Novos Documentos:** Toda nova especificação ou documentação técnica gerada por desenvolvedores ou IA deve ser adicionada diretamente em uma das subpastas da estrutura de `docs/` e **nunca** solta na raiz do projeto.
2. **Atualização do Index:** Sempre que um arquivo for adicionado ou movido, a tabela de conteúdos em [INDEX.md](file:///d:/projetos/FRONTBACK/saaschurch-nextjs/INDEX.md) deve ser atualizada para apontar ao novo link absoluto.
3. **Imutabilidade do Código:** Lembre-se de que a estrutura do diretório `src/` e dos arquivos de compilação/ambiente não devem sofrer alterações para que não haja impactos na build e integridade do Next.js.
