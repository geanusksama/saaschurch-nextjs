-- Gerado por scripts/dump-baseline.mjs em 2026-11-28T01:40:35.724Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 696a7ea624163b83

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
