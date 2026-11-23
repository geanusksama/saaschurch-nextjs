-- Gerado por scripts/dump-baseline.mjs em 2026-11-23T19:28:19.080Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 5efc5aecf0f125da

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
