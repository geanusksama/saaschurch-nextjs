import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calculator, MoreVertical, Send, History, X, Loader2, AlertTriangle, Plus, Copy, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiBase } from '../../lib/apiBase';
import { podeAcessarContabilidadeAgendamento } from '../../lib/contabilidadeAgendamentoRole';

type Acesso = {
  id: string;
  nome: string;
  campo: string;
  telefone: string;
  hash: string;
  ativo: boolean;
  tentativas: number;
  ultimo_acesso: string | null;
  agendamento: Agendamento | null;
  ultimo_status_envio: 'sucesso' | 'erro' | 'parcial' | null;
};

type Agendamento = {
  id: string;
  acesso_id: string;
  ativo: boolean;
  frequencia: 'mensal' | 'semanal' | 'manual';
  dia_envio: number;
  hora_envio: string;
  timezone: string;
  tipo_periodo: 'mes_corrente' | 'mes_anterior' | 'gap';
  gap_meses: number;
  qtd_meses: number;
  proximo_envio: string | null;
  ultimo_envio: string | null;
};

type Historico = {
  id: string;
  disparado_em: string;
  tipo: 'automatico' | 'manual';
  status: 'sucesso' | 'erro' | 'parcial';
  total_registros: number;
  total_divergencias: number;
  erro: string | null;
  periodos: Array<{ ano: number; mes: number; qtd_registros: number; qtd_divergencias: number }>;
};

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-slate-900 dark:bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('mrm_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function fmtData(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Indicador de status da linha: vermelho = último envio deu erro, verde = último envio
 * deu certo, amarelo = agendado mas ainda sem nenhum envio registrado, cinza = sem
 * agendamento ativo.
 */
function statusDotColor(acc: Acesso): string {
  if (acc.ultimo_status_envio === 'erro') return '#ef4444';
  if (acc.ultimo_status_envio === 'sucesso' || acc.ultimo_status_envio === 'parcial') return '#22c55e';
  if (acc.agendamento?.ativo) return '#facc15';
  return '#cbd5e1';
}

function statusDotLabel(acc: Acesso): string {
  if (acc.ultimo_status_envio === 'erro') return 'Último envio falhou';
  if (acc.ultimo_status_envio === 'sucesso') return 'Último envio enviado com sucesso';
  if (acc.ultimo_status_envio === 'parcial') return 'Último envio parcial';
  if (acc.agendamento?.ativo) return 'Agendado, aguardando próximo envio';
  return 'Sem agendamento ativo';
}

function readStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

export default function ContabilidadeAgendamentos() {
  const storedUser = readStoredUser();
  const permitido = podeAcessarContabilidadeAgendamento(storedUser.profileType, storedUser.roleName || storedUser.role?.name);

  const [items, setItems] = useState<Acesso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openMenu, setOpenMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const [configTarget, setConfigTarget] = useState<Acesso | null>(null);
  const [historicoTarget, setHistoricoTarget] = useState<Acesso | null>(null);
  const [previewTarget, setPreviewTarget] = useState<Acesso | null>(null);
  const [novoContadorOpen, setNovoContadorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Acesso | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Acesso | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('click', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('click', close);
    };
  }, [openMenu]);

  const toggleMenu = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (openMenu?.id === id) { setOpenMenu(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenMenu({ id, top: rect.bottom + 4, left: rect.right - 224 });
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/contabilidade/agendamentos`, { headers: authHeaders() });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Erro ${res.status}`);
      const json = await res.json();
      setItems(json.items ?? []);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar contadores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (permitido) load(); }, []);

  const enviarAgora = async (acesso: Acesso) => {
    const res = await fetch(`${apiBase}/contabilidade/agendamentos/${acesso.id}/enviar-agora`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
    if (json.resultado?.status === 'erro') {
      throw new Error(json.resultado.erro || 'Falha ao enviar relatório.');
    }
    load();
    return json.resultado;
  };

  if (!permitido) {
    return (
      <div className="p-6 text-slate-900 dark:text-slate-100">
        <div className="max-w-lg mx-auto text-center py-16">
          <Calculator className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <h1 className="text-lg font-bold mb-1">Acesso restrito</h1>
          <p className="text-slate-500">Esta tela é exclusiva da função Tesouraria.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
          <Calculator className="w-6 h-6 text-slate-600 dark:text-slate-300" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Contabilidade — Envio Automático</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Agende o envio periódico do relatório contábil por WhatsApp aos contadores cadastrados.
          </p>
        </div>
        <button
          onClick={() => setNovoContadorOpen(true)}
          className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-purple-600 text-white flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" /> Novo Contador
        </button>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm">{error}</div>}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium w-8"></th>
              <th className="px-4 py-3 font-medium">Contador</th>
              <th className="px-4 py-3 font-medium">Campo</th>
              <th className="px-4 py-3 font-medium">WhatsApp</th>
              <th className="px-4 py-3 font-medium">Senha (acesso home)</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Último envio</th>
              <th className="px-4 py-3 font-medium">Próximo envio</th>
              <th className="px-4 py-3 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Nenhum contador cadastrado.</td></tr>
            ) : items.map((acc) => {
              const ag = acc.agendamento;
              const ativo = !!ag?.ativo;
              return (
                <tr key={acc.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: statusDotColor(acc) }}
                      title={statusDotLabel(acc)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{acc.nome}</td>
                  <td className="px-4 py-3 text-slate-500">{acc.campo}</td>
                  <td className="px-4 py-3 text-slate-500">{acc.telefone}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">{acc.hash}</code>
                      <button
                        onClick={() => { navigator.clipboard?.writeText(acc.hash); toast.success('Senha copiada.'); }}
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                        title="Copiar senha"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {!acc.ativo ? (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Bloqueado</span>
                    ) : ativo ? (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Envio ativo</span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Não configurado</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{fmtData(ag?.ultimo_envio ?? null)}</td>
                  <td className="px-4 py-3 text-slate-500">{ativo ? fmtData(ag?.proximo_envio ?? null) : '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => toggleMenu(e, acc.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openMenu && typeof document !== 'undefined' && createPortal(
        (() => {
          const acc = items.find((i) => i.id === openMenu.id);
          if (!acc) return null;
          return (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'fixed', top: openMenu.top, left: Math.max(8, openMenu.left) }}
              className="z-50 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1"
            >
              <button
                onClick={() => { setConfigTarget(acc); setOpenMenu(null); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Configurar agendamento
              </button>
              <button
                onClick={() => { setHistoricoTarget(acc); setOpenMenu(null); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <History className="w-3.5 h-3.5" /> Histórico de envios
              </button>
              <button
                onClick={() => { setPreviewTarget(acc); setOpenMenu(null); }}
                disabled={!acc.ativo}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Enviar agora
              </button>
              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              <button
                onClick={() => { setEditTarget(acc); setOpenMenu(null); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <Pencil className="w-3.5 h-3.5" /> Editar contador
              </button>
              <button
                onClick={() => { setDeleteTarget(acc); setOpenMenu(null); }}
                className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir contador
              </button>
            </div>
          );
        })(),
        document.body
      )}

      {configTarget && (
        <ConfigModal
          acesso={configTarget}
          onClose={() => setConfigTarget(null)}
          onSaved={() => { setConfigTarget(null); load(); }}
        />
      )}

      {historicoTarget && (
        <HistoricoDrawer acesso={historicoTarget} onClose={() => setHistoricoTarget(null)} />
      )}

      {previewTarget && (
        <EnviarAgoraModal
          acesso={previewTarget}
          onClose={() => setPreviewTarget(null)}
          onConfirm={() => enviarAgora(previewTarget)}
        />
      )}

      {novoContadorOpen && (
        <NovoContadorModal
          onClose={() => setNovoContadorOpen(false)}
          onCreated={() => { setNovoContadorOpen(false); load(); }}
        />
      )}

      {editTarget && (
        <EditarContadorModal
          acesso={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); load(); }}
        />
      )}

      {deleteTarget && (
        <ExcluirContadorModal
          acesso={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Modal "Novo Contador" (cadastro de contabilidade_acessos) ────────────────

type CampoOption = { id: string; name: string };

function NovoContadorModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [campos, setCampos] = useState<CampoOption[]>([]);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [campo, setCampo] = useState('');
  const [saving, setSaving] = useState(false);
  const [hashGerado, setHashGerado] = useState<{ hash: string; nome: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/campos/list-all`, { headers: authHeaders() });
        const json = await res.json();
        setCampos(Array.isArray(json) ? json : []);
      } catch {
        toast.error('Falha ao carregar campos.');
      }
    })();
  }, []);

  const salvar = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/contabilidade/contadores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ nome, telefone, campo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
      setHashGerado({ hash: json.contador.hash, nome: json.contador.nome });
      toast.success('Contador cadastrado.');
    } catch (err: any) {
      toast.error(err.message || 'Falha ao cadastrar contador.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-lg">Novo Contador</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        {hashGerado ? (
          <div className="p-4 space-y-4">
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-sm">
              <strong>{hashGerado.nome}</strong> cadastrado com sucesso.
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">Senha de acesso do contador (hash)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-sm">{hashGerado.hash}</code>
                <button
                  onClick={() => { navigator.clipboard?.writeText(hashGerado.hash); toast.success('Copiado.'); }}
                  className="p-2 rounded-lg border border-slate-300 dark:border-slate-700"
                  title="Copiar"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Anote e repasse ao contador — é a senha que ele usa junto do WhatsApp para acessar o relatório. Não será mostrada de novo.
              </p>
            </div>
            <div className="flex justify-end">
              <button onClick={onCreated} className="px-4 py-2 rounded-lg bg-purple-600 text-white">Concluir</button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-semibold block mb-1">Nome do contador</label>
                <input
                  value={nome} onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Contabilidade Campinas"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
                />
              </div>
              <div>
                <label className="text-sm font-semibold block mb-1">Campo</label>
                <select
                  value={campo} onChange={(e) => setCampo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
                >
                  <option value="">Selecione o campo…</option>
                  {campos.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <p className="text-xs text-slate-500 mt-1">O relatório enviado será somente deste campo.</p>
              </div>
              <div>
                <label className="text-sm font-semibold block mb-1">WhatsApp (com DDD)</label>
                <input
                  value={telefone} onChange={(e) => setTelefone(e.target.value)}
                  placeholder="Ex.: 19992126683"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
              <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700">Cancelar</button>
              <button
                onClick={salvar}
                disabled={saving || !nome.trim() || !campo || !telefone.trim()}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Cadastrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Modal "Editar Contador" ──────────────────────────────────────────────────

function EditarContadorModal({ acesso, onClose, onSaved }: { acesso: Acesso; onClose: () => void; onSaved: () => void }) {
  const [campos, setCampos] = useState<CampoOption[]>([]);
  const [nome, setNome] = useState(acesso.nome);
  const [telefone, setTelefone] = useState(acesso.telefone);
  const [campo, setCampo] = useState(acesso.campo);
  const [ativo, setAtivo] = useState(acesso.ativo);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/campos/list-all`, { headers: authHeaders() });
        const json = await res.json();
        setCampos(Array.isArray(json) ? json : []);
      } catch {
        toast.error('Falha ao carregar campos.');
      }
    })();
  }, []);

  const salvar = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/contabilidade/contadores/${acesso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ nome, telefone, campo, ativo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
      toast.success('Contador atualizado.');
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const bloqueado = !acesso.ativo;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-lg">Editar contador</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-semibold block mb-1">Nome do contador</label>
            <input
              value={nome} onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
            />
          </div>
          <div>
            <label className="text-sm font-semibold block mb-1">Campo</label>
            <select
              value={campo} onChange={(e) => setCampo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
            >
              {/* mantém o valor atual mesmo que não bata exatamente com o name da lista */}
              {!campos.some((c) => c.name === campo) && campo && <option value={campo}>{campo}</option>}
              {campos.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <p className="text-xs text-slate-500 mt-1">O relatório enviado será somente deste campo.</p>
          </div>
          <div>
            <label className="text-sm font-semibold block mb-1">WhatsApp (com DDD)</label>
            <input
              value={telefone} onChange={(e) => setTelefone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
            />
          </div>

          <div>
            <label className="text-sm font-semibold block mb-1">Senha de acesso (home)</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-sm">{acesso.hash}</code>
              <button
                onClick={() => { navigator.clipboard?.writeText(acesso.hash); toast.success('Copiado.'); }}
                className="p-2 rounded-lg border border-slate-300 dark:border-slate-700"
                title="Copiar"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-sm">Acesso ativo</span>
              {bloqueado && <p className="text-xs text-red-500">Bloqueado por tentativas erradas — ative para liberar de novo.</p>}
            </div>
            <Switch checked={ativo} onChange={setAtivo} />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700">Cancelar</button>
          <button
            onClick={salvar}
            disabled={saving || !nome.trim() || !campo || !telefone.trim()}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal "Excluir Contador" ─────────────────────────────────────────────────

function ExcluirContadorModal({ acesso, onClose, onDeleted }: { acesso: Acesso; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);

  const excluir = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${apiBase}/contabilidade/contadores/${acesso.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
      toast.success('Contador excluído.');
      onDeleted();
    } catch (err: any) {
      toast.error(err.message || 'Falha ao excluir.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-lg flex items-center gap-2 text-red-600 dark:text-red-400">
            <Trash2 className="w-5 h-5" /> Excluir contador
          </h2>
        </div>
        <div className="p-4 text-sm text-slate-600 dark:text-slate-300">
          Excluir <strong>{acesso.nome}</strong>? Isso remove também o agendamento e todo o histórico de envios deste contador. Esta ação não pode ser desfeita.
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700">Cancelar</button>
          <button
            onClick={excluir}
            disabled={deleting}
            className="px-4 py-2 rounded-lg bg-red-600 text-white disabled:opacity-50 flex items-center gap-2"
          >
            {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de configuração (RF002/RF003/RF004) ───────────────────────────────

function ConfigModal({ acesso, onClose, onSaved }: { acesso: Acesso; onClose: () => void; onSaved: () => void }) {
  const ag = acesso.agendamento;
  const [ativo, setAtivo] = useState(ag?.ativo ?? false);
  const [frequencia, setFrequencia] = useState<Agendamento['frequencia']>(ag?.frequencia ?? 'mensal');
  const [diaEnvio, setDiaEnvio] = useState(ag?.dia_envio ?? 1);
  const [horaEnvio, setHoraEnvio] = useState((ag?.hora_envio ?? '08:00:00').slice(0, 5));
  const [timezone] = useState(ag?.timezone ?? 'America/Sao_Paulo');
  const [tipoPeriodo, setTipoPeriodo] = useState<Agendamento['tipo_periodo']>(ag?.tipo_periodo ?? 'mes_anterior');
  const [gapMeses, setGapMeses] = useState(ag?.gap_meses ?? 1);
  const [qtdMeses, setQtdMeses] = useState(ag?.qtd_meses ?? 1);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/contabilidade/agendamentos/${acesso.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          ativo, frequencia,
          dia_envio: Number(diaEnvio),
          hora_envio: `${horaEnvio}:00`,
          timezone,
          tipo_periodo: tipoPeriodo,
          gap_meses: Number(gapMeses),
          qtd_meses: Number(qtdMeses),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
      toast.success('Agendamento salvo.');
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-lg">Agendamento — {acesso.nome}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-5">
          <div className="flex items-center justify-between">
            <span className="font-medium">Envio automático ativo</span>
            <Switch checked={ativo} onChange={setAtivo} />
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">Frequência</p>
            <div className="flex gap-2">
              {(['mensal', 'semanal', 'manual'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFrequencia(f)}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${frequencia === f ? 'bg-purple-600 text-white border-purple-600' : 'border-slate-300 dark:border-slate-700'}`}
                >
                  {f === 'mensal' ? 'Mensal' : f === 'semanal' ? 'Semanal' : 'Manual'}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Manual = nunca dispara sozinho; use o botão "Enviar agora" no menu da tabela.
            </p>
          </div>

          {frequencia !== 'manual' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold block mb-1">
                  {frequencia === 'mensal' ? 'Dia do mês (data específica)' : 'Dia da semana'}
                </label>
                {frequencia === 'mensal' ? (
                  <input
                    type="number" min={1} max={28} value={diaEnvio}
                    onChange={(e) => setDiaEnvio(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
                  />
                ) : (
                  <select
                    value={diaEnvio}
                    onChange={(e) => setDiaEnvio(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
                  >
                    {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="text-sm font-semibold block mb-1">Hora do envio</label>
                <input
                  type="time" value={horaEnvio}
                  onChange={(e) => setHoraEnvio(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
                />
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold mb-2">Período do relatório</p>
            <select
              value={tipoPeriodo}
              onChange={(e) => setTipoPeriodo(e.target.value as Agendamento['tipo_periodo'])}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent mb-2"
            >
              <option value="mes_corrente">Mês corrente</option>
              <option value="mes_anterior">Mês anterior</option>
              <option value="gap">Intervalo (GAP) de meses</option>
            </select>

            {tipoPeriodo === 'gap' && (
              <div>
                <label className="text-sm block mb-1">GAP — quantos meses de atraso</label>
                <input
                  type="number" min={0} value={gapMeses}
                  onChange={(e) => setGapMeses(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">Ex.: GAP=2, hoje é julho → envia maio.</p>
              </div>
            )}

            <div className="mt-2">
              <label className="text-sm block mb-1">Quantidade de meses enviados de uma vez</label>
              <input
                type="number" min={1} value={qtdMeses}
                onChange={(e) => setQtdMeses(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Quantos meses consecutivos, terminando no período acima, entram no mesmo envio.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Drawer de histórico (RF009/RF011) ────────────────────────────────────────

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function HistoricoDrawer({ acesso, onClose }: { acesso: Acesso; onClose: () => void }) {
  const [items, setItems] = useState<Historico[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/contabilidade/agendamentos/${acesso.id}/historico`, { headers: authHeaders() });
        const json = await res.json();
        setItems(json.items ?? []);
      } catch {
        toast.error('Falha ao carregar histórico.');
      } finally {
        setLoading(false);
      }
    })();
  }, [acesso.id]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-end z-50">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl h-full overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900">
          <h2 className="font-bold text-lg">Histórico — {acesso.nome}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
          ) : items.length === 0 ? (
            <p className="text-center py-8 text-slate-400">Nenhum envio registrado ainda.</p>
          ) : items.map((h) => (
            <div key={h.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{fmtData(h.disparado_em)}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  h.status === 'sucesso' ? 'bg-green-100 text-green-700'
                  : h.status === 'erro' ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {h.status} · {h.tipo}
                </span>
              </div>
              {h.status === 'erro' ? (
                <p className="text-sm text-red-600 dark:text-red-400">{h.erro}</p>
              ) : (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                    {h.total_registros} lançamentos enviados
                    {h.total_divergencias > 0 && (
                      <span className="text-orange-600 dark:text-orange-400"> · {h.total_divergencias} divergência(s)</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {h.periodos.map((p, i) => (
                      <span
                        key={i}
                        className={`px-2 py-0.5 rounded text-xs ${p.qtd_divergencias > 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                        title={p.qtd_divergencias > 0 ? `${p.qtd_divergencias} lançamento(s) que sumiram desde o envio anterior` : undefined}
                      >
                        {MESES_PT[p.mes - 1]}/{p.ano}: {p.qtd_registros}{p.qtd_divergencias > 0 ? ` (−${p.qtd_divergencias})` : ''}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Modal "Enviar agora": prévia (RF008/RF009) antes de confirmar o disparo ──

type AnalisePeriodo = {
  ano: number;
  mes: number;
  totalRegistros: number;
  totalValor: number;
  versaoAnterior: number | null;
  qtdAnterior: number | null;
  diferenca: number | null;
  ausentes: number;
};

function fmtMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function EnviarAgoraModal({ acesso, onClose, onConfirm }: { acesso: Acesso; onClose: () => void; onConfirm: () => Promise<any> }) {
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState('');
  const [periodos, setPeriodos] = useState<AnalisePeriodo[]>([]);
  const [mensagemPreview, setMensagemPreview] = useState('');
  const [sending, setSending] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/contabilidade/agendamentos/${acesso.id}/preview`, { headers: authHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
        setPeriodos(json.analise?.periodos ?? []);
        setMensagemPreview(json.analise?.mensagemPreview ?? '');
      } catch (err: any) {
        setPreviewError(err.message || 'Falha ao analisar o período.');
      } finally {
        setLoadingPreview(false);
      }
    })();
  }, [acesso.id]);

  const confirmar = async () => {
    setSending(true);
    try {
      await onConfirm();
      setResultado({ ok: true, texto: `Relatório enviado para ${acesso.nome}.` });
    } catch (err: any) {
      setResultado({ ok: false, texto: err.message || 'Falha ao enviar relatório.' });
    } finally {
      setSending(false);
    }
  };

  const totalDivergencias = periodos.reduce((s, p) => s + p.ausentes, 0);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-lg">Enviar agora — {acesso.nome}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {resultado ? (
            <div className={`p-4 rounded-lg text-sm ${resultado.ok ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'}`}>
              {resultado.texto}
            </div>
          ) : loadingPreview ? (
            <div className="text-center py-8 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin inline mb-2" />
              <p>Analisando o que vai ser enviado…</p>
            </div>
          ) : previewError ? (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {previewError}
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                Baseado na configuração atual de <strong>{acesso.nome}</strong>, isto é o que vai ser enviado por WhatsApp para <strong>{acesso.telefone}</strong>:
              </p>

              <div className="space-y-2">
                {periodos.map((p, i) => (
                  <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{MESES_PT[p.mes - 1]}/{p.ano}</span>
                      <span className="text-sm text-slate-500">{p.totalRegistros} lançamentos — {fmtMoeda(p.totalValor)}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {p.versaoAnterior === null
                        ? 'Primeiro envio deste período'
                        : p.diferenca === 0
                          ? 'Sem alterações desde o último envio'
                          : `Anterior: ${p.qtdAnterior} → agora: ${p.totalRegistros} (${p.diferenca! > 0 ? '+' : ''}${p.diferenca})`}
                    </p>
                    {p.ausentes > 0 && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {p.ausentes} lançamento(s) que sumiram desde o último envio
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {totalDivergencias > 0 && (
                <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  {totalDivergencias} lançamento(s) no total sumiram desde o(s) último(s) envio(s) — o CSV e a mensagem já avisam o contador disso.
                </div>
              )}

              <details className="text-sm">
                <summary className="cursor-pointer text-slate-500">Ver texto exato da mensagem</summary>
                <pre className="whitespace-pre-wrap text-xs mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">{mensagemPreview}</pre>
              </details>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700">
            {resultado ? 'Fechar' : 'Cancelar'}
          </button>
          {!resultado && (
            <button
              onClick={confirmar}
              disabled={sending || loadingPreview || !!previewError}
              className="px-4 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-50 flex items-center gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Confirmar envio
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
