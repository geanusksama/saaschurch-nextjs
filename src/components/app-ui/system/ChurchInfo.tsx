import { useEffect, useState } from 'react';
import {
  Building2, MapPin, Phone, Mail, Globe, PlayCircle,
  Save, Plus, Trash2, Pencil, X, Check, Bus, ParkingCircle,
  Music2, Link as LinkIcon,
  Sun, Moon, BookOpen, Zap, Heart, Users, Star, Flame, Gift, Sparkles, Cross,
  Train, Bike, Car, Info, Navigation, Home,
  MessageCircle, MessageSquare, PhoneCall, PhoneIncoming, Smartphone,
  Hash, Building, Landmark, Flag, LocateFixed, Mailbox,
  AtSign, Rss, Video, Camera, Radio, Share2, ExternalLink,
} from 'lucide-react';

// Brand icon shims (removed from lucide-react v1+)
const Twitter = AtSign;
const Instagram = Share2;
const Facebook = Globe;

import { apiBase } from '../../../lib/apiBase';

const DAYS = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];

const ACCESS_TYPES = [
  { value: 'bus', label: 'Onibus', Icon: Bus },
  { value: 'parking', label: 'Estacionamento', Icon: ParkingCircle },
  { value: 'other', label: 'Outro', Icon: MapPin },
];

const ACCESS_ICONS = [
  { value: 'Bus',           label: 'Onibus',          Icon: Bus,           bg: 'bg-blue-600' },
  { value: 'ParkingCircle', label: 'Estacionamento',  Icon: ParkingCircle, bg: 'bg-green-600' },
  { value: 'Train',         label: 'Metro / Trem',    Icon: Train,         bg: 'bg-purple-700' },
  { value: 'Bike',          label: 'Ciclovia',        Icon: Bike,          bg: 'bg-amber-500' },
  { value: 'Car',           label: 'Carro',           Icon: Car,           bg: 'bg-orange-500' },
  { value: 'Navigation',    label: 'A Pé',           Icon: Navigation,    bg: 'bg-teal-600' },
  { value: 'MapPin',        label: 'Ponto de Refer.',  Icon: MapPin,        bg: 'bg-red-500' },
  { value: 'Home',          label: 'Entrada',         Icon: Home,          bg: 'bg-slate-600' },
  { value: 'Info',          label: 'Informação',      Icon: Info,          bg: 'bg-cyan-600' },
];

function getAccessIconCfg(value: string) {
  return ACCESS_ICONS.find((i) => i.value === value) || ACCESS_ICONS[0];
}

const SCHEDULE_ICONS = [
  { value: 'Sun',       label: 'Culto / Adoração',    Icon: Sun,       bg: 'bg-orange-400' },
  { value: 'Sun2',      label: 'Culto da Manhã',       Icon: Sun,       bg: 'bg-green-500' },
  { value: 'Moon',      label: 'Culto Noturno',        Icon: Moon,      bg: 'bg-indigo-700' },
  { value: 'BookOpen',  label: 'EBD / Escola Bíblica', Icon: BookOpen,  bg: 'bg-yellow-500' },
  { value: 'Zap',       label: 'Evangelístico',        Icon: Zap,       bg: 'bg-blue-600' },
  { value: 'Flame',     label: 'Libertação',           Icon: Flame,     bg: 'bg-pink-600' },
  { value: 'Heart',     label: 'Doutrina / Pastoral',  Icon: Heart,     bg: 'bg-purple-700' },
  { value: 'Users',     label: 'Reunião / Encontro',   Icon: Users,     bg: 'bg-teal-500' },
  { value: 'Star',      label: 'Culto Especial',       Icon: Star,      bg: 'bg-amber-500' },
  { value: 'Globe',     label: 'Missões',              Icon: Globe,     bg: 'bg-cyan-600' },
  { value: 'Music2',    label: 'Louvor',               Icon: Music2,    bg: 'bg-rose-500' },
  { value: 'Sparkles',  label: 'Consagração',          Icon: Sparkles,  bg: 'bg-violet-600' },
  { value: 'Gift',      label: 'Ofertório',            Icon: Gift,      bg: 'bg-emerald-600' },
  { value: 'Cross',     label: 'Santa Ceia',           Icon: Cross,     bg: 'bg-slate-700' },
];

function getScheduleIconCfg(value: string) {
  return SCHEDULE_ICONS.find((i) => i.value === value) || SCHEDULE_ICONS[0];
}

