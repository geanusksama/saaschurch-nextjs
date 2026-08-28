-- Gerado por scripts/dump-baseline.mjs em 2026-08-28T05:01:11.767Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 03e71297af6eae49

-- Carimbo da versao do baseline aplicada neste banco.
-- Usado pelo painel para detectar instancias desatualizadas.
create table if not exists public._painelchurch_baseline (
  id boolean primary key default true check (id),
  version text not null,
  generated_at timestamptz not null,
  applied_at timestamptz not null default now()
);
insert into public._painelchurch_baseline (id, version, generated_at, applied_at)
values (true, '03e71297af6eae49', '2026-08-28T05:01:11.749Z', now())
on conflict (id) do update set version = excluded.version,
  generated_at = excluded.generated_at, applied_at = now();
grant select on public._painelchurch_baseline to anon, authenticated, service_role;
