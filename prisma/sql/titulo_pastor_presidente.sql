-- Cadastra o título eclesiástico PASTOR PRESIDENTE.
--
-- Motivo: o título já era usado no cadastro de membros (MANOEL FERREIRA NETTO,
-- AD Campinas — SEDE) mas não existia em `ecclesiastical_titles`. Sem estar no
-- catálogo ele não casava com nada e ficava de fora da contagem de obreiros do
-- Resumo da Transição (troca de dirigente).
--
-- `level = 6` fica entre PASTOR (5) e BISPO (47), respeitando a hierarquia. É
-- o `level` que define obreiro: nível >= 1.
--
-- allow_men / allow_women vão como `true` de propósito. As linhas antigas do
-- catálogo têm ambos `false` (inclusive PASTOR), o que é dado legado quebrado —
-- uma restrição errada bloqueia trabalho real, o permissivo não bloqueia nada.
-- A igreja ajusta em Configurações › Títulos Eclesiásticos se quiser restringir.
--
-- Idempotente: `name` é UNIQUE, então rodar de novo não duplica.

INSERT INTO "ecclesiastical_titles"
    ("name", "abbreviation", "level", "grouping", "prerequisite_level",
     "is_active", "is_fixed", "is_ecclesiastical_minister",
     "allow_men", "allow_women", "display_order")
VALUES
    ('PASTOR PRESIDENTE', 'PPRES', 6, 'AGR', 5,
     true, false, false,
     true, true, 3)
ON CONFLICT ("name") DO NOTHING;
