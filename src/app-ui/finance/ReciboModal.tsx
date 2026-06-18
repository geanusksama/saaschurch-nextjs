import { useState, useRef, useEffect } from 'react';
import { X, Printer, Download, Camera, Image as ImageIcon, MessageSquare, ZoomIn, ZoomOut, RotateCw, Trash2, Share2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { apiBase } from '../../lib/apiBase';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { convertToJpeg, loadHeic2Any } from '../../lib/imageConverter';

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

function imageToDataUri(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
          const dataURL = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataURL);
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    img.onerror = function (e) {
      reject(e);
    };
    img.src = url;
  });
}

export async function generateReciboPdf(row: ReciboRow, incluirComprovante: boolean, foto: string | null, userName: string) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const valorNum = Number(row.valor);
  const dataFmt = new Date(row.data_lancamento + 'T12:00:00').toLocaleDateString('pt-BR');
  const agora = new Date().toLocaleString('pt-BR');
  const extenso = valorPorExtenso(valorNum);
  const formaPg = row.forma_pg || 'DINHEIRO';
  const docNum = row.legacy_id || row.num_doc || row.id;
  const churchName = row.churches?.name || '';
  const operatorName = userName;

  doc.setFont('Helvetica', 'normal');
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('ADCampinas', 20, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.text(churchName, 20, 26);
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);
  doc.text('RECIBO DE LANÇAMENTO', 20, 38);
  
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 42, 190, 42);
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(`Documento Nº: ${docNum}`, 20, 50);
  doc.text(`Data: ${dataFmt}`, 20, 56);
  doc.text(`Tipo: ${row.tipo}`, 20, 62);
  
  doc.setFont('Helvetica', 'bold');
  doc.text('Favorecido:', 20, 72);
  doc.setFont('Helvetica', 'normal');
  const favorecidoText = row.rol ? `[ROL ${row.rol}] ${row.favorecido || ''}` : (row.favorecido || '');
  doc.text(favorecidoText, 45, 72);
  
  doc.setFont('Helvetica', 'bold');
  doc.text('Categoria / Conta:', 20, 78);
  doc.setFont('Helvetica', 'normal');
  doc.text(row.plano_de_conta || row.categoria || '—', 58, 78);
  
  doc.setFont('Helvetica', 'bold');
  doc.text('Forma de Pagto:', 20, 84);
  doc.setFont('Helvetica', 'normal');
  doc.text(formaPg, 55, 84);
  
  doc.setFont('Helvetica', 'bold');
  doc.text('Valor:', 20, 92);
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text(`R$ ${valorNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 35, 93);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont('Helvetica', 'italic');
  doc.text(`(${extenso})`, 20, 101);
  
  if (row.obs) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text('Observação:', 20, 112);
    doc.setFont('Helvetica', 'normal');
    doc.text(row.obs, 20, 118, { maxWidth: 170 });
  }
  
  doc.line(20, 150, 190, 150);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Operador: ${operatorName}`, 20, 156);
  doc.text(`Emitido em: ${agora}`, 20, 162);

  if (incluirComprovante && foto) {
    try {
      const dataUri = await imageToDataUri(foto);
      doc.addPage();
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('COMPROVANTE ANEXADO', 20, 20);
      doc.line(20, 24, 190, 24);
      doc.addImage(dataUri, 'JPEG', 20, 30, 170, 220, undefined, 'FAST');
    } catch (e) {
      console.error('Falha ao adicionar comprovante ao PDF:', e);
    }
  }

  return doc;
}

