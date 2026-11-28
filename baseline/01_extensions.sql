-- Gerado por scripts/dump-baseline.mjs em 2026-11-28T02:44:22.290Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 7e2902d083a13a9f

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
