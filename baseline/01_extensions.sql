-- Gerado por scripts/dump-baseline.mjs em 2026-11-28T01:24:56.127Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 3722a19e8d96f01f

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
