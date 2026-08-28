-- Gerado por scripts/dump-baseline.mjs em 2026-08-28T18:29:08.864Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 6013fb939d04d7f4

-- Sequences
create sequence if not exists "public"."kan_columns_id_seq" as integer increment by 1 minvalue 1 maxvalue 2147483647 start with 1 no cycle;
create sequence if not exists "public"."kan_matrix_rules_id_seq" as integer increment by 1 minvalue 1 maxvalue 2147483647 start with 1 no cycle;
create sequence if not exists "public"."kan_pipelines_id_seq" as integer increment by 1 minvalue 1 maxvalue 2147483647 start with 1 no cycle;
create sequence if not exists "public"."kan_stages_id_seq" as integer increment by 1 minvalue 1 maxvalue 2147483647 start with 1 no cycle;
create sequence if not exists "public"."members_rol_seq" as integer increment by 1 minvalue 1 maxvalue 2147483647 start with 1 no cycle;
create sequence if not exists "public"."regional_id_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 no cycle;
create sequence if not exists "public"."tbcampo_id_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 no cycle;
create sequence if not exists "public"."tbcarteirinha_id_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 no cycle;
create sequence if not exists "public"."tbcredencial_id_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 no cycle;
create sequence if not exists "public"."tbfuncoes_id_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 no cycle;
create sequence if not exists "public"."tbigreja_id_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 no cycle;
create sequence if not exists "public"."tbigrejafoto_id_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 no cycle;
create sequence if not exists "public"."tbigrejasede_id_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 no cycle;