export async function printRecibo(row: ReciboRow, incluirComprovante: boolean, foto: string | null) {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || ('ontouchstart' in window);
  
  const userName = row.operador || (() => {
    try { const u = JSON.parse(localStorage.getItem('mrm_user') || '{}'); return u.fullName || u.email || 'Sistema'; } catch { return 'Sistema'; }
  })();

  if (isMobile) {
    try {
      const doc = await generateReciboPdf(row, incluirComprovante, foto, userName);
      const pdfBlob = doc.output('blob');
      const docNum = row.legacy_id || row.num_doc || row.id;
      const fileName = `recibo-${docNum}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Recibo ${docNum}`,
          text: `Recibo de Lançamento`,
        });
      } else {
        doc.save(fileName);
      }
    } catch (e) {
      console.error('Error generating mobile PDF:', e);
    }
    return;
  }

  const valorNum = Number(row.valor);
  const dataFmt = new Date(row.data_lancamento + 'T12:00:00').toLocaleDateString('pt-BR');
  const agora = new Date().toLocaleString('pt-BR');
  const extenso = valorPorExtenso(valorNum);
  const formaPg = row.forma_pg || 'DINHEIRO';
  const docNum = row.legacy_id || row.num_doc || row.id;
  const churchName = row.churches?.name || '';
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recibo ${docNum}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 14px; color:#000; padding:16px; max-width:640px; margin:0 auto; }
    @media (max-width: 600px) {
      body { font-size: 15px; padding: 12px; }
      .title { font-size: 28px !important; }
      th, td { font-size: 12px !important; padding: 6px 8px !important; }
      .t-row { font-size: 14px !important; }
      .t-big { font-size: 16px !important; }
      .btn-print, .btn-close { font-size: 15px !important; padding: 12px 20px !important; }
    }
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
    .action-bar { position:sticky; top:0; z-index:100; display:flex; gap:8px; justify-content:center; padding:8px 12px; background:#fff; border-bottom:2px solid #e2e8f0; margin-bottom:12px; }
    .btn-print { background:#1e293b; color:#fff; border:none; border-radius:8px; padding:10px 24px; font-size:13px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; }
    .btn-close { background:#f1f5f9; color:#475569; border:none; border-radius:8px; padding:10px 18px; font-size:13px; font-weight:bold; cursor:pointer; }
    @media print {
      body { padding:5mm; }
      @page { margin:8mm; size: A4 portrait; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .action-bar { display:none !important; }
    }
  </style>
</head>
<body>
  <div class="action-bar">
    <button class="btn-print" onclick="window.print()">&#128438; Imprimir / Salvar PDF</button>
    <button class="btn-close" onclick="window.close()">&#10005; Fechar</button>
  </div>
  <p class="org">ADCampinas</p>
  <p class="church">${churchName}</p>
  <p class="title">RECIBO</p>
  <p class="subtitle">${row.rol ? 'ROL ' + row.rol + ' - ' : ''}${row.favorecido || ''}</p>
  <hr>
  <p class="info">Número do Documento: ${docNum}</p>
  <p class="info">Referência: ${row.referencia || ''} | <span class="tipo-${row.tipo.toLowerCase()}">${row.tipo}</span></p>
  ${row.obs ? `<p class="info" style="margin-top:4px;padding:4px 6px;background:#f8f9fa;border-left:3px solid #999;"><strong>Obs:</strong> ${row.obs}</p>` : ''}
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

  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  if (!isMobile) {
    printWindow.addEventListener('afterprint', () => printWindow.close());
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
  }
}

// ─── Comprovante Viewer ─────────────────────────────────────────────────────
function ComprovanteViewer({ src, docNum, onClose }: { src: string; docNum: string | number; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error('Falha ao baixar');
      const blob = await res.blob();
      const ext = src.split('.').pop()?.split('?')[0] || 'jpg';
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `comprovante-doc-${docNum}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(src, '_blank');
    } finally {
      setDownloading(false);
    }
  }

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const isPdf = src.toLowerCase().includes('.pdf');

  if (isPdf) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-[#1a1a1a] rounded-2xl shadow-2xl flex flex-col"
          style={{ width: '90vw', maxWidth: 840, height: '88vh' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 flex-shrink-0">
            <span className="text-white text-sm font-medium">Comprovante PDF — Doc {docNum}</span>
            <div className="flex items-center gap-1">
              <button onClick={handleDownload} disabled={downloading} className="p-1.5 rounded hover:bg-white/10 text-white disabled:opacity-50" title="Baixar arquivo"><Download className="w-4 h-4" /></button>
              <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 text-white ml-1" title="Fechar"><X className="w-4 h-4" /></button>
            </div>
          </div>

          {/* PDF viewport */}
          <div className="flex-1 relative overflow-hidden bg-[#111] p-2">
            <iframe
              src={src}
              className="w-full h-full border-0 rounded-lg bg-white"
              title={`Comprovante Doc ${docNum}`}
            />
          </div>
        </div>
      </div>
    );
  }

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
            <button onClick={handleDownload} disabled={downloading} className="p-1.5 rounded hover:bg-white/10 text-white disabled:opacity-50" title="Baixar arquivo"><Download className="w-4 h-4" /></button>
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

  const [displayFoto, setDisplayFoto] = useState<string>('');

  useEffect(() => {
    if (!currentFoto) {
      setDisplayFoto('');
      return;
    }
    
    const urlLower = currentFoto.toLowerCase();
    const isHeic = urlLower.endsWith('.heic') || urlLower.endsWith('.heif');
    let localUrlToRevoke: string | null = null;
    let active = true;

    if (isHeic) {
      const convertHeicUrl = async () => {
        try {
          const res = await fetch(currentFoto);
          if (!res.ok) throw new Error('Fetch failed');
          const blob = await res.blob();
          
          const heic2any = await loadHeic2Any();
          if (heic2any && active) {
            const converted = await heic2any({
              blob: blob,
              toType: 'image/jpeg',
              quality: 0.8,
            });
            const resultBlob = Array.isArray(converted) ? converted[0] : converted;
            const localUrl = URL.createObjectURL(resultBlob);
            localUrlToRevoke = localUrl;
            if (active) {
              setDisplayFoto(localUrl);
            } else {
              URL.revokeObjectURL(localUrl);
            }
          } else {
            if (active) setDisplayFoto(currentFoto);
          }
        } catch (err) {
          console.error('Failed to load HEIC client-side:', err);
          if (active) setDisplayFoto(currentFoto);
        }
      };
      
      convertHeicUrl();
    } else {
      const isStandard = urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg') || urlLower.endsWith('.png') || urlLower.endsWith('.gif') || urlLower.endsWith('.webp');
      if (!isStandard || urlLower.includes('.tiff') || urlLower.includes('.bmp')) {
        setDisplayFoto(`/api/upload/convert-image/${encodeURIComponent(currentFoto)}`);
      } else {
        setDisplayFoto(currentFoto);
      }
    }

    return () => {
      active = false;
      if (localUrlToRevoke) {
        URL.revokeObjectURL(localUrlToRevoke);
      }
    };
  }, [currentFoto]);

  useEffect(() => {
    if (showWhatsappModal) {
      const loadInstancesAndPhone = async () => {
        setLoadingInstances(true);
        try {
          // 1. Fetch member phone if member_id is available
          if (row.member_id) {
            const { data: member } = await supabase
              .from('members')
              .select('phone')
              .eq('id', row.member_id)
              .maybeSingle();
            if (member?.phone) {
              const cleanPhone = member.phone.replace(/\D/g, '');
              if (cleanPhone) {
                if (cleanPhone.length === 10 || cleanPhone.length === 11) {
                  setWhatsappPhone(`55${cleanPhone}`);
                } else {
                  setWhatsappPhone(cleanPhone);
                }
              }
            }
          }

          // 2. Fetch logged-in user profile
          const rawUser = localStorage.getItem('mrm_user');
          if (!rawUser) throw new Error('Usuário não logado');
          const user = JSON.parse(rawUser);

          // 3. Fetch active instances
          const { data: owned } = await supabase
            .from('whatsapp_instances')
            .select('id, name, instance_id, status, is_active, owner_user_id')
            .eq('is_active', true);

          // 4. Fetch shared instances
          const { data: shared } = await supabase
            .from('whatsapp_instance_users')
            .select('instance_id')
            .eq('user_id', user.id);

          const sharedIds = (shared || []).map((s: any) => s.instance_id);

          // Filter instances: master can see all active, other users only owned or shared
          const available = (owned || []).filter((inst: any) => {
            if (user.profileType === 'master') return true;
            return inst.owner_user_id === user.id || sharedIds.includes(inst.id);
          });

          setInstances(available);
          if (available.length > 0) {
            setSelectedInstanceId(available[0].id);
          }
        } catch (err) {
          console.error('Erro ao carregar instâncias:', err);
          toast.error('Erro ao buscar instâncias do WhatsApp');
        } finally {
          setLoadingInstances(false);
        }
      };

      loadInstancesAndPhone();
    }
  }, [showWhatsappModal, row.member_id]);

  const handleSendWhatsapp = async () => {
    const cleanPhone = whatsappPhone.replace(/\D/g, '');
    if (!cleanPhone) {
      toast.error('Por favor, informe um número de telefone válido');
      return;
    }
    if (!selectedInstanceId) {
      toast.error('Selecione uma instância para o envio');
      return;
    }

    setSendingWhatsapp(true);
    try {
      let pdfUrl = '';
      let pdfPublicUrl = '';

      // Generate the PDF blob and upload it
      try {
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const valorNum = Number(row.valor);
        const dataFmt = new Date(row.data_lancamento + 'T12:00:00').toLocaleDateString('pt-BR');
        const agora = new Date().toLocaleString('pt-BR');
        const extenso = valorPorExtenso(valorNum);
        const formaPg = row.forma_pg || 'DINHEIRO';
        const docNum = row.legacy_id || row.num_doc || row.id;
        const churchName = row.churches?.name || '';
        const operatorName = userName;

        doc.setFont('Helvetica', 'normal');
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('ADCampinas', 20, 20);
        
        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);
        doc.text(churchName, 20, 26);
        
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(0, 0, 0);
        doc.text('RECIBO DE LANÇAMENTO', 20, 38);
        
        doc.setDrawColor(200, 200, 200);
        doc.line(20, 42, 190, 42);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(80, 80, 80);
        doc.text(`Documento Nº: ${docNum}`, 20, 50);
        doc.text(`Data: ${dataFmt}`, 20, 56);
        doc.text(`Tipo: ${row.tipo}`, 20, 62);
        
        doc.setFont('Helvetica', 'bold');
        doc.text('Favorecido:', 20, 72);
        doc.setFont('Helvetica', 'normal');
        const favorecidoText = row.rol ? `[ROL ${row.rol}] ${row.favorecido || ''}` : (row.favorecido || '');
        doc.text(favorecidoText, 45, 72);
        
        doc.setFont('Helvetica', 'bold');
        doc.text('Categoria / Conta:', 20, 78);
        doc.setFont('Helvetica', 'normal');
        doc.text(row.plano_de_conta || row.categoria || '—', 58, 78);
        
        doc.setFont('Helvetica', 'bold');
        doc.text('Forma de Pagto:', 20, 84);
        doc.setFont('Helvetica', 'normal');
        doc.text(formaPg, 55, 84);
        
        doc.setFont('Helvetica', 'bold');
        doc.text('Valor:', 20, 92);
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text(`R$ ${valorNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 35, 93);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.setFont('Helvetica', 'italic');
        doc.text(`(${extenso})`, 20, 101);
        
        if (row.obs) {
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(50, 50, 50);
          doc.text('Observação:', 20, 112);
          doc.setFont('Helvetica', 'normal');
          doc.text(row.obs, 20, 118, { maxWidth: 170 });
        }
        
        doc.line(20, 150, 190, 150);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text(`Operador: ${operatorName}`, 20, 156);
        doc.text(`Emitido em: ${agora}`, 20, 162);

        const pdfBlob = doc.output('blob');
        const filename = `recibo_${row.id}_${Date.now()}`;
        const filePath = `recibos/${filename}.pdf`;

        const { error: uploadErr } = await supabase.storage
          .from('dados')
          .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true });

        if (uploadErr) {
          console.error('Erro ao salvar PDF no bucket:', uploadErr);
        } else {
          const { data: urlData } = supabase.storage
            .from('dados')
            .getPublicUrl(filePath);
          
          const publicUrl = urlData?.publicUrl || '';
          pdfPublicUrl = publicUrl;
          pdfUrl = `${window.location.origin}/api/d/${filename}`;
        }
      } catch (errPDF) {
        console.error('Falha ao gerar e salvar PDF:', errPDF);
      }

      const token = localStorage.getItem('mrm_token');
      const res = await fetch('/api/whatsapp/send-tithe-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          memberName: row.favorecido || 'Membro',
          phone: cleanPhone,
          valor: row.valor,
          referencia: row.referencia,
          churchName: row.churches?.name,
          dataLancamento: row.data_lancamento,
          instanceId: selectedInstanceId,
          pdfUrl,
          pdfPublicUrl,
          id: row.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro no envio');
      }

      toast.success('Recibo enviado com sucesso via WhatsApp!');
      setShowWhatsappModal(false);
    } catch (err: any) {
      toast.error('Erro ao enviar recibo: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSendingWhatsapp(false);
    }
  };

  const valorNum = Number(row.valor);
  const dataFmt = new Date(row.data_lancamento + 'T12:00:00').toLocaleDateString('pt-BR');
  const docNum = row.legacy_id || row.num_doc || row.id;
  const shortDoc = String(docNum).length > 12
    ? `${String(docNum).slice(0, 8)}…${String(docNum).slice(-4)}`
    : String(docNum);
  const isReceita = row.tipo === 'RECEITA';
  const userRaw = typeof window !== 'undefined' ? localStorage.getItem('mrm_user') : null;
  const userName = row.operador || (userRaw ? (JSON.parse(userRaw).fullName || JSON.parse(userRaw).email || 'Sistema') : 'Sistema');

  async function handleDownloadPdf() {
    try {
      const doc = await generateReciboPdf(row, incluirComprovante, displayFoto || currentFoto, userName);
      doc.save(`recibo-${docNum}.pdf`);
    } catch (e) {
      console.error('Erro ao baixar PDF:', e);
      toast.error('Erro ao gerar PDF');
    }
  }

  async function handleSharePdf() {
    try {
      const doc = await generateReciboPdf(row, incluirComprovante, displayFoto || currentFoto, userName);
      const pdfBlob = doc.output('blob');
      const fileName = `recibo-${docNum}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Recibo ${docNum} — ${row.churches?.name || ''}`,
          text: `Recibo de Lançamento no valor de R$ ${fmt(valorNum)}`,
        });
      } else if (navigator.share) {
        await navigator.share({
          title: `Recibo ${docNum}`,
          text: `Recibo de Lançamento no valor de R$ ${fmt(valorNum)}`,
        });
      } else {
        doc.save(fileName);
      }
    } catch (e) {
      console.error('Erro ao compartilhar PDF:', e);
      toast.error('Erro ao compartilhar PDF');
    }
  }

  const selectedInstance = instances.find(inst => inst.id === selectedInstanceId);
  const isConnected = selectedInstance?.status === 'connected';

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'disconnected': return 'Desconectado';
      case 'connecting': return 'Conectando...';
      case 'qr_code': return 'Aguardando QR Code';
      default: return 'Desconectado';
    }
  };

  async function handleFotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    e.target.value = '';
    try {
      // Convert to JPEG before uploading
      const convertedFile = await convertToJpeg(file);

      const token = localStorage.getItem('mrm_token');
      const formData = new FormData();
      formData.append('file', convertedFile);

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
      setUploadError('Erro ao enviar foto: ' + ((err as Error)?.message || 'Erro desconhecido'));
    }
    setUploading(false);
  }

  async function handleFotoDelete() {
    setDeleting(true);
    try {
      await supabase.from('livro_caixa').update({ foto: null }).eq('id', row.id);
      setCurrentFoto(null);
      setIncluirComprovante(false);
      onUpdated?.(row.id, { foto: null });
    } catch (err: unknown) {
      setUploadError('Erro ao remover comprovante: ' + ((err as Error)?.message || 'Erro desconhecido'));
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center sm:p-4" onClick={onClose}>
        <div className="bg-white dark:bg-slate-950 w-full h-full sm:h-auto sm:max-w-sm sm:rounded-2xl shadow-2xl flex flex-col justify-between overflow-hidden" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-900 shrink-0">
            <div className="text-center flex-1">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Operação</p>
              <p className="text-[10px] text-slate-400 font-mono">{shortDoc}</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg ml-2">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* Scrollable Receipt Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Receipt Card */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900/50">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-base text-slate-900 dark:text-white">RECIBO</p>
                  <p className="text-xs text-slate-500">{row.churches?.name || '—'}</p>
                </div>
                <p className="text-xs text-slate-400">{dataFmt}</p>
              </div>

              <p className="text-2xl font-bold mb-3 text-slate-900 dark:text-white">
                R$ {fmt(valorNum)}
              </p>

              <div className="space-y-1.5 text-sm">
                {row.favorecido && (
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-24 shrink-0">Favorecido:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {row.rol ? <span className="text-xs text-slate-400 mr-1">ROL {row.rol}</span> : null}
                      {row.favorecido}
                    </span>
                  </div>
                )}
                {row.referencia && (
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-24 shrink-0">Referência:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{row.referencia}</span>
                  </div>
                )}
                {(row.plano_de_conta || row.categoria) && (
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-24 shrink-0">Categoria:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      <span className={`font-bold ${isReceita ? 'text-emerald-600' : 'text-red-600'}`}>{row.tipo}</span>{' - '}{row.plano_de_conta || row.categoria}
                    </span>
                  </div>
                )}
                {row.obs && (
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-24 shrink-0">Observação:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{row.obs}</span>
                  </div>
                )}
                {row.forma_pg && (
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-24 shrink-0">Forma de Pagto:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{row.forma_pg}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
                <span>Doc: {shortDoc}</span>
                <span>Op: {userName}</span>
              </div>

              {/* Comprovante */}
              {currentFoto ? (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <span className="w-4 h-4 bg-green-600 text-white rounded-full flex items-center justify-center text-[10px]">✓</span>
                      Comprovante Anexado
                    </span>
                    <button onClick={() => setShowViewer(true)} className="text-xs text-blue-600 hover:underline">
                      (Ver Imagem)
                    </button>
                    <button onClick={() => setShowDeleteConfirm(true)} disabled={deleting} className="text-xs text-red-500 hover:underline disabled:opacity-50">
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
                    <span className="text-xs text-slate-600 dark:text-slate-400">Incluir comprovante na impressão</span>
                  </label>
                </div>
              ) : null}
            </div>
          </div>

          {/* Action Buttons Section */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-900 bg-slate-50 dark:bg-slate-950 shrink-0">
            <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Opções de Recibo</p>
            <div className="grid grid-cols-3 gap-2">
              {/* Imprimir */}
              <button
                onClick={() => printRecibo(row, incluirComprovante, displayFoto || currentFoto)}
                className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl transition-all border border-slate-200 dark:border-slate-800"
                title="Imprimir"
              >
                <Printer className="w-5 h-5 mb-1.5" />
                <span className="text-[10px] font-medium leading-none">Imprimir</span>
              </button>

              {/* Baixar PDF */}
              <button
                onClick={handleDownloadPdf}
                className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl transition-all border border-slate-200 dark:border-slate-800"
                title="Baixar PDF"
              >
                <Download className="w-5 h-5 mb-1.5" />
                <span className="text-[10px] font-medium leading-none">Baixar PDF</span>
              </button>

              {/* Compartilhar PDF */}
              <button
                onClick={handleSharePdf}
                className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl transition-all border border-slate-200 dark:border-slate-800"
                title="Compartilhar"
              >
                <Share2 className="w-5 h-5 mb-1.5" />
                <span className="text-[10px] font-medium leading-none">Compartilhar</span>
              </button>

              {/* Anexar */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl transition-all border border-slate-200 dark:border-slate-800 disabled:opacity-50"
                title="Anexar"
              >
                {uploading ? (
                  <div className="w-5 h-5 mb-1.5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 mb-1.5" />
                )}
                <span className="text-[10px] font-medium leading-none">Anexar</span>
              </button>

              {/* Ver Comprovante */}
              <button
                onClick={() => currentFoto ? setShowViewer(true) : undefined}
                disabled={!currentFoto}
                className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all border ${
                  currentFoto
                    ? 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800'
                    : 'bg-white/50 dark:bg-slate-900/30 text-slate-300 dark:text-slate-700 border-slate-100 dark:border-slate-900/50 cursor-not-allowed'
                }`}
                title="Ver Comprovante"
              >
                <ImageIcon className="w-5 h-5 mb-1.5" />
                <span className="text-[10px] font-medium leading-none">Ver Anexo</span>
              </button>

              {/* WhatsApp */}
              <button
                onClick={() => setShowWhatsappModal(true)}
                className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl transition-all border border-slate-200 dark:border-slate-800"
                title="Enviar WhatsApp"
              >
                <MessageSquare className="w-5 h-5 mb-1.5" />
                <span className="text-[10px] font-medium leading-none">WhatsApp</span>
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
          src={displayFoto || currentFoto}
          docNum={docNum || ''}
          onClose={() => setShowViewer(false)}
        />
      )}

      {/* Confirmar remoção de comprovante */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !deleting && setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-xs p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Remover comprovante?</h3>
            <p className="text-sm text-slate-500 mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleFotoDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {deleting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                {deleting ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Erro de upload/delete */}
      {uploadError && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setUploadError(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-xs p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Erro</h3>
            <p className="text-sm text-slate-600 mb-5">{uploadError}</p>
            <button
              onClick={() => setUploadError(null)}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      {showWhatsappModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !sendingWhatsapp && setShowWhatsappModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Enviar via WhatsApp
            </h3>

            {loadingInstances ? (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-slate-500">Buscando instâncias autorizadas...</p>
              </div>
            ) : instances.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-slate-600 mb-4">Nenhuma instância do WhatsApp conectada e autorizada para você.</p>
                <button
                  onClick={() => setShowWhatsappModal(false)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Instance Select */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Instância de Envio
                  </label>
                  <select
                    value={selectedInstanceId}
                    onChange={e => setSelectedInstanceId(e.target.value)}
                    className="w-full rounded-lg border-slate-200 text-sm focus:border-slate-500 focus:ring-slate-500 bg-white"
                  >
                    {instances.map(inst => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} ({getStatusLabel(inst.status)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Phone Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    WhatsApp do Destinatário
                  </label>
                  <input
                    type="text"
                    value={whatsappPhone}
                    onChange={e => setWhatsappPhone(e.target.value)}
                    placeholder="Ex: 5511999999999"
                    className="w-full rounded-lg border-slate-200 text-sm focus:border-slate-500 focus:ring-slate-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Insira o número com o DDI (ex: 55) e DDD. Exemplo: 5511999999999
                  </p>
                </div>

                {/* Alert/Tip when not connected */}
                {selectedInstance && !isConnected && (
                  <p className="text-xs text-red-500 font-medium leading-relaxed bg-red-50 border border-red-100 rounded-lg p-2.5">
                    ⚠️ Instância desconectada. Acesse o menu &quot;Instâncias WhatsApp&quot; para conectar.
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowWhatsappModal(false)}
                    disabled={sendingWhatsapp}
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSendWhatsapp}
                    disabled={sendingWhatsapp || !isConnected}
                    className="flex-1 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {sendingWhatsapp ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Enviar Recibo'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
