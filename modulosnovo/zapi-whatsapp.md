# 📱 Manual de Implantação e Código: WhatsApp & Z-API — Grupo SLS

Este documento descreve detalhadamente o ecossistema de mensageria do WhatsApp via Z-API, incluindo tabelas do banco de dados, fluxos de orquestração, o código-fonte React completo para a tela de gerenciamento de instâncias e o código Deno completo da Edge Function de proxy de conexões.

---

## 🏛️ 1. Como Funciona a Orquestração do WhatsApp

A integração com o WhatsApp é baseada na API oficial da Z-API e estruturada de forma multi-tenant, permitindo que cada vendedor, gerente ou administrador conecte sua própria linha do WhatsApp (instância) e automatize seus leads.

```
                  [Painel de Administracao React]
                                │
                      (Acoes: qrcode, status)
                                │
                                ▼
                   [Edge Function: whatsapp-instance]
                                │
              (Proxy seguro com Client-Token e Instance ID)
                                │
                                ▼
                       [API Z-API Oficial]
                                │
             (Status / Imagem QR Code / Desconexao)
```

---

## 🗄️ 2. Estrutura do Banco de Dados

### 2.1. Tabela `whatsapp_instances`
Armazena as configurações e o status das linhas conectadas:
* `id` (uuid, PK): Identificador interno do registro.
* `tenant_id` (uuid, FK -> profiles): Dono (empresa/administrador).
* `name` (text): Nome amigável (ex: "WhatsApp Suporte").
* `instance_id` (text): ID da instância no painel Z-API.
* `token` (text): Token de autenticação da instância no Z-API.
* `client_token` (text, nullable): Client-Token de segurança da Z-API.
* `webhook_url` (text, nullable): Webhook de contingência secundária.
* `status` (text): Status de conexão (`connected`, `disconnected`, `qr_pending`).
* `phone_number` (text, nullable): Número do WhatsApp da linha conectada.
* `messages_sent` (integer): Contador de mensagens disparadas por essa linha.
* `messages_received` (integer): Contador de mensagens recebidas.
* `agent_id` (uuid, FK -> ai_agents, nullable): Agente de IA padrão desta instância.
* `owner_user_id` (uuid, FK -> profiles, nullable): Vendedor padrão responsável pelos novos leads desta linha.
* `is_active` (boolean): Flag de atividade da linha.

### 2.2. Tabela `whatsapp_conversations`
Representa um chat aberto com um número de cliente:
* `id` (uuid, PK): ID único.
* `tenant_id` (uuid, FK): Tenant proprietário.
* `instance_id` (uuid, FK -> whatsapp_instances): Instância pela qual o chat é mantido.
* `phone` (text): Telefone do cliente (ex: `5511999999999`).
* `name` (text, nullable): Nome salvo no WhatsApp do cliente.
* `assigned_to` (uuid, FK -> profiles, nullable): Operador/Vendedor atual responsável.
* `metadata` (jsonb): Dicionário contendo `ai_enabled` (boolean), `ai_assigned_agent_id` (uuid, agente sticky), etc.

### 2.3. Tabela `whatsapp_messages`
Registra o histórico de mensagens:
* `id` (uuid, PK): ID único.
* `conversation_id` (uuid, FK -> whatsapp_conversations).
* `message_id` (text): ID oficial da mensagem retornado pela Z-API.
* `direction` (text): Sentido (`inbound` / `outbound`).
* `from_me` (boolean): Se foi disparada por nós.
* `body` (text): Conteúdo em texto.
* `media_url` (text, nullable): Link da mídia recebida.
* `media_type` (text, nullable): Tipo (`image`, `audio`, `document`).
* `status` (text): Entrega (`sent`, `delivered`, `read`).

---

## ⚛️ 3. Código-Fonte Frontend Completo

### 3.1. `src/app/services/whatsappInstancesService.ts`
Este arquivo faz as chamadas de banco e invoca a Edge Function de proxy para conexões de QR Code:

