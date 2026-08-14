# Readmissão — restaurar o título eclesiástico anterior

Data: 13/08/2026 · Módulo: Secretaria › Serviços e Ocorrências (matriz de decisão)

## O problema

Ao readmitir um obreiro, ele voltava como **CONGREGADO** — como se nunca
tivesse pertencido à igreja. Dois casos reais:

| Membro | ROL | Histórico | Voltou como |
|---|---|---|---|
| ARNOBIO ARAUJO BARRETO FILHO | 9091 | Presbítero (2006), Evangelista (2007), **Pastor (2015)** | CONGREGADO |
| NOEME SANTOS NASCIMENTO BARRETO | 9092 | Diaconisa (2006), **Evangelista (2016)** | CONGREGADO |

Causa: a matriz de decisão só sabia aplicar título **fixo**. Estado das regras
na coluna "Aprovado" antes da correção:

```
READMEM col2  troca=true   fixo=MEMBRO   → quem já foi pastor virava MEMBRO
READOBR col2  troca=false  —             → título não mudava, ficava CONGREGADO
READOMN col2  troca=false  —             → idem
```

## A solução

Flag nova na regra da matriz: **`restore_previous_title`**. Com ela ligada, o
título não sai de `new_title` — sai do **último título do histórico do membro**.
`new_title` continua gravado, mas vira apenas a rede de segurança para quem não
tem histórico nenhum.

É flag na regra, não regra fixa por sigla de serviço: a igreja liga onde fizer
sentido, pela tela de edição da matriz, sem depender de deploy.

### Por que "o último" e não "o maior nível"

O último título gravado é, com certeza, o que a pessoa tinha quando saiu. Além
de dar o mesmo resultado na carreira normal (que só sobe), o critério do mais
recente **respeita sozinho a variante de gênero**: se está gravado DIACONISA,
volta DIACONISA; se está EVANGELISTA, volta EVANGELISTA. Nada é inferido a
partir do sexo do membro — o que importa porque *evangelista* serve a homens e
mulheres, mas *missionária* é só feminino.

Isso também evita depender de `allow_men`/`allow_women` do catálogo, que estão
inconsistentes na base: `MISSIONARIA` tem `allow_men = true` e `PASTOR` tem
`allow_men = false`.

## Detalhes que a implementação precisou tratar

**O histórico legado está invertido.** Em 10.419 de 11.637 registros `LEGADO`, o
campo `new_title` vale literalmente `"SIM"` e o título real está em
`previous_title`. A busca varre as **duas** colunas.

**Não há lista de valores a ignorar.** Cruzando as duas colunas com o catálogo,
fora dele aparecem só `SIM` (10.419), `NOVO` (6), `AGUARDANDO ATIVACAO` (2) e
`DEV TER` (1). O próprio catálogo é o filtro: o que não casa não é título.

**Acento e caixa são ignorados** no casamento — a base tem
`PRESBÍTERO`/`PRESBITERO` e `DIÁCONO`/`DIACONO` convivendo.

**O título atual não entra na disputa.** Seria sempre o mais recente e venceria
tudo: um readmitido ontem está CONGREGADO com data de ontem. Só o histórico
conta.

**Empate de data na mesma linha.** `CONGREGADO` e `MEMBRO` são ambos nível 0, e
uma promoção grava os dois com o mesmo `created_at` (previous=CONGREGADO,
new=MEMBRO). Dentro da mesma linha, o `new_title` vence — senão quem já é membro
voltaria como congregado.

## Rastro deixado

O registro em `member_title_history` sai com `source = "MATRIZ_RESTAURADO"` (em
vez de `MATRIZ`) e a observação diz de onde veio:
*"Título restaurado do histórico: PASTOR (registrado em 14/11/2015)"*. Numa
conferência, a secretaria consegue distinguir o que foi restaurado do que foi
escolhido na regra.

## Onde vale

A resolução do título ficou em `src/lib/tituloEclesiasticoHistorico.ts` e é
usada por todos os caminhos que aplicam a matriz:

- `src/lib/kanMatrix.ts` — mover o card de coluna (o caminho da readmissão)
- `src/app/api/kan/cards/route.ts` — criação do card. A cópia local do
  executor foi removida e passou a usar o módulo compartilhado: uma cópia a
  menos é uma chance a menos de as duas divergirem
- `src/app/api/members/[id]/occurrences/route.ts` — ocorrência rápida

## Regras ligadas

`prisma/sql/readmissao_restaura_titulo.sql` liga a flag na coluna 2 ("Aprovado")
de READMEM, READOBR e READOMN, com `CONGREGADO` de reserva.

A **coluna 3** ("Readmissão cancelada") não foi tocada: ali o processo foi
recusado, não há título a restaurar.

## Ponto de atenção não resolvido

`READMEM col3` grava **CONGREGADO fixo** quando a readmissão é cancelada. Isso
apaga o título real de quem teve o pedido recusado. Não foi alterado por não
fazer parte do que foi pedido — mas vale decidir se é o comportamento desejado.

## Verificação

Rodado contra o banco real em 13/08/2026, usando as regras de produção e o
resolvedor de produção:

```
✓ ARNOBIO  (READOBR) → PASTOR       (restaurado, registrado em 14/11/2015)
✓ NOEME    (READOBR) → EVANGELISTA
✓ só-membro(READMEM) → MEMBRO
✓ sem histórico      → CONGREGADO   (cai no fallback da regra)
✓ RECONPB no ARNOBIO → PRESBITERO   (regra sem a flag segue com título fixo)
```
