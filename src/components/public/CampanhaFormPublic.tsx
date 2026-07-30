/**
 * Campanha da Secretaria — formulário público.
 *
 * A pessoa chega por link do WhatsApp. Duas formas:
 *   /campanha/<share_token>              → link avulso, pede ROL + CPF
 *   /campanha/<share_token>/<token>      → link individual, já identificado
 *
 * As perguntas vêm do `form_schema` da campanha — nada é fixo aqui. Quem foi
 * reprovado reabre o mesmo link, vê o motivo, corrige e reenvia.
 *
 * TEMA CLARO SEMPRE, pelo mesmo motivo da ficha de adesão: em aparelho no modo
 * escuro o navegador reescreve as cores dos campos nativos e o texto digitado
 * some. `colorScheme: light` no container resolve na raiz.
 */

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { AlertTriangle, Check, FileText, Loader2, Send, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import type { SecretariaCampaignField } from '@/lib/secretariaCampaignFields';

type Answer = string | number | string[];

interface AnexoLocal {
  file: File;
  preview: string;
}

interface CampaignInfo {
  name: string;
  description: string | null;
  kind: 'form' | 'broadcast';
  formSchema: SecretariaCampaignField[];
  messageTemplate: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  linkUrl: string | null;
  requireIdentification: boolean;
  closesAt: string | null;
}

const digitos = (v: string) => v.replace(/\D/g, '');

function mascaraCpf(v: string) {
  return digitos(v)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function mascaraTelefone(v: string) {
  const d = digitos(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

const inputCls =
  'w-full h-11 px-3 rounded-lg bg-white border border-slate-300 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25';

const cardCls = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm';

interface ArquivoSalvo {
  fieldId: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
}

interface RespostaAnterior {
  status: 'pending' | 'approved' | 'rejected';
  answers: Record<string, Answer>;
  files: ArquivoSalvo[];
  reviewNotes: string | null;
  submittedAt: string;
}

interface CampanhaPublica {
  campaign: CampaignInfo;
  person: { name: string | null; rol: number | null; churchName: string | null } | null;
  previous: RespostaAnterior | null;
  locked: boolean;
  closedReason: string | null;
}

async function buscarCampanha(token?: string, targetToken?: string): Promise<CampanhaPublica> {
  const qs = targetToken ? `?t=${encodeURIComponent(targetToken)}` : '';
  const res = await fetch(`/api/public/campanha/${token}${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Campanha não encontrada.');
  return data as CampanhaPublica;
}

export default function CampanhaFormPublic() {
  const { token, targetToken } = useParams<{ token: string; targetToken?: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);

  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [person, setPerson] = useState<{ name: string | null; rol: number | null; churchName: string | null } | null>(null);
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [motivoReprovacao, setMotivoReprovacao] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  // anexos ficam em memória até o envio: quem desiste no meio não deixa lixo no storage
  const [anexos, setAnexos] = useState<Record<string, AnexoLocal>>({});
  // urls de anexos já enviados numa tentativa anterior (reaproveitadas se a pessoa não trocar)
  const [anexosSalvos, setAnexosSalvos] = useState<Record<string, { url: string; fileName: string; mimeType: string; size: number }>>({});

  const [identRol, setIdentRol] = useState('');
  const [identCpf, setIdentCpf] = useState('');
  const [nomeAvulso, setNomeAvulso] = useState('');
  const [telAvulso, setTelAvulso] = useState('');

  const previewsRef = useRef<string[]>([]);

  useEffect(
    () => () => {
      previewsRef.current.forEach(url => URL.revokeObjectURL(url));
    },
    []
  );

  /**
   * O fetch mora fora do componente e o estado só é gravado no `.then`: é o
   * formato que o lint de efeitos pede, e o `vivo` evita gravar depois que a
   * pessoa já saiu da tela — no celular, abrir e fechar no meio é comum.
   */
  useEffect(() => {
    let vivo = true;
    buscarCampanha(token, targetToken)
      .then(data => {
        if (!vivo) return;
        setCampaign(data.campaign);
        setPerson(data.person);
        setClosedReason(data.closedReason ?? null);
        setLocked(!!data.locked);

        if (data.previous) {
          setAnswers((data.previous.answers ?? {}) as Record<string, Answer>);
          const salvos: Record<string, { url: string; fileName: string; mimeType: string; size: number }> = {};
          for (const f of data.previous.files ?? []) {
            salvos[f.fieldId] = { url: f.url, fileName: f.fileName, mimeType: f.mimeType, size: f.size };
          }
          setAnexosSalvos(salvos);
          setMotivoReprovacao(data.previous.reviewNotes ?? null);
          // pendente = já enviou e está esperando avaliação; reprovado volta a editar
          if (data.previous.status === 'pending') setEnviado(true);
        }
        setLoading(false);
      })
      .catch(e => {
        if (!vivo) return;
        setErro(e instanceof Error ? e.message : 'Campanha não encontrada.');
        setLoading(false);
      });
    return () => {
      vivo = false;
    };
  }, [token, targetToken]);

  const setAnswer = (id: string, v: Answer) => setAnswers(a => ({ ...a, [id]: v }));

  const escolherArquivo = (fieldId: string, file: File) => {
    const url = URL.createObjectURL(file);
    previewsRef.current.push(url);
    setAnexos(a => ({ ...a, [fieldId]: { file, preview: url } }));
    // arquivo novo invalida o que já tinha sido enviado
    setAnexosSalvos(s => {
      const next = { ...s };
      delete next[fieldId];
      return next;
    });
  };

  const removerArquivo = (fieldId: string) => {
    setAnexos(a => {
      const next = { ...a };
      delete next[fieldId];
      return next;
    });
    setAnexosSalvos(s => {
      const next = { ...s };
      delete next[fieldId];
      return next;
    });
  };

  const submit = async () => {
    if (!campaign) return;

    // ── conferência local: mensagem imediata, sem ida ao servidor ────────────
    const faltando: string[] = [];
    for (const f of campaign.formSchema) {
      if (!f.required) continue;
      if (f.type === 'image' || f.type === 'file') {
        if (!anexos[f.id] && !anexosSalvos[f.id]) faltando.push(f.label);
        continue;
      }
      const v = answers[f.id];
      if (v === undefined || v === null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === '')) {
        faltando.push(f.label);
      }
    }
    if (faltando.length) {
      toast.error(`Preencha: ${faltando.join(', ')}`);
      return;
    }
    if (!person && campaign.requireIdentification && (!identRol.trim() || !identCpf.trim())) {
      toast.error('Informe seu ROL e seu CPF para continuarmos.');
      return;
    }
    if (!person && !campaign.requireIdentification && !nomeAvulso.trim()) {
      toast.error('Informe seu nome.');
      return;
    }

    setSaving(true);
    try {
      // anexos sobem agora, no envio
      const files: { fieldId: string; url: string; fileName: string; mimeType: string; size: number }[] =
        Object.entries(anexosSalvos).map(([fieldId, f]) => ({ fieldId, ...f }));

      for (const [fieldId, anexo] of Object.entries(anexos)) {
        const campo = campaign.formSchema.find(f => f.id === fieldId);
        const fd = new FormData();
        fd.append('file', anexo.file);
        fd.append('kind', campo?.type === 'file' ? 'file' : 'image');
        const up = await fetch(`/api/public/campanha/${token}/upload`, { method: 'POST', body: fd });
        const dataUp = await up.json().catch(() => ({}));
        if (!up.ok || !dataUp.url) throw new Error(dataUp.error ?? `Falha ao enviar "${campo?.label ?? 'arquivo'}"`);
        files.push({ fieldId, url: dataUp.url, fileName: dataUp.fileName, mimeType: dataUp.mimeType, size: dataUp.size });
      }

      const res = await fetch(`/api/public/campanha/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetToken: targetToken ?? null,
          identifier: person ? undefined : { rol: identRol, cpf: identCpf },
          name: person ? undefined : nomeAvulso,
          phone: person ? undefined : digitos(telAvulso),
          answers,
          files,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Não conseguimos enviar. Tente de novo.');

      setEnviado(true);
      setMotivoReprovacao(null);
      toast.success('Enviado! A secretaria vai conferir.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao enviar.');
    } finally {
      setSaving(false);
    }
  };

  // ── estados de tela ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50" style={{ colorScheme: 'light' }}>
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (erro || !campaign) {
    return (
      <Moldura>
        <div className={`${cardCls} text-center`}>
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <p className="text-sm font-semibold text-slate-800">{erro || 'Campanha não encontrada.'}</p>
          <p className="mt-2 text-xs text-slate-500">Se você recebeu este link da secretaria, procure-a para receber um novo.</p>
        </div>
      </Moldura>
    );
  }

  // Comunicado: só de ida, não tem o que responder.
  if (campaign.kind === 'broadcast') {
    return (
      <Moldura titulo={campaign.name}>
        <div className={cardCls}>
          {campaign.imageUrl ? (
            <img src={campaign.imageUrl} alt="" className="mb-4 w-full rounded-lg" />
          ) : null}
          {campaign.messageTemplate ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{campaign.messageTemplate}</p>
          ) : null}
          {campaign.videoUrl || campaign.linkUrl ? (
            <a
              href={campaign.videoUrl || campaign.linkUrl || '#'}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg bg-emerald-600 text-sm font-semibold text-white"
            >
              Abrir
            </a>
          ) : null}
        </div>
      </Moldura>
    );
  }

  if (closedReason) {
    return (
      <Moldura titulo={campaign.name}>
        <div className={`${cardCls} text-center`}>
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <p className="text-sm font-semibold text-slate-800">{closedReason}</p>
        </div>
      </Moldura>
    );
  }

  if (locked) {
    return (
      <Moldura titulo={campaign.name}>
        <div className={`${cardCls} text-center`}>
          <Check className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
          <p className="text-sm font-semibold text-slate-800">Seu envio já foi aprovado.</p>
          <p className="mt-2 text-xs text-slate-500">Os dados já foram atualizados no seu cadastro. Obrigado!</p>
        </div>
      </Moldura>
    );
  }

  if (enviado) {
    return (
      <Moldura titulo={campaign.name}>
        <div className={`${cardCls} text-center`}>
          <Check className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
          <p className="text-sm font-semibold text-slate-800">Recebemos seu envio!</p>
          <p className="mt-2 text-xs text-slate-500">
            A secretaria vai conferir. Se faltar algo, você recebe uma mensagem no WhatsApp com o que corrigir.
          </p>
          <button
            type="button"
            onClick={() => setEnviado(false)}
            className="mt-4 text-xs font-semibold text-emerald-700 underline"
          >
            Quero revisar o que enviei
          </button>
        </div>
      </Moldura>
    );
  }

  // ── formulário ─────────────────────────────────────────────────────────────
  return (
    <Moldura titulo={campaign.name}>
      {motivoReprovacao ? (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-700">
            <AlertTriangle className="h-4 w-4" /> Precisa de correção
          </p>
          <p className="text-sm text-amber-900">{motivoReprovacao}</p>
        </div>
      ) : null}

      {campaign.description ? (
        <div className={`${cardCls} mb-4`}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{campaign.description}</p>
        </div>
      ) : null}

      {person ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Preenchendo como</p>
          <p className="text-sm font-bold text-emerald-900">{person.name}</p>
          <p className="text-xs text-emerald-700">
            {person.rol ? `ROL ${person.rol}` : ''}
            {person.rol && person.churchName ? ' · ' : ''}
            {person.churchName ?? ''}
          </p>
        </div>
      ) : campaign.requireIdentification ? (
        <div className={`${cardCls} mb-4`}>
          <p className="mb-3 text-sm font-bold text-emerald-700">Identifique-se</p>
          <p className="mb-3 text-xs text-slate-500">
            Precisamos saber de quem é o cadastro que vamos atualizar. Seu ROL está na sua carteirinha.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Número do ROL" required>
              <input
                inputMode="numeric"
                value={identRol}
                onChange={e => setIdentRol(digitos(e.target.value).slice(0, 8))}
                className={inputCls}
                placeholder="1234"
              />
            </Campo>
            <Campo label="CPF" required>
              <input
                inputMode="numeric"
                value={identCpf}
                onChange={e => setIdentCpf(mascaraCpf(e.target.value))}
                className={inputCls}
                placeholder="000.000.000-00"
              />
            </Campo>
          </div>
        </div>
      ) : (
        <div className={`${cardCls} mb-4`}>
          <p className="mb-3 text-sm font-bold text-emerald-700">Seus dados</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Seu nome" required>
              <input value={nomeAvulso} onChange={e => setNomeAvulso(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="WhatsApp">
              <input
                inputMode="numeric"
                value={telAvulso}
                onChange={e => setTelAvulso(mascaraTelefone(e.target.value))}
                className={inputCls}
                placeholder="(19) 99999-9999"
              />
            </Campo>
          </div>
        </div>
      )}

      <div className={`${cardCls} space-y-5`}>
        {campaign.formSchema.map(field => (
          <CampoDinamico
            key={field.id}
            field={field}
            value={answers[field.id]}
            onChange={v => setAnswer(field.id, v)}
            anexo={anexos[field.id] ?? null}
            anexoSalvo={anexosSalvos[field.id] ?? null}
            onFile={f => escolherArquivo(field.id, f)}
            onRemoveFile={() => removerArquivo(field.id)}
          />
        ))}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={submit}
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {saving ? 'Enviando...' : 'Enviar para a secretaria'}
      </button>
      <p className="mb-8 mt-3 text-center text-[11px] text-slate-400">
        Seus dados são usados apenas para atualizar seu cadastro na igreja.
      </p>
    </Moldura>
  );
}

/* ------------------------------------------------------------ componentes */

function Moldura({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6" style={{ colorScheme: 'light' }}>
      <div className="mx-auto w-full max-w-xl">
        {titulo ? <h1 className="mb-4 text-lg font-bold text-slate-800">{titulo}</h1> : null}
        {children}
      </div>
    </div>
  );
}

function Campo({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600">
        {label}
        {required ? <span className="text-emerald-600"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function CampoDinamico({
  field,
  value,
  onChange,
  anexo,
  anexoSalvo,
  onFile,
  onRemoveFile,
}: {
  field: SecretariaCampaignField;
  value: Answer | undefined;
  onChange: (v: Answer) => void;
  anexo: AnexoLocal | null;
  anexoSalvo: { url: string; fileName: string } | null;
  onFile: (f: File) => void;
  onRemoveFile: () => void;
}) {
  const texto = value === undefined || value === null ? '' : String(value);

  const corpo = () => {
    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            rows={4}
            value={texto}
            placeholder={field.placeholder}
            onChange={e => onChange(e.target.value)}
            className={`${inputCls} h-auto py-2`}
          />
        );

      case 'select':
        return (
          <select value={texto} onChange={e => onChange(e.target.value)} className={inputCls}>
            <option value="">Selecione...</option>
            {(field.options ?? []).map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {(field.options ?? []).map(o => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name={field.id}
                  checked={texto === o.value}
                  onChange={() => onChange(o.value)}
                  className="h-4 w-4 accent-emerald-600"
                />
                {o.label}
              </label>
            ))}
          </div>
        );

      case 'checkbox': {
        const marcados = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {(field.options ?? []).map(o => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={marcados.includes(o.value)}
                  onChange={e =>
                    onChange(e.target.checked ? [...marcados, o.value] : marcados.filter(v => v !== o.value))
                  }
                  className="h-4 w-4 rounded accent-emerald-600"
                />
                {o.label}
              </label>
            ))}
          </div>
        );
      }

      case 'image':
      case 'file': {
        const nome = anexo?.file.name ?? anexoSalvo?.fileName ?? '';
        const previewImagem = field.type === 'image' ? anexo?.preview ?? anexoSalvo?.url ?? '' : '';
        return (
          <div>
            {previewImagem ? (
              <img src={previewImagem} alt="" className="mb-2 h-40 w-full rounded-lg object-cover" />
            ) : null}
            {nome ? (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <span className="flex-1 truncate text-xs text-slate-600">{nome}</span>
                <button type="button" onClick={onRemoveFile} className="text-slate-400 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white text-sm font-semibold text-slate-600">
              <Upload className="h-4 w-4" />
              {nome ? 'Trocar' : field.type === 'image' ? 'Enviar foto' : 'Enviar PDF'}
              <input
                type="file"
                accept={field.type === 'image' ? 'image/*' : 'application/pdf'}
                capture={field.type === 'image' ? 'environment' : undefined}
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        );
      }

      case 'cpf':
        return (
          <input
            inputMode="numeric"
            value={mascaraCpf(texto)}
            placeholder="000.000.000-00"
            onChange={e => onChange(mascaraCpf(e.target.value))}
            className={inputCls}
          />
        );

      case 'phone':
        return (
          <input
            inputMode="numeric"
            value={mascaraTelefone(texto)}
            placeholder={field.placeholder ?? '(19) 99999-9999'}
            onChange={e => onChange(mascaraTelefone(e.target.value))}
            className={inputCls}
          />
        );

      default:
        return (
          <input
            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
            value={texto}
            placeholder={field.placeholder}
            onChange={e => onChange(e.target.value)}
            className={inputCls}
          />
        );
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-700">
        {field.label}
        {field.required ? <span className="text-emerald-600"> *</span> : null}
      </label>
      {field.description ? <p className="mb-1 text-[11px] text-slate-500">{field.description}</p> : null}
      {corpo()}
    </div>
  );
}
