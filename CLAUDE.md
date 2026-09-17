@AGENTS.md

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
