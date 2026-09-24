-- Gerado por scripts/dump-baseline.mjs em 2026-09-24T17:07:17.399Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline c7a678bfb04cf038

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
