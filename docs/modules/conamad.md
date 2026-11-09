# Módulo Conamad

Anuidades e inadimplência dos ministros, espelhadas do sistema da convenção
(sistema.conamad.com.br). Código em `src/lib/conamad`, `src/app/api/conamad` e
`src/app-ui/conamad`. Teste: `npx tsx scripts/e2e-conamad.mjs`.

## Regras

- **Ministro** é só Pastor, Pastora, Evangelista e Missionária (e jubilados).
- A **matrícula** do CONAMAD é diferente do **ROL** e nunca é comparada com ele.
- A chave da anuidade é o id dela no CONAMAD: a mesma matrícula repete no ano
  (cancelada + nova).
- "INAT" do CONAMAD é **DESLIGADO** no nosso sistema; títulos são escritos por
  extenso (PASTOR, EVANGELISTA...).
- `conamad_ministros.member_id` só existe com casamento exato; o critério usado
  fica em `casamento`. Sem certeza, o ministro fica "Sem ROL".
- Bloqueado por padrão: libera-se na matriz de permissões (`conamad.view`).
- O Excel é lido no navegador; o servidor recebe só as linhas.

## Carga inicial (09/11/2026, campo Campinas)

983 ministros e 5.757 anuidades de 2012 a 2026. 828 ministros ligados a um
membro: CPF confirmado, ou nome + nascimento exatos com um dos lados sem CPF. A
exceção é a matrícula 3070 (ROL 184), confirmada pelo dono com a data diferente
em um dígito. Conferido com o relatório oficial "Inadimplentes por igreja".

Gravações no cadastro, todas em `audit_logs`:

| Ação | Qtd |
|---|---:|
| `CONAMAD_SITUACAO` | 70 |
| `CONAMAD_FOTO` | 58 |
| `CONAMAD_TITULO` (PASTOR/PASTORA JUBILADA, também em `member_title_history`) | 2 |

## Limitações

- "Atualizar dados" só atualiza o que já existe: não cria ministro novo nem
  anuidade de ano novo.
- A carga inicial foi feita uma vez, fora do repositório: outras igrejas abrem
  com as telas vazias.
- Relatórios nacionais (por Estado) ficaram de fora por decisão do dono.
