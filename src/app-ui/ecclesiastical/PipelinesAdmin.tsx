import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, Trash2, Plus, GitBranch, ChevronUp, ChevronDown } from "lucide-react";

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

// ── Types ────────────────────────────────────────────────────────────────────

type Pipeline = {
  id: number;
  name: string;
  type: string | null;
  description: string | null;
  isActive: boolean;
};

type Column = {
  id: number;
  stageId: number;
  name: string;
  columnIndex: number;
  color: string;
};

type Stage = {
  id: number;
  pipelineId: number;
  name: string;
  description: string | null;
  serviceId: number | null;
  isActive: boolean;
  service: { sigla: string; description: string } | null;
  columns: Column[];
};

type View = "pipelines" | "pipeline-edit" | "stage-edit";

export default function PipelinesAdmin() {
  const [view, setView] = useState<View>("pipelines");
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);

  const [pipelinesTick, setPipelinesTick] = useState(0);
  const [stagesTick, setStagesTick] = useState(0);
  const [columnsTick, setColumnsTick] = useState(0);

  const refreshPipelines = () => setPipelinesTick((t) => t + 1);
  const refreshStages = () => setStagesTick((t) => t + 1);
  const refreshColumns = () => setColumnsTick((t) => t + 1);

  if (view === "stage-edit" && selectedStage && selectedPipeline) {
    return (
      <StageEditView
        pipeline={selectedPipeline}
        stage={selectedStage}
        columnsTick={columnsTick}
        onColumnChange={refreshColumns}
        onBack={() => {
          refreshStages();
          setView("pipeline-edit");
        }}
      />
    );
  }

  if (view === "pipeline-edit" && selectedPipeline) {
    return (
      <PipelineEditView
        pipeline={selectedPipeline}
        stagesTick={stagesTick}
        onPipelineChange={(updated) => setSelectedPipeline(updated)}
        onOpenStage={(stage) => {
          setSelectedStage(stage);
          setView("stage-edit");
        }}
        onStageChange={refreshStages}
        onBack={() => {
          refreshPipelines();
          setView("pipelines");
        }}
      />
    );
  }

  return (
    <PipelinesView
      tick={pipelinesTick}
      onEdit={(p) => { setSelectedPipeline(p); setView("pipeline-edit"); }}
      onCreate={() => { setSelectedPipeline(null); setView("pipelines"); }}
      onRefresh={refreshPipelines}
    />
  );
}

// ── Level 1 — Pipelines list ─────────────────────────────────────────────────

