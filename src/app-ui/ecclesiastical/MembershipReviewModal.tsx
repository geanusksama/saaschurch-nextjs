/**
 * Avaliação da ficha de adesão.
 *
 * Mostra tudo que a pessoa preencheu e os documentos anexados, lado a lado com
 * os botões de decisão. Aprovar cria o membro e devolve o ROL por WhatsApp;
 * reprovar exige motivo, que também vai por WhatsApp — ninguém fica sem
 * resposta.
 */

import { useState } from 'react';
import { Check, X, Loader2, FileText, AlertTriangle, ExternalLink, Copy, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export interface MembershipRequestFull {
  id: string;
  name: string;
  whatsapp: string;
  status: 'pending' | 'approved' | 'rejected';
  scheduled_date: string;
  past_churches?: string | null;
  is_married?: boolean;
  form_token?: string | null;
  form_submitted_at?: string | null;
  form_data?: Record<string, string> | null;
  documents?: Array<{ tipo: string; url: string; nome: string }> | null;
  review_notes?: string | null;
  member_rol?: number | null;
  churches?: { name: string } | null;
}

const MARITAL: Record<string, string> = {
  single: 'Solteiro(a)', married: 'Casado(a)', divorced: 'Divorciado(a)', widowed: 'Viúvo(a)',
};

function fmtDate(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v.length <= 10 ? `${v}T12:00:00` : v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-sm text-slate-800 break-words">{value?.trim() || '—'}</span>
    </div>
  );
}

