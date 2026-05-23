# 🤖 Manual de Implantação e Código: Agentes de IA — Grupo SLS

Este documento descreve detalhadamente o ecossistema de Inteligência Artificial do CRM, contemplando o fluxo assíncrono de orquestração de mensageria, tabelas do banco de dados, o código-fonte React completo para a listagem e controle de agentes, a sandbox interativa de testes e um backlog técnico completo de produção.

---

## 🏛️ 1. Como Funciona o Fluxo de Resposta de IA

O processamento das mensagens que entram no sistema e são auto-respondidas por agentes de IA é 100% orientado a eventos assíncronos:

```
                  [Mensagem Nova via Z-API Webhook]
                                 │
                                 ▼
                     [Edge: webhook-handler]
                                 │
                       (Persiste whatsapp_messages)
                                 │
                                 ▼
                   [Edge: auto-activate-agent]
                                 │
              (Resolve o agente sticky / instance / vendor)
                                 │
                                 ▼
                     [Edge: ai-auto-response]
                                 │
             (Valida working_hours, transfer_keywords)
                                 │
                                 ▼
                        [Edge: openai-chat]
                                 │
              (Carrega RAG embeddings do pgvector & GPT)
                                 │
                                 ▼
                        [Edge: send-message]
                                 │
                       (Dispara via Z-API)
```

---

## 🗄️ 2. Estrutura do Banco de Dados

### 2.1. Tabelas Principais do Módulo de IA
* `ai_agents` (Tabela Física):
  - `id` (uuid, PK)
  - `tenant_id` (uuid, FK -> profiles)
  - `name` (text): Nome amigável do bot.
  - `description` (text): Descrição amigável.
  - `type` (text): Tipo do bot (`prompt`, `rag`, `hybrid`).
  - `model` (text): Modelo da OpenAI (ex: `gpt-4`, `gpt-3.5-turbo`).
  - `system_prompt` (text): Regras de comportamento e personalidade.
  - `temperature` (numeric): Criatividade (0 a 1).
  - `max_tokens` (integer): Limite de tamanho da resposta.
  - `auto_respond` (boolean): Liga/desliga auto-resposta.
  - `working_hours_start` / `working_hours_end` (text): Horário de atuação do bot.
  - `is_active` (boolean): Flag global de ativação do agente.
  - `metadata` (jsonb): Contém configurações adicionais herdadas da UI (ex: avatar, avatarColor, activeDays, transferKeywords, etc.).

* `ai_conversation_sessions`:
  - `id` (uuid, PK)
  - `conversation_id` (uuid, FK -> whatsapp_conversations)
  - `agent_id` (uuid, FK -> ai_agents)
  - `status` (text): Estado (`active` ou `ended`).
  - `is_active` (boolean): Flag de controle de envio.
  - `messages_handled` (integer): Contador de turnos da IA para human takeover automático.

* `ai_knowledge_base` (Base de RAG):
  - `id` (uuid, PK)
  - `agent_id` (uuid, FK -> ai_agents)
  - `title` (text): Título do documento ou FAQ.
  - `content` (text): Conteúdo de texto.
  - `embedding` (vector, 1536): Vetor do pgvector para busca de similaridade de cosseno gerado via modelo `text-embedding-ada-002`.

---

## ⚛️ 3. Código-Fonte Frontend Completo

### 3.1. `src/app/pages/admin/AIAgentsPage.tsx`
Este arquivo é o painel de listagem e controle geral de agentes de IA, contendo métricas, filtros, ações de desativação global em cascata nas conversas e a estrutura de dados:

