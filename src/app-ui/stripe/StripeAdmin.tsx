"use client";
import { useState, useEffect } from "react";
import { useLocation } from "react-router";
import { LayoutDashboard, Settings, CreditCard, Users, RotateCcw } from "lucide-react";
import StripeDashboard from "./StripeDashboard";
import StripeConfigAdmin from "./StripeConfigAdmin";
import StripeTransactions from "./StripeTransactions";
import StripeSubscriptions from "./StripeSubscriptions";
import StripeReembolsos from "./StripeReembolsos";

type Tab = "dashboard" | "config" | "transacoes" | "assinaturas" | "reembolsos";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "transacoes", label: "Transações", icon: CreditCard },
  { id: "assinaturas", label: "Assinaturas", icon: Users },
  { id: "reembolsos", label: "Reembolsos", icon: RotateCcw },
  { id: "config", label: "Configuração", icon: Settings },
];

function getCampoId(): string {
  try {
    const user = JSON.parse(localStorage.getItem("mrm_user") || "{}");
    return user.campoId || user.campo_id || "";
  } catch {
    return "";
  }
}

function pathToTab(pathname: string): Tab {
  if (pathname.endsWith("/transacoes")) return "transacoes";
  if (pathname.endsWith("/assinaturas")) return "assinaturas";
  if (pathname.endsWith("/reembolsos")) return "reembolsos";
  if (pathname.endsWith("/config")) return "config";
  return "dashboard";
}

export default function StripeAdmin() {
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(() => pathToTab(location.pathname));
  const campoId = getCampoId();

  useEffect(() => {
    setTab(pathToTab(location.pathname));
  }, [location.pathname]);

  if (!campoId) {
    return <div className="p-6 text-sm text-red-500">Campo não identificado. Faça login novamente.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pagamentos Stripe</h1>
          <p className="text-sm text-slate-500">Gerencie pagamentos, assinaturas e reembolsos do campo</p>
        </div>

        <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                tab === id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border p-6">
          {tab === "dashboard" && <StripeDashboard campoId={campoId} />}
          {tab === "transacoes" && <StripeTransactions campoId={campoId} />}
          {tab === "assinaturas" && <StripeSubscriptions campoId={campoId} />}
          {tab === "reembolsos" && <StripeReembolsos campoId={campoId} />}
          {tab === "config" && <StripeConfigAdmin campoId={campoId} />}
        </div>
      </div>
    </div>
  );
}
