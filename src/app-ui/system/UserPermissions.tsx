import { useEffect, useState } from 'react';
import { Shield, ArrowLeft, Info, Save, RefreshCw, Copy, Clipboard } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Users } from 'lucide-react';
import { ArvorePermissoes } from './ArvorePermissoes';
import { toast } from 'sonner';
import { apiBase } from '../../lib/apiBase';

const PROFILE_LABELS: Record<string, string> = {
  master: 'Master',
  admin: 'Administrador',
  campo: 'Campo',
  church: 'Igreja',
};

const PROFILE_COLORS: Record<string, string> = {
  master: 'bg-red-100 text-red-700',
  admin: 'bg-purple-100 text-purple-700',
  campo: 'bg-blue-100 text-blue-700',
  church: 'bg-green-100 text-green-700',
};

// permissions JSON format: { "dashboard.view": true, "members.create": false, ... }
type PermMap = Record<string, boolean>;

// ─── Component ──────────────────────────────────────────────────────────────
export default function UserPermissions() {
  const { id } = useParams<{ id: string }>();
  const token = localStorage.getItem('mrm_token');

  const [user, setUser] = useState<{ id: string; fullName: string; email: string; profileType: string } | null>(null);
  const [perms, setPerms] = useState<PermMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [clipboard, setClipboard] = useState<PermMap | null>(() => {
    try {
      const raw = localStorage.getItem('mrm_perms_clipboard');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/users/${id}/permissions`, { headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      const data = await res.json();
      setUser({ id: data.id, fullName: data.fullName, email: data.email, profileType: data.profileType });
      setPerms((data.permissions as PermMap) || {});
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar permissões.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) load(); }, [id]);

  // Grupos de usuários: estando em algum, as regras desta tela ficam sem efeito.
  // Falha silenciosa: quem não pode ver grupos (403) só não vê o aviso.
  const [grupos, setGrupos] = useState<{ id: string; name: string; isActive: boolean }[]>([]);
  useEffect(() => {
    if (!id) return;
    fetch(`${apiBase}/grupos-usuarios?userId=${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setGrupos(Array.isArray(d) ? d.filter((g) => g.isActive) : []))
      .catch(() => setGrupos([]));
  }, [id, token]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/users/${id}/permissions`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: perms }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      // Se o usuário editado é o usuário logado, atualiza mrm_user no localStorage
      // para que usePermissions reflita as mudanças sem exigir novo login
      try {
        const stored = localStorage.getItem('mrm_user');
        if (stored) {
          const me = JSON.parse(stored);
          if (me.id === id) {
            me.permissions = perms;
            localStorage.setItem('mrm_user', JSON.stringify(me));
            window.dispatchEvent(new StorageEvent('storage', { key: 'mrm_user', newValue: JSON.stringify(me) }));
          }
        }
      } catch (_) { /* ignore */ }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    setPerms({});
    setSaved(false);
  };

  const handleCopy = () => {
    try { localStorage.setItem('mrm_perms_clipboard', JSON.stringify(perms)); } catch { /* ignore */ }
    setClipboard({ ...perms });
    const count = Object.keys(perms).length;
    toast.success(`Permissões copiadas!`, {
      description: count > 0 ? `${count} sobrescrita(s) copiada(s)` : 'Nenhuma sobrescrita (padrões do perfil)',
    });
  };

  const handlePaste = () => {
    if (!clipboard) return;
    setPerms({ ...clipboard });
    setSaved(false);
    const count = Object.keys(clipboard).length;
    toast.success(`Permissões coladas!`, {
      description: count > 0 ? `${count} sobrescrita(s) aplicada(s)` : 'Sobrescritas limpas (padrões do perfil)',
    });
  };

  return (
    <div className="p-6">
      {/* Back link */}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Permissões do Usuário
            </h1>
            {user && (
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-slate-500 dark:text-slate-400 text-sm">{user.fullName}</p>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${PROFILE_COLORS[user.profileType] || 'bg-slate-100 text-slate-700'}`}>
                  {PROFILE_LABELS[user.profileType] || user.profileType}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-sm text-green-600 dark:text-green-400 font-medium">Salvo!</span>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            title="Copiar configuração de permissões deste usuário"
          >
            <Copy className="w-3.5 h-3.5" />
            Copiar
          </button>
          <button
            onClick={handlePaste}
            disabled={!clipboard}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={clipboard ? `Colar permissões copiadas (${Object.keys(clipboard).length} sobrescritas)` : 'Nenhuma permissão copiada'}
          >
            <Clipboard className="w-3.5 h-3.5" />
            Colar
          </button>
          <button
            onClick={resetAll}
            className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            title="Remover todas as sobrescritas (usar padrões do perfil)"
          >
            Redefinir
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {grupos.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3 text-sm text-amber-800 dark:text-amber-300">
          <Users className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Este usuário está no(s) grupo(s) <strong>{grupos.map((g) => g.name).join(', ')}</strong>.
            Enquanto estiver em grupo, vale só a regra do grupo: as permissões abaixo ficam
            guardadas <strong>sem efeito</strong> e voltam a valer se ele sair de todos os grupos.
            Para mudar o acesso dele, edite o grupo em Configurações → Grupos de Usuários.
          </span>
        </div>
      )}

      {/* Info banner */}
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3 text-sm text-blue-700 dark:text-blue-300">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Cada tela é uma raiz com os componentes reais dela (botões, abas, relatórios). O que você
          marcar aqui <strong>sobrescreve</strong> o padrão do perfil só para este usuário. Clique
          para alternar: padrão → permitido → bloqueado → padrão; na raiz, vale para a tela
          inteira. Use <strong>Redefinir</strong> para limpar todas as sobrescritas. {Object.keys(perms).length}{' '}
          sobrescrita(s) ativa(s).
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">Carregando...</div>
      ) : (
        <div className="h-[70vh] bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <ArvorePermissoes
            modo="usuario"
            profileType={user?.profileType ?? 'church'}
            valores={perms}
            onChange={(novo) => {
              setPerms(novo);
              setSaved(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
