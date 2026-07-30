/**
 * Conferência de uma resposta de campanha.
 *
 * Mostra três coisas, nesta ordem: o que a pessoa respondeu, o que isso muda no
 * cadastro (valor atual → valor novo, campo a campo) e a decisão.
 *
 * Aprovar grava só os campos marcados. Reprovar exige o motivo, porque é ele
 * que vai por WhatsApp junto com o link para a pessoa corrigir e reenviar.
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Check, ExternalLink, FileText, Loader2, ThumbsDown, ThumbsUp, X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { SecretariaCampaignField } from '@/lib/secretariaCampaignFields';

interface Change {
  field: string;
  label: string;
  from: string | null;
  to: string | null;
}

interface ResponseDetail {
  response: {
    id: string;
    name: string | null;
    phone: string | null;
    answers: Record<string, string | number | string[]>;
    files: { fieldId: string; url: string; fileName: string; mimeType: string }[];
    status: 'pending' | 'approved' | 'rejected';
    review_notes: string | null;
    submitted_at: string;
    applied_fields: Change[];
  };
  campaign: { id: string; name: string; reason: string | null; formSchema: SecretariaCampaignField[] };
  target: { link: string; rol: number | null; church_name: string | null; title_name: string | null } | null;
  member: { id: string; fullName: string; rol: number | null; photoUrl: string | null } | null;
  changes: Change[];
  unchanged: { field: string; label: string }[];
}

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function ehImagem(mime: string) {
  return mime.startsWith('image/');
}

async function buscarResposta(responseId: string): Promise<ResponseDetail> {
  const res = await fetch(`/api/secretaria/campaign-responses/${responseId}`, { headers: authHeaders() });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Erro ao abrir a resposta');
  return json as ResponseDetail;
}

export function CampaignResponseDrawer({
  responseId,
  onClose,
  onReviewed,
}: {
  responseId: string | null;
  onClose: () => void;
  onReviewed: () => void;
}) {
  const [data, setData] = useState<ResponseDetail | null>(null);
  // abre carregando: o conteúdo só existe depois do fetch
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [camposMarcados, setCamposMarcados] = useState<Set<string>>(new Set());

  /**
   * O fetch mora fora do componente e o estado só é gravado no `.then` — é o
   * formato que o lint de efeitos pede, e de quebra o `vivo` corta a resposta
   * que chega depois de o painel fechar ou trocar de resposta.
   */
  useEffect(() => {
    if (!responseId) return;
    let vivo = true;
    buscarResposta(responseId)
      .then(json => {
        if (!vivo) return;
        setData(json);
        // por padrão tudo que muda entra na aprovação; desmarcar é a exceção
        setCamposMarcados(new Set((json.changes ?? []).map((c: Change) => c.field)));
        setMotivo('');
        setLoading(false);
      })
      .catch(e => {
        if (!vivo) return;
        toast.error(e instanceof Error ? e.message : 'Erro ao abrir a resposta');
        onClose();
      });
    return () => {
      vivo = false;
    };
  }, [responseId, onClose]);

  const decidir = async (decision: 'approved' | 'rejected') => {
    if (!data) return;
    if (decision === 'rejected' && !motivo.trim()) {
      toast.error('Escreva o motivo — é ele que a pessoa recebe no WhatsApp.');
      return;
    }
    if (decision === 'approved' && !camposMarcados.size && data.changes.length) {
      toast.error('Nenhum campo marcado. Marque o que deve ir para o cadastro, ou reprove.');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch(`/api/secretaria/campaign-responses/${data.response.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          decision,
          notes: motivo.trim() || undefined,
          fields: decision === 'approved' ? Array.from(camposMarcados) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erro ao registrar a decisão');

      if (decision === 'approved') {
        toast.success(
          json.applied?.length
            ? `Aprovado — ${json.applied.length} campo(s) atualizado(s) no cadastro.`
            : 'Aprovado. Nenhum campo do cadastro precisava mudar.'
        );
      } else if (json.whatsapp?.ok) {
        toast.success('Reprovado. A pessoa recebeu o motivo e o link para corrigir.');
      } else {
        toast.warning(`Reprovado, mas o WhatsApp não saiu (${json.whatsapp?.error ?? 'erro'}). Avise a pessoa.`);
      }

      onReviewed();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao registrar a decisão');
    } finally {
      setSalvando(false);
    }
  };

  if (!responseId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
              {data?.response.name ?? 'Resposta'}
            </h2>
            <p className="truncate text-[11px] text-slate-400">
              {data?.campaign.name}
              {data?.target?.rol ? ` · ROL ${data.target.rol}` : ''}
              {data?.target?.church_name ? ` · ${data.target.church_name}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading || !data ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {data.response.status !== 'pending' ? (
                <div
                  className={`rounded-lg border px-4 py-3 text-xs ${
                    data.response.status === 'approved'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  <strong>{data.response.status === 'approved' ? 'Já aprovado.' : 'Reprovado.'}</strong>{' '}
                  {data.response.review_notes ?? ''}
                  {data.response.applied_fields?.length ? (
                    <p className="mt-1">
                      Gravado no cadastro: {data.response.applied_fields.map(f => f.label).join(', ')}.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {!data.member ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>
                    Esta resposta não está ligada a nenhum cadastro de membro, então não há o que atualizar.
                    Só é possível reprovar ou usar os dados manualmente.
                  </span>
                </div>
              ) : null}

              {/* ── o que a pessoa respondeu ─────────────────────────────── */}
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  O que foi enviado
                </h3>
                <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  {data.campaign.formSchema.map(f => {
                    const anexo = data.response.files.find(x => x.fieldId === f.id);
                    const valor = data.response.answers[f.id];
                    return (
                      <div key={f.id}>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{f.label}</p>
                        {anexo ? (
                          ehImagem(anexo.mimeType) ? (
                            <a href={anexo.url} target="_blank" rel="noreferrer">
                              <img src={anexo.url} alt={f.label} className="mt-1 max-h-64 rounded-lg border border-slate-200" />
                            </a>
                          ) : (
                            <a
                              href={anexo.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-purple-600 hover:bg-slate-50 dark:border-slate-600"
                            >
                              <FileText className="h-4 w-4" />
                              {anexo.fileName}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )
                        ) : (
                          <p className="text-sm text-slate-800 dark:text-slate-100">
                            {valor === undefined || valor === null || valor === ''
                              ? <span className="text-slate-300">— não respondeu —</span>
                              : Array.isArray(valor)
                                ? valor.join(', ')
                                : String(valor)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* ── o que muda no cadastro ───────────────────────────────── */}
              {data.response.status === 'pending' && data.member ? (
                <section>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    O que vai mudar no cadastro
                  </h3>
                  {!data.changes.length ? (
                    <p className="rounded-xl border border-slate-200 px-4 py-6 text-center text-xs text-slate-400 dark:border-slate-700">
                      Nada muda: o que foi enviado é igual ao que já está no cadastro.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                      {data.changes.map(c => {
                        const marcado = camposMarcados.has(c.field);
                        return (
                          <label key={c.field} className="flex cursor-pointer items-center gap-3 px-4 py-2.5">
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() =>
                                setCamposMarcados(prev => {
                                  const next = new Set(prev);
                                  if (next.has(c.field)) next.delete(c.field);
                                  else next.add(c.field);
                                  return next;
                                })
                              }
                              className="h-4 w-4 rounded accent-emerald-600"
                            />
                            <span className="w-40 flex-shrink-0 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                              {c.label}
                            </span>
                            <span className="flex-1 truncate text-xs text-slate-400 line-through">{c.from ?? '—'}</span>
                            <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
                            <span className="flex-1 truncate text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              {c.to}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {data.unchanged.length ? (
                    <p className="mt-2 text-[10px] text-slate-400">
                      Sem alteração: {data.unchanged.map(u => u.label).join(', ')}.
                    </p>
                  ) : null}
                </section>
              ) : null}

              {/* ── decisão ──────────────────────────────────────────────── */}
              {data.response.status === 'pending' ? (
                <section>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Observação / motivo
                  </h3>
                  <textarea
                    rows={3}
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    placeholder="Obrigatório ao reprovar. Ex.: A foto está desfocada, envie outra com fundo claro."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-purple-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                </section>
              ) : null}
            </div>

            {data.response.status === 'pending' ? (
              <div className="flex gap-2 border-t border-slate-200 p-4 dark:border-slate-700">
                <button
                  onClick={() => decidir('rejected')}
                  disabled={salvando}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 py-2.5 text-xs font-bold text-amber-700 disabled:opacity-50"
                >
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
                  Reprovar e pedir correção
                </button>
                <button
                  onClick={() => decidir('approved')}
                  disabled={salvando || !data.member}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                  Aprovar e atualizar cadastro
                </button>
              </div>
            ) : (
              <div className="border-t border-slate-200 p-4 text-center dark:border-slate-700">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <Check className="h-4 w-4" /> Esta resposta já foi avaliada.
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default CampaignResponseDrawer;
