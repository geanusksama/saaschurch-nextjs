-- Gerado por scripts/dump-baseline.mjs em 2026-08-31T18:52:32.433Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 84afdef9474857e7

-- Tipos customizados
do $$ begin create type "public"."app_media_audience_scope" as enum ('headquarters', 'church');
exception when duplicate_object then null; end $$;
do $$ begin create type "public"."app_media_file_kind" as enum ('video', 'audio', 'thumbnail', 'poster', 'subtitle', 'attachment');
exception when duplicate_object then null; end $$;
do $$ begin create type "public"."app_media_kind" as enum ('live', 'sermon', 'short', 'podcast', 'video', 'clip');
exception when duplicate_object then null; end $$;
do $$ begin create type "public"."app_media_person_role" as enum ('speaker', 'host', 'guest', 'musician', 'interpreter');
exception when duplicate_object then null; end $$;
do $$ begin create type "public"."app_media_publish_status" as enum ('draft', 'scheduled', 'published', 'archived');
exception when duplicate_object then null; end $$;
do $$ begin create type "public"."event_tipo" as enum ('com_assentos', 'ingresso_livre');
exception when duplicate_object then null; end $$;
do $$ begin create type "public"."group_tipo" as enum ('setor', 'vip', 'bloqueado');
exception when duplicate_object then null; end $$;
do $$ begin create type "public"."order_status" as enum ('pending', 'confirmed', 'cancelled', 'refunded');
exception when duplicate_object then null; end $$;
do $$ begin create type "public"."santander_conciliacao_status" as enum ('ativo', 'desfeito');
exception when duplicate_object then null; end $$;
do $$ begin create type "public"."santander_conciliacao_tipo" as enum ('automatico', 'manual', 'sugerido');
exception when duplicate_object then null; end $$;
do $$ begin create type "public"."santander_movimento_source" as enum ('api', 'febraban', 'importacao');
exception when duplicate_object then null; end $$;
do $$ begin create type "public"."santander_movimento_status" as enum ('novo', 'match_exato', 'match_sugerido', 'sem_lancamento', 'sem_movimento_bancario', 'conciliado', 'ignorado', 'lancado', 'duplicado');
exception when duplicate_object then null; end $$;
do $$ begin create type "public"."seat_status" as enum ('available', 'reserved', 'sold', 'blocked');
exception when duplicate_object then null; end $$;
