# Gestão de Culto — PRD

Status: aprovado para implementação · Data: 27/08/2026
Origem: pedido do dia 27/08/2026 + diagrama de hierarquia de visão (imagem 2 da conversa).

---

## 1. O problema

Hoje o dinheiro do culto entra no **Livro Caixa** (`livro_caixa`, 4.340 lançamentos
em 82 igrejas nos últimos 60 dias) e a presença entra por **reconhecimento facial /
ticket** (`church_presence_tickets`, 3 registros no total). São dois fluxos
contábeis/operacionais, não um **fechamento do culto**.

Falta um controle **pós-culto**: no fim de cada culto, cada igreja precisa fechar
um pacote de números — o que entrou de dízimo e oferta, e quem esteve presente —
e esse pacote precisa ser **conferido e aprovado pelo dirigente** antes de subir
na hierarquia até o Pastor Presidente do campo.

O que não existe hoje e é o coração do pedido:

- **Não existe aprovação.** Quem lança, lança e pronto. Ninguém confere.
- **Não existe a figura do dirigente no sistema.** Medido em 27/08/2026:
  `churches.lead_pastor_id` está preenchido em **0 das 126 igrejas**.
  `current_leader_name` é texto livre em 85 delas — serve para imprimir, não
  para dar acesso nem para cobrar alguém.
- **Não existe visão de rede.** O presidente não tem uma tela que responda
  "quais igrejas fecharam o culto de domingo e quais ainda não".

## 2. Quem usa

Todos são **usuários que já existem** no sistema (`users`). Nenhum perfil novo é
criado — ver decisão D1 na SPEC.

| Papel | Quem é | O que faz | O que vê |
|---|---|---|---|
| **Tesoureiro** | usuário com a role `tesoureiro` (100 usuários hoje), anexado à posição `FINANCEIRO` | lança total e quantidade de dízimos e ofertas do culto | só o **próprio bloco**, só da **própria igreja** |
| **Secretário / contador de presença** | usuário anexado à posição `PRESENCA` (normalmente role `secretario`, 74 usuários) | lança homens, mulheres, jovens, adolescentes, crianças, visitantes, conversões, reconciliações, famílias e cadeiras vazias | só o **próprio bloco**, só da **própria igreja** |
| **Outro responsável** | qualquer usuário anexado à posição `EXTRA` | lança a observação/anexo complementar | só o **próprio bloco** |
| **Dirigente da igreja** | usuário anexado à posição `APROVADOR_LOCAL` da igreja. Pode haver **mais de um** (suplente do mesmo nível) | vê os blocos dos três acima juntos e **aprova ou devolve** | tudo da **própria igreja** |
| **Dirigente da hospedeira** | usuário anexado à posição `APROVADOR_HOSPEDEIRA` na igreja hospedeira | vê o quadro verde/vermelho de todas as filhas e **aprova ou devolve** cada uma; cobra quem está atrasado | a **própria igreja + todas as filhas** |
| **Pastor Presidente** | usuário anexado à posição `PRESIDENTE` do campo (perfil `master` ou `campo`) | só olha | **todo o campo**, agregado por hospedeira |

> Regra de ouro do isolamento, tirada da imagem: *"o tesoureiro que está do lado
> não vê, nem o secretário vê"*. Um lançador **nunca** vê o bloco do outro. Só
> quem aprova vê o conjunto.

## 3. O fluxo

```
  ┌──────────────────────────────────────────────────────────────┐
  │  1. ABERTO ("incluindo")                                     │
  │     tesoureiro envia FINANCEIRO   ─┐                         │
  │     secretário envia PRESENCA      ├─ cada um só o seu       │
  │     extra envia EXTRA (opcional)  ─┘                         │
  └──────────────────────────────────────────────────────────────┘
                    │ todos os blocos exigidos enviados
                    ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  2. AGUARDANDO_LOCAL                                         │
  │     dirigente da igreja vê os 3 blocos juntos                │
  │     → APROVA  ou  → DEVOLVE (volta para ABERTO com motivo)   │
  └──────────────────────────────────────────────────────────────┘
                    │ aprovado
                    ▼
     tem hospedeira? ──não──► 5. CONCLUIDO (verde)
                    │ sim
                    ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  3./4. APROVADO_LOCAL → dirigente da hospedeira confere      │
  │     → APROVA → CONCLUIDO   ou   → DEVOLVE                    │
  └──────────────────────────────────────────────────────────────┘
```

Semântica de cor, exatamente como no diagrama: **verde = CONCLUIDO**, qualquer
outro estado é **vermelho** (pendente) para quem está acima.

## 4. Requisitos funcionais

| # | Requisito | Aceite |
|---|---|---|
| RF-01 | Cadastrar posições anexando usuários existentes (busca por nome/e-mail) a uma igreja e a um papel | tela Posições permite anexar, desativar e trocar; um usuário pode ocupar mais de um papel |
| RF-02 | Abrir um registro de culto por igreja + data + tipo de culto | não permite dois registros da mesma igreja, data e tipo |
| RF-03 | Tesoureiro envia bloco FINANCEIRO | total dízimos, total ofertas, qtd dízimos, qtd ofertas |
| RF-04 | Secretário envia bloco PRESENCA | homens, mulheres, jovens, adolescentes, crianças, visitantes, conversões, reconciliações, famílias, cadeiras vazias |
| RF-05 | Extra envia bloco EXTRA | texto + anexo opcional |
| RF-06 | Lançador não enxerga bloco de outro lançador | GET do registro devolve apenas os blocos que o usuário pode ver |
| RF-07 | Registro só vai a aprovação quando **todos** os blocos exigidos chegarem | "exigido" = existe posição ativa daquele papel naquela igreja |
| RF-08 | Dirigente local aprova ou devolve com motivo | devolução destrava a edição dos blocos |
| RF-09 | Dirigente da hospedeira aprova ou devolve cada filha | igreja sem hospedeira pula esse nível |
| RF-10 | Presidente vê um card por hospedeira com total, concluídas e faltantes (com nome das igrejas e dos dirigentes) | igual ao card da imagem 2 |
| RF-11 | Tela em **Kanban** e em **Tabela aninhada** pelos níveis | alternância na mesma tela |
| RF-12 | Consulta por **intervalo de datas** | filtro "de/até" aplicado em Kanban, tabela e painel |
| RF-13 | Cobrar quem está atrasado | ação "cobrar" no card vermelho, a partir do nível de quem aprova |

## 5. Fora de escopo desta entrega

- Reconciliação automática entre o bloco FINANCEIRO e o `livro_caixa`. O
  fechamento do culto é um controle gerencial próprio; a contabilidade continua
  no Livro Caixa, intocada.
- Relatórios impressos/PDF e dashboards analíticos — vêm na etapa seguinte,
  conforme combinado ("depois vamos criar os relatórios").
- Criação de perfil novo de acesso (`profile_type`). Ver D1 na SPEC.
