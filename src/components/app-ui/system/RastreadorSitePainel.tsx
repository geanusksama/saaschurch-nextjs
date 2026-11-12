/**
 * Sistema → Rastreador do site: quem visita o site público da igreja, de
 * onde vem (Google, Instagram, WhatsApp, QR...), o que mais vê e onde clica.
 * Dados: GET /api/site-rastreio (src/lib/siteRastreio.ts). Abre vazio e só
 * busca no botão Buscar. Cada aba imprime; cada gráfico abre a lista.
 */
import { useMemo, useState } from 'react'
import { ArrowLeft, Download, Eye, Globe, MousePointerClick, Printer, Radar, Repeat, UserPlus, Users } from 'lucide-react'
import { useNavigate } from 'react-router'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { apiBase } from '../../../lib/apiBase'
import { Permissao } from '../../../lib/permissoes/Permissao'
import { BotaoBuscar, AvisoDefinaFiltros } from '../BotaoBuscar'
import { JanelaTabela, exportarExcel, imprimirSecoes, type Celula, type Secao } from '../relatorios/TabelaRelatorio'
import type { PainelRastreio, Contagem, TipoDetalhe } from '@/lib/siteRastreio'

const CORES = ['#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#ec4899', '#84cc16', '#64748b', '#14b8a6', '#a855f7']
const hojeBrt = () => new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)
const dataBr = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')

