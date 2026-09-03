-- Campo e regional passam a ter default de id e updated_at no banco.
--
-- Migration ADITIVA: só acrescenta DEFAULT, não altera tipo nem dado existente.
--
-- Campo e regional nasceram sendo gravados só pelo Prisma, que gera o uuid e o
-- updated_at na aplicação — então as colunas ficaram sem default no banco. O
-- CRUD genérico de cadastros (lookupRegistry) grava por SQL cru, informando
-- apenas as colunas registradas: sem estes defaults o INSERT morre em
-- "null value in column id violates not-null constraint", e a tela de cadastro
-- de campo/regional não teria como existir.
--
-- É o mesmo formato que `zonas`, `bancos` e as demais listas já usam. O Prisma
-- continua mandando os valores dele; o default só cobre quem não manda.

ALTER TABLE "campos"    ALTER COLUMN "id"         SET DEFAULT gen_random_uuid();
ALTER TABLE "campos"    ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "regionais" ALTER COLUMN "id"         SET DEFAULT gen_random_uuid();
ALTER TABLE "regionais" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