```typescript
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Bot, Plus, BarChart2, Power, BookOpen, TrendingUp,
  MoreVertical, MessageSquare, Star, Search, Filter,
  Pencil, Trash2, Copy, ToggleLeft, ToggleRight
} from "lucide-react";
import { supabase } from "../../../lib/supabase";

export interface AIAgent {
  id: string;
  name: string;
  description: string;
  type: "prompt" | "rag" | "hybrid";
  active: boolean;
  interactions: number;
  rating: number;
  avatar?: string;
  avatarColor: string;
  createdAt: string;
  createdBy?: string;
  model?: string;
  systemPrompt?: string;
  contextInstructions?: string;
  temperature?: number;
  maxTokens?: number;
  embeddingModel?: string;
  maxDocs?: number;
  similarityThreshold?: number;
  allowAll?: boolean;
  allowedProfiles?: string[];
  selectedNumbers?: string[];
  autoReply?: boolean;
  scheduleStart?: string;
  scheduleEnd?: string;
  activeDays?: string[];
  transferKeywords?: string;
  maxMessages?: number;
  transferMessage?: string;
  transferMembers?: string[];
  greetingMessage?: string;
  farewellMessage?: string;
}

const TYPE_LABEL: Record<AIAgent["type"], string> = {
  prompt: "PROMPT",
  rag: "RAG",
  hybrid: "HÍBRIDO",
};

const TYPE_COLOR: Record<AIAgent["type"], string> = {
  prompt: "bg-purple-100 text-purple-700 border border-purple-300 dark:bg-purple-600/20 dark:text-purple-300 dark:border-purple-500/30",
  rag: "bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-600/20 dark:text-blue-300 dark:border-blue-500/30",
  hybrid: "bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-600/20 dark:text-emerald-300 dark:border-emerald-500/30",
};

let _agents: AIAgent[] = [];
export function getAgents() { return _agents; }
export function setAgents(a: AIAgent[]) { _agents = a; }

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

function normalizeType(value: string | null | undefined): AIAgent["type"] {
  if (value === "rag" || value === "hybrid") return value;
  return "prompt";
}

function mapRowToAgent(row: any): AIAgent {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const rag = metadata.rag && typeof metadata.rag === "object" ? metadata.rag : {};
  const permissions = metadata.permissions && typeof metadata.permissions === "object" ? metadata.permissions : {};
  const whatsapp = metadata.whatsapp && typeof metadata.whatsapp === "object" ? metadata.whatsapp : {};

  return {
    id: row.id,
    name: row.name ?? "Agente",
    description: row.description ?? "",
    type: normalizeType(row.type),
    active: Boolean(row.is_active ?? true),
    interactions: Number(metadata.interactions ?? 0),
    rating: Number(metadata.rating ?? 0),
    avatar: metadata.avatar,
    avatarColor: metadata.avatarColor ?? "#9333ea",
    createdAt: String(row.created_at ?? "").slice(0, 10),
    createdBy: String(row.created_by ?? ""),
    model: row.model ?? undefined,
    systemPrompt: row.system_prompt ?? "",
    contextInstructions: String(metadata.contextInstructions ?? ""),
    temperature: Number(row.temperature ?? 0.7),
    maxTokens: Number(row.max_tokens ?? 1000),
    embeddingModel: String(rag.embeddingModel ?? "text-embedding-ada-002"),
    maxDocs: Number(rag.maxDocs ?? 5),
    similarityThreshold: Number(rag.similarityThreshold ?? 0.7),
    allowAll: Boolean(permissions.allowAll ?? false),
    allowedProfiles: Array.isArray(permissions.allowedProfiles) ? permissions.allowedProfiles : ["Admin", "Manager", "Sales", "Support"],
    selectedNumbers: Array.isArray(whatsapp.selectedNumbers) ? whatsapp.selectedNumbers : [],
    autoReply: Boolean(row.auto_respond ?? whatsapp.autoReply ?? false),
    scheduleStart: typeof row.working_hours_start === "string" ? row.working_hours_start : (String(whatsapp.scheduleStart ?? "08:00")),
    scheduleEnd: typeof row.working_hours_end === "string" ? row.working_hours_end : (String(whatsapp.scheduleEnd ?? "18:00")),
    activeDays: Array.isArray(whatsapp.activeDays) ? whatsapp.activeDays : ["Seg", "Ter", "Qua", "Qui", "Sex"],
    transferKeywords: String(whatsapp.transferKeywords ?? "atendente, humano, pessoa, falar com alguém"),
    maxMessages: Number(whatsapp.maxMessages ?? 20),
    transferMessage: String(whatsapp.transferMessage ?? "Vou transferir você para um de nossos atendentes. Aguarde um momento."),
    transferMembers: Array.isArray(whatsapp.transferMembers) ? whatsapp.transferMembers : [],
    greetingMessage: String(whatsapp.greetingMessage ?? "Olá! Sou o {AGENT_NAME}, como posso ajudar?"),
    farewellMessage: String(whatsapp.farewellMessage ?? "Foi um prazer ajudar! Até logo!"),
  };
}

const ADMIN_ROLES = ["admin", "administrador", "gerente"];

async function getUserAgentContext(): Promise<{ uid: string; ownerId: string; isAdmin: boolean } | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return null;
  const uid = data.user.id;
  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata,role")
    .eq("id", uid)
    .maybeSingle();
  const meta = profile?.metadata && typeof profile.metadata === "object" ? (profile.metadata as Record<string, unknown>) : {};
  const ownerId = typeof meta.company_owner_id === "string" && meta.company_owner_id.trim() ? meta.company_owner_id.trim() : uid;
  const role = String(profile?.role || "vendedor").toLowerCase();
  return { uid, ownerId, isAdmin: ADMIN_ROLES.includes(role) };
}

export async function ensureAgentsLoaded() {
  const ctx = await getUserAgentContext();
  if (!ctx) {
    _agents = [];
    return _agents;
  }

  const { uid, ownerId, isAdmin } = ctx;

  const { data: rows, error } = await supabase
    .from("ai_agents")
    .select("id,name,description,type,model,system_prompt,temperature,max_tokens,auto_respond,working_hours_start,working_hours_end,is_active,metadata,created_at,created_by")
    .eq("tenant_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  let agentRows = rows ?? [];
  if (!isAdmin) {
    agentRows = agentRows.filter((row: any) => String(row.created_by || "") === uid);
  }

  _agents = agentRows.map(mapRowToAgent);
  return _agents;
}

export async function addAgent(a: AIAgent) {
  const ctx = await getUserAgentContext();
  if (!ctx) throw new Error("Usuário não autenticado.");
  const { uid, ownerId, isAdmin } = ctx;

  if (!isAdmin) {
    const { count } = await supabase
      .from("ai_agents")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ownerId)
      .eq("created_by", uid);
    if ((count ?? 0) >= 1) {
      throw new Error("Vendedores podem ter apenas 1 agente. Edite o agente existente.");
    }
  }

  const { data, error } = await supabase
    .from("ai_agents")
    .insert({
      tenant_id: ownerId,
      name: a.name,
      description: a.description,
      type: a.type,
      model: a.model ?? null,
      system_prompt: a.systemPrompt ?? null,
      temperature: Number.isFinite(Number(a.temperature)) ? Number(a.temperature) : 0.7,
      max_tokens: Number.isFinite(Number(a.maxTokens)) ? Number(a.maxTokens) : 1000,
      auto_respond: Boolean(a.autoReply),
      working_hours_start: a.scheduleStart ?? "08:00",
      working_hours_end: a.scheduleEnd ?? "18:00",
      is_active: a.active,
      metadata: {
        avatar: a.avatar,
        avatarColor: a.avatarColor,
        interactions: a.interactions,
        rating: a.rating,
        contextInstructions: a.contextInstructions ?? "",
        rag: {
          embeddingModel: a.embeddingModel ?? "text-embedding-ada-002",
          maxDocs: Number.isFinite(Number(a.maxDocs)) ? Number(a.maxDocs) : 5,
          similarityThreshold: Number.isFinite(Number(a.similarityThreshold)) ? Number(a.similarityThreshold) : 0.7,
        },
        permissions: {
          allowAll: Boolean(a.allowAll),
          allowedProfiles: Array.isArray(a.allowedProfiles) ? a.allowedProfiles : ["Admin", "Manager", "Sales", "Support"],
        },
        whatsapp: {
          selectedNumbers: Array.isArray(a.selectedNumbers) ? a.selectedNumbers : [],
          autoReply: Boolean(a.autoReply),
          scheduleStart: a.scheduleStart ?? "08:00",
          scheduleEnd: a.scheduleEnd ?? "18:00",
          activeDays: Array.isArray(a.activeDays) ? a.activeDays : ["Seg", "Ter", "Qua", "Qui", "Sex"],
          transferKeywords: a.transferKeywords ?? "atendente, humano, pessoa, falar com alguém",
          maxMessages: Number.isFinite(Number(a.maxMessages)) ? Number(a.maxMessages) : 20,
          transferMessage: a.transferMessage ?? "Vou transferir você para um de nossos atendentes. Aguarde um momento.",
          transferMembers: Array.isArray(a.transferMembers) ? a.transferMembers : [],
          greetingMessage: a.greetingMessage ?? "Olá! Sou o {AGENT_NAME}, como posso ajudar?",
          farewellMessage: a.farewellMessage ?? "Foi um prazer ajudar! Até logo!",
        },
      },
      created_by: uid,
    })
    .select("id,created_at")
    .single();

  if (error) throw error;

  const created = {
    ...a,
    id: data.id as string,
    createdAt: String(data.created_at ?? a.createdAt ?? "").slice(0, 10),
    createdBy: uid,
  };
  _agents = [..._agents, created];
  return created;
}

export async function updateAgent(id: string, patch: Partial<AIAgent>) {
  const current = _agents.find((item) => item.id === id);
  if (!current) return;
  const merged = { ...current, ...patch };

  const existingMetadata = {
    avatar: current.avatar,
    avatarColor: current.avatarColor,
    interactions: current.interactions,
    rating: current.rating,
    contextInstructions: current.contextInstructions ?? "",
    rag: {
      embeddingModel: current.embeddingModel ?? "text-embedding-ada-002",
      maxDocs: Number.isFinite(Number(current.maxDocs)) ? Number(current.maxDocs) : 5,
      similarityThreshold: Number.isFinite(Number(current.similarityThreshold)) ? Number(current.similarityThreshold) : 0.7,
    },
    permissions: {
      allowAll: Boolean(current.allowAll),
      allowedProfiles: Array.isArray(current.allowedProfiles) ? current.allowedProfiles : ["Admin", "Manager", "Sales", "Support"],
    },
    whatsapp: {
      selectedNumbers: Array.isArray(current.selectedNumbers) ? current.selectedNumbers : [],
      autoReply: Boolean(current.autoReply),
      scheduleStart: current.scheduleStart ?? "08:00",
      scheduleEnd: current.scheduleEnd ?? "18:00",
      activeDays: Array.isArray(current.activeDays) ? current.activeDays : ["Seg", "Ter", "Qua", "Qui", "Sex"],
      transferKeywords: current.transferKeywords ?? "atendente, humano, pessoa, falar com alguém",
      maxMessages: Number.isFinite(Number(current.maxMessages)) ? Number(current.maxMessages) : 20,
      transferMessage: current.transferMessage ?? "Vou transferir você para um de nossos atendentes. Aguarde um momento.",
      transferMembers: Array.isArray(current.transferMembers) ? current.transferMembers : [],
      greetingMessage: current.greetingMessage ?? "Olá! Sou o {AGENT_NAME}, como posso ajudar?",
      farewellMessage: current.farewellMessage ?? "Foi um prazer ajudar! Até logo!",
    },
  };

  const { error } = await supabase
    .from("ai_agents")
    .update({
      name: merged.name,
      description: merged.description,
      type: merged.type,
      model: merged.model ?? null,
      system_prompt: merged.systemPrompt ?? null,
      temperature: Number.isFinite(Number(merged.temperature)) ? Number(merged.temperature) : 0.7,
      max_tokens: Number.isFinite(Number(merged.maxTokens)) ? Number(merged.maxTokens) : 1000,
      auto_respond: Boolean(merged.autoReply),
      working_hours_start: merged.scheduleStart ?? "08:00",
      working_hours_end: merged.scheduleEnd ?? "18:00",
      is_active: merged.active,
      metadata: {
        ...existingMetadata,
        avatar: merged.avatar,
        avatarColor: merged.avatarColor,
        interactions: merged.interactions,
        rating: merged.rating,
        contextInstructions: merged.contextInstructions ?? "",
        rag: {
          embeddingModel: merged.embeddingModel ?? "text-embedding-ada-002",
          maxDocs: Number.isFinite(Number(merged.maxDocs)) ? Number(merged.maxDocs) : 5,
          similarityThreshold: Number.isFinite(Number(merged.similarityThreshold)) ? Number(merged.similarityThreshold) : 0.7,
        },
        permissions: {
          allowAll: Boolean(merged.allowAll),
          allowedProfiles: Array.isArray(merged.allowedProfiles) ? merged.allowedProfiles : ["Admin", "Manager", "Sales", "Support"],
        },
        whatsapp: {
          selectedNumbers: Array.isArray(merged.selectedNumbers) ? merged.selectedNumbers : [],
          autoReply: Boolean(merged.autoReply),
          scheduleStart: merged.scheduleStart ?? "08:00",
          scheduleEnd: merged.scheduleEnd ?? "18:00",
          activeDays: Array.isArray(merged.activeDays) ? merged.activeDays : ["Seg", "Ter", "Qua", "Qui", "Sex"],
          transferKeywords: merged.transferKeywords ?? "atendente, humano, pessoa, falar com alguém",
          maxMessages: Number.isFinite(Number(merged.maxMessages)) ? Number(merged.maxMessages) : 20,
          transferMessage: merged.transferMessage ?? "Vou transferir você para um de nossos atendentes. Aguarde um momento.",
          transferMembers: Array.isArray(merged.transferMembers) ? merged.transferMembers : [],
          greetingMessage: merged.greetingMessage ?? "Olá! Sou o {AGENT_NAME}, como posso ajudar?",
          farewellMessage: merged.farewellMessage ?? "Foi um prazer ajudar! Até logo!",
        },
      },
    })
    .eq("id", id);

  if (error) throw error;

  _agents = _agents.map((item) => (item.id === id ? merged : item));
  return merged;
}

export async function removeAgent(id: string) {
  const { error } = await supabase.from("ai_agents").delete().eq("id", id);
  if (error) throw error;
  _agents = _agents.filter((item) => item.id !== id);
}

export default function AIAgentsPage() {
  const navigate = useNavigate();
  const [agents, setLocalAgents] = useState<AIAgent[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void ensureAgentsLoaded().then((rows) => {
      if (active) setLocalAgents(rows);
    });
    return () => { active = false; };
  }, []);

  const filtered = agents.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || a.type === typeFilter;
    return matchSearch && matchType;
  });

  const totalActive = agents.filter(a => a.active).length;
  const totalRAG = agents.filter(a => a.type === "rag" || a.type === "hybrid").length;
  const totalInteractions = agents.reduce((sum, a) => sum + a.interactions, 0);

  const toggleActive = async (id: string) => {
    const next = agents.map(a => a.id === id ? { ...a, active: !a.active } : a);
    setLocalAgents(next);
    const target = next.find((item) => item.id === id);
    if (target) {
      try {
        await updateAgent(id, { active: target.active });

        // Ao desativar agente, desliga IA nas conversas associadas
        if (!target.active) {
          const disabledAt = new Date().toISOString();
          const [assignedResult, stickyResult] = await Promise.allSettled([
            target.createdBy ? supabase.from("whatsapp_conversations").select("id,metadata").eq("assigned_to", target.createdBy) : Promise.resolve({ data: [] }),
            supabase.from("whatsapp_conversations").select("id,metadata").filter("metadata->>ai_assigned_agent_id", "eq", target.id),
          ]);

          const assignedRows = assignedResult.status === "fulfilled" ? (assignedResult.value as any).data ?? [] : [];
          const stickyRows = stickyResult.status === "fulfilled" ? (stickyResult.value as any).data ?? [] : [];
          const allRowsMap = new Map<string, any>();
          for (const row of [...assignedRows, ...stickyRows]) {
            if (row?.id) allRowsMap.set(row.id, row);
          }
          const allRows = Array.from(allRowsMap.values());

          if (allRows.length > 0) {
            await Promise.allSettled(
              allRows.map((row: any) => {
                const existingMeta = row.metadata && typeof row.metadata === "object" ? { ...row.metadata } : {};
                return supabase
                  .from("whatsapp_conversations")
                  .update({
                    metadata: {
                      ...existingMeta,
                      ai_enabled: false,
                      ai_disabled_reason: "agent_deactivated",
                      ai_disabled_at: disabledAt,
                    },
                  })
                  .eq("id", row.id);
              }),
            );
          }
        }
      } catch {
        setLocalAgents(agents);
      }
    }
    setOpenMenu(null);
  };

  const deleteAgent = async (id: string) => {
    const next = agents.filter(a => a.id !== id);
    setLocalAgents(next);
    try {
      await removeAgent(id);
    } catch {
      setLocalAgents(agents);
    }
    setOpenMenu(null);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bot size={28} className="text-purple-600" />
          <div>
            <h1 className="text-gray-900 dark:text-white text-xl font-bold">Agentes de IA</h1>
            <p className="text-gray-500 text-xs">{totalActive} ativos • {totalInteractions} interações</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/admin/agents/new")}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm px-4 py-2 font-semibold transition"
        >
          Novo Agente
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filtered.map(agent => (
          <div key={agent.id} className="bg-white border rounded-2xl p-5 shadow-sm hover:shadow transition relative group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: agent.avatarColor }}>🤖</div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{agent.name}</h3>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest">{TYPE_LABEL[agent.type]}</span>
                </div>
              </div>
              <button onClick={() => toggleActive(agent.id)} className="p-1 hover:bg-gray-100 rounded">
                <Power size={16} className={agent.active ? "text-green-600" : "text-gray-400"} />
              </button>
            </div>
            <p className="text-xs text-gray-600 mb-4 h-10 overflow-hidden line-clamp-2">{agent.description}</p>
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/admin/agents/${agent.id}/test`)}
                disabled={!agent.active}
                className="flex-1 py-1.5 border rounded-lg text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-40"
              >
                Testar Agente
              </button>
              <button
                onClick={() => deleteAgent(agent.id)}
                className="p-1.5 text-red-500 hover:bg-red-50 border rounded-lg transition"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 3.2. `src/app/pages/admin/AgentTestPage.tsx`