function cabecalhos(): Record<string, string> {
  const token = localStorage.getItem('mrm_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type Aba = 'geral' | 'origem' | 'paginas' | 'cliques' | 'aparelhos' | 'google'
const ABAS: Array<[Aba, string]> = [
  ['geral', 'Visão geral'], ['origem', 'De onde vêm'], ['paginas', 'Páginas mais vistas'],
  ['cliques', 'Onde clicam'], ['aparelhos', 'Aparelhos e horários'], ['google', 'Google'],
]

function Cartao({ titulo, children, className = '' }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 ${className}`}>
      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">{titulo}</h4>
      {children}
    </div>
  )
}

function Kpi({ icone: Icone, rotulo, valor, detalhe }: { icone: typeof Users; rotulo: string; valor: number | string; detalhe?: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><Icone className="w-4 h-4" />{rotulo}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{valor}</div>
      {detalhe && <div className="text-xs text-slate-500">{detalhe}</div>}
    </div>
  )
}

function Barras({ itens, onClick, cor = '#7c3aed', largura = 220 }: { itens: Contagem[]; onClick?: (r: string) => void; cor?: string; largura?: number }) {
  if (!itens.length) return <p className="text-xs text-slate-400">Sem dados no período.</p>
  return (
    <div style={{ height: Math.max(120, itens.length * 32 + 20) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={itens} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }}>
          <XAxis type="number" allowDecimals={false} hide />
          <YAxis type="category" dataKey="rotulo" width={largura} tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ fill: 'rgba(124,58,237,0.06)' }} />
          <Bar dataKey="total" name="Total" fill={cor} radius={[0, 4, 4, 0]} cursor={onClick ? 'pointer' : undefined}
            label={{ position: 'right', fontSize: 11 }} onClick={(d: { payload?: Contagem }) => d?.payload && onClick?.(d.payload.rotulo)} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function Pizza({ itens, onClick }: { itens: Contagem[]; onClick?: (r: string) => void }) {
  if (!itens.length) return <p className="text-xs text-slate-400">Sem dados no período.</p>
  const total = itens.reduce((s, i) => s + i.total, 0)
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={itens} dataKey="total" nameKey="rotulo" innerRadius="50%" outerRadius="82%" paddingAngle={2} cursor={onClick ? 'pointer' : undefined}
            onClick={(d: { rotulo?: string; payload?: Contagem }) => { const r = d?.rotulo ?? d?.payload?.rotulo; if (r) onClick?.(r) }}
            label={({ value }) => `${Math.round((Number(value) / total) * 100)}%`} labelLine={false}>
            {itens.map((i, idx) => <Cell key={i.rotulo} fill={CORES[idx % CORES.length]} />)}
          </Pie>
          <Tooltip formatter={(v, n) => [`${v} (${Math.round((Number(v) / total) * 100)}%)`, n]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

const linhasDe = (itens: Contagem[], comVisitantes = false): Celula[][] =>
  itens.map(i => (comVisitantes ? [i.rotulo, i.total, i.visitantes ?? ''] : [i.rotulo, i.total]))

export default function RastreadorSitePainel() {
  const navigate = useNavigate()
  const [de, setDe] = useState(() => `${hojeBrt().slice(0, 8)}01`)
  const [ate, setAte] = useState(hojeBrt)
  const [buscando, setBuscando] = useState(false)
  const [painel, setPainel] = useState<PainelRastreio | null>(null)
  const [aba, setAba] = useState<Aba>('geral')
  const [janela, setJanela] = useState<{ titulo: string; colunas: string[]; linhas: Celula[][]; carregando: boolean } | null>(null)

  // período da ÚLTIMA busca: detalhe e impressão nunca misturam com o que está digitado
  const periodoTxt = painel ? `${dataBr(painel.periodo.de)} a ${dataBr(painel.periodo.ate)}` : ''
  const inputCls = 'rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm'

  const buscar = async () => {
    setBuscando(true)
    try {
      const r = await fetch(`${apiBase}/site-rastreio?${new URLSearchParams({ de, ate })}`, { headers: cabecalhos(), cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Falha ao buscar')
      setPainel(d)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao buscar')
    } finally {
      setBuscando(false)
    }
  }

  const abrir = async (titulo: string, tipo: TipoDetalhe, valor: string) => {
    setJanela({ titulo, colunas: [], linhas: [], carregando: true })
    try {
      if (!painel) return
      const r = await fetch(`${apiBase}/site-rastreio?${new URLSearchParams({ de: painel.periodo.de, ate: painel.periodo.ate, detalhe: tipo, valor })}`, { headers: cabecalhos(), cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Falha ao carregar')
      setJanela({ titulo, colunas: d.colunas, linhas: d.linhas, carregando: false })
    } catch (e) {
      setJanela(null)
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar')
    }
  }

  /** Tabelas de cada aba — o que a impressão da aba leva. */
  const secoesDaAba = useMemo((): Record<Aba, Secao[]> | null => {
    if (!painel) return null
    const t = painel.totais
    const geral: Secao[] = [
      { titulo: 'Resumo', colunas: ['Indicador', 'Valor'], linhas: [
        ['Visualizações de página', t.visualizacoes], ['Visitantes', t.visitantes], ['Novos visitantes', t.novosVisitantes],
        ['Visitas (sessões)', t.sessoes], ['Páginas por visita', t.paginasPorSessao], ['Cliques', t.cliques],
      ] },
      { titulo: 'Por dia', colunas: ['Dia', 'Visualizações', 'Visitantes'], linhas: painel.porDia.map(d => [dataBr(d.dia), d.visualizacoes, d.visitantes]) },
    ]
    return {
      geral,
      origem: [
        { titulo: 'Origem das visitas', colunas: ['Origem', 'Visitas', 'Visitantes'], linhas: linhasDe(painel.porOrigem, true) },
        { titulo: 'Sites que trouxeram visitas', colunas: ['Site', 'Visitas'], linhas: linhasDe(painel.sitesDeOrigem) },
        { titulo: 'Campanhas (links com utm)', colunas: ['Fonte / meio / campanha', 'Visitas'], linhas: linhasDe(painel.campanhas) },
      ],
      paginas: [{ titulo: 'Páginas mais vistas', colunas: ['Página', 'Visualizações', 'Visitantes'], linhas: linhasDe(painel.paginas, true) }],
      cliques: [{ titulo: 'Onde mais clicam', colunas: ['Botão ou link', 'Cliques', 'Visitantes'], linhas: linhasDe(painel.cliques, true) }],
      aparelhos: [
        { titulo: 'Aparelhos', colunas: ['Aparelho', 'Visitantes'], linhas: linhasDe(painel.porDispositivo) },
        { titulo: 'Navegadores', colunas: ['Navegador', 'Visitantes'], linhas: linhasDe(painel.porNavegador) },
        { titulo: 'Horários (visualizações)', colunas: ['Hora', 'Visualizações'], linhas: linhasDe(painel.porHora) },
      ],
      google: [],
    }
  }, [painel])

  const imprimirAba = () => {
    if (!secoesDaAba) return
    const nome = ABAS.find(([k]) => k === aba)?.[1] ?? ''
    imprimirSecoes(`Rastreador do site — ${nome}`, periodoTxt, secoesDaAba[aba])
  }
  const imprimirTudo = () => {
    if (!secoesDaAba) return
    imprimirSecoes('Rastreador do site — relatório completo', periodoTxt, ABAS.flatMap(([k]) => secoesDaAba[k]))
  }

  const t = painel?.totais
  const site = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="p-6 space-y-4 text-slate-900 dark:text-slate-100">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => navigate('/app-ui/system-settings')} title="Voltar"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center"><Radar className="w-5 h-5 text-white" /></div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Rastreador do site</h1>
          </div>
          <p className="text-sm text-slate-500">Quem visita o site da igreja, de onde vem, o que mais vê e onde clica</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-500">De<input type="date" value={de} max={ate} onChange={e => setDe(e.target.value)} className={`${inputCls} block mt-1`} /></label>
        <label className="text-xs text-slate-500">Até<input type="date" value={ate} min={de} onChange={e => setAte(e.target.value)} className={`${inputCls} block mt-1`} /></label>
        <div className="flex gap-1 text-xs">
          <button type="button" onClick={() => { const h = hojeBrt(); setDe(`${h.slice(0, 8)}01`); setAte(h) }} className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50">Este mês</button>
          <button type="button" onClick={() => { const h = new Date(); const ini = new Date(h.getFullYear(), h.getMonth() - 1, 1); const fim = new Date(h.getFullYear(), h.getMonth(), 0); setDe(ini.toISOString().slice(0, 10)); setAte(fim.toISOString().slice(0, 10)) }} className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50">Mês passado</button>
        </div>
        <div className="ml-auto flex gap-2">
          {painel && (
            <Permissao chave="site_rastreio.rastreador_site.imprimir" rotulo="Imprimir — Rastreador do site" herda="site_rastreio.view">
              <button type="button" onClick={imprimirTudo} className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-1.5"><Printer className="w-4 h-4" /> Imprimir tudo</button>
            </Permissao>
          )}
          <BotaoBuscar onClick={buscar} buscando={buscando} />
        </div>
      </div>

      {!painel ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"><AvisoDefinaFiltros /></div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 dark:border-slate-700">
            {ABAS.map(([k, rotulo]) => (
              <button key={k} type="button" onClick={() => setAba(k)}
                className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${aba === k ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                {rotulo}
              </button>
            ))}
            {aba !== 'google' && (
              <div className="ml-auto pb-1">
                <Permissao chave="site_rastreio.rastreador_site.imprimir" rotulo="Imprimir — Rastreador do site" herda="site_rastreio.view">
                  <button type="button" onClick={imprimirAba} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-1"><Printer className="w-3.5 h-3.5" /> Imprimir esta aba</button>
                </Permissao>
              </div>
            )}
          </div>

          {aba === 'geral' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <Kpi icone={Eye} rotulo="Visualizações" valor={t!.visualizacoes} />
                <Kpi icone={Users} rotulo="Visitantes" valor={t!.visitantes} />
                <Kpi icone={UserPlus} rotulo="Novos visitantes" valor={t!.novosVisitantes} />
                <Kpi icone={Repeat} rotulo="Visitas" valor={t!.sessoes} detalhe={`${t!.paginasPorSessao} páginas por visita`} />
                <Kpi icone={MousePointerClick} rotulo="Cliques" valor={t!.cliques} />
                <Kpi icone={Globe} rotulo="Vindos do Google" valor={painel.porOrigem.find(o => o.rotulo === 'Google')?.total ?? 0} />
              </div>
              <Cartao titulo="Visitas por dia (clique num ponto para ver as páginas do dia)">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={painel.porDia.map(d => ({ ...d, rotulo: dataBr(d.dia).slice(0, 5) }))} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}
                      onClick={(e: { activeLabel?: string | number }) => {
                        const d = painel.porDia.find(x => dataBr(x.dia).slice(0, 5) === String(e?.activeLabel ?? ''))
                        if (d) void abrir(`Páginas vistas em ${dataBr(d.dia)}`, 'dia', d.dia)
                      }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="visualizacoes" name="Visualizações" stroke="#7c3aed" strokeWidth={3} dot={{ r: 4, cursor: 'pointer' }} />
                      <Line type="monotone" dataKey="visitantes" name="Visitantes" stroke="#10b981" strokeWidth={3} dot={{ r: 4, cursor: 'pointer' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Cartao>
              <div className="grid lg:grid-cols-2 gap-3">
                <Cartao titulo="De onde vêm"><Pizza itens={painel.porOrigem} onClick={r => abrir(`Páginas vistas por quem veio de ${r}`, 'origem', r)} /></Cartao>
                <Cartao titulo="Páginas mais vistas"><Barras itens={painel.paginas.slice(0, 8)} onClick={r => abrir(`Página ${r}`, 'pagina', r)} /></Cartao>
              </div>
            </>
          )}

          {aba === 'origem' && (
            <div className="grid lg:grid-cols-2 gap-3">
              <Cartao titulo="Origem das visitas"><Pizza itens={painel.porOrigem} onClick={r => abrir(`Páginas vistas por quem veio de ${r}`, 'origem', r)} /></Cartao>
              <Cartao titulo="Origem (visitas)"><Barras itens={painel.porOrigem} cor="#0ea5e9" onClick={r => abrir(`Páginas vistas por quem veio de ${r}`, 'origem', r)} /></Cartao>
              <Cartao titulo="Sites que trouxeram visitas"><Barras itens={painel.sitesDeOrigem} cor="#10b981" /></Cartao>
              <Cartao titulo="Campanhas (links com utm)">
                <Barras itens={painel.campanhas} cor="#f59e0b" />
                <p className="mt-2 text-xs text-slate-500">Para medir um QR ou post, use o link com <code>?utm_source=qr</code> (ou instagram, whatsapp…) e <code>&utm_campaign=nome</code>.</p>
              </Cartao>
            </div>
          )}

          {aba === 'paginas' && (
            <Cartao titulo="Páginas mais vistas (clique para ver de onde vieram e onde clicaram)">
              <Barras itens={painel.paginas} largura={280} onClick={r => abrir(`Página ${r}`, 'pagina', r)} />
            </Cartao>
          )}

          {aba === 'cliques' && (
            <Cartao titulo="Botões e links mais clicados (clique para ver em que página)">
              <Barras itens={painel.cliques} largura={300} cor="#ec4899" onClick={r => abrir(`Cliques em "${r}"`, 'clique', r)} />
            </Cartao>
          )}

          {aba === 'aparelhos' && (
            <div className="grid lg:grid-cols-2 gap-3">
              <Cartao titulo="Aparelhos"><Pizza itens={painel.porDispositivo} onClick={r => abrir(`Páginas vistas no ${r.toLowerCase()}`, 'dispositivo', r)} /></Cartao>
              <Cartao titulo="Navegadores"><Pizza itens={painel.porNavegador} /></Cartao>
              <Cartao titulo="Horários de mais visitas" className="lg:col-span-2">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={painel.porHora} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="total" name="Visualizações" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Cartao>
            </div>
          )}

          {aba === 'google' && (
            <Cartao titulo="Aparecer no Google">
              <div className="text-sm text-slate-700 dark:text-slate-200 space-y-3">
                <p>O site já entrega ao Google o que ele precisa para encontrar e listar as páginas:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Mapa do site: <a className="text-indigo-600 underline" href={`${site}/sitemap.xml`} target="_blank" rel="noreferrer">{site}/sitemap.xml</a></li>
                  <li>Regras para robôs: <a className="text-indigo-600 underline" href={`${site}/robots.txt`} target="_blank" rel="noreferrer">{site}/robots.txt</a> (o painel e páginas pessoais ficam fora da busca)</li>
                  <li>Título e descrição da página vêm de Configurações → Home pública (título do site e descrição).</li>
                </ul>
                <p className="font-semibold">Para o Google indexar mais rápido (feito uma vez, com a conta Google da igreja):</p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Abra o Google Search Console (search.google.com/search-console) e adicione a propriedade do domínio do site.</li>
                  <li>Confirme o domínio pelo registro DNS que o Google indicar (no provedor do domínio).</li>
                  <li>Em “Sitemaps”, envie <code>sitemap.xml</code>.</li>
                  <li>Peça a indexação da página inicial em “Inspeção de URL”.</li>
                </ol>
                <p className="text-xs text-slate-500">As visitas que chegam pela busca aparecem aqui como origem “Google”.</p>
              </div>
            </Cartao>
          )}
        </>
      )}

      {janela && (
        <JanelaTabela titulo={janela.titulo} subtitulo={periodoTxt} colunas={janela.colunas} linhas={janela.linhas}
          carregando={janela.carregando} onFechar={() => setJanela(null)}
          acoes={<>
            <Permissao chave="site_rastreio.rastreador_site.exportar" rotulo="Exportar Excel — Rastreador do site" herda="site_rastreio.view">
              <button type="button" disabled={!janela.linhas.length} onClick={() => exportarExcel(`rastreador-${janela.titulo}`, janela.colunas, janela.linhas)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-1 disabled:opacity-50"><Download className="w-3.5 h-3.5" /> Exportar Excel</button>
            </Permissao>
            <Permissao chave="site_rastreio.rastreador_site.imprimir" rotulo="Imprimir — Rastreador do site" herda="site_rastreio.view">
              <button type="button" disabled={!janela.linhas.length} onClick={() => imprimirSecoes(janela.titulo, periodoTxt, [{ titulo: janela.titulo, colunas: janela.colunas, linhas: janela.linhas }])}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-1 disabled:opacity-50"><Printer className="w-3.5 h-3.5" /> Imprimir</button>
            </Permissao>
          </>} />
      )}
    </div>
  )
}
