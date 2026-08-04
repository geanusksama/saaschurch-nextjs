/**
 * Distribuição — liga cada contato importado ao GF mais perto da casa dele.
 *
 * A tela tem duas partes:
 *  - o botão "Analisar conversas e arquivos", que procura o endereço de quem
 *    ainda não foi analisado (na planilha e, quando não houver, na conversa de
 *    WhatsApp via IA), coloca no mapa e escolhe o GF mais próximo. O resultado
 *    aparece num modal com o que foi encontrado;
 *  - a lista de pares: a PESSOA de um lado, o GF do outro e o botão CONECTAR
 *    no meio. Dá para marcar vários e conectar de uma vez.
 *
 * Só aparece quem AINDA NÃO está em GF — e isso considera as duas formas de
 * estar num: a conexão feita por esta tela (`cell_group_id` da linha
 * importada) e o vínculo de membro no cadastro (`cell_group_members`), porque
 * a mesma pessoa pode ter sido anexada pela tela do GF.
 *
 * A aba "Já conectados" existe para desfazer: mesma lista, com o botão
 * invertido.
 *
 * Conectar é sempre um clique humano: ele chama a mesma rota do botão "Anexar"
 * da tela do GF, que manda o contato e o resumo da conversa no WhatsApp do
 * líder e passa a cobrar dele o acompanhamento daquela pessoa. Nada disso
 * acontece sozinho — a análise só sugere.
 */

import { useEffect, useState } from 'react';
import {
  Loader2, MapPin, Users, Sparkles, Link2, AlertTriangle, X, RefreshCw,
  FileSpreadsheet, MessageSquare, Phone, CheckCircle2, Search, Unlink, CheckSquare, Square,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiBase } from '../../lib/apiBase';
import { ConfirmDialog } from '../../components/app-ui/shared/ConfirmDialog';

interface Gf {
  id: string;
  name: string;
  color: string | null;
  photo: string | null;
  cellType: string | null;
  meetingDay: string | null;
  meetingTime: string | null;
  endereco: string;
  latitude: number;
  longitude: number;
  leaderName: string | null;
  leaderPhone: string | null;
}

interface Par {
  importRowId: string;
  batchId: string;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  cep: string | null;
  origemEndereco: 'arquivo' | 'conversa' | null;
  gf: Gf | null;
  distanciaKm: number | null;
  observacao: string | null;
  conectado?: boolean;
}

interface Resumo {
  analisadas: number;
  comEndereco: number;
  doArquivo: number;
  daConversa: number;
  comSugestao: number;
  semEndereco: number;
  semCoordenada: number;
  restantes: number;
  pares: Par[];
}

interface Batch {
  id: string;
  filename: string | null;
  created_at: string;
  total_rows: number | null;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('mrm_token') ?? '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const ORIGEM_LABEL: Record<string, { texto: string; Icon: typeof FileSpreadsheet }> = {
  arquivo: { texto: 'endereço da planilha', Icon: FileSpreadsheet },
  conversa: { texto: 'endereço achado na conversa', Icon: MessageSquare },
};