A sandbox interativa que emula o comportamento do bot em tempo real, gravando auditoria das interações de IA:

```typescript
import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { X, Send, RotateCcw, Star, Cpu, Clock, Menu, Loader2 } from "lucide-react";
import { ensureAgentsLoaded, getAgents, updateAgent } from "./AIAgentsPage";
import { runAgentPrompt } from "../../services/aiRuntimeService";
import { createAiAgentInteraction, listRecentAiAgentConversations } from "../../services/aiAgentInteractionsService";

interface Message {
  id: string;
  role: "user" | "agent";
  text: string;
  time: string;
}

interface RecentConversation {
  id: string;
  preview: string;
  time: string;
}

function formatTime() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function AgentTestPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState(() => getAgents().find(a => a.id === id) ?? {
    id: id ?? "agent_1", name: "Especialista", description: "Especialista em vendas do CRM",
    type: "prompt" as const, active: true, interactions: 0, rating: 5.0, avatarColor: "#9333ea", createdAt: "2024-01-15", model: "gpt-4",
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);
  const [runtimeWarning, setRuntimeWarning] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    let active = true;
    void ensureAgentsLoaded().then(() => {
      if (!active) return;
      const found = getAgents().find((item) => item.id === id);
      if (found) setAgent(found);
    });
    void listRecentAiAgentConversations(agent.name).then(rows => {
      if (active) setRecentConversations(rows);
    });
    return () => { active = false; };
  }, [id]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    if (!agent.active) {
      setRuntimeWarning("Agente inativo. Ative o bot antes de testá-lo.");
      return;
    }

    const userText = input.trim();
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text: userText, time: formatTime() };
    setMessages(p => [...p, userMsg]);
    setInput("");
    setStarted(true);
    setLoading(true);
    setRuntimeWarning(null);

    const history = messages.map(item => ({ role: item.role, text: item.text }));
    const result = await runAgentPrompt({
      agentId: agent.id,
      agentName: agent.name,
      model: agent.model,
      prompt: userText,
      history,
    });

    if (!result.ok || !result.text.trim()) {
      setRuntimeWarning(result.error ?? "Falha de comunicação com o runtime do bot.");
      setLoading(false);
      return;
    }

    const replyMessage = { id: crypto.randomUUID(), role: "agent" as const, text: result.text, time: formatTime() };
    setMessages(p => [...p, replyMessage]);

    try {
      await createAiAgentInteraction({
        agentId: agent.id,
        agentName: agent.name,
        model: agent.model ?? "gpt-4",
        userMessage: userText,
        responseMessage: result.text,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
        source: result.source,
        createdAt: new Date().toISOString(),
      });
      const nextInteractions = (agent.interactions ?? 0) + 1;
      setAgent(p => ({ ...p, interactions: nextInteractions }));
      await updateAgent(agent.id, { interactions: nextInteractions });
    } catch {
      // erro silencioso
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
      <div className="bg-white border rounded-2xl shadow-2xl flex flex-col overflow-hidden w-full max-w-lg h-[80vh]">
        {/* Topbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: agent.avatarColor }}>🤖</div>
            <div>
              <p className="text-sm font-semibold">{agent.name}</p>
              <p className="text-[10px] text-green-600">Online • {agent.type.toUpperCase()}</p>
            </div>
          </div>
          <button onClick={() => navigate("/admin/agents")} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!started ? (
            <div className="text-center py-12">
              <Bot size={40} className="mx-auto text-purple-500 mb-2" />
              <h3 className="font-semibold text-sm">Testar Bot: {agent.name}</h3>
              <p className="text-xs text-gray-500 px-6 mt-1">{agent.description}</p>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`px-4 py-2 rounded-2xl text-sm max-w-[80%] ${msg.role === "user" ? "bg-emerald-600 text-white" : "bg-gray-100 border text-gray-800"}`}>
                  {msg.text}
                </div>
              </div>
            ))
          )}
          {loading && <Loader2 size={16} className="animate-spin text-purple-600" />}
        </div>

        {/* Input */}
        <div className="p-4 border-t bg-gray-50 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Digite sua mensagem..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-purple-600"
          />
          <button onClick={sendMessage} className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"><Send size={15} /></button>
        </div>
      </div>
    </div>
  );
}
```

