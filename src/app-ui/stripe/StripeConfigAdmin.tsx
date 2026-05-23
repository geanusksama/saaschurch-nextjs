"use client";
import { useState, useEffect, useCallback } from "react";
import { Key, Save, Trash2, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { authFetch } from "../../lib/secretariaHooks";

interface StripeConfig {
  id: string;
  campoId: string;
  publishableKey: string;
  secretKeyMask: string;
  webhookSecretMask: string | null;
  accountId: string | null;
  ativo: boolean;
  modoProd: boolean;
  pixEnabled: boolean;
  cardEnabled: boolean;
  currency: string;
}

interface Props {
  campoId: string;
}

export default function StripeConfigAdmin({ campoId }: Props) {
  const [config, setConfig] = useState<StripeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSecretField, setShowSecretField] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    publishableKey: "",
    secretKey: "",
    webhookSecret: "",
    accountId: "",
    ativo: true,
    modoProd: false,
    pixEnabled: true,
    cardEnabled: true,
    currency: "brl",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authFetch<StripeConfig | null>(`/api/stripe/config?campoId=${campoId}`);
      setConfig(data);
      if (data) {
        setForm((f) => ({
          ...f,
          publishableKey: data.publishableKey,
          accountId: data.accountId || "",
          ativo: data.ativo,
          modoProd: data.modoProd,
          pixEnabled: data.pixEnabled,
          cardEnabled: data.cardEnabled,
          currency: data.currency,
        }));
      }
    } finally {
      setLoading(false);
    }
  }, [campoId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await authFetch("/api/stripe/config", {
        method: "POST",
        body: JSON.stringify({ ...form, campoId }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await load();
      setForm((f) => ({ ...f, secretKey: "", webhookSecret: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Remover configuração Stripe deste campo? Pagamentos não funcionarão.")) return;
    setDeleting(true);
    try {
      await authFetch(`/api/stripe/config?campoId=${campoId}`, { method: "DELETE" });
      setConfig(null);
      setForm({ publishableKey: "", secretKey: "", webhookSecret: "", accountId: "", ativo: true, modoProd: false, pixEnabled: true, cardEnabled: true, currency: "brl" });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate-500">Carregando configuração...</div>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Key className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-semibold">Configuração Stripe</h2>
        {config && (
          <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${config.modoProd ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
            {config.modoProd ? "Produção" : "Teste"}
          </span>
        )}
      </div>

      {config && (
        <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm space-y-1">
          <p><span className="text-slate-500">Publishable Key:</span> <span className="font-mono">{config.publishableKey}</span></p>
          <p><span className="text-slate-500">Secret Key:</span> <span className="font-mono">{config.secretKeyMask}</span></p>
          {config.webhookSecretMask && (
            <p><span className="text-slate-500">Webhook Secret:</span> <span className="font-mono">{config.webhookSecretMask}</span></p>
          )}
          {config.accountId && (
            <p><span className="text-slate-500">Account ID:</span> <span className="font-mono">{config.accountId}</span></p>
          )}
          <p>
            <span className="text-slate-500">Métodos:</span>{" "}
            {config.cardEnabled && <span className="mr-2">Cartão</span>}
            {config.pixEnabled && <span>PIX</span>}
          </p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Publishable Key (pk_...)</label>
          <input
            type="text"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="pk_live_..."
            value={form.publishableKey}
            onChange={(e) => setForm({ ...form, publishableKey: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Secret Key (sk_...) {config && <span className="text-slate-400 font-normal">— deixe vazio para não alterar</span>}
          </label>
          <div className="relative">
            <input
              type={showSecretField ? "text" : "password"}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-10 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={config ? "••••••••" : "sk_live_..."}
              value={form.secretKey}
              onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
              required={!config}
            />
            <button type="button" onClick={() => setShowSecretField((v) => !v)} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
              {showSecretField ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Webhook Secret (whsec_...) <span className="text-slate-400 font-normal">— opcional</span>
          </label>
          <input
            type="password"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="whsec_..."
            value={form.webhookSecret}
            onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
          />
          <p className="text-xs text-slate-500 mt-1">URL do webhook: <span className="font-mono">{process.env.NEXT_PUBLIC_APP_URL || "https://app.mrm.com.br"}/api/stripe/webhook</span></p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Account ID (opcional)</label>
          <input
            type="text"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="acct_..."
            value={form.accountId}
            onChange={(e) => setForm({ ...form, accountId: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Moeda</label>
          <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            <option value="brl">BRL — Real brasileiro</option>
            <option value="usd">USD — Dólar americano</option>
            <option value="eur">EUR — Euro</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="rounded" checked={form.cardEnabled} onChange={(e) => setForm({ ...form, cardEnabled: e.target.checked })} />
            Aceitar Cartão
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="rounded" checked={form.pixEnabled} onChange={(e) => setForm({ ...form, pixEnabled: e.target.checked })} />
            Aceitar PIX
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="rounded" checked={form.modoProd} onChange={(e) => setForm({ ...form, modoProd: e.target.checked })} />
            Modo Produção
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="rounded" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
            Ativo
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle className="w-4 h-4" /> Configuração salva com sucesso!
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : config ? "Atualizar" : "Salvar"}
          </button>
          {config && (
            <button type="button" onClick={handleDelete} disabled={deleting} className="flex items-center gap-2 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> {deleting ? "Removendo..." : "Remover"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
