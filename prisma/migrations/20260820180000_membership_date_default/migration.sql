-- Rede de seguranca para a data de entrada do membro.
--
-- `created_at` diz quando a LINHA entrou neste banco, nao quando a pessoa
-- entrou na igreja: 25.982 dos 26.214 membros tem created_at do dia da
-- importacao (07/05/2026). Quem contar crescimento por created_at le o lote da
-- migracao como se fosse gente nova.
--
-- `membership_date` e o campo certo, e o formulario ja o preenche com a data de
-- hoje quando o usuario nao informa outra. Mas ha caminhos que gravam direto na
-- tabela (ex.: o modal de PJ do Lancamento) e podem omiti-lo. O DEFAULT fecha
-- essa porta no nivel do banco, onde nenhum caminho novo escapa.
--
-- Nao ha backfill: preencher os nulos existentes seria inventar data de entrada
-- para gente real.
ALTER TABLE "members"
  ALTER COLUMN "membership_date" SET DEFAULT CURRENT_DATE;
