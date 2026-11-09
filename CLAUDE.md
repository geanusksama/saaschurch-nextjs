@AGENTS.md

## PREMISSA — sistema em produção: nunca alterar a lógica de funcionamento

Decidida pelo dono em 02/11/2026. Este sistema está em produção em várias
igrejas. Em pedidos de visual, layout ou estilo, **nunca** altere regra de
negócio, função, hook, estado, validação, cálculo, rota, API, chamada ao
backend, banco, autenticação, permissão, nome de campo, id/name, prop, evento
ou fluxo existente. Mude só a aparência (classes, CSS, markup de layout). Se
uma mudança visual exigir mexer na lógica, não faça: mantenha como está e
avise o dono. Guia visual em vigor:
[docs/architecture/GUIA-ESTILO-SILAS.md](docs/architecture/GUIA-ESTILO-SILAS.md).

## REGRA ACIMA DE TODAS — fato, nunca suposição

Vale para qualquer atividade neste repositório, antes de qualquer outra
instrução: **nada é afirmado sem ter sido verificado.**

- Não diga que algo funciona sem ter rodado. "Deve funcionar", "provavelmente",
  "imagino que" não são respostas — vá olhar.
- Não descreva comportamento de código que você não leu. Abra o arquivo.
- Não suponha que uma coluna, tabela, rota, permissão ou componente existe (nem
  como se chama, nem o que guarda). Consulte o schema, o banco, a rota.
- Antes de reaproveitar um padrão ("a tela X já faz assim"), leia a tela X.
- Antes de dizer "está pronto", rode o typecheck, o lint e o E2E de escrita.
  GET 200 e typecheck não cobrem gravação.
- Quando a verificação não for possível, diga exatamente isso — "não consegui
  verificar" — em vez de preencher a lacuna com hipótese.

Um palpite apresentado como fato custa mais caro que uma pergunta: aqui um
código só roda contra um banco por igreja, e o erro sai multiplicado por todas
elas no mesmo `git push`.

## Hospedagem por igreja (desde 27/10/2026)

- **Campinas**: Vercel + Supabase Cloud. Não mexer.
- **AD Vila Solange e todo campo novo**: Coolify na VPS "Uso geral"
  (179.198.117.28) — app + Supabase self-hosted. Nunca no 212.85.0.189 (SLS CRM).
- Progresso e decisões da migração da Vila Solange:
  [docs/infra/MIGRACAO-VILASOLANGE-COOLIFY.md](docs/infra/MIGRACAO-VILASOLANGE-COOLIFY.md).
- Correção de títulos eclesiásticos e da matriz de Campinas (01/11/2026) e
  a regra "a matriz nunca rebaixa obreiro":
  [docs/database/CORRECAO-TITULOS-CAMPINAS-2026-11.md](docs/database/CORRECAO-TITULOS-CAMPINAS-2026-11.md).
- Módulo Conamad (anuidades e inadimplência dos ministros, 09/11/2026):
  [docs/modules/conamad.md](docs/modules/conamad.md).
