/**
 * Caixa do WhatsApp → aba "Relatórios": painel do atendimento por período (e
 * por departamento), com a análise das conversas feita pela IA.
 *
 *  - indicadores e gráficos (pizza, linha, barras) — clicar em qualquer um
 *    abre a lista das conversas daquele grupo, com Exportar e Imprimir;
 *  - lista de conversas resumida/expandida e relatório escrito pela IA.
 *
 * Dados: GET/POST /api/whatsapp/relatorios (src/lib/relatorioAtendimento.ts).
 * Abre vazio e só busca no botão Buscar.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3, Bot, ChevronDown, ChevronRight, Copy, Download, Loader2, Lock, MessageCircle, Mic, Printer, Sparkles,
  Users, Church, HeartHandshake, Home, CalendarCheck, UserPlus, HandHelping, X,
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts'
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
const diaBrt = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 10)
const dataBr = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')
const dataHoraBr = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const simNao = (v: boolean | null) => (v === true ? 'Sim' : v === false ? 'Não' : '—')
const rotuloSexo = (s: string) => (s === 'M' ? 'Homens' : s === 'F' ? 'Mulheres' : 'Não informado')
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// paleta categórica (mesma ordem em todos os gráficos)
const CORES = ['#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#ec4899', '#84cc16', '#64748b', '#14b8a6', '#a855f7']
const COR_SEXO: Record<string, string> = { Homens: '#0ea5e9', Mulheres: '#ec4899', 'Não informado': '#94a3b8' }

/** O que está aberto na janela de detalhe: título + quais conversas entram. */
interface Detalhe { titulo: string; filtro: (c: ConversaRelatorio) => boolean }