function PipelinesView({
  tick,
  onEdit,
  onRefresh,
}: {
  tick: number;
  onEdit: (p: Pipeline) => void;
  onCreate: () => void;
  onRefresh: () => void;
}) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [q, setQ] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    authFetch(`${apiBase}/kan/pipelines`)
      .then((r) => r.json())
      .then((data: Pipeline[]) => setPipelines(Array.isArray(data) ? data : []))
      .catch(() => setPipelines([]));
  }, [tick]);

  const filtered = pipelines.filter(
    (p) => !q || p.name.toLowerCase().includes(q.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir pipeline?")) return;
    await authFetch(`${apiBase}/kan/pipelines/${id}`, { method: "DELETE" });
    onRefresh();
  };

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Pipelines</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie os pipelines do sistema</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
        >
          <Plus className="w-4 h-4" />
          Novo pipeline
        </button>
      </div>

      {/* Search */}
      <div className="mb-5 relative max-w-xs">
        <span className="absolute left-3 top-2.5 text-slate-400">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </span>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Consultar por Nome"
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-slate-400 focus:outline-none"
        />
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
              <th className="px-5 py-3 text-left text-xs text-slate-400 dark:text-slate-500 font-medium">ID</th>
              <th className="px-5 py-3 text-left text-xs text-slate-400 dark:text-slate-500 font-medium">Nome</th>
              <th className="px-5 py-3 text-left text-xs text-slate-400 dark:text-slate-500 font-medium">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-sm text-slate-400">
                  Nenhum pipeline encontrado
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="px-5 py-3 text-sm text-slate-400 dark:text-slate-500">{p.id}</td>
                  <td
                    className="px-5 py-3 text-sm text-slate-700 dark:text-slate-200 cursor-pointer font-medium hover:text-slate-900 dark:hover:text-slate-100"
                    onClick={() => onEdit(p)}
                  >
                    {p.name}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      p.isActive ? "bg-slate-900 text-white" : "bg-red-500 text-white"
                    }`}>
                      {p.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => onEdit(p)} title="Editar" className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-100">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} title="Excluir" className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <PipelineModal
          pipeline={null}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Level 2 — Pipeline edit + stages ─────────────────────────────────────────

function PipelineEditView({
  pipeline,
  stagesTick,
  onPipelineChange,
  onOpenStage,
  onStageChange,
  onBack,
}: {
  pipeline: Pipeline;
  stagesTick: number;
  onPipelineChange: (p: Pipeline) => void;
  onOpenStage: (s: Stage) => void;
  onStageChange: () => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(pipeline.name);
  const [description, setDescription] = useState(pipeline.description || "");
  const [saving, setSaving] = useState(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [showStageModal, setShowStageModal] = useState(false);
  const [editStage, setEditStage] = useState<Stage | null>(null);

  useEffect(() => {
    authFetch(`${apiBase}/kan/pipelines/${pipeline.id}/stages`)
      .then((r) => r.json())
      .then((data: Stage[]) => setStages(Array.isArray(data) ? data : []))
      .catch(() => setStages([]));
  }, [pipeline.id, stagesTick]);

  const savePipeline = async () => {
    setSaving(true);
    const res = await authFetch(`${apiBase}/kan/pipelines/${pipeline.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name, description: description || null }),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      onPipelineChange(updated);
    } else alert("Erro ao salvar pipeline");
  };

  const deleteStage = async (id: number) => {
    if (!confirm("Excluir serviço/artefato?")) return;
    await authFetch(`${apiBase}/kan/stages/${id}`, { method: "DELETE" });
    onStageChange();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h1 className="text-xl font-bold text-slate-900">Editar Pipeline: {pipeline.name}</h1>
      </div>

      {/* Pipeline details card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <p className="text-sm font-semibold text-slate-700">Detalhes do Pipeline</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Descrição</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
        </div>
        <button
          onClick={savePipeline}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>

      {/* Stages / Artifacts */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
          <div>
            <p className="text-sm font-semibold text-slate-700">Serviços / Artefatos</p>
            <p className="text-xs text-slate-400">Gerencie os serviços deste pipeline</p>
          </div>
          <button
            onClick={() => { setEditStage(null); setShowStageModal(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Novo Serviço
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-5 py-3 text-left text-xs text-slate-400 font-medium">Nome</th>
              <th className="px-5 py-3 text-left text-xs text-slate-400 font-medium">Sigla</th>
              <th className="px-5 py-3 text-left text-xs text-slate-400 font-medium">Colunas</th>
              <th className="px-5 py-3 text-left text-xs text-slate-400 font-medium">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stages.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                  Nenhum serviço cadastrado
                </td>
              </tr>
            ) : (
              stages.map((st) => (
                <tr key={st.id} className="hover:bg-slate-50">
                  <td
                    className="px-5 py-3 text-sm text-blue-600 cursor-pointer hover:underline font-medium"
                    onClick={() => onOpenStage(st)}
                  >
                    {st.name}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-400">{st.service?.sigla || "-"}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{st.columns.length}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      st.isActive ? "bg-slate-900 text-white" : "bg-red-500 text-white"
                    }`}>
                      {st.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setEditStage(st); setShowStageModal(true); }}
                        className="text-slate-400 hover:text-slate-700"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteStage(st.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showStageModal && (
        <StageModal
          stage={editStage}
          pipelineId={pipeline.id}
          onClose={() => setShowStageModal(false)}
          onSaved={() => { setShowStageModal(false); onStageChange(); }}
        />
      )}
    </div>
  );
}

// ── Level 3 — Stage edit + columns ────────────────────────────────────────────

function StageEditView({
  pipeline,
  stage,
  columnsTick,
  onColumnChange,
  onBack,
}: {
  pipeline: Pipeline;
  stage: Stage;
  columnsTick: number;
  onColumnChange: () => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(stage.name);
  const sigla = stage.service?.sigla || "";
  const [saving, setSaving] = useState(false);
  const [columns, setColumns] = useState<Column[]>(stage.columns || []);
  const [editCol, setEditCol] = useState<Column | null | "new">(null);

  const loadColumns = () => {
    authFetch(`${apiBase}/kan/pipelines/${pipeline.id}/stages`)
      .then((r) => r.json())
      .then((data: Stage[]) => {
        const found = data.find((s) => s.id === stage.id);
        if (found) setColumns((found.columns || []).sort((a, b) => a.columnIndex - b.columnIndex));
      })
      .catch(() => {});
  };

  useEffect(loadColumns, [stage.id, pipeline.id, columnsTick]);

  const saveStage = async () => {
    setSaving(true);
    const res = await authFetch(`${apiBase}/kan/stages/${stage.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (!res.ok) alert("Erro ao salvar serviço");
  };

  const deleteColumn = async (id: number) => {
    if (!confirm("Excluir coluna?")) return;
    await authFetch(`${apiBase}/kan/columns/${id}`, { method: "DELETE" });
    onColumnChange();
  };

  const moveColumn = async (col: Column, direction: "up" | "down") => {
    const sorted = [...columns].sort((a, b) => a.columnIndex - b.columnIndex);
    const idx = sorted.findIndex((c) => c.id === col.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    // Swap columnIndex values
    await Promise.all([
      authFetch(`${apiBase}/kan/columns/${col.id}`, {
        method: "PATCH",
        body: JSON.stringify({ columnIndex: other.columnIndex }),
      }),
      authFetch(`${apiBase}/kan/columns/${other.id}`, {
        method: "PATCH",
        body: JSON.stringify({ columnIndex: col.columnIndex }),
      }),
    ]);
    loadColumns();
    onColumnChange();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h1 className="text-xl font-bold text-slate-900">Editar Serviço: {stage.name}</h1>
      </div>

      {/* Stage details card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <p className="text-sm font-semibold text-slate-700">Detalhes do Serviço</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Nome (Descrição)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Sigla</label>
            <input
              readOnly
              value={sigla}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400"
            />
          </div>
        </div>
        <button
          onClick={saveStage}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>

      {/* Columns */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
          <div>
            <p className="text-sm font-semibold text-slate-700">Colunas do Stage</p>
            <p className="text-xs text-slate-400">Configure as etapas deste serviço</p>
          </div>
          <button
            onClick={() => setEditCol("new")}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Nova Coluna
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-5 py-3 text-left text-xs text-slate-400 font-medium w-8">Ordem</th>
              <th className="px-5 py-3 text-left text-xs text-slate-400 font-medium">Nome</th>
              <th className="px-5 py-3 text-left text-xs text-slate-400 font-medium">Cor</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {columns.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-slate-400">
                  Nenhuma coluna cadastrada
                </td>
              </tr>
            ) : (
              columns.map((col, idx) => (
                <tr key={col.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2">
                    <div className="flex flex-col gap-0.5">
                      <button
                        disabled={idx === 0}
                        onClick={() => moveColumn(col, "up")}
                        className="p-0.5 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        disabled={idx === columns.length - 1}
                        onClick={() => moveColumn(col, "down")}
                        className="p-0.5 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-700">{col.name}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-5 h-5 rounded-full border border-slate-200"
                        style={{ backgroundColor: COLOR_MAP[col.color] || col.color }}
                      />
                      <span className="text-xs text-slate-400 capitalize">
                        {COLORS.find((c) => c.value === col.color)?.label || col.color}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditCol(col)}
                        className="rounded p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteColumn(col.id)}
                        className="rounded p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editCol !== null && (
        <ColumnModal
          stageId={stage.id}
          column={editCol === "new" ? null : editCol}
          onClose={() => setEditCol(null)}
          onSaved={() => { setEditCol(null); loadColumns(); onColumnChange(); }}
        />
      )}
    </div>
  );
}

// ── Modals ───────────────────────────────────────────────────────────────────

function PipelineModal({
  pipeline,
  onClose,
  onSaved,
}: {
  pipeline: Pipeline | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !pipeline;
  const [name, setName] = useState(pipeline?.name || "");
  const [description, setDescription] = useState(pipeline?.description || "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name) return;
    setSaving(true);
    const url = isNew ? `${apiBase}/kan/pipelines` : `${apiBase}/kan/pipelines/${pipeline!.id}`;
    const res = await authFetch(url, {
      method: isNew ? "POST" : "PATCH",
      body: JSON.stringify({ name, description: description || null }),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else alert("Erro ao salvar pipeline");
  };

  return (
    <ModalShell onClose={onClose} title={isNew ? "Novo Pipeline" : "Editar Pipeline"}>
      <div className="space-y-3">
        <Field label="Nome">
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Descrição">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function StageModal({
  stage,
  pipelineId,
  onClose,
  onSaved,
}: {
  stage: Stage | null;
  pipelineId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !stage;
  const [name, setName] = useState(stage?.name || "");
  const [description, setDescription] = useState(stage?.description || "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name) return;
    setSaving(true);
    const url = isNew ? `${apiBase}/kan/stages` : `${apiBase}/kan/stages/${stage!.id}`;
    const body = isNew
      ? { pipelineId, name, description: description || null }
      : { name, description: description || null };
    const res = await authFetch(url, {
      method: isNew ? "POST" : "PATCH",
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else alert("Erro ao salvar serviço/artefato");
  };

  return (
    <ModalShell onClose={onClose} title={isNew ? "Novo Serviço / Artefato" : "Editar Serviço / Artefato"}>
      <div className="space-y-3">
        <Field label="Nome">
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Descrição">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

const COLORS = [
  { value: "indigo",  label: "Índigo"   },
  { value: "purple",  label: "Roxo"     },
  { value: "blue",    label: "Azul"     },
  { value: "sky",     label: "Céu"      },
  { value: "teal",    label: "Teal"     },
  { value: "green",   label: "Verde"    },
  { value: "yellow",  label: "Amarelo"  },
  { value: "orange",  label: "Laranja"  },
  { value: "red",     label: "Vermelho" },
  { value: "rose",    label: "Rosa"     },
  { value: "pink",    label: "Pink"     },
  { value: "gray",    label: "Cinza"    },
];

const COLOR_MAP: Record<string, string> = {
  indigo:  "#6366f1",
  purple:  "#a855f7",
  blue:    "#3b82f6",
  sky:     "#0ea5e9",
  teal:    "#14b8a6",
  green:   "#22c55e",
  yellow:  "#eab308",
  orange:  "#f97316",
  red:     "#ef4444",
  rose:    "#f43f5e",
  pink:    "#ec4899",
  gray:    "#94a3b8",
};

function ColumnModal({
  stageId,
  column,
  onClose,
  onSaved,
}: {
  stageId: number;
  column: Column | null;   // null = new, Column = edit
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !column;
  const [name, setName] = useState(column?.name || "");
  const [color, setColor] = useState(column?.color || "indigo");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const url = isNew ? `${apiBase}/kan/columns` : `${apiBase}/kan/columns/${column!.id}`;
    const method = isNew ? "POST" : "PATCH";
    const body = isNew ? { stageId, name: name.trim(), color } : { name: name.trim(), color };
    const res = await authFetch(url, { method, body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) onSaved();
    else alert("Erro ao salvar coluna");
  };

  const selectedHex = COLOR_MAP[color] || "#94a3b8";

  return (
    <ModalShell onClose={onClose} title={isNew ? "Nova Coluna" : "Editar Coluna"}>
      <div className="space-y-4">
        <Field label="Nome">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={INPUT}
            placeholder="ex: Pendente"
            autoFocus
          />
        </Field>

        <Field label="Cor">
          <div className="space-y-2">
            {/* Preview */}
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-6 h-6 rounded-full border border-slate-200 shadow-sm"
                style={{ backgroundColor: selectedHex }}
              />
              <span className="text-sm text-slate-600">
                {COLORS.find((c) => c.value === color)?.label || color}
              </span>
            </div>
            {/* Color swatches */}
            <div className="grid grid-cols-6 gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  title={c.label}
                  className={`group relative w-full aspect-square rounded-lg border-2 transition-all hover:scale-105 ${
                    color === c.value
                      ? "border-slate-900 ring-2 ring-slate-900 ring-offset-1 scale-110"
                      : "border-transparent hover:border-slate-300"
                  }`}
                  style={{ backgroundColor: COLOR_MAP[c.value] }}
                >
                  <span className="sr-only">{c.label}</span>
                </button>
              ))}
            </div>
            {/* Color name labels */}
            <div className="grid grid-cols-6 gap-2">
              {COLORS.map((c) => (
                <span
                  key={c.value}
                  className={`text-center text-[10px] leading-tight ${
                    color === c.value ? "font-bold text-slate-800" : "text-slate-400"
                  }`}
                >
                  {c.label}
                </span>
              ))}
            </div>
          </div>
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving || !name.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Salvando..." : isNew ? "Criar Coluna" : "Salvar Alterações"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      {children}
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
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
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
