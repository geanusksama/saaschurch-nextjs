'use client'

/**
 * Recepção por QR code + conexão do webhook Z-API de uma instância.
 *
 * 1. Webhook: aponta os webhooks da Z-API para este sistema (sem isso nenhuma
 *    mensagem chega aqui — nem inbox, nem agente).
 * 2. QR da recepção: escolhe o agente de IA, a mensagem que o QR deixa
 *    digitada e a palavra-chave que aciona o agente. Gera o QR para imprimir.
 *
 * Regra do fluxo: src/lib/recepcaoWhatsapp.ts e src/app/api/whatsapp/webhook.
 */

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { Bot, Download, ExternalLink, Link2, Loader2, Printer, QrCode, X, AlertTriangle, CheckCircle, XCircle, Share2, Copy, Plus, Trash2, Users } from 'lucide-react'
import type { WhatsAppInstance } from '@/types/whatsapp'
import { Permissao } from '../../../lib/permissoes/Permissao'
import { RECEPCAO_PADRAO, linkWhatsRecepcao, palavraChaveValida, type RecepcaoConfig } from '@/lib/recepcaoWhatsapp'

interface Agente { id: string; name: string; role: string; isActive: boolean }
interface ResultadoWebhook { webhook: string; url: string; ok: boolean; status: number; resposta: string }

