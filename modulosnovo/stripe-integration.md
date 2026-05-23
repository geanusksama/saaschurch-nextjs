# 💳 Manual de Implantação e Código: Integração Stripe — Grupo SLS

Este documento detalha o ecossistema de pagamentos integrado ao Stripe para faturamento recorrente (assinatura de planos) e consumo de créditos de inteligência artificial (Tokens GPT e minutos de vídeo). Contém o código React do serviço de faturamento e as Edge Functions completas de cancelamento e processamento de webhook.

---

## 🏛&nbsp;1. Fluxo de Integração e Faturamento

O sistema utiliza o Stripe em duas modalidades de transação:
1. **Assinatura Recorrente**: Contratação de planos mensais/anuais que definem os limites de usuários, leads, automações e instâncias do WhatsApp.
2. **Créditos Avulsos (Add-ons)**: Compra avulsa de pacotes de tokens de IA ou minutos adicionais de gravação de vídeo/ligação.

```
 [Stripe Checkout / Portal]
             │
      (Dispara Webhook)
             │
             ▼
   [stripe-webhook Edge]
             │
             ├─► (Verifica payload via assinatura segura)
             ├─► (Resolve o tenant_id pelo client_reference_id ou metadados)
             ├─► (Concede creditos de IA / Minutos chamando RPC no Postgres)
             └─► (Atualiza tenant_contracts, tenant_limits e settings_options)
```

---

## 🗄&nbsp;2. Estrutura do Banco de Dados

### 2.1. Tabelas de Faturamento
* `tenant_contracts` (Tabela Física):
  - `id` (uuid, PK)
  - `tenant_id` (uuid, FK -> profiles)
  - `plan_name` (text): Nome do plano contratado.
  - `billing_cycle` (text): `monthly` ou `annual`.
  - `price` (numeric): Preço cobrado no ciclo.
  - `status` (text): Estado (`active`, `cancelled`, `suspended`).
  - `stripe_subscription_id` (text): ID da assinatura no Stripe.
  - `cancel_at_period_end` (boolean): Se está agendado para cancelar.
  - `current_period_end` (timestamp, nullable): Data de término do ciclo de cobrança.

* `settings_options` (Tabela de Estado Dinâmico):
  - `option_type = 'plan_billing_state'`: Salva cartões de crédito cadastrados (`paymentMethod`, `paymentMethods`) e estatísticas da assinatura ativa (`subscription`).
  - `option_type = 'tenant_plan_contract'`: Salva o contrato atualizado de assinatura sincronizado com o Stripe.
  - `option_type = 'stripe_checkout_config'`: Mapeia links de pagamento da Stripe para pacotes de add-ons e planos.

---

## ⚛️&nbsp;3. Código-Fonte Frontend Completo

### `src/app/services/planSubscriptionService.ts`
Este serviço centraliza a sincronização do faturamento local, cache em LocalStorage, gestão de cartões salvos e chamadas para a Edge Function de cancelamento seguro:

