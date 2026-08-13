# Contas a Pagar — Manual da Tesouraria

Guia curto de uso. Para a parte técnica, ver [SPEC.md](./SPEC.md).

---

## Antes de começar: os cadastros

Tudo o que aparece em dropdown tem cadastro em
**Configurações › Listas e Cadastros Auxiliares**. Nada é fixo no sistema —
a igreja cria, renomeia e desativa item quando quiser.

| Cadastro | Para que serve |
|---|---|
| **Bancos** | Contas bancárias e caixas: "Banco do Brasil C/C 12345", "Caixa (espécie)". Marque **um** como *Padrão* — é o que vem pré-selecionado. |
| **Departamentos** | Para onde o dinheiro vai: Missões, Campanha do Templo, Infantil, Obra. Marque um como *Padrão*. |
| **Tipos de Credor** | Pastor, obreiro, fornecedor, prestador, órgão público. |
| **Naturezas de Despesa** | Fixa, variável, eventual. |
| **Tipos de Departamento** | Ministério, campanha, setor, obra, missões. |
| **Tipos de Conta Bancária** | Corrente, poupança, espécie, aplicação. |
| **Formas de Pagamento** | PIX, dinheiro, transferência... (já existia). |

A **classificação da despesa** (luz, água, aluguel, missões) **não** tem
cadastro novo: usa o **Plano de Contas** que a igreja já mantém, em
Configurações › Plano de Contas. Nada para recadastrar.

O único cadastro realmente novo é **Credores** — antes o Livro Caixa guardava o
favorecido como texto livre, sem cadastro. Ele fica na aba **Cadastros** dentro
de Contas a Pagar, junto com atalhos para os demais.

Ordem sugerida na implantação: Bancos → Departamentos → Credores. Os cadastros
de apoio já vêm preenchidos e só precisam de ajuste se a igreja usar outros
nomes.

> **Sobre os lançamentos antigos:** os mais de 331 mil lançamentos já
> existentes no Livro Caixa ficam sem banco e sem departamento e aparecem nos
> relatórios como **"Não informado"**. Isso é proposital: preencher a mão um
> departamento que ninguém escolheu na época seria inventar informação
> contábil. Dali para frente, todo lançamento novo já nasce classificado.

---

## Lançar uma conta a pagar

**Finanças › Contas a Pagar › Nova Conta**

