-- Gerado por scripts/dump-baseline.mjs em 2026-11-23T18:51:06.063Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline f22b1c58ac003887

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