```typescript
import { supabase } from "../../lib/supabase";
import { upsertCurrentTenantBillingProfile } from "./tenantBillingProfileService";

export type BillingCycle = "monthly" | "annual";

export type SavedPaymentMethod = {
  id: string;
  cardHolder: string;
  last4: string;
  brand: string;
  expiryMonth: string;
  expiryYear: string;
  isDefault?: boolean;
  updatedAt: string;
};

export type PlanSubscriptionMetrics = {
  planName: string;
  billingCycle: BillingCycle;
  price: number;
  originalPrice?: number;
  includedUsers: number;
  iaCredits: number;
  platformCredits: number;
  updatedAt: string;
};

export type BillingState = {
  paymentMethod: SavedPaymentMethod | null;
  paymentMethods: SavedPaymentMethod[];
  subscription: PlanSubscriptionMetrics | null;
};

export type CurrentTenantPlanContract = {
  tenantId: string;
  planName: string;
  billingCycle: BillingCycle;
  price: number;
  status: "active" | "pending" | "cancelled" | "suspended";
  stripeSubscriptionId: string;
  cancelAtPeriodEnd: boolean;
  updatedAt: string;
};

const STORAGE_KEY = "plan-billing-state-v1";
const OPTION_TYPE = "plan_billing_state";
const CONTRACT_OPTION_TYPE = "tenant_plan_contract";
const OPTION_NAME_PREFIX = "tenant:";

const DEFAULT_STATE: BillingState = {
  paymentMethod: null,
  paymentMethods: [],
  subscription: null,
};

const buildOptionName = (tenantId: string) => `${OPTION_NAME_PREFIX}${tenantId}`;

const sanitizeState = (raw: unknown): BillingState => {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STATE };
  const data = raw as Partial<BillingState>;

  const paymentMethod = data.paymentMethod && typeof data.paymentMethod === "object"
    ? {
        id: String((data.paymentMethod as SavedPaymentMethod).id ?? crypto.randomUUID()),
        cardHolder: String((data.paymentMethod as SavedPaymentMethod).cardHolder ?? ""),
        last4: String((data.paymentMethod as SavedPaymentMethod).last4 ?? ""),
        brand: String((data.paymentMethod as SavedPaymentMethod).brand ?? ""),
        expiryMonth: String((data.paymentMethod as SavedPaymentMethod).expiryMonth ?? ""),
        expiryYear: String((data.paymentMethod as SavedPaymentMethod).expiryYear ?? ""),
        isDefault: Boolean((data.paymentMethod as SavedPaymentMethod).isDefault ?? true),
        updatedAt: String((data.paymentMethod as SavedPaymentMethod).updatedAt ?? new Date().toISOString()),
      }
    : null;

  const paymentMethods = Array.isArray((data as { paymentMethods?: unknown[] }).paymentMethods)
    ? ((data as { paymentMethods?: unknown[] }).paymentMethods || [])
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const card = item as Partial<SavedPaymentMethod>;
          return {
            id: String(card.id || crypto.randomUUID()),
            cardHolder: String(card.cardHolder || ""),
            last4: String(card.last4 || ""),
            brand: String(card.brand || ""),
            expiryMonth: String(card.expiryMonth || ""),
            expiryYear: String(card.expiryYear || ""),
            isDefault: Boolean(card.isDefault),
            updatedAt: String(card.updatedAt || new Date().toISOString()),
          } as SavedPaymentMethod;
        })
    : paymentMethod
      ? [{ ...paymentMethod, isDefault: true }]
      : [];

  const normalizedMethods = paymentMethods.length
    ? paymentMethods.map((method, index) => ({
        ...method,
        isDefault: index === 0 ? true : Boolean(method.isDefault && !paymentMethods[0]?.isDefault),
      }))
    : [];

  const defaultFromList = normalizedMethods.find((method) => method.isDefault) || normalizedMethods[0] || null;

  const subscription = data.subscription && typeof data.subscription === "object"
    ? {
        planName: String((data.subscription as PlanSubscriptionMetrics).planName ?? ""),
        billingCycle: (data.subscription as PlanSubscriptionMetrics).billingCycle === "monthly" ? "monthly" : "annual",
        price: Number((data.subscription as PlanSubscriptionMetrics).price ?? 0),
        originalPrice: Number((data.subscription as PlanSubscriptionMetrics).originalPrice ?? 0) || undefined,
        includedUsers: Math.max(0, Math.floor(Number((data.subscription as PlanSubscriptionMetrics).includedUsers ?? 0))),
        iaCredits: Math.max(0, Math.floor(Number((data.subscription as PlanSubscriptionMetrics).iaCredits ?? 0))),
        platformCredits: Math.max(0, Math.floor(Number((data.subscription as PlanSubscriptionMetrics).platformCredits ?? 0))),
        updatedAt: String((data.subscription as PlanSubscriptionMetrics).updatedAt ?? new Date().toISOString()),
      }
    : null;

  return { paymentMethod: defaultFromList, paymentMethods: normalizedMethods, subscription };
};

const parseDescription = (description: string | null): BillingState => {
  if (!description) return { ...DEFAULT_STATE };
  try {
    return sanitizeState(JSON.parse(description));
  } catch {
    return { ...DEFAULT_STATE };
  }
};

const parseContractDescription = (description: string | null): CurrentTenantPlanContract | null => {
  if (!description) return null;

  try {
    const raw = JSON.parse(description) as Record<string, unknown>;
    const statusRaw = String(raw.status || "pending");
    const status: CurrentTenantPlanContract["status"] =
      statusRaw === "active" || statusRaw === "cancelled" || statusRaw === "suspended"
        ? statusRaw
        : "pending";

    const billingCycle: BillingCycle = String(raw.billingCycle || "monthly") === "annual" ? "annual" : "monthly";

    return {
      tenantId: String(raw.tenantId || ""),
      planName: String(raw.planName || ""),
      billingCycle,
      price: Math.max(0, Number(raw.price || 0)),
      status,
      stripeSubscriptionId: String(raw.stripeSubscriptionId || ""),
      cancelAtPeriodEnd: Boolean(raw.cancelAtPeriodEnd),
      updatedAt: String(raw.updatedAt || ""),
    };
  } catch {
    return null;
  }
};

const scopedStorageKey = (tenantId?: string | null) => `${STORAGE_KEY}:${tenantId || "anonymous"}`;

const readLocal = (tenantId?: string | null): BillingState => {
  if (typeof window === "undefined") return { ...DEFAULT_STATE };
  const raw = window.localStorage.getItem(scopedStorageKey(tenantId));
  if (!raw) return { ...DEFAULT_STATE };
  try {
    return sanitizeState(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_STATE };
  }
};

const writeLocal = (state: BillingState, tenantId?: string | null) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(scopedStorageKey(tenantId), JSON.stringify(sanitizeState(state)));
};

const getCurrentTenantId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return null;

  const uid = String(data.user.id);
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", uid)
    .maybeSingle();

  const metadata = profileRow?.metadata && typeof profileRow.metadata === "object"
    ? (profileRow.metadata as Record<string, unknown>)
    : {};

  const ownerId = typeof metadata.company_owner_id === "string" && metadata.company_owner_id.trim()
    ? metadata.company_owner_id.trim()
    : uid;

  return ownerId;
};

export const loadBillingState = async (): Promise<BillingState> => {
  const tenantId = await getCurrentTenantId();
  const local = readLocal(tenantId);
  if (!tenantId) return local;

  const tenantDefault = { ...DEFAULT_STATE };

  const optionName = buildOptionName(tenantId);
  const { data, error } = await supabase
    .from("settings_options")
    .select("id,description")
    .eq("option_type", OPTION_TYPE)
    .eq("name", optionName)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return tenantDefault;
  if (!data) {
    await saveBillingState(tenantDefault);
    return tenantDefault;
  }

  const remote = parseDescription(data.description ?? null);
  writeLocal(remote, tenantId);
  return remote;
};

export const saveBillingState = async (next: BillingState): Promise<BillingState> => {
  const safe = sanitizeState(next);

  const tenantId = await getCurrentTenantId();
  writeLocal(safe, tenantId);
  if (!tenantId) return safe;

  const optionName = buildOptionName(tenantId);
  const { data: existing, error: existingError } = await supabase
    .from("settings_options")
    .select("id")
    .eq("option_type", OPTION_TYPE)
    .eq("name", optionName)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) return safe;

  if (existing?.id) {
    await supabase
      .from("settings_options")
      .update({
        description: JSON.stringify(safe),
        is_active: true,
      })
      .eq("id", existing.id);
    return safe;
  }

  await supabase
    .from("settings_options")
    .insert({
      id: crypto.randomUUID(),
      option_type: OPTION_TYPE,
      name: optionName,
      description: JSON.stringify(safe),
      is_active: true,
      created_by: tenantId,
    });

  return safe;
};

export const savePaymentMethod = async (paymentMethod: SavedPaymentMethod): Promise<BillingState> => {
  const current = await loadBillingState();
  const nextMethods = [
    {
      ...paymentMethod,
      id: paymentMethod.id || crypto.randomUUID(),
      isDefault: true,
      updatedAt: paymentMethod.updatedAt || new Date().toISOString(),
    },
    ...current.paymentMethods
      .filter((method) => method.last4 !== paymentMethod.last4 || method.brand !== paymentMethod.brand)
      .map((method) => ({ ...method, isDefault: false })),
  ];

  const defaultMethod = nextMethods[0] || null;

  const next = await saveBillingState({
    ...current,
    paymentMethod: defaultMethod,
    paymentMethods: nextMethods,
  });

  const { data } = await supabase.auth.getUser();
  await upsertCurrentTenantBillingProfile({
    cardBrand: defaultMethod?.brand || "",
    cardLast4: defaultMethod?.last4 || "",
    cardExpMonth: defaultMethod?.expiryMonth || "",
    cardExpYear: defaultMethod?.expiryYear || "",
    billingEmail: data.user?.email || "",
    cardHolderName: defaultMethod?.cardHolder || "",
  });

  return next;
};

export const removePaymentMethod = async (): Promise<BillingState> => {
  const current = await loadBillingState();
  const next = await saveBillingState({
    ...current,
    paymentMethod: null,
  });

  const { data } = await supabase.auth.getUser();
  await upsertCurrentTenantBillingProfile({
    cardBrand: "",
    cardLast4: "",
    cardExpMonth: "",
    cardExpYear: "",
    billingEmail: data.user?.email || "",
    cardHolderName: "",
    stripePaymentMethodId: "",
  });

  return next;
};

export const setDefaultPaymentMethod = async (methodId: string): Promise<BillingState> => {
  const current = await loadBillingState();
  const methods = current.paymentMethods || [];
  if (!methods.length) return current;

  const reordered = [
    ...methods.filter((item) => item.id === methodId).map((item) => ({ ...item, isDefault: true })),
    ...methods.filter((item) => item.id !== methodId).map((item) => ({ ...item, isDefault: false })),
  ];

  const defaultMethod = reordered[0] || null;
  const next = await saveBillingState({
    ...current,
    paymentMethod: defaultMethod,
    paymentMethods: reordered,
  });

  const { data } = await supabase.auth.getUser();
  await upsertCurrentTenantBillingProfile({
    cardBrand: defaultMethod?.brand || "",
    cardLast4: defaultMethod?.last4 || "",
    cardExpMonth: defaultMethod?.expiryMonth || "",
    cardExpYear: defaultMethod?.expiryYear || "",
    billingEmail: data.user?.email || "",
    cardHolderName: defaultMethod?.cardHolder || "",
  });

  return next;
};

export const deletePaymentMethod = async (methodId: string): Promise<BillingState> => {
  const current = await loadBillingState();
  const remaining = (current.paymentMethods || []).filter((method) => method.id !== methodId);
  const normalized = remaining.map((method, index) => ({ ...method, isDefault: index === 0 }));
  const defaultMethod = normalized[0] || null;

  const next = await saveBillingState({
    ...current,
    paymentMethod: defaultMethod,
    paymentMethods: normalized,
  });

  const { data } = await supabase.auth.getUser();
  await upsertCurrentTenantBillingProfile({
    cardBrand: defaultMethod?.brand || "",
    cardLast4: defaultMethod?.last4 || "",
    cardExpMonth: defaultMethod?.expiryMonth || "",
    cardExpYear: defaultMethod?.expiryYear || "",
    billingEmail: data.user?.email || "",
    cardHolderName: defaultMethod?.cardHolder || "",
  });

  return next;
};

export const savePlanSubscription = async (subscription: PlanSubscriptionMetrics): Promise<BillingState> => {
  const current = await loadBillingState();
  return saveBillingState({
    ...current,
    subscription,
  });
};

export const loadCurrentTenantPlanContract = async (): Promise<CurrentTenantPlanContract | null> => {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const optionName = buildOptionName(tenantId);
  const { data, error } = await supabase
    .from("settings_options")
    .select("description")
    .eq("option_type", CONTRACT_OPTION_TYPE)
    .eq("name", optionName)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.description) return null;

  const parsed = parseContractDescription(data.description);
  if (!parsed) return null;

  return {
    ...parsed,
    tenantId,
  };
};

export const cancelCurrentTenantSubscriptionAtPeriodEnd = async (): Promise<{
  success: boolean;
  status: string;
  cancelAtPeriodEnd: boolean;
}> => {
  const { data, error } = await supabase.functions.invoke("stripe-cancel-subscription", {
    body: { at_period_end: true },
  });

  if (error) {
    throw new Error(error.message || "Não foi possível solicitar o cancelamento da assinatura.");
  }

  const payload = (data || {}) as Record<string, unknown>;
  if (!payload.success) {
    throw new Error(String(payload.reason || "Não foi possível solicitar o cancelamento da assinatura."));
  }

  return {
    success: true,
    status: String(payload.status || "active"),
    cancelAtPeriodEnd: Boolean(payload.cancel_at_period_end),
  };
};
```

