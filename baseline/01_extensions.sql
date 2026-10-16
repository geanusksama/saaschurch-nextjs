-- Gerado por scripts/dump-baseline.mjs em 2026-10-16T01:09:34.674Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 959b2c25986e2596

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