---

## 🛠️ 4. Backlog de Correções Críticas para Produção

Para colocar o módulo de Agentes de IA em produção de forma estável, o desenvolvedor/agente deve resolver as seguintes pendências técnicas descritas abaixo:

1. **Sincronização Física dos Campos do Formulário (`AIAgentsPage.tsx` -> `ai_agents`)**:
   - **Gargalo**: A tela React salva propriedades dentro do campo JSON `metadata` (ex: `metadata.whatsapp.selectedNumbers`). As Edge Functions antigas leem o registro procurando colunas físicas diretas.
   - **Ação**: Criar e migrar fisicamente as colunas `transfer_keywords text[]` e `whatsapp_instance_ids uuid[]` na tabela `ai_agents` e ajustar a função `addAgent`/`updateAgent` do frontend para gravar dados de forma achatada em colunas físicas diretas e JSON simultaneamente.

2. **Bypass Seguro de RLS usando `SUPABASE_SERVICE_ROLE_KEY` nas Edge Functions**:
   - **Gargalo**: Quando as mensagens chegam da Z-API via webhook, elas entram sem usuário autenticado. Se as regras de RLS forem rígidas, a gravação de sessões (`ai_conversation_sessions`) ou metadados de chat falhará.
   - **Ação**: Inicializar o cliente Supabase utilizando a Service Role Key apenas dentro das funções de background (`webhook-handler`, `auto-activate-agent`, `ai-auto-response`).

3. **Geração Automática de Vetores de FAQ (RAG Embeddings Trigger)**:
   - **Gargalo**: Quando cadastrados novos registros em `ai_knowledge_base`, a coluna `embedding` fica vazia. Sem ela, a busca vetorial por cosseno retorna vazia.
   - **Ação**: Criar um database trigger no PostgreSQL (`AFTER INSERT ON ai_knowledge_base`) que invoca a Edge Function `generate-embedding` passando o `id` e `content` do novo documento. A Edge function requisita o embedding `text-embedding-ada-002` da OpenAI e persiste os vetores gerados de 1536 dimensões automaticamente.
