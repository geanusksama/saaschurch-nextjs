-- WhatsApp Oficial (Meta): alertas das igrejas chegando ao master no base. Aditivo.
-- origem = "<domínio da igreja> · <campo>" nos alertas recebidos; null nos do próprio banco.
ALTER TABLE "meta_alertas" ADD COLUMN IF NOT EXISTS "origem" TEXT;
