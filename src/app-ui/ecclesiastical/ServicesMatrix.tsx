import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Search,
  Plus,
  Pencil,
  List,
  Trash2,
  Settings2,
  ChevronDown,
  Link2,
} from "lucide-react";

import { apiBase } from "../../lib/apiBase";

function authFetch(url: string, init: RequestInit = {}) {
  const token = localStorage.getItem("mrm_token");
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
}

type Service = {
  id: number;
  sigla: string;
  description: string;
  servico: string | null;
  serviceGroup?: string | null;
  usesMatrix: boolean;
  isActive: boolean;
  stageCount?: number;
  ruleCount?: number;
  columnCount?: number;
  pipelineCount?: number;
  pipelineNames?: string[];
  stageNames?: string[];
};

type Pipeline = { id: number; name: string; type?: string | null };
type Stage = { id: number; name: string; pipelineId: number };
type Column = { id: number; name: string; columnIndex: number; color?: string | null; stageId: number };
type StageWithColumns = Stage & { columns: Column[]; service?: { sigla: string } | null };

type MatrixRule = {
  id: number;
  serviceId: number;
  columnIndex: number;
  stageId: number | null;
  changeStatus: boolean;
  newStatus: string | null;
  changeTitle: boolean;
  newTitle: string | null;
  doesTransfer: boolean;
  insertOccurrence: boolean;
  occurrenceName: string | null;
  message: string | null;
  allowMessage: boolean;
  requireDocument: boolean;
  isActive: boolean;
  description: string | null;
  service?: { sigla: string; description: string };
  stage?: { id: number; name: string; pipeline?: { id: number; name: string } | null } | null;
  columnName?: string | null;
  columnColor?: string | null;
  pipelineName?: string | null;
};

type ServiceStructureSummary = {
  ruleCount: number;
  pipelineCount: number;
  stageCount: number;
  columnCount: number;
  pipelineNames: string[];
  stageNames: string[];
  columnNames: string[];
};

// ── View state ──────────────────────────────────────────────────────────────
type View = "services" | "matrix";

function serviceGroupLabel(group?: string | null) {
  const key = String(group || "").trim().toUpperCase();
  if (!key) return "Sem grupo";
  if (key === "REQUERIMENTO") return "Requerimento";
  if (key === "CONSAGRACAO") return "Consagracao";
  return key.charAt(0) + key.slice(1).toLowerCase();
}

function previewList(values?: string[], limit = 2) {
  if (!values?.length) return "—";
  if (values.length <= limit) return values.join(", ");
  return `${values.slice(0, limit).join(", ")} +${values.length - limit}`;
}

