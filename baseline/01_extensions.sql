-- Gerado por scripts/dump-baseline.mjs em 2026-08-28T05:10:27.917Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline c4f239f220316469

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
