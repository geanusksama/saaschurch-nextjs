-- Gerado por scripts/dump-baseline.mjs em 2026-11-23T18:15:59.875Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 6d22d970fc5f30cd

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