export default function ServicesMatrix() {
  const [view, setView] = useState<View>("services");
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Modal state
  const [editService, setEditService] = useState<Service | null | "new">(null);
  const [editRule, setEditRule] = useState<MatrixRule | null | "new">(null);

  // Refresh triggers
  const [servicesTick, setServicesTick] = useState(0);
  const [rulesTick, setRulesTick] = useState(0);

  const refreshServices = () => setServicesTick((t) => t + 1);
  const refreshRules = () => setRulesTick((t) => t + 1);

  if (view === "matrix" && selectedService) {
    return (
      <>
        <MatrixView
          service={selectedService}
          tick={rulesTick}
          onBack={() => setView("services")}
          onEdit={(r) => setEditRule(r)}
          onNewRule={() => setEditRule("new")}
          onDelete={async (id) => {
            if (!confirm("Excluir regra?")) return;
            await authFetch(`${apiBase}/kan/matrix-rules/${id}`, { method: "DELETE" });
            refreshRules();
          }}
        />
        {editRule && (
          <RuleModal
            rule={editRule === "new" ? null : editRule}
            service={selectedService}
            onClose={() => setEditRule(null)}
            onSaved={() => { setEditRule(null); refreshRules(); }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <ServicesView
        tick={servicesTick}
        onOpenMatrix={(svc) => { setSelectedService(svc); setView("matrix"); }}
        onEdit={(svc) => setEditService(svc)}
        onNewService={() => setEditService("new")}
        onDelete={async (id) => {
          if (!confirm("Excluir serviço?")) return;
          await authFetch(`${apiBase}/kan/services/${id}`, { method: "DELETE" });
          refreshServices();
        }}
      />
      {editService && (
        <ServiceModal
          service={editService === "new" ? null : editService}
          onClose={() => setEditService(null)}
          onSaved={() => { setEditService(null); refreshServices(); }}
        />
      )}
    </>
  );
}

// ── Level 1 — Services list ─────────────────────────────────────────────────

function ServicesView({
  tick,
  onOpenMatrix,
  onEdit,
  onNewService,
  onDelete,
}: {
  tick: number;
  onOpenMatrix: (s: Service) => void;
  onEdit: (s: Service) => void;
  onNewService: () => void;
  onDelete: (id: number) => void;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceStructure, setServiceStructure] = useState<Record<number, ServiceStructureSummary>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingStructure, setLoadingStructure] = useState(false);

  useEffect(() => {
    setLoading(true);
    authFetch(`${apiBase}/kan/services`)
      .then((r) => r.json())
      .then((data: Service[]) => setServices(Array.isArray(data) ? data : []))
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, [tick]);

  useEffect(() => {
    let active = true;

    if (!services.length) {
      setServiceStructure({});
      return () => {
        active = false;
      };
    }

    setLoadingStructure(true);
    Promise.all(
      services.map(async (service) => {
        const pipelineSet = new Set(service.pipelineNames || []);
        const stageSet = new Set(service.stageNames || []);
        const columnSet = new Set<string>();

        try {
          const response = await authFetch(`${apiBase}/kan/services/${service.id}/rules`);
          const rules = response.ok ? ((await response.json()) as MatrixRule[]) : [];

          for (const rule of Array.isArray(rules) ? rules : []) {
            if (rule.pipelineName) pipelineSet.add(rule.pipelineName);
            if (rule.stage?.name) stageSet.add(rule.stage.name);
            if (rule.columnName) columnSet.add(rule.columnName);
          }

          return [
            service.id,
            {
              ruleCount: Array.isArray(rules) ? rules.length : service.ruleCount ?? 0,
              pipelineCount: pipelineSet.size,
              stageCount: stageSet.size,
              columnCount: columnSet.size || service.columnCount || 0,
              pipelineNames: Array.from(pipelineSet).sort((a, b) => a.localeCompare(b, "pt-BR")),
              stageNames: Array.from(stageSet).sort((a, b) => a.localeCompare(b, "pt-BR")),
              columnNames: Array.from(columnSet).sort((a, b) => a.localeCompare(b, "pt-BR")),
            },
          ] as const;
        } catch {
          return [
            service.id,
            {
              ruleCount: service.ruleCount ?? 0,
              pipelineCount: service.pipelineCount ?? 0,
              stageCount: service.stageCount ?? 0,
              columnCount: service.columnCount ?? 0,
              pipelineNames: service.pipelineNames || [],
              stageNames: service.stageNames || [],
              columnNames: [],
            },
          ] as const;
        }
      })
    ).then((entries) => {
      if (!active) return;
      setServiceStructure(Object.fromEntries(entries));
    }).finally(() => {
      if (active) setLoadingStructure(false);
    });

    return () => {
      active = false;
    };
  }, [services]);

  const filtered = services
    .filter(
      (s) =>
        !q ||
        s.sigla.toLowerCase().includes(q.toLowerCase()) ||
        s.description.toLowerCase().includes(q.toLowerCase())
    )
    .sort((a, b) => a.sigla.localeCompare(b.sigla, "pt-BR"));

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Serviços e ocorrências</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie os serviços e configure a matriz de decisão</p>
          </div>
        </div>
        <button
          onClick={onNewService}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          <Plus className="w-4 h-4" />
          Novo serviço
        </button>
      </div>

      {/* Search */}
      <div className="mb-4 max-w-sm">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Consultar por Nome"
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-slate-400 focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Lista de Serviços</span>
          {loadingStructure && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Atualizando estrutura...
            </span>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400 dark:text-slate-500">
            <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-sm">Carregando serviços...</span>
          </div>
        ) : (
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="px-5 py-3 text-left font-semibold">Ref. Sigla</th>
              <th className="px-5 py-3 text-left font-semibold">Descrição e contexto</th>
              <th className="px-5 py-3 text-left font-semibold">Estrutura</th>
              <th className="px-5 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-sm text-slate-400">
                  Nenhum serviço encontrado
                </td>
              </tr>
            ) : (
              filtered.map((svc) => {
                const structure = serviceStructure[svc.id];

                return (
                <tr key={svc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="px-5 py-3 font-bold text-sm text-slate-800 dark:text-slate-100">{svc.sigla}</td>
                  <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-700 dark:text-slate-200">{svc.description}</span>
                        <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          {serviceGroupLabel(svc.serviceGroup)}
                        </span>
                        {svc.usesMatrix ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            Usa matriz
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                            Sem matriz
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <div>
                          <span className="font-semibold text-slate-600 dark:text-slate-300">Pipelines:</span> {previewList(structure?.pipelineNames ?? svc.pipelineNames)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-600 dark:text-slate-300">Etapas:</span> {previewList(structure?.stageNames ?? svc.stageNames)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-600 dark:text-slate-300">Colunas:</span> {previewList(structure?.columnNames)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Pipelines</div>
                        <div className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-100">{structure?.pipelineCount ?? svc.pipelineCount ?? 0}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Etapas</div>
                        <div className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-100">{structure?.stageCount ?? svc.stageCount ?? 0}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Colunas</div>
                        <div className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-100">{structure?.columnCount ?? svc.columnCount ?? 0}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Regras</div>
                        <div className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-100">{structure?.ruleCount ?? svc.ruleCount ?? 0}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        title="Editar serviço"
                        onClick={() => onEdit(svc)}
                        className="rounded-md border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        title="Matriz de decisão"
                        onClick={() => onOpenMatrix(svc)}
                        className="rounded-md border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <List className="w-4 h-4" />
                      </button>
                      <button
                        title="Excluir"
                        onClick={() => onDelete(svc.id)}
                        className="rounded-md border border-slate-200 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )})
            )}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}

// ── Level 2 — Decision Matrix ───────────────────────────────────────────────

function MatrixView({
  service,
  tick,
  onBack,
  onEdit,
  onNewRule,
  onDelete,
}: {
  service: Service;
  tick: number;
  onBack: () => void;
  onEdit: (r: MatrixRule) => void;
  onNewRule: () => void;
  onDelete: (id: number) => void;
}) {
  const [rules, setRules] = useState<MatrixRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    authFetch(`${apiBase}/kan/services/${service.id}/rules`)
      .then((r) => r.json())
      .then((data) => {
        const arr: MatrixRule[] = Array.isArray(data) ? data : (Array.isArray(data?.rules) ? data.rules : []);
        setRules(arr.sort((a, b) => a.columnIndex - b.columnIndex));
      })
      .catch(() => setRules([]))
      .finally(() => setLoading(false));
  }, [service.id, tick]);

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Matriz de decisão</h1>
              <span className="text-xl font-light text-slate-400">{rules.length}</span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="font-semibold">{service.sigla}</span> · {service.description}
            </p>
          </div>
        </div>
        <button
          onClick={onNewRule}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Nova Regra
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Regras de Decisão</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400 dark:text-slate-500">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-sm">Carregando regras...</span>
          </div>
        ) : (
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="px-5 py-3 text-left font-semibold">Ref. Sigla</th>
              <th className="px-5 py-3 text-left font-semibold">Serviço Coluna</th>
              <th className="px-5 py-3 text-left font-semibold">Pipeline</th>
              <th className="px-5 py-3 text-left font-semibold">Troca Situação</th>
              <th className="px-5 py-3 text-left font-semibold">Troca Título</th>
              <th className="px-5 py-3 text-left font-semibold">Insere ocorrência</th>
              <th className="px-5 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rules.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-slate-400">
                  Nenhuma regra cadastrada
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {rule.service?.sigla || service.sigla}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: colorHex(rule.columnColor) }}
                      />
                      {rule.columnName || `Coluna ${rule.columnIndex}`}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {rule.stage?.pipeline?.name ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: `${pipelineColor(rule.stage.pipeline.name)}18`, color: pipelineColor(rule.stage.pipeline.name) }}
                        >
                          {rule.stage.pipeline.name}
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">›</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{rule.stage.name}</span>
                      </span>
                    ) : rule.stage?.name ? (
                      <span className="text-xs text-slate-500 dark:text-slate-400">{rule.stage.name}</span>
                    ) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <YesNoBadge value={rule.changeStatus} />
                  </td>
                  <td className="px-5 py-3">
                    <YesNoBadge value={rule.changeTitle} />
                  </td>
                  <td className="px-5 py-3">
                    <YesNoBadge value={rule.insertOccurrence} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title="Editar"
                        onClick={() => onEdit(rule)}
                        className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}

function YesNoBadge({ value }: { value: boolean }) {
  return value ? (
    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 border border-green-200">Sim</span>
  ) : (
    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700">Não</span>
  );
}

// ── Level 3 modals ──────────────────────────────────────────────────────────

function ServiceModal({
  service,
  onClose,
  onSaved,
}: {
  service: Service | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !service;
  const [sigla, setSigla] = useState(service?.sigla || "");
  const [description, setDescription] = useState(service?.description || "");
  const [servico, setServico] = useState(service?.servico || "");
  const [usesMatrix, setUsesMatrix] = useState(service?.usesMatrix || false);
  const [saving, setSaving] = useState(false);

  // Pipeline association (only when creating new service with usesMatrix)
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [pipelineStages, setPipelineStages] = useState<StageWithColumns[]>([]);
  const [selectedStageId, setSelectedStageId] = useState(""); // stage to copy columns from
  const [pipelinesLoaded, setPipelinesLoaded] = useState(false);

  // Load pipelines when usesMatrix toggled on
  useEffect(() => {
    if (!usesMatrix || pipelinesLoaded) return;
    authFetch(`${apiBase}/kan/pipelines`)
      .then((r) => r.json())
      .then((data: Pipeline[]) => { setPipelines(Array.isArray(data) ? data : []); setPipelinesLoaded(true); })
      .catch(() => setPipelinesLoaded(true));
  }, [usesMatrix, pipelinesLoaded]);

  // Load stages when pipeline selected
  useEffect(() => {
    if (!selectedPipelineId) { setPipelineStages([]); setSelectedStageId(""); return; }
    authFetch(`${apiBase}/kan/pipelines/${selectedPipelineId}/stages`)
      .then((r) => r.json())
      .then((data: StageWithColumns[]) => {
        const arr = Array.isArray(data) ? data : [];
        setPipelineStages(arr);
        // Auto-select first stage that has columns
        const first = arr.find((s) => s.columns?.length);
        if (first) setSelectedStageId(String(first.id));
      })
      .catch(() => setPipelineStages([]));
  }, [selectedPipelineId]);

  const selectedStage = pipelineStages.find((s) => String(s.id) === selectedStageId);

  const submit = async () => {
    if (!sigla || !description) return;
    setSaving(true);
    const url = isNew ? `${apiBase}/kan/services` : `${apiBase}/kan/services/${service!.id}`;
    const method = isNew ? "POST" : "PATCH";
    const res = await authFetch(url, {
      method,
      body: JSON.stringify({ sigla, description, servico: servico || null, usesMatrix }),
    });
    if (!res.ok) { setSaving(false); alert("Erro ao salvar serviço"); return; }
    const saved = await res.json();

    // If new service with usesMatrix + pipeline selected → link pipeline
    if (isNew && usesMatrix && selectedPipelineId) {
      await authFetch(`${apiBase}/kan/services/${saved.id}/link-pipeline`, {
        method: "POST",
        body: JSON.stringify({
          pipelineId: Number(selectedPipelineId),
          copyFromStageId: selectedStageId ? Number(selectedStageId) : undefined,
          stageName: description,
        }),
      });
    }

    setSaving(false);
    onSaved();
  };

  return (
    <ModalShell onClose={onClose} title={isNew ? "Novo Serviço" : "Editar Serviço"}>
      <div className="space-y-3">
        <Field label="Ref. Sigla">
          <input value={sigla} onChange={(e) => setSigla(e.target.value.toUpperCase())}
            className={INPUT} placeholder="ex: SOLCRED" />
        </Field>
        <Field label="Descrição">
          <input value={description} onChange={(e) => setDescription(e.target.value)}
            className={INPUT} placeholder="Descrição do serviço" />
        </Field>
        <Field label="Serviço (nome completo)">
          <input value={servico} onChange={(e) => setServico(e.target.value)}
            className={INPUT} placeholder="Opcional" />
        </Field>

        {/* Usa matriz toggle */}
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5">
          <span className="text-sm text-slate-700">Usa matriz de decisão</span>
          <Toggle value={usesMatrix} onChange={setUsesMatrix} />
        </div>

        {/* Pipeline association — only for new service with usesMatrix */}
        {isNew && usesMatrix && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-indigo-700 text-xs font-semibold uppercase tracking-wide">
              <Link2 size={13} /> Associar Pipeline
            </div>

            <Field label="Pipeline">
              <select
                value={selectedPipelineId}
                onChange={(e) => setSelectedPipelineId(e.target.value)}
                className={INPUT}
              >
                <option value="">Selecione um pipeline...</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>

            {pipelineStages.length > 0 && (
              <Field label="Copiar colunas de">
                <select
                  value={selectedStageId}
                  onChange={(e) => setSelectedStageId(e.target.value)}
                  className={INPUT}
                >
                  <option value="">— Nenhuma (criar em branco) —</option>
                  {pipelineStages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.columns?.length ?? 0} colunas)
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {/* Column preview */}
            {selectedStage?.columns?.length ? (
              <div>
                <p className="text-xs font-medium text-indigo-600 mb-1.5">Colunas que serão criadas:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedStage.columns.map((col) => (
                    <span key={col.id} className="flex items-center gap-1.5 rounded-full bg-white border border-indigo-200 px-3 py-1 text-xs font-medium text-slate-700">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: colorHex(col.color) }}
                      />
                      {col.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : selectedPipelineId && (
              <p className="text-xs text-slate-500 italic">Nenhuma coluna encontrada — um stage em branco será criado.</p>
            )}
          </div>
        )}

        <ModalActions onClose={onClose} onSave={submit} saving={saving} />
      </div>
    </ModalShell>
  );
}

function RuleModal({
  rule,
  service,
  onClose,
  onSaved,
}: {
  rule: MatrixRule | null;
  service: Service;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !rule;

  // Pipeline / stage / column cascade
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>(() => {
    if (rule?.stage?.pipeline?.id) return String(rule.stage.pipeline.id);
    return "";
  });
  const [stages, setStages] = useState<StageWithColumns[]>([]);
  const [stageId, setStageId] = useState<string>(rule?.stageId?.toString() || "");
  const [columns, setColumns] = useState<Column[]>([]);
  const [selectedColumnId, setSelectedColumnId] = useState<string>("");

  const [columnIndex, setColumnIndex] = useState(rule?.columnIndex ?? 1);
  const [changeStatus, setChangeStatus] = useState(rule?.changeStatus ?? false);
  const [newStatus, setNewStatus] = useState(rule?.newStatus || "");
  const [changeTitle, setChangeTitle] = useState(rule?.changeTitle ?? false);
  const [newTitle, setNewTitle] = useState(rule?.newTitle || "");
  const [doesTransfer, setDoesTransfer] = useState(rule?.doesTransfer ?? false);
  const [insertOccurrence, setInsertOccurrence] = useState(rule?.insertOccurrence ?? true);
  const [occurrenceName, setOccurrenceName] = useState(rule?.occurrenceName || "");
  const [message, setMessage] = useState(rule?.message || "");
  const [saving, setSaving] = useState(false);

  // Load all pipelines on mount
  useEffect(() => {
    authFetch(`${apiBase}/kan/pipelines`)
      .then((r) => r.json())
      .then((data: Pipeline[]) => setPipelines(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Load stages when pipeline changes
  useEffect(() => {
    if (!selectedPipelineId) { setStages([]); setStageId(""); setColumns([]); return; }
    authFetch(`${apiBase}/kan/pipelines/${selectedPipelineId}/stages`)
      .then((r) => r.json())
      .then((data: StageWithColumns[]) => {
        const arr = Array.isArray(data) ? data : [];
        setStages(arr);
        // If editing, re-select the current stage
        if (rule?.stageId && arr.find((s) => s.id === rule.stageId)) {
          setStageId(String(rule.stageId));
        }
      })
      .catch(() => setStages([]));
  }, [selectedPipelineId]);

  // Load columns when stage changes
  useEffect(() => {
    if (!stageId) { setColumns([]); setSelectedColumnId(""); return; }
    const stage = stages.find((s) => String(s.id) === stageId);
    if (stage?.columns) {
      setColumns(stage.columns);
      // Pre-select column matching current columnIndex
      const match = stage.columns.find((c) => c.columnIndex === columnIndex);
      if (match) setSelectedColumnId(String(match.id));
    }
  }, [stageId, stages]);

  // Sync columnIndex from selected column
  useEffect(() => {
    if (!selectedColumnId) return;
    const col = columns.find((c) => String(c.id) === selectedColumnId);
    if (col) setColumnIndex(col.columnIndex);
  }, [selectedColumnId]);

  const submit = async () => {
    setSaving(true);
    const payload = {
      serviceId: service.id,
      columnIndex: Number(columnIndex),
      stageId: stageId ? Number(stageId) : null,
      changeStatus,
      newStatus: newStatus || null,
      changeTitle,
      newTitle: newTitle || null,
      doesTransfer,
      insertOccurrence,
      occurrenceName: occurrenceName || null,
      message: message || null,
    };
    const url = isNew ? `${apiBase}/kan/matrix-rules` : `${apiBase}/kan/matrix-rules/${rule!.id}`;
    const method = isNew ? "POST" : "PATCH";
    const res = await authFetch(url, { method, body: JSON.stringify(payload) });
    setSaving(false);
    if (res.ok) onSaved();
    else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Erro ao salvar regra");
    }
  };

  const selectedStage = stages.find((s) => String(s.id) === stageId);

  return (
    <ModalShell onClose={onClose} title={isNew ? "Nova Regra" : "Editar Matriz de Decisão"}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sigla">
            <input readOnly value={service.sigla} className={`${INPUT} bg-slate-50 text-slate-400`} />
          </Field>
          <Field label="Descrição">
            <input readOnly value={service.description} className={`${INPUT} bg-slate-50 text-slate-400`} />
          </Field>
        </div>

        {/* Pipeline / Stage / Column cascade */}
        <Field label="Pipeline">
          <select
            value={selectedPipelineId}
            onChange={(e) => { setSelectedPipelineId(e.target.value); setStageId(""); setColumns([]); setSelectedColumnId(""); }}
            className={INPUT}
          >
            <option value="">Selecione um pipeline...</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>

        {stages.length > 0 && (
          <Field label="Stage / Etapa">
            <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={INPUT}>
              <option value="">Selecione...</option>
              {stages.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}{st.service ? ` (${st.service.sigla})` : ""}
                </option>
              ))}
            </select>
          </Field>
        )}

        {columns.length > 0 ? (
          <Field label="Coluna (quando o card for movido para)">
            <select
              value={selectedColumnId}
              onChange={(e) => setSelectedColumnId(e.target.value)}
              className={INPUT}
            >
              <option value="">Selecione a coluna...</option>
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.columnIndex}. {col.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Índice da Coluna">
            <input
              type="number"
              min={1}
              max={10}
              value={columnIndex}
              onChange={(e) => setColumnIndex(Number(e.target.value))}
              className={INPUT}
            />
          </Field>
        )}

        {/* Show resolved column name */}
        {selectedColumnId && columns.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
            <span className="font-medium">Coluna selecionada:</span>
            {(() => {
              const col = columns.find((c) => String(c.id) === selectedColumnId);
              return col ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorHex(col.color) }} />
                  {col.name} (índice {col.columnIndex})
                </span>
              ) : null;
            })()}
          </div>
        )}

        {/* Toggles */}
        <ToggleRow label="Troca situação" value={changeStatus} onChange={setChangeStatus} />
        {changeStatus && (
          <Field label="Nova situação">
            <input value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className={INPUT} />
          </Field>
        )}

        <ToggleRow label="Troca Título" value={changeTitle} onChange={setChangeTitle} />
        {changeTitle && (
          <textarea
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            rows={2}
            className={`${INPUT} resize-none`}
            placeholder="Novo título..."
          />
        )}

        <ToggleRow label="Insere ocorrência" value={insertOccurrence} onChange={setInsertOccurrence} />
        {insertOccurrence && (
          <textarea
            value={occurrenceName}
            onChange={(e) => setOccurrenceName(e.target.value)}
            rows={2}
            className={`${INPUT} resize-none`}
            placeholder="Nome da ocorrência..."
          />
        )}

        <ToggleRow label="Faz Transferência" value={doesTransfer} onChange={setDoesTransfer} />

        <Field label="Mensagem informativa">
          <input value={message} onChange={(e) => setMessage(e.target.value)} className={INPUT} />
        </Field>

        <button
          onClick={submit}
          disabled={saving}
          className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Atualizar"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Shared UI helpers ───────────────────────────────────────────────────────

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none";

function colorHex(color?: string | null): string {
  const map: Record<string, string> = {
    orange: "#f97316", laranja: "#f97316",
    blue: "#3b82f6", azul: "#3b82f6",
    sky: "#0ea5e9", ceu: "#0ea5e9", céu: "#0ea5e9",
    teal: "#14b8a6", verde: "#22c55e", green: "#22c55e",
    red: "#ef4444", vermelho: "#ef4444",
    gray: "#94a3b8", cinza: "#94a3b8",
    purple: "#a855f7", roxo: "#a855f7",
    yellow: "#eab308", amarelo: "#eab308",
  };
  if (!color) return "#94a3b8";
  return map[color.toLowerCase()] || color;
}

function pipelineColor(name?: string | null): string {
  if (!name) return "#94a3b8";
  const palette = ["#6366f1","#8b5cf6","#ec4899","#f97316","#0ea5e9","#14b8a6","#22c55e","#eab308","#ef4444","#3b82f6"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5">
      <span className="text-sm text-slate-700">{label}</span>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 rounded-full transition-colors focus:outline-none ${
        value ? "bg-slate-900" : "bg-slate-200"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
          value ? "translate-x-5.5 ml-0.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function ModalActions({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button
        onClick={onClose}
        className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
      >
        Cancelar
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}

function ModalShell({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
