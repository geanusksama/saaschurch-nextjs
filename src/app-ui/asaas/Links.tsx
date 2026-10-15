/**
 * Pagamentos › Links e campanhas: links do Asaas para divulgar fora do app
 * (WhatsApp, telão, cartaz) — oferta com valor livre, campanha, inscrição de
 * evento, contribuição mensal. O QR é gerado do próprio link.
 */
import { useState } from 'react';
import { Copy, Download, ExternalLink, Link2, MessageCircle, Pencil, Plus, Power } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { usePermissions } from '../../lib/usePermissions';
import { api, brl, Botao, Campo, Cartao, Carregando, copiar, dataBr, Erro, Gaveta, inputCls, Interruptor, perfilAtual, Qr, useDados, Vazio } from './comum';

interface LinkP {
  id: string; nome: string; descricao: string | null; finalidade: string; valor: number | null; forma: string; tipoCobranca: string;
  maxParcelas: number; ciclo: string | null; url: string; ativo: boolean; encerraEm: string | null; recebido: number; pagamentos: number;
}
const FINALIDADES: Record<string, string> = { OFERTA: 'Oferta', DIZIMO: 'Dízimo', CAMPANHA: 'Campanha', EVENTO: 'Evento / inscrição', OUTRO: 'Outro' };
const VAZIO = { nome: '', descricao: '', finalidade: 'OFERTA', valor: '', pix: true, credito: true, boleto: false, maxParcelas: 1, recorrente: false, encerraEm: '' };

