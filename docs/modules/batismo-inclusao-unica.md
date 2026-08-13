# Batismo — inclusão única e reinício

Data: 13/08/2026 · Módulo: Secretaria › Batismo

## O problema

A inclusão no batismo (`POST /api/baptism/requests`) criava um card no Kanban
**sem verificar** se o membro já estava no fluxo. Resultado: a mesma pessoa
entrava várias vezes na fila de batizandos.

## A regra

Batismo em águas acontece **uma vez por pessoa**. Um membro entra no fluxo uma
vez só — nunca dois cards para o mesmo ROL.

Quando o batismo não se concretiza (a pessoa perde a data, o card fica
pendente), o certo não é criar um registro novo: é **reiniciar** o que existe.

### Bloqueio

`POST /api/baptism/requests` devolve **409** com `duplicado: true` e os dados do
card existente (situação, data de inclusão, protocolo) quando o membro já está
no fluxo.

**Card cancelado ou reprovado não bloqueia** — aquele processo foi encerrado e a
pessoa pode ser incluída normalmente. A lista está em `STATUS_QUE_NAO_BLOQUEIAM`.

Verificado contra os dados reais:

| Caso | Resultado |
|---|---|
| membro com card `concluido` | bloqueado |
| membro só com `cancelado`/`reprovado` | liberado |
| membro sem card nenhum | liberado |

### Reinício

A tela responde ao 409 com um aviso e o botão **"Reiniciar batismo"**, que envia
`reiniciar: true` para a mesma rota. O reinício:

- **reaproveita o card existente** — não cria outro, o histórico do membro é um só;
- devolve para a primeira coluna, com status `pendente`;
- pega a **data de batismo vigente da igreja** (`baptism_schedules` ativo mais
  recente) ou a data informada;
- **renova a `created_at`** do card — é isso que o faz reaparecer na lista dos
  próximos batizandos, que é ordenada por inclusão;
- conta os reinícios em `metadata.reinicios`, com quem e quando;
- grava a ocorrência **"Batismo reiniciado"** no histórico do membro. Reinício
  não é inclusão nova, mas sumiria da prestação de contas se não ficasse
  registrado.

## O que NÃO foi feito, e por quê

**Os duplicados que já existiam ficaram como estão.** Havia 852 membros com card
duplicado (883 cards excedentes) criados antes desta correção. Apagar registro de
batismo em massa é irreversível e alguns podem ter certificado emitido ou data
válida. Decisão do usuário: a trava vale **daqui para frente**.

**Não há constraint de unicidade no banco**, pela mesma razão — ela falharia na
criação por causa desses 852. A trava está na API. Se um dia os duplicados forem
consolidados, dá para adicionar o índice único e fechar a porta de vez.

## Arquivos

- `src/app/api/baptism/requests/route.ts` — `batismoExistente()`, bloqueio e reinício
- `src/components/app-ui/Baptism.tsx` — tratamento do 409 e diálogo de reinício
