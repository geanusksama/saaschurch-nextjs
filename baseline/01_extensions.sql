-- Gerado por scripts/dump-baseline.mjs em 2026-09-03T15:26:46.444Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 61855ad708763c38

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