export default function Links() {
  const { canCreate, canEdit } = usePermissions(perfilAtual());
  const { dados, erro, carregando, recarregar } = useDados<LinkP[]>('links');
  const [form, setForm] = useState<typeof VAZIO | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [qr, setQr] = useState<LinkP | null>(null);

  function abrir(l?: LinkP) {
    setEditando(l?.id ?? null);
    setForm(l ? {
      nome: l.nome, descricao: l.descricao ?? '', finalidade: l.finalidade, valor: l.valor === null ? '' : String(l.valor).replace('.', ','),
      pix: l.forma === 'PIX' || l.forma === 'UNDEFINED', credito: l.forma === 'CREDIT_CARD' || l.forma === 'UNDEFINED', boleto: l.forma === 'BOLETO',
      maxParcelas: l.maxParcelas, recorrente: l.tipoCobranca === 'RECURRENT', encerraEm: l.encerraEm ?? '',
    } : { ...VAZIO });
  }

  async function salvar() {
    if (!form) return;
    setSalvando(true);
    try {
      const valor = form.valor.trim() ? Number(form.valor.replace(/\./g, '').replace(',', '.')) : null;
      await api(editando ? `link/${editando}` : 'link', { method: 'POST', body: { ...form, valor, encerraEm: form.encerraEm || null } });
      toast.success(editando ? 'Link atualizado' : 'Link criado');
      setForm(null);
      recarregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(l: LinkP) {
    try {
      await api(`link/${l.id}/${l.ativo ? 'desativar' : 'ativar'}`, { method: 'POST' });
      recarregar();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function baixarQr(l: LinkP) {
    const url = await QRCode.toDataURL(l.url, { width: 1024, margin: 2 });
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${l.nome.replace(/\W+/g, '-').toLowerCase()}.png`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-slate-500">Cada pagamento feito por um link aparece em Contribuições e vendas, com a origem &ldquo;Link de pagamento&rdquo;.</p>
        {canCreate('asaas_pagamentos') && <Botao onClick={() => abrir()}><Plus className="w-4 h-4" />Novo link</Botao>}
      </div>
      {erro && <Erro msg={erro} onTentar={recarregar} />}
      {carregando && !dados ? <Carregando /> : dados && dados.length === 0 ? (
        <Cartao><Vazio icone={Link2} titulo="Nenhum link ainda" sub="Crie um link de oferta com valor livre para o telão, ou um link de campanha para o WhatsApp." /></Cartao>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {dados?.map((l) => (
            <Cartao key={l.id} className={`p-4 flex flex-col gap-3 ${l.ativo ? '' : 'opacity-60'}`}>
              <div className="flex items-start gap-3">
                <button onClick={() => setQr(l)} title="Ver QR"><Qr texto={l.url} tamanho={64} /></button>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{l.nome}</p>
                  <p className="text-xs text-slate-500">{FINALIDADES[l.finalidade] ?? l.finalidade} · {l.valor === null ? 'valor livre' : brl(l.valor)}{l.tipoCobranca === 'RECURRENT' ? ' · mensal' : l.maxParcelas > 1 ? ` · até ${l.maxParcelas}x` : ''}</p>
                  <p className="text-xs text-slate-500">{l.forma === 'UNDEFINED' ? 'Pix, cartão e mais' : l.forma === 'PIX' ? 'Só Pix' : l.forma === 'CREDIT_CARD' ? 'Só cartão' : 'Boleto'}{l.encerraEm ? ` · até ${dataBr(l.encerraEm)}` : ''}</p>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${l.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{l.ativo ? 'Ativo' : 'Inativo'}</span>
              </div>
              <div className="flex items-baseline justify-between text-sm"><span className="text-slate-500">{l.pagamentos} pagamentos</span><span className="font-bold">{brl(l.recebido)}</span></div>
              <div className="flex flex-wrap gap-1.5">
                <Botao tipo="secundario" className="!px-2.5 !py-1.5" onClick={() => copiar(l.url, 'Link copiado')}><Copy className="w-3.5 h-3.5" />Copiar</Botao>
                <a href={`https://wa.me/?text=${encodeURIComponent(`${l.nome}: ${l.url}`)}`} target="_blank" rel="noreferrer"><Botao tipo="secundario" className="!px-2.5 !py-1.5"><MessageCircle className="w-3.5 h-3.5" /></Botao></a>
                <a href={l.url} target="_blank" rel="noreferrer"><Botao tipo="secundario" className="!px-2.5 !py-1.5"><ExternalLink className="w-3.5 h-3.5" /></Botao></a>
                <Botao tipo="secundario" className="!px-2.5 !py-1.5" title="Baixar QR para imprimir" onClick={() => baixarQr(l)}><Download className="w-3.5 h-3.5" /></Botao>
                {canEdit('asaas_pagamentos') && <Botao tipo="secundario" className="!px-2.5 !py-1.5" onClick={() => abrir(l)}><Pencil className="w-3.5 h-3.5" /></Botao>}
                {canEdit('asaas_pagamentos') && <Botao tipo="fantasma" className="!px-2.5 !py-1.5" title={l.ativo ? 'Desativar' : 'Ativar'} onClick={() => alternar(l)}><Power className="w-3.5 h-3.5" /></Botao>}
              </div>
            </Cartao>
          ))}
        </div>
      )}

      <Gaveta aberta={Boolean(form)} onFechar={() => setForm(null)} titulo={editando ? 'Editar link' : 'Novo link de pagamento'}>
        {form && (
          <div className="space-y-4">
            <Campo rotulo="Nome (aparece na página de pagamento)"><input className={inputCls} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Ofertas · Culto de domingo" /></Campo>
            <Campo rotulo="Descrição"><textarea className={inputCls} rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Finalidade">
                <select className={inputCls} value={form.finalidade} onChange={(e) => setForm({ ...form, finalidade: e.target.value })}>
                  {Object.entries(FINALIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Valor (R$)" ajuda="Em branco: a pessoa digita quanto quer dar.">
                <input className={inputCls} value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="Valor livre" inputMode="decimal" />
              </Campo>
            </div>
            <Cartao className="p-4 space-y-3">
              <p className="text-sm font-bold">Formas de pagamento</p>
              <Interruptor ligado={form.pix} onChange={(v) => setForm({ ...form, pix: v })} rotulo="Pix" sub="Cai na hora" />
              <Interruptor ligado={form.credito} onChange={(v) => setForm({ ...form, credito: v })} rotulo="Cartão (crédito e débito)" sub="Débito só pela página do Asaas" />
              <Interruptor ligado={form.boleto} onChange={(v) => setForm({ ...form, boleto: v })} rotulo="Boleto" />
              {form.credito && !form.recorrente && (
                <Campo rotulo="Parcelar no crédito em até">
                  <select className={inputCls} value={form.maxParcelas} onChange={(e) => setForm({ ...form, maxParcelas: Number(e.target.value) })}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}x`}</option>)}
                  </select>
                </Campo>
              )}
              <Interruptor ligado={form.recorrente} onChange={(v) => setForm({ ...form, recorrente: v })} rotulo="Cobrar todo mês" sub="Vira contribuição mensal (precisa de valor fixo)" />
            </Cartao>
            <Campo rotulo="Encerrar em (opcional)"><input type="date" className={inputCls} value={form.encerraEm} onChange={(e) => setForm({ ...form, encerraEm: e.target.value })} /></Campo>
            <div className="flex justify-end gap-2"><Botao tipo="secundario" onClick={() => setForm(null)}>Cancelar</Botao><Botao carregando={salvando} onClick={salvar}>{editando ? 'Salvar' : 'Criar link'}</Botao></div>
          </div>
        )}
      </Gaveta>

      {qr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setQr(null)} />
          <Cartao className="relative p-6 text-center">
            <p className="font-bold mb-3">{qr.nome}</p>
            <Qr texto={qr.url} tamanho={300} />
            <div className="flex justify-center gap-2 mt-4"><Botao onClick={() => baixarQr(qr)}><Download className="w-4 h-4" />Baixar PNG</Botao><Botao tipo="secundario" onClick={() => setQr(null)}>Fechar</Botao></div>
          </Cartao>
        </div>
      )}
    </div>
  );
}
