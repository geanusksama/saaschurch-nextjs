-- Gerado por scripts/dump-baseline.mjs em 2026-09-24T15:02:40.170Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 8bbb1b4492ffc847

-- Extensions
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Schemas
create schema if not exists "app";