export default function PastoralDistribuicao() {
  const [pares, setPares] = useState<Par[]>([]);
  const [gfs, setGfs] = useState<Gf[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState('');
  const [busca, setBusca] = useState('');

  const [carregando, setCarregando] = useState(true);
  const [analisando, setAnalisando] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [conectando, setConectando] = useState('');
  /** Pendência de transferência: a pessoa já está em outro GF. */
  const [transferir, setTransferir] = useState<{ par: Par; mensagem: string } | null>(null);
  /** Troca manual do GF sugerido, quando quem olha discorda da distância. */
  const [trocando, setTrocando] = useState<Par | null>(null);
  /** false = fila de quem espera; true = quem já foi conectado (para desfazer) */
  const [verConectados, setVerConectados] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  /** progresso do lote: cada item é uma chamada, e cada uma manda um WhatsApp */
  const [lote, setLote] = useState<{ feitos: number; total: number } | null>(null);

  /**
   * A busca das sugestões mora no efeito, e recarregar é só incrementar o
   * contador — assim nenhum setState roda de forma síncrona no corpo do
   * efeito, e a resposta que chega atrasada de um filtro antigo é descartada.
   */
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const q = new URLSearchParams();
        if (batchId) q.set('batchId', batchId);
        if (verConectados) q.set('conectados', '1');
        const res = await fetch(`${apiBase}/pastoral/distribuicao?${q}`, { headers: authHeaders() });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar as sugestões.');
        if (!vivo) return;
        setPares(data.pares ?? []);
        setGfs(data.gfs ?? []);
        setMarcados(new Set());
      } catch (err) {
        if (vivo) toast.error(err instanceof Error ? err.message : 'Erro ao carregar as sugestões.');
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [batchId, recarga, verConectados]);

  const recarregar = () => {
    setCarregando(true);
    setRecarga((n) => n + 1);
  };

  useEffect(() => {
    fetch(`${apiBase}/whatsapp/imports`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setBatches(d.batches ?? []))
      .catch(() => {});
  }, []);

  async function analisar() {
    setAnalisando(true);
    try {
      const res = await fetch(`${apiBase}/pastoral/distribuicao/analisar`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ batchId: batchId || null, limite: 20 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível concluir a análise.');
      setResumo(data);
      recarregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha na análise.');
    } finally {
      setAnalisando(false);
    }
  }

  /** Conectar = o mesmo "Anexar" da tela do GF: vínculo + WhatsApp ao líder. */
  async function conectar(par: Par, gfId?: string, force = false, silencioso = false) {
    const destino = gfId ?? par.gf?.id;
    if (!destino) return;
    setConectando(par.importRowId);
    try {
      const res = await fetch(`${apiBase}/cell-groups/${destino}/members`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ source: 'import', importRowId: par.importRowId, force }),
      });
      const data = await res.json().catch(() => ({}));

      // No lote, transferência não abre diálogo: seria uma pergunta por
      // pessoa no meio da fila. A linha falha e aparece no resumo do fim.
      if (res.status === 409 && data.currentCellGroup) {
        if (silencioso) throw new Error(String(data.error ?? 'já está em outro GF'));
        setTransferir({ par, mensagem: String(data.error ?? '') });
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Erro ao conectar.');

      setPares((prev) => prev.filter((p) => p.importRowId !== par.importRowId));
      if (!silencioso) {
        toast.success(`${par.nome} foi conectado(a). O líder já recebeu o contato e o resumo no WhatsApp.`);
      }
    } catch (err) {
      if (silencioso) throw err;
      toast.error(err instanceof Error ? err.message : 'Erro ao conectar.');
    } finally {
      setConectando('');
      setTrocando(null);
    }
  }

  /** Desfaz a conexão: a pessoa volta para a fila de distribuição. */
  async function desconectar(par: Par) {
    if (!par.gf) return;
    const res = await fetch(`${apiBase}/cell-groups/${par.gf.id}/members`, {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ source: 'import', importRowId: par.importRowId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Erro ao desconectar.');
    }
  }

  /**
   * Roda a ação em cada marcado, UM POR VEZ.
   *
   * Em série de propósito: cada conexão dispara um WhatsApp para o líder, e
   * disparar dez em paralelo é o caminho mais curto para a instância ser
   * bloqueada por flood. O contador mostra o andamento.
   */
  async function emLote(acao: 'conectar' | 'desconectar') {
    const alvos = pares.filter((p) => marcados.has(p.importRowId) && p.gf);
    if (!alvos.length) return;

    setLote({ feitos: 0, total: alvos.length });
    let ok = 0;
    const falhas: string[] = [];

    for (const [i, par] of alvos.entries()) {
      try {
        if (acao === 'conectar') await conectar(par, undefined, false, true);
        else await desconectar(par);
        ok++;
      } catch (err) {
        falhas.push(`${par.nome}: ${err instanceof Error ? err.message : 'erro'}`);
      }
      setLote({ feitos: i + 1, total: alvos.length });
    }

    setLote(null);
    setMarcados(new Set());
    recarregar();

    if (ok) {
      toast.success(
        acao === 'conectar'
          ? `${ok} ${ok === 1 ? 'pessoa conectada' : 'pessoas conectadas'}. Os líderes já receberam os contatos no WhatsApp.`
          : `${ok} ${ok === 1 ? 'conexão desfeita' : 'conexões desfeitas'}.`,
      );
    }
    if (falhas.length) toast.error(`${falhas.length} não deram certo: ${falhas.slice(0, 3).join(' · ')}`);
  }

  const todosMarcados = pares.length > 0 && marcados.size === pares.length;
  const alternarTodos = () => setMarcados(todosMarcados ? new Set() : new Set(pares.map((p) => p.importRowId)));
  const alternarUm = (id: string) =>
    setMarcados((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  const visiveis = pares.filter((p) => {
    if (!busca.trim()) return true;
    const alvo = `${p.nome} ${p.telefone ?? ''} ${p.endereco ?? ''} ${p.gf?.name ?? ''}`.toLowerCase();
    return alvo.includes(busca.trim().toLowerCase());
  });

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">

        {/* Cabeçalho + ação */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Distribuição por proximidade</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Procuramos o endereço de cada contato na planilha e na conversa, e indicamos o GF mais perto da casa dele.
            </p>
          </div>
          <button
            onClick={analisar}
            disabled={analisando}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold"
          >
            {analisando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {analisando ? 'Analisando…' : 'Analisar conversas e arquivos'}
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 min-w-[220px]"
          >
            <option value="">Todas as listas importadas</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.filename ?? 'Sem nome'} · {new Date(b.created_at).toLocaleDateString('pt-BR')} · {b.total_rows ?? 0} linhas
              </option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar pessoa, endereço ou GF..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800"
            />
          </div>
          <button
            onClick={recarregar}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Recarregar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Fila x já conectados. A fila mostra SÓ quem ainda não está em GF
            nenhum — nem pela linha importada, nem pelo cadastro de membro. */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit mb-4">
          {[
            { valor: false, rotulo: 'Esperando GF' },
            { valor: true, rotulo: 'Já conectados' },
          ].map((aba) => (
            <button
              key={String(aba.valor)}
              onClick={() => setVerConectados(aba.valor)}
              className={`h-8 px-4 rounded-lg text-sm font-semibold transition-colors
                ${verConectados === aba.valor
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'}`}
            >
              {aba.rotulo}
            </button>
          ))}
        </div>

        {/* Ações em lote */}
        {!!pares.length && (
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <button
              onClick={alternarTodos}
              className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900"
            >
              {todosMarcados ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
            </button>

            <span className="text-xs text-slate-500">
              {marcados.size} de {pares.length} {pares.length === 1 ? 'marcado' : 'marcados'}
            </span>

            <div className="ml-auto flex items-center gap-2">
              {lote && (
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {lote.feitos} de {lote.total}
                </span>
              )}
              {verConectados ? (
                <button
                  onClick={() => emLote('desconectar')}
                  disabled={!marcados.size || !!lote}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-sm font-bold"
                >
                  <Unlink className="w-4 h-4" />
                  Desconectar marcados
                </button>
              ) : (
                <button
                  onClick={() => emLote('conectar')}
                  disabled={!marcados.size || !!lote}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-bold"
                >
                  <Link2 className="w-4 h-4" />
                  Conectar marcados
                </button>
              )}
            </div>
          </div>
        )}

        {carregando ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
        ) : !visiveis.length ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center">
            <MapPin className="w-8 h-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500">
              {pares.length
                ? 'Nenhum par com esse filtro.'
                : verConectados
                  ? 'Ninguém foi conectado por esta tela ainda.'
                  : 'Ninguém esperando GF. Toque em "Analisar conversas e arquivos" para procurar endereços nos contatos importados.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visiveis.map((par) => (
              <div
                key={par.importRowId}
                className={`rounded-2xl border bg-white dark:bg-slate-900 p-4 transition-colors
                  ${marcados.has(par.importRowId)
                    ? 'border-emerald-400 dark:border-emerald-600'
                    : 'border-slate-200 dark:border-slate-700'}`}
              >
                <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto_1fr] gap-4 items-center">

                  {/* marcar */}
                  <button
                    onClick={() => alternarUm(par.importRowId)}
                    className="text-slate-400 hover:text-emerald-600 self-start md:self-center"
                    title={marcados.has(par.importRowId) ? 'Desmarcar' : 'Marcar'}
                  >
                    {marcados.has(par.importRowId)
                      ? <CheckSquare className="w-5 h-5 text-emerald-600" />
                      : <Square className="w-5 h-5" />}
                  </button>

                  {/* PESSOA */}
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 mb-1">Pessoa</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{par.nome}</p>
                    {par.telefone && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {par.telefone}
                      </p>
                    )}
                    {par.endereco && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1 mt-1">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0" /> {par.endereco}
                      </p>
                    )}
                    {par.origemEndereco && (() => {
                      const o = ORIGEM_LABEL[par.origemEndereco];
                      return (
                        <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                          <o.Icon className="w-3 h-3" /> {o.texto}
                        </span>
                      );
                    })()}
                  </div>

                  {/* CONECTAR */}
                  <div className="flex flex-col items-center gap-1.5">
                    {verConectados ? (
                      <button
                        onClick={async () => {
                          setConectando(par.importRowId);
                          try {
                            await desconectar(par);
                            setPares((prev) => prev.filter((x) => x.importRowId !== par.importRowId));
                            toast.success(`${par.nome} saiu do GF e voltou para a fila.`);
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Erro ao desconectar.');
                          } finally {
                            setConectando('');
                          }
                        }}
                        disabled={conectando === par.importRowId || !par.gf}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-sm font-bold shadow-sm"
                      >
                        {conectando === par.importRowId
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Unlink className="w-4 h-4" />}
                        Desconectar
                      </button>
                    ) : (
                      <button
                        onClick={() => conectar(par)}
                        disabled={conectando === par.importRowId || !par.gf}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-bold shadow-sm"
                      >
                        {conectando === par.importRowId
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Link2 className="w-4 h-4" />}
                        Conectar
                      </button>
                    )}
                    {par.distanciaKm !== null && (
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                        {par.distanciaKm.toFixed(1).replace('.', ',')} km
                      </span>
                    )}
                    {!verConectados && (
                      <button
                        onClick={() => setTrocando(par)}
                        className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                      >
                        trocar de GF
                      </button>
                    )}
                  </div>

                  {/* GF */}
                  <div className="min-w-0 md:text-right">
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 mb-1">
                      {verConectados ? 'GF atual' : 'GF mais próximo'}
                    </p>
                    {par.gf ? (
                      <>
                        <div className="flex md:justify-end items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: par.gf.color || '#8b5cf6' }} />
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{par.gf.name}</p>
                        </div>
                        {par.gf.leaderName && (
                          <p className="text-xs text-slate-500 mt-0.5 flex md:justify-end items-center gap-1">
                            <Users className="w-3 h-3" /> {par.gf.leaderName}
                          </p>
                        )}
                        {[par.gf.meetingDay, par.gf.meetingTime].filter(Boolean).length > 0 && (
                          <p className="text-xs text-slate-500">
                            {[par.gf.meetingDay, par.gf.meetingTime].filter(Boolean).join(' às ')}
                          </p>
                        )}
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{par.gf.endereco}</p>
                      </>
                    ) : (
                      <p className="text-sm text-amber-600 flex md:justify-end items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> sem GF indicado
                      </p>
                    )}
                  </div>
                </div>

                {par.observacao && (
                  <p className="mt-3 text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                    {par.observacao}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal do resultado da análise ── */}
      {resumo && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">O que a análise encontrou</h3>
              <button onClick={() => setResumo(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { valor: resumo.analisadas, rotulo: 'contatos analisados' },
                  { valor: resumo.comEndereco, rotulo: 'com endereço' },
                  { valor: resumo.comSugestao, rotulo: 'com GF indicado' },
                ].map((c) => (
                  <div key={c.rotulo} className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{c.valor}</p>
                    <p className="text-[11px] text-slate-500 leading-tight">{c.rotulo}</p>
                  </div>
                ))}
              </div>

              <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1.5">
                <li className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                  {resumo.doArquivo} com endereço já na planilha importada
                </li>
                <li className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-400" />
                  {resumo.daConversa} com endereço achado na conversa de WhatsApp
                </li>
                {resumo.semEndereco > 0 && (
                  <li className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="w-4 h-4" />
                    {resumo.semEndereco} sem endereço em lugar nenhum
                  </li>
                )}
                {resumo.semCoordenada > 0 && (
                  <li className="flex items-center gap-2 text-amber-700">
                    <MapPin className="w-4 h-4" />
                    {resumo.semCoordenada} com endereço que não foi localizado no mapa
                  </li>
                )}
              </ul>

              {resumo.restantes > 0 && (
                <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 p-3 text-sm text-purple-800 dark:text-purple-200">
                  Ainda faltam <b>{resumo.restantes}</b> contatos para analisar. Cada rodada olha um lote por vez
                  para não estourar o tempo — toque em Analisar de novo para continuar.
                </div>
              )}

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Nada foi anexado ainda: a análise só indica. Quem conecta é você, no botão Conectar de cada par —
                é ele que manda o contato e o resumo da conversa para o WhatsApp do líder.
              </p>

              <button
                onClick={() => setResumo(null)}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold"
              >
                Ver os pares
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Trocar o GF sugerido ── */}
      {trocando && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Escolher outro GF</h3>
                <p className="text-xs text-slate-500">{trocando.nome}</p>
              </div>
              <button onClick={() => setTrocando(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {gfs.map((g) => (
                <button
                  key={g.id}
                  onClick={() => conectar(trocando, g.id)}
                  disabled={conectando === trocando.importRowId}
                  className="w-full text-left p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-emerald-400 disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: g.color || '#8b5cf6' }} />
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{g.name}</p>
                    {g.id === trocando.gf?.id && (
                      <span className="ml-auto text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> indicado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{g.endereco}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!transferir}
        title="Transferir de GF?"
        message={
          transferir
            ? `${transferir.mensagem}. Ao confirmar, a pessoa sai do grupo atual e passa a fazer parte deste, e o novo líder recebe o contato no WhatsApp.`
            : undefined
        }
        confirmLabel="Transferir"
        variant="warning"
        onConfirm={() => {
          const pendente = transferir;
          setTransferir(null);
          if (pendente) conectar(pendente.par, undefined, true);
        }}
        onCancel={() => setTransferir(null)}
      />
    </div>
  );
}
