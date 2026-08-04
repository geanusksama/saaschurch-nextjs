# Distribuição inteligente — contato importado → GF mais próximo

**Onde fica:** Gestão Pastoral → aba **Distribuição**
**Código:** `src/lib/gfDistribuicaoService.ts`, `src/app-ui/pastoral/PastoralDistribuicao.tsx`
**E2E:** `npx tsx scripts/e2e-gf-distribuicao.mjs`

---

## 1. O problema

A secretaria importa uma lista, o WhatsApp conversa com essas pessoas, e no fim
alguém precisa decidir **para qual Grupo Familiar cada uma vai**. Feito no olho,
com dezenas de GFs e centenas de contatos, isso não acontece — e a pessoa que
respondeu "quero visitar" nunca chega a lugar nenhum.

O sistema já sabe onde cada GF fica (endereço + latitude/longitude, do módulo
GF). Falta descobrir onde a **pessoa** mora e medir a distância.

## 2. O caminho de uma pessoa até um GF

| # | Etapa | Como | Quando falha |
|---|-------|------|--------------|
| 1 | Achar o endereço | Colunas da planilha importada (`raw`/`variables`) | cai para o passo 1b |
| 1b | Achar o endereço na conversa | IA lê a conversa de WhatsApp e responde onde a pessoa mora; o CEP escrito por ela é capturado por regex antes, porque é prova literal | fica sem endereço, e a tela diz isso |
| 2 | Colocar no mapa | CEP no ViaCEP → endereço estruturado → Nominatim | "endereço encontrado, mas não localizado no mapa" |
| 3 | Escolher o GF | Haversine entre a pessoa e cada GF **ativo com coordenada** | "nenhum GF com coordenada cadastrada" |
| 4 | **Conectar** | clique humano na tela | — |

A etapa 1 vem antes da 1b porque endereço na planilha é **de graça**: só quem
não tem endereço no arquivo custa uma chamada de IA.

## 3. Por que a conexão não é automática

Conectar não é só gravar uma linha: a rota `POST /api/cell-groups/[id]/members`
(a mesma do botão **Anexar** da tela do GF) manda no WhatsApp do líder o
contato, o resumo da conversa e as dicas de abordagem — e a partir daí aquela
pessoa é responsabilidade dele.

Mandar isso sozinho, para o líder errado, com base num CEP que a IA leu torto,
não tem desfazer: a mensagem já saiu. Por isso **a análise só sugere**. Quem
conecta é uma pessoa, olhando o par na tela.

## 4. Quem aparece na fila

Só quem **ainda não está em GF nenhum**. E isso tem duas portas, não uma:

| Porta | Coluna/tabela | Quando acontece |
|-------|---------------|-----------------|
| Conexão feita por esta tela | `whatsapp_import_rows.cell_group_id` | clique em Conectar |
| Vínculo de membro no cadastro | `cell_group_members` ativo, via `matched_member_id` | a pessoa é membro e foi anexada pela tela do GF |

Sem a segunda, quem já tinha sido anexado por outro caminho reapareceria aqui
para ser distribuído de novo — e receberia um segundo aviso no WhatsApp de um
segundo líder. Sair do GF devolve a pessoa à fila.

## 5. A tela

```
┌──────────────────────────────────────────────────────────────┐
│  PESSOA                  [ CONECTAR ]              GF        │
│  nome, telefone            2,4 km            nome, líder,    │
│  endereço + de onde                          horário, endereço│
│  ele veio (planilha       trocar de GF                        │
│  ou conversa)                                                 │
└──────────────────────────────────────────────────────────────┘
```

- **Analisar conversas e arquivos** roda a análise de quem ainda não foi
  analisado e abre um modal com o que encontrou (quantos tinham endereço na
  planilha, quantos na conversa, quantos ficaram sem, quantos ganharam GF).
- **trocar de GF** existe porque distância em linha reta não é distância real:
  quem conhece a cidade às vezes discorda, e a decisão é dele.
- Conectar em quem já está em outro GF pede confirmação — é transferência, e o
  novo líder recebe o aviso.

**Em lote:** cada linha tem um marcador, com *Marcar todos / Desmarcar todos* e
o botão **Conectar marcados**. O lote roda **um por vez**, com contador de
andamento: cada conexão dispara um WhatsApp, e dez em paralelo é o caminho
curto para a instância ser bloqueada por flood. No lote a transferência não
abre diálogo — a linha falha e aparece no resumo do fim, para a fila não travar
esperando resposta a cada pessoa.

**Desfazer:** a aba *Já conectados* mostra quem foi conectado por esta tela com
o GF atual, e permite desconectar um a um ou em lote. Desconectar devolve a
pessoa para a fila.

## 6. Limites que valem conhecer

- **Nominatim: 1 requisição por segundo.** É a política de uso do serviço
  (gratuito, sem chave). Por isso a análise vai em lotes (20 por clique, teto de
  40) e a tela avisa quantos faltam. Analisar 2 mil contatos leva vários
  cliques — é assim de propósito, e não um bug.
- **Haversine é "de pássaro"**, mesma limitação já documentada em `lib/geo.ts`.
  Um rio ou uma rodovia no meio não entram na conta.
- **GF sem latitude/longitude não recebe ninguém.** Não é possível medir
  distância sem coordenada; ele nem aparece como candidato.
- A análise fica **gravada** em `whatsapp_import_rows` (`address_text`,
  `latitude`, `suggested_cell_group_id`, `analyzed_at`...). Reabrir a tela não
  refaz o trabalho caro; o botão só olha quem falta.

## 7. Banco

`supabase/migrations/20260803_gf_distribuicao.sql` — aditiva, só colunas novas
em `whatsapp_import_rows` mais dois índices parciais (a fila da tela e "quem
falta analisar"). Aplicada com `npx tsx scripts/apply-gf-distribuicao.mjs`.

## 8. O que o E2E cobre — e o que não cobre

Cobre a **decisão**: a leitura do endereço nas variações de nome de coluna que
aparecem nos arquivos reais, e a escolha do GF mais próximo com as armadilhas
(GF inativo colado no endereço, GF sem coordenada, GF de outra igreja, ninguém
candidato), mais a fila da tela: quem entra, quem sai depois de conectado, o
membro já anexado por outra tela que NÃO pode reaparecer, e a lista de
conectados com o GF atual.

**Não cobre**, de propósito: a leitura do endereço pela IA (custa tokens e a
resposta varia) e a geocodificação (ViaCEP e Nominatim são serviços de
terceiros — o teste passaria a depender da rede alheia). As duas moram em
funções isoladas, `enderecoDaConversa` e `geocodificar`, justamente para
poderem ser trocadas ou testadas à parte.