export default function RecepcaoQrModal({ instance, onClose }: { instance: WhatsAppInstance; onClose: () => void }) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') ?? '' : ''
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const [loading, setLoading] = useState(true)
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [cfg, setCfg] = useState<RecepcaoConfig>({ ...RECEPCAO_PADRAO })
  const [telefone, setTelefone] = useState(instance.phone_number ?? '')
  const [webhookAtual, setWebhookAtual] = useState<string | null>(null)
  const [baseUrl, setBaseUrl] = useState(typeof window !== 'undefined' ? window.location.origin : '')
  const [salvando, setSalvando] = useState(false)
  const [conectando, setConectando] = useState(false)
  const [resultados, setResultados] = useState<ResultadoWebhook[] | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    Promise.all([
      fetch(`/api/whatsapp/instances/${instance.id}?action=details`, { headers, cache: 'no-store' }).then(r => r.json()),
      fetch('/api/ai/agents', { headers, cache: 'no-store' }).then(r => r.json()),
    ]).then(([det, ags]) => {
      if (cancel) return
      if (det?.recepcao) setCfg(det.recepcao)
      // número salvo na recepção vence; senão o que a Z-API informou para a instância
      setTelefone(det?.recepcao?.telefone || String(det?.phone_number ?? instance.phone_number ?? '').replace(/\D/g, ''))
      setWebhookAtual(det?.webhook_url ?? null)
      setAgentes(Array.isArray(ags) ? ags.filter((a: Agente) => a.isActive) : [])
    }).catch(() => toast.error('Erro ao carregar dados da instância'))
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.id])

  const link = useMemo(
    () => (telefone.replace(/\D/g, '') ? linkWhatsRecepcao(telefone, cfg.mensagem) : ''),
    [telefone, cfg.mensagem],
  )
  const chaveNaMensagem = palavraChaveValida(cfg.palavraChave, cfg.mensagem)
  const numeroDaInstancia = String(instance.phone_number ?? '').replace(/\D/g, '')
  const numeroDiferente = !!numeroDaInstancia && telefone.replace(/\D/g, '') !== numeroDaInstancia
  // agente salvo que não está na lista deste usuário (restrito/sem acesso) não some do seletor
  const agenteSalvoOculto = !!cfg.agentId && !agentes.some(a => a.id === cfg.agentId)

  useEffect(() => {
    let cancel = false
    const gerar = link ? QRCode.toDataURL(link, { margin: 2, width: 600 }) : Promise.resolve(null)
    gerar.then(u => { if (!cancel) setQrUrl(u) }).catch(() => { if (!cancel) setQrUrl(null) })
    return () => { cancel = true }
  }, [link])

  const salvar = async () => {
    setSalvando(true)
    try {
      const r = await fetch(`/api/whatsapp/instances/${instance.id}`, {
        method: 'PATCH', headers, cache: 'no-store', body: JSON.stringify({ recepcao: { ...cfg, telefone: telefone.replace(/\D/g, '') } }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'Falha ao salvar')
      setCfg(d.recepcao)
      toast.success('Recepção salva.')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao salvar') }
    finally { setSalvando(false) }
  }

  const conectarWebhook = async () => {
    setConectando(true); setResultados(null)
    try {
      const r = await fetch(`/api/whatsapp/instances/${instance.id}`, {
        method: 'PATCH', headers, cache: 'no-store', body: JSON.stringify({ action: 'connect-webhook', baseUrl }),
      })
      const d = await r.json().catch(() => ({}))
      if (Array.isArray(d.resultados)) setResultados(d.resultados)
      if (!r.ok) throw new Error(d.error ?? 'A Z-API recusou parte da configuração — veja abaixo.')
      setWebhookAtual(`${baseUrl.replace(/\/+$/, '')}/api/whatsapp/webhook`)
      toast.success('Webhook conectado a este sistema.')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao conectar') }
    finally { setConectando(false) }
  }

  const baixar = () => {
    if (!qrUrl) return
    const a = document.createElement('a'); a.href = qrUrl; a.download = `qrcode-recepcao-${instance.name}.png`; a.click()
  }

  // Compartilha a imagem do QR (celular: menu nativo com WhatsApp, e-mail...).
  // Sem suporte a arquivo, compartilha o link; sem Web Share, copia o link.
  const compartilhar = async () => {
    if (!qrUrl || !link) return
    const texto = 'Aponte a câmera para o QR code ou toque no link para falar com a igreja no WhatsApp:'
    try {
      const blob = await (await fetch(qrUrl)).blob()
      const arquivo = new File([blob], 'qrcode-recepcao.png', { type: 'image/png' })
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
      if (nav.share && nav.canShare?.({ files: [arquivo] })) {
        await nav.share({ files: [arquivo], title: 'QR code da recepção', text: `${texto} ${link}` })
        return
      }
      if (nav.share) {
        await nav.share({ title: 'QR code da recepção', text: texto, url: link })
        return
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
    await copiarLink()
  }

  const copiarLink = async () => {
    try { await navigator.clipboard.writeText(link); toast.success('Link copiado.') }
    catch { toast.error('Não foi possível copiar. Copie o link abaixo do QR.') }
  }

  const imprimir = () => {
    if (!qrUrl) return
    const w = window.open('', '_blank', 'width=600,height=800')
    if (!w) return
    w.document.write(`<html><head><title>QR Recepção</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:40px">
        <h1 style="margin:0 0 8px">Seja bem-vindo(a)!</h1>
        <p style="font-size:18px;margin:0 0 24px">Aponte a câmera do celular e fale com a gente no WhatsApp</p>
        <img src="${qrUrl}" style="width:380px;height:380px" />
      </body></html>`)
    w.document.close(); w.focus()
    setTimeout(() => w.print(), 300)
  }

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <QrCode className="w-5 h-5 text-purple-600" />
            <div>
              <h3 className="font-bold text-slate-900">Recepção e webhook — {instance.name}</h3>
              <p className="text-xs text-slate-500">QR code da recepção atendido por um agente de IA</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /> Carregando...</div>
        ) : (
          <div className="p-5 space-y-6">

            {/* 1. Webhook */}
            <section className="border border-slate-200 rounded-xl p-4">
              <h4 className="font-semibold text-slate-900 flex items-center gap-2 mb-1"><Link2 className="w-4 h-4 text-blue-600" /> 1. Webhook da Z-API</h4>
              <p className="text-xs text-slate-500 mb-3">
                As mensagens só chegam aqui se os webhooks da instância apontarem para este sistema.
                Última conexão feita por aqui: <span className="font-mono">{webhookAtual || 'nenhuma registrada'}</span>
              </p>
              <label className="block text-xs font-medium text-slate-600 mb-1">URL deste sistema (https)</label>
              <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://sistema.suaigreja.com.br" className={`${inputCls} font-mono`} />
              <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>A Z-API aceita uma URL por webhook. Ao conectar aqui, o outro sistema que hoje recebe as mensagens desta instância <strong>deixa de recebê-las</strong>.</span>
              </div>
              <div className="mt-3 flex justify-end">
                <Permissao chave="tela_comunicacao.whats_app_instances.conectar_webhook" rotulo="Conectar webhook — Whats App Instances" herda="tela_comunicacao.view">
                  <button onClick={conectarWebhook} disabled={conectando || !baseUrl.startsWith('https://')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                    {conectando && <Loader2 className="w-4 h-4 animate-spin" />} Conectar webhook a este sistema
                  </button>
                </Permissao>
              </div>
              {resultados && (
                <ul className="mt-3 space-y-1 text-xs">
                  {resultados.map(r => (
                    <li key={r.webhook} className="flex items-start gap-2">
                      {r.ok ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                      <span><strong>{r.webhook}</strong> → <span className="font-mono">{r.url}</span>{!r.ok && <span className="text-red-600"> (HTTP {r.status}: {r.resposta})</span>}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 2. Recepção */}
            <section className="border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-900 flex items-center gap-2"><Bot className="w-4 h-4 text-purple-600" /> 2. QR code da recepção</h4>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={cfg.ativo} onChange={e => setCfg(c => ({ ...c, ativo: e.target.checked }))} className="w-4 h-4 accent-purple-600" />
                  Ativo
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-slate-600">Agente que atende</label>
                      <a href="/app-ui/config/ai-agents" target="_blank" rel="noreferrer" className="text-xs text-purple-600 hover:underline flex items-center gap-1">
                        Ver / criar agentes <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <select value={cfg.agentId ?? ''} onChange={e => setCfg(c => ({ ...c, agentId: e.target.value || null }))} className={inputCls}>
                      <option value="">Selecione...</option>
                      {agenteSalvoOculto && <option value={cfg.agentId ?? ''}>Agente atual (sem acesso para você)</option>}
                      {agentes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    {agentes.length === 0 && <p className="text-xs text-slate-400 mt-1">Nenhum agente ativo. Crie um em “Ver / criar agentes”.</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Número do WhatsApp (DDI+DDD+número)</label>
                    <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="5519999990000" className={`${inputCls} font-mono`} />
                    {numeroDiferente && (
                      <p className="text-xs text-amber-600 mt-1">Diferente do número da instância ({numeroDaInstancia}). Mensagens para outro número não chegam nesta instância.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Mensagem que o QR deixa digitada</label>
                    <textarea rows={2} value={cfg.mensagem} onChange={e => setCfg(c => ({ ...c, mensagem: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Palavra-chave que aciona o agente</label>
                    <input value={cfg.palavraChave} onChange={e => setCfg(c => ({ ...c, palavraChave: e.target.value }))} className={inputCls} />
                    <p className={`text-xs mt-1 ${chaveNaMensagem ? 'text-slate-400' : 'text-red-600'}`}>
                      {chaveNaMensagem
                        ? 'Ignora acentos e maiúsculas. Só conversas cuja mensagem contém este trecho vão para o agente.'
                        : 'Preencha a palavra-chave e deixe-a dentro da mensagem do QR.'}
                    </p>
                  </div>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={cfg.todasNovas} onChange={e => setCfg(c => ({ ...c, todasNovas: e.target.checked }))} className="w-4 h-4 mt-0.5 accent-purple-600" />
                    <span>
                      Atender também qualquer conversa nova neste número
                      <span className="block text-xs text-slate-400">Quem ler o QR e apagar o texto, mandando só “oi”, também cai no agente. Conversas que já existem não mudam.</span>
                    </span>
                  </label>
                </div>

                <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl p-4">
                  {qrUrl ? (
                    <>
                      <img src={qrUrl} alt="QR code da recepção" className="w-56 h-56" />
                      <p className="text-[11px] text-slate-400 mt-2 break-all text-center">{link}</p>
                      <div className="flex gap-2 mt-3">
                        <Permissao chave="tela_comunicacao.whats_app_instances.compartilhar_qr_recepcao" rotulo="Baixar, imprimir e compartilhar QR da recepção — Whats App Instances" herda="tela_comunicacao.view">
                          <button onClick={baixar} className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1"><Download className="w-3.5 h-3.5" /> PNG</button>
                        </Permissao>
                        <Permissao chave="tela_comunicacao.whats_app_instances.compartilhar_qr_recepcao" rotulo="Baixar, imprimir e compartilhar QR da recepção — Whats App Instances" herda="tela_comunicacao.view">
                          <button onClick={imprimir} className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1"><Printer className="w-3.5 h-3.5" /> Imprimir</button>
                        </Permissao>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Permissao chave="tela_comunicacao.whats_app_instances.compartilhar_qr_recepcao" rotulo="Baixar, imprimir e compartilhar QR da recepção — Whats App Instances" herda="tela_comunicacao.view">
                          <button onClick={compartilhar} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1"><Share2 className="w-3.5 h-3.5" /> Compartilhar</button>
                        </Permissao>
                        <Permissao chave="tela_comunicacao.whats_app_instances.compartilhar_qr_recepcao" rotulo="Baixar, imprimir e compartilhar QR da recepção — Whats App Instances" herda="tela_comunicacao.view">
                          <button onClick={copiarLink} className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> Copiar link</button>
                        </Permissao>
                        <Permissao chave="tela_comunicacao.whats_app_instances.compartilhar_qr_recepcao" rotulo="Baixar, imprimir e compartilhar QR da recepção — Whats App Instances" herda="tela_comunicacao.view">
                          <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent('Fale com a igreja no WhatsApp: ' + link)}`, '_blank', 'noopener')}
                            className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1">Enviar no WhatsApp</button>
                        </Permissao>
                      </div>
                      {!cfg.ativo && <p className="text-[11px] text-amber-600 mt-2 text-center">Marque “Ativo” e salve, senão quem ler o QR cai na inbox sem o agente.</p>}
                    </>
                  ) : (
                    <p className="text-sm text-slate-400 text-center">Informe o número para gerar o QR code.</p>
                  )}
                </div>
              </div>

              {/* Encaminhamentos: líder por área de interesse + avisos de Quero ser Membro */}
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h5 className="font-semibold text-slate-900 flex items-center gap-2 text-sm"><Users className="w-4 h-4 text-purple-600" /> Encaminhar para os líderes</h5>
                <p className="text-xs text-slate-500 mb-2">
                  Quando a pessoa se interessar por uma área, o agente manda ao líder (como Secretária Virtual da Sede) o contato, os links dos pedidos e o resumo da conversa.
                  Sexo “Homem/Mulher” serve para áreas com líder diferente para cada um. “Padrão” recebe quando a conversa termina sem
                  interesse definido, é aleatória ou a pessoa pede para falar com alguém. O resumo vai uma vez, no fim da conversa (ou após 2 h sem resposta).
                </p>
                <div className="space-y-2">
                  {cfg.encaminhamentos.map((e, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input value={e.interesse} placeholder="Área (ex.: EBD)" onChange={ev => setCfg(c => ({ ...c, encaminhamentos: c.encaminhamentos.map((x, i) => i === idx ? { ...x, interesse: ev.target.value } : x) }))} className={`${inputCls} col-span-3`} />
                      <input value={e.nome} placeholder="Líder" onChange={ev => setCfg(c => ({ ...c, encaminhamentos: c.encaminhamentos.map((x, i) => i === idx ? { ...x, nome: ev.target.value } : x) }))} className={`${inputCls} col-span-3`} />
                      <input value={e.telefone} placeholder="55DDDnúmero" onChange={ev => setCfg(c => ({ ...c, encaminhamentos: c.encaminhamentos.map((x, i) => i === idx ? { ...x, telefone: ev.target.value } : x) }))} className={`${inputCls} col-span-3 font-mono`} />
                      <select value={e.sexo} onChange={ev => setCfg(c => ({ ...c, encaminhamentos: c.encaminhamentos.map((x, i) => i === idx ? { ...x, sexo: ev.target.value as '' | 'M' | 'F' } : x) }))} className={`${inputCls} col-span-1 px-1`}>
                        <option value="">Todos</option><option value="M">Homem</option><option value="F">Mulher</option>
                      </select>
                      <label className="col-span-1 flex flex-col items-center text-[10px] text-slate-500 cursor-pointer" title="Recebe quando não há interesse definido, a conversa é aleatória ou a pessoa pede para falar com alguém">
                        <input type="checkbox" checked={e.padrao} onChange={ev => setCfg(c => ({ ...c, encaminhamentos: c.encaminhamentos.map((x, i) => i === idx ? { ...x, padrao: ev.target.checked } : x) }))} className="w-4 h-4 accent-purple-600" />
                        Padrão
                      </label>
                      <Permissao chave="tela_comunicacao.whats_app_instances.qr_recepcao" rotulo="Salvar QR da recepção — Whats App Instances" herda="tela_comunicacao.view">
                        <button type="button" title="Remover" onClick={() => setCfg(c => ({ ...c, encaminhamentos: c.encaminhamentos.filter((_, i) => i !== idx) }))} className="col-span-1 p-2 text-red-500 hover:bg-red-50 rounded-lg justify-self-center"><Trash2 className="w-4 h-4" /></button>
                      </Permissao>
                    </div>
                  ))}
                </div>
                <Permissao chave="tela_comunicacao.whats_app_instances.qr_recepcao" rotulo="Salvar QR da recepção — Whats App Instances" herda="tela_comunicacao.view">
                  <button type="button" onClick={() => setCfg(c => ({ ...c, encaminhamentos: [...c.encaminhamentos, { interesse: '', nome: '', telefone: '', sexo: '', padrao: false }] }))} className="mt-2 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar líder</button>
                </Permissao>

                <h5 className="font-semibold text-slate-900 text-sm mt-4">Avisar cada novo “Quero ser Membro” (site ou agente)</h5>
                <div className="space-y-2 mt-2">
                  {cfg.avisoQueroSerMembro.map((a, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input value={a.nome} placeholder="Nome" onChange={ev => setCfg(c => ({ ...c, avisoQueroSerMembro: c.avisoQueroSerMembro.map((x, i) => i === idx ? { ...x, nome: ev.target.value } : x) }))} className={`${inputCls} col-span-7`} />
                      <input value={a.telefone} placeholder="55DDDnúmero" onChange={ev => setCfg(c => ({ ...c, avisoQueroSerMembro: c.avisoQueroSerMembro.map((x, i) => i === idx ? { ...x, telefone: ev.target.value } : x) }))} className={`${inputCls} col-span-4 font-mono`} />
                      <Permissao chave="tela_comunicacao.whats_app_instances.qr_recepcao" rotulo="Salvar QR da recepção — Whats App Instances" herda="tela_comunicacao.view">
                        <button type="button" title="Remover" onClick={() => setCfg(c => ({ ...c, avisoQueroSerMembro: c.avisoQueroSerMembro.filter((_, i) => i !== idx) }))} className="col-span-1 p-2 text-red-500 hover:bg-red-50 rounded-lg justify-self-center"><Trash2 className="w-4 h-4" /></button>
                      </Permissao>
                    </div>
                  ))}
                </div>
                <Permissao chave="tela_comunicacao.whats_app_instances.qr_recepcao" rotulo="Salvar QR da recepção — Whats App Instances" herda="tela_comunicacao.view">
                  <button type="button" onClick={() => setCfg(c => ({ ...c, avisoQueroSerMembro: [...c.avisoQueroSerMembro, { nome: '', telefone: '' }] }))} className="mt-2 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar contato</button>
                </Permissao>

                <h5 className="font-semibold text-slate-900 text-sm mt-4">Assunto reservado (denúncias, reclamações, situações delicadas)</h5>
                <p className="text-xs text-slate-500 mb-2">
                  Só esta pessoa recebe. Conversa reservada nunca vai para os líderes das áreas nem para o padrão. Sem contato aqui, não vai para ninguém.
                </p>
                <div className="grid grid-cols-12 gap-2 items-center">
                  <input value={cfg.contatoReservado?.nome ?? ''} placeholder="Nome (ex.: Pr. Crimério)"
                    onChange={ev => setCfg(c => ({ ...c, contatoReservado: { nome: ev.target.value, telefone: c.contatoReservado?.telefone ?? '' } }))}
                    className={`${inputCls} col-span-7`} />
                  <input value={cfg.contatoReservado?.telefone ?? ''} placeholder="55DDDnúmero"
                    onChange={ev => setCfg(c => ({ ...c, contatoReservado: { nome: c.contatoReservado?.nome ?? '', telefone: ev.target.value } }))}
                    className={`${inputCls} col-span-5 font-mono`} />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Permissao chave="tela_comunicacao.whats_app_instances.qr_recepcao" rotulo="Salvar QR da recepção — Whats App Instances" herda="tela_comunicacao.view">
                  <button onClick={salvar} disabled={salvando || !chaveNaMensagem || (cfg.ativo && !cfg.agentId)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                    {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar recepção
                  </button>
                </Permissao>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
