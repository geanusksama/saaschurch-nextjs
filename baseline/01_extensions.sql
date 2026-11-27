-- Gerado por scripts/dump-baseline.mjs em 2026-11-23T20:44:25.104Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline fa5cd82742e71000

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
