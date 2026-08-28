-- Gerado por scripts/dump-baseline.mjs em 2026-08-28T18:29:08.862Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 6013fb939d04d7f4

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
