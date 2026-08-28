-- Gerado por scripts/dump-baseline.mjs em 2026-08-28T05:21:04.332Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 0d7449fb3f6c8936

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
