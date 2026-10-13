-- Gerado por scripts/dump-baseline.mjs em 2026-10-13T11:23:50.720Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline d23a12c3d91c0f1a

-- Carimbo da versao do baseline aplicada neste banco.
-- Usado pelo painel para detectar instancias desatualizadas.
create table if not exists public._painelchurch_baseline (
  id boolean primary key default true check (id),
  version text not null,
  generated_at timestamptz not null,
  applied_at timestamptz not null default now()
);
insert into public._painelchurch_baseline (id, version, generated_at, applied_at)
values (true, 'd23a12c3d91c0f1a', '2026-10-13T11:23:50.690Z', now())
on conflict (id) do update set version = excluded.version,
  generated_at = excluded.generated_at, applied_at = now();
grant select on public._painelchurch_baseline to anon, authenticated, service_role;
alter table public._painelchurch_baseline enable row level security;
drop policy if exists _painelchurch_baseline_leitura on public._painelchurch_baseline;
create policy _painelchurch_baseline_leitura on public._painelchurch_baseline for select to anon, authenticated using (true);