```typescript
import { supabase } from "../lib/supabase";

export interface WhatsappInstanceRecord {
  id: string;
  name: string;
  instanceId: string;
  token: string;
  clientToken: string | null;
  webhookUrl: string | null;
  status: "connected" | "disconnected" | "qr_pending";
  phoneNumber: string | null;
  messagesSent: number;
  messagesReceived: number;
  isActive: boolean;
  agentId: string | null;
  ownerUserId: string | null;
  createdAt: string;
}

export async function listWhatsappInstances(): Promise<WhatsappInstanceRecord[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", user.id)
    .maybeSingle();

  const meta = profile?.metadata && typeof profile.metadata === "object"
    ? (profile.metadata as Record<string, any>)
    : {};
  const ownerId = typeof meta.company_owner_id === "string" && meta.company_owner_id.trim()
    ? meta.company_owner_id.trim()
    : user.id;

  const { data, error } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("tenant_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    instanceId: row.instance_id || row.instance_key || "",
    token: row.token || "",
    clientToken: row.client_token || null,
    webhookUrl: row.webhook_url || null,
    status: row.status || "disconnected",
    phoneNumber: row.phone_number || null,
    messagesSent: Number(row.messages_sent || 0),
    messagesReceived: Number(row.messages_received || 0),
    isActive: Boolean(row.is_active ?? true),
    agentId: row.agent_id || null,
    ownerUserId: row.owner_user_id || null,
    createdAt: row.created_at,
  }));
}

export async function createWhatsappInstance(params: {
  name: string;
  instanceKey: string;
  token: string;
  clientToken?: string;
  provider?: string;
  agentId?: string | null;
  ownerUserId?: string | null;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", user.id)
    .maybeSingle();

  const meta = profile?.metadata && typeof profile.metadata === "object"
    ? (profile.metadata as Record<string, any>)
    : {};
  const ownerId = typeof meta.company_owner_id === "string" && meta.company_owner_id.trim()
    ? meta.company_owner_id.trim()
    : user.id;

  const { data, error } = await supabase
    .from("whatsapp_instances")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: ownerId,
      name: params.name,
      instance_id: params.instanceKey,
      token: params.token,
      client_token: params.clientToken || null,
      status: "disconnected",
      is_active: true,
      agent_id: params.agentId || null,
      owner_user_id: params.ownerUserId || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateWhatsappInstance(id: string, patch: Partial<Omit<WhatsappInstanceRecord, "id" | "createdAt">>) {
  const dbPatch: Record<string, any> = {};

  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.token !== undefined) dbPatch.token = patch.token;
  if (patch.clientToken !== undefined) dbPatch.client_token = patch.clientToken;
  if (patch.webhookUrl !== undefined) dbPatch.webhook_url = patch.webhookUrl;
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;
  if (patch.agentId !== undefined) dbPatch.agent_id = patch.agentId;
  if (patch.ownerUserId !== undefined) dbPatch.owner_user_id = patch.ownerUserId;

  const { error } = await supabase
    .from("whatsapp_instances")
    .update(dbPatch)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteWhatsappInstance(id: string) {
  const { error } = await supabase
    .from("whatsapp_instances")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Invocadores de Edge Functions Proxy Z-API
export async function connectWhatsappInstance(id: string) {
  const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
    body: { action: "connect", instance_id: id },
  });
  if (error) throw error;
  return data;
}

export async function getWhatsappInstanceQrCode(id: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
    body: { action: "qrcode", instance_id: id },
  });
  if (error) throw error;
  return data?.qr_code || null;
}

export async function getWhatsappInstanceConnectionStatus(id: string): Promise<{ connected: boolean; phoneNumber: string | null }> {
  const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
    body: { action: "status", instance_id: id },
  });
  if (error) throw error;
  return {
    connected: Boolean(data?.connected),
    phoneNumber: data?.phone_number || null,
  };
}

export async function disconnectWhatsappInstance(id: string) {
  const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
    body: { action: "disconnect", instance_id: id },
  });
  if (error) throw error;
  return data;
}
```

---

### 3.2. `src/app/pages/admin/WhatsAppInstances.tsx`
A tela completa com a listagem de instâncias, modais de conexão dinâmica com Pooling automático (a cada `3s`), seleção de Agentes de IA e de Vendedores responsáveis:

