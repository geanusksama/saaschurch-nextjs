-- Gerado por scripts/dump-baseline.mjs em 2026-09-24T17:33:38.063Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 500e39c338ad501d

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
