-- Gerado por scripts/dump-baseline.mjs em 2026-11-27T23:21:52.972Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline b00d9e57c1cd2946

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