```typescript
import { useEffect, useState } from "react";
import { Plus, Power, PowerOff, Phone, Battery, MessageSquare, Trash2, QrCode, Settings as SettingsIcon, X, Wifi, WifiOff, Bot } from "lucide-react";
import {
  connectWhatsappInstance,
  createWhatsappInstance,
  deleteWhatsappInstance,
  disconnectWhatsappInstance,
  getWhatsappInstanceConnectionStatus,
  getWhatsappInstanceQrCode,
  listWhatsappInstances,
  updateWhatsappInstance,
} from "../../services/whatsappInstancesService";
import { ensureAgentsLoaded, type AIAgent } from "./AIAgentsPage";
import { listUserProfiles, type UserProfileItem } from "../../services/userProfilesService";
import { useAuth } from "../../context/AuthContext";
import { hasAnyRole } from "../../utils/roleAccess";

interface WhatsAppInstance {
  id: string;
  name: string;
  instanceId: string;
  status: "connected" | "disconnected" | "qr_pending";
  phone: string;
  messagesSent: number;
  messagesReceived: number;
  battery: number;
  enabled: boolean;
  token?: string | null;
  clientToken?: string | null;
  webhookUrl?: string | null;
  agentId?: string | null;
  ownerUserId?: string | null;
}

type InstanceConfigForm = {
  name: string;
  token: string;
  clientToken: string;
  webhookUrl: string;
  agentId: string;
  ownerUserId: string;
};

export default function WhatsAppInstances() {
  const { profile, user } = useAuth();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [owners, setOwners] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState<InstanceConfigForm>({
    name: "",
    token: "",
    clientToken: "",
    webhookUrl: "",
    agentId: "",
    ownerUserId: "",
  });
  const [configStatusText, setConfigStatusText] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    instanceId: "",
    token: "",
    clientToken: "",
    webhookUrl: "",
    isPrincipal: false,
    agentId: "",
    ownerUserId: "",
  });
  const currentRole = profile?.role ?? (user?.user_metadata as any)?.role ?? null;
  const canManageInstances = hasAnyRole(currentRole, ["admin", "administrador", "gerente", "manager"]);

  const loadInstances = async () => {
    try {
      setErrorMessage(null);
      const records = await listWhatsappInstances();
      setInstances(
        records.map((record) => ({
          id: record.id,
          name: record.name,
          instanceId: record.instanceId,
          status: record.status,
          phone: record.phoneNumber || "-",
          messagesSent: Number(record.messagesSent || 0),
          messagesReceived: Number(record.messagesReceived || 0),
          battery: 0,
          enabled: record.isActive,
          token: record.token,
          clientToken: record.clientToken,
          webhookUrl: record.webhookUrl,
          agentId: record.agentId,
          ownerUserId: record.ownerUserId || null,
        })),
      );
    } catch (error: any) {
      setErrorMessage(error?.message || "Não foi possível carregar as instâncias.");
      setInstances([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInstances();
    void ensureAgentsLoaded().then(setAgents).catch(() => setAgents([]));
    void listUserProfiles()
      .then((rows: UserProfileItem[]) => {
        const allowed = rows
          .filter((row) => ["Administrador", "Gerente", "Vendedor"].includes(row.role))
          .map((row) => ({ id: row.id, name: row.name, role: row.role }));
        setOwners(allowed);
      })
      .catch(() => setOwners([]));
  }, []);

  const totalInstances = instances.length;
  const connectedInstances = instances.filter(i => i.status === "connected").length;
  const disconnectedInstances = instances.filter(i => i.status === "disconnected").length;

  const closeQrModal = () => {
    setShowQRModal(false);
    setSelectedInstance(null);
    setQrCodeImage(null);
    setQrError(null);
    setQrLoading(false);
  };

  const closeConfigModal = () => {
    setShowConfigModal(false);
    setSelectedInstance(null);
    setConfigStatusText(null);
    setConfigLoading(false);
    setConfigForm({ name: "", token: "", clientToken: "", webhookUrl: "", agentId: "", ownerUserId: "" });
  };

  const handleAddInstance = async () => {
    if (!canManageInstances) return;
    try {
      setSaving(true);
      setErrorMessage(null);
      await createWhatsappInstance({
        name: formData.name,
        instanceKey: formData.instanceId,
        token: formData.token,
        clientToken: formData.clientToken,
        provider: "z-api",
        agentId: formData.agentId || null,
        ownerUserId: formData.ownerUserId || null,
      });
      setShowAddModal(false);
      setFormData({ name: "", instanceId: "", token: "", clientToken: "", webhookUrl: "", isPrincipal: false, agentId: "", ownerUserId: "" });
      await loadInstances();
    } catch (error: any) {
      setErrorMessage(error?.message || "Não foi possível salvar a instância.");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (id: string) => {
    if (!canManageInstances) return;
    const target = instances.find((instance) => instance.id === id);
    if (!target) return;
    const nextEnabled = !target.enabled;

    setInstances(prev => prev.map(i => 
      i.id === id ? { ...i, enabled: nextEnabled } : i
    ));

    try {
      await updateWhatsappInstance(id, {
        isActive: nextEnabled,
      });
    } catch {
      setInstances(prev => prev.map(i => 
        i.id === id ? { ...i, enabled: target.enabled } : i
      ));
    }
  };

  const loadQrCode = async (instanceId: string) => {
    setQrLoading(true);
    setQrError(null);

    try {
      await connectWhatsappInstance(instanceId).catch(() => undefined);
      const qrCode = await getWhatsappInstanceQrCode(instanceId);

      if (!qrCode) {
        setQrCodeImage(null);
        setQrError("QR Code ainda não disponível. Clique em 'Atualizar QR'.");
      } else {
        setQrCodeImage(qrCode);
      }
    } catch (error: any) {
      setQrCodeImage(null);
      const msg = error?.message || "";
      const friendlyMessages: Record<string, string> = {
        zapi_qrcode_failed: "Z-API não conseguiu gerar o QR Code. Verifique as credenciais da instância (Instance ID, Token e Client-Token) no painel Z-API.",
        instance_not_found: "Instância não encontrada. Verifique se ela ainda existe.",
        instance_credentials_missing: "Credenciais da instância (Instance ID ou Token) estão vazias. Edite a instância e preencha.",
        unauthorized: "Sessão expirada. Faça login novamente.",
      };
      setQrError(friendlyMessages[msg] || msg || "Não foi possível gerar o QR Code.");
    } finally {
      setQrLoading(false);
    }
  };

  const handleConnect = async (instance: WhatsAppInstance) => {
    if (!canManageInstances) return;

    try {
      const status = await getWhatsappInstanceConnectionStatus(instance.id);
      if (status.connected) {
        await loadInstances();
        closeQrModal();
        return;
      }
    } catch {
      // Se falhar, exibe QR
    }

    setSelectedInstance(instance);
    setShowQRModal(true);
    setQrCodeImage(null);
    setQrError(null);
    await loadQrCode(instance.id);
  };

  const handleVerifyConnection = async () => {
    if (!canManageInstances) return;
    if (selectedInstance) {
      try {
        const status = await getWhatsappInstanceConnectionStatus(selectedInstance.id);
        if (!status.connected) {
          setQrError("Instância ainda não conectada. Escaneie o QR e tente novamente.");
          return;
        }

        await loadInstances();
        closeQrModal();
      } catch {
        setErrorMessage("Não foi possível atualizar o status da instância.");
      }
    }
  };

  useEffect(() => {
    if (!showQRModal || !selectedInstance) return;

    const interval = setInterval(() => {
      void getWhatsappInstanceConnectionStatus(selectedInstance.id)
        .then(async (status) => {
          if (!status.connected) return;
          await loadInstances();
          closeQrModal();
        })
        .catch(() => undefined);
    }, 3000);

    return () => clearInterval(interval);
  }, [showQRModal, selectedInstance?.id]);

  const handleDelete = (id: string, name: string) => {
    if (!canManageInstances) return;
    setDeleteConfirmId(id);
    setDeleteConfirmName(name);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    const previous = instances;
    setInstances(prev => prev.filter(i => i.id !== id));
    try {
      await deleteWhatsappInstance(id);
    } catch {
      setInstances(previous);
      setErrorMessage("Não foi possível remover a instância.");
    }
  };

  const handleDisconnect = async (instance: WhatsAppInstance) => {
    if (!canManageInstances) return;

    try {
      await disconnectWhatsappInstance(instance.id);
      await loadInstances();
    } catch (error: any) {
      setErrorMessage(error?.message || "Não foi possível desconectar a instância.");
    }
  };

  const openConfigModal = (instance: WhatsAppInstance) => {
    setSelectedInstance(instance);
    setConfigForm({
      name: instance.name,
      token: instance.token || "",
      clientToken: instance.clientToken || "",
      webhookUrl: instance.webhookUrl || "",
      agentId: instance.agentId || "",
      ownerUserId: instance.ownerUserId || "",
    });
    setConfigStatusText(null);
    setShowConfigModal(true);
  };

  const handleSaveConfig = async () => {
    if (!canManageInstances || !selectedInstance) return;

    try {
      setConfigLoading(true);
      setErrorMessage(null);
      setConfigStatusText(null);

      await updateWhatsappInstance(selectedInstance.id, {
        name: configForm.name,
        ...(configForm.token ? { token: configForm.token } : {}),
        ...(configForm.clientToken ? { clientToken: configForm.clientToken } : {}),
        ...(configForm.webhookUrl ? { webhookUrl: configForm.webhookUrl } : {}),
        agentId: configForm.agentId || null,
        ownerUserId: configForm.ownerUserId || null,
      });

      await loadInstances();
      setShowConfigModal(false);
      setSelectedInstance(null);
    } catch (error: any) {
      setErrorMessage(error?.message || "Não foi possível salvar as configurações.");
    } finally {
      setConfigLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-gray-900 dark:text-white mb-1" style={{ fontWeight: 700 }}>Instâncias WhatsApp</h1>
            <p className="text-gray-500 dark:text-white/50 text-sm">Gerencie suas instâncias do WhatsApp conectadas via Z-API</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!canManageInstances}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl transition"
          >
            <Plus size={18} />
            Adicionar Instância
          </button>
        </div>
        {errorMessage && (
          <div className="mt-4 rounded-xl border border-red-300/40 bg-red-50 dark:bg-red-500/10 px-4 py-2 text-xs text-red-700 dark:text-red-200">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 dark:text-blue-400 text-xs uppercase tracking-widest mb-1">Total</p>
              <p className="text-gray-900 dark:text-white text-2xl font-bold">{totalInstances}</p>
            </div>
            <Wifi size={24} className="text-blue-500" />
          </div>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 dark:text-green-400 text-xs uppercase tracking-widest mb-1">Conectadas</p>
              <p className="text-gray-900 dark:text-white text-2xl font-bold">{connectedInstances}</p>
            </div>
            <Power size={24} className="text-green-500" />
          </div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-600 dark:text-red-400 text-xs uppercase tracking-widest mb-1">Desconectadas</p>
              <p className="text-gray-900 dark:text-white text-2xl font-bold">{disconnectedInstances}</p>
            </div>
            <WifiOff size={24} className="text-red-500" />
          </div>
        </div>
      </div>

      {/* Instances Table */}
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
              <tr>
                <th className="text-left text-gray-600 dark:text-white/60 text-xs uppercase tracking-widest px-6 py-4" style={{ fontWeight: 600 }}>Instância</th>
                <th className="text-left text-gray-600 dark:text-white/60 text-xs uppercase tracking-widest px-6 py-4" style={{ fontWeight: 600 }}>Status</th>
                <th className="text-left text-gray-600 dark:text-white/60 text-xs uppercase tracking-widest px-6 py-4" style={{ fontWeight: 600 }}>Telefone</th>
                <th className="text-left text-gray-600 dark:text-white/60 text-xs uppercase tracking-widest px-6 py-4" style={{ fontWeight: 600 }}>Agente IA</th>
                <th className="text-left text-gray-600 dark:text-white/60 text-xs uppercase tracking-widest px-6 py-4" style={{ fontWeight: 600 }}>Responsável</th>
                <th className="text-left text-gray-600 dark:text-white/60 text-xs uppercase tracking-widest px-6 py-4" style={{ fontWeight: 600 }}>Mensagens</th>
                <th className="text-center text-gray-600 dark:text-white/60 text-xs uppercase tracking-widest px-6 py-4" style={{ fontWeight: 600 }}>Ativa</th>
                <th className="text-right text-gray-600 dark:text-white/60 text-xs uppercase tracking-widest px-6 py-4" style={{ fontWeight: 600 }}>Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/5">
              {instances.map(instance => (
                <tr key={instance.id} className="hover:bg-gray-50 dark:hover:bg-white/3 transition">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-gray-900 dark:text-white font-semibold">{instance.name}</p>
                      <p className="text-gray-500 dark:text-white/40 text-xs">ID: {instance.instanceId}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {instance.status === "connected" ? (
                      <span className="inline-flex items-center gap-1.5 bg-green-500/10 text-green-600 dark:text-green-400 text-xs px-3 py-1 rounded-full border border-green-500/20">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        Conectada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-600 dark:text-red-400 text-xs px-3 py-1 rounded-full border border-red-500/20">
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                        Desconectada
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-700 dark:text-white/70 text-sm">{instance.phone}</span>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const agent = agents.find(a => a.id === instance.agentId);
                      return agent ? (
                        <span className="inline-flex items-center gap-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs px-2.5 py-0.5 rounded-full border border-purple-500/20">
                          <Bot size={12} />
                          {agent.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-white/30 text-sm">Nenhum</span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const owner = owners.find((item) => item.id === instance.ownerUserId);
                      if (!owner) return <span className="text-gray-400 dark:text-white/30 text-sm">Admin (geral)</span>;
                      return (
                        <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                          {owner.name}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 dark:text-white/40">
                    <p>↑ {instance.messagesSent} enviadas</p>
                    <p>↓ {instance.messagesReceived} recebidas</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => toggleEnabled(instance.id)}
                      disabled={!canManageInstances}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${instance.enabled ? "bg-emerald-600" : "bg-gray-300 dark:bg-gray-600"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${instance.enabled ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {instance.status === "disconnected" && (
                        <button
                          onClick={() => handleConnect(instance)}
                          disabled={!canManageInstances}
                          className="inline-flex items-center gap-1 text-emerald-600 hover:bg-emerald-600/10 px-3 py-1.5 rounded-lg text-sm transition"
                        >
                          <QrCode size={16} /> Conectar
                        </button>
                      )}
                      {instance.status === "connected" && (
                        <button
                          onClick={() => handleDisconnect(instance)}
                          disabled={!canManageInstances}
                          className="inline-flex items-center gap-1 text-orange-600 hover:bg-orange-600/10 px-3 py-1.5 rounded-lg text-sm transition"
                        >
                          <PowerOff size={16} /> Desconectar
                        </button>
                      )}
                      <button
                        onClick={() => openConfigModal(instance)}
                        disabled={!canManageInstances}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition"
                      >
                        <SettingsIcon size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(instance.id, instance.name)}
                        disabled={!canManageInstances}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal QR Code */}
      {showQRModal && selectedInstance && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-950 rounded-2xl max-w-sm w-full p-6 border border-gray-200 dark:border-white/10">
            <h3 className="text-gray-900 dark:text-white font-bold mb-4">Conectar WhatsApp</h3>
            <div className="bg-white p-4 rounded-xl flex items-center justify-center min-h-[250px] border">
              {qrLoading ? (
                <span className="text-gray-500 text-sm">Gerando código QR...</span>
              ) : qrCodeImage ? (
                <img src={qrCodeImage} alt="QR Code" className="w-56 h-56 object-contain" />
              ) : (
                <span className="text-gray-500 text-sm">QR Code expirado ou indisponível.</span>
              )}
            </div>
            {qrError && <p className="text-xs text-amber-600 mt-2">{qrError}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={closeQrModal} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold">Fechar</button>
              <button onClick={() => loadQrCode(selectedInstance.id)} className="flex-1 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold">Atualizar QR</button>
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-950 rounded-2xl max-w-md w-full p-6 border border-gray-200 dark:border-white/10">
            <h3 className="text-gray-900 dark:text-white font-bold mb-4">Configurar Instância</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nome</label>
                <input
                  value={configForm.name}
                  onChange={e => setConfigForm({ ...configForm, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Responsável</label>
                <select
                  value={configForm.ownerUserId}
                  onChange={e => setConfigForm({ ...configForm, ownerUserId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50"
                >
                  <option value="">Admin Geral</option>
                  {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Agente de IA</label>
                <select
                  value={configForm.agentId}
                  onChange={e => setConfigForm({ ...configForm, agentId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50"
                >
                  <option value="">Nenhum</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={closeConfigModal} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold">Cancelar</button>
              <button onClick={handleSaveConfig} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## ☁️ 4. Código-Fonte Backend Completo (Edge Function Deno)

### `supabase/functions/whatsapp-instance/index.ts`
Esta é a função Deno serverless que faz a autenticação segura no Supabase, resolve o multi-tenant do Tenant dono da linha e executa as chamadas com headers na Z-API:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type InstanceAction = "connect" | "qrcode" | "status" | "disconnect";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildZapiBaseUrl(instanceId: string, token: string) {
  const base = (Deno.env.get("ZAPI_BASE_URL") ?? "https://api.z-api.io").replace(/\/$/, "");
  return `${base}/instances/${instanceId}/token/${token}`;
}

async function syncWebhookWithZapi(zapiBase: string, headers: Record<string, string>, webhookUrl: string) {
  const payloadVariants = [
    { value: webhookUrl },
    { url: webhookUrl },
  ];

  for (const payload of payloadVariants) {
    try {
      const response = await fetch(`${zapiBase}/update-webhook`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (response.ok) return true;
    } catch {
      // best effort
    }
  }
  return false;
}

function normalizeQrValue(raw: unknown) {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("data:image/")) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (/^[A-Za-z0-9+/=\s]+$/.test(value) && value.length > 200) {
    return `data:image/png;base64,${value.replace(/\s/g, "")}`;
  }
  return value;
}

function isConnectedStatus(statusData: any) {
  const value = statusData?.connected ?? statusData?.value ?? statusData?.status ?? statusData?.state;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    return normalized.includes("connect") || normalized === "online" || normalized === "true";
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, reason: "method_not_allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ success: false, reason: "supabase_env_missing" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user?.id) {
      return jsonResponse({ success: false, reason: "unauthorized" }, 401);
    }

    let payload: { action?: InstanceAction; instance_id?: string } = {};
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ success: false, reason: "invalid_json" }, 400);
    }

    const action = payload.action;
    const instanceId = String(payload.instance_id || "").trim();

    if (!action || !["connect", "qrcode", "status", "disconnect"].includes(action)) {
      return jsonResponse({ success: false, reason: "invalid_action" }, 400);
    }

    if (!instanceId) {
      return jsonResponse({ success: false, reason: "missing_instance_id" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Resolve company owner (multi-tenant)
    let tenantId = user.id;
    const { data: profile } = await supabase
      .from("profiles")
      .select("metadata")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.metadata && typeof profile.metadata === "object") {
      const meta = profile.metadata as Record<string, unknown>;
      if (typeof meta.company_owner_id === "string" && meta.company_owner_id.trim()) {
        tenantId = meta.company_owner_id.trim();
      }
    }

    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("id,tenant_id,instance_id,instance_key,token,client_token,status")
      .eq("id", instanceId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (instanceError) {
      return jsonResponse({ success: false, reason: "instance_lookup_failed", error: instanceError.message }, 500);
    }

    if (!instance) {
      return jsonResponse({ success: false, reason: "instance_not_found" }, 404);
    }

    const providerInstanceId = String(instance.instance_id || instance.instance_key || "").trim();
    const providerToken = String(instance.token || "").trim();
    const clientToken = String(instance.client_token || "").trim();

    if (!providerInstanceId || !providerToken) {
      return jsonResponse({ success: false, reason: "instance_credentials_missing" }, 400);
    }

    const zapiBase = buildZapiBaseUrl(providerInstanceId, providerToken);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (clientToken) headers["Client-Token"] = clientToken;

    if (action === "connect") {
      await fetch(`${zapiBase}/status`, { method: "GET", headers }).catch(() => null);
      await syncWebhookWithZapi(zapiBase, headers, `${supabaseUrl}/functions/v1/whatsapp-webhook`).catch(() => null);

      await supabase.from("whatsapp_instances").update({ status: "qr_pending" }).eq("id", instance.id);

      return jsonResponse({ success: true, action: "connect", status: "qr_pending" });
    }

    if (action === "qrcode") {
      let qrRes = await fetch(`${zapiBase}/qr-code/image`, { method: "GET", headers });
      let raw = await qrRes.text();

      if (!qrRes.ok) {
        const fallbackRes = await fetch(`${zapiBase}/qr-code`, { method: "GET", headers });
        const fallbackRaw = await fallbackRes.text();
        if (fallbackRes.ok) {
          qrRes = fallbackRes;
          raw = fallbackRaw;
        } else {
          let zapiMsg = raw;
          try {
            const parsed = JSON.parse(raw);
            zapiMsg = parsed?.error || parsed?.message || parsed?.value || raw;
          } catch { /* ... */ }
          return jsonResponse({
            success: false,
            reason: "zapi_qrcode_failed",
            zapi_status: qrRes.status,
            error: zapiMsg,
          }, 422);
        }
      }

      let qrPayload: any = null;
      try {
        qrPayload = JSON.parse(raw);
      } catch {
        qrPayload = { value: raw };
      }

      const qrCode =
        normalizeQrValue(qrPayload?.value) ||
        normalizeQrValue(qrPayload?.qrcode) ||
        normalizeQrValue(qrPayload?.qrCode) ||
        normalizeQrValue(qrPayload?.base64) ||
        normalizeQrValue(qrPayload?.image);

      await supabase.from("whatsapp_instances").update({ status: "qr_pending" }).eq("id", instance.id);

      return jsonResponse({ success: true, action: "qrcode", qr_code: qrCode, status: "qr_pending" });
    }

    if (action === "status") {
      await syncWebhookWithZapi(zapiBase, headers, `${supabaseUrl}/functions/v1/whatsapp-webhook`).catch(() => null);

      const statusRes = await fetch(`${zapiBase}/status`, { method: "GET", headers });
      const raw = await statusRes.text();

      if (!statusRes.ok) {
        return jsonResponse({ success: false, reason: "zapi_status_failed", zapi_status: statusRes.status, body: raw }, 422);
      }

      let statusPayload: any = null;
      try {
        statusPayload = JSON.parse(raw);
      } catch {
        statusPayload = { status: raw };
      }

      const connected = isConnectedStatus(statusPayload);
      const phoneNumber =
        statusPayload?.phone ||
        statusPayload?.number ||
        statusPayload?.value?.phone ||
        statusPayload?.value?.number ||
        null;

      await supabase
        .from("whatsapp_instances")
        .update({
          status: connected ? "connected" : "disconnected",
          phone_number: phoneNumber,
        })
        .eq("id", instance.id);

      return jsonResponse({
        success: true,
        action: "status",
        connected,
        phone_number: phoneNumber,
        status: connected ? "connected" : "disconnected",
      });
    }

    // Default: disconnect
    await fetch(`${zapiBase}/disconnect`, { method: "GET", headers }).catch(() => null);
    await supabase
      .from("whatsapp_instances")
      .update({
        status: "disconnected",
        phone_number: null,
      })
      .eq("id", instance.id);

    return jsonResponse({ success: true, action: "disconnect", status: "disconnected" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return jsonResponse({ success: false, reason: "internal_error", error: message }, 500);
  }
});
```
