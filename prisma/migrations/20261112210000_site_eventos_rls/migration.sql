-- site_eventos com RLS, como as demais tabelas: sem política, a chave pública
-- (anon/authenticated) não lê nem altera nada; só o servidor (service role,
-- /api/public/site-eventos e /api/site-rastreio) grava e lê.
ALTER TABLE "site_eventos" ENABLE ROW LEVEL SECURITY;
