import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

// Must match the Block interface in CMSPageBuilder
export interface PageBlock {
  id: string;
  type: string;
  label: string;
  config: Record<string, string | boolean | number>;
}

export interface DeptPage {
  id?: string;
  org_id: string;
  dept_slug: string;
  blocks: PageBlock[];
  published: boolean;
  published_at?: string | null;
  updated_at?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getOrgId(): Promise<string | null> {
  try {
    const raw = localStorage.getItem("mrm_user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.org_id ?? user?.organizationId ?? null;
  } catch {
    return null;
  }
}

// ── Fetch page ────────────────────────────────────────────────────────────────

async function fetchDeptPage(orgId: string, deptSlug: string): Promise<DeptPage | null> {
  const { data, error } = await supabase
    .from("dept_pages")
    .select("*")
    .eq("org_id", orgId)
    .eq("dept_slug", deptSlug)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
  return data as DeptPage | null;
}

export function useDeptPage(deptSlug: string) {
  return useQuery({
    queryKey: ["dept_page", deptSlug],
    queryFn: async () => {
      const orgId = await getOrgId();
      if (!orgId) return null;
      return fetchDeptPage(orgId, deptSlug);
    },
    staleTime: 30_000,
  });
}

// ── Save page (upsert) ────────────────────────────────────────────────────────

interface SavePayload {
  deptSlug: string;
  blocks: PageBlock[];
  published?: boolean;
}

async function saveDeptPage(payload: SavePayload): Promise<DeptPage> {
  const orgId = await getOrgId();
  if (!orgId) throw new Error("org_id não encontrado — faça login novamente.");

  const { data: { user } } = await supabase.auth.getUser();

  const row = {
    org_id: orgId,
    dept_slug: payload.deptSlug,
    blocks: payload.blocks,
    ...(payload.published !== undefined && { published: payload.published }),
    ...(payload.published && { published_at: new Date().toISOString() }),
    updated_by: user?.id ?? null,
  };

  const { data, error } = await supabase
    .from("dept_pages")
    .upsert(row, { onConflict: "org_id,dept_slug" })
    .select()
    .single();

  if (error) throw error;
  return data as DeptPage;
}

export function useSaveDeptPage(deptSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveDeptPage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dept_page", deptSlug] });
    },
  });
}

// ── Upload media to Supabase Storage ─────────────────────────────────────────

export async function uploadDeptMedia(
  deptSlug: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${deptSlug}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from("dept-media")
    .upload(path, file, { upsert: false });

  if (error) throw error;
  onProgress?.(100);

  const { data: { publicUrl } } = supabase.storage
    .from("dept-media")
    .getPublicUrl(path);

  return publicUrl;
}
