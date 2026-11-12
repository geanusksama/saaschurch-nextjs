/**
 * Caixa do WhatsApp → aba "Relatórios": painel do atendimento do agente de IA
 * por período (e por departamento), lista de conversas resumida/expandida e
 * relatório escrito pela IA. Dados: GET/POST /api/whatsapp/relatorios
 * (src/lib/relatorioAtendimento.ts). Abre vazio e só busca no botão Buscar.
 */
import { useMemo, useState } from 'react'
import {
  BarChart3, Bot, ChevronDown, ChevronRight, Copy, Loader2, Lock, MessageCircle, Mic, Sparkles,
  Users, Church, HeartHandshake, Home, CalendarCheck, UserPlus, HandHelping,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { apiBase } from '../../../lib/apiBase'
import { Permissao } from '../../../lib/permissoes/Permissao'
import { BotaoBuscar, AvisoDefinaFiltros } from '../../app-ui/BotaoBuscar'
import type { Relatorio, ConversaRelatorio, Contagem } from '@/lib/relatorioAtendimento'

function cabecalhos(): Record<string, string> {
  const token = localStorage.getItem('mrm_token')
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

const hojeBrt = () => new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)
const somarDias = (dia: string, n: number) => new Date(new Date(`${dia}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10)
const dataBr = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')
const dataHoraBr = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const simNao = (v: boolean | null) => (v === true ? 'Sim' : v === false ? 'Não' : '—')

function Kpi({ icone: Icone, rotulo, valor, detalhe }: { icone: typeof Users; rotulo: string; valor: number; detalhe?: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400"><Icone className="w-4 h-4" />{rotulo}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{valor}</div>
      {detalhe && <div className="text-xs text-slate-500 dark:text-slate-400">{detalhe}</div>}
    </div>
  )
}

function Barras({ titulo, itens }: { titulo: string; itens: Contagem[] }) {
  const max = Math.max(1, ...itens.map(i => i.total))
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">{titulo}</h4>
      {itens.length ? (
        <ul className="space-y-2">
          {itens.map(i => (
            <li key={i.rotulo} className="text-xs">
              <div className="flex justify-between gap-2 text-slate-600 dark:text-slate-300">
                <span className="truncate">{i.rotulo}</span><span className="tabular-nums font-semibold">{i.total}</span>
              </div>
              <div className="h-2 mt-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(i.total / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-slate-400">Sem dados no período.</p>}
    </div>
  )
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{rotulo}</dt>
      <dd className="text-sm text-slate-800 dark:text-slate-100">{valor || '—'}</dd>
    </div>
  )
}

export default function RelatoriosAtendimento({ onAbrirConversa }: { onAbrirConversa: (id: string) => void }) {
  const [de, setDe] = useState(() => somarDias(hojeBrt(), -6))
  const [ate, setAte] = useState(hojeBrt)
  const [departamento, setDepartamento] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [rel, setRel] = useState<Relatorio | null>(null)
  const [departamentos, setDepartamentos] = useState<string[]>([])
  const [expandidas, setExpandidas] = useState(false)
  const [abertas, setAbertas] = useState<Set<string>>(new Set())
  const [resumos, setResumos] = useState<Record<string, string>>({})
  const [resumindo, setResumindo] = useState<string | null>(null)
  const [analise, setAnalise] = useState('')
  const [analisando, setAnalisando] = useState(false)

  const atalho = (dias: number | 'mes') => {
    const hoje = hojeBrt()
    setAte(hoje)
    setDe(dias === 'mes' ? `${hoje.slice(0, 8)}01` : somarDias(hoje, -(dias - 1)))
  }

  const buscar = async () => {
    setBuscando(true); setAnalise('')
    try {
      const sp = new URLSearchParams({ de, ate, ...(departamento ? { departamento } : {}) })
      const r = await fetch(`${apiBase}/whatsapp/relatorios?${sp}`, { headers: cabecalhos(), cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Falha ao buscar')
      setRel(d)
      if (!departamento) setDepartamentos(d.departamentos ?? [])
      setAbertas(new Set())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao buscar')
    } finally {
      setBuscando(false)
    }
  }

  const gerarAnalise = async () => {
    setAnalisando(true)
    try {
      const r = await fetch(`${apiBase}/whatsapp/relatorios`, {
        method: 'POST', headers: cabecalhos(), cache: 'no-store',
        body: JSON.stringify({ acao: 'analise', de, ate, departamento }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Falha ao gerar')
      setAnalise(d.analise || '')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao gerar')
    } finally {
      setAnalisando(false)
    }
  }

  const resumir = async (id: string) => {
    setResumindo(id)
    try {
      const r = await fetch(`${apiBase}/whatsapp/relatorios`, {
        method: 'POST', headers: cabecalhos(), cache: 'no-store', body: JSON.stringify({ acao: 'resumo', conversationId: id }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Falha ao resumir')
      setResumos(s => ({ ...s, [id]: d.resumo }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao resumir')
    } finally {
      setResumindo(null)
    }
  }

  const copiarAnalise = async () => {
    try { await navigator.clipboard.writeText(analise); toast.success('Relatório copiado.') } catch { toast.error('Não foi possível copiar.') }
  }

  const alternar = (id: string) => setAbertas(s => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  const porDia = useMemo(() => (rel?.porDia ?? []).map(d => ({ dia: dataBr(d.rotulo).slice(0, 5), total: d.total })), [rel])
  const t = rel?.totais
  const inputCls = 'rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm'

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
      {/* Filtros */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-500">De<input type="date" value={de} max={ate} onChange={e => setDe(e.target.value)} className={`${inputCls} block mt-1`} /></label>
        <label className="text-xs text-slate-500">Até<input type="date" value={ate} min={de} onChange={e => setAte(e.target.value)} className={`${inputCls} block mt-1`} /></label>
        <label className="text-xs text-slate-500">Departamento
          <select value={departamento} onChange={e => setDepartamento(e.target.value)} className={`${inputCls} block mt-1 min-w-[200px]`}>
            <option value="">Todos</option>
            {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <div className="flex gap-1 text-xs">
          <button type="button" onClick={() => atalho(7)} className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">7 dias</button>
          <button type="button" onClick={() => atalho('mes')} className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">Este mês</button>
          <button type="button" onClick={() => atalho(30)} className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">30 dias</button>
        </div>
        <div className="ml-auto"><BotaoBuscar onClick={buscar} buscando={buscando} /></div>
      </div>

      {!rel ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"><AvisoDefinaFiltros /></div>
      ) : (
        <>
          {/* Indicadores */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            <Kpi icone={MessageCircle} rotulo="Atendimentos" valor={t!.conversas} detalhe={`${t!.viaQr} pelo QR / site`} />
            <Kpi icone={Church} rotulo="De outra igreja" valor={t!.deOutraIgreja} detalhe={`${t!.semIgrejaAnterior} sem igreja anterior`} />
            <Kpi icone={HandHelping} rotulo="Já abordados" valor={t!.jaAbordados} detalhe={`${t!.naoAbordados} ninguém abordou`} />
            <Kpi icone={Home} rotulo="Encaminhados a GF" valor={t!.encaminhadosGF} detalhe={`${t!.naoConhecemGF} não conheciam GF`} />
            <Kpi icone={CalendarCheck} rotulo="Querem visita" valor={t!.querVisita} />
            <Kpi icone={UserPlus} rotulo="Quero ser Membro" valor={t!.queroSerMembro} />
            <Kpi icone={HeartHandshake} rotulo="Pedidos de oração" valor={t!.pedidosOracao} />
            <Kpi icone={Users} rotulo="Pediram atendimento humano" valor={t!.pediuHumano} />
            <Kpi icone={Mic} rotulo="Falaram por áudio" valor={t!.comAudio} />
            <Kpi icone={Lock} rotulo="Assuntos reservados" valor={t!.reservados} detalhe="só a contagem" />
          </div>

          {/* Gráficos */}
          <div className="grid lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Atendimentos por dia</h4>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porDia} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [v, 'Atendimentos']} />
                    <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <Barras titulo="Tempo na Sede" itens={rel.porTempoNaSede} />
            <Barras titulo="Interesse por departamento" itens={rel.porDepartamento} />
            <Barras titulo="Grupos Familiares" itens={rel.porGf} />
            <Barras titulo="Teor das conversas" itens={rel.porAssunto} />
            <Barras titulo="Faixa etária" itens={rel.porFaixaEtaria} />
          </div>

          {/* Relatório da IA */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" /> Relatório {departamento ? `de ${departamento}` : 'geral'} pela IA
              </h4>
              <div className="flex gap-2">
                {analise && (
                  <Permissao chave="whatsapp_inbox.whats_app_inbox.relatorio_ia" rotulo="Relatório com IA — Whats App Inbox" herda="whatsapp_inbox.view">
                    <button type="button" onClick={copiarAnalise} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> Copiar</button>
                  </Permissao>
                )}
                <Permissao chave="whatsapp_inbox.whats_app_inbox.relatorio_ia" rotulo="Relatório com IA — Whats App Inbox" herda="whatsapp_inbox.view">
                  <button type="button" onClick={gerarAnalise} disabled={analisando || !rel.conversas.length}
                    className="px-3 py-1.5 text-xs rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1">
                    {analisando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Gerar relatório com IA
                  </button>
                </Permissao>
              </div>
            </div>
            {analise
              ? <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{analise}</pre>
              : <p className="mt-2 text-xs text-slate-500">A IA analisa os atendimentos do período (sem nomes e sem assuntos reservados) e escreve o relatório para a liderança.</p>}
          </div>

          {/* Conversas */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Conversas do período ({rel.conversas.length})</h4>
              <div className="flex text-xs rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
                <button type="button" onClick={() => setExpandidas(false)} className={`px-3 py-1.5 ${!expandidas ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}`}>Resumidas</button>
                <button type="button" onClick={() => setExpandidas(true)} className={`px-3 py-1.5 ${expandidas ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}`}>Expandidas</button>
              </div>
            </div>
            {rel.conversas.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Nenhum atendimento no período.</p>}
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {rel.conversas.map((c: ConversaRelatorio) => {
                const aberta = expandidas || abertas.has(c.id)
                return (
                  <li key={c.id} className="px-4 py-3">
                    <button type="button" onClick={() => !c.reservado && alternar(c.id)} className="w-full flex items-center gap-3 text-left" disabled={c.reservado}>
                      {c.reservado ? <Lock className="w-4 h-4 text-amber-500 shrink-0" /> : aberta ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 text-sm">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{c.nome}</span>
                          <span className="text-xs text-slate-400">{dataHoraBr(c.inicio)}</span>
                          {c.audios > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 flex items-center gap-0.5"><Mic className="w-3 h-3" />{c.audios}</span>}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {c.reservado ? 'Visível só para o pastor responsável' : [c.assunto, ...c.interesses, ...c.gfs.map(g => `GF ${g}`)].filter(Boolean).join(' · ') || 'Sem anotações do agente'}
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0">{c.origem}</span>
                    </button>
                    {aberta && !c.reservado && (
                      <div className="mt-3 ml-7 space-y-3">
                        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <Campo rotulo="Telefone" valor={c.telefone} />
                          <Campo rotulo="Igreja anterior" valor={c.igrejaAnterior} />
                          <Campo rotulo="Tempo na Sede" valor={c.tempoNaSede} />
                          <Campo rotulo="Já foi abordado(a)" valor={simNao(c.jaFoiAbordado)} />
                          <Campo rotulo="Conhece GF" valor={simNao(c.conheceGF)} />
                          <Campo rotulo="GF" valor={c.gfs.join(', ')} />
                          <Campo rotulo="Interesses" valor={c.interesses.join(', ')} />
                          <Campo rotulo="Encaminhado a" valor={c.encaminhados.join(', ')} />
                          <Campo rotulo="Faixa etária" valor={c.faixaEtaria} />
                          <Campo rotulo="Perfil" valor={c.perfil} />
                          <Campo rotulo="Bairro" valor={c.bairro} />
                          <Campo rotulo="Visita" valor={c.querVisita ? `Sim${c.dataVisita ? ` — ${dataBr(c.dataVisita)}` : ''}` : simNao(c.querVisita)} />
                          <Campo rotulo="Quero ser Membro" valor={c.queroSerMembro ? 'Registrado' : '—'} />
                          <Campo rotulo="Pedido de oração" valor={c.pedidoOracao ? 'Sim' : '—'} />
                          <Campo rotulo="Etapa" valor={c.etapa} />
                          <Campo rotulo="Agente" valor={c.agente} />
                        </dl>
                        {(resumos[c.id] || c.resumoIa) && (
                          <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap bg-slate-50 dark:bg-slate-900 rounded-lg p-3">{resumos[c.id] || c.resumoIa}</p>
                        )}
                        <div className="flex gap-2">
                          <Permissao chave="whatsapp_inbox.whats_app_inbox.relatorio_ia" rotulo="Relatório com IA — Whats App Inbox" herda="whatsapp_inbox.view">
                            <button type="button" onClick={() => resumir(c.id)} disabled={resumindo === c.id}
                              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-1 disabled:opacity-50">
                              {resumindo === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />} {resumos[c.id] || c.resumoIa ? 'Refazer resumo (IA)' : 'Resumir conversa (IA)'}
                            </button>
                          </Permissao>
                          <button type="button" onClick={() => onAbrirConversa(c.id)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-1">
                            <MessageCircle className="w-3.5 h-3.5" /> Abrir conversa
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
