-- Gerado por scripts/dump-baseline.mjs em 2026-08-31T18:52:32.435Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 84afdef9474857e7

-- Tabelas (colunas, defaults, not null, identity, generated)

create table if not exists "public"."_prisma_migrations" (
  "id" character varying(36) not null,
  "checksum" character varying(64) not null,
  "finished_at" timestamp with time zone,
  "migration_name" character varying(255) not null,
  "logs" text,
  "rolled_back_at" timestamp with time zone,
  "started_at" timestamp with time zone default now() not null,
  "applied_steps_count" integer default 0 not null
);

create table if not exists "public"."ai_agent_users" (
  "id" uuid default gen_random_uuid() not null,
  "agent_id" uuid not null,
  "user_id" uuid not null,
  "added_by" uuid,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."ai_agents" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid,
  "name" character varying(255) not null,
  "description" text,
  "role" character varying(50) not null,
  "system_prompt" text not null,
  "avatar_url" character varying(500),
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "campo_id" uuid,
  "visibility" character varying(20) default 'global'::character varying not null
);

create table if not exists "public"."ai_chat_messages" (
  "id" uuid default gen_random_uuid() not null,
  "session_id" uuid not null,
  "role" character varying(20) not null,
  "content" text not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."ai_chat_sessions" (
  "id" uuid default gen_random_uuid() not null,
  "agent_id" uuid not null,
  "user_id" uuid not null,
  "church_id" uuid,
  "title" character varying(255),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."app_cadastros" (
  "id" uuid default gen_random_uuid() not null,
  "auth_user_id" uuid,
  "email" text not null,
  "campo_id" uuid,
  "campo_name" text default ''::text not null,
  "is_member" boolean default false not null,
  "member_id" uuid,
  "status" text default 'PENDENTE'::text not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "nome" text default ''::text not null,
  "user_id" uuid,
  "headquarters_id" uuid,
  "observacoes" text
);

create table if not exists "public"."app_cart_items" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "event_id" uuid not null,
  "seat_id" uuid,
  "qty" smallint default 1 not null,
  "unit_price" numeric(10,2) default 0 not null,
  "expires_at" timestamp with time zone default (now() + '00:15:00'::interval) not null,
  "created_at" timestamp with time zone default now() not null,
  "campo_id" uuid
);

create table if not exists "public"."app_daily_bread_entries" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "headquarters_id" uuid,
  "church_id" uuid,
  "audience_scope" text default 'headquarters'::text not null,
  "title" text not null,
  "summary" text not null,
  "body_text" text not null,
  "bible_reference" text not null,
  "audio_url" text,
  "audio_duration_seconds" integer default 0 not null,
  "accent_hex" text default '#1A1A2E'::text not null,
  "icon_name" text default 'breakfast_dining'::text not null,
  "is_featured" boolean default false not null,
  "active" boolean default true not null,
  "published_at" timestamp with time zone default now() not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."app_daily_bread_likes" (
  "entry_id" uuid not null,
  "member_id" uuid not null,
  "created_at" timestamp with time zone default now() not null,
  "campo_id" uuid
);

create table if not exists "public"."app_event_buildings" (
  "id" uuid default gen_random_uuid() not null,
  "event_id" uuid not null,
  "nome" text default 'Bloco Principal'::text not null,
  "descricao" text default ''::text not null,
  "ordem" smallint default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "campo_id" uuid
);

create table if not exists "public"."app_event_halls" (
  "id" uuid default gen_random_uuid() not null,
  "event_id" uuid not null,
  "building_id" uuid,
  "nome" text default 'Salão Principal'::text not null,
  "andar" smallint default 1 not null,
  "num_rows" smallint default 8 not null,
  "seats_per_row" smallint default 12 not null,
  "ordem" smallint default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "campo_id" uuid
);

create table if not exists "public"."app_events" (
  "id" uuid default gen_random_uuid() not null,
  "headquarters_id" uuid,
  "title" text,
  "description" text default ''::text,
  "categoria" text default 'Geral'::text not null,
  "icon_emoji" character varying(20) default '🎉'::character varying not null,
  "icon_name" character varying(50),
  "banner_url" text,
  "start_at" timestamp with time zone,
  "end_at" timestamp with time zone,
  "location" text default ''::text,
  "location_lat" numeric(9,6),
  "location_lng" numeric(9,6),
  "tipo" event_tipo default 'com_assentos'::event_tipo not null,
  "default_price" numeric(10,2) default 0 not null,
  "total_tickets" integer default 0 not null,
  "is_active" boolean default true not null,
  "is_public" boolean default true not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "tipo_evento" character varying(20) default 'LIVRE'::character varying,
  "icon" character varying(50),
  "imagem_url" character varying(500),
  "gratuito" boolean default true,
  "permite_transferencia" boolean default false,
  "permite_cancelamento" boolean default false,
  "permite_reembolso" boolean default false,
  "capacidade_total" integer,
  "quantidade_disponivel" integer,
  "limite_por_usuario" integer,
  "local_endereco" text,
  "department_id" uuid,
  "church_id" uuid,
  "nome" character varying(255) not null,
  "descricao" text,
  "data_inicio" timestamp with time zone not null,
  "data_fim" timestamp with time zone not null,
  "local" character varying(255),
  "status" character varying(20) default 'RASCUNHO'::character varying,
  "preco" numeric(10,2) default 0,
  "campo_id" uuid,
  "regional_id" uuid,
  "is_featured" boolean default false not null
);

create table if not exists "public"."app_lideranca" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "nome" text not null,
  "cargo" text not null,
  "descricao" text,
  "foto_url" text,
  "tipo" text default 'pastor'::text not null,
  "ordem" integer default 0 not null,
  "ativo" boolean default true not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists "public"."app_location_access_info" (
  "id" uuid default gen_random_uuid() not null,
  "profile_id" uuid not null,
  "text" text not null,
  "icon_key" text not null,
  "color_hex" text not null,
  "sort_order" integer default 0 not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "campo_id" uuid not null
);

create table if not exists "public"."app_location_contacts" (
  "id" uuid default gen_random_uuid() not null,
  "profile_id" uuid not null,
  "kind" text not null,
  "title" text not null,
  "subtitle" text not null,
  "icon_key" text not null,
  "color_hex" text not null,
  "action_url" text not null,
  "sort_order" integer default 0 not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "campo_id" uuid not null
);

create table if not exists "public"."app_location_details" (
  "id" uuid default gen_random_uuid() not null,
  "profile_id" uuid not null,
  "label" text not null,
  "value" text not null,
  "icon_key" text not null,
  "action_url" text,
  "sort_order" integer default 0 not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "campo_id" uuid not null
);

create table if not exists "public"."app_location_profiles" (
  "id" uuid default gen_random_uuid() not null,
  "slug" text not null,
  "hero_badge" text default 'COMO CHEGAR'::text not null,
  "hero_title" text default 'LocalizaÃ§Ã£o'::text not null,
  "hero_subtitle" text default 'Como chegar atÃ© a nossa igreja.'::text not null,
  "year_badge" text default '2026'::text not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "campo_id" uuid not null,
  "headquarters_id" uuid,
  "church_id" uuid,
  "audience_scope" text default 'headquarters'::text not null
);

create table if not exists "public"."app_location_schedule" (
  "id" uuid default gen_random_uuid() not null,
  "profile_id" uuid not null,
  "title" text not null,
  "weekday_label" text not null,
  "time_label" text not null,
  "icon_key" text not null,
  "color_hex" text not null,
  "sort_order" integer default 0 not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "campo_id" uuid not null
);

create table if not exists "public"."app_location_social_links" (
  "id" uuid default gen_random_uuid() not null,
  "profile_id" uuid not null,
  "label" text not null,
  "icon_key" text not null,
  "color_hex" text not null,
  "url" text not null,
  "sort_order" integer default 0 not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "campo_id" uuid not null
);

create table if not exists "public"."app_media_channels" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "headquarters_id" uuid not null,
  "church_id" uuid,
  "audience_scope" app_media_audience_scope default 'headquarters'::app_media_audience_scope not null,
  "name" text not null,
  "handle" text,
  "subtitle" text,
  "description" text,
  "logo_url" text,
  "banner_url" text,
  "accent_hex" text default '#1A1A2E'::text not null,
  "youtube_url" text,
  "instagram_url" text,
  "podcast_url" text,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."app_media_files" (
  "id" uuid default gen_random_uuid() not null,
  "item_id" uuid not null,
  "campo_id" uuid not null,
  "headquarters_id" uuid not null,
  "church_id" uuid,
  "audience_scope" app_media_audience_scope default 'headquarters'::app_media_audience_scope not null,
  "bucket_name" text default 'cultos'::text not null,
  "file_kind" app_media_file_kind not null,
  "storage_path" text not null,
  "mime_type" text,
  "extension" text,
  "size_bytes" bigint,
  "duration_seconds" integer,
  "width" integer,
  "height" integer,
  "checksum_sha256" text,
  "is_primary" boolean default false not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."app_media_item_people" (
  "item_id" uuid not null,
  "person_id" uuid not null,
  "role" app_media_person_role not null,
  "sort_order" integer default 0 not null,
  "campo_id" uuid not null
);

create table if not exists "public"."app_media_items" (
  "id" uuid default gen_random_uuid() not null,
  "channel_id" uuid not null,
  "series_id" uuid,
  "campo_id" uuid not null,
  "headquarters_id" uuid not null,
  "church_id" uuid,
  "audience_scope" app_media_audience_scope default 'headquarters'::app_media_audience_scope not null,
  "kind" app_media_kind not null,
  "publish_status" app_media_publish_status default 'draft'::app_media_publish_status not null,
  "title" text not null,
  "slug" text not null,
  "subtitle" text,
  "description" text,
  "badge_label" text,
  "action_label" text,
  "source_platform" text default 'supabase'::text not null,
  "watch_url" text,
  "embed_url" text,
  "external_id" text,
  "accent_hex" text default '#1A1A2E'::text not null,
  "thumbnail_url" text,
  "poster_url" text,
  "starts_at" timestamp with time zone,
  "published_at" timestamp with time zone,
  "duration_seconds" integer,
  "is_live_now" boolean default false not null,
  "is_featured" boolean default false not null,
  "allow_comments" boolean default true not null,
  "view_count" bigint default 0 not null,
  "like_count" bigint default 0 not null,
  "comment_count" bigint default 0 not null,
  "sort_order" integer default 0 not null,
  "active" boolean default true not null,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."app_media_people" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "headquarters_id" uuid not null,
  "church_id" uuid,
  "audience_scope" app_media_audience_scope default 'headquarters'::app_media_audience_scope not null,
  "full_name" text not null,
  "display_name" text,
  "role_title" text,
  "bio" text,
  "avatar_url" text,
  "external_url" text,
  "accent_hex" text default '#1A1A2E'::text not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."app_media_section_items" (
  "section_id" uuid not null,
  "item_id" uuid not null,
  "sort_order" integer default 0 not null,
  "campo_id" uuid not null
);

create table if not exists "public"."app_media_sections" (
  "id" uuid default gen_random_uuid() not null,
  "channel_id" uuid not null,
  "campo_id" uuid not null,
  "headquarters_id" uuid not null,
  "church_id" uuid,
  "audience_scope" app_media_audience_scope default 'headquarters'::app_media_audience_scope not null,
  "tab_key" text not null,
  "section_key" text not null,
  "title" text not null,
  "subtitle" text,
  "layout_kind" text not null,
  "sort_order" integer default 0 not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."app_media_series" (
  "id" uuid default gen_random_uuid() not null,
  "channel_id" uuid not null,
  "campo_id" uuid not null,
  "headquarters_id" uuid not null,
  "church_id" uuid,
  "audience_scope" app_media_audience_scope default 'headquarters'::app_media_audience_scope not null,
  "series_type" text not null,
  "title" text not null,
  "slug" text not null,
  "summary" text,
  "cover_url" text,
  "trailer_url" text,
  "sort_order" integer default 0 not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."app_membros_auth" (
  "id" uuid default gen_random_uuid() not null,
  "auth_user_id" uuid not null,
  "member_id" uuid,
  "campo_id" uuid,
  "campo_name" text default ''::text not null,
  "ultimo_login" timestamp with time zone default now(),
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists "public"."app_notifications" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "tipo" text not null,
  "titulo" text not null,
  "mensagem" text not null,
  "order_id" uuid,
  "lida" boolean default false not null,
  "created_at" timestamp with time zone default now(),
  "campo_id" uuid
);

create table if not exists "public"."app_order_items" (
  "id" uuid default gen_random_uuid() not null,
  "order_id" uuid not null,
  "event_id" uuid not null,
  "seat_id" uuid,
  "row_label" character(1),
  "seat_number" smallint,
  "hall_name" text default ''::text not null,
  "building_name" text default ''::text not null,
  "unit_price" numeric(10,2) default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "campo_id" uuid
);

create table if not exists "public"."app_orders" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "event_id" uuid not null,
  "buyer_name" text default ''::text not null,
  "buyer_email" text default ''::text not null,
  "buyer_phone" text default ''::text not null,
  "subtotal" numeric(10,2) default 0 not null,
  "discount" numeric(10,2) default 0 not null,
  "total" numeric(10,2) default 0 not null,
  "payment_method" text default 'free'::text not null,
  "payment_ref" text,
  "status" order_status default 'pending'::order_status not null,
  "notes" text default ''::text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "cancelled_at" timestamp with time zone,
  "campo_id" uuid
);

create table if not exists "public"."app_public_history_sections" (
  "id" uuid default gen_random_uuid() not null,
  "profile_id" uuid not null,
  "year_label" text not null,
  "title" text not null,
  "icon_key" text not null,
  "paragraphs" jsonb default '[]'::jsonb not null,
  "sort_order" integer default 0 not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "campo_id" uuid not null
);

create table if not exists "public"."app_public_leaders" (
  "id" uuid default gen_random_uuid() not null,
  "profile_id" uuid not null,
  "group_id" uuid not null,
  "full_name" text not null,
  "title" text not null,
  "bio" text not null,
  "photo_url" text,
  "accent_hex" text default '#1C2130'::text not null,
  "sort_order" integer default 0 not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "campo_id" uuid not null
);

create table if not exists "public"."app_public_leadership_groups" (
  "id" uuid default gen_random_uuid() not null,
  "profile_id" uuid not null,
  "group_key" text not null,
  "label" text not null,
  "sort_order" integer default 0 not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "campo_id" uuid not null
);

create table if not exists "public"."app_public_profiles" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "headquarters_id" uuid not null,
  "church_id" uuid,
  "audience_scope" text default 'headquarters'::text not null,
  "slug" text not null,
  "display_name" text not null,
  "subtitle" text,
  "history_badge" text default 'ASSEMBLEIA DE DEUS'::text not null,
  "history_title" text default 'Nossa Hist??ria'::text not null,
  "history_subtitle" text,
  "radio_badge" text default 'AO VIVO'::text not null,
  "radio_title" text default 'R??dio AD'::text not null,
  "radio_subtitle" text default 'Streaming ao vivo ?? Palavra e louvor 24h.'::text not null,
  "radio_station_name" text,
  "radio_station_tagline" text,
  "radio_stream_url" text,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."app_push_notification_reads" (
  "notification_id" uuid not null,
  "user_id" uuid not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."app_push_notifications" (
  "id" uuid default gen_random_uuid() not null,
  "title" text not null,
  "body" text not null,
  "media_url" text,
  "media_type" text,
  "action_url" text,
  "target_type" text default 'all'::text not null,
  "target_campo_id" uuid,
  "target_regional_id" uuid,
  "target_church_id" uuid,
  "status" text default 'draft'::text not null,
  "scheduled_at" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "campo_id" uuid,
  "created_by" uuid,
  "recipient_count" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "target_ids" uuid[] default '{}'::uuid[] not null
);

create table if not exists "public"."app_seat_groups" (
  "id" uuid default gen_random_uuid() not null,
  "event_id" uuid not null,
  "hall_id" uuid,
  "nome" text not null,
  "tipo" group_tipo default 'setor'::group_tipo not null,
  "cor_hex" character varying(7) default '#3B82F6'::character varying not null,
  "preco_especial" numeric(10,2),
  "created_at" timestamp with time zone default now() not null,
  "campo_id" uuid
);

create table if not exists "public"."app_seats" (
  "id" uuid default gen_random_uuid() not null,
  "event_id" uuid not null,
  "hall_id" uuid,
  "group_id" uuid,
  "row_label" character(1) not null,
  "seat_number" smallint not null,
  "price" numeric(10,2) default 0 not null,
  "status" seat_status default 'available'::seat_status not null,
  "reserved_by" uuid,
  "reserved_at" timestamp with time zone,
  "order_item_id" uuid,
  "created_at" timestamp with time zone default now() not null,
  "campo_id" uuid
);

create table if not exists "public"."app_testemunhos" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "autor" text not null,
  "titulo" text not null,
  "corpo" text not null,
  "likes" integer default 0 not null,
  "ativo" boolean default true not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists "public"."app_tickets" (
  "id" uuid default gen_random_uuid() not null,
  "order_item_id" uuid not null,
  "order_id" uuid not null,
  "user_id" uuid not null,
  "event_id" uuid not null,
  "ticket_code" text default (gen_random_uuid())::text not null,
  "qr_payload" text,
  "is_used" boolean default false not null,
  "used_at" timestamp with time zone,
  "checked_in_by" uuid,
  "issued_at" timestamp with time zone default now() not null,
  "cancelled_at" timestamp with time zone,
  "campo_id" uuid
);

create table if not exists "public"."asset_inventories" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "started_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "finished_at" timestamp(3) without time zone,
  "started_by_user_id" uuid not null,
  "leader_name" character varying(255),
  "status" character varying(20) default 'in_progress'::character varying not null,
  "observation" text
);

create table if not exists "public"."asset_inventory_items" (
  "id" uuid default gen_random_uuid() not null,
  "inventory_id" uuid not null,
  "asset_id" uuid not null,
  "scanned_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "location_match" boolean default true not null,
  "location_found" character varying(255),
  "observation" text
);

create table if not exists "public"."assets" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "code" character varying(30) not null,
  "name" character varying(255) not null,
  "category" character varying(100),
  "sector" character varying(100),
  "description" text,
  "photo_url" text,
  "qr_token" uuid default gen_random_uuid() not null,
  "location_type" character varying(20) not null,
  "location_detail" character varying(255),
  "acquisition_type" character varying(20),
  "acquisition_date" date,
  "value" numeric(12,2),
  "status" character varying(20) default 'active'::character varying not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."attendance_records" (
  "id" uuid not null,
  "session_id" uuid not null,
  "member_id" uuid not null,
  "first_detected_at" timestamp with time zone not null,
  "last_detected_at" timestamp with time zone not null,
  "detection_count" integer not null,
  "best_confidence" double precision not null,
  "cameras_detected" json,
  "evidence_image_url" character varying(500),
  "status" character varying(50) not null,
  "added_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."attendance_sessions" (
  "id" uuid not null,
  "church_id" character varying(100),
  "title" character varying(255) not null,
  "type" character varying(50) not null,
  "start_time" timestamp with time zone,
  "end_time" timestamp with time zone,
  "status" character varying(50) not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."audit_logs" (
  "id" uuid not null,
  "church_id" uuid,
  "user_id" uuid,
  "action" character varying(50) not null,
  "entity_type" character varying(100),
  "entity_id" uuid,
  "description" text,
  "changes" jsonb,
  "ip_address" character varying(45),
  "user_agent" text,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."bancos" (
  "id" uuid default gen_random_uuid() not null,
  "nome" character varying(150) not null,
  "codigo" character varying(10),
  "agencia" character varying(20),
  "conta" character varying(30),
  "tipo_conta" character varying(30),
  "chave_pix" character varying(255),
  "titular" character varying(255),
  "ativo" boolean default true not null,
  "is_default" boolean default false not null,
  "church_id" uuid,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "campo_id" uuid,
  "codigo_febraban" character varying(10)
);

create table if not exists "public"."baptism_schedules" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "scheduled_date" date not null,
  "notes" text,
  "is_active" boolean default true not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."baptisms" (
  "id" uuid not null,
  "church_id" uuid not null,
  "member_id" uuid not null,
  "baptism_date" date not null,
  "location" character varying(255),
  "minister_id" uuid,
  "certificate_number" character varying(50),
  "certificate_url" character varying(500),
  "witnesses" jsonb,
  "notes" text,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "created_by" uuid,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."blog_posts" (
  "id" uuid not null,
  "church_id" uuid not null,
  "title" character varying(255) not null,
  "slug" character varying(255) not null,
  "excerpt" text,
  "content" text,
  "author_id" uuid,
  "category" character varying(100),
  "tags" jsonb,
  "featured_image_url" character varying(500),
  "meta_title" character varying(255),
  "meta_description" text,
  "status" character varying(20) default 'draft'::character varying,
  "published_at" timestamp(3) without time zone,
  "views_count" integer default 0 not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "created_by" uuid,
  "updated_by" uuid,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."cameras" (
  "id" uuid not null,
  "name" character varying(255) not null,
  "location" character varying(255),
  "rtsp_url" character varying(500) not null,
  "username" character varying(100),
  "password" character varying(100),
  "active" boolean not null,
  "fps_analysis" integer not null,
  "min_face_size" integer not null,
  "status" character varying(50) not null,
  "last_seen_at" timestamp with time zone,
  "church_id" character varying(100),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."campos" (
  "id" uuid not null,
  "name" character varying(255) not null,
  "code" character varying(50) not null,
  "description" text,
  "logo_url" character varying(500),
  "country" character varying(100) default 'Brasil'::character varying,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "deleted_at" timestamp(3) without time zone,
  "access_password_hash" character varying(255),
  "domain" character varying(255),
  "app_display_name" text,
  "primary_color" character varying(7) default '#1A1D3D'::character varying,
  "secondary_color" character varying(7) default '#4A56C1'::character varying
);

create table if not exists "public"."cell_group_leaders" (
  "id" uuid default gen_random_uuid() not null,
  "cell_group_id" uuid not null,
  "member_id" uuid not null,
  "position" integer default 0 not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."cell_group_members" (
  "id" uuid not null,
  "cell_group_id" uuid not null,
  "member_id" uuid not null,
  "role" character varying(50) default 'member'::character varying,
  "joined_at" date not null,
  "left_at" date,
  "is_active" boolean default true not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."cell_group_share_links" (
  "id" uuid default gen_random_uuid() not null,
  "token" uuid default gen_random_uuid() not null,
  "cell_group_id" uuid not null,
  "member_id" text,
  "import_row_id" uuid,
  "contact_name" text,
  "contact_phone" text not null,
  "created_by" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."cell_groups" (
  "id" uuid not null,
  "church_id" uuid not null,
  "name" character varying(255) not null,
  "description" text,
  "leader_id" uuid,
  "host_id" uuid,
  "cell_type" character varying(30),
  "meeting_day" character varying(20),
  "meeting_time" time(6) without time zone,
  "address" text,
  "latitude" numeric(10,8),
  "longitude" numeric(11,8),
  "max_capacity" integer,
  "status" character varying(20) default 'active'::character varying,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "deleted_at" timestamp(3) without time zone,
  "address_street" character varying(255),
  "address_number" character varying(20),
  "address_complement" character varying(100),
  "address_neighborhood" character varying(100),
  "address_city" character varying(100),
  "address_state" character varying(50),
  "address_zipcode" character varying(10),
  "color" character varying(50),
  "photo" text
);

create table if not exists "public"."cell_meetings" (
  "id" uuid not null,
  "cell_group_id" uuid not null,
  "meeting_date" date not null,
  "topic" character varying(255),
  "notes" text,
  "attendance_count" integer default 0 not null,
  "visitors_count" integer default 0 not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "created_by" uuid
);

create table if not exists "public"."centro_de_custo" (
  "id" uuid default gen_random_uuid() not null,
  "legacy_id" integer,
  "nome" character varying(100) not null,
  "mostrar" boolean default true not null,
  "campo" character varying(100),
  "church_id" uuid,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."church" (
  "legacy_id" bigint generated by default as identity not null,
  "name" character varying(255) default '0'::character varying,
  "legacy_region_id" character varying(255) default '0'::character varying,
  "legacy_headquarters_id" character varying(255) default '0'::character varying,
  "hierarchy" character varying(255) default '0'::character varying,
  "document_type" character varying(255) default '0'::character varying,
  "document_number" character varying(255) default '0'::character varying,
  "foundation_date" character varying(255) default '0'::character varying,
  "zipcode" character varying(255) default '0'::character varying,
  "country" character varying(255) default '0'::character varying,
  "state" character varying(255) default '0'::character varying,
  "city" character varying(255) default '0'::character varying,
  "neighborhood" character varying(255) default '0'::character varying,
  "street" character varying(255) default '0'::character varying,
  "region_name" character varying(255) default '0'::character varying,
  "has_own_temple" boolean default true,
  "field_name" character varying(255) default '0'::character varying,
  "firebase_id" character varying(255) default '0'::character varying,
  "notes" character varying(255) default '0'::character varying,
  "parent_church_name" character varying(255) default '0'::character varying,
  "is_active" boolean default true,
  "code" bigint default 0,
  "plate_name" character varying(255) default '0'::character varying,
  "leader_name" character varying(255) default '0'::character varying,
  "entry_date" character varying(255) default '0'::character varying,
  "exit_date" character varying(255) default '0'::character varying,
  "leader_roll" bigint default 0,
  "id" uuid default gen_random_uuid() not null,
  "region_id" uuid,
  "headquarters_id" uuid,
  "field_id" uuid
);

create table if not exists "public"."church_access_info" (
  "id" uuid default gen_random_uuid() not null,
  "headquarters_id" uuid not null,
  "type" character varying(20) default 'bus'::character varying not null,
  "description" character varying(500) not null,
  "order" integer default 0 not null,
  "created_at" timestamp(6) with time zone default CURRENT_TIMESTAMP not null,
  "map_url" character varying(500),
  "icon" character varying(30) default 'Bus'::character varying not null
);

create table if not exists "public"."church_cashbook_status" (
  "id" uuid not null,
  "church_id" uuid not null,
  "reference_year" integer not null,
  "reference_month" integer not null,
  "status" character varying(20) default 'OPEN'::character varying not null,
  "allow_until" date,
  "notes" text,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."church_contacts" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "type" character varying(50) not null,
  "name" character varying(150),
  "value" character varying(255) not null,
  "notes" text,
  "is_primary" boolean default false not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."church_function_catalog" (
  "legacy_id" bigint default nextval('tbfuncoes_id_seq'::regclass) not null,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
  "abbreviation" character varying(255),
  "name" character varying(255),
  "is_active" boolean,
  "number" character varying(255),
  "prerequisite_level" bigint,
  "minimum_age" bigint,
  "maximum_age" bigint,
  "display_order" bigint,
  "requires_minimum_date" boolean,
  "is_leader_role" boolean,
  "is_board_role" boolean,
  "only_minister" boolean,
  "allow_men" boolean,
  "allow_women" boolean,
  "profiles" character varying(255),
  "field_name" character varying(255),
  "id" uuid default gen_random_uuid() not null
);

create table if not exists "public"."church_function_history" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "member_id" uuid not null,
  "legacy_function_id" bigint,
  "start_date" date not null,
  "end_date" date,
  "notes" text,
  "is_active" boolean default true not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "deleted_at" timestamp(3) without time zone,
  "function_id" uuid,
  "department" character varying(150),
  "is_campo_wide" boolean default false not null
);

create table if not exists "public"."church_leader_history" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "previous_leader_member_id" uuid,
  "new_leader_member_id" uuid,
  "legacy_function_id" bigint,
  "indicated_by" character varying(255) not null,
  "change_reason" text not null,
  "entry_date" date not null,
  "previous_exit_date" date,
  "current_cash" numeric(12,2),
  "average_income" numeric(12,2),
  "average_expense" numeric(12,2),
  "max_income" numeric(12,2),
  "total_members" integer,
  "total_workers" integer,
  "notes" text,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "function_id" uuid,
  "exit_date" date,
  "distance_km" numeric(8,2)
);

create table if not exists "public"."church_photo" (
  "legacy_id" bigint generated by default as identity not null,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "legacy_church_id" bigint,
  "photo_url" text,
  "field_name" character varying(255),
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid
);

create table if not exists "public"."church_presence_tickets" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "church_id" uuid,
  "church_name" character varying(255),
  "regional_name" character varying(255),
  "data_culto" date not null,
  "ticket_code" character varying(50),
  "membro_rol" character varying(50),
  "created_at" timestamp with time zone default now() not null,
  "created_by" uuid
);

create table if not exists "public"."church_rent_records" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "city" character varying(100) not null,
  "address" character varying(255) not null,
  "amount" numeric(12,2) not null,
  "owner_name" character varying(150),
  "owner_document_type" character varying(10),
  "owner_document_number" character varying(20),
  "paid_at" date not null,
  "receipt_url" character varying(500),
  "notes" text,
  "is_active" boolean default true not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."church_schedule" (
  "id" uuid default gen_random_uuid() not null,
  "headquarters_id" uuid not null,
  "day_of_week" character varying(20) not null,
  "name" character varying(255) not null,
  "time" character varying(10) not null,
  "order" integer default 0 not null,
  "created_at" timestamp(6) with time zone default CURRENT_TIMESTAMP not null,
  "icon" character varying(30) default 'Sun'::character varying not null
);

create table if not exists "public"."churches" (
  "id" uuid not null,
  "regional_id" uuid not null,
  "name" character varying(255) not null,
  "code" character varying(50) not null,
  "legal_name" character varying(255),
  "cnpj" character varying(18),
  "lead_pastor_id" uuid,
  "email" character varying(255),
  "phone" character varying(20),
  "website" character varying(255),
  "address_street" character varying(255),
  "address_number" character varying(20),
  "address_complement" character varying(100),
  "address_neighborhood" character varying(100),
  "address_city" character varying(100),
  "address_state" character varying(50),
  "address_zipcode" character varying(10),
  "address_country" character varying(100) default 'Brasil'::character varying,
  "latitude" numeric(10,8),
  "longitude" numeric(11,8),
  "logo_url" character varying(500),
  "primary_color" character varying(7) default '#8b5cf6'::character varying,
  "secondary_color" character varying(7) default '#3b82f6'::character varying,
  "timezone" character varying(50) default 'America/Sao_Paulo'::character varying,
  "currency" character varying(3) default 'BRL'::character varying,
  "language" character varying(5) default 'pt-BR'::character varying,
  "status" character varying(20) default 'active'::character varying,
  "founded_at" date,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "deleted_at" timestamp(3) without time zone,
  "current_leader_name" character varying(255),
  "current_leader_role" character varying(255),
  "current_leader_role_date" date,
  "document_number" character varying(50),
  "document_type" character varying(30),
  "entry_date" date,
  "exit_date" date,
  "has_own_temple" boolean default false not null,
  "hash" character varying(100),
  "leader_roll" character varying(50),
  "notes" text,
  "parent_church_id" uuid,
  "plate_name" character varying(255),
  "whatsapp" character varying(20),
  "headquarters_id" uuid,
  "cashbook_permanent_open" boolean default false not null,
  "is_host" boolean default false not null,
  "zone" character varying(60),
  "host_church_id" uuid
);

create table if not exists "public"."communication_campaigns" (
  "id" uuid not null,
  "church_id" uuid not null,
  "name" character varying(255) not null,
  "description" text,
  "campaign_type" character varying(30) not null,
  "template_id" uuid,
  "target_audience" jsonb,
  "status" character varying(20) default 'draft'::character varying,
  "scheduled_for" timestamp(3) without time zone,
  "sent_at" timestamp(3) without time zone,
  "total_recipients" integer default 0 not null,
  "sent_count" integer default 0 not null,
  "delivered_count" integer default 0 not null,
  "opened_count" integer default 0 not null,
  "clicked_count" integer default 0 not null,
  "failed_count" integer default 0 not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "created_by" uuid,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."communication_templates" (
  "id" uuid not null,
  "church_id" uuid not null,
  "name" character varying(255) not null,
  "template_type" character varying(30) not null,
  "category" character varying(50),
  "subject" character varying(255),
  "body" text not null,
  "available_variables" jsonb,
  "status" character varying(20) default 'active'::character varying,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."consecration_schedules" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "scheduled_date" date not null,
  "notes" text,
  "is_active" boolean default true not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."contabilidade_acessos" (
  "id" uuid default gen_random_uuid() not null,
  "nome" character varying(255) not null,
  "campo" character varying(100) not null,
  "telefone" character varying(20) not null,
  "hash" character varying(100) not null,
  "ativo" boolean default true not null,
  "tentativas" integer default 0 not null,
  "bloqueado_em" timestamp with time zone,
  "ultimo_acesso" timestamp with time zone,
  "gerando" boolean default false not null,
  "gerando_desde" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."contabilidade_agendamentos" (
  "id" uuid default gen_random_uuid() not null,
  "acesso_id" uuid not null,
  "ativo" boolean default false not null,
  "frequencia" character varying(20) default 'mensal'::character varying not null,
  "dia_envio" smallint default 1 not null,
  "hora_envio" time without time zone default '08:00:00'::time without time zone not null,
  "timezone" character varying(50) default 'America/Sao_Paulo'::character varying not null,
  "tipo_periodo" character varying(20) default 'mes_anterior'::character varying not null,
  "gap_meses" smallint default 1 not null,
  "qtd_meses" smallint default 1 not null,
  "proximo_envio" timestamp with time zone,
  "ultimo_envio" timestamp with time zone,
  "created_by" character varying(255),
  "updated_by" character varying(255),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."contabilidade_envios_historico" (
  "id" uuid default gen_random_uuid() not null,
  "agendamento_id" uuid,
  "acesso_id" uuid not null,
  "disparado_em" timestamp with time zone default now() not null,
  "tipo" character varying(20) not null,
  "gap_meses" smallint,
  "qtd_meses" smallint,
  "periodos" jsonb default '[]'::jsonb not null,
  "status" character varying(20) default 'sucesso'::character varying not null,
  "tempo_processamento_ms" integer,
  "total_registros" integer default 0 not null,
  "total_divergencias" integer default 0 not null,
  "erro" text,
  "whatsapp_message_id" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."contabilidade_periodos_enviados" (
  "id" uuid default gen_random_uuid() not null,
  "acesso_id" uuid not null,
  "historico_id" uuid,
  "ano" smallint not null,
  "mes" smallint not null,
  "versao" integer default 1 not null,
  "lancamento_ids" jsonb default '[]'::jsonb not null,
  "qtd_registros" integer default 0 not null,
  "enviado_em" timestamp with time zone default now() not null
);

create table if not exists "public"."contabilidade_relatorio_assinaturas" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "periodo_inicio" date not null,
  "periodo_fim" date not null,
  "slot" character varying(20) not null,
  "imagem" text not null,
  "assinado_por" character varying(255),
  "assinado_por_id" character varying(255),
  "profile_type" character varying(20),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."contas_pagar" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "numero" character varying(30) not null,
  "credor_id" uuid,
  "departamento_id" uuid,
  "banco_id" uuid,
  "descricao" character varying(500) not null,
  "valor_total" numeric(15,2) not null,
  "data_emissao" date not null,
  "forma_pagamento_prevista" character varying(30),
  "numero_documento" character varying(100),
  "recorrente" boolean default false not null,
  "parcelado" boolean default false not null,
  "numero_parcelas" integer default 1 not null,
  "status_geral" character varying(20) default 'PENDENTE'::character varying not null,
  "status_aprovacao" character varying(20) default 'NAO_REQUER'::character varying not null,
  "aprovado_por" uuid,
  "data_aprovacao" timestamp with time zone,
  "motivo_reprovacao" text,
  "anexo_documento_url" character varying(500),
  "observacoes" text,
  "criado_por" uuid,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "deleted_at" timestamp with time zone,
  "plano_de_conta_id" uuid
);

create table if not exists "public"."credores" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "nome" character varying(255) not null,
  "tipo_pessoa" character varying(10) default 'PF'::character varying not null,
  "cpf_cnpj" character varying(20),
  "tipo_credor" character varying(30) default 'FORNECEDOR'::character varying not null,
  "member_id" uuid,
  "banco_id" uuid,
  "banco_nome" character varying(150),
  "agencia" character varying(20),
  "conta" character varying(30),
  "tipo_conta" character varying(30),
  "chave_pix" character varying(255),
  "telefone" character varying(30),
  "email" character varying(255),
  "observacoes" text,
  "ativo" boolean default true not null,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "deleted_at" timestamp with time zone,
  "favorecido_church_id" uuid
);

create table if not exists "public"."culto_aprovacoes" (
  "id" uuid default gen_random_uuid() not null,
  "registro_id" uuid not null,
  "nivel" character varying(20) not null,
  "decisao" character varying(20) not null,
  "aprovador_id" uuid,
  "motivo" text,
  "decidido_em" timestamp with time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."culto_lancamentos" (
  "id" uuid default gen_random_uuid() not null,
  "registro_id" uuid not null,
  "bloco" character varying(20) not null,
  "enviado_por" uuid,
  "enviado_em" timestamp with time zone,
  "total_dizimos" numeric(15,2),
  "total_ofertas" numeric(15,2),
  "qtd_dizimos" integer,
  "qtd_ofertas" integer,
  "qtd_homens" integer,
  "qtd_mulheres" integer,
  "qtd_jovens" integer,
  "qtd_adolescentes" integer,
  "qtd_criancas" integer,
  "qtd_visitantes" integer,
  "qtd_conversoes" integer,
  "qtd_reconciliacoes" integer,
  "qtd_familias" integer,
  "cadeiras_vazias" integer,
  "texto" text,
  "anexo_url" character varying(500),
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "observacao" text
);

create table if not exists "public"."culto_posicoes" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "church_id" uuid,
  "user_id" uuid not null,
  "papel" character varying(30) not null,
  "titulo" character varying(120),
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "deleted_at" timestamp with time zone,
  "created_by" uuid
);

create table if not exists "public"."culto_registros" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "regional_id" uuid,
  "church_id" uuid not null,
  "host_church_id" uuid,
  "data_culto" date not null,
  "tipo_culto" character varying(60) default 'CULTO'::character varying not null,
  "status" character varying(30) default 'ABERTO'::character varying not null,
  "observacao" text,
  "concluido_em" timestamp with time zone,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "deleted_at" timestamp with time zone,
  "created_by" uuid,
  "hora_inicio" time without time zone,
  "hora_fim" time without time zone,
  "observacao_presidente" text
);

create table if not exists "public"."culto_visao_bloqueada" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid,
  "church_id" uuid not null,
  "blocos" character varying(20)[] default ARRAY['FINANCEIRO'::character varying(20), 'PRESENCA'::character varying(20), 'EXTRA'::character varying(20)] not null,
  "motivo" text,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "created_by" uuid
);

create table if not exists "public"."departamentos" (
  "id" uuid default gen_random_uuid() not null,
  "nome" character varying(150) not null,
  "codigo" character varying(20),
  "tipo" character varying(30),
  "descricao" text,
  "cor" character varying(7),
  "ordem" integer default 0 not null,
  "ativo" boolean default true not null,
  "is_default" boolean default false not null,
  "church_id" uuid,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "campo_id" uuid
);

create table if not exists "public"."department_cart_items" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid,
  "cart_id" uuid not null,
  "product_id" uuid not null,
  "variant_id" uuid,
  "qty" integer default 1 not null,
  "unit_price" numeric(12,2) default 0 not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."department_carts" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid,
  "department_id" uuid,
  "user_id" uuid,
  "session_token" text,
  "status" text default 'ABERTO'::text not null,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."department_event_forms" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid,
  "event_id" uuid not null,
  "department_id" uuid,
  "inscricoes_de" timestamp with time zone,
  "inscricoes_ate" timestamp with time zone,
  "vagas_total" integer,
  "vagas_por_pessoa" integer default 1 not null,
  "valor" numeric(12,2) default 0 not null,
  "gratuito" boolean default false not null,
  "payment_link" text,
  "aceita_comprovante" boolean default true not null,
  "campos_extras" jsonb default '[]'::jsonb not null,
  "mensagem_confirmacao" text,
  "instrucoes_pagamento" text,
  "ativo" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."department_event_registrations" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid,
  "event_id" uuid not null,
  "department_id" uuid,
  "user_id" uuid,
  "member_id" uuid,
  "nome" text not null,
  "telefone" text not null,
  "cpf" text not null,
  "email" text,
  "data_nascimento" date,
  "campos_extras" jsonb default '{}'::jsonb not null,
  "quantidade" integer default 1 not null,
  "valor_total" numeric(12,2) default 0 not null,
  "check_in_code" text,
  "qr_code_url" text,
  "lookup_token" text,
  "checked_in" boolean default false not null,
  "checked_in_at" timestamp with time zone,
  "checked_in_by" uuid,
  "payment_status" text default 'PENDENTE'::text not null,
  "payment_proof_url" text,
  "payment_ref" text,
  "paid_at" timestamp with time zone,
  "status" text default 'ATIVA'::text not null,
  "origem" text default 'site'::text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone
);

create table if not exists "public"."department_order_items" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid,
  "order_id" uuid not null,
  "product_id" uuid,
  "variant_id" uuid,
  "produto_nome" text not null,
  "variacao" text,
  "imagem_url" text,
  "qty" integer default 1 not null,
  "unit_price" numeric(12,2) default 0 not null,
  "subtotal" numeric(12,2) default 0 not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."department_orders" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid,
  "department_id" uuid,
  "numero_pedido" text,
  "user_id" uuid,
  "nome" text not null,
  "telefone" text not null,
  "cpf" text not null,
  "email" text,
  "endereco" jsonb default '{}'::jsonb not null,
  "observacoes" text,
  "subtotal" numeric(12,2) default 0 not null,
  "desconto" numeric(12,2) default 0 not null,
  "frete" numeric(12,2) default 0 not null,
  "total" numeric(12,2) default 0 not null,
  "payment_link" text,
  "payment_status" text default 'PENDENTE'::text not null,
  "payment_proof_url" text,
  "payment_ref" text,
  "paid_at" timestamp with time zone,
  "lookup_token" text,
  "check_in_code" text,
  "qr_code_url" text,
  "retirado" boolean default false not null,
  "retirado_at" timestamp with time zone,
  "status" text default 'AGUARDANDO'::text not null,
  "origem" text default 'site'::text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."department_product_images" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid,
  "product_id" uuid not null,
  "url" text not null,
  "alt" text default ''::text,
  "ordem" integer default 0 not null,
  "variant_cor" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."department_product_variants" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid,
  "product_id" uuid not null,
  "sku" text,
  "cor" text,
  "cor_hex" text,
  "tamanho" text,
  "preco" numeric(12,2),
  "estoque" integer default 0 not null,
  "ativo" boolean default true not null,
  "ordem" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."department_products" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid,
  "department_id" uuid not null,
  "site_id" uuid,
  "slug" text not null,
  "nome" text not null,
  "descricao" text default ''::text,
  "descricao_curta" text default ''::text,
  "categoria" text default ''::text,
  "preco" numeric(12,2) default 0 not null,
  "preco_promocional" numeric(12,2),
  "parcelas_max" integer default 1 not null,
  "ficha_tecnica" jsonb default '[]'::jsonb not null,
  "tabela_medidas" jsonb default '{}'::jsonb not null,
  "estoque_total" integer,
  "controla_estoque" boolean default true not null,
  "destaque" boolean default false not null,
  "ordem" integer default 0 not null,
  "ativo" boolean default true not null,
  "payment_link" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone
);

create table if not exists "public"."department_site_blocks" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid,
  "site_id" uuid not null,
  "tipo" text not null,
  "variante" text default 'default'::text not null,
  "ordem" integer default 0 not null,
  "props" jsonb default '{}'::jsonb not null,
  "visivel" boolean default true not null,
  "props_publicado" jsonb,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."department_sites" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid,
  "department_id" uuid not null,
  "slug" text not null,
  "titulo" text default ''::text not null,
  "subtitulo" text default ''::text,
  "descricao" text default ''::text,
  "logo_url" text,
  "favicon_url" text,
  "cor_primaria" text default '#6C5CE7'::text,
  "cor_secundaria" text default '#0F1126'::text,
  "cor_destaque" text default '#F1C40F'::text,
  "fonte_titulo" text default 'Inter'::text,
  "fonte_corpo" text default 'Inter'::text,
  "tema" text default 'dark'::text not null,
  "seo_title" text,
  "seo_description" text,
  "og_image_url" text,
  "payment_link" text,
  "whatsapp_number" text,
  "instagram" text,
  "youtube" text,
  "status" text default 'RASCUNHO'::text not null,
  "published_at" timestamp with time zone,
  "published_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "preset" text default 'midnight'::text not null,
  "tokens_override" jsonb default '{}'::jsonb not null
);

create table if not exists "public"."discipleship_enrollments" (
  "id" uuid not null,
  "track_id" uuid not null,
  "member_id" uuid not null,
  "mentor_id" uuid,
  "enrolled_at" date not null,
  "started_at" date,
  "completed_at" date,
  "status" character varying(20) default 'enrolled'::character varying,
  "progress_percentage" integer default 0 not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null
);

create table if not exists "public"."discipleship_meetings" (
  "id" uuid default gen_random_uuid() not null,
  "discipleship_id" uuid not null,
  "church_id" uuid not null,
  "meeting_date" timestamp with time zone not null,
  "lesson_number" integer,
  "lesson_title" text,
  "notes" text,
  "homework" text,
  "next_meeting_at" timestamp with time zone,
  "progress_percent" integer,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "is_active" boolean default true not null
);

create table if not exists "public"."discipleship_program_lessons" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "program_id" uuid not null,
  "lesson_number" integer not null,
  "title" text not null,
  "content_summary" text,
  "duration_minutes" integer,
  "materials" text[] default '{}'::text[] not null,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "is_active" boolean default true not null
);

create table if not exists "public"."discipleship_programs" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "name" text not null,
  "description" text,
  "stage" text not null,
  "lessons_count" integer default 0 not null,
  "color" text,
  "icon" text,
  "is_active" boolean default true not null,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone
);

create table if not exists "public"."discipleship_track_lessons" (
  "id" uuid not null,
  "track_id" uuid not null,
  "title" character varying(255) not null,
  "description" text,
  "lesson_order" integer not null,
  "content" text,
  "resources" jsonb,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null
);

create table if not exists "public"."discipleship_tracks" (
  "id" uuid not null,
  "church_id" uuid not null,
  "name" character varying(255) not null,
  "description" text,
  "duration_weeks" integer,
  "is_active" boolean default true not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."discipleships" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "member_id" uuid,
  "discipler_id" uuid,
  "program_id" uuid,
  "status" text default 'active'::text not null,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "next_meeting_at" timestamp with time zone,
  "current_lesson" integer,
  "total_lessons" integer,
  "progress_percent" integer,
  "notes" text,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "is_active" boolean default true not null
);

create table if not exists "public"."ebd_categorias" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "nome" character varying(100) not null,
  "descricao" text,
  "ordem" integer default 0 not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "created_by" uuid,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."ebd_entrada_itens" (
  "id" uuid default gen_random_uuid() not null,
  "entrada_id" uuid not null,
  "produto_id" uuid not null,
  "quantidade" integer not null,
  "valor_unit" numeric(10,2) not null,
  "valor_total" numeric(10,2) not null
);

create table if not exists "public"."ebd_entradas" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "fornecedor" character varying(255),
  "num_nf" character varying(100),
  "data_entrada" date not null,
  "valor_total" numeric(10,2) default 0 not null,
  "observacao" text,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "created_by" uuid,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."ebd_entrega_itens" (
  "id" uuid default gen_random_uuid() not null,
  "entrega_id" uuid not null,
  "produto_id" uuid not null,
  "quantidade" integer not null,
  "valor_unit" numeric(10,2) not null,
  "valor_total" numeric(10,2) not null
);

create table if not exists "public"."ebd_entregas" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "church_id" uuid not null,
  "trimestre_id" uuid,
  "numero_doc" character varying(50),
  "data_entrega" date not null,
  "status" character varying(20) default 'separando'::character varying not null,
  "responsavel_id" uuid,
  "valor_total" numeric(10,2) default 0 not null,
  "saldo_anterior" numeric(10,2) default 0 not null,
  "novo_saldo" numeric(10,2) default 0 not null,
  "observacao" text,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "created_by" uuid,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."ebd_estoque" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "produto_id" uuid not null,
  "quantidade" integer default 0 not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."ebd_estoque_movimentos" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "produto_id" uuid not null,
  "tipo" character varying(20) not null,
  "quantidade" integer not null,
  "valor_unit" numeric(10,2) default 0 not null,
  "referencia" character varying(255),
  "referencia_id" uuid,
  "observacao" text,
  "fornecedor" character varying(255),
  "num_nf" character varying(100),
  "data_movimento" date not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "created_by" uuid
);

create table if not exists "public"."ebd_financeiro" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "church_id" uuid not null,
  "trimestre_id" uuid,
  "entrega_id" uuid,
  "saldo" numeric(10,2) default 0 not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."ebd_financeiro_movimentos" (
  "id" uuid default gen_random_uuid() not null,
  "financeiro_id" uuid not null,
  "campo_id" uuid not null,
  "tipo" character varying(30) not null,
  "valor" numeric(10,2) not null,
  "saldo_antes" numeric(10,2) not null,
  "saldo_depois" numeric(10,2) not null,
  "data" date not null,
  "descricao" character varying(500),
  "responsavel_id" uuid,
  "observacao" text,
  "referencia_id" uuid,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "created_by" uuid
);

create table if not exists "public"."ebd_historico" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "church_id" uuid,
  "tipo" character varying(30) not null,
  "titulo" character varying(255) not null,
  "descricao" text,
  "valor" numeric(10,2),
  "referencia_id" uuid,
  "data" date not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "created_by" uuid
);

create table if not exists "public"."ebd_negociacao_parcelas" (
  "id" uuid default gen_random_uuid() not null,
  "negociacao_id" uuid not null,
  "num_parcela" integer not null,
  "valor" numeric(10,2) not null,
  "data_vencimento" date not null,
  "data_pagamento" date,
  "status" character varying(20) default 'pendente'::character varying not null,
  "observacao" text,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."ebd_negociacoes" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "church_id" uuid not null,
  "titulo" character varying(255) not null,
  "descricao" text,
  "valor_total" numeric(10,2) not null,
  "num_parcelas" integer default 1 not null,
  "data_inicio" date not null,
  "data_vencimento" date,
  "status" character varying(20) default 'aberta'::character varying not null,
  "observacao" text,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "created_by" uuid,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."ebd_produtos" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "categoria_id" uuid not null,
  "trimestre_id" uuid,
  "codigo" character varying(50),
  "nome" character varying(255) not null,
  "tipo" character varying(30) not null,
  "tema" character varying(255),
  "descricao" text,
  "unidade" character varying(20) default 'un'::character varying not null,
  "preco_custo" numeric(10,2) default 0 not null,
  "preco_venda" numeric(10,2) default 0 not null,
  "ativo" boolean default true not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "created_by" uuid,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."ebd_trimestres" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "nome" character varying(100) not null,
  "ano" integer not null,
  "data_inicio" date not null,
  "data_fim" date not null,
  "ativo" boolean default true not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "created_by" uuid,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."ecclesiastical_titles" (
  "id" uuid default gen_random_uuid() not null,
  "name" character varying(120) not null,
  "abbreviation" character varying(30),
  "level" integer default 0 not null,
  "grouping" character varying(120),
  "prerequisite_level" integer,
  "minimum_age" integer,
  "maximum_age" integer,
  "prerequisite_occurrence" text,
  "is_active" boolean default true not null,
  "is_fixed" boolean default false not null,
  "is_ecclesiastical_minister" boolean default false not null,
  "allow_men" boolean default true not null,
  "allow_women" boolean default true not null,
  "profile" character varying(120),
  "display_order" integer default 0 not null,
  "consecration_type_key" character varying(50),
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."event_attendance" (
  "id" uuid not null,
  "event_id" uuid not null,
  "member_id" uuid not null,
  "present" boolean default true not null,
  "checkin_datetime" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "checkin_method" character varying(20),
  "notes" text,
  "created_by" uuid,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "campo_id" uuid
);

create table if not exists "public"."event_departments" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "nome" character varying(255) not null,
  "descricao" text,
  "icone" character varying(50),
  "cor" character varying(7) default '#8b5cf6'::character varying,
  "slug" character varying(100),
  "ordem" smallint default 0,
  "ativo" boolean default true,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "campo_id" uuid
);

create table if not exists "public"."event_notifications" (
  "id" uuid default gen_random_uuid() not null,
  "event_id" uuid not null,
  "user_id" uuid not null,
  "order_id" uuid,
  "qrcode_id" uuid,
  "tipo" text not null,
  "titulo" text not null,
  "mensagem" text,
  "aceita" boolean,
  "respondida_em" timestamp with time zone,
  "lida" boolean default false not null,
  "lida_em" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "campo_id" uuid
);

create table if not exists "public"."event_order_items" (
  "id" uuid default gen_random_uuid() not null,
  "order_id" uuid not null,
  "event_id" uuid not null,
  "seat_id" uuid,
  "sector_id" uuid,
  "qty" smallint default 1 not null,
  "unit_price" numeric(10,2) default 0 not null,
  "subtotal" numeric(10,2) default 0 not null,
  "status" character varying(20) default 'ATIVO'::character varying not null,
  "created_at" timestamp with time zone default now() not null,
  "sector_nome" text,
  "row_nome" text,
  "seat_numero" integer,
  "campo_id" uuid
);

create table if not exists "public"."event_orders" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "event_id" uuid not null,
  "numero_pedido" text,
  "buyer_name" text,
  "buyer_email" text,
  "buyer_phone" text,
  "subtotal" numeric(10,2) default 0 not null,
  "desconto" numeric(10,2) default 0 not null,
  "total" numeric(10,2) default 0 not null,
  "payment_method" text,
  "payment_ref" text,
  "payment_attempts" integer default 0 not null,
  "status" character varying(30) default 'AGUARDANDO_PAGAMENTO'::character varying not null,
  "notas" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "cancelled_at" timestamp with time zone,
  "campo_id" uuid
);

create table if not exists "public"."event_participants" (
  "id" uuid default gen_random_uuid() not null,
  "event_id" uuid not null,
  "nome" character varying(255) not null,
  "papel" character varying(100),
  "foto_url" text,
  "ordem" smallint default 0,
  "created_at" timestamp with time zone default now(),
  "campo_id" uuid
);

create table if not exists "public"."event_qrcodes" (
  "id" uuid default gen_random_uuid() not null,
  "order_id" uuid not null,
  "order_item_id" uuid,
  "event_id" uuid not null,
  "user_id" uuid not null,
  "seat_id" uuid,
  "ticket_code" text not null,
  "qr_data" text,
  "is_used" boolean default false not null,
  "used_at" timestamp with time zone,
  "checked_in_by" uuid,
  "is_cancelled" boolean default false not null,
  "cancelled_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "campo_id" uuid
);

create table if not exists "public"."event_refunds" (
  "id" uuid default gen_random_uuid() not null,
  "order_id" uuid not null,
  "event_id" uuid not null,
  "user_id" uuid not null,
  "motivo" text,
  "valor_solicitado" numeric(10,2) default 0 not null,
  "status" character varying(20) default 'SOLICITADO'::character varying not null,
  "notas_admin" text,
  "processed_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "processed_at" timestamp with time zone,
  "campo_id" uuid
);

create table if not exists "public"."event_registrations" (
  "id" uuid not null,
  "event_id" uuid not null,
  "member_id" uuid,
  "full_name" character varying(255) not null,
  "email" character varying(255),
  "phone" character varying(20),
  "registration_date" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "status" character varying(20) default 'confirmed'::character varying,
  "payment_status" character varying(20),
  "payment_amount" numeric(10,2),
  "payment_date" timestamp(3) without time zone,
  "checked_in" boolean default false not null,
  "checkin_datetime" timestamp(3) without time zone,
  "checkin_by" uuid,
  "additional_data" jsonb,
  "notes" text,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "campo_id" uuid
);

create table if not exists "public"."event_rows" (
  "id" uuid default gen_random_uuid() not null,
  "event_id" uuid not null,
  "sector_id" uuid not null,
  "nome" text not null,
  "ordem" smallint default 0,
  "created_at" timestamp with time zone default now(),
  "campo_id" uuid
);

create table if not exists "public"."event_seats" (
  "id" uuid default gen_random_uuid() not null,
  "event_id" uuid not null,
  "sector_id" uuid not null,
  "row_id" uuid,
  "numero" smallint not null,
  "status" character varying(20) default 'LIVRE'::character varying,
  "reservado_por" uuid,
  "reservado_em" timestamp with time zone,
  "reserva_expira" timestamp with time zone,
  "order_item_id" uuid,
  "created_at" timestamp with time zone default now(),
  "campo_id" uuid
);

create table if not exists "public"."event_sectors" (
  "id" uuid default gen_random_uuid() not null,
  "event_id" uuid not null,
  "nome" text not null,
  "andar" integer default 1,
  "rows_count" integer default 0,
  "seats_per_row" integer default 0,
  "quantidade" integer default 0,
  "preco" numeric(10,2) default 0,
  "cor_hex" character varying(7) default '#8b5cf6'::character varying,
  "ordem" smallint default 0,
  "created_at" timestamp with time zone default now(),
  "campo_id" uuid
);

create table if not exists "public"."event_ticket_transfer" (
  "id" uuid default gen_random_uuid() not null,
  "order_id" uuid not null,
  "from_name" text not null,
  "from_member_id" uuid,
  "to_name" text not null,
  "to_member_id" uuid,
  "transferred_by" text,
  "transferred_by_id" uuid,
  "created_at" timestamp with time zone default now() not null,
  "campo_id" uuid
);

create table if not exists "public"."events" (
  "id" uuid not null,
  "church_id" uuid not null,
  "title" character varying(255) not null,
  "description" text,
  "event_type" character varying(30),
  "start_datetime" timestamp(3) without time zone not null,
  "end_datetime" timestamp(3) without time zone not null,
  "all_day" boolean default false not null,
  "timezone" character varying(50) default 'America/Sao_Paulo'::character varying,
  "location_type" character varying(20) default 'physical'::character varying,
  "location_name" character varying(255),
  "location_address" text,
  "location_url" character varying(500),
  "max_capacity" integer,
  "requires_registration" boolean default false not null,
  "registration_deadline" timestamp(3) without time zone,
  "is_paid" boolean default false not null,
  "ticket_price" numeric(10,2),
  "banner_url" character varying(500),
  "color" character varying(7) default '#8b5cf6'::character varying,
  "status" character varying(20) default 'scheduled'::character varying,
  "is_public" boolean default true not null,
  "organizer_id" uuid,
  "is_recurring" boolean default false not null,
  "recurrence_pattern" jsonb,
  "recurrence_parent_id" uuid,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "created_by" uuid,
  "updated_by" uuid,
  "deleted_at" timestamp(3) without time zone,
  "headquarters_id" uuid,
  "regional_id" uuid,
  "campo_id" uuid
);

create table if not exists "public"."face_detections" (
  "id" uuid not null,
  "session_id" uuid not null,
  "camera_id" uuid not null,
  "detected_at" timestamp with time zone not null,
  "face_image_url" character varying(500),
  "embedding_json" text,
  "matched_member_id" uuid,
  "confidence" double precision not null,
  "review_status" character varying(50) not null,
  "created_at" timestamp with time zone default '2026-06-16 01:24:59.472137+00'::timestamp with time zone not null
);

create table if not exists "public"."face_enrollment_jobs" (
  "id" uuid default gen_random_uuid() not null,
  "batch_id" uuid not null,
  "church_id" uuid not null,
  "device_id" uuid not null,
  "member_id" uuid not null,
  "rol" integer not null,
  "nome" character varying(255) not null,
  "cpf" character varying(20),
  "photo_url" text not null,
  "status" character varying(20) default 'pending'::character varying not null,
  "allow_update" boolean default false not null,
  "error_code" integer,
  "error_message" text,
  "match_user_id" integer,
  "attempts" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "processed_at" timestamp with time zone
);

create table if not exists "public"."face_enrollment_signals" (
  "id" uuid default gen_random_uuid() not null,
  "job_id" uuid not null,
  "device_id" uuid not null,
  "church_id" uuid not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."face_presencas" (
  "id" uuid default gen_random_uuid() not null,
  "rol" integer,
  "nome" character varying(255) not null,
  "cargo" character varying(100),
  "horario" timestamp with time zone not null,
  "confianca" double precision,
  "camera" character varying(100),
  "igreja_regional" character varying(255),
  "data_registro" timestamp with time zone default now() not null,
  "campo" character varying(255),
  "church_id" uuid
);

create table if not exists "public"."faceid_agents" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "token" character varying(100) not null,
  "name" character varying(255),
  "last_seen_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."faceid_devices" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid,
  "serial" character varying(100) not null,
  "name" character varying(255) not null,
  "username" character varying(100),
  "password" character varying(255),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "local_host" character varying(100),
  "local_port" integer default 80,
  "agent_token" character varying(100),
  "is_active" boolean default true not null,
  "last_seen_at" timestamp with time zone,
  "device_uid" character varying(50),
  "model" character varying(100),
  "firmware" character varying(50),
  "mac" character varying(50),
  "auto_provisioned" boolean default false not null,
  "agent_id" uuid,
  "is_sede" boolean default true not null,
  "secondary_church_id" uuid
);

create table if not exists "public"."feed_post_comments" (
  "id" uuid default gen_random_uuid() not null,
  "post_id" uuid not null,
  "user_id" text not null,
  "author_name" text default 'Usuário'::text not null,
  "content" text not null,
  "created_at" timestamp with time zone default now() not null,
  "campo_id" uuid
);

create table if not exists "public"."feed_post_likes" (
  "id" uuid default gen_random_uuid() not null,
  "post_id" uuid not null,
  "user_id" text not null,
  "created_at" timestamp with time zone default now() not null,
  "campo_id" uuid
);

create table if not exists "public"."feed_posts" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "church_id" uuid,
  "title" text,
  "content" text not null,
  "media_url" text,
  "media_type" text,
  "author_name" text default 'Igreja'::text not null,
  "author_avatar_url" text,
  "author_verified" boolean default false not null,
  "location" text,
  "likes_count" integer default 0 not null,
  "comments_count" integer default 0 not null,
  "is_published" boolean default false not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."feed_stories" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "church_id" uuid,
  "title" text not null,
  "media_url" text not null,
  "media_type" text default 'image'::text not null,
  "author_name" text default 'Igreja'::text not null,
  "author_avatar_url" text,
  "expires_at" timestamp with time zone default (now() + '24:00:00'::interval) not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."field" (
  "legacy_id" bigint generated by default as identity not null,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "state" character varying(255),
  "name" character varying(255),
  "president" character varying(255),
  "headquarters_name" character varying(255),
  "password" character varying(255) default ''::character varying,
  "id" uuid default gen_random_uuid() not null
);

create table if not exists "public"."financial_accounts" (
  "id" uuid not null,
  "church_id" uuid not null,
  "name" character varying(255) not null,
  "account_type" character varying(30) not null,
  "bank_name" character varying(255),
  "bank_code" character varying(10),
  "agency" character varying(20),
  "account_number" character varying(30),
  "initial_balance" numeric(15,2) default 0,
  "current_balance" numeric(15,2) default 0,
  "is_active" boolean default true not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."financial_categories" (
  "id" uuid not null,
  "church_id" uuid not null,
  "parent_id" uuid,
  "name" character varying(255) not null,
  "type" character varying(20) not null,
  "color" character varying(7) default '#8b5cf6'::character varying,
  "icon" character varying(50),
  "budget_amount" numeric(15,2),
  "is_active" boolean default true not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."forma_pagamento" (
  "id" uuid default gen_random_uuid() not null,
  "legacy_id" integer,
  "nome" character varying(100) not null,
  "mostrar" boolean default true not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."headquarters" (
  "legacy_id" bigint generated by default as identity not null,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "instagram" character varying(255),
  "site" character varying(255),
  "youtube" character varying(255),
  "tiktok" character varying(255),
  "facebook" character varying(255),
  "contact" character varying(255),
  "street" character varying(255),
  "number" character varying(255),
  "city" character varying(255),
  "state" character varying(255),
  "country" character varying(255),
  "neighborhood" character varying(255),
  "show" boolean,
  "cnpj" character varying(255),
  "payment_token_one" character varying(255),
  "payment_token_two" character varying(255),
  "region_name" character varying(255),
  "field_name" character varying(255),
  "name" character varying(255),
  "legacy_linked_headquarters_id" bigint,
  "agenda_pdf" character varying(255),
  "pix" character varying(255),
  "bank" character varying(255),
  "id" uuid default gen_random_uuid() not null,
  "linked_headquarters_id" uuid,
  "field_id" uuid,
  "email" character varying(255),
  "whatsapp" character varying(20),
  "zipcode" character varying(10),
  "field_icons" jsonb default '{}'::jsonb not null
);

create table if not exists "public"."help_ai_cache" (
  "id" uuid default gen_random_uuid() not null,
  "cache_key" text not null,
  "question" text not null,
  "question_norm" text not null,
  "scope_hash" text not null,
  "answer" text not null,
  "sources" jsonb default '[]'::jsonb not null,
  "hits" integer default 1 not null,
  "created_at" timestamp with time zone default now() not null,
  "last_used_at" timestamp with time zone default now() not null
);

create table if not exists "public"."home_cards" (
  "id" uuid default gen_random_uuid() not null,
  "config_id" uuid not null,
  "key" character varying(60) not null,
  "action" character varying(20) default 'link'::character varying not null,
  "title" character varying(160) not null,
  "subtitle" text,
  "url" character varying(500),
  "icon" character varying(40) default 'Circle'::character varying not null,
  "icon_color" character varying(7),
  "hover_color" character varying(7),
  "visible" boolean default true not null,
  "pulse" boolean default false not null,
  "live_dot" boolean default false not null,
  "full_width" boolean default false not null,
  "sort_order" integer default 0 not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."home_configs" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "site_title" character varying(120),
  "site_description" character varying(300),
  "favicon_url" character varying(500),
  "logo_url" character varying(500),
  "watermark_url" character varying(500),
  "pwa_name" character varying(120),
  "pwa_short_name" character varying(60),
  "pwa_icon_192" character varying(500),
  "pwa_icon_512" character varying(500),
  "pwa_icon_maskable" character varying(500),
  "hero_eyebrow" character varying(120),
  "hero_title" character varying(120),
  "hero_text" text,
  "verse_ref" character varying(80),
  "verse_label" character varying(40),
  "verse_text" text,
  "show_verse" boolean default true not null,
  "bg_dark" character varying(7) default '#0a0a0a'::character varying not null,
  "bg_light" character varying(7) default '#f5f4f0'::character varying not null,
  "accent_color" character varying(7) default '#d4af37'::character varying not null,
  "default_dark" boolean default true not null,
  "show_symbols" boolean default true not null,
  "show_spotlights" boolean default true not null,
  "watermark_opacity" numeric(4,3) default 0.05 not null,
  "symbol_colors" jsonb,
  "services_config" jsonb,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."horario_culto" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid,
  "church_id" uuid,
  "codigo" character varying(60) not null,
  "nome" character varying(120) not null,
  "hora_inicio" character varying(5),
  "descricao" text,
  "ordem" integer default 0 not null,
  "ativo" boolean default true not null,
  "is_default" boolean default false not null,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "deleted_at" timestamp with time zone,
  "hora_fim" character varying(5)
);

create table if not exists "public"."inbox_attachments" (
  "id" uuid default gen_random_uuid() not null,
  "message_id" uuid,
  "name" character varying(255),
  "url" text,
  "size" integer,
  "type" character varying(100)
);

create table if not exists "public"."inbox_message_attachments" (
  "id" uuid default gen_random_uuid() not null,
  "message_id" uuid,
  "file_name" character varying(255),
  "file_url" character varying(500),
  "file_size" integer,
  "mime_type" character varying(100),
  "created_at" timestamp without time zone default now()
);

create table if not exists "public"."inbox_message_recipients" (
  "id" uuid default gen_random_uuid() not null,
  "message_id" uuid,
  "user_id" uuid,
  "recipient_type" character varying(10) default 'TO'::character varying,
  "is_read" boolean default false,
  "is_starred" boolean default false,
  "is_deleted" boolean default false,
  "read_at" timestamp without time zone
);

create table if not exists "public"."inbox_messages" (
  "id" uuid default gen_random_uuid() not null,
  "sender_id" uuid,
  "campo_id" uuid,
  "subject" character varying(255),
  "body" text,
  "is_draft" boolean default false,
  "created_at" timestamp without time zone default now(),
  "updated_at" timestamp without time zone default now(),
  "deleted_at" timestamp without time zone,
  "thread_id" uuid
);

create table if not exists "public"."inbox_recipients" (
  "id" uuid default gen_random_uuid() not null,
  "message_id" uuid,
  "user_id" uuid,
  "recipient_type" character varying(10) default 'TO'::character varying,
  "is_read" boolean default false,
  "is_starred" boolean default false,
  "is_archived" boolean default false,
  "is_deleted" boolean default false,
  "read_at" timestamp without time zone,
  "deleted_at" timestamp without time zone,
  "is_important" boolean default false
);

create table if not exists "public"."internal_chat_messages" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "user_id" uuid not null,
  "user_name" character varying(255) not null,
  "user_role" character varying(255),
  "body" text,
  "file_url" text,
  "file_name" character varying(255),
  "file_type" character varying(50),
  "file_size" integer,
  "created_at" timestamp without time zone default now() not null,
  "deleted_at" timestamp without time zone,
  "parent_id" uuid,
  "parent_name" character varying(255),
  "parent_body" text,
  "reactions" jsonb default '{}'::jsonb,
  "receiver_id" uuid
);

create table if not exists "public"."kan_cards" (
  "id" uuid default gen_random_uuid() not null,
  "protocol" character varying(60) not null,
  "stage_id" integer not null,
  "service_id" integer not null,
  "column_id" integer,
  "column_index" integer default 1 not null,
  "church_id" uuid not null,
  "member_id" uuid,
  "candidate_name" character varying(255),
  "status" character varying(60) default 'pendente'::character varying not null,
  "status_label" character varying(120),
  "destination_church_id" uuid,
  "current_title" character varying(60),
  "intended_title" character varying(60),
  "justification" text,
  "metadata" jsonb,
  "attachments" jsonb,
  "opened_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "closed_at" timestamp(3) without time zone,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "created_by" uuid,
  "updated_by" uuid,
  "deleted_at" timestamp(3) without time zone,
  "origin_regional_id" uuid,
  "destination_regional_id" uuid,
  "requester_church_id" uuid,
  "requested_church_id" uuid,
  "requester_name" character varying(255),
  "subject" character varying(255),
  "observations" text,
  "description" text,
  "approved_by" uuid,
  "approved_at" timestamp with time zone
);

create table if not exists "public"."kan_columns" (
  "id" integer default nextval('kan_columns_id_seq'::regclass) not null,
  "stage_id" integer not null,
  "name" character varying(120) not null,
  "column_index" integer not null,
  "color" character varying(20) default 'blue'::character varying,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."kan_matrix_rules" (
  "id" integer default nextval('kan_matrix_rules_id_seq'::regclass) not null,
  "service_id" integer not null,
  "column_index" integer not null,
  "age_min" integer default 0 not null,
  "age_max" integer default 0 not null,
  "is_active" boolean default true not null,
  "change_status" boolean default false not null,
  "new_status" character varying(60),
  "change_title" boolean default false not null,
  "new_title" character varying(60),
  "does_transfer" boolean default false not null,
  "insert_occurrence" boolean default true not null,
  "occurrence_name" character varying(120),
  "message" character varying(255),
  "allow_message" boolean default false not null,
  "allow_doc_model" boolean default false not null,
  "doc_model" character varying(120),
  "allow_attachments" boolean default false not null,
  "require_document" boolean default false not null,
  "generates_credential" boolean default false not null,
  "credential_kind" character varying(60),
  "credential_model" character varying(60),
  "credential_validity" character varying(60),
  "servico_extra" character varying(60),
  "description" character varying(255),
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "stage_id" integer,
  "restore_previous_title" boolean default false not null
);

create table if not exists "public"."kan_pipelines" (
  "id" integer default nextval('kan_pipelines_id_seq'::regclass) not null,
  "name" character varying(120) not null,
  "type" character varying(120),
  "hash" character varying(60),
  "campo" character varying(120),
  "is_active" boolean default true not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."kan_services" (
  "id" integer not null,
  "sigla" character varying(50) not null,
  "description" character varying(255) not null,
  "servico" character varying(120),
  "uses_matrix" boolean default false not null,
  "is_active" boolean default true not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "service_group" character varying(60)
);

create table if not exists "public"."kan_stages" (
  "id" integer default nextval('kan_stages_id_seq'::regclass) not null,
  "pipeline_id" integer not null,
  "service_id" integer,
  "name" character varying(120) not null,
  "description" character varying(255),
  "author" character varying(120),
  "campo" character varying(120),
  "hash" character varying(60),
  "show" boolean default true not null,
  "is_active" boolean default true not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."lead_activities" (
  "id" uuid not null,
  "lead_id" uuid not null,
  "activity_type" character varying(30) not null,
  "subject" character varying(255),
  "description" text,
  "activity_date" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "scheduled_for" timestamp(3) without time zone,
  "completed" boolean default false not null,
  "completed_at" timestamp(3) without time zone,
  "created_by" uuid,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."leads" (
  "id" uuid not null,
  "church_id" uuid not null,
  "member_id" uuid,
  "full_name" character varying(255) not null,
  "email" character varying(255),
  "phone" character varying(20),
  "source" character varying(50),
  "source_details" text,
  "stage" character varying(30) default 'new'::character varying,
  "temperature" character varying(20) default 'cold'::character varying,
  "assigned_to" uuid,
  "assigned_at" timestamp(3) without time zone,
  "first_visit_date" date,
  "last_contact_date" date,
  "conversion_date" date,
  "interests" jsonb,
  "notes" text,
  "search_vector" tsvector,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "created_by" uuid,
  "updated_by" uuid,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."livro_caixa" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "data_lancamento" date not null,
  "referencia" text,
  "valor" numeric(15,2) not null,
  "tipo" character varying(20) not null,
  "forma_pg" text,
  "plano_de_conta" text,
  "categoria" text,
  "centro_de_custo" text,
  "num_lancamento" text,
  "num_doc" text,
  "tipo_documento" text,
  "tipo_pessoa" character varying(20),
  "favorecido" character varying(255),
  "member_id" uuid,
  "id_favorecido_externo" character varying(100),
  "operador" character varying(255),
  "operador_id" uuid,
  "igreja_operador" character varying(255),
  "regional" text,
  "campo" text,
  "hash" character varying(255),
  "obs" text,
  "foto" character varying(500),
  "identificador" text,
  "conta_caixa" text,
  "situacao" boolean default true not null,
  "deletado_por" character varying(255),
  "deleted_at" timestamp(3) without time zone,
  "legacy_id" bigint,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "created_by" uuid,
  "updated_by" uuid,
  "banco_id" uuid,
  "departamento_id" uuid
);

create table if not exists "public"."livro_caixa_baixa_importacao_backup" (
  "id" uuid not null,
  "deleted_at" timestamp without time zone,
  "situacao" boolean,
  "registrado_em" timestamp without time zone default now() not null
);

create table if not exists "public"."manual_reviews" (
  "id" uuid not null,
  "session_id" uuid not null,
  "face_detection_id" uuid,
  "face_image_url" character varying(500),
  "suggested_member_id" uuid,
  "confirmed_member_id" uuid,
  "decision" character varying(50),
  "confidence" double precision not null,
  "notes" text,
  "reviewed_by" uuid,
  "created_at" timestamp with time zone default '2026-06-16 01:24:59.472137+00'::timestamp with time zone not null,
  "reviewed_at" timestamp with time zone
);

create table if not exists "public"."member_event_history" (
  "id" uuid default gen_random_uuid() not null,
  "member_id" uuid,
  "card_id" uuid,
  "church_id" uuid not null,
  "service_group" character varying(60),
  "service_name" character varying(255),
  "column_index" integer,
  "action" character varying(120),
  "notes" text,
  "metadata" jsonb,
  "created_by" uuid,
  "created_at" timestamp with time zone default now(),
  "member_city" character varying(100),
  "member_country" character varying(100),
  "member_state" character varying(50)
);

create table if not exists "public"."member_face_embeddings" (
  "id" uuid not null,
  "member_id" uuid not null,
  "embedding_json" text not null,
  "model_name" character varying(100) not null,
  "source_photo_url" character varying(500),
  "quality_score" double precision,
  "active" boolean not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."member_family_relationships" (
  "id" uuid not null,
  "member_id" uuid not null,
  "related_member_id" uuid,
  "relationship_type" character varying(30) not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "related_name" character varying(255),
  "related_birth_date" date,
  "related_gender" character varying(20),
  "notes" text,
  "created_by" uuid,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."member_likes" (
  "id" uuid default gen_random_uuid() not null,
  "liker_id" uuid not null,
  "liked_id" uuid not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."member_occurrences" (
  "id" uuid default gen_random_uuid() not null,
  "member_id" uuid,
  "church_id" uuid not null,
  "card_id" uuid,
  "name" character varying(160) not null,
  "message" character varying(255),
  "service_sigla" character varying(50),
  "column_index" integer,
  "metadata" jsonb,
  "occurred_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "created_by" uuid,
  "service_group" character varying(60),
  "action" character varying(120),
  "member_city" character varying(100),
  "member_country" character varying(100),
  "member_state" character varying(50)
);

create table if not exists "public"."member_photos" (
  "id" uuid not null,
  "member_id" uuid not null,
  "photo_url" character varying(500) not null,
  "is_primary" boolean not null,
  "created_at" timestamp without time zone default '2026-06-16 01:24:59.472137'::timestamp without time zone not null
);

create table if not exists "public"."member_previous_churches" (
  "id" uuid default gen_random_uuid() not null,
  "member_id" uuid not null,
  "church_name" character varying(255) not null,
  "ecclesiastical_title" character varying(120),
  "conversion_date" date,
  "baptism_date" date,
  "consecration_date" date,
  "consecration_title" character varying(120),
  "pastor_name" character varying(255),
  "functions" text,
  "notes" text,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "created_by" uuid,
  "updated_by" uuid,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."member_tag_assignments" (
  "member_id" uuid not null,
  "tag_id" uuid not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."member_tags" (
  "id" uuid not null,
  "church_id" uuid not null,
  "name" character varying(100) not null,
  "color" character varying(7) default '#8b5cf6'::character varying,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "cell_group_id" uuid
);

create table if not exists "public"."member_title_history" (
  "id" uuid default gen_random_uuid() not null,
  "member_id" uuid not null,
  "church_id" uuid not null,
  "card_id" uuid,
  "previous_title" character varying(120),
  "new_title" character varying(120) not null,
  "source" character varying(60),
  "service_group" character varying(60),
  "service_name" character varying(255),
  "member_city" character varying(100),
  "member_country" character varying(100),
  "notes" text,
  "created_by" uuid,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "member_state" character varying(50)
);

create table if not exists "public"."members" (
  "id" uuid not null,
  "church_id" uuid not null,
  "user_id" uuid,
  "full_name" character varying(255) not null,
  "preferred_name" character varying(100),
  "photo_url" character varying(500),
  "cpf" character varying(14),
  "rg" character varying(20),
  "birth_date" date,
  "gender" character varying(20),
  "marital_status" character varying(20),
  "email" character varying(255),
  "phone" character varying(20),
  "mobile" character varying(20),
  "address_street" character varying(255),
  "address_number" character varying(20),
  "address_complement" character varying(100),
  "address_neighborhood" character varying(100),
  "address_city" character varying(100),
  "address_state" character varying(50),
  "address_zipcode" character varying(10),
  "membership_status" character varying(30) default 'AGUARDANDO ATIVACAO'::character varying,
  "membership_date" date default CURRENT_DATE,
  "baptism_status" character varying(20),
  "baptism_date" date,
  "father_name" character varying(255),
  "mother_name" character varying(255),
  "spouse_id" uuid,
  "occupation" character varying(255),
  "company" character varying(255),
  "notes" text,
  "emergency_contact_name" character varying(255),
  "emergency_contact_phone" character varying(20),
  "search_vector" tsvector,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "created_by" uuid,
  "updated_by" uuid,
  "deleted_at" timestamp(3) without time zone,
  "ecclesiastical_title" character varying(120) default 'CONGREGADO'::character varying,
  "regional_id" uuid,
  "spouse_name" character varying(255),
  "naturality_city" character varying(100),
  "naturality_state" character varying(2),
  "nationality" character varying(100),
  "voter_registration" character varying(20),
  "voter_zone" character varying(10),
  "voter_section" character varying(10),
  "ecclesiastical_title_id" uuid,
  "rol" integer generated by default as identity not null,
  "cover_photo_url" text,
  "member_type" character varying(20) default 'MEMBRO'::character varying,
  "cnpj" character varying(18),
  "campo_id" uuid,
  "fantasy_name" character varying(255),
  "longitude" numeric(11,8),
  "latitude" numeric(10,8)
);

create table if not exists "public"."messages" (
  "id" uuid not null,
  "church_id" uuid not null,
  "campaign_id" uuid,
  "recipient_type" character varying(20),
  "recipient_id" uuid,
  "recipient_name" character varying(255),
  "recipient_email" character varying(255),
  "recipient_phone" character varying(20),
  "message_type" character varying(30) not null,
  "subject" character varying(255),
  "body" text,
  "status" character varying(20) default 'pending'::character varying,
  "sent_at" timestamp(3) without time zone,
  "delivered_at" timestamp(3) without time zone,
  "opened_at" timestamp(3) without time zone,
  "clicked_at" timestamp(3) without time zone,
  "failed_at" timestamp(3) without time zone,
  "error_message" text,
  "external_id" character varying(255),
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."ministries" (
  "id" uuid not null,
  "church_id" uuid not null,
  "parent_ministry_id" uuid,
  "name" character varying(255) not null,
  "description" text,
  "leader_id" uuid,
  "email" character varying(255),
  "phone" character varying(20),
  "color" character varying(7) default '#8b5cf6'::character varying,
  "icon" character varying(50),
  "is_active" boolean default true not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "deleted_at" timestamp(3) without time zone,
  "campo_id" uuid,
  "slug" text,
  "ordem" integer default 0 not null
);

create table if not exists "public"."ministry_members" (
  "id" uuid not null,
  "ministry_id" uuid not null,
  "member_id" uuid not null,
  "role" character varying(100),
  "joined_at" date not null,
  "left_at" date,
  "is_active" boolean default true not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "campo_id" uuid
);

create table if not exists "public"."naturezas_despesa" (
  "id" uuid default gen_random_uuid() not null,
  "codigo" character varying(30) not null,
  "nome" character varying(100) not null,
  "descricao" text,
  "ordem" integer default 0 not null,
  "ativo" boolean default true not null,
  "is_default" boolean default false not null,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp with time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."new_member_requests" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "whatsapp" text not null,
  "is_married" boolean default false,
  "past_churches" text,
  "afro_background" boolean default false,
  "scheduled_date" date,
  "pipeline_card_id" text,
  "status" text default 'pending'::text,
  "created_at" timestamp(6) with time zone default CURRENT_TIMESTAMP,
  "updated_at" timestamp(6) with time zone default CURRENT_TIMESTAMP,
  "church_id" uuid,
  "form_token" text,
  "form_sent_at" timestamp with time zone,
  "form_submitted_at" timestamp with time zone,
  "form_data" jsonb,
  "documents" jsonb default '[]'::jsonb,
  "review_notes" text,
  "reviewed_by" text,
  "reviewed_at" timestamp with time zone,
  "created_member_id" uuid,
  "member_rol" integer,
  "target_church_id" uuid,
  "desired_church_id" uuid
);

create table if not exists "public"."notification_acks" (
  "id" uuid default gen_random_uuid() not null,
  "notification_id" uuid not null,
  "user_id" uuid not null,
  "batch_id" character varying(255),
  "ack_type" character varying(20) not null,
  "acked_at" timestamp with time zone default now() not null
);

create table if not exists "public"."notifications" (
  "id" uuid not null,
  "user_id" uuid not null,
  "notification_type" character varying(50) not null,
  "title" character varying(255) not null,
  "message" text,
  "action_url" character varying(500),
  "action_text" character varying(100),
  "data" jsonb,
  "read" boolean default false not null,
  "read_at" timestamp(3) without time zone,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "image_url" character varying(1000),
  "file_url" character varying(1000),
  "file_name" character varying(255),
  "archived" boolean default false not null,
  "archived_at" timestamp with time zone
);

create table if not exists "public"."offerings" (
  "id" uuid not null,
  "church_id" uuid not null,
  "transaction_id" uuid,
  "member_id" uuid,
  "offering_type" character varying(30) not null,
  "amount" numeric(15,2) not null,
  "offering_date" date not null,
  "payment_method" character varying(30),
  "reference_number" character varying(100),
  "notes" text,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "created_by" uuid
);

create table if not exists "public"."order_items" (
  "id" uuid default gen_random_uuid() not null,
  "order_id" uuid not null,
  "event_id" uuid,
  "seat_id" uuid,
  "sector_id" uuid,
  "qty" integer default 1,
  "unit_price" numeric(10,2) default 0,
  "subtotal" numeric(10,2) default 0,
  "seat_label" text,
  "status" text default 'ATIVO'::text,
  "cancelled_at" timestamp with time zone,
  "campo_id" uuid
);

create table if not exists "public"."order_qrcodes" (
  "id" uuid default gen_random_uuid() not null,
  "order_id" uuid not null,
  "order_item_id" uuid,
  "event_id" uuid,
  "user_id" uuid not null,
  "seat_id" uuid,
  "ticket_code" text not null,
  "qr_payload" text,
  "is_used" boolean default false,
  "is_cancelled" boolean default false,
  "issued_at" timestamp with time zone default now(),
  "cancelled_at" timestamp with time zone,
  "used_at" timestamp with time zone,
  "campo_id" uuid
);

create table if not exists "public"."order_status_history" (
  "id" uuid default gen_random_uuid() not null,
  "order_id" uuid not null,
  "old_status" text,
  "new_status" text not null,
  "reason" text,
  "created_by" uuid,
  "created_at" timestamp with time zone default now(),
  "campo_id" uuid
);

create table if not exists "public"."orders" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "event_id" uuid,
  "order_number" text not null,
  "buyer_name" text,
  "buyer_email" text,
  "buyer_phone" text,
  "total" numeric(10,2) default 0,
  "payment_method" text default 'pix'::text,
  "payment_ref" text,
  "payment_attempts" integer default 0,
  "status" text default 'PENDING_PAYMENT'::text,
  "notes" text,
  "refund_reason" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "campo_id" uuid
);

create table if not exists "public"."pagamentos_parcela" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "parcela_id" uuid not null,
  "valor_pago" numeric(15,2) not null,
  "data_pagamento" date not null,
  "forma_pagamento" character varying(30),
  "banco_id" uuid,
  "comprovante_url" character varying(500),
  "observacao" text,
  "livro_caixa_id" uuid,
  "registrado_por" uuid,
  "estornado_em" timestamp with time zone,
  "estornado_por" uuid,
  "motivo_estorno" text,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."pages" (
  "id" uuid not null,
  "church_id" uuid not null,
  "title" character varying(255) not null,
  "slug" character varying(255) not null,
  "content" text,
  "meta_title" character varying(255),
  "meta_description" text,
  "meta_keywords" text,
  "featured_image_url" character varying(500),
  "status" character varying(20) default 'draft'::character varying,
  "published_at" timestamp(3) without time zone,
  "menu_order" integer default 0 not null,
  "parent_page_id" uuid,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "created_by" uuid,
  "updated_by" uuid,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."parcelas_contas_pagar" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "conta_pagar_id" uuid not null,
  "numero_parcela" integer not null,
  "total_parcelas" integer default 1 not null,
  "valor_parcela" numeric(15,2) not null,
  "valor_pago" numeric(15,2) default 0 not null,
  "valor_saldo" numeric(15,2) default 0 not null,
  "data_vencimento" date not null,
  "status" character varying(20) default 'PENDENTE'::character varying not null,
  "observacao" text,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp with time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."pastoral_attendance_activities" (
  "id" uuid default gen_random_uuid() not null,
  "attendance_id" uuid not null,
  "church_id" uuid not null,
  "activity_type" text default 'task'::text not null,
  "title" text not null,
  "description" text,
  "scheduled_date" timestamp with time zone,
  "duration_minutes" integer,
  "responsible_user_id" uuid,
  "meeting_link" text,
  "location" text,
  "completed" boolean default false not null,
  "completed_at" timestamp with time zone,
  "priority" text default 'normal'::text not null,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone
);

create table if not exists "public"."pastoral_attendance_files" (
  "id" uuid default gen_random_uuid() not null,
  "attendance_id" uuid not null,
  "church_id" uuid not null,
  "file_name" text not null,
  "file_url" text not null,
  "file_type" text,
  "file_size" bigint,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone
);

create table if not exists "public"."pastoral_attendance_notes" (
  "id" uuid default gen_random_uuid() not null,
  "attendance_id" uuid not null,
  "church_id" uuid not null,
  "content" text not null,
  "is_pinned" boolean default false not null,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "is_private" boolean default false not null
);

create table if not exists "public"."pastoral_attendance_participants" (
  "id" uuid default gen_random_uuid() not null,
  "attendance_id" uuid not null,
  "church_id" uuid not null,
  "member_id" uuid,
  "user_id" uuid,
  "role" text default 'atendido'::text not null,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."pastoral_attendance_timeline" (
  "id" uuid default gen_random_uuid() not null,
  "attendance_id" uuid not null,
  "church_id" uuid not null,
  "event_type" text not null,
  "description" text not null,
  "metadata" jsonb,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."pastoral_attendances" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "pipeline_id" uuid,
  "column_id" uuid,
  "member_id" uuid,
  "visitor_name" text,
  "phone" text,
  "email" text,
  "attendance_type" text default 'visita_pastoral'::text not null,
  "responsible_user_id" uuid,
  "priority" text default 'normal'::text not null,
  "status" text default 'open'::text not null,
  "title" text,
  "sla_date" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "cancel_reason" text,
  "notes" text,
  "tags" text[] default '{}'::text[] not null,
  "is_starred" boolean default false not null,
  "position" integer default 0 not null,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "person_profile" text
);

create table if not exists "public"."pastoral_audit_logs" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "entity_type" text not null,
  "entity_id" uuid not null,
  "action" text not null,
  "old_data" jsonb,
  "new_data" jsonb,
  "user_id" uuid,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "is_active" boolean default true not null
);

create table if not exists "public"."pastoral_column_types" (
  "id" uuid default gen_random_uuid() not null,
  "column_id" uuid not null,
  "attendance_type" text not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."pastoral_counseling_sessions" (
  "id" uuid default gen_random_uuid() not null,
  "counseling_id" uuid not null,
  "church_id" uuid not null,
  "session_number" integer not null,
  "session_date" timestamp with time zone not null,
  "duration_minutes" integer,
  "notes" text,
  "private_notes" text,
  "emotional_state" text,
  "spiritual_state" text,
  "progress_level" integer,
  "next_steps" text,
  "next_session_at" timestamp with time zone,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "is_active" boolean default true not null
);

create table if not exists "public"."pastoral_counselings" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "member_id" uuid,
  "counselor_id" uuid,
  "title" text not null,
  "counseling_type" text not null,
  "status" text default 'active'::text not null,
  "priority" text default 'normal'::text not null,
  "description" text,
  "current_summary" text,
  "total_sessions" integer default 0 not null,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "next_session_at" timestamp with time zone,
  "is_confidential" boolean default false not null,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "is_active" boolean default true not null
);

create table if not exists "public"."pastoral_journey_enrollments" (
  "id" uuid default gen_random_uuid() not null,
  "journey_id" uuid not null,
  "church_id" uuid not null,
  "attendance_id" uuid,
  "profile" text not null,
  "name" text,
  "phone" text not null,
  "enrolled_at" timestamp with time zone default now() not null,
  "status" text default 'active'::text not null,
  "owner_user_id" text,
  "created_by" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "certificate_issued_at" timestamp with time zone,
  "completed_at" timestamp with time zone
);

create table if not exists "public"."pastoral_journey_instances" (
  "journey_id" uuid not null,
  "instance_id" uuid not null
);

create table if not exists "public"."pastoral_journey_messages" (
  "id" uuid default gen_random_uuid() not null,
  "step_id" uuid not null,
  "profile" text not null,
  "message" text default ''::text not null,
  "image_url" text,
  "link_url" text,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "youtube_url" text,
  "instagram_url" text
);

create table if not exists "public"."pastoral_journey_sends" (
  "id" uuid default gen_random_uuid() not null,
  "enrollment_id" uuid not null,
  "step_id" uuid not null,
  "journey_id" uuid not null,
  "church_id" uuid not null,
  "attendance_id" uuid,
  "profile" text not null,
  "name" text,
  "phone" text not null,
  "message" text not null,
  "link_url" text,
  "image_url" text,
  "scheduled_at" timestamp with time zone not null,
  "status" text default 'pending'::text not null,
  "sent_at" timestamp with time zone,
  "error_message" text,
  "instance_id" uuid,
  "conversation_id" uuid,
  "wa_message_id" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "sequence" integer,
  "total_steps" integer,
  "original_message" text,
  "ai_polished" boolean default false not null,
  "merged_into_send_id" uuid,
  "youtube_url" text,
  "instagram_url" text
);

create table if not exists "public"."pastoral_journey_steps" (
  "id" uuid default gen_random_uuid() not null,
  "journey_id" uuid not null,
  "position" integer default 0 not null,
  "code" text,
  "moment_label" text not null,
  "channel" text default 'WhatsApp'::text not null,
  "program_label" text,
  "week_number" integer default 1 not null,
  "weekday" integer,
  "min_offset_days" integer default 0 not null,
  "send_time" time without time zone default '09:00:00'::time without time zone not null,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."pastoral_journeys" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "name" text not null,
  "description" text,
  "is_active" boolean default true not null,
  "interval_seconds" integer default 15 not null,
  "window_start" time without time zone default '08:00:00'::time without time zone not null,
  "window_end" time without time zone default '20:00:00'::time without time zone not null,
  "daily_limit_per_instance" integer default 0 not null,
  "owner_user_id" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "auto_enroll" boolean default false not null,
  "auto_enroll_column_key" text default 'doing'::text not null,
  "stop_on_done" boolean default true not null,
  "max_per_person_per_day" integer default 1 not null,
  "ai_polish" boolean default false not null,
  "ai_agent_id" uuid,
  "issue_certificate" boolean default true not null,
  "complete_card_on_finish" boolean default true not null,
  "certificate_message" text
);

create table if not exists "public"."pastoral_pipeline_columns" (
  "id" uuid default gen_random_uuid() not null,
  "pipeline_id" uuid not null,
  "church_id" uuid not null,
  "name" text not null,
  "position" integer default 0 not null,
  "color" text default '#6366f1'::text not null,
  "icon" text,
  "fixed_column" boolean default true not null,
  "column_key" text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."pastoral_pipelines" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "name" text default 'Atendimento Pastoral'::text not null,
  "active" boolean default true not null,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."pastoral_tags" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "name" text not null,
  "color" text default '#6366f1'::text not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."pastoral_visit_participants" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "visit_id" uuid not null,
  "user_id" uuid,
  "member_id" uuid,
  "role" text not null,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "is_active" boolean default true not null
);

create table if not exists "public"."pastoral_visit_prayer_points" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "visit_id" uuid not null,
  "description" text not null,
  "is_answered" boolean default false not null,
  "answered_at" timestamp with time zone,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "is_active" boolean default true not null
);

create table if not exists "public"."pastoral_visits" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "member_id" uuid,
  "visitor_member_id" uuid,
  "title" text not null,
  "visit_type" text not null,
  "status" text default 'scheduled'::text not null,
  "priority" text default 'normal'::text not null,
  "scheduled_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "duration_minutes" integer,
  "location_name" text,
  "address" text,
  "reason" text,
  "notes" text,
  "next_steps" text,
  "followup_required" boolean default false not null,
  "followup_date" timestamp with time zone,
  "responsible_id" uuid,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "is_active" boolean default true not null
);

create table if not exists "public"."peniel_configs" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "title" character varying(255) default 'Peniel'::character varying not null,
  "subtitle" character varying(255),
  "description" text,
  "hero_bg_image" character varying(500),
  "primary_color" character varying(7) default '#0b2819'::character varying not null,
  "secondary_color" character varying(7) default '#d4af37'::character varying not null,
  "accent_color" character varying(7) default '#c5a880'::character varying not null,
  "buttons_config" jsonb,
  "hero_cards" jsonb,
  "testimony_videos" jsonb,
  "whatsapp_instance_id" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."peniel_events" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "title" character varying(255) not null,
  "date" date not null,
  "time" character varying(50) not null,
  "location" character varying(255) not null,
  "value" numeric(12,2) not null,
  "limit" integer default 100 not null,
  "status" character varying(20) default 'active'::character varying not null,
  "description" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "date_label" character varying(255),
  "departure_location" character varying(255),
  "event_location" character varying(255),
  "latitude" character varying(50),
  "longitude" character varying(50),
  "extra_fields_config" jsonb default '{}'::jsonb,
  "is_featured" boolean default false not null,
  "payment_link" text
);

create table if not exists "public"."peniel_registrations" (
  "id" uuid default gen_random_uuid() not null,
  "event_id" uuid not null,
  "tipo_participante" character varying(20) not null,
  "nome" character varying(255) not null,
  "endereco" character varying(255) not null,
  "data_nascimento" date not null,
  "estado_civil" character varying(50) not null,
  "idade" integer not null,
  "celular" character varying(20) not null,
  "igreja_base" character varying(255) not null,
  "batizado_aguas" boolean not null,
  "participa_grupo_familiar" boolean not null,
  "grupo_familiar_qual" character varying(255),
  "nome_lider" character varying(255),
  "quem_motivou" character varying(255) not null,
  "porque_decidiu" text not null,
  "expectativas" text not null,
  "peso" numeric(5,2) not null,
  "altura" numeric(3,2) not null,
  "medicamentos" text,
  "alergias_restricoes" text,
  "important_contacts" jsonb not null,
  "status" character varying(20) default 'inscrito'::character varying not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "additional_fields" jsonb default '{}'::jsonb,
  "check_in_code" character varying(20),
  "qr_code_url" text,
  "checked_in" boolean default false not null,
  "checked_in_at" timestamp(3) without time zone,
  "payment_status" character varying(30) default 'pendente'::character varying not null,
  "payment_promise_date" date,
  "payment_proof_url" text,
  "campo_id" uuid
);

create table if not exists "public"."plano_de_contas" (
  "id" uuid default gen_random_uuid() not null,
  "legacy_id" integer,
  "tipo" character varying(10) not null,
  "nome" character varying(255) not null,
  "codigo" character varying(20),
  "ativo" boolean default true not null,
  "considera_dizimo" boolean default false,
  "disponivel_igreja" boolean default true,
  "disponivel_membro" boolean default true,
  "disponivel_pf" boolean default true,
  "disponivel_pj" boolean default true,
  "restringir_perfil" boolean default false,
  "restringir_hierarquia" boolean default false,
  "campo" character varying(100),
  "hash" character varying(100),
  "church_id" uuid,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."prayer_request_comments" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "prayer_request_id" uuid not null,
  "user_id" uuid,
  "comment_text" text not null,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "is_active" boolean default true not null
);

create table if not exists "public"."prayer_request_interactions" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "prayer_request_id" uuid not null,
  "user_id" uuid not null,
  "interaction_type" text not null,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "is_active" boolean default true not null
);

create table if not exists "public"."prayer_requests" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid not null,
  "member_id" uuid,
  "requester_name" text,
  "title" text not null,
  "description" text not null,
  "category" text not null,
  "status" text default 'active'::text not null,
  "priority" text default 'normal'::text not null,
  "visibility" text default 'public'::text not null,
  "is_anonymous" boolean default false not null,
  "prayed_count" integer default 0 not null,
  "comments_count" integer default 0 not null,
  "testimony_text" text,
  "answered_at" timestamp with time zone,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "is_active" boolean default true not null
);

create table if not exists "public"."region" (
  "legacy_id" bigint generated by default as identity not null,
  "name" character varying(255),
  "legacy_headquarters_id" character varying(255),
  "field_name" character varying(255),
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "id" uuid default gen_random_uuid() not null,
  "headquarters_id" uuid,
  "field_id" uuid
);

create table if not exists "public"."regionais" (
  "id" uuid not null,
  "campo_id" uuid not null,
  "name" character varying(255) not null,
  "code" character varying(50) not null,
  "description" text,
  "coordinator_id" uuid,
  "state" character varying(100),
  "city" character varying(100),
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."roles" (
  "id" uuid not null,
  "church_id" uuid,
  "name" character varying(100) not null,
  "description" text,
  "color" character varying(7) default '#8b5cf6'::character varying,
  "permissions" jsonb,
  "is_system" boolean default false not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."santander_accounts" (
  "id" uuid default gen_random_uuid() not null,
  "credential_id" uuid not null,
  "account_id" character varying(100) not null,
  "bank_id" character varying(14) default '90400888000142'::character varying not null,
  "compe_code" character varying(3),
  "branch_code" character varying(5) not null,
  "account_number" character varying(12) not null,
  "account_digit" character varying(1),
  "display_name" character varying(100) not null,
  "igreja_id" integer,
  "ativa" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."santander_conciliacoes" (
  "id" uuid default gen_random_uuid() not null,
  "santander_movimento_id" uuid not null,
  "livro_caixa_id" integer not null,
  "tipo_match" santander_conciliacao_tipo not null,
  "score_match" smallint,
  "status" santander_conciliacao_status default 'ativo'::santander_conciliacao_status not null,
  "observacao" text,
  "conciliado_por" character varying(100) not null,
  "conciliado_em" timestamp with time zone default now() not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."santander_credentials" (
  "id" uuid default gen_random_uuid() not null,
  "empresa_id" character varying(50) not null,
  "campo" character varying(20) not null,
  "apelido" character varying(100) not null,
  "ambiente" character varying(10) not null,
  "client_id" character varying(200) not null,
  "client_secret_encrypted" text not null,
  "client_secret_iv" character varying(64) not null,
  "bank_id" character varying(14) default '90400888000142'::character varying not null,
  "certificate_public_path" text not null,
  "certificate_private_ref" text not null,
  "certificate_expires_at" timestamp with time zone,
  "tolerance_days" smallint default 2 not null,
  "ativo" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "created_by" character varying(100),
  "updated_by" character varying(100)
);

create table if not exists "public"."santander_movimentos" (
  "id" uuid default gen_random_uuid() not null,
  "credential_id" uuid not null,
  "santander_account_id" uuid not null,
  "account_id" character varying(100) not null,
  "transaction_id" character varying(200),
  "transaction_date" date not null,
  "accounting_date" date,
  "amount" numeric(15,2) not null,
  "credit_debit_type" character varying(1) not null,
  "transaction_name" character varying(200),
  "category_code" character varying(3),
  "history_code" character varying(4),
  "history_description" character varying(200),
  "document_number" character varying(50),
  "complement" character varying(200),
  "raw_payload" jsonb,
  "source" santander_movimento_source default 'api'::santander_movimento_source not null,
  "status" santander_movimento_status default 'novo'::santander_movimento_status not null,
  "livro_caixa_id" integer,
  "hash_unico" character varying(64) not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "imported_by" character varying(100)
);

create table if not exists "public"."santander_sync_logs" (
  "id" uuid default gen_random_uuid() not null,
  "credential_id" uuid not null,
  "account_id" character varying(100) not null,
  "data_inicio" date not null,
  "data_fim" date not null,
  "status" character varying(20) not null,
  "source" character varying(20) default 'api'::character varying not null,
  "total_importado" integer default 0 not null,
  "total_duplicado" integer default 0 not null,
  "total_erro" integer default 0 not null,
  "error_message" text,
  "raw_error" jsonb,
  "started_at" timestamp with time zone default now() not null,
  "finished_at" timestamp with time zone,
  "created_by" character varying(100)
);

create table if not exists "public"."secretaria_campaign_responses" (
  "id" uuid default gen_random_uuid() not null,
  "campaign_id" uuid not null,
  "target_id" uuid,
  "member_id" uuid,
  "name" text,
  "phone" text,
  "answers" jsonb default '{}'::jsonb not null,
  "files" jsonb default '[]'::jsonb not null,
  "status" text default 'pending'::text not null,
  "review_notes" text,
  "reviewed_by" text,
  "reviewed_at" timestamp with time zone,
  "applied_fields" jsonb default '[]'::jsonb not null,
  "submitted_at" timestamp with time zone default now() not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."secretaria_campaign_targets" (
  "id" uuid default gen_random_uuid() not null,
  "campaign_id" uuid not null,
  "member_id" uuid,
  "name" text,
  "phone" text,
  "rol" integer,
  "church_id" uuid,
  "church_name" text,
  "regional_id" uuid,
  "regional_name" text,
  "zone" text,
  "title_name" text,
  "status" text default 'pending'::text not null,
  "dispatch_campaign_id" uuid,
  "dispatch_recipient_id" uuid,
  "token" text not null,
  "sent_at" timestamp with time zone,
  "error" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."secretaria_campaigns" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid,
  "owner_user_id" text not null,
  "name" text not null,
  "reason" text,
  "description" text,
  "kind" text default 'form'::text not null,
  "status" text default 'draft'::text not null,
  "form_schema" jsonb default '[]'::jsonb not null,
  "message_template" text,
  "image_url" text,
  "video_url" text,
  "link_url" text,
  "instance_id" uuid,
  "share_token" text not null,
  "require_identification" boolean default true not null,
  "opens_at" timestamp with time zone,
  "closes_at" timestamp with time zone,
  "target_count" integer default 0 not null,
  "sent_count" integer default 0 not null,
  "response_count" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."sermons" (
  "id" uuid not null,
  "church_id" uuid not null,
  "event_id" uuid,
  "title" character varying(255) not null,
  "description" text,
  "preacher_id" uuid,
  "preacher_name" character varying(255),
  "sermon_series" character varying(255),
  "scripture_reference" character varying(255),
  "video_url" character varying(500),
  "audio_url" character varying(500),
  "thumbnail_url" character varying(500),
  "pdf_url" character varying(500),
  "preached_at" timestamp(3) without time zone,
  "views_count" integer default 0 not null,
  "downloads_count" integer default 0 not null,
  "status" character varying(20) default 'published'::character varying,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."settings" (
  "id" uuid not null,
  "church_id" uuid,
  "setting_key" character varying(100) not null,
  "setting_value" text,
  "setting_type" character varying(20) default 'string'::character varying,
  "description" text,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_by" uuid,
  "campo_id" uuid
);

create table if not exists "public"."site_style_presets" (
  "id" text not null,
  "nome" text not null,
  "descricao" text default ''::text,
  "tema" text default 'dark'::text not null,
  "tokens" jsonb not null,
  "preview_url" text,
  "ordem" integer default 0 not null,
  "ativo" boolean default true not null
);

create table if not exists "public"."stripe_configs" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid not null,
  "publishable_key" character varying(255) not null,
  "secret_key_enc" text not null,
  "webhook_secret_enc" text,
  "account_id" character varying(100),
  "ativo" boolean default false not null,
  "modo_prod" boolean default false not null,
  "pix_enabled" boolean default true not null,
  "card_enabled" boolean default true not null,
  "currency" character varying(3) default 'brl'::character varying not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "created_by" uuid,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."stripe_payments" (
  "id" uuid default gen_random_uuid() not null,
  "config_id" uuid not null,
  "campo_id" uuid not null,
  "church_id" uuid,
  "user_id" uuid,
  "member_id" uuid,
  "order_id" uuid,
  "stripe_payment_intent_id" character varying(100),
  "stripe_session_id" character varying(100),
  "stripe_customer_id" character varying(100),
  "stripe_charge_id" character varying(100),
  "valor" numeric(10,2) not null,
  "valor_refunded" numeric(10,2) default 0 not null,
  "moeda" character varying(3) default 'brl'::character varying not null,
  "metodo" character varying(30) not null,
  "tipo" character varying(30) not null,
  "status" character varying(30) default 'pendente'::character varying not null,
  "descricao" character varying(500),
  "pix_qr_code" text,
  "pix_expira" timestamp(3) without time zone,
  "receipt_url" character varying(500),
  "metadata" jsonb,
  "paid_at" timestamp(3) without time zone,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."stripe_refunds" (
  "id" uuid default gen_random_uuid() not null,
  "payment_id" uuid not null,
  "stripe_refund_id" character varying(100),
  "valor" numeric(10,2) not null,
  "moeda" character varying(3) default 'brl'::character varying not null,
  "motivo" text,
  "status" character varying(20) default 'solicitado'::character varying not null,
  "stripe_status" character varying(20),
  "solicitado_por" uuid,
  "aprovado_por" uuid,
  "motivo_rejeicao" text,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."stripe_subscriptions" (
  "id" uuid default gen_random_uuid() not null,
  "config_id" uuid not null,
  "campo_id" uuid not null,
  "church_id" uuid,
  "user_id" uuid,
  "member_id" uuid,
  "stripe_subscription_id" character varying(100) not null,
  "stripe_customer_id" character varying(100),
  "stripe_price_id" character varying(100),
  "stripe_product_id" character varying(100),
  "tipo" character varying(30),
  "valor" numeric(10,2),
  "moeda" character varying(3) default 'brl'::character varying not null,
  "frequencia" character varying(20),
  "status" character varying(20) default 'ativa'::character varying not null,
  "proxima_cobranca" timestamp(3) without time zone,
  "cancelada_em" timestamp(3) without time zone,
  "pausada_em" timestamp(3) without time zone,
  "descricao" character varying(255),
  "metadata" jsonb,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."stripe_webhook_logs" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid,
  "payment_id" uuid,
  "stripe_event_id" character varying(100) not null,
  "event_type" character varying(100) not null,
  "payload" jsonb not null,
  "processado" boolean default false not null,
  "erro" text,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."tbcarteirinha" (
  "id" bigint default nextval('tbcarteirinha_id_seq'::regclass) not null,
  "nome" text,
  "tipo" text,
  "descricao" text,
  "frente" text,
  "verso" text,
  "largura" numeric,
  "altura" numeric,
  "largurapg" numeric,
  "alturapg" numeric,
  "linhaporpg" integer,
  "colunaporpg" integer,
  "validademeses" integer,
  "ativo" boolean default true not null,
  "campo" text,
  "created_at" timestamp with time zone default now() not null,
  "regional" text,
  "criadopor" text,
  "idfirebase" text,
  "via" text,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."tbcredencial" (
  "id" bigint default nextval('tbcredencial_id_seq'::regclass) not null,
  "nome" text,
  "tipo" text,
  "numero" text,
  "idtbmembro" bigint,
  "igrejasolicitante" text,
  "datavalidade" date,
  "dataemissao" date,
  "situacao" text default 'Pendente'::text not null,
  "obs" text,
  "aprovadopor" text,
  "dataaprovacao" date,
  "campo" uuid,
  "created_at" timestamp with time zone default now() not null,
  "member_id" text,
  "church_id" uuid,
  "requester_user_id" uuid,
  "kan_card_id" text,
  "card_protocol" text,
  "updated_at" timestamp with time zone default now() not null,
  "via" text,
  "frente" text,
  "verso" text,
  "nomecarteirinha" text
);

create table if not exists "public"."tbeventos" (
  "id" uuid default gen_random_uuid() not null,
  "evento" text not null,
  "datareal" date not null,
  "dia" smallint not null,
  "mes" text not null,
  "ano" smallint not null,
  "horario" text,
  "local" text,
  "obs" text,
  "foto" text,
  "preco" numeric(10,2) default 0 not null,
  "pago" boolean default false not null,
  "tipo" text default 'gratuito'::text not null,
  "keypg" text,
  "ministerio" text,
  "mostrar" boolean default true not null,
  "reservar" boolean default false not null,
  "campo" text,
  "regional" text,
  "igreja" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "campo_id" uuid not null,
  "headquarters_id" uuid,
  "church_id" uuid,
  "audience_scope" text default 'headquarters'::text not null,
  "dia_semana" text,
  "departamento" text,
  "icon_name" character varying(50)
);

create table if not exists "public"."tipo_culto" (
  "id" uuid default gen_random_uuid() not null,
  "campo_id" uuid,
  "codigo" character varying(60) not null,
  "nome" character varying(120) not null,
  "descricao" text,
  "ordem" integer default 0 not null,
  "ativo" boolean default true not null,
  "is_default" boolean default false not null,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "deleted_at" timestamp with time zone
);

create table if not exists "public"."tipo_documento" (
  "id" uuid default gen_random_uuid() not null,
  "legacy_id" integer,
  "nome" character varying(100) not null,
  "sigla" character varying(20),
  "tipo" character varying(10),
  "disponivel_receita" boolean default true,
  "disponivel_despesa" boolean default true,
  "ativo" boolean default true not null,
  "campo" character varying(100),
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."tipos_conta_bancaria" (
  "id" uuid default gen_random_uuid() not null,
  "codigo" character varying(30) not null,
  "nome" character varying(100) not null,
  "ordem" integer default 0 not null,
  "ativo" boolean default true not null,
  "is_default" boolean default false not null,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp with time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."tipos_credor" (
  "id" uuid default gen_random_uuid() not null,
  "codigo" character varying(30) not null,
  "nome" character varying(100) not null,
  "ordem" integer default 0 not null,
  "ativo" boolean default true not null,
  "is_default" boolean default false not null,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp with time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."tipos_departamento" (
  "id" uuid default gen_random_uuid() not null,
  "codigo" character varying(30) not null,
  "nome" character varying(100) not null,
  "ordem" integer default 0 not null,
  "ativo" boolean default true not null,
  "is_default" boolean default false not null,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp with time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."transactions" (
  "id" uuid not null,
  "church_id" uuid not null,
  "account_id" uuid not null,
  "category_id" uuid,
  "type" character varying(20) not null,
  "amount" numeric(15,2) not null,
  "description" character varying(500) not null,
  "notes" text,
  "transaction_date" date not null,
  "due_date" date,
  "paid_at" timestamp(3) without time zone,
  "status" character varying(20) default 'pending'::character varying,
  "payment_method" character varying(30),
  "payment_proof_url" character varying(500),
  "is_recurring" boolean default false not null,
  "recurrence_pattern" character varying(20),
  "recurrence_parent_id" uuid,
  "donor_member_id" uuid,
  "transfer_to_account_id" uuid,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "created_by" uuid,
  "updated_by" uuid,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."unknown_faces" (
  "id" uuid not null,
  "session_id" uuid not null,
  "camera_id" uuid,
  "face_image_url" character varying(500),
  "embedding_json" text,
  "confidence" double precision not null,
  "cluster_id" character varying(100),
  "status" character varying(50) not null,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "identified_member_id" uuid,
  "created_at" timestamp with time zone default '2026-06-16 01:24:59.472137+00'::timestamp with time zone not null
);

create table if not exists "public"."user_notes" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "date" character varying(10) not null,
  "content" text not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."user_sticky_notes" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "content" text not null,
  "color" character varying(20) default '#fef08a'::character varying not null,
  "position" integer default 0 not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."users" (
  "id" uuid not null,
  "church_id" uuid,
  "email" character varying(255) not null,
  "password_hash" character varying(255),
  "email_verified_at" timestamp(3) without time zone,
  "full_name" character varying(255) not null,
  "avatar_url" character varying(500),
  "phone" character varying(20),
  "role_id" uuid,
  "is_admin" boolean default false not null,
  "is_active" boolean default true not null,
  "two_factor_enabled" boolean default false not null,
  "two_factor_secret" character varying(255),
  "last_login_at" timestamp(3) without time zone,
  "last_login_ip" character varying(45),
  "created_at" timestamp(3) without time zone default now() not null,
  "updated_at" timestamp(3) without time zone default now() not null,
  "deleted_at" timestamp(3) without time zone,
  "regional_id" uuid,
  "campo_id" uuid,
  "profile_type" character varying(20) default 'church'::character varying not null,
  "permissions" jsonb,
  "system_email" character varying(255),
  "last_active_at" timestamp without time zone,
  "presence_status" character varying(20) default 'online'::character varying,
  "custom_status" character varying(255)
);

create table if not exists "public"."webhook_logs" (
  "id" uuid not null,
  "webhook_id" uuid not null,
  "event_type" character varying(100) not null,
  "payload" jsonb not null,
  "status_code" integer,
  "response_body" text,
  "success" boolean,
  "error_message" text,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null
);

create table if not exists "public"."webhooks" (
  "id" uuid not null,
  "church_id" uuid not null,
  "name" character varying(255) not null,
  "url" character varying(500) not null,
  "events" jsonb not null,
  "secret" character varying(255),
  "headers" jsonb,
  "is_active" boolean default true not null,
  "last_triggered_at" timestamp(3) without time zone,
  "success_count" integer default 0 not null,
  "failure_count" integer default 0 not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone not null,
  "deleted_at" timestamp(3) without time zone
);

create table if not exists "public"."whatsapp_ai_reply_queue" (
  "conversation_id" uuid not null,
  "instance_id" uuid not null,
  "phone" text not null,
  "due_at" timestamp with time zone not null,
  "deadline_at" timestamp with time zone not null,
  "last_message_id" text,
  "pending_count" integer default 1 not null,
  "status" text default 'pending'::text not null,
  "attempts" integer default 0 not null,
  "locked_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."whatsapp_campaign_instances" (
  "id" uuid default gen_random_uuid() not null,
  "campaign_id" uuid not null,
  "instance_id" uuid not null,
  "sent_count" integer default 0 not null,
  "error_count" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."whatsapp_campaign_recipients" (
  "id" uuid default gen_random_uuid() not null,
  "campaign_id" uuid not null,
  "source" text not null,
  "source_id" text not null,
  "name" text,
  "phone" text not null,
  "variables" jsonb default '{}'::jsonb not null,
  "instance_id" uuid,
  "agent_user_id" text,
  "status" text default 'pending'::text not null,
  "error_message" text,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "match_status" text,
  "matched_member_id" text,
  "matched_attendance_id" uuid,
  "matched_stage" text,
  "attendance_id" uuid,
  "import_row_id" uuid
);

create table if not exists "public"."whatsapp_campaigns" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid,
  "owner_user_id" text not null,
  "name" text not null,
  "message_template" text not null,
  "status" text default 'draft'::text not null,
  "interval_seconds" integer default 5 not null,
  "total_recipients" integer default 0 not null,
  "sent_count" integer default 0 not null,
  "error_count" integer default 0 not null,
  "agent_user_ids" text[] default '{}'::text[] not null,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "image_url" text,
  "link_url" text,
  "origin" text default 'portal'::text not null,
  "import_batch_id" uuid,
  "create_pipeline_cards" boolean default false not null,
  "attendance_type" text,
  "pipeline_church_id" uuid
);

create table if not exists "public"."whatsapp_conversations" (
  "id" uuid default gen_random_uuid() not null,
  "instance_id" uuid,
  "phone" text not null,
  "contact_name" text,
  "status" text default 'open'::text,
  "ai_enabled" boolean default false,
  "assigned_to" text,
  "owner_user_id" text not null,
  "last_message_at" timestamp with time zone,
  "last_message" text,
  "unread_count" integer default 0,
  "metadata" jsonb default '{}'::jsonb,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "ai_agent_id" text
);

create table if not exists "public"."whatsapp_import_batches" (
  "id" uuid default gen_random_uuid() not null,
  "church_id" uuid,
  "owner_user_id" text not null,
  "filename" text,
  "mapping" jsonb default '{}'::jsonb not null,
  "total_rows" integer default 0 not null,
  "valid_rows" integer default 0 not null,
  "invalid_rows" integer default 0 not null,
  "duplicate_rows" integer default 0 not null,
  "member_rows" integer default 0 not null,
  "pipeline_rows" integer default 0 not null,
  "new_rows" integer default 0 not null,
  "status" text default 'analyzed'::text not null,
  "campaign_id" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "public"."whatsapp_import_rows" (
  "id" uuid default gen_random_uuid() not null,
  "batch_id" uuid not null,
  "row_number" integer not null,
  "raw" jsonb default '{}'::jsonb not null,
  "name" text,
  "phone" text,
  "email" text,
  "variables" jsonb default '{}'::jsonb not null,
  "match_status" text default 'new'::text not null,
  "matched_member_id" text,
  "matched_attendance_id" uuid,
  "matched_stage" text,
  "decision" text default 'send'::text not null,
  "skip_reason" text,
  "recipient_id" uuid,
  "created_attendance_id" uuid,
  "created_at" timestamp with time zone default now() not null,
  "cell_group_id" uuid,
  "cell_group_assigned_at" timestamp with time zone,
  "cell_group_assigned_by" text,
  "address_text" text,
  "address_zipcode" text,
  "address_source" text,
  "latitude" numeric(10,8),
  "longitude" numeric(11,8),
  "suggested_cell_group_id" uuid,
  "suggested_distance_km" numeric(8,3),
  "analyzed_at" timestamp with time zone,
  "analysis_note" text
);

create table if not exists "public"."whatsapp_instance_rate_limit" (
  "instance_id" text not null,
  "last_sent_at" timestamp with time zone default now()
);

create table if not exists "public"."whatsapp_instance_users" (
  "id" uuid default gen_random_uuid() not null,
  "instance_id" uuid,
  "user_id" text not null,
  "added_by" text,
  "created_at" timestamp with time zone default now()
);

create table if not exists "public"."whatsapp_instances" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "instance_id" text,
  "token" text,
  "client_token" text,
  "status" text default 'disconnected'::text,
  "owner_user_id" text not null,
  "webhook_url" text,
  "phone_number" text,
  "is_active" boolean default true,
  "metadata" jsonb default '{}'::jsonb,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists "public"."whatsapp_messages" (
  "id" uuid default gen_random_uuid() not null,
  "conversation_id" uuid,
  "content" text,
  "type" text default 'text'::text,
  "direction" text not null,
  "status" text default 'pending'::text,
  "sender_name" text,
  "media_url" text,
  "media_mime_type" text,
  "metadata" jsonb default '{}'::jsonb,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists "public"."zonas" (
  "id" uuid default gen_random_uuid() not null,
  "name" character varying(60) not null,
  "abbreviation" character varying(20),
  "display_order" integer,
  "is_active" boolean default true not null,
  "created_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updated_at" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "deleted_at" timestamp(3) without time zone
);

-- Ownership de sequences (serial)
alter sequence "public"."tbcarteirinha_id_seq" owned by "public"."tbcarteirinha"."id";
alter sequence "public"."tbcredencial_id_seq" owned by "public"."tbcredencial"."id";
alter sequence "public"."kan_matrix_rules_id_seq" owned by "public"."kan_matrix_rules"."id";
alter sequence "public"."kan_columns_id_seq" owned by "public"."kan_columns"."id";
alter sequence "public"."kan_stages_id_seq" owned by "public"."kan_stages"."id";
alter sequence "public"."kan_pipelines_id_seq" owned by "public"."kan_pipelines"."id";
alter sequence "public"."tbfuncoes_id_seq" owned by "public"."church_function_catalog"."legacy_id";
