-- Gerado por scripts/dump-baseline.mjs em 2026-09-24T15:02:40.181Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 8bbb1b4492ffc847

-- Realtime: tabelas publicadas
do $$ begin alter publication supabase_realtime add table "public"."app_push_notifications";
exception when duplicate_object or undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table "public"."face_enrollment_signals";
exception when duplicate_object or undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table "public"."feed_post_comments";
exception when duplicate_object or undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table "public"."feed_post_likes";
exception when duplicate_object or undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table "public"."feed_posts";
exception when duplicate_object or undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table "public"."internal_chat_messages";
exception when duplicate_object or undefined_object then null; end $$;
