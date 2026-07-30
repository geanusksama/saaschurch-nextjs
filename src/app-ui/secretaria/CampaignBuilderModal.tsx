/**
 * Construtor de campanha — cria (ou edita) a campanha e monta o formulário.
 *
 * O ponto central é o de-para: cada pergunta pode ser ligada a um campo do
 * cadastro do membro. É esse vínculo, e só ele, que a aprovação grava. Pergunta
 * sem vínculo fica só na resposta, para consulta.
 *
 * Editar as perguntas trava assim que a primeira resposta chega — mudar o
 * formulário no meio deixaria as respostas antigas ilegíveis. Nesse caso a
 * saída é criar uma campanha nova.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown, ChevronUp, Loader2, Megaphone, Plus, Save, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  FIELD_TYPE_LABELS,
  memberFieldsByGroup,
  slugFieldId,
  type CampaignFieldType,
  type SecretariaCampaignField,
} from '@/lib/secretariaCampaignFields';

interface Instance {
  id: string;
  name: string;
  status: string;
}

export interface CampaignDraft {
  id?: string;
  name: string;
  reason: string;
  description: string;
  kind: 'form' | 'broadcast';
  formSchema: SecretariaCampaignField[];
  messageTemplate: string;
  imageUrl: string;
  videoUrl: string;
  linkUrl: string;
  instanceId: string;
  requireIdentification: boolean;
  closesAt: string;
  status: 'draft' | 'active' | 'closed';
  /** trava a edição das perguntas: já existe resposta */
  schemaLocked?: boolean;
}

export const EMPTY_DRAFT: CampaignDraft = {
  name: '',
  reason: '',
  description: '',
  kind: 'form',
  formSchema: [],
  messageTemplate:
    'Olá {{primeiro_nome}}! A secretaria precisa da sua ajuda para atualizar seu cadastro.\n\n' +
    'É rápido, é só abrir o link abaixo e preencher:\n{{link}}\n\nDeus abençoe!',
  imageUrl: '',
  videoUrl: '',
  linkUrl: '',
  instanceId: '',
  requireIdentification: true,
  closesAt: '',
  status: 'active',
};

const TIPOS_DISPONIVEIS = Object.keys(FIELD_TYPE_LABELS) as CampaignFieldType[];
const GRUPOS_CAMPOS = memberFieldsByGroup();

const VARIAVEIS = ['primeiro_nome', 'nome', 'igreja', 'regional', 'rol', 'cargo', 'link'];

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-purple-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100';

interface BuilderProps {
  open: boolean;
  initial?: CampaignDraft;
  onClose: () => void;
  onSaved: (campaignId: string) => void;
}

/**
 * A casca só decide se o modal existe. O conteúdo é remontado por `key` a cada
 * abertura, então o rascunho nasce direto do `initial` — sem efeito copiando
 * prop para estado, que é o que fazia o formulário aberto ser sobrescrito por
 * uma renderização do pai no meio da edição.
 */
export function CampaignBuilderModal(props: BuilderProps) {
  if (!props.open) return null;
  return <BuilderConteudo key={props.initial?.id ?? 'nova'} {...props} />;
}

