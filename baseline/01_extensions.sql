-- Gerado por scripts/dump-baseline.mjs em 2026-10-16T13:20:00.087Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline b4a9d25bc39e5e6c

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
