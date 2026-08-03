import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import type { DepartmentSite, SiteBlock } from "../lib/departmentSiteSchema";

/**
 * Acesso do CMS às páginas de departamento.
 *
 * Substitui o antigo `useDeptPage`, que gravava numa tabela `dept_pages`
 * inexistente e usava `org_id` do localStorage — por isso nada persistia.
 * Agora vai pelas rotas /api/cms/*, que autenticam e amarram tudo ao campo do
 * usuário.
 */

export interface SiteComBlocos {
  site: DepartmentSite;
  blocks: SiteBlock[];
  departamento: { id: string; name: string; color: string | null; icon: string | null } | null;
}

/** Bloco como o builder manipula: id opcional (ainda não salvo). */
export interface BlocoEditavel {
  id?: string;
  tipo: string;
  variante: string;
  props: Record<string, unknown>;
  visivel: boolean;
}

async function comAuth(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: await comAuth() });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error ?? `Falha na requisição (${r.status})`);
  return json as T;
}

// ── Listagem ─────────────────────────────────────────────────────────────────

export function useDepartmentSites() {
  return useQuery({
    queryKey: ["department_sites"],
    queryFn: () => pedir<{ sites: Array<DepartmentSite & { ministries?: { name: string } }> }>(
      "/api/cms/department-sites",
    ).then((r) => r.sites),
    staleTime: 30_000,
  });
}

// ── Um site com seus blocos ──────────────────────────────────────────────────

export function useDepartmentSite(siteId: string | undefined) {
  return useQuery({
    queryKey: ["department_site", siteId],
    queryFn: () => pedir<SiteComBlocos>(`/api/cms/department-sites/${siteId}`),
    enabled: !!siteId,
    staleTime: 10_000,
  });
}

// ── Criação ──────────────────────────────────────────────────────────────────

export function useCriarDepartmentSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: { departmentId: string; titulo?: string; slug?: string; preset?: string }) =>
      pedir<{ site: DepartmentSite }>("/api/cms/department-sites", {
        method: "POST",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["department_sites"] }); },
  });
}

// ── Salvar (site e/ou blocos) ────────────────────────────────────────────────

export function useSalvarDepartmentSite(siteId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<DepartmentSite> & { blocks?: BlocoEditavel[] }) =>
      pedir<SiteComBlocos>(`/api/cms/department-sites/${siteId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: (dados) => {
      qc.setQueryData(["department_site", siteId], dados);
      qc.invalidateQueries({ queryKey: ["department_sites"] });
    },
  });
}

// ── Publicar / despublicar ───────────────────────────────────────────────────

export function usePublicarDepartmentSite(siteId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicar: boolean) =>
      pedir<{ ok: boolean; url?: string; site?: { slug: string; status: string } }>(
        `/api/cms/department-sites/${siteId}/publish`,
        { method: "POST", body: JSON.stringify({ publicar }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["department_site", siteId] });
      qc.invalidateQueries({ queryKey: ["department_sites"] });
    },
  });
}

// ── Dados vivos para a pré-visualização ──────────────────────────────────────

/**
 * Eventos e produtos reais do departamento, para o preview mostrar a página
 * como ela vai ficar — e não com conteúdo de exemplo.
 */
export function useDadosPreview(siteId: string | undefined) {
  return useQuery({
    queryKey: ["department_site_preview", siteId],
    queryFn: () => pedir<{
      eventos: { abertos: unknown[]; historico: unknown[] };
      produtos: unknown[];
    }>(`/api/cms/department-sites/${siteId}/preview`),
    enabled: !!siteId,
    staleTime: 60_000,
  });
}

// ── Presets de estilo ────────────────────────────────────────────────────────

export function usePresets() {
  return useQuery({
    queryKey: ["site_style_presets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_style_presets")
        .select("*")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

// ── Ministérios do campo, para criar a página de um deles ────────────────────

export function useMinisteriosSemSite() {
  return useQuery({
    queryKey: ["ministerios_sem_site"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ministries")
        .select("id, name, color, icon, slug")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}
