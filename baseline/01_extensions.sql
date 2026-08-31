-- Gerado por scripts/dump-baseline.mjs em 2026-08-31T18:52:32.432Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 84afdef9474857e7

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
