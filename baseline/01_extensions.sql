-- Gerado por scripts/dump-baseline.mjs em 2026-08-28T05:01:11.756Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 03e71297af6eae49

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
