import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

/** Produto da loja como o painel manipula. */
export interface ProdutoLoja {
  id: string;
  department_id: string;
  slug: string;
  nome: string;
  descricao: string;
  descricao_curta: string;
  categoria: string;
  preco: number;
  preco_promocional: number | null;
  parcelas_max: number;
  ficha_tecnica: Array<{ label: string; value: string }>;
  tabela_medidas: Record<string, unknown>;
  estoque_total: number | null;
  controla_estoque: boolean;
  destaque: boolean;
  ordem: number;
  ativo: boolean;
  payment_link: string | null;
  imagens: Array<{ id?: string; url: string; alt: string; variant_cor: string | null; ordem: number }>;
  variacoes: Array<{
    id?: string; sku: string | null; cor: string | null; cor_hex: string | null;
    tamanho: string | null; preco: number | null; estoque: number; ativo: boolean;
  }>;
}

/** Corpo aceito pela API ao criar/editar. */
export interface ProdutoPayload {
  departmentId?: string;
  nome?: string;
  descricao?: string;
  descricaoCurta?: string;
  categoria?: string;
  preco?: number;
  precoPromocional?: number | null;
  parcelasMax?: number;
  fichaTecnica?: Array<{ label: string; value: string }>;
  estoqueTotal?: number | null;
  controlaEstoque?: boolean;
  destaque?: boolean;
  ativo?: boolean;
  paymentLink?: string | null;
  imagens?: Array<{ url: string; alt?: string; variantCor?: string | null }>;
  variacoes?: Array<{
    sku?: string | null; cor?: string | null; corHex?: string | null;
    tamanho?: string | null; preco?: number | null; estoque?: number; ativo?: boolean;
  }>;
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

export function useDepartmentProducts(departmentId: string | undefined) {
  return useQuery({
    queryKey: ["department_products", departmentId],
    queryFn: () => pedir<{ produtos: ProdutoLoja[] }>(
      `/api/cms/department-products?departmentId=${departmentId}`,
    ).then((r) => r.produtos),
    enabled: !!departmentId,
    staleTime: 15_000,
  });
}

export function useSalvarProduto(departmentId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: ProdutoPayload & { id?: string }) =>
      id
        ? pedir<{ produto: ProdutoLoja }>(`/api/cms/department-products/${id}`, {
            method: "PATCH", body: JSON.stringify(payload),
          })
        : pedir<{ produto: ProdutoLoja }>("/api/cms/department-products", {
            method: "POST", body: JSON.stringify({ ...payload, departmentId }),
          }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["department_products", departmentId] }); },
  });
}

export function useArquivarProduto(departmentId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      pedir<{ ok: boolean }>(`/api/cms/department-products/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["department_products", departmentId] }); },
  });
}

/**
 * Envia uma imagem para o storage e devolve a URL pública.
 * Reaproveita o bucket `dept-media`, já usado pelas mídias de departamento.
 */
export async function enviarImagemProduto(deptSlug: string, arquivo: File): Promise<string> {
  const ext = arquivo.name.split(".").pop() ?? "jpg";
  const caminho = `produtos/${deptSlug}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from("dept-media").upload(caminho, arquivo, { upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from("dept-media").getPublicUrl(caminho);
  return data.publicUrl;
}
