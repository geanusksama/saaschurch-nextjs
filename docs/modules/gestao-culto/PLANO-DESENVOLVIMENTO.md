# Gestão de Culto — Plano de Desenvolvimento

Referência: [SPEC.md](SPEC.md) · [PRD.md](PRD.md)

## Etapas

| # | Etapa | Arquivos | Estado |
|---|---|---|---|
| 1 | Documentação (PRD + SPEC) | `docs/modules/gestao-culto/` | ✅ |
| 2 | Schema Prisma + migration aditiva | `prisma/schema.prisma`, `prisma/migrations/20260827120000_gestao_culto/migration.sql` | ✅ |
| 3 | Camada de escopo e regras | `src/lib/cultoScope.ts`, `src/lib/cultoService.ts`, `src/lib/cultoResumo.ts` | ✅ |
| 4 | API | `src/app/api/culto/**` | ✅ |
| 5 | Telas (Hospedeiro, Gestão, Lançamentos, Posições, organograma com zoom, modal de resumo) | `src/app-ui/culto/**` | ✅ |
| 6 | Registro de rota, sidebar e permissões | `src/spa/routes.tsx`, `src/components/app-ui/AppUI.tsx`, `src/app-ui/system/permissionCatalog.ts` | ✅ |
| 7 | Seed de teste (hospedeiras + posições + cultos) | `prisma/seed-culto.js` | ✅ |
| 7b | Teste ponta a ponta sobre o código de produção | `scripts/e2e-gestao-culto.mjs` | ✅ 55/55 |
| 8 | Relatórios e PDF | — | próxima entrega |

## Ordem de execução em produção

```bash
npx prisma migrate deploy            # cria as 4 tabelas (só CREATE TABLE)
npx prisma generate                  # atualiza o client
npx tsx scripts/e2e-gestao-culto.mjs # valida isolamento e máquina de estados
node prisma/seed-culto.js            # opcional: cenário de teste
```

O e2e cria as próprias igrejas e usuários com prefixo `[E2E-CULTO]` e apaga
tudo no fim (`--keep` preserva). Ele importa `cultoScope.ts` e `cultoService.ts`
de verdade — testa a regra de produção, não uma cópia dela.

## Estado aplicado em 27/08/2026

| Item | Resultado |
|---|---|
| Migration | aplicada (`20260827120000_gestao_culto`) |
| e2e | 55 asserções, 0 falhas |
| Seed no campo Campinas | 13 hospedeiras (6 novas), 60 anexas, 141 posições, 340 registros |
| Status povoados pelo seed | ABERTO 142 · AGUARDANDO_LOCAL 107 · APROVADO_LOCAL 45 · CONCLUIDO 40 · REJEITADO 6 |
| Painel no período padrão (7 dias) | 18 grupos · 116 igrejas · 11 verdes · 105 vermelhas |
| Rotas no dev server | `/app-ui/culto`, `/app-ui/culto/gestao`, `/app-ui/culto/posicoes` → 200; as rotas de API sem token → 401 |
| Erros novos de tipo/lint | 0 |

## Riscos e como foram tratados

| Risco | Tratamento |
|---|---|
| Quebrar isolamento e um tesoureiro ver o bloco do outro | poda dos blocos no servidor (`cultoScope.blocosVisiveis`), não no front |
| Igreja sem hospedeira ficar invisível para o presidente | fallback por Regional (D3) — hoje isso é 122 das 126 igrejas |
| Igreja sem os três lançadores nunca fechar o culto | obrigatoriedade derivada das posições ativas (D2) |
| Duplicar receita já lançada no Livro Caixa | módulo não escreve em `livro_caixa` (D4) |
| Consulta em laço matar a performance | `blocosExigidosPorIgreja` em lote — o laço custava 65 s contra 0,9 s (SPEC 7.1) |
| Verde/vermelho virarem preto | paleta em hex (`cultoCores.ts`) escapa da camada de tema do globals.css (SPEC 6.3.1) |
| Lançador ver tela de gestão | `modosPermitidos()` — tesoureiro e secretário caem só no formulário (SPEC 6.0.1) |
| Resumo consolidado vazar bloco de outro lançador | `montarResumo` filtra por `blocosVisiveis` ANTES de somar; o e2e prova que o tesoureiro recebe `presenca: null` |
| Igreja contada duas vezes no total do campo | grupo REGIONAL só junta igrejas soltas; o e2e verifica que a soma dos filhos bate com o total do pai |
| Painel virar um mar de vermelho e não informar nada | período padrão de 7 dias + contagem `x/y cultos` por igreja (seção 6.4 da SPEC) |
| Seed dar a falsa impressão de que o fluxo funciona | o cenário varia por igreja E por domingo; um contador único fazia todas as igrejas terem o mesmo status na mesma data |
| Migration travar tabela grande | migration só cria tabelas novas, não toca em `livro_caixa` (331 mil linhas) |
