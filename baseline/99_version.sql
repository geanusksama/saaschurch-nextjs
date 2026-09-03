-- Gerado por scripts/dump-baseline.mjs em 2026-09-03T15:40:19.433Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline f7e4dc6d2e62ff75

-- Carimbo da versao do baseline aplicada neste banco.
-- Usado pelo painel para detectar instancias desatualizadas.
create table if not exists public._painelchurch_baseline (
  id boolean primary key default true check (id),
  version text not null,
  generated_at timestamptz not null,
  applied_at timestamptz not null default now()
);
insert into public._painelchurch_baseline (id, version, generated_at, applied_at)
values (true, 'f7e4dc6d2e62ff75', '2026-09-03T15:40:19.415Z', now())
on conflict (id) do update set version = excluded.version,
  generated_at = excluded.generated_at, applied_at = now();
grant select on public._painelchurch_baseline to anon, authenticated, service_role;
