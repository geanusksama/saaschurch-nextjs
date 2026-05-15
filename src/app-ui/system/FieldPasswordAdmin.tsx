'use client';
import { useState, useEffect } from 'react';
import { Lock, Shield, Eye, EyeOff, Check, X, Trash2, KeyRound, Building2 } from 'lucide-react';
import { apiBase } from '../../lib/apiBase';
import { toast } from 'sonner';

type Campo = {
  id: string;
  name: string;
  code?: string | null;
  hasPassword: boolean;
};

function readStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

export default function FieldPasswordAdmin() {
  const storedUser = readStoredUser();
  const isMasterOrAdmin = storedUser.profileType === 'master' || storedUser.profileType === 'admin';
  const token = localStorage.getItem('mrm_token');

  const [campos, setCampos] = useState<Campo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampo, setSelectedCampo] = useState<Campo | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isMasterOrAdmin) return;
    loadCampos();
  }, []);

  async function loadCampos() {
    setLoading(true);
    try {
      // Load all campos from list-all endpoint (no auth needed for base list)
      const res = await fetch(`${apiBase}/campos`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Falha ao carregar campos');
      const data: Omit<Campo, 'hasPassword'>[] = await res.json();

      // Enrich with hasPassword status by fetching each campo individually
      const enriched = await Promise.all(
        data.map(async (c) => {
          try {
            const r = await fetch(`${apiBase}/campos/${c.id}`, { headers: { Authorization: `Bearer ${token}` } });
            if (r.ok) { const d = await r.json(); return { ...c, hasPassword: !!d.hasPassword }; }
          } catch { /* ignore */ }
          return { ...c, hasPassword: false };
        })
      );
      setCampos(enriched);
    } catch (e) {
      toast.error('Erro ao carregar campos');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!selectedCampo) return;
    if (!password) { toast.error('Informe a senha.'); return; }
    if (password.length < 4) { toast.error('A senha deve ter no mínimo 4 caracteres.'); return; }
    if (password !== confirmPassword) { toast.error('As senhas não coincidem.'); return; }

    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/campos/${selectedCampo.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao definir senha.');
      toast.success(`Senha do campo "${selectedCampo.name}" definida com sucesso!`);
      setPassword('');
      setConfirmPassword('');
      setSelectedCampo(null);
      loadCampos();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar senha.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(campo: Campo) {
    if (!confirm(`Remover senha do campo "${campo.name}"? Qualquer usuário poderá acessá-lo sem senha.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/campos/${campo.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ removePassword: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao remover senha.');
      toast.success(`Senha do campo "${campo.name}" removida.`);
      loadCampos();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover senha.');
    } finally {
      setSaving(false);
    }
  }

  if (!isMasterOrAdmin) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md text-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm">
          <div className="mx-auto w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-4">
            <Shield className="w-7 h-7 text-rose-600 dark:text-rose-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Acesso Restrito</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Esta área é exclusiva para administradores e master. Contacte o responsável do sistema.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/40 rounded-xl flex items-center justify-center">
          <KeyRound className="w-6 h-6 text-purple-600 dark:text-purple-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Senha dos Campos</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Defina senhas de acesso para cada campo. Usuários precisarão informar a senha ao alternar o contexto.
          </p>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 flex gap-3">
        <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-semibold mb-0.5">Como funciona</p>
          <p>Campos com senha exigirão que o usuário informe a senha correta ao tentar alternar o contexto no seletor de campo. Campos sem senha são acessíveis livremente.</p>
        </div>
      </div>

      {/* Campos list */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 dark:text-white">Campos Cadastrados</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">{campos.length} campo(s)</span>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-center text-slate-400 dark:text-slate-500">Carregando campos...</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {campos.map((campo) => (
              <div key={campo.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                {/* Icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/40">
                  <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">
                    {campo.code ? `${campo.code} — ` : ''}{campo.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {campo.hasPassword ? (
                      <>
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Senha configurada</span>
                      </>
                    ) : (
                      <>
                        <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-500" />
                        <span className="text-xs text-slate-400 dark:text-slate-500">Sem senha — acesso livre</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => { setSelectedCampo(campo); setPassword(''); setConfirmPassword(''); }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    {campo.hasPassword ? 'Alterar senha' : 'Definir senha'}
                  </button>
                  {campo.hasPassword && (
                    <button
                      type="button"
                      onClick={() => handleRemove(campo)}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 transition-colors disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Password modal */}
      {selectedCampo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/40">
                  <Lock className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">
                    {selectedCampo.hasPassword ? 'Alterar Senha' : 'Definir Senha'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{selectedCampo.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCampo(null)}
                className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Nova Senha *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 pr-10 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Mínimo 4 caracteres"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Confirmar Senha *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 pr-10 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Repita a senha"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                  />
                  {confirmPassword && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {password === confirmPassword
                        ? <Check className="h-4 w-4 text-emerald-500" />
                        : <X className="h-4 w-4 text-red-500" />}
                    </div>
                  )}
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">As senhas não coincidem.</p>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
              <button
                type="button"
                onClick={() => setSelectedCampo(null)}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !password || password !== confirmPassword}
                className="flex-1 rounded-lg bg-purple-600 hover:bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? 'Salvando...' : (
                  <><Lock className="h-4 w-4" /> Salvar Senha</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
