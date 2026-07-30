/**
 * Campanhas da Secretaria.
 *
 * Uma campanha é um pedido da secretaria a um grupo de pessoas: atualizar a
 * foto, confirmar o endereço, mandar um documento — ou apenas um comunicado.
 *
 * O ciclo é sempre o mesmo:
 *   1. cria a campanha e monta o formulário (cada pergunta pode apontar para um
 *      campo do cadastro);
 *   2. compartilha o link, e/ou anexa pessoas e dispara por WhatsApp;
 *   3. as respostas caem na aba Respostas;
 *   4. conferir → aprovar (grava no cadastro) ou reprovar (devolve o link com o
 *      motivo, para a pessoa corrigir e reenviar).
 *
 * O disparo reaproveita o motor de envio em massa: a tela chama o orquestrador
 * em laço, respeitando o `waitMs` que ele devolve. É esse laço que garante o
 * cooldown de 5 s por instância — sem ele o número é banido.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, CheckCircle2, ClipboardCopy, Clock, Loader2, Lock, Megaphone,
  MessageCircle, Pencil, Plus, RefreshCw, RotateCcw, Search, Send, Smartphone,
  Trash2, TriangleAlert, UserPlus, Users, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { SecretariaCampaignField } from '@/lib/secretariaCampaignFields';
import { AttachAudienceModal } from './AttachAudienceModal';
import { CampaignBuilderModal, EMPTY_DRAFT, type CampaignDraft } from './CampaignBuilderModal';
import { CampaignResponseDrawer } from './CampaignResponseDrawer';
import { ConfirmDialog } from '../../components/app-ui/shared/ConfirmDialog';

interface Campaign {
  id: string;
  name: string;
  reason: string | null;
  description: string | null;
  kind: 'form' | 'broadcast';
  status: 'draft' | 'active' | 'closed';
  form_schema: SecretariaCampaignField[];
  message_template: string | null;
  image_url: string | null;
  video_url: string | null;
  link_url: string | null;
  instance_id: string | null;
  require_identification: boolean;
  closes_at: string | null;
  target_count: number;
  sent_count: number;
  response_count: number;
  created_at: string;
  shareUrl: string;
}

interface Target {
  id: string;
  name: string | null;
  phone: string | null;
  rol: number | null;
  church_name: string | null;
  regional_name: string | null;
  title_name: string | null;
  status: string;
  sent_at: string | null;
  error: string | null;
  link: string;
}

interface ResponseRow {
  id: string;
  name: string | null;
  phone: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  rol: number | null;
  churchName: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  active: 'Ativa',
  closed: 'Encerrada',
};

const TARGET_LABEL: Record<string, string> = {
  pending: 'Não enviado',
  sending: 'Enviando',
  sent: 'Enviado',
  failed: 'Falhou',
  responded: 'Respondeu',
  approved: 'Aprovado',
  rejected: 'Reprovado',
};

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function fmtData(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

async function buscarCampanhas(): Promise<Campaign[]> {
  const res = await fetch('/api/secretaria/campaigns', { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Erro ao carregar');
  return (data.campaigns ?? []) as Campaign[];
}

function copiar(texto: string) {
  navigator.clipboard
    .writeText(texto)
    .then(() => toast.success('Link copiado!'))
    .catch(() => toast.error('Não consegui copiar. Selecione o texto na mão.'));
}

export default function SecretariaCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'all' | 'active' | 'draft' | 'closed'>('all');

  const [aberta, setAberta] = useState<Campaign | null>(null);
  const [tab, setTab] = useState<'responses' | 'targets'>('responses');
  const [targets, setTargets] = useState<Target[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [filtroResposta, setFiltroResposta] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderDraft, setBuilderDraft] = useState<CampaignDraft | undefined>();
  const [attachOpen, setAttachOpen] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState<Campaign | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);
  const [mudandoStatus, setMudandoStatus] = useState(false);
  const [instancias, setInstancias] = useState<{ id: string; name: string; status: string }[]>([]);

  // ── lista ─────────────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    try {
      setCampaigns(await buscarCampanhas());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  }, []);

  // O fetch mora fora do componente e o estado só é gravado no `.then` — é o
  // formato que o lint de efeitos pede.
  useEffect(() => {
    let vivo = true;
    buscarCampanhas()
      .then(lista => {
        if (!vivo) return;
        setCampaigns(lista);
        setLoading(false);
      })
      .catch(e => {
        if (!vivo) return;
        toast.error(e instanceof Error ? e.message : 'Erro ao carregar campanhas');
        setLoading(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Só para exibir o nome da instância no cabeçalho e avisar quando não há
  // nenhuma escolhida — sem isso o botão Enviar falha e ninguém sabe por quê.
  useEffect(() => {
    let vivo = true;
    fetch('/api/whatsapp/instances', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (vivo) setInstancias(d.instances ?? []);
      })
      .catch(() => {
        if (vivo) setInstancias([]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return campaigns.filter(c => {
      if (filtroStatus !== 'all' && c.status !== filtroStatus) return false;
      if (termo && !c.name.toLowerCase().includes(termo) && !(c.reason ?? '').toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [campaigns, busca, filtroStatus]);

  // ── detalhe ───────────────────────────────────────────────────────────────
  const carregarDetalhe = useCallback(async (campaignId: string) => {
    setCarregandoDetalhe(true);
    try {
      const [rTargets, rResponses] = await Promise.all([
        fetch(`/api/secretaria/campaigns/${campaignId}/targets`, { headers: authHeaders() }),
        fetch(`/api/secretaria/campaigns/${campaignId}/responses`, { headers: authHeaders() }),
      ]);
      const dTargets = await rTargets.json();
      const dResponses = await rResponses.json();
      setTargets(dTargets.targets ?? []);
      setResponses(dResponses.responses ?? []);
    } catch {
      toast.error('Erro ao carregar os dados da campanha');
    } finally {
      setCarregandoDetalhe(false);
    }
  }, []);

  const abrir = async (c: Campaign) => {
    setAberta(c);
    setTab('responses');
    setFiltroResposta('pending');
    await carregarDetalhe(c.id);
  };

  const recarregarTudo = async () => {
    await carregar();
    if (aberta) await carregarDetalhe(aberta.id);
  };

  // ── envio ─────────────────────────────────────────────────────────────────
  /**
   * Dispara e acompanha. O `/send` só prepara a fila; quem envia de fato é o
   * orquestrador do envio em massa, chamado aqui em laço com o `waitMs` que ele
   * devolve — é assim que o cooldown de 5 s por instância é respeitado.
   */
  const enviar = async () => {
    if (!aberta || enviando) return;

    const pendentes = targets.filter(t => t.status === 'pending' && t.phone);
    if (!pendentes.length) {
      toast.error('Ninguém pendente de envio. Anexe pessoas com telefone primeiro.');
      return;
    }
    if (!aberta.instance_id) {
      toast.error('Escolha a instância do WhatsApp na edição da campanha.');
      return;
    }

    setEnviando(true);
    setProgresso({ feito: 0, total: pendentes.length });
    try {
      const res = await fetch(`/api/secretaria/campaigns/${aberta.id}/send`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ instanceIds: [aberta.instance_id] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao iniciar o envio');

      toast.success(`Envio iniciado para ${data.total} pessoa(s).`);

      let feito = 0;
      // guarda contra laço infinito se o orquestrador nunca sinalizar `done`
      const maxTicks = data.total * 4 + 20;
      for (let i = 0; i < maxTicks; i++) {
        const tick = await fetch(data.processUrl, { method: 'POST', headers: authHeaders() });
        const tickData = await tick.json().catch(() => ({}));
        if (!tick.ok) throw new Error(tickData.error ?? 'Falha no envio');

        if (tickData.event) {
          feito++;
          setProgresso({ feito, total: data.total });
        }
        if (tickData.done) break;
        if (tickData.waitMs) await new Promise(r => setTimeout(r, Math.min(tickData.waitMs, 10000)));
      }

      // copia o resultado do envio em massa de volta para os alvos da campanha
      await fetch(`/api/secretaria/campaigns/${aberta.id}/send`, { headers: authHeaders() });
      toast.success('Envio concluído.');
      await recarregarTudo();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro no envio');
      await recarregarTudo();
    } finally {
      setEnviando(false);
      setProgresso(null);
    }
  };

  /** Encerra ou reabre a campanha. Encerrada, o link recusa novas respostas. */
  const mudarStatus = async (status: 'active' | 'closed') => {
    if (!aberta || mudandoStatus) return;
    setMudandoStatus(true);
    try {
      const res = await fetch(`/api/secretaria/campaigns/${aberta.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao mudar a situação');
      toast.success(
        status === 'closed'
          ? 'Campanha encerrada. O link não aceita mais respostas.'
          : 'Campanha reaberta. O link voltou a aceitar respostas.'
      );
      await recarregarTudo();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao mudar a situação');
    } finally {
      setMudandoStatus(false);
    }
  };

  const excluir = async () => {
    if (!confirmarExclusao) return;
    try {
      const res = await fetch(`/api/secretaria/campaigns/${confirmarExclusao.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao excluir');
      toast.success('Campanha excluída.');
      if (aberta?.id === confirmarExclusao.id) setAberta(null);
      setConfirmarExclusao(null);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir');
    }
  };

  const editar = (c: Campaign) => {
    setBuilderDraft({
      id: c.id,
      name: c.name,
      reason: c.reason ?? '',
      description: c.description ?? '',
      kind: c.kind,
      formSchema: c.form_schema ?? [],
      messageTemplate: c.message_template ?? '',
      imageUrl: c.image_url ?? '',
      videoUrl: c.video_url ?? '',
      linkUrl: c.link_url ?? '',
      instanceId: c.instance_id ?? '',
      requireIdentification: c.require_identification,
      closesAt: c.closes_at ? c.closes_at.slice(0, 10) : '',
      status: c.status,
      // já respondida = perguntas travadas; o servidor recusa a alteração de qualquer jeito
      schemaLocked: c.response_count > 0,
    });
    setBuilderOpen(true);
  };

  const respostasVisiveis = useMemo(
    () => (filtroResposta === 'all' ? responses : responses.filter(r => r.status === filtroResposta)),
    [responses, filtroResposta]
  );

  // ══════════════════════════════════════════════════════════ detalhe
  if (aberta) {
    const atual = campaigns.find(c => c.id === aberta.id) ?? aberta;
    const pendentesEnvio = targets.filter(t => t.status === 'pending' && t.phone).length;

    return (
      <div className="p-6">
        <button
          onClick={() => setAberta(null)}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" /> Todas as campanhas
        </button>

        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">{atual.name}</h1>
              {atual.reason ? <p className="text-xs text-slate-500">{atual.reason}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {STATUS_LABEL[atual.status]}
                </span>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  {atual.kind === 'form' ? 'Formulário' : 'Comunicado'}
                </span>
                {atual.closes_at ? <span className="text-slate-400">até {fmtData(atual.closes_at)}</span> : null}

                {/* A instância vive lá no fim do modal de edição; sem mostrá-la
                    aqui, descobrir que ela falta só acontecia ao clicar Enviar
                    e tomar o erro. */}
                {(() => {
                  const inst = instancias.find(i => i.id === atual.instance_id);
                  if (!atual.instance_id) {
                    return (
                      <button
                        onClick={() => editar(atual)}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300"
                      >
                        <TriangleAlert className="h-3 w-3" /> Sem instância de WhatsApp — escolher
                      </button>
                    );
                  }
                  return (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                        inst && inst.status !== 'connected'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Smartphone className="h-3 w-3" />
                      {inst ? inst.name : 'instância'}
                      {inst && inst.status !== 'connected' ? ' · desconectada' : ''}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => copiar(atual.shareUrl)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <ClipboardCopy className="h-4 w-4" /> Copiar link
              </button>
              <button
                onClick={() => setAttachOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
              >
                <UserPlus className="h-4 w-4" /> Anexar pessoas
              </button>
              <button
                onClick={enviar}
                disabled={enviando || !pendentesEnvio}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {enviando
                  ? `Enviando ${progresso?.feito ?? 0}/${progresso?.total ?? 0}`
                  : `Enviar (${pendentesEnvio})`}
              </button>
              <button
                onClick={() => editar(atual)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <Pencil className="h-4 w-4" /> Editar
              </button>
              {/* Encerrar é reversível: o link volta a aceitar resposta ao reabrir.
                  As respostas já recebidas continuam lá e podem ser aprovadas
                  normalmente — encerrar fecha a entrada, não a conferência. */}
              <button
                onClick={() => mudarStatus(atual.status === 'closed' ? 'active' : 'closed')}
                disabled={mudandoStatus}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
                  atual.status === 'closed'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                }`}
              >
                {mudandoStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : atual.status === 'closed' ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {atual.status === 'closed' ? 'Reabrir' : 'Encerrar'}
              </button>
              <button
                onClick={recarregarTudo}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metrica icone={<Users className="h-4 w-4" />} rotulo="Anexadas" valor={targets.length} />
            <Metrica icone={<Send className="h-4 w-4" />} rotulo="Enviadas" valor={targets.filter(t => t.sent_at).length} />
            <Metrica icone={<MessageCircle className="h-4 w-4" />} rotulo="Responderam" valor={responses.length} />
            <Metrica
              icone={<Clock className="h-4 w-4" />}
              rotulo="Aguardando conferência"
              valor={responses.filter(r => r.status === 'pending').length}
              destaque
            />
          </div>

          <p className="mt-3 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
            {atual.shareUrl}
          </p>
        </div>

        <div className="mb-3 flex gap-1 border-b border-slate-200 dark:border-slate-700">
          {(['responses', 'targets'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-bold ${
                tab === t
                  ? 'border-b-2 border-purple-600 text-purple-700 dark:text-purple-400'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t === 'responses' ? `Respostas (${responses.length})` : `Pessoas anexadas (${targets.length})`}
            </button>
          ))}
        </div>

        {carregandoDetalhe ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
          </div>
        ) : tab === 'responses' ? (
          <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-wrap gap-1 border-b border-slate-100 px-4 py-2.5 dark:border-slate-700">
              {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFiltroResposta(f)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                    filtroResposta === f
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {f === 'pending' ? 'Aguardando' : f === 'approved' ? 'Aprovadas' : f === 'rejected' ? 'Reprovadas' : 'Todas'}
                </button>
              ))}
            </div>
            {!respostasVisiveis.length ? (
              <p className="py-12 text-center text-xs text-slate-400">
                Nenhuma resposta {filtroResposta === 'pending' ? 'aguardando conferência' : 'aqui'}.
              </p>
            ) : (
              respostasVisiveis.map(r => (
                <button
                  key={r.id}
                  onClick={() => setResponseId(r.id)}
                  className="flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left text-xs last:border-0 hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700/40"
                >
                  <SituacaoResposta status={r.status} />
                  <span className="w-12 flex-shrink-0 font-mono text-slate-400">{r.rol ?? '—'}</span>
                  <span className="flex-1 truncate font-semibold text-slate-700 dark:text-slate-200">{r.name}</span>
                  <span className="hidden w-44 truncate text-slate-500 sm:block">{r.churchName ?? '—'}</span>
                  <span className="w-24 text-right text-slate-400">{fmtData(r.submitted_at)}</span>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            {!targets.length ? (
              <p className="py-12 text-center text-xs text-slate-400">
                Ninguém anexado ainda. Use <strong>Anexar pessoas</strong> — ou apenas compartilhe o link.
              </p>
            ) : (
              targets.map(t => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 border-b border-slate-50 px-4 py-2.5 text-xs last:border-0 dark:border-slate-700/50"
                >
                  <span className="w-12 flex-shrink-0 font-mono text-slate-400">{t.rol ?? '—'}</span>
                  <span className="flex-1 truncate font-medium text-slate-700 dark:text-slate-200">{t.name}</span>
                  <span className="hidden w-40 truncate text-slate-500 md:block">{t.church_name ?? '—'}</span>
                  <span className={`w-28 truncate ${t.phone ? 'text-slate-500' : 'text-amber-600'}`}>
                    {t.phone ?? 'sem telefone'}
                  </span>
                  <span
                    className={`w-24 text-right font-semibold ${
                      t.status === 'failed' ? 'text-red-500' : t.status === 'pending' ? 'text-slate-400' : 'text-emerald-600'
                    }`}
                    title={t.error ?? undefined}
                  >
                    {TARGET_LABEL[t.status] ?? t.status}
                  </span>
                  <button
                    onClick={() => copiar(t.link)}
                    title="Copiar o link individual desta pessoa"
                    className="text-slate-300 hover:text-purple-600"
                  >
                    <ClipboardCopy className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <AttachAudienceModal
          campaignId={atual.id}
          open={attachOpen}
          onClose={() => setAttachOpen(false)}
          onAttached={recarregarTudo}
        />
        <CampaignResponseDrawer responseId={responseId} onClose={() => setResponseId(null)} onReviewed={recarregarTudo} />
        <CampaignBuilderModal
          open={builderOpen}
          initial={builderDraft}
          onClose={() => setBuilderOpen(false)}
          onSaved={recarregarTudo}
        />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════ lista
  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-100">
            <Megaphone className="h-6 w-6 text-purple-600" /> Campanhas
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Formulários e comunicados enviados aos membros — a aprovação atualiza o cadastro.
          </p>
        </div>
        <button
          onClick={() => {
            setBuilderDraft({ ...EMPTY_DRAFT });
            setBuilderOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" /> Nova campanha
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou motivo..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        {(['all', 'active', 'draft', 'closed'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              filtroStatus === s ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
            }`}
          >
            {s === 'all' ? 'Todas' : STATUS_LABEL[s]}
          </button>
        ))}
        <button
          onClick={carregar}
          className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-purple-600" />
        </div>
      ) : !visiveis.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-600">
          <Megaphone className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Nenhuma campanha ainda.</p>
          <p className="mt-1 text-xs text-slate-400">
            Crie uma para pedir a foto atualizada, confirmar endereços ou mandar um comunicado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visiveis.map(c => (
            <div
              key={c.id}
              className="group rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <button onClick={() => abrir(c)} className="min-w-0 flex-1 text-left">
                  <h3 className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{c.name}</h3>
                  <p className="truncate text-[11px] text-slate-400">{c.reason ?? c.description ?? '—'}</p>
                </button>
                <button
                  onClick={() => setConfirmarExclusao(c)}
                  className="p-1 text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5 text-[10px]">
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold ${
                    c.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : c.status === 'draft'
                        ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                        : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {STATUS_LABEL[c.status]}
                </span>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  {c.kind === 'form' ? `${(c.form_schema ?? []).length} pergunta(s)` : 'Comunicado'}
                </span>
              </div>

              <div className="mb-3 flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {c.target_count}
                </span>
                <span className="flex items-center gap-1">
                  <Send className="h-3.5 w-3.5" /> {c.sent_count}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" /> {c.response_count}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => abrir(c)}
                  className="flex-1 rounded-lg bg-slate-100 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200"
                >
                  Abrir
                </button>
                <button
                  onClick={() => copiar(c.shareUrl)}
                  title="Copiar link de partilha"
                  className="rounded-lg border border-slate-200 px-3 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                >
                  <ClipboardCopy className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CampaignBuilderModal
        open={builderOpen}
        initial={builderDraft}
        onClose={() => setBuilderOpen(false)}
        onSaved={async id => {
          await carregar();
          const criada = (await buscarCampanhas()).find(c => c.id === id);
          if (criada) abrir(criada);
        }}
      />

      <ConfirmDialog
        open={!!confirmarExclusao}
        title="Excluir campanha"
        message={`"${confirmarExclusao?.name}" será apagada junto com as pessoas anexadas e todas as respostas. Os dados já aprovados continuam no cadastro dos membros.`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={excluir}
        onCancel={() => setConfirmarExclusao(null)}
      />
    </div>
  );
}

function Metrica({
  icone,
  rotulo,
  valor,
  destaque,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: number;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        destaque && valor > 0
          ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
          : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-700/40'
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {icone} {rotulo}
      </div>
      <p className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">{valor}</p>
    </div>
  );
}

function SituacaoResposta({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  if (status === 'approved') return <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />;
  if (status === 'rejected') return <XCircle className="h-4 w-4 flex-shrink-0 text-amber-500" />;
  return <Clock className="h-4 w-4 flex-shrink-0 text-slate-300" />;
}