---

## ☁️&nbsp;4. Código-Fonte Backend Completo (Edge Functions)

### 4.1. Edge Function `stripe-cancel-subscription`
Esta função é executada de forma segura com o token JWT do usuário, cancelando a recorrência de faturamento ao fim do ciclo atual no Stripe e inserindo o evento administrativo:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTRACT_OPTION_TYPE = "tenant_plan_contract";
const OPTION_NAME_PREFIX = "tenant:";
const MASTER_FALLBACK_EMAILS = ["admin.master92@gruposls.com.br"];

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const normalizeEmail = (value: string) => String(value || "").trim().toLowerCase();

const getMasterEmails = () => {
  const raw = String(Deno.env.get("MASTER_EMAILS") || "");
  const envEmails = raw
    .split(/[;,\s]+/)
    .map((item) => normalizeEmail(item))
    .filter(Boolean);

  return Array.from(new Set([...MASTER_FALLBACK_EMAILS.map(normalizeEmail), ...envEmails]));
};

async function notifyMasters(
  supabase: ReturnType<typeof createClient>,
  input: { title: string; message: string; metadata?: Record<string, unknown> },
) {
  const masterEmailSet = new Set(getMasterEmails());
  if (!masterEmailSet.size) return;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,email,metadata")
    .limit(5000);

  const masterIds = (profiles || [])
    .map((row) => {
      const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
      const email = normalizeEmail(String(row?.email || metadata.email || ""));
      if (!email || !masterEmailSet.has(email)) return "";
      return String(row?.id || "").trim();
    })
    .filter(Boolean);

  if (!masterIds.length) return;

  const now = new Date();
  const date = now.toLocaleDateString("pt-BR");
  const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  await supabase.from("notifications").insert(
    masterIds.map((masterId) => ({
      id: crypto.randomUUID(),
      type: "sistema",
      title: input.title,
      message: input.message,
      is_read: false,
      metadata: {
        scope: "master_admin",
        date,
        time,
        source: "stripe-cancel-subscription",
        ...(input.metadata || {}),
      },
      created_by: masterId,
    })),
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, reason: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";

    if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey) {
      return jsonResponse({ success: false, reason: "missing_env" }, 500);
    }

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const accessToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!accessToken) return jsonResponse({ success: false, reason: "unauthorized" }, 401);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-02-24.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData.user?.id) {
      return jsonResponse({ success: false, reason: "unauthorized" }, 401);
    }

    const uid = String(authData.user.id);
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("metadata")
      .eq("id", uid)
      .maybeSingle();

    const metadata = profileRow?.metadata && typeof profileRow.metadata === "object" ? profileRow.metadata : {};
    const tenantId = typeof metadata.company_owner_id === "string" && metadata.company_owner_id.trim()
      ? metadata.company_owner_id.trim()
      : uid;

    let stripeSubscriptionId = "";

    const { data: contractRow } = await supabase
      .from("tenant_contracts")
      .select("stripe_subscription_id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    stripeSubscriptionId = String(contractRow?.stripe_subscription_id || "").trim();

    if (!stripeSubscriptionId) {
      const optionName = `${OPTION_NAME_PREFIX}${tenantId}`;
      const { data: optionRow } = await supabase
        .from("settings_options")
        .select("id,description")
        .eq("option_type", CONTRACT_OPTION_TYPE)
        .eq("name", optionName)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const parsed = parseJson<Record<string, unknown>>(optionRow?.description || null) || {};
      stripeSubscriptionId = String(parsed.stripeSubscriptionId || "").trim();
    }

    if (!stripeSubscriptionId) {
      return jsonResponse({ success: false, reason: "subscription_not_found" }, 404);
    }

    const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    const { data: companyRow } = await supabase
      .from("companies")
      .select("id,name")
      .eq("created_by", tenantId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const optionName = `${OPTION_NAME_PREFIX}${tenantId}`;
    const { data: existingOption } = await supabase
      .from("settings_options")
      .select("id,description")
      .eq("option_type", CONTRACT_OPTION_TYPE)
      .eq("name", optionName)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingOption?.id) {
      const parsed = parseJson<Record<string, unknown>>(existingOption.description || null) || {};
      const next = {
        ...parsed,
        tenantId,
        status: "active",
        cancelAtPeriodEnd: Boolean(updated.cancel_at_period_end),
        stripeSubscriptionId,
        updatedAt: new Date().toISOString(),
      };

      await supabase
        .from("settings_options")
        .update({ description: JSON.stringify(next), is_active: true })
        .eq("id", existingOption.id);
    }

    await supabase.from("subscription_events").insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      event_type: "subscription.cancel_at_period_end.requested",
      status: "processed",
      payload: {
        stripe_subscription_id: stripeSubscriptionId,
        cancel_at_period_end: Boolean(updated.cancel_at_period_end),
        current_period_end: Number(updated.current_period_end || 0),
        requested_by: uid,
      },
    }).catch(() => undefined);

    await notifyMasters(supabase, {
      title: "Cancelamento de Assinatura",
      message: `${String(companyRow?.name || "Empresa")} solicitou cancelamento da assinatura.`,
      metadata: {
        tenantId,
        stripeSubscriptionId,
        cancelAtPeriodEnd: true,
      },
    }).catch(() => undefined);

    return jsonResponse({
      success: true,
      tenant_id: tenantId,
      stripe_subscription_id: stripeSubscriptionId,
      status: String(updated.status || "active"),
      cancel_at_period_end: Boolean(updated.cancel_at_period_end),
      current_period_end: Number(updated.current_period_end || 0),
    });
  } catch (error) {
    return jsonResponse(
      { success: false, reason: "internal_error", error: String((error as Error)?.message || error) },
      500,
    );
  }
});
```

---

### 4.2. Edge Function `stripe-webhook`
A função Deno que recebe callbacks seguros da Stripe (`checkout.session.completed`, `invoice.payment_succeeded`, etc.), valida a assinatura HTTP cryptografada e concede os créditos ou atualiza limites:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const BILLING_OPTION_TYPE = "plan_billing_state";
const CONTRACT_OPTION_TYPE = "tenant_plan_contract";
const AI_CREDITS_ITEM_KEYS = new Set(["lia_credits", "ai_credits", "ai_tokens"]);

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Analisa a string serializada 'client_reference_id' da checkout session
const parseCheckoutReference = (session: Stripe.Checkout.Session) => {
  const empty = { tenantId: "", itemKey: "", quantity: 0, plan: "", cycle: "" };
  const raw = String(session.client_reference_id || "").trim();
  if (!raw || !raw.includes("|")) return { ...empty, tenantId: raw };

  const parts = raw.split("|");
  const map = new Map<string, string>();

  for (const part of parts) {
    const idx = part.indexOf(":");
    if (idx <= 0) continue;
    map.set(part.slice(0, idx).trim().toLowerCase(), part.slice(idx + 1).trim());
  }

  const rawCycle = String(map.get("cycle") || "").toLowerCase();
  const cycle = rawCycle === "annual" || rawCycle === "anual" ? "annual" : "monthly";

  return {
    tenantId: String(map.get("tenant") || "").trim(),
    itemKey: String(map.get("item") || "").trim().toLowerCase(),
    quantity: Math.max(0, Math.floor(Number(map.get("qty") || "0"))),
    plan: String(map.get("plan") || "").trim(),
    cycle,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false }, 405);

  const signature = req.headers.get("stripe-signature") || "";
  const bodyText = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(bodyText, signature, stripeWebhookSecret);
  } catch (err) {
    return jsonResponse({ error: "Signature verification failed", details: String(err) }, 400);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const ref = parseCheckoutReference(session);

    if (ref.tenantId) {
      // 1. Verificar se e compra de creditos de IA avulsos
      if (AI_CREDITS_ITEM_KEYS.has(ref.itemKey) && ref.quantity > 0) {
        await supabase.rpc("grant_tenant_ai_credits", {
          p_tenant_id: ref.tenantId,
          p_tokens: ref.quantity,
          p_event_type: "purchase",
          p_reference_id: `stripe_checkout:${session.id}`,
          p_metadata: { source: "stripe-webhook", session_id: session.id },
        });
      }

      // 2. Se for assinatura de plano de recorrencia
      if (session.mode === "subscription" && session.subscription) {
        // Salva contrato físico no banco de dados
        await supabase.from("tenant_contracts").insert({
          id: crypto.randomUUID(),
          tenant_id: ref.tenantId,
          plan_name: ref.plan || "Plano Assinado",
          billing_cycle: ref.cycle || "monthly",
          price: Number(session.amount_total || 0) / 100,
          status: "active",
          stripe_subscription_id: String(session.subscription),
          cancel_at_period_end: false,
        });

        // Grava no settings_options
        const optionName = `tenant:${ref.tenantId}`;
        const subscriptionPayload = {
          planName: ref.plan || "Plano Pro",
          billingCycle: ref.cycle || "monthly",
          price: Number(session.amount_total || 0) / 100,
          stripeSubscriptionId: String(session.subscription),
          updatedAt: new Date().toISOString(),
        };

        await supabase.from("settings_options").upsert({
          option_type: CONTRACT_OPTION_TYPE,
          name: optionName,
          description: JSON.stringify(subscriptionPayload),
          is_active: true,
          created_by: ref.tenantId,
        }, { onConflict: "option_type,name" });
      }
    }
  }

  return jsonResponse({ received: true });
});
```
