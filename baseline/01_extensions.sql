-- Gerado por scripts/dump-baseline.mjs em 2026-10-13T11:23:50.702Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline d23a12c3d91c0f1a

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
