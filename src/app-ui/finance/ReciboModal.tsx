import { useState, useRef, useEffect } from 'react';
import { X, Printer, Download, Camera, Image as ImageIcon, MessageSquare, ZoomIn, ZoomOut, RotateCw, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export type ReciboRow = {
  id: string;
  legacy_id: number | null;
  data_lancamento: string;
  tipo: 'RECEITA' | 'DESPESA';
  valor: number;
  favorecido: string | null;
  rol: string | null;
  plano_de_conta: string | null;
  categoria: string | null;
  forma_pg: string | null;
  referencia: string | null;
  obs: string | null;
  foto: string | null;
  num_doc: string | null;
  tipo_documento: string | null;
  member_id: string | null;
  operador: string | null;
  churches: { name: string } | null;
};

type Props = {
  row: ReciboRow;
  onClose: () => void;
  onUpdated?: (id: string, changes: Partial<ReciboRow>) => void;
};

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function valorPorExtenso(valor: number): string {
  const v = Math.round(valor * 100);
  const reais = Math.floor(v / 100);
  const centavos = v % 100;

  const U = ['', 'UM', 'DOIS', 'TRÊS', 'QUATRO', 'CINCO', 'SEIS', 'SETE', 'OITO', 'NOVE',
    'DEZ', 'ONZE', 'DOZE', 'TREZE', 'QUATORZE', 'QUINZE', 'DEZESSEIS', 'DEZESSETE', 'DEZOITO', 'DEZENOVE'];
  const D = ['', '', 'VINTE', 'TRINTA', 'QUARENTA', 'CINQUENTA', 'SESSENTA', 'SETENTA', 'OITENTA', 'NOVENTA'];
  const C = ['', 'CENTO', 'DUZENTOS', 'TREZENTOS', 'QUATROCENTOS', 'QUINHENTOS', 'SEISCENTOS', 'SETECENTOS', 'OITOCENTOS', 'NOVECENTOS'];

  function num(n: number): string {
    if (n === 0) return '';
    if (n === 100) return 'CEM';
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;
    const parts: string[] = [];
    if (c) parts.push(C[c]);
    if (d >= 2) { parts.push(D[d]); if (u) parts.push(U[u]); }
    else if (d === 1) parts.push(U[10 + u]);
    else if (u) parts.push(U[u]);
    return parts.join(' E ');
  }

  if (reais === 0 && centavos === 0) return 'ZERO REAIS';

  const parts: string[] = [];
  const mil = Math.floor(reais / 1000);
  const resto = reais % 1000;
  if (mil > 0) parts.push(mil === 1 ? 'MIL' : num(mil) + ' MIL');
  if (resto > 0) parts.push(num(resto));

  let result = '';
  if (reais > 0) result = parts.join(' E ') + (reais === 1 ? ' REAL' : ' REAIS');

  if (centavos > 0) {
    const cs = centavos < 20
      ? U[centavos]
      : D[Math.floor(centavos / 10)] + (centavos % 10 ? ' E ' + U[centavos % 10] : '');
    if (result) result += ' E ';
    result += cs + (centavos === 1 ? ' CENTAVO' : ' CENTAVOS');
  }
  return result;
}

export function printRecibo(row: ReciboRow, incluirComprovante: boolean, foto: string | null) {
  const valorNum = Number(row.valor);
  const dataFmt = new Date(row.data_lancamento + 'T12:00:00').toLocaleDateString('pt-BR');
  const agora = new Date().toLocaleString('pt-BR');
  const extenso = valorPorExtenso(valorNum);
  const formaPg = row.forma_pg || 'DINHEIRO';
  const docNum = row.legacy_id || row.num_doc || row.id;
  const churchName = row.churches?.name || '';

  const userName = row.operador || (() => {
    try { const u = JSON.parse(localStorage.getItem('mrm_user') || '{}'); return u.fullName || u.email || 'Sistema'; } catch { return 'Sistema'; }
  })();
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Recibo ${docNum}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color:#000; padding:20px; max-width:580px; }
    .org { font-size:9px; color:#555; margin-bottom:2px; }
    .church { font-size:11px; color:#333; margin-bottom:10px; }
    .title { font-size:24px; font-weight:bold; letter-spacing:1px; margin-bottom:2px; }
    .subtitle { font-size:11px; color:#333; margin-bottom:14px; }
    hr { border:none; border-top:1px dashed #aaa; margin:8px 0; }
    .info { font-size:11px; margin:3px 0; }
    .info .tipo-receita { color:#16a34a; font-weight:bold; }
    .info .tipo-despesa { color:#c00; font-weight:bold; }
    table { width:100%; border-collapse:collapse; margin:8px 0; }
    th { background:#eee; text-align:left; padding:4px 6px; font-size:9px; text-transform:uppercase; border-bottom:1px solid #ccc; }
    td { padding:4px 6px; font-size:10px; border-bottom:1px solid #f0f0f0; }
    .totals { margin-top:6px; }
    .t-row { display:flex; justify-content:space-between; padding:2px 6px; font-size:11px; }
    .t-big { font-size:13px; font-weight:bold; }
    .extenso { text-align:center; font-size:9px; color:#555; margin:6px 0 0; }
    .footer { margin-top:20px; font-size:9px; color:#666; border-top:1px solid #eee; padding-top:8px; }
    .comp-section { margin-top:12px; page-break-inside: avoid; }
    .comp-title { font-size:11px; font-weight:bold; text-transform:uppercase; margin-bottom:6px; }
    .comp-img { max-width:100%; max-height:160mm; object-fit:contain; border:1px solid #ddd; display:block; }
    @media print {
      body { padding:5mm; }
      @page { margin:8mm; size: A4 portrait; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <p class="org">ADCampinas</p>
  <p class="church">${churchName}</p>
  <p class="title">RECIBO</p>
  <p class="subtitle">${row.rol ? 'ROL ' + row.rol + ' - ' : ''}${row.favorecido || ''}</p>
  <hr>
  <p class="info">Número do Documento: ${docNum}</p>
  <p class="info">Referência: ${row.referencia || ''} | <span class="tipo-${row.tipo.toLowerCase()}">${row.tipo}</span></p>
  <hr>
  <table>
    <thead>
      <tr>
        <th>REF/DATA</th>
        <th>CONTA - CATEGORIA</th>
        <th>FORMA PAGTO</th>
        <th style="text-align:right">VALOR</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${dataFmt}</td>
        <td>${row.plano_de_conta || row.categoria || ''} - ${row.tipo}</td>
        <td>${formaPg}</td>
        <td style="text-align:right">R$ ${fmt(valorNum)}</td>
      </tr>
    </tbody>
  </table>
  <hr>
  <div class="totals">
    <div class="t-row"><span>${formaPg}:</span><span>R$ ${fmt(valorNum)}</span></div>
    <div class="t-row t-big"><span>Total geral:</span><span>R$ ${fmt(valorNum)}</span></div>
  </div>
  <p class="extenso">VALOR TOTAL POR EXTENSO: ${extenso}</p>
  <div class="footer">
    <p>Lançado por: ${userName}</p>
    <p>Emitido em: ${agora}</p>
  </div>
  ${incluirComprovante && foto ? `
  <div class="comp-section">
    <hr>
    <p class="comp-title">COMPROVANTE ANEXADO</p>
    <img class="comp-img" src="${foto}" alt="Comprovante" />
  </div>` : ''}
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open();
  doc.write(html);
  doc.close();
  iframe.contentWindow?.addEventListener('afterprint', () => document.body.removeChild(iframe));
  setTimeout(() => iframe.contentWindow?.print(), 500);
}

// ─── Comprovante Viewer ─────────────────────────────────────────────────────
function ComprovanteViewer({ src, docNum, onClose }: { src: string; docNum: string | number; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setScale(s => Math.max(0.2, Math.min(10, +(s + delta).toFixed(2))));
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging || !dragStart.current) return;
    setPos({
      x: dragStart.current.px + (e.clientX - dragStart.current.mx),
      y: dragStart.current.py + (e.clientY - dragStart.current.my),
    });
  }

  function handleMouseUp() {
    setDragging(false);
    dragStart.current = null;
  }

  function resetView() {
    setScale(1);
    setPos({ x: 0, y: 0 });
    setRotation(0);
  }

  const zoomPct = Math.round(scale * 100);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#1a1a1a] rounded-2xl shadow-2xl flex flex-col"
        style={{ width: '90vw', maxWidth: 740, height: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 flex-shrink-0">
          <span className="text-white text-sm font-medium">Comprovante — Doc {docNum}</span>
          <div className="flex items-center gap-1">
            <span className="text-white/50 text-xs mr-2 min-w-[40px] text-right">{zoomPct}%</span>
            <button onClick={() => setScale(s => Math.max(0.2, +(s - 0.2).toFixed(2)))} className="p-1.5 rounded hover:bg-white/10 text-white" title="Diminuir"><ZoomOut className="w-4 h-4" /></button>
            <button onClick={() => setScale(s => Math.min(10, +(s + 0.2).toFixed(2)))} className="p-1.5 rounded hover:bg-white/10 text-white" title="Ampliar"><ZoomIn className="w-4 h-4" /></button>
            <button onClick={resetView} className="p-1.5 rounded hover:bg-white/10 text-white" title="Resetar view"><RotateCw className="w-4 h-4" /></button>
            <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1.5 rounded hover:bg-white/10 text-white text-sm font-bold px-2" title="Girar">↻</button>
            <a href={src} download className="p-1.5 rounded hover:bg-white/10 text-white" title="Download"><Download className="w-4 h-4" /></a>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 text-white ml-1" title="Fechar"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Image viewport — overflow hidden, image freely moves via transform */}
        <div
          className="flex-1 relative overflow-hidden"
          style={{ background: '#111', cursor: dragging ? 'grabbing' : 'grab' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotate(${rotation}deg) scale(${scale})`,
              transformOrigin: 'center center',
              transition: dragging ? 'none' : 'transform 0.08s ease-out',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            <img
              src={src}
              alt="Comprovante"
              draggable={false}
              style={{
                maxWidth: '70vw',
                maxHeight: '72vh',
                display: 'block',
                borderRadius: 4,
                boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
              }}
            />
          </div>
        </div>

        {/* Hint */}
        <div className="px-4 py-1.5 text-center text-white/30 text-[10px] flex-shrink-0 border-t border-white/10">
          Use o scroll do mouse para zoom • Clique e arraste para mover • ESC para fechar
        </div>
      </div>
    </div>
  );
}

// ─── Main Modal ─────────────────────────────────────────────────────────────
export function ReciboModal({ row, onClose, onUpdated }: Props) {
  const [incluirComprovante, setIncluirComprovante] = useState(!!row.foto);
  const [currentFoto, setCurrentFoto] = useState(row.foto);
  const [showViewer, setShowViewer] = useState(false);
  const [showObs, setShowObs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const valorNum = Number(row.valor);
  const dataFmt = new Date(row.data_lancamento + 'T12:00:00').toLocaleDateString('pt-BR');
  const docNum = row.legacy_id || row.num_doc || row.id;
  const shortDoc = String(docNum).length > 12
    ? `${String(docNum).slice(0, 8)}…${String(docNum).slice(-4)}`
    : String(docNum);
  const isReceita = row.tipo === 'RECEITA';
  const userRaw = typeof window !== 'undefined' ? localStorage.getItem('mrm_user') : null;
  const userName = row.operador || (userRaw ? (JSON.parse(userRaw).fullName || JSON.parse(userRaw).email || 'Sistema') : 'Sistema');

  async function handleFotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    e.target.value = '';
    try {
      const token = localStorage.getItem('mrm_token');
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload/foto-despesa', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Falha no upload');

      const newUrl = result.url as string;
      await supabase.from('livro_caixa').update({ foto: newUrl }).eq('id', row.id);
      setCurrentFoto(newUrl);
      setIncluirComprovante(true);
      onUpdated?.(row.id, { foto: newUrl });
    } catch (err: unknown) {
      alert('Erro ao enviar foto: ' + ((err as Error)?.message || 'Erro desconhecido'));
    }
    setUploading(false);
  }

  async function handleFotoDelete() {
    if (!confirm('Remover comprovante anexado?')) return;
    setDeleting(true);
    await supabase.from('livro_caixa').update({ foto: null }).eq('id', row.id);
    setCurrentFoto(null);
    setIncluirComprovante(false);
    onUpdated?.(row.id, { foto: null });
    setDeleting(false);
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="text-center flex-1">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Operação</p>
              <p className="text-[10px] text-slate-400 font-mono">{shortDoc}</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg ml-2">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* Receipt Card */}
          <div className="mx-4 mb-3 border border-slate-200 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-bold text-base text-slate-900">RECIBO</p>
                <p className="text-xs text-slate-500">{row.churches?.name || '—'}</p>
              </div>
              <p className="text-xs text-slate-400">{dataFmt}</p>
            </div>

            <p className={`text-2xl font-bold mb-3 ${isReceita ? 'text-slate-900' : 'text-slate-900'}`}>
              R$ {fmt(valorNum)}
            </p>

            <div className="space-y-1.5 text-sm">
              {row.favorecido && (
                <div className="flex gap-2">
                  <span className="text-slate-500 w-24 shrink-0">Favorecido:</span>
                  <span className="font-medium text-slate-800">
                    {row.rol ? <span className="text-xs text-slate-400 mr-1">ROL {row.rol}</span> : null}
                    {row.favorecido}
                  </span>
                </div>
              )}
              {row.referencia && (
                <div className="flex gap-2">
                  <span className="text-slate-500 w-24 shrink-0">Referência:</span>
                  <span className="font-medium text-slate-800">{row.referencia}</span>
                </div>
              )}
              {(row.plano_de_conta || row.categoria) && (
                <div className="flex gap-2">
                  <span className="text-slate-500 w-24 shrink-0">Categoria:</span>
                  <span className="font-medium text-slate-800">
                    <span className={`font-bold ${isReceita ? 'text-emerald-600' : 'text-red-600'}`}>{row.tipo}</span>{' - '}{row.plano_de_conta || row.categoria}
                  </span>
                </div>
              )}
              {row.obs && (
                <div className="flex gap-2">
                  <span className="text-slate-500 w-24 shrink-0">Observação:</span>
                  <span className="font-medium text-slate-800">{row.obs}</span>
                </div>
              )}
              {row.forma_pg && (
                <div className="flex gap-2">
                  <span className="text-slate-500 w-24 shrink-0">Forma de Pagto:</span>
                  <span className="font-medium text-slate-800">{row.forma_pg}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400">
              <span>Doc: {shortDoc}</span>
              <span>Op: {userName}</span>
            </div>

            {/* Comprovante */}
            {currentFoto ? (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <span className="w-4 h-4 bg-green-600 text-white rounded-full flex items-center justify-center text-[10px]">✓</span>
                    Comprovante Anexado
                  </span>
                  <button onClick={() => setShowViewer(true)} className="text-xs text-blue-600 hover:underline">
                    (Ver Imagem)
                  </button>
                  <button onClick={handleFotoDelete} disabled={deleting} className="text-xs text-red-500 hover:underline disabled:opacity-50">
                    {deleting ? '...' : '(Deletar)'}
                  </button>
                </div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={incluirComprovante}
                    onChange={e => setIncluirComprovante(e.target.checked)}
                    className="rounded border-slate-300 text-slate-700"
                  />
                  <span className="text-xs text-slate-600">Incluir comprovante na impressão</span>
                </label>
              </div>
            ) : null}

            {/* Obs */}
            {row.obs && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Observação:</p>
                <p className="text-sm text-slate-700">{row.obs}</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="px-4 pb-5">
            <p className="text-center text-xs text-slate-400 mb-3">Opções</p>
            <div className="flex items-center justify-center gap-3">
              {/* Imprimir */}
              <button
                onClick={() => { printRecibo(row, incluirComprovante, currentFoto); onClose(); }}
                className="w-12 h-12 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl flex items-center justify-center transition-colors"
                title="Imprimir Recibo"
              >
                <Printer className="w-5 h-5" />
              </button>

              {/* Download */}
              <button
                onClick={() => { printRecibo(row, incluirComprovante, currentFoto); onClose(); }}
                className="w-12 h-12 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl flex items-center justify-center transition-colors"
                title="Download PDF"
              >
                <Download className="w-5 h-5" />
              </button>

              {/* Câmera - Anexar foto */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-12 h-12 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-2xl flex items-center justify-center transition-colors disabled:opacity-50"
                title="Anexar Comprovante"
              >
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-5 h-5" />
                )}
              </button>

              {/* Ver imagem */}
              <button
                onClick={() => currentFoto ? setShowViewer(true) : undefined}
                disabled={!currentFoto}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                  currentFoto
                    ? 'bg-slate-800 hover:bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                }`}
                title="Ver Comprovante"
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              {/* Observações */}
              <button
                onClick={() => setShowObs(s => !s)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                  showObs ? 'bg-slate-800 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
                title="Observações"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFotoUpload}
          />
        </div>
      </div>

      {/* Comprovante Viewer */}
      {showViewer && currentFoto && (
        <ComprovanteViewer
          src={currentFoto}
          docNum={docNum || ''}
          onClose={() => setShowViewer(false)}
        />
      )}
    </>
  );
}
