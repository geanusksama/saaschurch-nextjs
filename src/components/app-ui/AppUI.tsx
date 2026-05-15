import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { 
  LayoutDashboard, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  MessageSquare, 
  Settings,
  Clipboard,
  Search,
  Bell,
  ChevronDown,
  Building2,
  Menu,
  X,
  Heart,
  Zap,
  CheckSquare,
  BarChart3,
  Mail,
  Inbox,
  UserPlus,
  FileText,
  Shield,
  CreditCard,
  Gift,
  UserCheck,
  Cake,
  Building,
  Contact,
  Target,
  Wallet,
  TrendingDown,
  Home,
  MessageCircle,
  Plus,
  User,
  List,
  Radio,
  Ticket,
  BookOpen,
  LogOut,
  Plug,
  Sun,
  Moon,
  ChevronRight,
  Lock,
  HelpCircle,
  Star,
  LayoutGrid,
  GitBranch,
  FileSpreadsheet,
  MoreHorizontal,
  Award,
  MapPin,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GlobalSearchModal } from './GlobalSearchModal';
import { MemberEditDrawer } from './MemberEditDrawer';
import { usePermissions } from '../../lib/usePermissions';
import { THEME_EVENT_NAME, applyThemeSettings, loadThemeSettings, type ThemeSettings } from '../../lib/themeSettings';

import { apiBase } from '../../lib/apiBase';
import { supabase } from '../../lib/supabaseClient';

interface ContextSwitcherItem {
  id: string;
  name: string;
  level: 'field' | 'regional' | 'church';
  subtitle: string;
  requiresPassword?: boolean;
}

interface NavigationSection {
  section: string;
  items: NavigationItem[];
}

interface NavigationItem {
  name: string;
  path: string;
  icon: any;
  badge?: string;
  /** permissionKey from permissionCatalog — if set, only profiles with view=true for that key can see this item */
  permKey?: string;
}

type EcclesiasticalTitleOption = {
  id: string;
  name: string;
  abbreviation?: string | null;
  level: number;
};

function getRequestErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof TypeError) {
    return 'Backend indisponivel. Verifique se a API esta em execucao.';
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

function normalizeNavigationLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const appNavigation: NavigationSection[] = [
  {
    section: 'Principal',
    items: [
      { name: 'Notificações', path: '/app-ui/notifications', icon: Bell, permKey: 'notifications' },
      { name: 'Caixa de Entrada', path: '/app-ui/inbox', icon: Inbox },
    ]
  },
  {
    section: 'Secretaria',
    items: [
      { name: 'Pipeline', path: '/app-ui/secretariat/pipeline', icon: TrendingUp, permKey: 'crm_pipeline' },
      { name: 'Serviços e Ocorrências', path: '/app-ui/secretariat/services', icon: List, permKey: 'members' },
      { name: 'Configurar Pipelines', path: '/app-ui/secretariat/pipelines', icon: GitBranch, permKey: 'system_settings' },
      { name: 'Igrejas', path: '/app-ui/churches', icon: Building, permKey: 'system_settings' },
      { name: 'Lista de Membros', path: '/app-ui/members', icon: Users, permKey: 'members' },
      { name: 'Batismo', path: '/app-ui/baptism', icon: CheckSquare, permKey: 'baptism' },
      { name: 'Consagração', path: '/app-ui/consecration', icon: Gift, permKey: 'consecration' },
      { name: 'Transferência', path: '/app-ui/transfer', icon: UserCheck, permKey: 'transfer' },
      { name: 'Credenciais', path: '/app-ui/credentials', icon: Shield, permKey: 'credentials' },
      { name: 'Modelos de Credencial', path: '/app-ui/secretariat/credential-models', icon: CreditCard, permKey: 'credentials' },
      { name: 'Requerimentos', path: '/app-ui/requirements', icon: FileText, permKey: 'members' },
      { name: 'Relatórios', path: '/app-ui/reports', icon: BarChart3, permKey: 'reports' },
      { name: 'Aniversariantes', path: '/app-ui/birthdays', icon: Cake, permKey: 'birthdays' },
    ]
  },
  {
    section: 'Gestão Pastoral',
    items: [
      { name: 'Gestão', path: '/app-ui/pastoral-kanban', icon: LayoutGrid, permKey: 'pastoral_visits' },
      { name: 'Discipulado', path: '/app-ui/discipleship-tracking', icon: BookOpen, permKey: 'discipleship' },
      { name: 'Relatórios Pastorais', path: '/app-ui/pastoral-reports', icon: BarChart3, permKey: 'reports' },
    ]
  },
  {
    section: 'Ministérios',
    items: [
      { name: 'Todos Ministérios', path: '/app-ui/ministries', icon: Users, permKey: 'ministries' },
    ]
  },
  {
    section: 'GF (Grupos Familiares)',
    items: [
      { name: 'Todos os GF', path: '/app-ui/cells', icon: Users, permKey: 'cells', exact: true },
      { name: 'Relatórios de GF', path: '/app-ui/cells/reports', icon: BarChart3, permKey: 'cell_reports' },
    ]
  },
  {
    section: 'Comunicação',
    items: [
      { name: 'WhatsApp', path: '/app-ui/communication/whatsapp-inbox', icon: MessageCircle, permKey: 'whatsapp' },
    ]
  },
  {
    section: 'Eventos',
    items: [
      { name: 'Agenda', path: '/app-ui/events', icon: Calendar, permKey: 'events' },
      { name: 'Pao Diario', path: '/app-ui/daily-bread', icon: BookOpen, permKey: 'events' },
    ]
  },
  {
    section: 'Finanças',
    items: [
      { name: 'Livro Caixa', path: '/app-ui/finance/cashbook', icon: BookOpen, permKey: 'finance' },
      { name: 'Lançamento', path: '/app-ui/finance/lancamento/new', icon: TrendingUp, permKey: 'finance_entries' },
      { name: 'Fluxo de Caixa', path: '/app-ui/finance/cash-flow', icon: Wallet, permKey: 'finance' },
      { name: 'Planilhas', path: '/app-ui/crm/spreadsheet', icon: FileSpreadsheet, permKey: 'finance' },
    ]
  },
  {
    section: 'Sistema',
    items: [
      { name: 'Usuários', path: '/app-ui/system/users', icon: Users, permKey: 'system_users' },
      { name: 'Configurações', path: '/app-ui/system-settings', icon: Settings, permKey: 'system_settings' },
      { name: 'Senha dos Campos', path: '/app-ui/system/campo-senhas', icon: Lock, permKey: 'system_users' },
    ]
  },
];

export function AppUI() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [churchSwitcherOpen, setChurchSwitcherOpen] = useState(false);
  const [selectedContext, setSelectedContext] = useState<ContextSwitcherItem>(() => {
    try {
      const stored = localStorage.getItem('mrm_selected_context');
      return stored ? JSON.parse(stored) : { id: '', name: 'Selecione', level: 'church', subtitle: '' };
    } catch {
      return { id: '', name: 'Selecione', level: 'church', subtitle: '' };
    }
  });
  const [switcherItems, setSwitcherItems] = useState<ContextSwitcherItem[]>([]);
  const [switcherLoading, setSwitcherLoading] = useState(false);
  const [switcherError, setSwitcherError] = useState('');
  const [fieldPasswordPrompt, setFieldPasswordPrompt] = useState<ContextSwitcherItem | null>(null);
  const [fieldPassword, setFieldPassword] = useState('');
  const [switchingContext, setSwitchingContext] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [topSearchQuery, setTopSearchQuery] = useState('');
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [memberEditorId, setMemberEditorId] = useState<string | null>(null);
  const [memberTitles, setMemberTitles] = useState<EcclesiasticalTitleOption[]>([]);
  const topSearchInputRef = useRef<HTMLInputElement>(null);
  const [favoritePaths, setFavoritePaths] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('mrm_favorite_nav_items');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const activeContext = switcherItems.find(
    (item) => item.id === selectedContext.id && item.level === selectedContext.level,
  ) || selectedContext;
  const fieldSwitcherItems = switcherItems.filter((item) => item.level === 'field');
  const activeContextFieldName = activeContext.subtitle?.split(' • ').filter(Boolean).pop() || activeContext.name;
  const activeFieldContext = activeContext.level === 'field'
    ? activeContext
    : fieldSwitcherItems.find(
        (item) => item.name.toLowerCase() === activeContextFieldName.toLowerCase(),
      ) || fieldSwitcherItems[0] || activeContext;

  const storedUser = (() => {
    try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
  })();
  const explicitActiveFieldId = localStorage.getItem('mrm_active_field_id') || '';
  const explicitActiveFieldName = localStorage.getItem('mrm_active_field_name') || '';
  const displayName = storedUser.fullName || 'Usuário';
  const displayRole = storedUser.roleName || (storedUser.profileType ? ({
    master: 'Master', admin: 'Administrador', campo: 'Campo', church: 'Igreja'
  }[storedUser.profileType as string] || storedUser.profileType) : 'Visitante');
  const initials = displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();

  const [profileOpen, setProfileOpen] = useState(false);
  const [myProfileOpen, setMyProfileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('mrm_theme') === 'dark');
  const [branding, setBranding] = useState<ThemeSettings>(() => loadThemeSettings());
  const profileRef = useRef<HTMLDivElement>(null);

  // ── Mobile detection & sidebar behavior ────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true); // always open on desktop
      else setSidebarOpen(false); // collapse when going to mobile
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sidebar on navigation when mobile
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('mrm_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('mrm_theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    const current = loadThemeSettings();
    setBranding(current);
    applyThemeSettings(current);

    const handleThemeChange = (event: Event) => {
      const next = (event as CustomEvent<ThemeSettings>).detail;
      if (next) setBranding(next);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'mrm_branding') {
        setBranding(loadThemeSettings());
      }
    };

    window.addEventListener(THEME_EVENT_NAME, handleThemeChange as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(THEME_EVENT_NAME, handleThemeChange as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setNotificationDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    localStorage.setItem('mrm_favorite_nav_items', JSON.stringify(favoritePaths));
  }, [favoritePaths]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        topSearchInputRef.current?.focus();
        topSearchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('mrm_token');
    if (!token) {
      setMemberTitles([]);
      return;
    }

    let cancelled = false;
    const loadMemberTitles = async () => {
      try {
        const response = await fetch(`${apiBase}/ecclesiastical-titles`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error('Falha ao carregar títulos eclesiásticos.');
        }

        const data = await response.json();
        if (!cancelled) {
          setMemberTitles(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) {
          setMemberTitles([]);
        }
      }
    };

    loadMemberTitles();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('mrm_token');
    const loadSwitcherOptions = async (attempt = 1) => {
      if (!token) {
        setSwitcherItems([]);
        setSwitcherError('');
        setSwitcherLoading(false);
        return;
      }

      try {
        setSwitcherLoading(true);
        setSwitcherError('');

        const response = await fetch(`${apiBase}/context-switcher/options`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            setSwitcherItems([]);
            return;
          }
          throw new Error('Falha ao carregar contextos de acesso.');
        }

        const data = await response.json();
        const nextItems: ContextSwitcherItem[] = [
          ...(data.fields || []).map((field) => ({
            id: field.id,
            name: field.name,
            level: 'field' as const,
            subtitle: 'Campo',
            requiresPassword: field.requiresPassword,
          })),
          ...(data.regionals || []).map((regional) => ({
            id: regional.id,
            name: regional.name,
            level: 'regional' as const,
            subtitle: regional.fieldName ? `Regional • ${regional.fieldName}` : 'Regional',
          })),
          ...(data.churches || []).map((church) => ({
            id: church.id,
            name: church.name,
            level: 'church' as const,
            subtitle: [church.regionalName, church.fieldName].filter(Boolean).join(' • ') || 'Igreja',
          })),
        ];

        setSwitcherItems(nextItems);

        if (nextItems.length) {
          setSelectedContext((current) => {
            const matchedItem = nextItems.find((item) => item.id === current.id && item.level === current.level);
            const explicitField = nextItems.find((item) => item.level === 'field' && item.id === explicitActiveFieldId)
              || (explicitActiveFieldName
                ? nextItems.find((item) => item.level === 'field' && item.name === explicitActiveFieldName)
                : null);
            const profileField = nextItems.find((item) => item.level === 'field' && item.id === storedUser.campoId)
              || (storedUser.campoName ? nextItems.find((item) => item.level === 'field' && item.name === storedUser.campoName) : null);
            const preferredField = explicitField || profileField || nextItems.find((item) => item.level === 'field');
            const nextSelectedContext = explicitField || profileField || matchedItem || preferredField || nextItems[0];

            localStorage.setItem('mrm_selected_context', JSON.stringify(nextSelectedContext));
            if (nextSelectedContext.level === 'field') {
              localStorage.setItem('mrm_active_field_id', nextSelectedContext.id);
              localStorage.setItem('mrm_active_field_name', nextSelectedContext.name);
            }
            return nextSelectedContext;
          });
        }
      } catch (error) {
        // Retry up to 3 times with exponential backoff (server may be restarting)
        if (attempt < 3) {
          setTimeout(() => loadSwitcherOptions(attempt + 1), attempt * 1500);
          return;
        }
        setSwitcherError(getRequestErrorMessage(error, 'Falha ao carregar contextos.'));
      } finally {
        setSwitcherLoading(false);
      }
    };

    loadSwitcherOptions();
  }, [explicitActiveFieldId, storedUser.campoId, storedUser.campoName]);

  useEffect(() => {
    const token = localStorage.getItem('mrm_token');

    const loadNotificationCount = async () => {
      if (!token) {
        setNotificationCount(0);
        return;
      }

      try {
        const response = await fetch(`${apiBase}/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          setNotificationCount(0);
          return;
        }

        const notifications = await response.json();
        if (Array.isArray(notifications)) {
          setNotificationsList(notifications);
          setNotificationCount(notifications.filter((item: any) => !item.read).length);
        } else {
          setNotificationsList([]);
          setNotificationCount(0);
        }
      } catch {
        setNotificationCount(0);
      }
    };

    loadNotificationCount();
  }, []);

  const applyContextSelection = (item: ContextSwitcherItem) => {
    setSelectedContext(item);
    localStorage.setItem('mrm_selected_context', JSON.stringify(item));
    localStorage.setItem('mrm_active_field_id', item.id);
    localStorage.setItem('mrm_active_field_name', item.name);
    setFieldPassword('');
    setFieldPasswordPrompt(null);
    setChurchSwitcherOpen(false);
    window.location.reload();
  };

  const handleContextSelection = (item: ContextSwitcherItem) => {
    if (item.level === 'field' && item.requiresPassword) {
      setFieldPassword('');
      setSwitcherError('');
      setFieldPasswordPrompt(item);
      return;
    }

    applyContextSelection(item);
  };

  const handleFieldPasswordSubmit = async () => {
    if (!fieldPasswordPrompt) {
      return;
    }

    try {
      setSwitchingContext(true);
      setSwitcherError('');
      const token = localStorage.getItem('mrm_token');
      const response = await fetch(`${apiBase}/context-switcher/verify-field`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ fieldId: fieldPasswordPrompt.id, password: fieldPassword }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) {
          throw new Error('Sessao expirada. Faca login novamente.');
        }
        throw new Error(payload.error || 'Senha do campo invalida.');
      }

      applyContextSelection(fieldPasswordPrompt);
    } catch (error) {
      setSwitcherError(getRequestErrorMessage(error, 'Falha ao validar senha do campo.'));
    } finally {
      setSwitchingContext(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut().catch(() => undefined);
    localStorage.removeItem('mrm_token');
    localStorage.removeItem('mrm_user');
    localStorage.removeItem('mrm_selected_context');
    localStorage.removeItem('mrm_active_field_id');
    localStorage.removeItem('mrm_active_field_name');
    navigate('/auth/login');
  };

  const churches = [
    { name: 'Campo Nacional', level: 'Campo', members: 15420 },
    { name: 'Regional Norte', level: 'Regional', members: 8200 },
    { name: 'Sede Principal', level: 'Igreja', members: 3500 },
    { name: 'Campus Norte', level: 'Igreja', members: 2100 },
  ];

  const getItemBadge = (item: NavigationItem) => {
    if (item.path === '/app-ui/notifications') {
      return notificationCount > 0 ? String(notificationCount) : '';
    }

    return '';
  };

  const profileType: string = storedUser.profileType || 'church';
  const { canView } = usePermissions(profileType);
  const canViewItem = (pt: string, permKey?: string) => !permKey ? true : canView(permKey);

  const visibleNavigation = appNavigation
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canViewItem(profileType, item.permKey)),
    }))
    .filter((section) => section.items.length > 0);

  // Primeira rota permitida — usada como fallback de redirecionamento
  const firstAllowedPath = visibleNavigation[0]?.items[0]?.path || '/app-ui';

  // Verifica se a rota atual é permitida (RENDER-TIME — segurança real)
  const allNavItems = appNavigation.flatMap((s) => s.items);
  const currentNavItem = allNavItems.find(
    (item) => location.pathname === item.path || location.pathname.startsWith(item.path + '/'),
  );
  const isCurrentPathAllowed =
    !currentNavItem?.permKey || canViewItem(profileType, currentNavItem.permKey);

  // Redireciona quando o usuário cai em uma rota proibida
  useEffect(() => {
    if (!isCurrentPathAllowed && location.pathname !== firstAllowedPath) {
      navigate(firstAllowedPath, { replace: true });
    }
  }, [isCurrentPathAllowed, firstAllowedPath, location.pathname]);

  const quickAccessItems = appNavigation.flatMap((section) =>
    section.items
      .filter((item) => canViewItem(profileType, item.permKey))
      .map((item) => ({
        ...item,
        section: section.section,
      })),
  );
  const normalizedSidebarSearchQuery = normalizeNavigationLabel(sidebarSearchQuery.trim());
  const matchesSidebarSearch = (label: string, section: string) => {
    if (!normalizedSidebarSearchQuery) {
      return true;
    }

    const haystack = normalizeNavigationLabel(`${label} ${section}`);
    return haystack.includes(normalizedSidebarSearchQuery);
  };

  const filteredNavigation = visibleNavigation
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => matchesSidebarSearch(item.name, section.section)),
    }))
    .filter((section) => section.items.length > 0);

  const favoriteQuickAccessItems = favoritePaths
    .map((path) => quickAccessItems.find((item) => item.path === path))
    .filter((item): item is (typeof quickAccessItems)[number] => Boolean(item))
    .filter((item) => matchesSidebarSearch(item.name, item.section));

  const toggleFavorite = (path: string) => {
    setFavoritePaths((current) =>
      current.includes(path)
        ? current.filter((itemPath) => itemPath !== path)
        : [...current, path],
    );
  };

  return (
    <div className="app-shell flex h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      {/* Mobile backdrop */}
      <AnimatePresence>
        {sidebarOpen && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -288 }}
            animate={{ x: 0 }}
            exit={{ x: -288 }}
            transition={{ type: 'tween', duration: 0.22 }}
            className={`w-72 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col transition-colors duration-200${isMobile ? ' fixed inset-y-0 left-0 z-50 shadow-2xl' : ''}`}
          >
            {/* Logo */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[var(--theme-primary-soft)] ring-1 ring-[var(--theme-primary-border)]">
                  {branding.logoUrl ? (
                    <img src={branding.logoUrl} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-bold text-xl text-[var(--theme-primary)]">M</span>
                  )}
                </div>
                <div>
                  <h1 className="font-bold text-slate-900 dark:text-white">MRM</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Gestão Ministerial</p>
                </div>
                {isMobile && (
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="ml-auto p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    aria-label="Fechar menu"
                  >
                    <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Church Switcher */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setChurchSwitcherOpen(!churchSwitcherOpen)}
                className="w-full flex items-center gap-3 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors"
              >
                <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{activeFieldContext.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Campo</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-4 py-4">
              <div className="sticky top-0 z-10 mb-4 bg-white pb-3 dark:bg-slate-800">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={sidebarSearchQuery}
                    onChange={(event) => setSidebarSearchQuery(event.target.value)}
                    placeholder="Buscar atalho ou módulo"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-purple-200 focus:bg-white focus:ring-2 focus:ring-purple-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-purple-500/40 dark:focus:bg-slate-800 dark:focus:ring-purple-500/10"
                  />
                </div>
              </div>

              <div className="mb-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Favoritos</p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                    {favoriteQuickAccessItems.length}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {favoriteQuickAccessItems.length ? favoriteQuickAccessItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.exact ? location.pathname === item.path : (location.pathname === item.path || location.pathname.startsWith(item.path + '/'));
                    const badge = getItemBadge(item);
                    return (
                      <div
                        key={`favorite-${item.path}`}
                        className={`group flex items-center gap-2 rounded-xl transition-all text-sm ${
                          isActive ? 'bg-purple-50 ring-1 ring-purple-200/80 dark:bg-purple-500/10 dark:ring-purple-500/20' : 'hover:bg-white dark:hover:bg-slate-800'
                        }`}
                      >
                        <Link
                          to={item.path}
                          className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                            isActive
                              ? 'text-purple-700 dark:text-purple-200 font-semibold'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate">{item.name}</p>
                            <p className="truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">{item.section}</p>
                          </div>
                          {badge ? (
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:bg-purple-500/20 dark:text-purple-200">
                              {badge}
                            </span>
                          ) : null}
                        </Link>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleFavorite(item.path);
                          }}
                          className="mr-2 flex h-8 w-8 items-center justify-center rounded-lg text-sky-500 transition-colors hover:bg-sky-100 dark:hover:bg-sky-500/10"
                          title="Remover dos favoritos"
                        >
                          <Star className="h-4 w-4 fill-current" />
                        </button>
                      </div>
                    );
                  }) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white/80 px-3 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
                      Marque a estrela nos menus para montar seus atalhos aqui.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
              {filteredNavigation.map((section) => (
                <div key={section.section}>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">{section.section}</p>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.exact ? location.pathname === item.path : (location.pathname === item.path || location.pathname.startsWith(item.path + '/'));
                    const badge = getItemBadge(item);
                    const isFavorite = favoritePaths.includes(item.path);
                    return (
                      <div
                        key={item.path}
                        className={`group flex items-center gap-2 rounded-lg transition-all text-sm ${
                          isActive ? 'bg-purple-100 dark:bg-purple-900/40' : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <Link
                          to={item.path}
                          className={`
                            flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm
                            ${isActive 
                              ? 'text-purple-700 dark:text-purple-300 font-semibold' 
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }
                          `}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="flex-1 truncate">{item.name}</span>
                          {badge && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              isActive
                                ? 'bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-200'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                              {badge}
                            </span>
                          )}
                        </Link>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleFavorite(item.path);
                          }}
                          className={`mr-2 flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                            isFavorite
                              ? 'text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10'
                              : 'text-slate-300 hover:bg-slate-200/70 hover:text-slate-500 dark:text-slate-600 dark:hover:bg-slate-600/50 dark:hover:text-slate-300'
                          }`}
                          title={isFavorite ? 'Remover dos favoritos' : 'Favoritar atalho'}
                        >
                          <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
              {!filteredNavigation.length ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Nenhum menu encontrado para "{sidebarSearchQuery}".
                </div>
              ) : null}
              </div>
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-full flex items-center justify-center">
                  <span className="text-purple-700 dark:text-purple-300 font-semibold">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{displayName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{displayRole}</p>
                </div>
                <Link
                  to="/app-ui/system-settings"
                  title="Configurações"
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" />
                </Link>
                <button
                  onClick={handleLogout}
                  title="Sair"
                  className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4 text-slate-400 hover:text-red-500" />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Church Switcher Modal */}
      <AnimatePresence>
        {churchSwitcherOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setChurchSwitcherOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={() => setChurchSwitcherOpen(false)}
            >
              <div
                className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-6 h-6 text-purple-600" />
                    <h2 className="text-lg font-bold text-slate-900">Alternar Campo</h2>
                  </div>
                  <button
                    onClick={() => setChurchSwitcherOpen(false)}
                    className="p-1 hover:bg-slate-100 rounded-lg"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <div className="p-4 space-y-2 overflow-y-auto min-h-0">
                  {switcherLoading ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Carregando contextos...
                    </div>
                  ) : null}

                  {fieldPasswordPrompt ? (
                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Senha do campo</p>
                        <p className="text-sm text-slate-600">Informe a senha para acessar {fieldPasswordPrompt.name}.</p>
                      </div>
                      <input
                        type="password"
                        value={fieldPassword}
                        onChange={(event) => setFieldPassword(event.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Senha do campo"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFieldPassword('');
                            setFieldPasswordPrompt(null);
                          }}
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleFieldPasswordSubmit}
                          disabled={switchingContext || !fieldPassword}
                          className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
                        >
                          {switchingContext ? 'Validando...' : 'Entrar'}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {switcherError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-2">
                      <span>{switcherError}</span>
                      <button
                        type="button"
                        onClick={() => { setSwitcherError(''); setChurchSwitcherOpen(false); setTimeout(() => setChurchSwitcherOpen(true), 100); }}
                        className="shrink-0 rounded-md bg-red-100 px-2 py-1 text-xs font-medium hover:bg-red-200"
                      >
                        Tentar novamente
                      </button>
                    </div>
                  ) : null}

                  {fieldSwitcherItems.map((item) => (
                    <button
                      key={`${item.level}-${item.id}`}
                      onClick={() => handleContextSelection(item)}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                        activeFieldContext.id === item.id && activeFieldContext.level === item.level
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="text-sm text-slate-500">
                        Campo{item.requiresPassword ? ' • senha obrigatoria' : ''}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <GlobalSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        initialQuery={topSearchQuery}
        onEditMember={(memberId) => setMemberEditorId(memberId)}
      />

      <MemberEditDrawer
        memberId={memberEditorId}
        open={!!memberEditorId}
        onClose={() => setMemberEditorId(null)}
        onSaved={() => setMemberEditorId(null)}
        titles={memberTitles}
      />

      <AnimatePresence>
        {quickAddOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setQuickAddOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-24"
              onClick={() => setQuickAddOpen(false)}
            >
              <div
                className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/40">
                      <Plus className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Atalhos Favoritos</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Favorite itens no menu lateral para acessa-los aqui.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuickAddOpen(false)}
                    className="rounded-lg p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <X className="h-5 w-5 text-slate-400" />
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-4">
                  {favoriteQuickAccessItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center dark:border-slate-600">
                      <Star className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-500" />
                      <p className="font-medium text-slate-700 dark:text-slate-200">Nenhum atalho favoritado ainda.</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Clique na estrela ao lado de um item do menu para ele aparecer aqui.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {favoriteQuickAccessItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setQuickAddOpen(false)}
                            className="group rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all hover:border-purple-300 hover:bg-purple-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-purple-500/60 dark:hover:bg-slate-700"
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-slate-800">
                                <Icon className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                              </div>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  toggleFavorite(item.path);
                                }}
                                className="rounded-lg p-1.5 text-sky-400 transition-colors hover:bg-sky-50 dark:hover:bg-sky-500/10"
                                title="Remover dos favoritos"
                              >
                                <Star className="h-4 w-4 fill-current" />
                              </button>
                            </div>
                            <p className="font-semibold text-slate-900 group-hover:text-purple-700 dark:text-white dark:group-hover:text-purple-300">{item.name}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.section}</p>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 h-16 flex items-center px-6 gap-4 transition-colors duration-200">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>

          {/* Search */}
          <div className="flex flex-1 items-center gap-3 max-w-3xl">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
              <input
                ref={topSearchInputRef}
                type="text"
                value={topSearchQuery}
                onChange={(event) => setTopSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (!topSearchQuery.trim()) {
                      return;
                    }
                    setSearchOpen(true);
                    return;
                  }

                  if (event.key === 'Escape') {
                    setTopSearchQuery('');
                  }
                }}
                placeholder="Buscar membro por nome ou rol..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-16 text-sm text-slate-700 transition-colors hover:bg-white hover:border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 sm:inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-400">Ctrl K</span>
            </div>
            {/* Mais button + Novo Membro */}
            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
            >
              <LayoutGrid className="h-4 w-4" />
              Mais
            </button>
            {/* Novo Membro — visible on sm+ screens */}
            <Link
              to="/app-ui/members/new"
              className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <UserPlus className="h-4 w-4" />
              Novo Membro
            </Link>
            {/* 3-dots mobile button — visible only on xs screens */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="inline-flex sm:hidden items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
              title="Mais opções"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>

          {/* Actions — ml-auto garante alinhamento à direita */}
          <div className="ml-auto flex items-center gap-2">
            {/* Dark mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title={darkMode ? 'Modo claro' : 'Modo escuro'}
            >
              {darkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>

            {/* Notifications button */}
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setNotificationDropdownOpen(!notificationDropdownOpen)}
                className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                {notificationCount > 0 ? (
                  <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-800">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                ) : (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-800"></span>
                )}
              </button>

              {/* Notifications Dropdown */}
              <AnimatePresence>
                {notificationDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 flex flex-col overflow-hidden"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-800/80">
                      <h3 className="font-semibold text-slate-900 dark:text-white">Notificações</h3>
                      {notificationCount > 0 && (
                        <span className="rounded-full bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300">
                          {notificationCount} não lidas
                        </span>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-96">
                      {notificationsList.length > 0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                          {notificationsList.slice(0, 5).map((notification) => (
                            <Link
                              key={notification.id}
                              to={notification.actionUrl || '/app-ui/notifications'}
                              onClick={() => setNotificationDropdownOpen(false)}
                              className={`block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                                !notification.read ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''
                              }`}
                            >
                              <div className="flex gap-3">
                                <div className="mt-1 shrink-0">
                                  <div className={`h-2 w-2 rounded-full mt-1.5 ${!notification.read ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm ${!notification.read ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                                    {notification.title}
                                  </p>
                                  {notification.message && (
                                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                      {notification.message}
                                    </p>
                                  )}
                                  <p className="mt-1.5 text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    {new Date(notification.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                          <Bell className="mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
                          <p className="text-sm font-medium text-slate-900 dark:text-white">Nenhuma notificação</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Você está em dia com tudo!</p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-700 p-2 bg-slate-50 dark:bg-slate-800">
                      <Link
                        to="/app-ui/notifications"
                        onClick={() => setNotificationDropdownOpen(false)}
                        className="block w-full rounded-lg px-4 py-2 text-center text-sm font-medium text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                      >
                        Ver todas as notificações
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile button */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center">
                  <span className="text-purple-700 dark:text-purple-300 text-xs font-bold">{initials}</span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">{displayName.split(' ')[0]}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{displayRole}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </button>

              {/* Profile dropdown */}
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden"
                  >
                    {/* Header */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center">
                          <span className="text-purple-700 dark:text-purple-300 font-bold text-lg">{initials}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{displayName}</p>
                          <p className="text-slate-500 dark:text-slate-400 text-sm">{storedUser.email}</p>
                          <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs rounded-full">{displayRole}</span>
                        </div>
                      </div>
                    </div>

                    {/* Menu items */}
                    <div className="p-2 dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => { setProfileOpen(false); setMyProfileOpen(true); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group"
                      >
                        <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center">
                          <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">Meu Perfil</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Ver e editar dados</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>

                      <Link
                        to="/app-ui/system/users"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group"
                      >
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
                          <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">Usuários e Permissões</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Gerenciar acessos</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>

                      <Link
                        to="/app-ui/system-settings"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group"
                      >
                        <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                          <Settings className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">Configurações</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Preferências do sistema</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>

                      {/* Dark mode row */}
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
                        <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center">
                          {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{darkMode ? 'Modo Claro' : 'Modo Escuro'}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{darkMode ? 'Mudar para claro' : 'Mudar para escuro'}</p>
                        </div>
                        <button
                          onClick={() => setDarkMode(!darkMode)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            darkMode ? 'bg-purple-600' : 'bg-slate-200'
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            darkMode ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>

                      <div className="mx-3 my-1 border-t border-slate-100 dark:border-slate-700" />

                      <button
                        onClick={() => { setProfileOpen(false); handleLogout(); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group"
                      >
                        <div className="w-8 h-8 bg-red-100 dark:bg-red-900/40 rounded-lg flex items-center justify-center">
                          <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-red-600 dark:text-red-400">Sair</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Encerrar sessão</p>
                        </div>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

      {/* ── Mobile Right Drawer ──────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 sm:hidden"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-72 bg-white dark:bg-slate-800 shadow-2xl sm:hidden flex flex-col"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-4">
                <h2 className="font-bold text-slate-900 dark:text-white">Ações Rápidas</h2>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>

              {/* Drawer content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Novo Membro — primary CTA */}
                <Link
                  to="/app-ui/members/new"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center gap-3 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3 text-white font-semibold transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Novo Membro</p>
                    <p className="text-xs text-emerald-100">Cadastrar na secretaria</p>
                  </div>
                </Link>

                {/* Atalhos favoritos */}
                <div className="pt-2">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Atalhos favoritos</p>
                  {favoriteQuickAccessItems.length > 0 ? (
                    <div className="space-y-1">
                      {favoriteQuickAccessItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setMobileDrawerOpen(false)}
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                              <Icon className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{item.name}</p>
                              <p className="text-xs text-slate-400">{item.section}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-4 text-center">
                      <Star className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                      <p className="text-sm text-slate-500">Nenhum atalho favoritado.</p>
                      <p className="mt-0.5 text-xs text-slate-400">Abra o menu lateral e clique na ★</p>
                    </div>
                  )}
                </div>

                {/* Mais atalhos rápidos */}
                <div className="pt-1">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Menu completo</p>
                  <button
                    type="button"
                    onClick={() => { setMobileDrawerOpen(false); setQuickAddOpen(true); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/40">
                      <LayoutGrid className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Mais atalhos</p>
                      <p className="text-xs text-slate-400">Ver favoritos completos</p>
                    </div>
                  </button>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Minha Conta</p>

                  {/* User info */}
                  <div className="mb-2 flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/50 shrink-0">
                      <span className="text-purple-700 dark:text-purple-300 font-bold text-sm">{initials}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{displayName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{displayRole}</p>
                    </div>
                  </div>

                  {/* Meu Perfil */}
                  <button
                    type="button"
                    onClick={() => { setMobileDrawerOpen(false); setMyProfileOpen(true); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/40">
                      <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Meu Perfil</p>
                      <p className="text-xs text-slate-400">Ver e editar dados</p>
                    </div>
                  </button>

                  {/* Usuários e Permissões */}
                  <Link
                    to="/app-ui/system/users"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                      <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Usuários e Permissões</p>
                      <p className="text-xs text-slate-400">Gerenciar acessos</p>
                    </div>
                  </Link>

                  {/* Configurações */}
                  <Link
                    to="/app-ui/system-settings"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                      <Settings className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Configurações</p>
                      <p className="text-xs text-slate-400">Preferências do sistema</p>
                    </div>
                  </Link>

                  {/* Modo Escuro */}
                  <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                      {darkMode ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{darkMode ? 'Modo Claro' : 'Modo Escuro'}</p>
                      <p className="text-xs text-slate-400">{darkMode ? 'Mudar para claro' : 'Mudar para escuro'}</p>
                    </div>
                    <button
                      onClick={() => setDarkMode(!darkMode)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${darkMode ? 'bg-purple-600' : 'bg-slate-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Sair */}
                  <button
                    type="button"
                    onClick={() => { setMobileDrawerOpen(false); handleLogout(); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40">
                      <LogOut className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">Sair</p>
                      <p className="text-xs text-slate-400">Encerrar sessão</p>
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

        {/* Content */}
        <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
          {isCurrentPathAllowed ? (
            <Outlet />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-md text-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm">
                <div className="mx-auto w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-4">
                  <Shield className="w-7 h-7 text-rose-600 dark:text-rose-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  Acesso negado
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Você não tem permissão para acessar esta página. Caso precise de acesso,
                  entre em contato com o administrador.
                </p>
                <button
                  onClick={() => navigate(firstAllowedPath, { replace: true })}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Voltar
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Modal: Meu Perfil ──────────────────────────────────────────── */}
      <AnimatePresence>
        {myProfileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setMyProfileOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl pointer-events-auto overflow-hidden">
                {/* Header */}
                <div className="relative bg-slate-900 dark:bg-slate-950 px-6 pt-6 pb-16">
                  <button
                    onClick={() => setMyProfileOpen(false)}
                    className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                  <h2 className="text-white font-semibold text-lg">Meu Perfil</h2>
                  <p className="text-slate-400 text-sm">Suas informações pessoais</p>
                </div>

                {/* Avatar */}
                <div className="flex justify-center -mt-10 px-6 relative z-10">
                  <div className="w-20 h-20 bg-white dark:bg-slate-700 rounded-full ring-4 ring-white dark:ring-slate-800 flex items-center justify-center shadow-md">
                    {storedUser.foto ? (
                      <img src={storedUser.foto} alt={displayName} className="w-20 h-20 rounded-full object-cover" />
                    ) : (
                      <span className="text-slate-700 dark:text-slate-300 font-bold text-2xl">{initials}</span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="px-6 pt-4 pb-6 space-y-3">
                  <div className="text-center mb-4">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{displayName}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{storedUser.email || '—'}</p>
                    <span className="inline-block mt-1.5 px-3 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full">{displayRole}</span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Igreja</p>
                        <p className="text-slate-700 dark:text-slate-200 font-medium">{storedUser.church?.name || storedUser.churchName || 'Não vinculada'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <Building className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Campo</p>
                        <p className="text-slate-700 dark:text-slate-200 font-medium">{storedUser.campo?.name || storedUser.campoName || 'Não vinculado'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Regional</p>
                        <p className="text-slate-700 dark:text-slate-200 font-medium">{storedUser.regional?.name || storedUser.regionalName || 'Não vinculada'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <Award className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Título</p>
                        <p className="text-slate-700 dark:text-slate-200 font-medium">{storedUser.ecclesiasticalTitle || storedUser.title || 'Nenhum'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">ROL</p>
                        <p className="text-slate-700 dark:text-slate-200 font-medium">{storedUser.rol || 'Nenhum'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Link
                      to="/app-ui/system/users"
                      onClick={() => setMyProfileOpen(false)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Gerenciar Usuários e Permissões
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}