-- Gerado por scripts/dump-baseline.mjs em 2026-11-28T00:06:23.381Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 32aeeaa948f71d98

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
