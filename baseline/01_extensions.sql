-- Gerado por scripts/dump-baseline.mjs em 2026-10-26T23:38:44.621Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 25d8ef5ff8c5cde0

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