export function MembershipReviewModal({
  request,
  onClose,
  onDone,
}: {
  request: MembershipRequestFull;
  onClose: () => void;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState(request.review_notes ?? '');
  const [saving, setSaving] = useState<'approved' | 'rejected' | 'closed' | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const f = request.form_data ?? {};
  const docs = request.documents ?? [];
  const preenchido = !!request.form_submitted_at;
  const decidido = request.status !== 'pending';

  const formUrl = request.form_token
    ? `${window.location.origin}/membro/formulario/${request.form_token}`
    : null;

  /** Envia o link pela Z-API — não é wa.me, sai de fato para a pessoa. */
  const enviarFicha = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      const token = localStorage.getItem('mrm_token') ?? '';
      const res = await fetch(`/api/membership-requests/${request.id}/send-form`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha ao enviar');
      toast.success(`Link da ficha enviado pelo WhatsApp (${data.instance}).`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao enviar');
    } finally {
      setEnviando(false);
    }
  };

  /**
   * `closeProcess` só no caso específico: aprovar conclui o CADASTRO, e por
   * padrão a pessoa continua no pipeline recebendo o cronograma do 1º mês.
   */
  const decide = async (decision: 'approved' | 'rejected', closeProcess = false) => {
    if (saving) return;
    if (decision === 'rejected' && !notes.trim()) {
      setErro('Descreva o motivo — ele é enviado para a pessoa no WhatsApp.');
      return;
    }
    setErro('');
    setSaving(closeProcess ? 'closed' : decision);
    try {
      const token = localStorage.getItem('mrm_token') ?? '';
      const res = await fetch(`/api/membership-requests/${request.id}/review`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes: notes.trim(), closeProcess }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha ao registrar a decisão');

      if (decision === 'approved') {
        toast.success(
          closeProcess
            ? `Aprovado com ROL ${data.rol} e acolhimento encerrado.`
            : `Cadastro aprovado! ROL ${data.rol}. O acolhimento continua no pipeline.`
        );
        if (!data.notified) toast.warning('O membro foi criado, mas o aviso no WhatsApp falhou.');
      } else {
        toast.success('Reprovado. O motivo foi enviado para a pessoa.');
      }
      onDone();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao registrar a decisão');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-200">
          <UserPlus className="w-5 h-5 text-emerald-600" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">{request.name}</h2>
            <p className="text-xs text-slate-500">
              {request.whatsapp} · {request.churches?.name ?? 'Sede'} ·{' '}
              {preenchido
                ? `ficha enviada em ${fmtDate(request.form_submitted_at)}`
                : 'ficha ainda não preenchida'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex flex-col gap-4">
          {request.status === 'approved' && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Aprovado — membro cadastrado com <b>ROL {request.member_rol ?? '—'}</b>.
            </div>
          )}
          {request.status === 'rejected' && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <b>Reprovado.</b> Motivo informado: {request.review_notes || '—'}
            </div>
          )}

          {!preenchido && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold">A ficha ainda não foi preenchida.</p>
                <p className="text-xs mt-0.5">
                  Sem os dados não há o que aprovar. Reenvie o link abaixo para a pessoa.
                </p>
                {formUrl && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <code className="text-[11px] bg-white px-2 py-1 rounded border border-amber-200 truncate flex-1">
                      {formUrl}
                    </code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(formUrl); toast.success('Link copiado'); }}
                      className="p-1.5 rounded-lg hover:bg-amber-100" title="Copiar link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={enviarFicha}
                      disabled={enviando}
                      title="Envia o link pelo WhatsApp da igreja (Z-API)"
                      className="px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      {enviando ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Enviar por WhatsApp
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {preenchido && (
            <>
              <div className="flex gap-4">
                {f.photoUrl && (
                  <img src={f.photoUrl} alt="Foto do candidato"
                    className="w-24 h-24 rounded-xl object-cover border border-slate-200 flex-shrink-0" />
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
                  <Row label="Nome completo" value={`${f.firstName ?? ''} ${f.lastName ?? ''}`} />
                  <Row label="Nome preferido" value={f.preferredName} />
                  <Row label="Nascimento" value={fmtDate(f.birthDate)} />
                  <Row label="CPF" value={f.cpf} />
                  <Row label="RG" value={f.rg} />
                  <Row label="Estado civil" value={MARITAL[f.maritalStatus ?? ''] ?? f.maritalStatus} />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                <Row label="E-mail" value={f.email} />
                <Row label="Telefone" value={f.phone} />
                <Row label="Naturalidade" value={[f.naturalityCity, f.naturalityState].filter(Boolean).join(' - ')} />
                <Row label="Nome do pai" value={f.fatherName} />
                <Row label="Nome da mãe" value={f.motherName} />
                <Row label="Entrada na igreja" value={fmtDate(f.churchEntryDate)} />
                <Row label="Batizado" value={f.baptized === 'sim' ? `Sim (${fmtDate(f.baptismDate)})` : f.baptized === 'nao' ? 'Não' : '—'} />
                <Row label="Contato de emergência" value={f.emergencyName} />
                <Row label="Telefone de emergência" value={f.emergencyPhone} />
              </div>

              <div className="pt-3 border-t border-slate-100">
                <Row
                  label="Endereço"
                  value={[
                    f.addressStreet, f.addressNumber, f.addressComplement,
                    f.addressNeighborhood, f.addressCity, f.addressState, f.addressZipcode,
                  ].filter(Boolean).join(', ')}
                />
              </div>

              {f.notes && (
                <div className="pt-3 border-t border-slate-100">
                  <Row label="Observações do candidato" value={f.notes} />
                </div>
              )}

              {/* documentos */}
              <div className="pt-3 border-t border-slate-100">
                <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                  Documentos anexados ({docs.length})
                </h3>
                {docs.length === 0 ? (
                  <p className="text-sm text-amber-600 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Nenhum documento anexado.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {docs.map((d, i) => (
                      <a key={i} href={d.url} target="_blank" rel="noreferrer"
                        title={d.nome}
                        className="w-24 h-24 rounded-xl border border-slate-200 overflow-hidden relative group">
                        {/\.(png|jpe?g|webp|gif)$/i.test(d.url) ? (
                          <img src={d.url} alt={d.nome} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-400">
                            <FileText className="w-7 h-7" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                          <ExternalLink className="w-5 h-5 text-white opacity-0 group-hover:opacity-100" />
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {!decidido && (
            <div className="pt-3 border-t border-slate-100">
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Observação da avaliação
                <span className="font-normal text-slate-400"> · obrigatória para reprovar, vai por WhatsApp</span>
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex.: o comprovante de endereço está ilegível, reenvie a foto."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
              {preenchido && (
                <p className="text-[11px] text-slate-400 mt-2">
                  Aprovar conclui o <b>cadastro</b>, não o acolhimento: a pessoa vira membro com ROL
                  e continua no pipeline recebendo o cronograma do 1º mês.
                </p>
              )}
            </div>
          )}
        </div>

        {!decidido && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
            <button onClick={onClose} className="px-5 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">
              Fechar
            </button>
            <button
              onClick={() => decide('rejected')}
              disabled={!!saving}
              className="px-5 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving === 'rejected' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              Reprovar
            </button>
            {/* exceção: aprova E encerra o acolhimento de uma vez */}
            <button
              onClick={() => decide('approved', true)}
              disabled={!!saving || !preenchido}
              title="Aprova o cadastro e encerra o acompanhamento do 1º mês junto — use só quando a pessoa não precisa passar pelo processo"
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 disabled:opacity-50"
            >
              {saving === 'closed' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Aprovar e encerrar acolhimento
            </button>
            <button
              onClick={() => decide('approved')}
              disabled={!!saving || !preenchido}
              title={!preenchido
                ? 'A ficha precisa estar preenchida para aprovar'
                : 'Cria o membro com ROL. O card segue no pipeline e a pessoa continua recebendo o cronograma.'}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving === 'approved' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Aprovar cadastro
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MembershipReviewModal;
