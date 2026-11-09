-- Gerado por scripts/dump-baseline.mjs em 2026-11-09T19:10:10.416Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline cc48b63995f7c79e

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