// Icons for contact / address fields
const FIELD_ICONS_CONTACT = [
  { value: 'Phone',          label: 'Telefone',       Icon: Phone,          bg: 'bg-cyan-500' },
  { value: 'PhoneCall',      label: 'Ligação',        Icon: PhoneCall,      bg: 'bg-blue-500' },
  { value: 'PhoneIncoming',  label: 'Recebida',       Icon: PhoneIncoming,  bg: 'bg-teal-600' },
  { value: 'Smartphone',     label: 'Celular',        Icon: Smartphone,     bg: 'bg-indigo-600' },
  { value: 'MessageCircle',  label: 'WhatsApp',       Icon: MessageCircle,  bg: 'bg-green-600' },
  { value: 'MessageSquare',  label: 'Mensagem',       Icon: MessageSquare,  bg: 'bg-emerald-600' },
  { value: 'Mail',           label: 'E-mail',         Icon: Mail,           bg: 'bg-purple-600' },
  { value: 'Mailbox',        label: 'Caixa Postal',   Icon: Mailbox,        bg: 'bg-violet-600' },
];
const FIELD_ICONS_ADDRESS = [
  { value: 'MapPin',         label: 'Endereço',       Icon: MapPin,         bg: 'bg-slate-700' },
  { value: 'LocateFixed',    label: 'Localização',    Icon: LocateFixed,    bg: 'bg-red-600' },
  { value: 'Navigation',     label: 'Navegação',      Icon: Navigation,     bg: 'bg-blue-600' },
  { value: 'Building',       label: 'Bairro',         Icon: Building,       bg: 'bg-slate-600' },
  { value: 'Building2',      label: 'Cidade',         Icon: Building2,      bg: 'bg-zinc-700' },
  { value: 'Landmark',       label: 'Monumento',      Icon: Landmark,       bg: 'bg-stone-600' },
  { value: 'Hash',           label: 'Número',         Icon: Hash,           bg: 'bg-orange-600' },
  { value: 'Flag',           label: 'País',           Icon: Flag,           bg: 'bg-green-700' },
  { value: 'Mailbox',        label: 'CEP',            Icon: Mailbox,        bg: 'bg-violet-600' },
  { value: 'Home',           label: 'Casa',           Icon: Home,           bg: 'bg-amber-600' },
];

const FIELD_ICONS_SOCIAL = [
  { value: 'Instagram',    label: 'Instagram',  Icon: Instagram,    bg: 'bg-pink-500' },
  { value: 'Facebook',     label: 'Facebook',   Icon: Facebook,     bg: 'bg-blue-700' },
  { value: 'Youtube',      label: 'YouTube',    Icon: PlayCircle,   bg: 'bg-red-600' },
  { value: 'Twitter',      label: 'X / Twitter',Icon: Twitter,      bg: 'bg-slate-900' },
  { value: 'Music2',       label: 'TikTok',     Icon: Music2,       bg: 'bg-zinc-800' },
  { value: 'Globe',        label: 'Site',       Icon: Globe,        bg: 'bg-blue-500' },
  { value: 'ExternalLink', label: 'Link',       Icon: ExternalLink, bg: 'bg-indigo-600' },
  { value: 'Share2',       label: 'Compartilhar', Icon: Share2,     bg: 'bg-teal-600' },
  { value: 'PlayCircle',   label: 'Video',      Icon: PlayCircle,   bg: 'bg-rose-600' },
  { value: 'Video',        label: 'Câmera',     Icon: Video,        bg: 'bg-orange-600' },
  { value: 'Radio',        label: 'Rádio',      Icon: Radio,        bg: 'bg-amber-600' },
  { value: 'Rss',          label: 'Feed/Blog',  Icon: Rss,          bg: 'bg-emerald-600' },
];

const ALL_FIELD_ICONS = [...FIELD_ICONS_CONTACT, ...FIELD_ICONS_ADDRESS, ...FIELD_ICONS_SOCIAL].reduce<typeof FIELD_ICONS_CONTACT>((acc, i) => {
  if (!acc.find((x) => x.value === i.value)) acc.push(i);
  return acc;
}, []);

function getFieldIconCfg(value: string, fallbackBg = 'bg-slate-600') {
  const found = ALL_FIELD_ICONS.find((i) => i.value === value);
  if (found) return found;
  return { value, label: value, Icon: Info, bg: fallbackBg };
}

type HQ = {
  id: string;
  churchName: string | null;
  fieldName: string | null;
  regionalName: string | null;
  cnpj: string | null;
  contact: string | null;
  email: string | null;
  whatsapp: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zipcode: string | null;
  instagram: string | null;
  youtube: string | null;
  site: string | null;
  tiktok: string | null;
  facebook: string | null;
  pix: string | null;
  bank: string | null;
  show: boolean | null;
  fieldIcons: Record<string, string>;
  schedules: Schedule[];
  accessInfos: AccessInfo[];
};

type Schedule = {
  id: string;
  dayOfWeek: string;
  name: string;
  time: string;
  icon: string;
  order: number;
};

type AccessInfo = {
  id: string;
  type: string;
  description: string;
  mapUrl: string | null;
  icon: string;
  order: number;
};

const emptyHQ: HQ = {
  id: '',
  churchName: '',
  fieldName: '',
  regionalName: '',
  cnpj: '',
  contact: '',
  email: '',
  whatsapp: '',
  street: '',
  number: '',
  neighborhood: '',
  city: '',
  state: '',
  country: 'Brasil',
  zipcode: '',
  instagram: '',
  youtube: '',
  site: '',
  tiktok: '',
  facebook: '',
  pix: '',
  bank: '',
  show: true,
  fieldIcons: {},
  schedules: [],
  accessInfos: [],
};

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1';

