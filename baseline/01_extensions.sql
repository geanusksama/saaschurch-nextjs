-- Gerado por scripts/dump-baseline.mjs em 2026-09-03T15:40:19.422Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline f7e4dc6d2e62ff75

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
