# Correção de títulos eclesiásticos e da matriz — Campinas (01/11/2026)

Feito a pedido e com aprovação do dono, item por item. Banco: Supabase de
Campinas (`ysibqnwgitakofehdxvd`). Nenhum outro banco foi tocado.

## Problema

Havia perfis com título abaixo do histórico. Exemplos: GERSO PINHEIRO (ROL 60)
estava como DIACONO, mas foi consagrado evangelista em 2009; ILIS ANTONIO AMARO
DOS SANTOS (ROL 32569) foi cadastrado como EVANGELISTA, e as regras "Novo
Cadastro" e "Admissão de Obreiros" da matriz o rebaixaram para CONGREGADO e
depois MEMBRO.

Sequência usada:

- homem: COOPERADOR → DIACONO → PRESBITERO → EVANGELISTA → PASTOR
- mulher: COOPERADORA → DIACONISA → EVANGELISTA → MISSIONARIA → PASTORA

PASTOR PRESIDENTE não é alterado.

## Dados corrigidos

| Passo | Fonte do título | Membros | `source` em `member_title_history` |
|---|---|---|---|
| 1 | maior consagração nas ocorrências | 380 | `CORRECAO_HISTORICO` |
| 2 | sexo errado no cadastro (sexo e título corrigidos) | 5 | `CORRECAO_HISTORICO_SEXO` |
| 3 | maior título no histórico de títulos | 97 (+ 6 casos decididos um a um) | `CORRECAO_HISTORICO_TITULOS` |

Cada troca tem uma linha de histórico com o título anterior em
`previous_title`; é por ela que uma troca pode ser desfeita.

Ao fim, as duas varreduras (ocorrências e histórico de títulos) deram 0 membros
rebaixados.

**Atenção:** 236 membros de Campinas têm `members.campo_id` vazio. O campo
deles vem de `church → regionais.campo_id`. Qualquer varredura por campo
precisa olhar os dois.

Cadastros de teste apagados (com as ocorrências, os eventos e os cartões
deles): FULANO LOPES, FULANO DE TAL, Test Member Print, campo lima, GENERICO DA
SILVA, novo1, teste2 hhjhkhk e Joana Candidata E2E (×4). Empresas (PJ) não
foram apagadas.

## Matriz (`kan_matrix_rules`)

- Consagração a Missionária, a Missionário e a Pastora, coluna 4: davam
  DIACONO; agora dão MISSIONARIA, MISSIONARIO e PASTORA.
- Exclusão de Membros: gravava "AGUARDANDO ATIVACAO" como título; agora não
  mexe no título.
- Coluna 5 (Consagração Cancelada) das 8 consagrações: não mexe mais no título.
- Separação a Cooperadora: a coluna 4 dá COOPERADORA, e a regra da coluna 5 foi
  criada.
- Reconhecimento Missionária dá MISSIONARIA; Reconhecimento Pastor grava
  "PASTOR" em maiúsculas.
- Descredenciamento (Evangelista M/F e Pastor): "Finalizado" deixa o membro
  DESLIGADO sem mexer no título; "Cancelado" não faz nada.

## Código: a matriz nunca rebaixa um obreiro

`tituloFixoRebaixaria()` em `src/lib/tituloEclesiasticoHistorico.ts`: o título
fixo de uma regra é ignorado quando o membro já tem título de obreiro (nível
>= 1 no catálogo) maior que o da regra. Mesmo nível passa, então o batismo
continua levando o CONGREGADO a MEMBRO. A restauração do histórico e o título
confirmado na readmissão não passam por essa trava.

A trava é aplicada em `resolverTituloDaRegra` (kanMatrix e ocorrência rápida)
e nas rotas que aplicavam `rule.newTitle` direto: transferência, batismo,
consagração e apply-matrix.

Testada contra o banco, só com leitura:

- EVANGELISTA → CONGREGADO/MEMBRO: bloqueia.
- EVANGELISTA → PASTOR/MISSIONARIA: aplica.
- CONGREGADO → MEMBRO e MEMBRO → CONGREGADO: aplica.
- PASTOR PRESIDENTE → PASTOR: bloqueia.
