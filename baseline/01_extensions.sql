-- Gerado por scripts/dump-baseline.mjs em 2026-09-17T17:09:28.978Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 2e2ca6e62419bdd9

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