1. **Descrição** — o que é a despesa. Ex.: "Ajuda de custo pastoral 2026".
2. **Credor** — quem recebe. Se ainda não existir, cadastre antes.
3. **Tipo de despesa, Departamento, Banco** — é o que faz o relatório sair
   certo depois ("quanto gastamos com folha pastoral?", "quanto foi para
   Missões?").
4. **Valor total** e **1º vencimento**.
5. **Parcelada?** Marque e informe quantas parcelas. O sistema divide sozinho e
   mostra a **prévia**, com data e valor de cada parcela.
6. A prévia é **editável**: dá para ter parcelas desiguais (entrada maior,
   valores diferentes por mês) e datas fora do mensal exato. A única exigência
   é a soma fechar com o valor total — o sistema avisa se não fechar.
7. **Lançar conta**.

Uma conta à vista é só uma conta com 1 parcela — o sistema trata igual.

---

## Pagar (inclusive pagando só uma parte)

Na aba **Lançamentos**, visão **Por parcela**, clique em **Abrir** na parcela.

A tela mostra três números: **valor da parcela**, **já pago** e **saldo em
aberto**, mais o histórico de todos os pagamentos que aquela parcela já
recebeu.

Em **Registrar pagamento**, o campo de valor vem preenchido com o saldo, mas é
**livre**. Se digitar menos, o sistema avisa em destaque:

> *Pagamento parcial: ficarão R$ 400,00 em aberto nesta mesma parcela.*

**O que acontece com o que sobrou:**

- **Não** vira parcela nova. Continua sendo dívida da **mesma parcela**, do
  mesmo mês de referência.
- A parcela fica com status **Parcial**.
- Ela aparece no relatório **Saldo residual em aberto**, com a contagem de dias
  desde o vencimento.
- Quando houver caixa — no mês seguinte ou seis meses depois — é só abrir a
  mesma parcela e registrar outro pagamento. Quando o saldo chegar a zero, a
  parcela vira **Paga**.

Uma parcela pode receber quantos pagamentos forem necessários. Todos ficam
listados, com data, valor, forma e banco.

**Não é possível pagar mais que o saldo.** O sistema recusa e explica o motivo.

---

## Baixa no Livro Caixa

Cada pagamento registrado gera **automaticamente** uma despesa no Livro Caixa,
com o banco, o departamento, o credor e a referência da parcela
(`CP-2026-000042 parcela 3/12`). Não é preciso lançar duas vezes.

---

## Estorno

No histórico da parcela, cada pagamento tem **Estornar**. É exigido um motivo.

O estorno:
- marca o pagamento como estornado (ele **não** some do histórico — quem
  estornou, quando e por quê ficam registrados);
- estorna também o lançamento correspondente no Livro Caixa;
- recalcula o saldo e o status da parcela e da conta.

---

## Aprovação por alçada (opcional)

Se a igreja configurar um valor de alçada, conta acima daquele valor nasce como
**Aguardando aprovação** e **não aceita pagamento** até ser aprovada. Aprovar e
reprovar ficam na visão **Por conta**.

A alçada é configurada por igreja, na chave `contas_pagar.alcada_aprovacao`.
Sem configuração, nenhuma conta exige aprovação.

---

## Os status

Nenhum deles é digitado — todos saem do cálculo de saldo e vencimento:

| Status | Quando |
|---|---|
| **Pendente** | ainda não venceu e não recebeu pagamento |
| **Parcial** | recebeu parte do valor e ainda deve (mesmo depois de vencer) |
| **Atrasado** | venceu e não recebeu nada |
| **Pago** | saldo zerado |
| **Cancelada** | conta cancelada (só é possível cancelar conta sem pagamento) |

O status da **conta** vem do conjunto das parcelas: todas pagas → *Paga*;
alguma paga ou parcial → *Parcial*; nenhuma paga e alguma vencida → *Atrasada*.

---

## Aba Relatórios

Todos respeitam os filtros escolhidos na aba 1.

- **Por status** — onde está o dinheiro.
- **Por tipo de despesa** — quanto vai para folha pastoral, aluguel, manutenção.
- **Por departamento** — quanto foi para Missões, para cada campanha, para a obra.
- **Fluxo projetado** — o que vence por mês, separando vencido de a vencer.
- **Previsto × pago** — evolução mensal.
- **Saldo residual em aberto** — a lista das parcelas pagas pela metade,
  ordenada pelo tempo em aberto. É aqui que se acompanha o que ficou devendo ao
  pastor ou ao fornecedor.

O botão **Exportar** gera Excel do que estiver na tela, com os filtros aplicados.

---

## Perguntas frequentes

**Lancei o ano do pastor em 12 parcelas e num mês só deu para pagar metade. Faço uma parcela nova?**
Não. Registre o pagamento parcial na própria parcela do mês. O restante fica
nela, em aberto, até ser quitado.

**Paguei o resto três meses depois. O sistema entende?**
Sim. É só abrir a mesma parcela e registrar o segundo pagamento. A data que
vale para o Livro Caixa é a do pagamento; a parcela continua referente ao mês
original.

**Errei o valor de um pagamento.**
Estorne e registre de novo. O estorno desfaz também o lançamento no Livro Caixa.

**Preciso mudar o valor total de uma conta já lançada.**
Valor e parcelamento não são editáveis depois de criados — mexer neles com
pagamento registrado desmontaria os saldos. Estorne os pagamentos, cancele a
conta e lance de novo.

**Um tipo de despesa não serve mais.**
Desative. Se tiver conta vinculada, o sistema recusa a exclusão e inativa
sozinho, para não apagar a classificação do que já foi lançado.