function BuilderConteudo({ initial, onClose, onSaved }: BuilderProps) {
  const [draft, setDraft] = useState<CampaignDraft>(initial ?? EMPTY_DRAFT);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [saving, setSaving] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const res = await fetch('/api/whatsapp/instances', { headers: authHeaders() });
        const d = await res.json();
        // a rota devolve um ARRAY puro; ler d.instances deixava a lista sempre vazia
        if (ativo) setInstances(Array.isArray(d) ? d : d.instances ?? []);
      } catch {
        if (ativo) setInstances([]);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const set = <K extends keyof CampaignDraft>(k: K, v: CampaignDraft[K]) => setDraft(d => ({ ...d, [k]: v }));

  const idsUsados = useMemo(() => new Set(draft.formSchema.map(f => f.id)), [draft.formSchema]);

  const addField = () => {
    const id = slugFieldId('pergunta', idsUsados);
    const novo: SecretariaCampaignField = { id, type: 'text', label: '', required: false, memberField: null };
    set('formSchema', [...draft.formSchema, novo]);
    setAberta(id);
  };

  const updateField = (id: string, patch: Partial<SecretariaCampaignField>) =>
    set(
      'formSchema',
      draft.formSchema.map(f => (f.id === id ? { ...f, ...patch } : f))
    );

  const removeField = (id: string) => set('formSchema', draft.formSchema.filter(f => f.id !== id));

  const moveField = (id: string, delta: number) => {
    const i = draft.formSchema.findIndex(f => f.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= draft.formSchema.length) return;
    const copia = [...draft.formSchema];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    set('formSchema', copia);
  };

  const salvar = async () => {
    if (!draft.name.trim()) {
      toast.error('Dê um nome para a campanha.');
      return;
    }
    if (draft.kind === 'form' && !draft.formSchema.length) {
      toast.error('Adicione pelo menos uma pergunta.');
      return;
    }
    const semTitulo = draft.formSchema.find(f => !f.label.trim());
    if (draft.kind === 'form' && semTitulo) {
      toast.error('Toda pergunta precisa de um título.');
      setAberta(semTitulo.id);
      return;
    }

    setSaving(true);
    try {
      // O identificador da pergunta é derivado do título só no momento de
      // salvar, e nunca muda depois — é a chave da resposta no banco.
      const usados = new Set<string>();
      const schema = draft.formSchema.map(f => {
        const id = /^pergunta(_\d+)?$/.test(f.id) ? slugFieldId(f.label, usados) : f.id;
        usados.add(id);
        return { ...f, id };
      });

      const payload = {
        name: draft.name,
        reason: draft.reason,
        description: draft.description,
        kind: draft.kind,
        formSchema: draft.kind === 'form' ? schema : [],
        messageTemplate: draft.messageTemplate,
        imageUrl: draft.imageUrl,
        videoUrl: draft.videoUrl,
        linkUrl: draft.linkUrl,
        instanceId: draft.instanceId || null,
        requireIdentification: draft.requireIdentification,
        closesAt: draft.closesAt || null,
        status: draft.status,
      };

      const res = await fetch(
        draft.id ? `/api/secretaria/campaigns/${draft.id}` : '/api/secretaria/campaigns',
        { method: draft.id ? 'PATCH' : 'POST', headers: authHeaders(), body: JSON.stringify(payload) }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar');

      toast.success(draft.id ? 'Campanha atualizada.' : 'Campanha criada! O link já pode ser compartilhado.');
      onSaved(data.campaign.id);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[93vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {draft.id ? 'Editar campanha' : 'Nova campanha'}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* ── identificação ───────────────────────────────────────────── */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Nome da campanha *</label>
                <input
                  value={draft.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Ex.: Atualização de foto 2026"
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Motivo <span className="font-normal text-slate-400">(uso interno, não aparece no formulário)</span>
                </label>
                <input
                  value={draft.reason}
                  onChange={e => set('reason', e.target.value)}
                  placeholder="Ex.: Emissão das novas carteirinhas"
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Descrição <span className="font-normal text-slate-400">(o texto que a pessoa lê ao abrir o link)</span>
                </label>
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={e => set('description', e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Tipo</label>
                <select value={draft.kind} onChange={e => set('kind', e.target.value as 'form' | 'broadcast')} className={inputCls}>
                  <option value="form">Formulário (recebe resposta e aprova)</option>
                  <option value="broadcast">Comunicado (só envia, sem resposta)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Prazo final</label>
                <input type="date" value={draft.closesAt} onChange={e => set('closesAt', e.target.value)} className={inputCls} />
              </div>
            </div>
          </section>

          {/* ── formulário ──────────────────────────────────────────────── */}
          {draft.kind === 'form' ? (
            <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Perguntas do formulário
                </h3>
                {draft.schemaLocked ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    travado — já há respostas
                  </span>
                ) : (
                  <button
                    onClick={addField}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    <Plus className="h-3.5 w-3.5" /> Pergunta
                  </button>
                )}
              </div>

              {!draft.formSchema.length ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  Nenhuma pergunta ainda. Clique em <strong>+ Pergunta</strong> para começar.
                </p>
              ) : (
                <div className="space-y-2">
                  {draft.formSchema.map((f, i) => (
                    <div key={f.id} className="rounded-lg border border-slate-200 dark:border-slate-600">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <span className="w-5 text-xs font-bold text-slate-400">{i + 1}</span>
                        <button
                          onClick={() => setAberta(aberta === f.id ? null : f.id)}
                          className="flex-1 truncate text-left text-sm font-medium text-slate-700 dark:text-slate-200"
                        >
                          {f.label || <span className="text-slate-400">Sem título</span>}
                          <span className="ml-2 text-[10px] text-slate-400">{FIELD_TYPE_LABELS[f.type]}</span>
                          {f.memberField ? (
                            <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              atualiza cadastro
                            </span>
                          ) : null}
                        </button>
                        {!draft.schemaLocked ? (
                          <>
                            <button onClick={() => moveField(f.id, -1)} className="p-1 text-slate-400 hover:text-slate-600">
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button onClick={() => moveField(f.id, 1)} className="p-1 text-slate-400 hover:text-slate-600">
                              <ChevronDown className="h-4 w-4" />
                            </button>
                            <button onClick={() => removeField(f.id)} className="p-1 text-slate-400 hover:text-red-500">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : null}
                      </div>

                      {aberta === f.id ? (
                        <div className="space-y-3 border-t border-slate-100 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700/40">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Título da pergunta *</label>
                              <input
                                disabled={draft.schemaLocked}
                                value={f.label}
                                onChange={e => updateField(f.id, { label: e.target.value })}
                                className={inputCls}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Tipo de resposta</label>
                              <select
                                disabled={draft.schemaLocked}
                                value={f.type}
                                onChange={e => {
                                  const type = e.target.value as CampaignFieldType;
                                  // trocar o tipo pode invalidar o campo do cadastro escolhido
                                  const spec = GRUPOS_CAMPOS.flatMap(g => g.fields).find(x => x.key === f.memberField);
                                  const mantem = spec?.spec.accepts.includes(type);
                                  updateField(f.id, { type, memberField: mantem ? f.memberField : null });
                                }}
                                className={inputCls}
                              >
                                {TIPOS_DISPONIVEIS.map(t => (
                                  <option key={t} value={t}>
                                    {FIELD_TYPE_LABELS[t]}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="sm:col-span-2">
                              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                Explicação <span className="font-normal text-slate-400">(opcional)</span>
                              </label>
                              <input
                                disabled={draft.schemaLocked}
                                value={f.description ?? ''}
                                onChange={e => updateField(f.id, { description: e.target.value })}
                                className={inputCls}
                              />
                            </div>
                          </div>

                          {['select', 'radio', 'checkbox'].includes(f.type) ? (
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                Opções — uma por linha
                              </label>
                              <textarea
                                disabled={draft.schemaLocked}
                                rows={4}
                                value={(f.options ?? []).map(o => o.label).join('\n')}
                                onChange={e =>
                                  updateField(f.id, {
                                    options: e.target.value
                                      .split('\n')
                                      .map(l => l.trim())
                                      .filter(Boolean)
                                      .map(l => ({ value: l, label: l })),
                                  })
                                }
                                className={inputCls}
                                placeholder={'Solteiro\nCasado\nViúvo'}
                              />
                            </div>
                          ) : null}

                          <div>
                            <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                              Atualiza qual campo do cadastro?
                            </label>
                            <select
                              disabled={draft.schemaLocked}
                              value={f.memberField ?? ''}
                              onChange={e => updateField(f.id, { memberField: (e.target.value || null) as never })}
                              className={inputCls}
                            >
                              <option value="">Nenhum — a resposta fica só na campanha</option>
                              {GRUPOS_CAMPOS.map(g => (
                                <optgroup key={g.group} label={g.group}>
                                  {g.fields
                                    .filter(x => x.spec.accepts.includes(f.type))
                                    .filter(x => !draft.formSchema.some(o => o.id !== f.id && o.memberField === x.key))
                                    .map(x => (
                                      <option key={x.key} value={x.key}>
                                        {x.spec.label}
                                      </option>
                                    ))}
                                </optgroup>
                              ))}
                            </select>
                            <p className="mt-1 text-[10px] text-slate-400">
                              Ao aprovar a resposta, este é o campo que o sistema grava no cadastro do membro.
                            </p>
                          </div>

                          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <input
                              type="checkbox"
                              disabled={draft.schemaLocked}
                              checked={!!f.required}
                              onChange={e => updateField(f.id, { required: e.target.checked })}
                              className="h-4 w-4 rounded accent-purple-600"
                            />
                            Resposta obrigatória
                          </label>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={draft.requireIdentification}
                  onChange={e => set('requireIdentification', e.target.checked)}
                  className="h-4 w-4 rounded accent-purple-600"
                />
                Quem abrir o link avulso precisa se identificar com ROL + CPF
              </label>
              <p className="ml-6 mt-1 text-[10px] text-slate-400">
                Desmarque só em campanha aberta ao público. Sem identificação, a resposta não fica ligada a
                nenhum cadastro — e sem cadastro não há o que atualizar na aprovação.
              </p>
            </section>
          ) : null}

          {/* ── conteúdo enviado ────────────────────────────────────────── */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Mensagem enviada por WhatsApp
            </h3>

            {/* Primeiro campo da seção de propósito: enterrado no fim, ninguém
                achava, e a falta dela só aparecia como erro ao clicar Enviar. */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Instância do WhatsApp que faz o envio
              </label>
              <select value={draft.instanceId} onChange={e => set('instanceId', e.target.value)} className={inputCls}>
                <option value="">Escolher na hora do envio</option>
                {instances.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name} {i.status === 'connected' ? '· conectada' : '· desconectada'}
                  </option>
                ))}
              </select>
              {!instances.length ? (
                <p className="mt-1 text-[11px] text-amber-600">
                  Nenhuma instância disponível para você. Conecte um número em Comunicação → WhatsApp
                  Instâncias, ou peça acesso a uma instância existente.
                </p>
              ) : null}
            </div>

            <textarea
              rows={5}
              value={draft.messageTemplate}
              onChange={e => set('messageTemplate', e.target.value)}
              className={inputCls}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {VARIAVEIS.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set('messageTemplate', `${draft.messageTemplate}{{${v}}}`)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:border-purple-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              <strong>{'{{link}}'}</strong> vira o link individual da pessoa — já abre o formulário identificado.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Imagem (URL)</label>
                <input value={draft.imageUrl} onChange={e => set('imageUrl', e.target.value)} className={inputCls} placeholder="https://..." />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Vídeo / link extra (URL)</label>
                <input value={draft.videoUrl} onChange={e => set('videoUrl', e.target.value)} className={inputCls} placeholder="https://youtu.be/..." />
              </div>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-800">
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={draft.status === 'active'}
              onChange={e => set('status', e.target.checked ? 'active' : 'draft')}
              className="h-4 w-4 rounded accent-purple-600"
            />
            Publicar (o link já aceita respostas)
          </label>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar campanha
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CampaignBuilderModal;