function Cartao({ titulo, icone: Icone, children, className = '' }: { titulo: string; icone?: typeof Users; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 ${className}`}>
      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">{Icone && <Icone className="w-4 h-4" />}{titulo}</h4>
      {children}
    </div>
  )
}

function Kpi({ icone: Icone, rotulo, valor, detalhe, onClick }: { icone: typeof Users; rotulo: string; valor: number; detalhe?: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!valor}
      className="text-left bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-purple-400 hover:shadow-sm transition disabled:hover:border-slate-200 disabled:cursor-default">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400"><Icone className="w-4 h-4" />{rotulo}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{valor}</div>
      {detalhe && <div className="text-xs text-slate-500 dark:text-slate-400">{detalhe}</div>}
    </button>
  )
}

/** Barras horizontais clicáveis. */
function Barras({ itens, onClick, cor = '#7c3aed' }: { itens: Contagem[]; onClick: (rotulo: string) => void; cor?: string }) {
  if (!itens.length) return <p className="text-xs text-slate-400">Sem dados no período.</p>
  return (
    <div style={{ height: Math.max(120, itens.length * 34 + 20) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={itens} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
          <XAxis type="number" allowDecimals={false} hide />
          <YAxis type="category" dataKey="rotulo" width={170} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => [v, 'Pessoas']} cursor={{ fill: 'rgba(124,58,237,0.06)' }} />
          <Bar dataKey="total" fill={cor} radius={[0, 4, 4, 0]} cursor="pointer" label={{ position: 'right', fontSize: 11 }}
            onClick={(d: { payload?: Contagem }) => d?.payload && onClick(d.payload.rotulo)} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Pizza (rosca) clicável. */
function Pizza({ itens, onClick, cores }: { itens: Contagem[]; onClick: (rotulo: string) => void; cores?: Record<string, string> }) {
  if (!itens.length) return <p className="text-xs text-slate-400">Sem dados no período.</p>
  const total = itens.reduce((s, i) => s + i.total, 0)
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={itens} dataKey="total" nameKey="rotulo" innerRadius="55%" outerRadius="85%" paddingAngle={2} cursor="pointer"
            onClick={(d: { rotulo?: string; payload?: Contagem }) => { const r = d?.rotulo ?? d?.payload?.rotulo; if (r) onClick(r) }}
            label={({ value }) => `${Math.round((Number(value) / total) * 100)}%`} labelLine={false}>
            {itens.map((i, idx) => <Cell key={i.rotulo} fill={cores?.[i.rotulo] ?? CORES[idx % CORES.length]} />)}
          </Pie>
          <Tooltip formatter={(v, n) => [`${v} (${Math.round((Number(v) / total) * 100)}%)`, n]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
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

// ── Exportar / imprimir a lista de um detalhe ────────────────────────────────

const COLUNAS: Array<[string, (c: ConversaRelatorio) => string]> = [
  ['Nome', c => c.nome],
  ['Telefone', c => c.telefone],
  ['Início', c => dataHoraBr(c.inicio)],
  ['Origem', c => c.origem],
  ['Tipo', c => c.categoria],
  ['Assunto', c => c.assunto],
  ['Sexo', c => rotuloSexo(c.sexo)],
  ['Faixa etária', c => c.faixaEtaria],
  ['Igreja anterior', c => c.igrejaAnterior],
  ['Tempo na Sede', c => c.tempoNaSede],
  ['Já abordado', c => simNao(c.jaFoiAbordado)],
  ['Departamentos', c => c.interesses.join(', ')],
  ['GF', c => c.gfs.join(', ')],
  ['Quer visita', c => simNao(c.querVisita)],
  ['Bairro', c => c.bairro],
]

function exportarCsv(titulo: string, lista: ConversaRelatorio[]) {
  const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const linhas = [COLUNAS.map(([h]) => esc(h)).join(';'), ...lista.map(c => COLUNAS.map(([, f]) => esc(f(c))).join(';'))]
  // BOM: o Excel abre com acentos corretos
  const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `relatorio-whatsapp-${norm(titulo).replace(/[^a-z0-9]+/g, '-')}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function imprimir(titulo: string, periodo: string, lista: ConversaRelatorio[]) {
  const esc = (v: string) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const w = window.open('', '_blank')
  if (!w) { toast.error('O navegador bloqueou a janela de impressão.'); return }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:24px}h1{font-size:16px;margin:0}p{color:#555;margin:4px 0 12px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f1f5f9}
@page{size:landscape;margin:12mm}</style></head><body>
<h1>${esc(titulo)}</h1><p>Atendimento pelo WhatsApp — ${esc(periodo)} — ${lista.length} conversa(s)</p>
<table><thead><tr>${COLUNAS.map(([h]) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${lista.map(c => `<tr>${COLUNAS.map(([, f]) => `<td>${esc(f(c))}</td>`).join('')}</tr>`).join('')}</tbody></table>
<script>window.onload=()=>{window.print()}</script></body></html>`)
  w.document.close()
}

// ── Tela ─────────────────────────────────────────────────────────────────────

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
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)
  // a IA analisa as conversas aos poucos: enquanto houver pendentes, busca de novo
  const repeticoes = useRef(0)

  const atalho = (dias: number | 'mes') => {
    const hoje = hojeBrt()
    setAte(hoje)
    setDe(dias === 'mes' ? `${hoje.slice(0, 8)}01` : somarDias(hoje, -(dias - 1)))
  }

  const buscar = async (continuacao = false) => {
    if (!continuacao) repeticoes.current = 0
    setBuscando(true); if (!continuacao) setAnalise('')
    try {
      const sp = new URLSearchParams({ de, ate, ...(departamento ? { departamento } : {}) })
      const r = await fetch(`${apiBase}/whatsapp/relatorios?${sp}`, { headers: cabecalhos(), cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Falha ao buscar')
      setRel(d)
      setDepartamentos(d.departamentos ?? [])
      if (!continuacao) setAbertas(new Set())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao buscar')
    } finally {
      setBuscando(false)
    }
  }

  // continua a análise das conversas que faltaram (até 10 rodadas)
  useEffect(() => {
    if (!rel?.pendentesAnalise || buscando || repeticoes.current >= 10) return
    repeticoes.current++
    const t = setTimeout(() => { void buscar(true) }, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rel])

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

  const abrir = (titulo: string, filtro: (c: ConversaRelatorio) => boolean) => setDetalhe({ titulo, filtro })
  const temArea = (c: ConversaRelatorio, area: string) => [...c.interesses, ...c.encaminhados].some(i => norm(i) === norm(area))

  const porDia = useMemo(() => (rel?.porDia ?? []).map(d => ({ dia: d.rotulo, rotulo: dataBr(d.rotulo).slice(0, 5), total: d.total })), [rel])
  const listaDetalhe = useMemo(() => (detalhe && rel ? rel.conversas.filter(detalhe.filtro) : []), [detalhe, rel])
  const periodoTxt = `${dataBr(de)} a ${dataBr(ate)}${departamento ? ` — ${departamento}` : ''}`
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
        <div className="ml-auto"><BotaoBuscar onClick={() => buscar()} buscando={buscando} /></div>
      </div>

      {!rel ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"><AvisoDefinaFiltros /></div>
      ) : (
        <>
          {rel.pendentesAnalise > 0 && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:border-purple-900 px-4 py-3 text-sm text-purple-800 dark:text-purple-200 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> A IA está analisando as conversas do período — faltam {rel.pendentesAnalise}. Os números se completam sozinhos.
            </div>
          )}
          {rel.aviso && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">{rel.aviso}</div>
          )}
          <p className="text-xs text-slate-500">Clique em um indicador ou em qualquer parte dos gráficos para ver a lista, exportar ou imprimir.</p>

          {/* Indicadores (clicáveis) */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
            <Kpi icone={MessageCircle} rotulo="Atendimentos" valor={t!.conversas} detalhe={`${t!.viaQr} pelo QR / site · ${t!.comAgente} com agente`} onClick={() => abrir('Todos os atendimentos', () => true)} />
            <Kpi icone={Church} rotulo="De outra igreja" valor={t!.deOutraIgreja} detalhe={`${t!.semIgrejaAnterior} sem igreja anterior`}
              onClick={() => abrir('Vieram de outra igreja', c => !c.reservado && !!c.igrejaAnterior && !/^(nao|nenhuma?|nunca)/.test(norm(c.igrejaAnterior)))} />
            <Kpi icone={HandHelping} rotulo="Já abordados" valor={t!.jaAbordados} detalhe={`${t!.naoAbordados} ninguém abordou`} onClick={() => abrir('Já foram abordados', c => c.jaFoiAbordado === true)} />
            <Kpi icone={HandHelping} rotulo="Ninguém abordou" valor={t!.naoAbordados} onClick={() => abrir('Ninguém abordou', c => c.jaFoiAbordado === false)} />
            <Kpi icone={Home} rotulo="Interesse em GF" valor={t!.encaminhadosGF} detalhe={`${t!.naoConhecemGF} não conheciam GF`} onClick={() => abrir('Interesse em Grupo Familiar', c => c.gfs.length > 0)} />
            <Kpi icone={CalendarCheck} rotulo="Querem visita" valor={t!.querVisita} onClick={() => abrir('Querem visita', c => c.querVisita === true)} />
            <Kpi icone={UserPlus} rotulo="Quero ser Membro" valor={t!.queroSerMembro} onClick={() => abrir('Quero ser Membro', c => c.queroSerMembro)} />
            <Kpi icone={HeartHandshake} rotulo="Pedidos de oração" valor={t!.pedidosOracao} onClick={() => abrir('Pedidos de oração', c => c.pedidoOracao)} />
            <Kpi icone={Users} rotulo="Pediram atendimento humano" valor={t!.pediuHumano} onClick={() => abrir('Pediram atendimento humano', c => c.pediuHumano)} />
            <Kpi icone={Mic} rotulo="Falaram por áudio" valor={t!.comAudio} onClick={() => abrir('Falaram por áudio', c => c.audios > 0)} />
            <Kpi icone={Lock} rotulo="Assuntos reservados" valor={t!.reservados} detalhe="só a contagem" />
          </div>

          {/* Gráficos */}
          <div className="grid lg:grid-cols-3 gap-3">
            <Cartao titulo="Atendimentos por dia" icone={BarChart3} className="lg:col-span-2">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={porDia} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}
                    onClick={(e: { activeLabel?: string | number }) => {
                      const p = porDia.find(d => d.rotulo === String(e?.activeLabel ?? ''))
                      if (p) abrir(`Atendimentos de ${dataBr(p.dia)}`, c => diaBrt(c.inicio) === p.dia)
                    }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [v, 'Atendimentos']} />
                    <Line type="monotone" dataKey="total" stroke="#7c3aed" strokeWidth={3} dot={{ r: 5, cursor: 'pointer' }} activeDot={{ r: 7, cursor: 'pointer' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Cartao>
            <Cartao titulo="Homens e mulheres">
              <Pizza itens={rel.porSexo} cores={COR_SEXO} onClick={r => abrir(r, c => !c.reservado && rotuloSexo(c.sexo) === r)} />
            </Cartao>
            <Cartao titulo="Tipo de atendimento">
              <Pizza itens={rel.porCategoria} onClick={r => abrir(`Tipo: ${r}`, c => (c.categoria || 'Aguardando análise') === r)} />
            </Cartao>
            <Cartao titulo="Tempo na Sede">
              <Barras itens={rel.porTempoNaSede} cor="#10b981" onClick={r => abrir(`Tempo na Sede: ${r}`, c => !c.reservado && c.faixaTempo === r)} />
            </Cartao>
            <Cartao titulo="Faixa etária">
              <Pizza itens={rel.porFaixaEtaria} onClick={r => abrir(`Faixa etária: ${r}`, c => !c.reservado && (c.faixaEtaria || 'Não informado') === r)} />
            </Cartao>
            <Cartao titulo="Interesse por departamento" className="lg:col-span-2">
              <Barras itens={rel.porDepartamento} onClick={r => abrir(`Departamento: ${r}`, c => !c.reservado && temArea(c, r))} />
            </Cartao>
            <Cartao titulo="Grupos Familiares">
              <Barras itens={rel.porGf} cor="#f59e0b" onClick={r => abrir(`GF ${r}`, c => c.gfs.includes(r))} />
            </Cartao>
            <Cartao titulo="Teor das conversas" className="lg:col-span-3">
              <Barras itens={rel.porAssunto} cor="#0ea5e9" onClick={r => abrir(`Assunto: ${r}`, c => !c.reservado && (c.assunto || 'Não identificado') === r)} />
            </Cartao>
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
                          {c.reservado ? 'Visível só para o pastor responsável' : [c.categoria, c.assunto, ...c.interesses, ...c.gfs.map(g => `GF ${g}`)].filter(Boolean).join(' · ') || (c.analisada ? 'Sem informações' : 'Aguardando análise da IA')}
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0">{c.origem}</span>
                    </button>
                    {aberta && !c.reservado && (
                      <div className="mt-3 ml-7 space-y-3">
                        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <Campo rotulo="Telefone" valor={c.telefone} />
                          <Campo rotulo="Sexo" valor={rotuloSexo(c.sexo)} />
                          <Campo rotulo="Igreja anterior" valor={c.igrejaAnterior} />
                          <Campo rotulo="Tempo na Sede" valor={c.tempoNaSede} />
                          <Campo rotulo="Já foi abordado(a)" valor={simNao(c.jaFoiAbordado)} />
                          <Campo rotulo="Conhece GF" valor={simNao(c.conheceGF)} />
                          <Campo rotulo="GF" valor={c.gfs.join(', ')} />
                          <Campo rotulo="Departamentos" valor={c.interesses.join(', ')} />
                          <Campo rotulo="Encaminhado a" valor={c.encaminhados.join(', ')} />
                          <Campo rotulo="Faixa etária" valor={c.faixaEtaria} />
                          <Campo rotulo="Perfil" valor={c.perfil} />
                          <Campo rotulo="Bairro" valor={c.bairro} />
                          <Campo rotulo="Visita" valor={c.querVisita ? `Sim${c.dataVisita ? ` — ${dataBr(c.dataVisita)}` : ''}` : simNao(c.querVisita)} />
                          <Campo rotulo="Quero ser Membro" valor={c.queroSerMembro ? 'Registrado' : '—'} />
                          <Campo rotulo="Pedido de oração" valor={c.pedidoOracao ? 'Sim' : '—'} />
                          <Campo rotulo="Mensagens recebidas" valor={String(c.mensagens)} />
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

      {/* Janela de detalhe (clique em indicador/gráfico) */}
      {detalhe && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDetalhe(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{detalhe.titulo}</h3>
                <p className="text-xs text-slate-500">{periodoTxt} · {listaDetalhe.length} conversa(s)</p>
              </div>
              <Permissao chave="whatsapp_inbox.whats_app_inbox.relatorios_exportar" rotulo="Exportar relatório — Whats App Inbox" herda="whatsapp_inbox.whats_app_inbox.relatorios">
                <button type="button" onClick={() => exportarCsv(detalhe.titulo, listaDetalhe)} disabled={!listaDetalhe.length}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-1 disabled:opacity-50">
                  <Download className="w-3.5 h-3.5" /> Exportar Excel
                </button>
              </Permissao>
              <Permissao chave="whatsapp_inbox.whats_app_inbox.relatorios_imprimir" rotulo="Imprimir relatório — Whats App Inbox" herda="whatsapp_inbox.whats_app_inbox.relatorios">
                <button type="button" onClick={() => imprimir(detalhe.titulo, periodoTxt, listaDetalhe)} disabled={!listaDetalhe.length}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-1 disabled:opacity-50">
                  <Printer className="w-3.5 h-3.5" /> Imprimir
                </button>
              </Permissao>
              <button type="button" onClick={() => setDetalhe(null)} title="Fechar" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-auto">
              {listaDetalhe.length ? (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0">
                    <tr>{COLUNAS.map(([h]) => <th key={h} className="text-left font-semibold text-slate-600 dark:text-slate-300 px-3 py-2 whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {listaDetalhe.map(c => (
                      <tr key={c.id} className={c.reservado ? 'text-slate-400' : 'hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer'}
                        onClick={() => { if (!c.reservado) { setDetalhe(null); onAbrirConversa(c.id) } }}>
                        {COLUNAS.map(([h, f]) => <td key={h} className="px-3 py-2 align-top">{f(c) || '—'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="p-6 text-center text-sm text-slate-500">Nenhuma conversa neste grupo.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
