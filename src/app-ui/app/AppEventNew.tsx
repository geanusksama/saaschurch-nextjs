import { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft, Ticket, Mic2, Music2, BookOpen, Users, Sparkles, Heart,
  Flame, Star, Globe, Sunrise, Plus, Trash2, Eye, UserPlus, Link, Upload, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

const EVENT_ICONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'mic',      label: 'Louvor',      icon: Mic2 },
  { key: 'music',    label: 'Música',      icon: Music2 },
  { key: 'book',     label: 'Ensino',      icon: BookOpen },
  { key: 'users',    label: 'Encontro',    icon: Users },
  { key: 'sparkles', label: 'Jovens',      icon: Sparkles },
  { key: 'heart',    label: 'Adoração',    icon: Heart },
  { key: 'flame',    label: 'Avivamento',  icon: Flame },
  { key: 'star',     label: 'Especial',    icon: Star },
  { key: 'globe',    label: 'Missões',     icon: Globe },
  { key: 'sunrise',  label: 'Matinal',     icon: Sunrise },
  { key: 'ticket',   label: 'Conferência', icon: Ticket },
];

function getEventIcon(key: string): LucideIcon {
  return EVENT_ICONS.find(i => i.key === key)?.icon ?? Ticket;
}

type Sector = {
  _id: string;
  nome: string;
  andar: number;
  rows: number;
  seatsPerRow: number;
  preco: number;
  corHex: string;
};

type Participant = {
  _id: string;
  nome: string;
  papel: string;
  foto_url: string;
};

const uid = () => Math.random().toString(36).slice(2);
const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// ── Input / Label helpers ──────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500';
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';
const sectionCls = 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4';