export function ChurchInfo() {
  const token = localStorage.getItem('mrm_token');
  const [hq, setHq] = useState<HQ>(emptyHQ);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'dados' | 'schedule' | 'access' | 'social'>('dados');

  const [scheduleForm, setScheduleForm] = useState({ dayOfWeek: 'Domingo', name: '', time: '', icon: 'Sun' });
  const [scheduleEditing, setScheduleEditing] = useState<string | null>(null);
  const [scheduleEditIcon, setScheduleEditIcon] = useState('');

  const [accessForm, setAccessForm] = useState({ type: 'bus', description: '', mapUrl: '', icon: 'Bus' });
  const [accessEditing, setAccessEditing] = useState<string | null>(null);
  const [accessEditForm, setAccessEditForm] = useState<Partial<AccessInfo>>({});
  const [accessEditError, setAccessEditError] = useState('');
  const [accessEditIcon, setAccessEditIcon] = useState('');

  // Icon picker modal for contact/address fields
  const [iconPickerField, setIconPickerField] = useState<string | null>(null);
  const [iconPickerSet, setIconPickerSet] = useState<'contact' | 'address' | 'social'>('contact');

  const fetchHQ = async () => {
    setLoading(true);
    setError('');
    try {
      // Resolve the active field ID from localStorage (respects the context switcher)
      const activeFieldId = localStorage.getItem('mrm_active_field_id')
        || (() => { try { return JSON.parse(localStorage.getItem('mrm_user') || '{}').campoId; } catch { return null; } })();

      if (!activeFieldId) throw new Error('Nenhum campo ativo encontrado. Faça login novamente.');

      const hqRes = await fetch(`${apiBase}/headquarters?fieldId=${activeFieldId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!hqRes.ok) throw new Error('Sem permissao para ver a sede.');
      const hqList = await hqRes.json();
      if (!hqList.length) throw new Error('Nenhuma sede cadastrada para este campo.');

      const detailRes = await fetch(`${apiBase}/headquarters/${hqList[0].id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!detailRes.ok) throw new Error('Falha ao carregar detalhes da sede.');
      const detail = await detailRes.json();
      setHq({ ...emptyHQ, ...detail });
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHQ(); }, []);

  const saveMain = async () => {
    setSaving(true);
    setError('');
    try {
      const body = {
        churchName: hq.churchName, fieldName: hq.fieldName, regionalName: hq.regionalName,
        cnpj: hq.cnpj, contact: hq.contact, email: hq.email, whatsapp: hq.whatsapp,
        street: hq.street, number: hq.number, neighborhood: hq.neighborhood,
        city: hq.city, state: hq.state, country: hq.country, zipcode: hq.zipcode,
        instagram: hq.instagram, youtube: hq.youtube, site: hq.site,
        tiktok: hq.tiktok, facebook: hq.facebook, pix: hq.pix, bank: hq.bank, show: hq.show,
        fieldIcons: hq.fieldIcons,
      };
      const res = await fetch(`${apiBase}/headquarters/${hq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const msg = await res.json().catch(() => ({})); throw new Error(msg.error || 'Falha ao salvar.'); }
      const updated = await res.json();
      setHq((prev) => ({ ...prev, ...updated }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const addSchedule = async () => {
    if (!scheduleForm.name || !scheduleForm.time) return;
    const res = await fetch(`${apiBase}/headquarters/${hq.id}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ...scheduleForm, order: hq.schedules.length }),
    });
    if (!res.ok) return;
    const item: Schedule = await res.json();
    setHq((prev) => ({ ...prev, schedules: [...prev.schedules, item] }));
    setScheduleForm({ dayOfWeek: 'Domingo', name: '', time: '', icon: 'Sun' });
  };

  const saveScheduleEdit = async (s: Schedule) => {
    const payload: Record<string, any> = {
      dayOfWeek: s.dayOfWeek, name: s.name, time: s.time,
      icon: scheduleEditIcon || s.icon,
    };
    const res = await fetch(`${apiBase}/headquarters/schedule/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return;
    const updated: Schedule = await res.json();
    setHq((prev) => ({ ...prev, schedules: prev.schedules.map((x) => (x.id === s.id ? updated : x)) }));
    setScheduleEditing(null);
  };

  const deleteSchedule = async (id: string) => {
    await fetch(`${apiBase}/headquarters/schedule/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    setHq((prev) => ({ ...prev, schedules: prev.schedules.filter((s) => s.id !== id) }));
  };

  const addAccess = async () => {
    if (!accessForm.description) return;
    const res = await fetch(`${apiBase}/headquarters/${hq.id}/access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ...accessForm, mapUrl: accessForm.mapUrl || null, order: hq.accessInfos.length }),
    });
    if (!res.ok) return;
    const item: AccessInfo = await res.json();
    setHq((prev) => ({ ...prev, accessInfos: [...prev.accessInfos, item] }));
    setAccessForm({ type: 'bus', description: '', mapUrl: '', icon: 'Bus' });
  };

  const saveAccessEdit = async (id: string) => {
    setAccessEditError('');
    const payload = { ...accessEditForm, icon: accessEditIcon || accessEditForm.icon };
    const res = await fetch(`${apiBase}/headquarters/access/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      setAccessEditError(msg.error || `Erro ${res.status} ao salvar.`);
      return;
    }
    const updated: AccessInfo = await res.json();
    setHq((prev) => ({ ...prev, accessInfos: prev.accessInfos.map((a) => (a.id === id ? updated : a)) }));
    setAccessEditing(null);
    setAccessEditError('');
    setAccessEditIcon('');
  };

  const deleteAccess = async (id: string) => {
    await fetch(`${apiBase}/headquarters/access/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    setHq((prev) => ({ ...prev, accessInfos: prev.accessInfos.filter((a) => a.id !== id) }));
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-500 text-sm">Carregando dados da sede...</div>;
  }

  if (error && !hq.id) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  const tabs = [
    { id: 'dados', label: 'Dados Gerais' },
    { id: 'schedule', label: `Programacao (${hq.schedules.length})` },
    { id: 'access', label: `Como Chegar (${hq.accessInfos.length})` },
    { id: 'social', label: 'Redes Sociais' },
  ] as const;

  const SaveBtn = () => (
    <div className="flex items-center justify-end gap-3">
      {saveSuccess && (
        <span className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700">
          <Check className="h-4 w-4" /> Salvo com sucesso!
        </span>
      )}
      <button type="button" onClick={saveMain} disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60">
        <Save className="h-4 w-4" />{saving ? 'Salvando...' : 'Salvar Alteracoes'}
      </button>
    </div>
  );

  return (
    <>
    <div className="p-6">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-purple-100 dark:bg-purple-900/30">
          <Building2 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{hq.churchName || 'Igreja Sede'}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {[hq.fieldName, hq.regionalName].filter(Boolean).join(' · ')}{hq.cnpj ? ` · CNPJ ${hq.cnpj}` : ''}
          </p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
            {hq.contact && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{hq.contact}</span>}
            {hq.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{hq.email}</span>}
            {hq.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{hq.city}{hq.state ? `, ${hq.state}` : ''}</span>}
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {activeTab === 'dados' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
            <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Identificacao</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className={labelClass}>Nome da Igreja</label><input className={inputClass} value={hq.churchName || ''} onChange={(e) => setHq((p) => ({ ...p, churchName: e.target.value }))} /></div>
              <div><label className={labelClass}>CNPJ</label><input className={inputClass} value={hq.cnpj || ''} onChange={(e) => setHq((p) => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" /></div>
              <div><label className={labelClass}>Nome do Campo</label><input className={inputClass} value={hq.fieldName || ''} onChange={(e) => setHq((p) => ({ ...p, fieldName: e.target.value }))} /></div>
              <div><label className={labelClass}>Regional</label><input className={inputClass} value={hq.regionalName || ''} onChange={(e) => setHq((p) => ({ ...p, regionalName: e.target.value }))} /></div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
            <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Contato</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Telefone */}
              <div>
                <label className={labelClass}>Telefone</label>
                <div className="flex items-center gap-2">
                  {(() => { const ic = getFieldIconCfg(hq.fieldIcons?.contact || 'Phone'); const IcIcon = ic.Icon; return (
                    <button type="button" onClick={() => { setIconPickerField('contact'); setIconPickerSet('contact'); }}
                      title="Escolher ícone"
                      className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${ic.bg} overflow-hidden shadow-md transition-transform hover:scale-110`}>
                      <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                      <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                    </button>
                  ); })()}
                  <input className={inputClass} value={hq.contact || ''} onChange={(e) => setHq((p) => ({ ...p, contact: e.target.value }))} placeholder="(19) 3322-4400" />
                </div>
              </div>
              {/* WhatsApp */}
              <div>
                <label className={labelClass}>WhatsApp da Secretaria</label>
                <div className="flex items-center gap-2">
                  {(() => { const ic = getFieldIconCfg(hq.fieldIcons?.whatsapp || 'MessageCircle'); const IcIcon = ic.Icon; return (
                    <button type="button" onClick={() => { setIconPickerField('whatsapp'); setIconPickerSet('contact'); }}
                      title="Escolher ícone"
                      className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${ic.bg} overflow-hidden shadow-md transition-transform hover:scale-110`}>
                      <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                      <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                    </button>
                  ); })()}
                  <input className={inputClass} value={hq.whatsapp || ''} onChange={(e) => setHq((p) => ({ ...p, whatsapp: e.target.value }))} placeholder="(19) 9 9999-9999" />
                </div>
              </div>
              {/* Email */}
              <div>
                <label className={labelClass}>E-mail</label>
                <div className="flex items-center gap-2">
                  {(() => { const ic = getFieldIconCfg(hq.fieldIcons?.email || 'Mail'); const IcIcon = ic.Icon; return (
                    <button type="button" onClick={() => { setIconPickerField('email'); setIconPickerSet('contact'); }}
                      title="Escolher ícone"
                      className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${ic.bg} overflow-hidden shadow-md transition-transform hover:scale-110`}>
                      <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                      <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                    </button>
                  ); })()}
                  <input type="email" className={inputClass} value={hq.email || ''} onChange={(e) => setHq((p) => ({ ...p, email: e.target.value }))} placeholder="contato@igrejasede.org.br" />
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
            <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Endereco</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Logradouro */}
              <div className="md:col-span-2">
                <label className={labelClass}>Logradouro</label>
                <div className="flex items-center gap-2">
                  {(() => { const ic = getFieldIconCfg(hq.fieldIcons?.street || 'MapPin'); const IcIcon = ic.Icon; return (
                    <button type="button" onClick={() => { setIconPickerField('street'); setIconPickerSet('address'); }}
                      title="Escolher ícone"
                      className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${ic.bg} overflow-hidden shadow-md transition-transform hover:scale-110`}>
                      <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                      <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                    </button>
                  ); })()}
                  <input className={inputClass} value={hq.street || ''} onChange={(e) => setHq((p) => ({ ...p, street: e.target.value }))} />
                </div>
              </div>
              {/* Numero */}
              <div>
                <label className={labelClass}>Numero</label>
                <div className="flex items-center gap-2">
                  {(() => { const ic = getFieldIconCfg(hq.fieldIcons?.number || 'Hash'); const IcIcon = ic.Icon; return (
                    <button type="button" onClick={() => { setIconPickerField('number'); setIconPickerSet('address'); }}
                      title="Escolher ícone"
                      className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${ic.bg} overflow-hidden shadow-md transition-transform hover:scale-110`}>
                      <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                      <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                    </button>
                  ); })()}
                  <input className={inputClass} value={hq.number || ''} onChange={(e) => setHq((p) => ({ ...p, number: e.target.value }))} />
                </div>
              </div>
              {/* Bairro */}
              <div>
                <label className={labelClass}>Bairro</label>
                <div className="flex items-center gap-2">
                  {(() => { const ic = getFieldIconCfg(hq.fieldIcons?.neighborhood || 'Building'); const IcIcon = ic.Icon; return (
                    <button type="button" onClick={() => { setIconPickerField('neighborhood'); setIconPickerSet('address'); }}
                      title="Escolher ícone"
                      className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${ic.bg} overflow-hidden shadow-md transition-transform hover:scale-110`}>
                      <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                      <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                    </button>
                  ); })()}
                  <input className={inputClass} value={hq.neighborhood || ''} onChange={(e) => setHq((p) => ({ ...p, neighborhood: e.target.value }))} />
                </div>
              </div>
              {/* Cidade */}
              <div><label className={labelClass}>Cidade</label><input className={inputClass} value={hq.city || ''} onChange={(e) => setHq((p) => ({ ...p, city: e.target.value }))} /></div>
              {/* UF */}
              <div><label className={labelClass}>UF</label><input className={inputClass} maxLength={2} value={hq.state || ''} onChange={(e) => setHq((p) => ({ ...p, state: e.target.value.toUpperCase() }))} /></div>
              {/* CEP */}
              <div>
                <label className={labelClass}>CEP</label>
                <div className="flex items-center gap-2">
                  {(() => { const ic = getFieldIconCfg(hq.fieldIcons?.zipcode || 'Mailbox'); const IcIcon = ic.Icon; return (
                    <button type="button" onClick={() => { setIconPickerField('zipcode'); setIconPickerSet('address'); }}
                      title="Escolher ícone"
                      className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${ic.bg} overflow-hidden shadow-md transition-transform hover:scale-110`}>
                      <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                      <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                    </button>
                  ); })()}
                  <input className={inputClass} value={hq.zipcode || ''} onChange={(e) => setHq((p) => ({ ...p, zipcode: e.target.value }))} />
                </div>
              </div>
              {/* Pais */}
              <div><label className={labelClass}>Pais</label><input className={inputClass} value={hq.country || ''} onChange={(e) => setHq((p) => ({ ...p, country: e.target.value }))} /></div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
            <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Financeiro</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div><label className={labelClass}>Chave PIX</label><input className={inputClass} value={hq.pix || ''} onChange={(e) => setHq((p) => ({ ...p, pix: e.target.value }))} /></div>
              <div><label className={labelClass}>Banco</label><input className={inputClass} value={hq.bank || ''} onChange={(e) => setHq((p) => ({ ...p, bank: e.target.value }))} /></div>
            </div>
          </div>
          <SaveBtn />
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
            <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Nova Programacao</h3>
            <div className="flex flex-wrap gap-3 mb-4">
              <select value={scheduleForm.dayOfWeek} onChange={(e) => setScheduleForm((p) => ({ ...p, dayOfWeek: e.target.value }))} className={`${inputClass} w-36`}>
                {DAYS.map((d) => <option key={d}>{d}</option>)}
              </select>
              <input className={`${inputClass} flex-1 min-w-40`} placeholder="Nome do culto" value={scheduleForm.name} onChange={(e) => setScheduleForm((p) => ({ ...p, name: e.target.value }))} />
              <input type="time" className={`${inputClass} w-32`} value={scheduleForm.time} onChange={(e) => setScheduleForm((p) => ({ ...p, time: e.target.value }))} />
            </div>
            <div className="mb-4">
              <p className={labelClass}>Icone</p>
              <div className="grid grid-cols-7 gap-2">
                {SCHEDULE_ICONS.map((ic) => {
                  const IcIcon = ic.Icon;
                  const sel = scheduleForm.icon === ic.value;
                  return (
                    <button key={ic.value} type="button" title={ic.label}
                      onClick={() => setScheduleForm((p) => ({ ...p, icon: ic.value }))}
                      className={`flex flex-col items-center gap-1 rounded-xl p-2 transition-all border-2 ${sel ? 'border-purple-500 shadow-md scale-105' : 'border-transparent hover:border-slate-200'}`}>
                      <span className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${ic.bg} overflow-hidden shadow-md`}>
                        <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                        <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                      </span>
                      <span className="text-[10px] text-center leading-tight text-slate-500 dark:text-slate-400 max-w-[56px] truncate">{ic.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <button type="button" onClick={addSchedule} disabled={!scheduleForm.name || !scheduleForm.time}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            {hq.schedules.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">Nenhuma programacao cadastrada.</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 dark:border-slate-800 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-500">Culto</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Dia</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Horario</th>
                  <th className="px-4 py-3" />
                </tr></thead>
                <tbody>
                  {hq.schedules.map((s) => {
                    const cfg = getScheduleIconCfg(s.icon || 'Sun');
                    const SIcon = cfg.Icon;
                    return (
                      <tr key={s.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                        {scheduleEditing === s.id ? (
                          <td colSpan={4} className="px-4 py-3">
                            <div className="flex flex-wrap gap-3 mb-3">
                              <input className={`${inputClass} flex-1 min-w-40`} defaultValue={s.name}
                                onChange={(e) => (s as any)._editName = e.target.value} />
                              <select className={`${inputClass} w-36`} defaultValue={s.dayOfWeek}
                                onChange={(e) => (s as any)._editDay = e.target.value}>
                                {DAYS.map((d) => <option key={d}>{d}</option>)}
                              </select>
                              <input type="time" className={`${inputClass} w-32`} defaultValue={s.time}
                                onChange={(e) => (s as any)._editTime = e.target.value} />
                            </div>
                            <div className="mb-3">
                              <p className={labelClass}>Icone</p>
                              <div className="grid grid-cols-7 gap-2">
                                {SCHEDULE_ICONS.map((ic) => {
                                  const IcIcon = ic.Icon;
                                  const cur = scheduleEditIcon || s.icon || 'Sun';
                                  const sel = cur === ic.value;
                                  return (
                                    <button key={ic.value} type="button" title={ic.label}
                                      onClick={() => setScheduleEditIcon(ic.value)}
                                      className={`flex flex-col items-center gap-1 rounded-xl p-2 transition-all border-2 ${sel ? 'border-purple-500 shadow-md scale-105' : 'border-transparent hover:border-slate-200'}`}>
                                      <span className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${ic.bg} overflow-hidden shadow-md`}>
                                        <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                                        <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                                      </span>
                                      <span className="text-[10px] text-center leading-tight text-slate-500 dark:text-slate-400 max-w-[56px] truncate">{ic.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => saveScheduleEdit({ ...s, name: (s as any)._editName ?? s.name, dayOfWeek: (s as any)._editDay ?? s.dayOfWeek, time: (s as any)._editTime ?? s.time })} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white"><Check className="h-4 w-4" /> Salvar</button>
                              <button type="button" onClick={() => { setScheduleEditing(null); setScheduleEditIcon(''); }} className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200"><X className="h-4 w-4" /></button>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-3">
                                <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.bg} overflow-hidden shadow-md`}>
                                  <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                                  <SIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                                </span>
                                <span className="font-medium text-slate-900 dark:text-slate-100">{s.name}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{s.dayOfWeek}</td>
                            <td className="px-4 py-3"><span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">{s.time}</span></td>
                            <td className="px-4 py-3"><div className="flex gap-2 justify-end">
                              <button type="button" onClick={() => { setScheduleEditing(s.id); setScheduleEditIcon(s.icon || 'Sun'); }} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 dark:border-slate-700"><Pencil className="h-4 w-4" /></button>
                              <button type="button" onClick={() => deleteSchedule(s.id)} className="rounded-lg border border-red-200 p-1.5 text-red-500 hover:bg-red-50 dark:border-red-800"><Trash2 className="h-4 w-4" /></button>
                            </div></td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'access' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
            <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Nova Informacao de Acesso</h3>
            <div className="flex flex-wrap gap-3 mb-4">
              <input className={`${inputClass} flex-1 min-w-64`} placeholder="Descreva como chegar (ex: Linhas 032 e 041 com parada proxima)" value={accessForm.description} onChange={(e) => setAccessForm((p) => ({ ...p, description: e.target.value }))} />
              <input className={`${inputClass} w-full`} placeholder="Link do Google Maps (opcional, https://maps.app.goo.gl/...)" value={accessForm.mapUrl} onChange={(e) => setAccessForm((p) => ({ ...p, mapUrl: e.target.value }))} />
            </div>
            <div className="mb-4">
              <p className={labelClass}>Icone</p>
              <div className="grid grid-cols-5 sm:grid-cols-9 gap-2">
                {ACCESS_ICONS.map((ic) => {
                  const IcIcon = ic.Icon;
                  const sel = accessForm.icon === ic.value;
                  return (
                    <button key={ic.value} type="button" title={ic.label}
                      onClick={() => setAccessForm((p) => ({ ...p, icon: ic.value }))}
                      className={`flex flex-col items-center gap-1 rounded-xl p-2 transition-all border-2 ${sel ? 'border-purple-500 shadow-md scale-105' : 'border-transparent hover:border-slate-200'}`}>
                      <span className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${ic.bg} overflow-hidden shadow-md`}>
                        <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                        <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                      </span>
                      <span className="text-[10px] text-center leading-tight text-slate-500 dark:text-slate-400 max-w-[60px] truncate">{ic.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <button type="button" onClick={addAccess} disabled={!accessForm.description}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            {hq.accessInfos.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">Nenhuma informacao cadastrada.</div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
                {hq.accessInfos.map((a) => {
                  const cfg = getAccessIconCfg(a.icon || 'Bus');
                  const AIcon = cfg.Icon;
                  return (
                    <div key={a.id} className="px-4 py-3">
                      {accessEditing === a.id ? (
                        <div>
                          <div className="flex flex-wrap gap-3 mb-3">
                            <input className={`${inputClass} flex-1 min-w-64`} value={accessEditForm.description ?? a.description} onChange={(e) => setAccessEditForm((p) => ({ ...p, description: e.target.value }))} placeholder="Descricao" />
                            <input className={`${inputClass} w-full`} placeholder="Link Google Maps (opcional)" value={accessEditForm.mapUrl ?? (a.mapUrl || '')} onChange={(e) => setAccessEditForm((p) => ({ ...p, mapUrl: e.target.value }))} />
                          </div>
                          <div className="mb-3">
                            <p className={labelClass}>Icone</p>
                            <div className="grid grid-cols-5 sm:grid-cols-9 gap-2">
                              {ACCESS_ICONS.map((ic) => {
                                const IcIcon = ic.Icon;
                                const cur = accessEditIcon || a.icon || 'Bus';
                                const sel = cur === ic.value;
                                return (
                                  <button key={ic.value} type="button" title={ic.label}
                                    onClick={() => setAccessEditIcon(ic.value)}
                                    className={`flex flex-col items-center gap-1 rounded-xl p-2 transition-all border-2 ${sel ? 'border-purple-500 shadow-md scale-105' : 'border-transparent hover:border-slate-200'}`}>
                                    <span className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${ic.bg} overflow-hidden shadow-md`}>
                                      <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                                      <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                                    </span>
                                    <span className="text-[10px] text-center leading-tight text-slate-500 dark:text-slate-400 max-w-[60px] truncate">{ic.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => saveAccessEdit(a.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white"><Check className="h-4 w-4" /> Salvar</button>
                            <button type="button" onClick={() => { setAccessEditing(null); setAccessEditError(''); setAccessEditIcon(''); }} className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200"><X className="h-4 w-4" /></button>
                          </div>
                          {accessEditError && <p className="mt-2 text-xs text-red-500">{accessEditError}</p>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${cfg.bg} overflow-hidden shadow-md`}>
                            <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                            <AIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{a.description}</p>
                            {a.mapUrl && (
                              <a href={a.mapUrl} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-0.5">
                                <LinkIcon className="h-3 w-3" /> Ver no Google Maps
                              </a>
                            )}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button type="button" onClick={() => { setAccessEditing(a.id); setAccessEditForm({ description: a.description, mapUrl: a.mapUrl, type: a.type }); setAccessEditIcon(a.icon || 'Bus'); setAccessEditError(''); }} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 dark:border-slate-700"><Pencil className="h-4 w-4" /></button>
                            <button type="button" onClick={() => deleteAccess(a.id)} className="rounded-lg border border-red-200 p-1.5 text-red-500 hover:bg-red-50 dark:border-red-800"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'social' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
            <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Redes Sociais</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Instagram */}
              <div>
                <label className={labelClass}>Instagram</label>
                <div className="flex items-center gap-2">
                  {(() => { const ic = getFieldIconCfg(hq.fieldIcons?.instagram || 'Instagram', 'bg-pink-500'); const IcIcon = ic.Icon; return (
                    <button type="button" onClick={() => { setIconPickerField('instagram'); setIconPickerSet('social'); }}
                      title="Escolher ícone"
                      className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${ic.bg} overflow-hidden shadow-md transition-transform hover:scale-110`}>
                      <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                      <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                    </button>
                  ); })()}
                  <input className={inputClass} value={hq.instagram || ''} onChange={(e) => setHq((p) => ({ ...p, instagram: e.target.value }))} placeholder="@usuario ou URL" />
                </div>
              </div>
              {/* YouTube */}
              <div>
                <label className={labelClass}>YouTube</label>
                <div className="flex items-center gap-2">
                  {(() => { const ic = getFieldIconCfg(hq.fieldIcons?.youtube || 'Youtube', 'bg-red-600'); const IcIcon = ic.Icon; return (
                    <button type="button" onClick={() => { setIconPickerField('youtube'); setIconPickerSet('social'); }}
                      title="Escolher ícone"
                      className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${ic.bg} overflow-hidden shadow-md transition-transform hover:scale-110`}>
                      <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                      <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                    </button>
                  ); })()}
                  <input className={inputClass} value={hq.youtube || ''} onChange={(e) => setHq((p) => ({ ...p, youtube: e.target.value }))} placeholder="URL do canal" />
                </div>
              </div>
              {/* Site */}
              <div>
                <label className={labelClass}>Site</label>
                <div className="flex items-center gap-2">
                  {(() => { const ic = getFieldIconCfg(hq.fieldIcons?.site || 'Globe', 'bg-blue-500'); const IcIcon = ic.Icon; return (
                    <button type="button" onClick={() => { setIconPickerField('site'); setIconPickerSet('social'); }}
                      title="Escolher ícone"
                      className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${ic.bg} overflow-hidden shadow-md transition-transform hover:scale-110`}>
                      <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                      <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                    </button>
                  ); })()}
                  <input className={inputClass} value={hq.site || ''} onChange={(e) => setHq((p) => ({ ...p, site: e.target.value }))} placeholder="https://www.igrejasede.org.br" />
                </div>
              </div>
              {/* Facebook */}
              <div>
                <label className={labelClass}>Facebook</label>
                <div className="flex items-center gap-2">
                  {(() => { const ic = getFieldIconCfg(hq.fieldIcons?.facebook || 'Facebook', 'bg-blue-700'); const IcIcon = ic.Icon; return (
                    <button type="button" onClick={() => { setIconPickerField('facebook'); setIconPickerSet('social'); }}
                      title="Escolher ícone"
                      className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${ic.bg} overflow-hidden shadow-md transition-transform hover:scale-110`}>
                      <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                      <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                    </button>
                  ); })()}
                  <input className={inputClass} value={hq.facebook || ''} onChange={(e) => setHq((p) => ({ ...p, facebook: e.target.value }))} placeholder="URL ou @usuario" />
                </div>
              </div>
              {/* TikTok */}
              <div>
                <label className={labelClass}>TikTok</label>
                <div className="flex items-center gap-2">
                  {(() => { const ic = getFieldIconCfg(hq.fieldIcons?.tiktok || 'Music2', 'bg-zinc-800'); const IcIcon = ic.Icon; return (
                    <button type="button" onClick={() => { setIconPickerField('tiktok'); setIconPickerSet('social'); }}
                      title="Escolher ícone"
                      className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${ic.bg} overflow-hidden shadow-md transition-transform hover:scale-110`}>
                      <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                      <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                    </button>
                  ); })()}
                  <input className={inputClass} value={hq.tiktok || ''} onChange={(e) => setHq((p) => ({ ...p, tiktok: e.target.value }))} placeholder="@usuario" />
                </div>
              </div>
            </div>
          </div>
          <SaveBtn />
        </div>
      )}
    </div>

    {/* ─── Field Icon Picker Modal ─── */}
    {iconPickerField !== null && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={() => setIconPickerField(null)}>
        <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-white">Escolher Icone</h3>
            <button type="button" onClick={() => setIconPickerField(null)}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Tabs: contact vs address vs social */}
          <div className="mb-4 flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
            <button type="button" onClick={() => setIconPickerSet('contact')}
              className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${iconPickerSet === 'contact' ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
              Contato
            </button>
            <button type="button" onClick={() => setIconPickerSet('address')}
              className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${iconPickerSet === 'address' ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
              Endereco
            </button>
            <button type="button" onClick={() => setIconPickerSet('social')}
              className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${iconPickerSet === 'social' ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
              Social
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(iconPickerSet === 'contact' ? FIELD_ICONS_CONTACT : iconPickerSet === 'address' ? FIELD_ICONS_ADDRESS : FIELD_ICONS_SOCIAL).map((ic) => {
              const IcIcon = ic.Icon;
              const current = hq.fieldIcons?.[iconPickerField] || '';
              const sel = current === ic.value;
              return (
                <button key={ic.value} type="button" title={ic.label}
                  onClick={() => {
                    setHq((p) => ({ ...p, fieldIcons: { ...(p.fieldIcons || {}), [iconPickerField]: ic.value } }));
                    setIconPickerField(null);
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-xl p-2 transition-all border-2 ${sel ? 'border-purple-500 bg-purple-50 dark:bg-purple-950 scale-105' : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <span className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${ic.bg} overflow-hidden shadow-md`}>
                    <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                    <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                  </span>
                  <span className="text-center text-[10px] text-slate-600 dark:text-slate-400 leading-tight">{ic.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
