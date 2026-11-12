-- Gerado por scripts/dump-baseline.mjs em 2026-11-12T20:45:40.873Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline d6eb3855ae70e116

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