export default function AppEventNew() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const user = getStoredUser();
  const churchId: string | undefined = user.churchId;

  // Aparência
  const [icon, setIcon]         = useState('ticket');
  const [imagemUrl, setImagemUrl] = useState('');
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url');
  const [uploading, setUploading] = useState(false);

  // Básico
  const [nome, setNome]         = useState('');
  const [descricao, setDescricao] = useState('');

  // Data / Local
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim]       = useState('');
  const [local, setLocal]           = useState('');
  const [localEndereco, setLocalEndereco] = useState('');

  // Tipo e preço
  const [tipoEvento, setTipoEvento] = useState<'LIVRE' | 'COM_ASSENTO'>('LIVRE');
  const [gratuito, setGratuito]     = useState(true);
  const [preco, setPreco]           = useState('0');
  const [limiteUsuario, setLimiteUsuario] = useState('');

  // Políticas
  const [permiteTransferencia, setPermiteTransferencia] = useState(false);
  const [permiteCancelamento, setPermiteCancelamento]   = useState(false);
  const [permiteReembolso, setPermiteReembolso]         = useState(false);

  // Ministério
  const [ministryId, setMinistryId] = useState('');

  // Status
  const [status, setStatus] = useState('RASCUNHO');

  // Setores e participantes
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [previewSector, setPreviewSector] = useState<string | null>(null);
  const [error, setError] = useState('');

  // ── Query: ministérios da igreja ─────────────────────────────────────────
  const { data: ministries = [] } = useQuery({
    queryKey: ['app-ministries', churchId],
    enabled: !!churchId,
    queryFn: async () => {
      const { data } = await supabase
        .from('ministries')
        .select('id, name, icon')
        .eq('church_id', churchId!)
        .order('name');
      return data ?? [];
    },
  });

  // ── Upload imagem para bucket "dados" ────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `events/${uid()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('dados').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('dados').getPublicUrl(path);
      setImagemUrl(publicUrl);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Erro ao fazer upload da imagem.');
    } finally {
      setUploading(false);
    }
  };

  // ── Setor helpers ────────────────────────────────────────────────────────
  const addSector = () => setSectors(s => [...s, {
    _id: uid(), nome: '', andar: 1, rows: 8, seatsPerRow: 10, preco: 0, corHex: '#8b5cf6',
  }]);
  const updateSector = (id: string, patch: Partial<Sector>) =>
    setSectors(s => s.map(x => x._id === id ? { ...x, ...patch } : x));
  const removeSector = (id: string) => {
    setSectors(s => s.filter(x => x._id !== id));
    if (previewSector === id) setPreviewSector(null);
  };

  // ── Participante helpers ─────────────────────────────────────────────────
  const addParticipant = () => setParticipants(p => [...p, { _id: uid(), nome: '', papel: '', foto_url: '' }]);
  const updateParticipant = (id: string, patch: Partial<Participant>) =>
    setParticipants(p => p.map(x => x._id === id ? { ...x, ...patch } : x));
  const removeParticipant = (id: string) => setParticipants(p => p.filter(x => x._id !== id));

  // ── Mutation ─────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error('Igreja não identificada. Faça login novamente.');
      if (!nome.trim()) throw new Error('Nome do evento é obrigatório.');
      if (!dataInicio) throw new Error('Data de início é obrigatória.');
      if (!dataFim)    throw new Error('Data de fim é obrigatória.');
      if (tipoEvento === 'COM_ASSENTO' && sectors.length === 0)
        throw new Error('Adicione ao menos uma sala/ambiente para eventos com assentos.');
      if (tipoEvento === 'COM_ASSENTO' && sectors.some(s => !s.nome.trim()))
        throw new Error('Todas as salas precisam ter nome.');

      const isSchemaMissing = (msg: string) =>
        msg.includes('schema cache');

      const { data: ev, error: evErr } = await supabase
        .from('app_events')
        .insert({
          church_id:             churchId,
          title:                 nome.trim(),
          nome:                  nome.trim(),
          descricao:             descricao || null,
          tipo_evento:           tipoEvento,
          icon:                  icon || null,
          imagem_url:            imagemUrl || null,
          data_inicio:           dataInicio,
          data_fim:              dataFim,
          start_at:              dataInicio,
          end_at:                dataFim,
          local:                 local || null,
          local_endereco:        localEndereco || null,
          preco:                 gratuito ? 0 : parseFloat(preco) || 0,
          gratuito,
          status,
          permite_transferencia: permiteTransferencia,
          permite_cancelamento:  permiteCancelamento,
          permite_reembolso:     permiteReembolso,
          department_id:         ministryId || null,
          limite_por_usuario:    limiteUsuario ? parseInt(limiteUsuario) : null,
          capacidade_total:      tipoEvento === 'COM_ASSENTO'
            ? sectors.reduce((t, s) => t + s.rows * s.seatsPerRow, 0)
            : null,
        })
        .select('id')
        .single();

      if (evErr) throw evErr;
      const eventId = ev.id;

      for (const [si, sector] of sectors.entries()) {
        const { data: sec, error: secErr } = await supabase
          .from('event_sectors')
          .insert({
            event_id:      eventId,
            nome:          sector.nome.trim(),
            andar:         sector.andar,
            rows_count:    sector.rows,
            seats_per_row: sector.seatsPerRow,
            quantidade:    sector.rows * sector.seatsPerRow,
            preco:         sector.preco,
            cor_hex:       sector.corHex,
            ordem:         si,
          })
          .select('id')
          .single();
        if (secErr) throw secErr;

        const rowsPayload = ROW_LABELS.slice(0, sector.rows).map((label, ri) => ({
          event_id: eventId, sector_id: sec.id, nome: label, ordem: ri,
        }));
        const { data: rowsData, error: rowsErr } = await supabase
          .from('event_rows').insert(rowsPayload).select('id, nome');
        if (rowsErr) throw rowsErr;

        const seatsPayload = rowsData.flatMap(row =>
          Array.from({ length: sector.seatsPerRow }, (_, ci) => ({
            event_id: eventId, sector_id: sec.id, row_id: row.id,
            numero: ci + 1, status: 'LIVRE',
          }))
        );
        if (seatsPayload.length > 0) {
          const { error: seatsErr } = await supabase.from('event_seats').insert(seatsPayload);
          if (seatsErr) throw seatsErr;
        }
      }

      const validParticipants = participants.filter(p => p.nome.trim());
      if (validParticipants.length > 0) {
        const { error: partErr } = await supabase.from('event_participants').insert(
          validParticipants.map((p, i) => ({
            event_id: eventId, nome: p.nome.trim(),
            papel: p.papel || null, foto_url: p.foto_url || null, ordem: i,
          }))
        );
        if (partErr) throw partErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-events'] });
      navigate('/app-ui/app/events');
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate();
  };

  const SelectedIcon = getEventIcon(icon);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col">

      {/* Header fixo */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/app-ui/app/events')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center">
            <Ticket className="w-4 h-4 text-purple-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Novo Evento</h1>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/app-ui/app/events')}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 shadow">
            {mutation.isPending ? 'Criando...' : 'Criar Evento'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Corpo — duas colunas */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-auto">
        <div className="flex h-full gap-0">

          {/* ── Coluna esquerda (sidebar fixa) ───────────────────────────── */}
          <div className="w-80 shrink-0 border-r border-slate-200 dark:border-slate-700 overflow-y-auto p-5 space-y-5 bg-slate-50/50 dark:bg-slate-800/30">

            {/* Ícone */}
            <div>
              <p className={labelCls}>Ícone do evento</p>
              <div className="grid grid-cols-6 gap-1.5 mb-3">
                {EVENT_ICONS.map(({ key, label, icon: Icon }) => (
                  <button key={key} type="button" title={label}
                    onClick={() => setIcon(key)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition ${
                      icon === key
                        ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/40'
                        : 'border-slate-200 dark:border-slate-600 hover:border-purple-300 bg-white dark:bg-slate-700'
                    }`}>
                    <Icon className={`w-5 h-5 ${icon === key ? 'text-purple-600' : 'text-slate-400'}`} />
                  </button>
                ))}
              </div>
              {/* Prévia */}
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                <div className="w-11 h-11 rounded-2xl bg-purple-600 flex items-center justify-center shrink-0">
                  <SelectedIcon className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400">Prévia no app</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{nome || 'Nome do Evento'}</p>
                </div>
              </div>
            </div>

            {/* Imagem / Banner */}
            <div>
              <p className={labelCls}>Imagem / Banner</p>
              {/* Toggle URL / Upload */}
              <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden mb-3">
                <button type="button"
                  onClick={() => setImageMode('url')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition ${
                    imageMode === 'url'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}>
                  <Link className="w-3 h-3" /> URL externa
                </button>
                <button type="button"
                  onClick={() => setImageMode('upload')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition ${
                    imageMode === 'upload'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}>
                  <Upload className="w-3 h-3" /> Upload
                </button>
              </div>

              {imageMode === 'url' ? (
                <input type="url" value={imagemUrl} onChange={e => setImagemUrl(e.target.value)}
                  placeholder="https://..."
                  className={inputCls}
                />
              ) : (
                <>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }}
                  />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 py-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-500 hover:border-purple-400 hover:text-purple-600 transition disabled:opacity-50">
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Enviando...' : 'Clique para selecionar imagem'}
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1 text-center">Salvo no bucket "dados" do Supabase</p>
                </>
              )}

              {imagemUrl && (
                <div className="mt-2 relative">
                  <img src={imagemUrl} alt="preview"
                    className="w-full h-32 object-cover rounded-lg border border-slate-200 dark:border-slate-600" />
                  <button type="button" onClick={() => setImagemUrl('')}
                    className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded-full text-white hover:bg-black/80">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Status */}
            <div>
              <p className={labelCls}>Status</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: 'RASCUNHO',  label: 'Rascunho',  cls: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300' },
                  { val: 'PUBLICADO', label: 'Publicado', cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
                  { val: 'ENCERRADO', label: 'Encerrado', cls: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
                  { val: 'CANCELADO', label: 'Cancelado', cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
                ].map(({ val, label, cls }) => (
                  <button key={val} type="button" onClick={() => setStatus(val)}
                    className={`py-2 rounded-lg text-xs font-medium border-2 transition ${
                      status === val ? 'border-purple-500' : 'border-transparent'
                    } ${cls}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Coluna direita (conteúdo principal) ──────────────────────── */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* Informações Básicas */}
            <section className={sectionCls}>
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Informações Básicas</h2>

              <div>
                <label className={labelCls}>Nome do Evento *</label>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} required
                  placeholder="Ex: Noite de Adoração"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Descrição</label>
                <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3}
                  placeholder="Detalhes do evento para o app..."
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Ministério</label>
                {ministries.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    Nenhum ministério cadastrado. Acesse <strong>App Móvel → Ministérios</strong> para criar.
                  </p>
                ) : (
                  <select value={ministryId} onChange={e => setMinistryId(e.target.value)} className={inputCls}>
                    <option value="">— Nenhum —</option>
                    {ministries.map((m: { id: string; name: string }) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </section>

            {/* Data e Local */}
            <section className={sectionCls}>
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Data e Local</h2>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Início *</label>
                  <input type="datetime-local" value={dataInicio} onChange={e => setDataInicio(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Fim *</label>
                  <input type="datetime-local" value={dataFim} onChange={e => setDataFim(e.target.value)} required className={inputCls} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Local / Nome do espaço</label>
                  <input type="text" value={local} onChange={e => setLocal(e.target.value)}
                    placeholder="Ex: Templo Central"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Endereço (opcional)</label>
                  <input type="text" value={localEndereco} onChange={e => setLocalEndereco(e.target.value)}
                    placeholder="Rua, número, bairro..."
                    className={inputCls}
                  />
                </div>
              </div>
            </section>

            {/* Tipo de Evento */}
            <section className={sectionCls}>
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Tipo de Evento e Ingressos</h2>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { val: 'LIVRE',       label: 'Ingresso livre', desc: 'Sem mapa de assentos' },
                  { val: 'COM_ASSENTO', label: 'Com assentos',   desc: 'Mapa de cadeiras' },
                ].map(({ val, label, desc }) => (
                  <button key={val} type="button"
                    onClick={() => setTipoEvento(val as 'LIVRE' | 'COM_ASSENTO')}
                    className={`flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition text-center ${
                      tipoEvento === val
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                        : 'border-slate-200 dark:border-slate-600 hover:border-purple-300'
                    }`}>
                    <Ticket className={`w-6 h-6 ${tipoEvento === val ? 'text-purple-600' : 'text-slate-400'}`} />
                    <span className={`text-sm font-semibold ${tipoEvento === val ? 'text-purple-700 dark:text-purple-300' : 'text-slate-700 dark:text-slate-300'}`}>{label}</span>
                    <span className="text-xs text-slate-500">{desc}</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={gratuito} onChange={e => setGratuito(e.target.checked)} className="w-4 h-4 accent-purple-600" />
                  Evento gratuito (R$ 0)
                </label>
                {[
                  { key: 'tr', label: 'Permite transferência', val: permiteTransferencia, set: setPermiteTransferencia },
                  { key: 'ca', label: 'Permite cancelamento',  val: permiteCancelamento,  set: setPermiteCancelamento },
                  { key: 're', label: 'Permite reembolso',     val: permiteReembolso,     set: setPermiteReembolso },
                ].map(({ key, label, val, set }) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} className="w-4 h-4 accent-purple-600" />
                    {label}
                  </label>
                ))}
              </div>

              {!gratuito && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Preço base (R$)</label>
                    <input type="number" min="0" step="0.01" value={preco} onChange={e => setPreco(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Limite por usuário</label>
                    <input type="number" min="1" value={limiteUsuario} onChange={e => setLimiteUsuario(e.target.value)} placeholder="Ex: 4" className={inputCls} />
                  </div>
                </div>
              )}
            </section>

            {/* Salas (COM_ASSENTO) */}
            {tipoEvento === 'COM_ASSENTO' && (
              <section className={sectionCls}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-800 dark:text-slate-200">Salas / Ambientes</h2>
                    {sectors.length > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {sectors.reduce((t, s) => t + s.rows * s.seatsPerRow, 0)} assentos totais
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={addSector}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                    <Plus className="w-4 h-4" /> Adicionar sala
                  </button>
                </div>

                {sectors.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">Adicione salas/ambientes para montar o mapa de assentos.</p>
                )}

                {sectors.map((s, idx) => {
                  const total = s.rows * s.seatsPerRow;
                  const rowLabels = ROW_LABELS.slice(0, Math.min(s.rows, 26));
                  const showPreview = previewSector === s._id;

                  return (
                    <div key={s._id} className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-700/60">
                        <span className="text-xs font-bold text-slate-400 w-5">{idx + 1}</span>
                        <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">{s.nome || 'Sala sem nome'}</span>
                        <span className="text-xs text-slate-400">{total} lugares</span>
                        <button type="button" onClick={() => setPreviewSector(showPreview ? null : s._id)}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => removeSector(s._id)}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="p-4 grid sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nome da sala *</label>
                          <input type="text" value={s.nome} onChange={e => updateSector(s._id, { nome: e.target.value })}
                            placeholder="Ex: Salão Principal"
                            className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Andar</label>
                          <input type="number" min="1" value={s.andar}
                            onChange={e => updateSector(s._id, { andar: parseInt(e.target.value) || 1 })}
                            className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Cor</label>
                          <input type="color" value={s.corHex} onChange={e => updateSector(s._id, { corHex: e.target.value })}
                            className="w-full h-9 border border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Fileiras — <span className="font-normal text-slate-400">A–{ROW_LABELS[Math.min(s.rows, 26) - 1] || 'A'}</span>
                          </label>
                          <input type="number" min="1" max="26" value={s.rows}
                            onChange={e => updateSector(s._id, { rows: Math.min(26, parseInt(e.target.value) || 1) })}
                            className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Assentos por fileira</label>
                          <input type="number" min="1" max="100" value={s.seatsPerRow}
                            onChange={e => updateSector(s._id, { seatsPerRow: Math.min(100, parseInt(e.target.value) || 1) })}
                            className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        {!gratuito && (
                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Preço desta sala (R$)</label>
                            <input type="number" min="0" step="0.01" value={s.preco}
                              onChange={e => updateSector(s._id, { preco: parseFloat(e.target.value) || 0 })}
                              className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                        )}
                      </div>

                      <div className="px-4 pb-2 text-xs text-slate-500 dark:text-slate-400">
                        Andar {s.andar} · {s.rows} fileiras ({rowLabels.join(', ')}) · {s.seatsPerRow} assentos · {total} lugares
                      </div>

                      {showPreview && s.rows > 0 && s.seatsPerRow > 0 && (
                        <div className="border-t border-slate-100 dark:border-slate-600 p-4">
                          <p className="text-xs text-center font-medium text-slate-400 mb-3">▲ PALCO / TELA ▲</p>
                          <div className="overflow-x-auto">
                            <div className="inline-block">
                              {rowLabels.map(rowLabel => (
                                <div key={rowLabel} className="flex items-center gap-1 mb-1">
                                  <span className="text-xs font-bold text-slate-400 w-4 text-center">{rowLabel}</span>
                                  {Array.from({ length: s.seatsPerRow }, (_, ci) => (
                                    <div key={ci}
                                      className="w-5 h-5 rounded-sm border text-[8px] flex items-center justify-center font-mono"
                                      style={{ borderColor: s.corHex + '80', backgroundColor: s.corHex + '20', color: s.corHex }}>
                                      {ci + 1}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            {/* Participantes */}
            <section className={sectionCls}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-800 dark:text-slate-200">Participantes</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Cantores, pregadores, convidados — aparecem no app</p>
                </div>
                <button type="button" onClick={addParticipant}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600">
                  <UserPlus className="w-4 h-4" /> Adicionar
                </button>
              </div>

              {participants.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-2">Nenhum participante adicionado.</p>
              )}

              {participants.map((p) => (
                <div key={p._id} className="flex items-start gap-3 p-3 border border-slate-200 dark:border-slate-600 rounded-xl">
                  <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    {p.foto_url ? (
                      <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 grid sm:grid-cols-3 gap-2">
                    <input type="text" value={p.nome} onChange={e => updateParticipant(p._id, { nome: e.target.value })}
                      placeholder="Nome *"
                      className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <input type="text" value={p.papel} onChange={e => updateParticipant(p._id, { papel: e.target.value })}
                      placeholder="Papel (cantor, MC...)"
                      className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <input type="url" value={p.foto_url} onChange={e => updateParticipant(p._id, { foto_url: e.target.value })}
                      placeholder="URL da foto"
                      className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <button type="button" onClick={() => removeParticipant(p._id)}
                    className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </section>

            {/* Espaço final */}
            <div className="h-4" />
          </div>
        </div>
      </form>
    </div>
  );
}
