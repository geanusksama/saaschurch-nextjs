import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { usePermissions } from '../../lib/usePermissions';

// ─── Types ────────────────────────────────────────────────────────────────────
type RibbonTab = 'home' | 'insert' | 'data' | 'view' | 'arquivo' | 'table';
type InsertMode = 'text' | 'table' | 'list';

interface MemberRow {
  id: string;
  name: string;
  rol?: string;
  baptism_date?: string;
  phone?: string;
  address?: string;
  church_id?: string;
  church_name?: string;
  regional_name?: string;
  photo_url?: string;
}
interface Regional { id: string; name: string; }
interface Church { id: string; name: string; regional_id: string; }
interface DocFile { name: string; displayName: string; updated_at: string; path: string; }
interface StoredUser { profileType?: string; churchId?: string; regionalId?: string; campoId?: string; }

// ─── Template definitions ─────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'blank', name: 'Em Branco', icon: '📄',
    html: '',
  },
  {
    id: 'carta_recomendacao', name: 'Carta de Recomendação', icon: '📜',
    html: `<p style="text-align:center"><strong>ASSEMBLEIA DE DEUS</strong></p><p style="text-align:center"><strong>CARTA DE RECOMENDAÇÃO</strong></p><br/><p>Prezados irmãos,</p><br/><p>É com grande satisfação que recomendamos o(a) irmão(ã) <strong>[NOME DO MEMBRO]</strong>, portador(a) do ROL nº <strong>[ROL]</strong>, batizado(a) em <strong>[DATA DE BATISMO]</strong>, membro desta congregação.</p><br/><p>O(A) referido(a) irmão(ã) manteve excelente conduta cristã durante sua permanência em nossa igreja, sendo um(a) fiel servo(a) do Senhor.</p><br/><p>Recomendamos-o(a) à comunhão e ao companheirismo daquela congregação, pedindo a Deus que abençoe abundantemente sua vida e ministério.</p><br/><p style="text-align:right">_____________, ____ de _____________ de _______.</p><br/><br/><p style="text-align:center">_____________________________________________</p><p style="text-align:center">Pastor Responsável</p>`,
  },
  {
    id: 'lista_membros', name: 'Lista de Membros', icon: '📋',
    html: `<p style="text-align:center"><strong>ASSEMBLEIA DE DEUS</strong></p><p style="text-align:center"><strong>LISTA DE MEMBROS</strong></p><p style="text-align:center">Data: ${new Date().toLocaleDateString('pt-BR')}</p><br/><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#e2e8f0;"><th style="border:1px solid #94a3b8;padding:6px 8px;text-align:left;">ROL</th><th style="border:1px solid #94a3b8;padding:6px 8px;text-align:left;">Nome</th><th style="border:1px solid #94a3b8;padding:6px 8px;text-align:left;">Igreja</th><th style="border:1px solid #94a3b8;padding:6px 8px;text-align:left;">Batismo</th></tr></thead><tbody><tr><td style="border:1px solid #94a3b8;padding:6px 8px;"></td><td style="border:1px solid #94a3b8;padding:6px 8px;"></td><td style="border:1px solid #94a3b8;padding:6px 8px;"></td><td style="border:1px solid #94a3b8;padding:6px 8px;"></td></tr></tbody></table>`,
  },
  {
    id: 'lista_batismo', name: 'Lista de Batismo', icon: '💧',
    html: `<p style="text-align:center"><strong>ASSEMBLEIA DE DEUS</strong></p><p style="text-align:center"><strong>LISTA DE CANDIDATOS AO BATISMO</strong></p><p style="text-align:center">Data: ${new Date().toLocaleDateString('pt-BR')}</p><br/><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#dbeafe;"><th style="border:1px solid #93c5fd;padding:6px 8px;">#</th><th style="border:1px solid #93c5fd;padding:6px 8px;text-align:left;">Nome</th><th style="border:1px solid #93c5fd;padding:6px 8px;text-align:left;">Telefone</th><th style="border:1px solid #93c5fd;padding:6px 8px;text-align:left;">Observação</th></tr></thead><tbody><tr><td style="border:1px solid #93c5fd;padding:6px 8px;">1</td><td style="border:1px solid #93c5fd;padding:6px 8px;"></td><td style="border:1px solid #93c5fd;padding:6px 8px;"></td><td style="border:1px solid #93c5fd;padding:6px 8px;"></td></tr></tbody></table>`,
  },
  {
    id: 'ata', name: 'Ata de Reunião', icon: '📝',
    html: `<p style="text-align:center"><strong>ASSEMBLEIA DE DEUS</strong></p><p style="text-align:center"><strong>ATA DE REUNIÃO</strong></p><br/><p>Aos <strong>___</strong> dias do mês de <strong>_______________</strong> de <strong>_______</strong>, às <strong>___:___</strong> horas, reuniram-se os membros da Assembleia de Deus para tratar dos seguintes assuntos:</p><br/><p><strong>Pauta:</strong></p><ol><li>&nbsp;</li><li>&nbsp;</li><li>&nbsp;</li></ol><br/><p><strong>Deliberações:</strong></p><p>&nbsp;</p><br/><p><strong>Encerramento:</strong></p><p>Nada mais havendo a tratar, encerrou-se a reunião da qual eu, ________________________________, secretário(a), lavrei a presente ata.</p><br/><br/><p style="text-align:center">_____________________________________________</p><p style="text-align:center">Presidente da Reunião</p><br/><p style="text-align:center">_____________________________________________</p><p style="text-align:center">Secretário(a)</p>`,
  },
  {
    id: 'declaracao', name: 'Declaração', icon: '📄',
    html: `<p style="text-align:center"><strong>ASSEMBLEIA DE DEUS</strong></p><p style="text-align:center"><strong>DECLARAÇÃO</strong></p><br/><p>Declaramos para os devidos fins que o(a) irmão(ã) <strong>[NOME]</strong>, portador(a) do documento <strong>[DOC]</strong>, é membro desta congregação há <strong>[PERÍODO]</strong>, gozando de plenos direitos e cumprindo fielmente seus deveres como cristão(ã).</p><br/><p>Esta declaração é expedida a pedido do(a) interessado(a) para os fins que se fizerem necessários.</p><br/><p style="text-align:right">_____________, ____ de _____________ de _______.</p><br/><br/><p style="text-align:center">_____________________________________________</p><p style="text-align:center">Pastor / Secretário(a)</p>`,
  },
  {
    id: 'oficio', name: 'Ofício', icon: '📬',
    html: `<p style="text-align:right">_____________, ____ de _____________ de _______.</p><br/><p><strong>OFÍCIO Nº ___/______</strong></p><br/><p><strong>Ao(À) Exmo(a). Sr(a).</strong><br/>[Nome do destinatário]<br/>[Cargo / Instituição]</p><br/><p>Senhor(a),</p><br/><p>[Corpo do ofício]</p><br/><p>Atenciosamente,</p><br/><br/><p>_____________________________________________</p><p><strong>[Nome do Remetente]</strong><br/>[Cargo]<br/>Assembleia de Deus</p>`,
  },
];

// ─── Save helpers ─────────────────────────────────────────────────────────────
function slugify(str: string): string {
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60) || 'documento';
}

function buildPrintFrame(html: string, title: string, marginLeft = 2.5, marginRight = 2.5) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;opacity:0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title><style>
    *{box-sizing:border-box}
    @page{size:A4;margin:2cm ${marginRight}cm 2cm ${marginLeft}cm}
    body{font-family:'Times New Roman',serif;margin:0;padding:0;font-size:11pt;color:#000;line-height:1.5}
    p{margin:0 0 0.4em}
    h1{font-size:16pt;font-weight:bold;margin:0.5em 0}
    h2{font-size:14pt;font-weight:bold;margin:0.4em 0}
    h3{font-size:12pt;font-weight:bold;margin:0.3em 0}
    table{width:100%;border-collapse:collapse;margin-bottom:0.5em}
    th,td{border:1px solid #000;padding:4px 6px;font-size:10pt}
    th{background:#f0f0f0;font-weight:bold}
    ul,ol{margin:0.2em 0 0.4em;padding-left:1.2em}
    li{margin-bottom:0.15em;page-break-inside:avoid}
    tr{page-break-inside:avoid}
    blockquote{border-left:3px solid #666;padding-left:0.8em;margin:0.4em 0;color:#333}
    hr{border:none;border-top:1px solid #999;margin:0.5em 0}
    a{color:#000;text-decoration:underline}
  </style></head><body>${html}</body></html>`);
  doc.close();
  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 5000);
  }, 400);
}

function exportDocx(html: string, title: string) {
  const content = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${title}</title><style>body{font-family:'Times New Roman',serif;margin:2.5cm;font-size:12pt}table{border-collapse:collapse;width:100%}th,td{border:1pt solid #000;padding:6pt}</style></head><body>${html}</body></html>`;
  const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${slugify(title)}.doc`; a.click();
  URL.revokeObjectURL(url);
}

// ─── Ribbon components ────────────────────────────────────────────────────────
interface RBtnLargeProps {
  icon: React.ReactNode;
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
}
const RBtnLarge = React.forwardRef<HTMLButtonElement, RBtnLargeProps>(
  function RBtnLargeInner({ icon, label, title, onClick, active, disabled, danger }, ref) {
    return (
      <button ref={ref} title={title} onClick={onClick} disabled={disabled}
        onMouseDown={e => e.preventDefault()}
        className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 min-h-[52px] min-w-[44px] rounded text-[10px] transition-all border shrink-0 ${
          active
            ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
            : danger
            ? 'text-slate-600 dark:text-slate-300 border-transparent hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-200 hover:text-red-700 disabled:opacity-40'
            : 'text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed'
        }`}>
        <span className="flex items-center justify-center">{icon}</span>
        {label && <span className="whitespace-nowrap text-[10px] leading-tight text-center max-w-[60px] mt-0.5">{label}</span>}
      </button>
    );
  }
);

interface RBtnSmallProps {
  icon?: React.ReactNode;
  label?: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}
function RBtnSmall({ icon, label, title, onClick, active, disabled, className = '' }: RBtnSmallProps) {
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      onMouseDown={e => e.preventDefault()}
      className={`flex items-center justify-center gap-0.5 px-1.5 h-7 text-xs rounded transition-all border shrink-0 ${
        active
          ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
          : 'text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed'
      } ${className}`}>
      {icon}{label && <span className="leading-none">{label}</span>}
    </button>
  );
}

function RDiv() {
  return <div className="w-px self-stretch bg-slate-200 dark:bg-slate-600 mx-1" />;
}

function RGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="flex items-center gap-0.5 px-0.5">{children}</div>
      <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 whitespace-nowrap">{label}</div>
    </div>
  );
}

function RCol({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col justify-around gap-px py-1">{children}</div>;
}

// ─── Ruler ───────────────────────────────────────────────────────────────────
function HorizontalRuler({ zoom, isDark, marginLeft, marginRight, onMarginLeftChange, onMarginRightChange }: {
  zoom: number; isDark: boolean;
  marginLeft: number; marginRight: number;
  onMarginLeftChange: (v: number) => void;
  onMarginRightChange: (v: number) => void;
}) {
  const PX_PER_CM = 3.7795 * (zoom / 100);
  const paperW = Math.round(210 * PX_PER_CM);
  const mlPx = Math.round(marginLeft * 10 * PX_PER_CM);
  const mrPx = Math.round(marginRight * 10 * PX_PER_CM);
  const rulerRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef<'left' | 'right' | null>(null);

  const startDrag = (side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = side;
    const onMove = (ev: MouseEvent) => {
      if (!rulerRef.current || !dragging.current) return;
      const rect = rulerRef.current.getBoundingClientRect();
      const xPx = ev.clientX - rect.left;
      if (dragging.current === 'left') {
        const cm = Math.max(0.5, Math.min(9, xPx / PX_PER_CM / 10));
        onMarginLeftChange(Math.round(cm * 4) / 4); // snap to 0.25cm
      } else {
        const cm = Math.max(0.5, Math.min(9, (paperW - xPx) / PX_PER_CM / 10));
        onMarginRightChange(Math.round(cm * 4) / 4);
      }
    };
    const onUp = () => { dragging.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const ticks: React.ReactNode[] = [];
  for (let mm = 0; mm <= 210; mm += 5) {
    const x = Math.round(mm * PX_PER_CM);
    const isCm = mm % 10 === 0;
    const inMargin = mm < marginLeft * 10 || mm > 210 - marginRight * 10;
    ticks.push(
      <div key={mm} style={{ position: 'absolute', left: x, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {isCm && mm > 0 && mm < 210 && (
          <span style={{ fontSize: 8, lineHeight: 1, color: inMargin ? (isDark ? '#64748b' : '#94a3b8') : (isDark ? '#94a3b8' : '#475569'), marginBottom: 1, userSelect: 'none' }}>
            {Math.round((mm - marginLeft * 10) / 10)}
          </span>
        )}
        <div style={{ width: 1, height: isCm ? 8 : 4, background: inMargin ? (isDark ? '#334155' : '#cbd5e1') : (isDark ? '#475569' : '#94a3b8') }} />
      </div>
    );
  }

  const handleStyle: React.CSSProperties = {
    position: 'absolute', top: 0, width: 10, height: '100%',
    cursor: 'col-resize', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const handleBarStyle: React.CSSProperties = {
    width: 3, height: 14, borderRadius: 2,
    background: isDark ? '#475569' : '#94a3b8',
    boxShadow: isDark ? '0 0 0 1px #334155' : '0 0 0 1px #cbd5e1',
  };

  return (
    <div ref={rulerRef} style={{ width: paperW, height: 22, position: 'relative', flexShrink: 0, marginBottom: 2, userSelect: 'none' }}>
      {/* Margin shading */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: mlPx, height: '100%', background: isDark ? '#1e293b' : '#dde1e7' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, width: mrPx, height: '100%', background: isDark ? '#1e293b' : '#dde1e7' }} />
      <div style={{ position: 'absolute', left: mlPx, top: 0, right: mrPx, height: '100%', background: isDark ? '#0f172a' : '#fff' }} />
      {/* Ticks */}
      <div style={{ position: 'absolute', inset: 0 }}>{ticks}</div>
      {/* Left margin handle */}
      <div style={{ ...handleStyle, left: mlPx - 5 }} onMouseDown={startDrag('left')} title={`Margem esquerda: ${marginLeft}cm`}>
        <div style={handleBarStyle} />
      </div>
      {/* Right margin handle */}
      <div style={{ ...handleStyle, left: paperW - mrPx - 5 }} onMouseDown={startDrag('right')} title={`Margem direita: ${marginRight}cm`}>
        <div style={handleBarStyle} />
      </div>
      {/* Border */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: isDark ? '#334155' : '#cbd5e1' }} />
    </div>
  );
}

// ─── Page break overlay ───────────────────────────────────────────────────────
function PageBreakOverlay({ zoom, editorRef, isDark }: { zoom: number; editorRef: React.RefObject<HTMLDivElement | null>; isDark: boolean }) {
  const [height, setHeight] = React.useState(0);
  const pageH = Math.round(297 * (zoom / 100) * 3.7795);
  React.useEffect(() => {
    if (!editorRef.current) return;
    const obs = new ResizeObserver(() => setHeight(editorRef.current?.offsetHeight ?? 0));
    obs.observe(editorRef.current);
    return () => obs.disconnect();
  }, [editorRef]);
  const breaks: number[] = [];
  for (let y = pageH; y < height; y += pageH) breaks.push(y);
  if (breaks.length === 0) return null;
  return (
    <>
      {breaks.map((y, i) => (
        <div key={y} style={{
          position: 'absolute', left: -32, right: -32, top: y - 1,
          height: 18, background: isDark ? '#0f172a' : '#ababab',
          zIndex: 4, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8,
        }}>
          <div style={{ flex: 1, height: 1, background: isDark ? '#334155' : '#999', marginLeft: 8 }} />
          <span style={{ fontSize: 9, color: isDark ? '#475569' : '#888', whiteSpace: 'nowrap' }}>Página {i + 2}</span>
          <div style={{ flex: 1, height: 1, background: isDark ? '#334155' : '#999', marginRight: 8 }} />
        </div>
      ))}
    </>
  );
}

function ColorBtn({ title, defaultColor, onApply, label, highlight }: {
  title: string; defaultColor: string; onApply: (c: string) => void; label: string; highlight?: boolean;
}) {
  const [color, setColor] = React.useState(defaultColor);
  return (
    <div className="relative flex flex-col items-center justify-center cursor-pointer w-7 h-7 rounded hover:bg-slate-200 transition-colors shrink-0" title={title}>
      <span className={`text-[15px] font-bold leading-none select-none ${highlight ? 'text-slate-700' : 'text-slate-700'}`}
        style={highlight ? {} : {}}>
        {label}
      </span>
      <div className="w-5 h-[4px] rounded-sm mt-[1px]" style={{ background: color }} />
      <input type="color" value={color}
        onChange={e => { setColor(e.target.value); onApply(e.target.value); }}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
    </div>
  );
}

function ColorBtnLarge({ title, defaultColor, onApply, label }: {
  title: string; defaultColor: string; onApply: (c: string) => void; label: string;
}) {
  const [color, setColor] = React.useState(defaultColor);
  return (
    <div className="relative flex flex-col items-center justify-center cursor-pointer px-2 py-1 min-h-[52px] min-w-[56px] rounded border border-transparent hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shrink-0 text-slate-600 dark:text-slate-300" title={title}>
      <span className="flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2a2 2 0 0 0 2.8 0L19 11Z"/>
          <path d="m5 2 5 5"/>
          <path d="M2 13h15"/>
          <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>
        </svg>
      </span>
      {label && <span className="whitespace-nowrap text-[10px] leading-tight text-center max-w-[60px] mt-0.5">{label}</span>}
      <div className="w-8 h-[4px] rounded-sm mt-[3px]" style={{ background: color }} />
      <input type="color" value={color}
        onChange={e => { setColor(e.target.value); onApply(e.target.value); }}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
    </div>
  );
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const BoldIco = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 4h8a4 4 0 0 1 0 8H6z"/><path d="M6 12h9a4 4 0 0 1 0 8H6z"/></svg>;
const ItalicIco = () => <svg width="11" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>;
const UnderIco = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 3v7a6 6 0 0 0 12 0V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>;
const StrikeIco = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><path d="M16 6C16 6 14 4 12 4s-4 1.79-4 4c0 2.08 1.38 3.3 4 4"/><path d="M8 18s2 2 4 2c2.21 0 4-1.79 4-4 0-2-1.38-3.3-4-4"/></svg>;
const AlLIco = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>;
const AlCIco = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>;
const AlRIco = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>;
const AlJIco = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const ListIco = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>;
const OListIco = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>;
const IndMoreIco = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><polyline points="3 8 7 12 3 16"/></svg>;
const IndLessIco = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><polyline points="7 8 3 12 7 16"/></svg>;
const UndoIco = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7v6h6"/><path d="M3 13A9 9 0 1 0 5.4 6.4"/></svg>;
const RedoIco = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 7v6h-6"/><path d="M21 13A9 9 0 1 1 18.6 6.4"/></svg>;

const AlignTopIco = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18M3 9h14M3 15h10"/></svg>;
const AlignMiddleIco = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18M5 7h14M7 17h10"/></svg>;
const AlignBottomIco = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 15h14M3 9h10"/></svg>;

const Ico = {
  UserCard: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="13" y2="16"/></svg>,
  AlignWidth: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M5 3v18M19 3v18M9 7l-3 5 3 5M15 7l3 5-3 5M6 12h12"/></svg>,
  Copy: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  Cut: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="6" cy="20" r="2"/><circle cx="6" cy="4" r="2"/><line x1="6" y1="6" x2="6" y2="18"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/></svg>,
  Paste: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 2h6a1 1 0 0 1 1 1v1H8V3a1 1 0 0 1 1-1z"/><rect x="4" y="4" width="16" height="18" rx="2"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="14" y2="14"/></svg>,
  Brush: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M3 21h4l10.5-10.5a1.5 1.5 0 0 0-2.12-2.12L5 18.88V21z"/><path d="M14.5 5.5l2.12 2.12"/></svg>,
  FileText: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  Table: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg>,
  DB: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  Print: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  Download: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  SelectAll: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Link: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  PageBreak: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="3" y1="12" x2="21" y2="12" strokeDasharray="4 2"/><path d="M12 8V4M9 4l3-4 3 4"/><path d="M12 16v4M9 20l3 4 3-4"/></svg>,
  Users: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Droplet: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>,
  Cross: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 2v20M2 12h20"/></svg>,
  ArrowLR: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M8 3l-5 5 5 5M3 8h18M16 21l5-5-5-5M21 16H3"/></svg>,
  ZoomIn: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  PageA4: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Folder: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  Trash: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>,
  Search: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Plus: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Save: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  X: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Refresh: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  InsertDown: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  FileWord: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13l2 4 2-4 2 4 2-4"/></svg>,
  Merge: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M4 6h6M4 12h6M4 18h6"/><path d="M14 9l4-4 4 4"/><path d="M18 5v14"/><path d="M14 15l4 4 4-4"/></svg>,
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WordEditor() {
  const [isDarkTheme, setIsDarkTheme] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDarkTheme(root.classList.contains('dark'));
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const tc = {
    ribbonBg: isDarkTheme ? '#0f172a' : '#ffffff',
    ribbonArea: isDarkTheme ? '#1e293b' : '#f8fafc',
    border: isDarkTheme ? '#334155' : '#e2e8f0',
    canvasBg: isDarkTheme ? '#374151' : '#ababab',
    text: isDarkTheme ? '#f1f5f9' : '#334155',
    textMuted: isDarkTheme ? '#94a3b8' : '#64748b',
  };

  const [activeRibbon, setActiveRibbon] = useState<RibbonTab>('home');
  const [docTitle, setDocTitle] = useState('Documento1');
  const [editingTitle, setEditingTitle] = useState(false);
  const [zoom, setZoom] = useState(100);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveMsgOk, setSaveMsgOk] = useState(true);
  const [autoSaveActive] = useState(true);

  // File management
  const [files, setFiles] = useState<DocFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [fileDrawerOpen, setFileDrawerOpen] = useState(false);
  const [fileSearch, setFileSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<DocFile | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showMailMerge, setShowMailMerge] = useState(false);
  const [linkDialog, setLinkDialog] = useState<{ url: string; savedRange: Range | null } | null>(null);

  // Templates
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // User profile (tenant scope)
  const [storedUser, setStoredUser] = useState<StoredUser>({});

  // Date range filter (Batismo / Consagração / Transferência) — default to current month
  const _now = new Date();
  const _toISO = (d: Date) => d.toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(_toISO(new Date(_now.getFullYear(), _now.getMonth(), 1)));
  const [dateTo, setDateTo] = useState(_toISO(new Date(_now.getFullYear(), _now.getMonth() + 1, 0)));

  // Table picker
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableHover, setTableHover] = useState({ r: 0, c: 0 });

  // Data panel
  const [dataPanelOpen, setDataPanelOpen] = useState(false);
  const [dataSource, setDataSource] = useState<'members' | 'baptism' | 'consecration' | 'transfer'>('members');
  const [regionals, setRegionals] = useState<Regional[]>([]);
  const [churches, setChurches] = useState<Church[]>([]);
  const [filterRegional, setFilterRegional] = useState('');
  const [filterChurch, setFilterChurch] = useState('');
  const [dataSearch, setDataSearch] = useState('');
  const [dataRows, setDataRows] = useState<MemberRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [insertMode, setInsertMode] = useState<InsertMode>('table');

  // Table context states
  const [isInTable, setIsInTable] = useState(false);
  const [focusedCell, setFocusedCell] = useState<HTMLTableCellElement | null>(null);

  // Photo & Context Menu & History States
  const [selectedFields, setSelectedFields] = useState<string[]>(['rol', 'name', 'church', 'baptism', 'phone']);
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [tableContextMenu, setTableContextMenu] = useState<{ x: number; y: number; cell: HTMLTableCellElement } | null>(null);
  const [memberHistories, setMemberHistories] = useState<{
    functions: any[];
    titles: any[];
    occurrences: any[];
  } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryTypes, setSelectedHistoryTypes] = useState<string[]>(['functions', 'titles', 'occurrences']);
  const [fichaCategories, setFichaCategories] = useState<string[]>([
    'photo', 'personal', 'contact', 'address', 'church', 'family', 'emergency'
  ]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showFichaModal, setShowFichaModal] = useState(false);
  const [selectedMemberDetails, setSelectedMemberDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // loadMemberHistories definition
  const loadMemberHistories = useCallback(async (memberId: string) => {
    setHistoryLoading(true);
    try {
      const [funcsRes, titlesRes, occurrencesRes] = await Promise.all([
        supabase
          .from('church_function_history')
          .select('*, church_function_catalog(name)')
          .eq('member_id', memberId)
          .order('start_date', { ascending: false }),
        supabase
          .from('member_title_history')
          .select('*')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false }),
        supabase
          .from('member_occurrences')
          .select('*')
          .eq('member_id', memberId)
          .order('occurred_at', { ascending: false })
      ]);
      setMemberHistories({
        functions: funcsRes.data || [],
        titles: titlesRes.data || [],
        occurrences: occurrencesRes.data || []
      });
    } catch (e) {
      console.error('loadMemberHistories:', e);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // loadMemberDetails definition
  const loadMemberDetails = useCallback(async (memberId: string) => {
    setDetailsLoading(true);
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*, churches(id, name, regional_id, regionais(name))')
        .eq('id', memberId)
        .single();
      if (error) throw error;
      setSelectedMemberDetails(data);
    } catch (e) {
      console.error('loadMemberDetails:', e);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  // Selection change listener to track table focus and dynamic font selection synchronization
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const node = sel.getRangeAt(0).startContainer;
        if (editorRef.current && editorRef.current.contains(node)) {
          const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
          
          // Track cell focus
          const cell = el?.closest('td, th') as HTMLTableCellElement | null;
          if (cell) {
            setIsInTable(true);
            setFocusedCell(cell);
          } else {
            setIsInTable(false);
            setFocusedCell(null);
          }

          // Sync font family and size dropdowns from current cursor computed styles
          if (el && document.activeElement === editorRef.current) {
            const computedStyle = window.getComputedStyle(el);
            const sizeStr = computedStyle.fontSize;
            if (sizeStr) {
              let pt = 12;
              if (sizeStr.endsWith('px')) {
                pt = Math.round(parseFloat(sizeStr) * 0.75);
              } else if (sizeStr.endsWith('pt')) {
                pt = Math.round(parseFloat(sizeStr));
              } else {
                const parsed = parseFloat(sizeStr);
                if (!isNaN(parsed)) pt = Math.round(parsed);
              }
              setFontSize(String(pt));
            }
            let family = computedStyle.fontFamily;
            if (family) {
              family = family.split(',')[0].replace(/['"]/g, '').trim();
              setFontFamily(family);
            }
          }
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // Click on image listener to open resizing widget
  useEffect(() => {
    const handleImgClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' && editorRef.current?.contains(target)) {
        setSelectedImg(target as HTMLImageElement);
      } else {
        setSelectedImg(null);
      }
    };
    document.addEventListener('click', handleImgClick);
    return () => document.removeEventListener('click', handleImgClick);
  }, []);

  // Close context menus on document click
  useEffect(() => {
    const closeMenus = () => {
      setTableContextMenu(null);
    };
    document.addEventListener('click', closeMenus);
    return () => document.removeEventListener('click', closeMenus);
  }, []);

  // Fetch histories and details automatically when exactly one member is selected
  useEffect(() => {
    if (selectedRows.size === 1) {
      const memberId = Array.from(selectedRows)[0];
      loadMemberHistories(memberId);
      loadMemberDetails(memberId);
    } else {
      setMemberHistories(null);
      setSelectedMemberDetails(null);
    }
  }, [selectedRows, loadMemberHistories, loadMemberDetails]);

  // Page margins in cm
  const [marginLeft, setMarginLeft] = useState(2.5);
  const [marginRight, setMarginRight] = useState(2.5);

  // Font state
  const [fontFamily, setFontFamily] = useState('Times New Roman');
  const [fontSize, setFontSize] = useState('12');

  const editorRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const tablePickerBtnRef = useRef<HTMLButtonElement>(null);
  const [tablePickerPos, setTablePickerPos] = useState({ x: 0, y: 0 });

  // ── execCommand wrapper ──────────────────────────────────────────────────────
  const focusEditor = useCallback(() => { editorRef.current?.focus(); }, []);

  const getSelectedCells = useCallback((): HTMLTableCellElement[] => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return [];
    const range = sel.getRangeAt(0);
    const table = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE 
      ? (range.commonAncestorContainer as HTMLElement).closest('table') 
      : range.commonAncestorContainer.parentElement?.closest('table');
    if (!table) return [];

    const cells: HTMLTableCellElement[] = [];
    table.querySelectorAll('td, th').forEach(cell => {
      if (sel.containsNode(cell, true)) {
        cells.push(cell as HTMLTableCellElement);
      }
    });
    
    if (cells.length === 0) {
      const startCell = range.startContainer.nodeType === Node.ELEMENT_NODE 
        ? (range.startContainer as HTMLElement).closest('td, th') 
        : range.startContainer.parentElement?.closest('td, th');
      if (startCell && table.contains(startCell)) {
        cells.push(startCell as HTMLTableCellElement);
      }
    }
    return cells;
  }, []);

  const getVirtualGrid = useCallback((table: HTMLTableElement) => {
    const rows = Array.from(table.rows);
    const grid: (HTMLTableCellElement | null)[][] = [];
    rows.forEach(() => grid.push([]));
    
    rows.forEach((row, ri) => {
      let ci = 0;
      Array.from(row.cells).forEach(cell => {
        const colspan = cell.colSpan || 1;
        const rowspan = cell.rowSpan || 1;
        
        while (grid[ri][ci] !== undefined) {
          ci++;
        }
        
        for (let r = 0; r < rowspan; r++) {
          for (let c = 0; c < colspan; c++) {
            if (grid[ri + r]) {
              grid[ri + r][ci + c] = cell;
            }
          }
        }
        ci += colspan;
      });
    });
    return grid;
  }, []);

  const applyCmd = useCallback((cmd: string, val?: string) => {
    focusEditor();
    document.execCommand(cmd, false, val);
  }, [focusEditor]);

  const applyFont = useCallback((family: string) => {
    setFontFamily(family);
    focusEditor();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) {
      const span = document.createElement('span');
      span.style.fontFamily = family;
      span.innerHTML = '&#8203;';
      range.insertNode(span);
      range.setStart(span.firstChild!, 1);
      range.setEnd(span.firstChild!, 1);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      document.execCommand('styleWithCSS', false, 'false');
      document.execCommand('fontName', false, 'temp-font-family');
      if (editorRef.current) {
        const fonts = editorRef.current.querySelectorAll('font[face="temp-font-family"]');
        fonts.forEach(font => {
          font.removeAttribute('face');
          font.style.fontFamily = family;
        });
      }
    }
  }, [focusEditor]);

  const applySize = useCallback((pt: string) => {
    setFontSize(pt);
    focusEditor();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) {
      const span = document.createElement('span');
      span.style.fontSize = `${pt}pt`;
      span.innerHTML = '&#8203;';
      range.insertNode(span);
      range.setStart(span.firstChild!, 1);
      range.setEnd(span.firstChild!, 1);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      document.execCommand('styleWithCSS', false, 'false');
      document.execCommand('fontSize', false, '7');
      if (editorRef.current) {
        const fonts = editorRef.current.querySelectorAll('font[size="7"]');
        fonts.forEach(font => {
          font.removeAttribute('size');
          font.style.fontSize = `${pt}pt`;
        });
      }
    }
  }, [focusEditor]);

  const applyStyleTemplate = useCallback((label: string) => {
    focusEditor();
    if (label === 'Normal') {
      document.execCommand('formatBlock', false, 'p');
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const node = sel.getRangeAt(0).startContainer;
        const block = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement).closest('p, h1, h2, h3, h4, li, td') : node.parentElement?.closest('p, h1, h2, h3, h4, li, td');
        if (block) {
          (block as HTMLElement).style.lineHeight = '';
        }
      }
    } else if (label === 'Sem Espaç.') {
      document.execCommand('formatBlock', false, 'p');
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const node = sel.getRangeAt(0).startContainer;
        const block = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement).closest('p, h1, h2, h3, h4, li, td') : node.parentElement?.closest('p, h1, h2, h3, h4, li, td');
        if (block) {
          (block as HTMLElement).style.lineHeight = '1.1';
        }
      }
    } else if (label === 'Título 1') {
      document.execCommand('formatBlock', false, 'h1');
    } else if (label === 'Título 2') {
      document.execCommand('formatBlock', false, 'h2');
    }
  }, [focusEditor]);

  // ── Load user profile + regionals/churches (scoped by tenant) ────────────────
  useEffect(() => {
    let u: StoredUser = {};
    try { u = JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch {}
    setStoredUser(u);

    const pt = u.profileType || '';
    const isMaster = pt === 'master' || pt === 'admin';

    // Load regionais scoped to user's campo
    let rq = supabase.from('regionais').select('id, name').order('name');
    if (!isMaster) {
      if ((pt === 'regional' || pt === 'church') && u.regionalId) rq = rq.eq('id', u.regionalId);
      else if (u.campoId) rq = rq.eq('campo_id', u.campoId);
    }
    rq.then(({ data }) => setRegionals(data || []));

    // Load churches scoped to user
    if (pt === 'church' && u.churchId) {
      supabase.from('churches').select('id, name, regional_id').eq('id', u.churchId)
        .then(({ data }) => {
          setChurches(data || []);
          if (data?.[0]) { setFilterChurch(data[0].id); setFilterRegional(data[0].regional_id || ''); }
        });
    } else if (pt === 'regional' && u.regionalId) {
      supabase.from('churches').select('id, name, regional_id').order('name').eq('regional_id', u.regionalId)
        .then(({ data }) => {
          setChurches(data || []);
          setFilterRegional(u.regionalId || '');
        });
    } else if (!isMaster && u.campoId) {
      supabase.from('regionais').select('id').eq('campo_id', u.campoId).then(({ data: rd }) => {
        if (rd && rd.length > 0) {
          supabase.from('churches').select('id, name, regional_id').order('name')
            .in('regional_id', rd.map((r: { id: string }) => r.id))
            .then(({ data }) => setChurches(data || []));
        }
      });
    } else {
      supabase.from('churches').select('id, name, regional_id').order('name')
        .then(({ data }) => setChurches(data || []));
    }
  }, []);

  const filteredChurches = churches.filter(c => !filterRegional || c.regional_id === filterRegional);

  // ── Load data ────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setDataLoading(true);
    setDataRows([]);
    setSelectedRows(new Set());
    try {
      const pt = storedUser.profileType || '';
      const isChurchScope = pt === 'church' && !!storedUser.churchId;
      const isRegionalScope = !isChurchScope && pt === 'regional' && !!storedUser.regionalId;

      let query = supabase
        .from('members')
        .select('id, full_name, rol, baptism_date, phone, church_id, churches(id, name, regional_id, regionais(name))')
        .order('full_name', { ascending: true })
        .limit(500)
        // Only real church members — exclude PF and PJ records
        .not('member_type', 'ilike', 'PF')
        .not('member_type', 'ilike', 'PJ');

      // Source-specific filters
      if (dataSource === 'members') {
        query = query
          .not('membership_status', 'ilike', '%inativ%')
          .not('membership_status', 'ilike', '%deslig%')
          .not('membership_status', 'ilike', '%visit%');
      } else if (dataSource === 'baptism') {
        query = query.not('baptism_date', 'is', null);
        if (dateFrom) query = query.gte('baptism_date', dateFrom);
        if (dateTo) query = query.lte('baptism_date', dateTo);
      } else if (dataSource === 'consecration') {
        query = query.not('ecclesiastical_title_id', 'is', null);
        if (dateFrom) query = query.gte('baptism_date', dateFrom);
        if (dateTo) query = query.lte('baptism_date', dateTo);
      } else if (dataSource === 'transfer') {
        query = query.ilike('membership_status', '%transf%');
      }

      // Tenant scope enforcement
      if (isChurchScope) {
        query = query.eq('church_id', storedUser.churchId!);
      } else if (filterChurch) {
        query = query.eq('church_id', filterChurch);
      } else if (isRegionalScope) {
        const ids = churches.filter(c => c.regional_id === storedUser.regionalId).map(c => c.id);
        if (ids.length > 0) query = query.in('church_id', ids);
      } else if (filterRegional) {
        const ids = churches.filter(c => c.regional_id === filterRegional).map(c => c.id);
        if (ids.length > 0) query = query.in('church_id', ids);
      }

      if (dataSearch.trim()) {
        const s = dataSearch.trim();
        if (/^\d+$/.test(s)) {
          query = query.eq('rol', parseInt(s, 10));
        } else {
          query = query.ilike('full_name', `%${s}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows: MemberRow[] = (data || []).map((m: any) => ({
        id: m.id,
        name: m.full_name || '',
        rol: m.rol ? String(m.rol) : '',
        baptism_date: m.baptism_date || '',
        phone: m.phone || '',
        photo_url: m.photo_url || '',
        church_name: (m.churches as any)?.name || '',
        regional_name: (m.churches as any)?.regionais?.name || '',
      }));
      setDataRows(rows);
    } catch (e: any) {
      console.error('loadData:', e?.message || e?.code || e);
    } finally {
      setDataLoading(false);
    }
  }, [dataSource, filterChurch, filterRegional, dataSearch, churches, storedUser, dateFrom, dateTo]);

  // Reset hasSearched when data source changes
  useEffect(() => { setHasSearched(false); setDataRows([]); }, [dataSource]);

  // ── Insert selected members ──────────────────────────────────────────────────
  const insertSelected = useCallback(() => {
    focusEditor();
    const sel = selectedRows.size > 0
      ? dataRows.filter(r => selectedRows.has(r.id))
      : dataRows;
    if (sel.length === 0) return;

    if (insertMode === 'table') {
      const fieldLabels: Record<string, string> = {
        photo: 'Foto',
        rol: 'ROL',
        name: 'Nome',
        church: 'Igreja',
        baptism: 'Data Batismo',
        phone: 'Telefone'
      };
      
      const fieldWidths: Record<string, string> = {
        photo: '10%',
        rol: '10%',
        name: '35%',
        church: '25%',
        baptism: '13%',
        phone: '12%'
      };

      const columnsToInsert = ['#', ...selectedFields.filter(f => fieldLabels[f])];
      
      let html = `<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#e2e8f0;">`;
      columnsToInsert.forEach(col => {
        const label = col === '#' ? '#' : fieldLabels[col];
        const width = col === '#' ? '5%' : fieldWidths[col];
        html += `<th style="border:1px solid #94a3b8;padding:6px 8px;text-align:left;font-size:11pt;width:${width};">${label}</th>`;
      });
      html += '</tr></thead><tbody>';
      
      sel.forEach((row, i) => {
        const bg = i % 2 === 0 ? 'background:#fff' : 'background:#f8fafc';
        html += `<tr style="${bg};">`;
        
        columnsToInsert.forEach(col => {
          if (col === '#') {
            html += `<td style="border:1px solid #94a3b8;padding:6px 8px;">${i + 1}</td>`;
          } else if (col === 'photo') {
            const imgHtml = row.photo_url 
              ? `<img src="${row.photo_url}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;display:block;" />`
              : `<div style="width:40px;height:40px;background:#e2e8f0;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:16px;">👤</div>`;
            html += `<td style="border:1px solid #94a3b8;padding:6px 8px;">${imgHtml}</td>`;
          } else if (col === 'rol') {
            html += `<td style="border:1px solid #94a3b8;padding:6px 8px;">${row.rol || ''}</td>`;
          } else if (col === 'name') {
            html += `<td style="border:1px solid #94a3b8;padding:6px 8px;font-weight:bold;">${row.name}</td>`;
          } else if (col === 'church') {
            html += `<td style="border:1px solid #94a3b8;padding:6px 8px;">${row.church_name || ''}</td>`;
          } else if (col === 'baptism') {
            html += `<td style="border:1px solid #94a3b8;padding:6px 8px;">${row.baptism_date ? new Date(row.baptism_date).toLocaleDateString('pt-BR') : ''}</td>`;
          } else if (col === 'phone') {
            html += `<td style="border:1px solid #94a3b8;padding:6px 8px;">${row.phone || ''}</td>`;
          }
        });
        
        html += '</tr>';
      });
      html += '</tbody></table><br/>';
      document.execCommand('insertHTML', false, html);
    } else if (insertMode === 'list') {
      const items = sel.map(r => `<li>${r.name}${r.rol ? ` — ROL ${r.rol}` : ''}${r.church_name ? ` (${r.church_name})` : ''}</li>`).join('');
      document.execCommand('insertHTML', false, `<ul>${items}</ul><br/>`);
    } else {
      const text = sel.map(r => `${r.name}${r.rol ? ` (ROL ${r.rol})` : ''}`).join(', ');
      document.execCommand('insertText', false, text);
    }
    setSelectedRows(new Set());
  }, [focusEditor, dataRows, selectedRows, insertMode, selectedFields]);

  const toggleRow = useCallback((id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedRows.size === dataRows.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(dataRows.map(r => r.id)));
  }, [selectedRows, dataRows]);


  // ── Member history and forms insertion ─────────────────────────────────────────
  const insertMemberForm = useCallback(() => {
    if (!selectedMemberDetails) return;
    focusEditor();
    
    const m = selectedMemberDetails;
    const formatD = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '';
    
    const photoBox = fichaCategories.includes('photo') 
      ? (m.photo_url 
        ? `<img src="${m.photo_url}" style="width:120px;height:140px;object-fit:cover;border:1px solid #cbd5e1;border-radius:4px;display:block;" />`
        : `<div style="width:120px;height:140px;border:1px dashed #cbd5e1;border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;background:#f8fafc;"><span>Foto 3x4</span></div>`)
      : '';

    let html = `
      <div style="font-family:'Times New Roman',serif;color:#1e293b;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
          <tr>
            <td style="border:none;padding:0;vertical-align:middle;">
              <h2 style="margin:0;font-size:16pt;color:#1e3a8a;font-weight:bold;text-transform:uppercase;">Ficha Cadastral de Membro</h2>
              <p style="margin:4px 0 0;font-size:10pt;color:#64748b;">Membro da Assembleia de Deus • ROL nº <strong>${m.rol || 'N/A'}</strong></p>
            </td>
            ${photoBox ? `<td style="border:none;padding:0;width:130px;text-align:right;vertical-align:top;">${photoBox}</td>` : ''}
          </tr>
        </table>
    `;

    // Personal Data Section
    if (fichaCategories.includes('personal')) {
      html += `
        <h3 style="font-size:11pt;color:#1e3a8a;margin:12px 0 6px;border-bottom:2px solid #cbd5e1;padding-bottom:2px;font-weight:bold;text-transform:uppercase;">Dados Pessoais</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10pt;">
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;width:60%;"><strong>Nome Completo:</strong><br/>${m.full_name || ''}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;width:40%;"><strong>Nome Preferencial:</strong><br/>${m.preferred_name || ''}</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;"><strong>CPF:</strong> ${m.cpf || ''} &nbsp;&nbsp;&nbsp;&nbsp; <strong>RG:</strong> ${m.rg || ''}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;"><strong>Data de Nascimento:</strong> ${formatD(m.birth_date)}</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;"><strong>Gênero:</strong> ${m.gender || ''} &nbsp;&nbsp;&nbsp;&nbsp; <strong>Estado Civil:</strong> ${m.marital_status || ''}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;"><strong>Nacionalidade:</strong> ${m.nationality || ''}</td>
          </tr>
        </table>
      `;
    }

    // Contact Data Section
    if (fichaCategories.includes('contact')) {
      html += `
        <h3 style="font-size:11pt;color:#1e3a8a;margin:12px 0 6px;border-bottom:2px solid #cbd5e1;padding-bottom:2px;font-weight:bold;text-transform:uppercase;">Contatos</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10pt;">
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;width:50%;"><strong>E-mail:</strong><br/>${m.email || ''}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;width:25%;"><strong>Celular:</strong><br/>${m.mobile || ''}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;width:25%;"><strong>Telefone Residencial:</strong><br/>${m.phone || ''}</td>
          </tr>
        </table>
      `;
    }

    // Address Data Section
    if (fichaCategories.includes('address')) {
      html += `
        <h3 style="font-size:11pt;color:#1e3a8a;margin:12px 0 6px;border-bottom:2px solid #cbd5e1;padding-bottom:2px;font-weight:bold;text-transform:uppercase;">Endereço</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10pt;">
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;width:70%;"><strong>Logradouro:</strong><br/>${m.address_street || ''}, ${m.address_number || 'S/N'}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;width:30%;"><strong>Complemento:</strong><br/>${m.address_complement || ''}</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;"><strong>Bairro:</strong><br/>${m.address_neighborhood || ''}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;"><strong>Cidade / UF / CEP:</strong><br/>${m.address_city || ''} - ${m.address_state || ''} &nbsp;&nbsp;&nbsp;&nbsp; CEP: ${m.address_zipcode || ''}</td>
          </tr>
        </table>
      `;
    }

    // Church Data Section
    if (fichaCategories.includes('church')) {
      html += `
        <h3 style="font-size:11pt;color:#1e3a8a;margin:12px 0 6px;border-bottom:2px solid #cbd5e1;padding-bottom:2px;font-weight:bold;text-transform:uppercase;">Dados Eclesiásticos</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10pt;">
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;width:50%;"><strong>Congregação:</strong><br/>${m.churches?.name || ''}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;width:50%;"><strong>Regional:</strong><br/>${m.churches?.regionais?.name || ''}</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;"><strong>Título Eclesiástico:</strong><br/>${m.ecclesiastical_title || ''}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;"><strong>Data Batismo:</strong><br/>${formatD(m.baptism_date)}</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;"><strong>Status de Membresia:</strong><br/>${m.membership_status || ''}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;"><strong>Data de Entrada:</strong><br/>${formatD(m.membership_date)}</td>
          </tr>
        </table>
      `;
    }

    // Family Data Section
    if (fichaCategories.includes('family')) {
      html += `
        <h3 style="font-size:11pt;color:#1e3a8a;margin:12px 0 6px;border-bottom:2px solid #cbd5e1;padding-bottom:2px;font-weight:bold;text-transform:uppercase;">Família</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10pt;">
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;width:50%;"><strong>Nome do Pai:</strong><br/>${m.father_name || ''}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;width:50%;"><strong>Nome da Mãe:</strong><br/>${m.mother_name || ''}</td>
          </tr>
          ${m.spouse_name ? `
          <tr>
            <td colspan="2" style="border:1px solid #cbd5e1;padding:6px;"><strong>Cônjuge:</strong><br/>${m.spouse_name}</td>
          </tr>` : ''}
        </table>
      `;
    }

    // Emergency Contact Section
    if (fichaCategories.includes('emergency')) {
      html += `
        <h3 style="font-size:11pt;color:#1e3a8a;margin:12px 0 6px;border-bottom:2px solid #cbd5e1;padding-bottom:2px;font-weight:bold;text-transform:uppercase;">Contato de Emergência</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10pt;">
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;width:60%;"><strong>Nome do Contato:</strong><br/>${m.emergency_contact_name || ''}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;width:40%;"><strong>Telefone:</strong><br/>${m.emergency_contact_phone || ''}</td>
          </tr>
        </table>
      `;
    }

    html += `</div><br/>`;
    document.execCommand('insertHTML', false, html);
    setShowFichaModal(false);
  }, [selectedMemberDetails, fichaCategories, focusEditor]);

  const insertMemberHistory = useCallback(() => {
    if (!memberHistories || !selectedMemberDetails) return;
    focusEditor();
    
    const m = selectedMemberDetails;
    const formatD = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '';
    
    let html = `
      <div style="font-family:'Times New Roman',serif;color:#1e293b;margin-bottom:20px;">
        <h2 style="margin:0 0 8px;font-size:14pt;color:#1e3a8a;font-weight:bold;text-transform:uppercase;text-align:center;">Histórico de Membro — ${m.full_name}</h2>
        <p style="margin:0 0 12px;font-size:10pt;color:#64748b;text-align:center;">ROL nº <strong>${m.rol || 'N/A'}</strong></p>
    `;

    // 1. Function History Table
    if (selectedHistoryTypes.includes('functions')) {
      const funcs = memberHistories.functions;
      html += `
        <h3 style="font-size:11pt;color:#1e3a8a;margin:12px 0 6px;border-bottom:2px solid #cbd5e1;padding-bottom:2px;font-weight:bold;">Histórico de Cargos e Funções</h3>
      `;
      if (funcs.length === 0) {
        html += `<p style="font-size:10pt;color:#64748b;font-style:italic;margin-bottom:12px;">Nenhum cargo ou função registrado.</p>`;
      } else {
        html += `
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10pt;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="border:1px solid #cbd5e1;padding:6px;text-align:left;width:40%;">Cargo/Função</th>
                <th style="border:1px solid #cbd5e1;padding:6px;text-align:left;width:30%;">Departamento</th>
                <th style="border:1px solid #cbd5e1;padding:6px;text-align:center;width:15%;">Início</th>
                <th style="border:1px solid #cbd5e1;padding:6px;text-align:center;width:15%;">Fim</th>
              </tr>
            </thead>
            <tbody>
        `;
        funcs.forEach(f => {
          const funcName = f.church_function_catalog?.name || 'Função';
          html += `
            <tr>
              <td style="border:1px solid #cbd5e1;padding:6px;">${funcName}</td>
              <td style="border:1px solid #cbd5e1;padding:6px;">${f.department || 'Geral'}</td>
              <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${formatD(f.start_date)}</td>
              <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${f.end_date ? formatD(f.end_date) : 'Ativo'}</td>
            </tr>
          `;
        });
        html += `</tbody></table>`;
      }
    }

    // 2. Title History Table (Consecrations)
    if (selectedHistoryTypes.includes('titles')) {
      const titles = memberHistories.titles;
      html += `
        <h3 style="font-size:11pt;color:#1e3a8a;margin:12px 0 6px;border-bottom:2px solid #cbd5e1;padding-bottom:2px;font-weight:bold;">Histórico de Títulos e Consagrações</h3>
      `;
      if (titles.length === 0) {
        html += `<p style="font-size:10pt;color:#64748b;font-style:italic;margin-bottom:12px;">Nenhuma consagração registrada.</p>`;
      } else {
        html += `
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10pt;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="border:1px solid #cbd5e1;padding:6px;text-align:left;width:30%;">Título Anterior</th>
                <th style="border:1px solid #cbd5e1;padding:6px;text-align:left;width:30%;">Novo Título</th>
                <th style="border:1px solid #cbd5e1;padding:6px;text-align:left;width:25%;">Serviço / Origem</th>
                <th style="border:1px solid #cbd5e1;padding:6px;text-align:center;width:15%;">Data</th>
              </tr>
            </thead>
            <tbody>
        `;
        titles.forEach(t => {
          html += `
            <tr>
              <td style="border:1px solid #cbd5e1;padding:6px;">${t.previous_title || 'N/A'}</td>
              <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">${t.new_title}</td>
              <td style="border:1px solid #cbd5e1;padding:6px;">${t.service_name || t.source || ''}</td>
              <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${formatD(t.created_at)}</td>
            </tr>
          `;
        });
        html += `</tbody></table>`;
      }
    }

    // 3. Occurrences Table
    if (selectedHistoryTypes.includes('occurrences')) {
      const occs = memberHistories.occurrences;
      html += `
        <h3 style="font-size:11pt;color:#1e3a8a;margin:12px 0 6px;border-bottom:2px solid #cbd5e1;padding-bottom:2px;font-weight:bold;">Histórico de Ocorrências</h3>
      `;
      if (occs.length === 0) {
        html += `<p style="font-size:10pt;color:#64748b;font-style:italic;margin-bottom:12px;">Nenhuma ocorrência registrada.</p>`;
      } else {
        html += `
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10pt;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="border:1px solid #cbd5e1;padding:6px;text-align:left;width:30%;">Ocorrência</th>
                <th style="border:1px solid #cbd5e1;padding:6px;text-align:left;width:40%;">Detalhes</th>
                <th style="border:1px solid #cbd5e1;padding:6px;text-align:left;width:15%;">Ação</th>
                <th style="border:1px solid #cbd5e1;padding:6px;text-align:center;width:15%;">Data</th>
              </tr>
            </thead>
            <tbody>
        `;
        occs.forEach(o => {
          html += `
            <tr>
              <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">${o.name}</td>
              <td style="border:1px solid #cbd5e1;padding:6px;">${o.message || ''}</td>
              <td style="border:1px solid #cbd5e1;padding:6px;">${o.action || ''}</td>
              <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${formatD(o.occurred_at)}</td>
            </tr>
          `;
        });
        html += `</tbody></table>`;
      }
    }

    html += `</div><br/>`;
    document.execCommand('insertHTML', false, html);
    setShowHistoryModal(false);
  }, [selectedMemberDetails, memberHistories, selectedHistoryTypes, focusEditor]);

  // ── Table row/column manipulation callbacks ────────────────────────────────────
  const getFocusedTable = () => {
    if (!focusedCell) return null;
    return focusedCell.closest('table');
  };

  const insertRow = useCallback((above: boolean) => {
    if (!focusedCell) return;
    focusEditor();
    const row = focusedCell.parentElement as HTMLTableRowElement | null;
    const table = row?.closest('table');
    if (!row || !table) return;

    const newRow = table.insertRow(above ? row.rowIndex : row.rowIndex + 1);
    Array.from(row.cells).forEach(cell => {
      const newCell = document.createElement(cell.tagName);
      newCell.style.cssText = cell.style.cssText;
      newCell.innerHTML = '&nbsp;';
      newRow.appendChild(newCell);
    });
  }, [focusedCell, focusEditor]);

  const insertColumn = useCallback((left: boolean) => {
    if (!focusedCell) return;
    focusEditor();
    const cellIndex = focusedCell.cellIndex;
    const table = focusedCell.closest('table');
    if (!table) return;

    Array.from(table.rows).forEach(row => {
      const targetIndex = left ? cellIndex : cellIndex + 1;
      const newCell = document.createElement(row.cells[cellIndex]?.tagName || 'td');
      newCell.style.cssText = row.cells[cellIndex]?.style.cssText || 'border:1px solid #94a3b8;padding:6px 8px;';
      newCell.innerHTML = '&nbsp;';
      
      if (targetIndex >= row.cells.length) {
        row.appendChild(newCell);
      } else {
        row.insertBefore(newCell, row.cells[targetIndex]);
      }
    });
  }, [focusedCell, focusEditor]);

  const deleteRow = useCallback(() => {
    if (!focusedCell) return;
    focusEditor();
    const row = focusedCell.parentElement as HTMLTableRowElement | null;
    const table = row?.closest('table');
    if (!row || !table) return;
    
    table.deleteRow(row.rowIndex);
    setIsInTable(false);
    setFocusedCell(null);
  }, [focusedCell, focusEditor]);

  const deleteColumn = useCallback(() => {
    if (!focusedCell) return;
    focusEditor();
    const cellIndex = focusedCell.cellIndex;
    const table = focusedCell.closest('table');
    if (!table) return;

    Array.from(table.rows).forEach(row => {
      if (row.cells.length > cellIndex) {
        row.deleteCell(cellIndex);
      }
    });
    setIsInTable(false);
    setFocusedCell(null);
  }, [focusedCell, focusEditor]);

  const deleteTable = useCallback(() => {
    const table = getFocusedTable();
    if (!table) return;
    focusEditor();
    table.remove();
    setIsInTable(false);
    setFocusedCell(null);
  }, [focusedCell, focusEditor]);

  const autofitTable = useCallback(() => {
    const table = getFocusedTable();
    if (!table) return;
    focusEditor();
    table.style.width = '100%';
    
    const rows = Array.from(table.rows);
    if (rows.length > 0) {
      const colCount = rows[0].cells.length;
      const pct = (100 / colCount).toFixed(2) + '%';
      rows.forEach(r => {
        Array.from(r.cells).forEach(c => {
          c.style.width = pct;
        });
      });
    }
  }, [focusedCell, focusEditor]);

  const adjustCellPadding = useCallback((inc: number) => {
    const table = getFocusedTable();
    if (!table) return;
    focusEditor();
    
    Array.from(table.rows).forEach(row => {
      Array.from(row.cells).forEach(cell => {
        const currentPadding = window.getComputedStyle(cell).paddingTop;
        const currentPx = parseFloat(currentPadding) || 6;
        const newPx = Math.max(2, currentPx + inc);
        cell.style.padding = `${newPx}px ${newPx + 2}px`;
      });
    });
  }, [focusedCell, focusEditor]);

  const applyCellBg = useCallback((color: string) => {
    focusEditor();
    const selectedCells = getSelectedCells();
    if (selectedCells.length > 0) {
      selectedCells.forEach(cell => {
        cell.style.background = color;
      });
    } else if (focusedCell) {
      focusedCell.style.background = color;
    }
  }, [focusedCell, focusEditor, getSelectedCells]);

  const applyCellAlign = useCallback((alignType: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    focusEditor();
    const selectedCells = getSelectedCells();
    const cellsToFormat = selectedCells.length > 0 ? selectedCells : (focusedCell ? [focusedCell] : []);
    
    cellsToFormat.forEach(cell => {
      if (['left', 'center', 'right'].includes(alignType)) {
        cell.style.textAlign = alignType;
      } else {
        cell.style.verticalAlign = alignType;
      }
    });
  }, [focusedCell, focusEditor, getSelectedCells]);

  const mergeSelectedCells = useCallback(() => {
    const cells = getSelectedCells();
    if (cells.length <= 1) return;
    const table = cells[0].closest('table');
    if (!table) return;
    
    const grid = getVirtualGrid(table);
    let minR = Infinity, maxR = -Infinity;
    let minC = Infinity, maxC = -Infinity;
    
    grid.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        if (cell && cells.includes(cell)) {
          minR = Math.min(minR, ri);
          maxR = Math.max(maxR, ri);
          minC = Math.min(minC, ci);
          maxC = Math.max(maxC, ci);
        }
      });
    });
    
    const topLeftCell = grid[minR][minC];
    if (!topLeftCell) return;
    
    const cellsToRemove = new Set<HTMLTableCellElement>();
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = grid[r][c];
        if (cell && cell !== topLeftCell) {
          cellsToRemove.add(cell);
        }
      }
    }
    
    focusEditor();
    
    cellsToRemove.forEach(cell => {
      if (cell.innerHTML.trim() !== '' && cell.innerHTML.trim() !== '&nbsp;') {
        if (topLeftCell.innerHTML.trim() === '' || topLeftCell.innerHTML.trim() === '&nbsp;') {
          topLeftCell.innerHTML = cell.innerHTML;
        } else {
          topLeftCell.innerHTML += ' ' + cell.innerHTML;
        }
      }
      cell.remove();
    });
    
    topLeftCell.rowSpan = maxR - minR + 1;
    topLeftCell.colSpan = maxC - minC + 1;
    topLeftCell.style.width = '';
    topLeftCell.style.height = '';
    
    const newSel = window.getSelection();
    if (newSel) {
      newSel.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(topLeftCell);
      newSel.addRange(range);
    }
  }, [focusEditor, getSelectedCells, getVirtualGrid]);

  const applyTableBorders = useCallback((borderStyle: string) => {
    const table = getFocusedTable();
    if (!table) return;
    focusEditor();
    
    Array.from(table.rows).forEach(row => {
      Array.from(row.cells).forEach(cell => {
        cell.style.border = borderStyle;
      });
    });
  }, [focusedCell, focusEditor]);

  // Interative table resizer via mouse drag
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    let isResizing = false;
    let resizeType: 'col' | 'row' | null = null;
    let targetCell: HTMLTableCellElement | null = null;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) return;

      const target = e.target as HTMLElement;
      const cell = target.closest('td, th') as HTMLTableCellElement | null;
      if (!cell || !editor.contains(cell)) {
        editor.style.cursor = 'default';
        return;
      }

      const rect = cell.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const edgeThreshold = 6;

      const isRightEdge = rect.width - x <= edgeThreshold;
      const isBottomEdge = rect.height - y <= edgeThreshold;

      if (isRightEdge) {
        editor.style.cursor = 'col-resize';
        resizeType = 'col';
        targetCell = cell;
      } else if (isBottomEdge) {
        editor.style.cursor = 'row-resize';
        resizeType = 'row';
        targetCell = cell;
      } else {
        editor.style.cursor = 'default';
        resizeType = null;
        targetCell = null;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!resizeType || !targetCell) return;
      
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = targetCell.offsetWidth;
      startHeight = targetCell.offsetHeight;

      const table = targetCell.closest('table');
      if (table) {
        table.style.width = `${table.offsetWidth}px`;
      }

      e.preventDefault();

      const handleMouseDrag = (moveEvt: MouseEvent) => {
        if (!isResizing || !targetCell) return;

        if (resizeType === 'col') {
          const deltaX = moveEvt.clientX - startX;
          const newWidth = Math.max(20, startWidth + deltaX);
          targetCell.style.width = `${newWidth}px`;
        } else if (resizeType === 'row') {
          const deltaY = moveEvt.clientY - startY;
          const newHeight = Math.max(15, startHeight + deltaY);
          targetCell.style.height = `${newHeight}px`;
        }
      };

      const handleMouseUp = () => {
        isResizing = false;
        document.removeEventListener('mousemove', handleMouseDrag);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseDrag);
      document.addEventListener('mouseup', handleMouseUp);
    };

    editor.addEventListener('mousemove', handleMouseMove);
    editor.addEventListener('mousedown', handleMouseDown);

    return () => {
      editor.removeEventListener('mousemove', handleMouseMove);
      editor.removeEventListener('mousedown', handleMouseDown);
      if (editor) editor.style.cursor = 'default';
    };
  }, [zoom]);

  // ── Table insert ─────────────────────────────────────────────────────────────
  const insertTable = useCallback((rows: number, cols: number) => {
    focusEditor();
    let html = '<table style="width:100%;border-collapse:collapse;">';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        const tag = r === 0 ? 'th' : 'td';
        html += `<${tag} style="border:1px solid #94a3b8;padding:6px 8px;min-width:40px;">&nbsp;</${tag}>`;
      }
      html += '</tr>';
    }
    html += '</table><br/>';
    document.execCommand('insertHTML', false, html);
    setShowTablePicker(false);
  }, [focusEditor]);

  // ── Save to Supabase (JSON) ──────────────────────────────────────────────────
  const saveDoc = useCallback(async () => {
    if (!editorRef.current) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const content = editorRef.current.innerHTML;
      const payload = JSON.stringify({ title: docTitle, content, savedAt: new Date().toISOString() });
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
      const safe = slugify(docTitle);
      const path = `documentos/${safe}.json`;
      const { error } = await supabase.storage.from('dados').upload(path, blob, {
        contentType: 'application/json',
        upsert: true,
      });
      if (error) throw error;
      setSaveMsg('✓ Salvo');
      setSaveMsgOk(true);
    } catch (e: any) {
      setSaveMsg(`Erro: ${e.message}`);
      setSaveMsgOk(false);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 4000);
    }
  }, [docTitle]);

  // ── Load cloud files ─────────────────────────────────────────────────────────
  const loadFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const { data } = await supabase.storage.from('dados').list('documentos', {
        limit: 200, sortBy: { column: 'updated_at', order: 'desc' },
      });
      if (data) {
        setFiles(data.filter(f => f.name.endsWith('.json')).map(f => ({
          name: f.name,
          displayName: f.name.replace(/\.json$/, '').replace(/_/g, ' '),
          updated_at: f.updated_at || '',
          path: `documentos/${f.name}`,
        })));
      }
    } catch { } finally { setLoadingFiles(false); }
  }, []);

  useEffect(() => { if (fileDrawerOpen) loadFiles(); }, [fileDrawerOpen, loadFiles]);

  // ── Open file ────────────────────────────────────────────────────────────────
  const openFile = useCallback(async (file: DocFile) => {
    try {
      const { data } = await supabase.storage.from('dados').download(file.path);
      if (!data) throw new Error('Arquivo não encontrado');
      const text = await data.text();
      const parsed = JSON.parse(text);
      if (editorRef.current) editorRef.current.innerHTML = parsed.content || '';
      setDocTitle(parsed.title || file.displayName);
      setFileDrawerOpen(false);
    } catch (e: any) {
      alert('Erro ao abrir: ' + e.message);
    }
  }, []);

  // ── Delete file ───────────────────────────────────────────────────────────────
  const deleteFile = useCallback(async (file: DocFile) => {
    await supabase.storage.from('dados').remove([file.path]);
    setConfirmDelete(null);
    loadFiles();
  }, [loadFiles]);

  // ── Keyboard shortcut: Ctrl+S ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveDoc(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveDoc]);

  const filteredFiles = files.filter(f => f.displayName.toLowerCase().includes(fileSearch.toLowerCase()));
  const filteredData = dataRows;

  // Derived user scope flags
  const pt = storedUser.profileType || '';
  const isMaster = pt === 'master' || pt === 'admin';

  // Permission checks
  const { canCreate: permCanCreate } = usePermissions(pt as 'master' | 'admin' | 'campo' | 'church' | '');
  const canMailMerge = permCanCreate('word_mailmerge');
  const isChurchLocked = pt === 'church' && !!storedUser.churchId;
  const isRegionalLocked = isChurchLocked || (pt === 'regional' && !!storedUser.regionalId);
  const showDateFilter = dataSource !== 'members';

  const newDocument = () => {
    const hasContent = !!(editorRef.current?.textContent?.trim());
    if (hasContent) { setConfirmNew(true); return; }
    clearDocument();
  };

  const clearDocument = () => {
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
      editorRef.current.focus();
    }
    setDocTitle('Documento1');
    setFileDrawerOpen(false);
    setConfirmNew(false);
  };

  const doMailMerge = useCallback(() => {
    const template = editorRef.current?.innerHTML || '';
    const members = selectedRows.size > 0
      ? dataRows.filter(r => selectedRows.has(r.id))
      : dataRows;
    if (!template.trim() || members.length === 0) return;
    const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '';
    const pages = members.map((m, i) => {
      const merged = template
        .replace(/\[NOME DO MEMBRO\]/gi, m.name)
        .replace(/\[NOME\]/gi, m.name)
        .replace(/\[ROL\]/gi, m.rol || '')
        .replace(/\[DATA DE BATISMO\]/gi, fmt(m.baptism_date))
        .replace(/\[BATISMO\]/gi, fmt(m.baptism_date))
        .replace(/\[TELEFONE\]/gi, m.phone || '')
        .replace(/\[FONE\]/gi, m.phone || '')
        .replace(/\[CELULAR\]/gi, m.phone || '')
        .replace(/\[IGREJA\]/gi, m.church_name || '')
        .replace(/\[REGIONAL\]/gi, m.regional_name || '');
      const pb = i < members.length - 1 ? ' style="page-break-after:always"' : '';
      return `<div${pb}>${merged}</div>`;
    });
    buildPrintFrame(pages.join('\n'), `Mala Direta — ${docTitle} (${members.length})`, marginLeft, marginRight);
    setShowMailMerge(false);
  }, [dataRows, selectedRows, docTitle, marginLeft, marginRight]);

  return (
    <div className="flex flex-col h-full overflow-hidden select-none"
      style={{ fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: 12, background: tc.ribbonBg, color: tc.text }}>

      {/* ── Ribbon tabs + title ── */}
      <div className="flex items-center shrink-0 px-1 gap-0.5" style={{ height: 32, backgroundColor: tc.ribbonBg, borderBottom: `1px solid ${tc.border}` }}>
        {([
          'home',
          'insert',
          'data',
          'view',
          'arquivo',
          ...(isInTable ? ['table'] as const : [])
        ] as const).map(t => {
          const labels: Record<RibbonTab, string> = {
            home: 'Página Inicial',
            insert: 'Inserir',
            data: 'Dados',
            view: 'Exibir',
            arquivo: 'Arquivo',
            table: 'Design da Tabela'
          };
          const isActive = (t === 'arquivo' ? fileDrawerOpen : activeRibbon === t);
          return (
            <button key={t}
              onClick={() => t === 'arquivo' ? setFileDrawerOpen(o => !o) : (setActiveRibbon(t), setFileDrawerOpen(false))}
              style={isActive ? { background: isDarkTheme ? '#1e293b' : '#fff', color: isDarkTheme ? '#f1f5f9' : '#334155', fontWeight: 600 } : { color: tc.textMuted }}
              className="px-3 py-1 text-xs rounded-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-700">
              {labels[t]}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2 pr-2">
          {saveMsg && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${saveMsgOk ? 'text-green-600' : 'text-red-600'}`}>
              {saveMsg}
            </span>
          )}
          {autoSaveActive && <span className="text-[10px] text-slate-400">Salvamento Automático ●</span>}
          {editingTitle ? (
            <input ref={titleInputRef} value={docTitle} onChange={e => setDocTitle(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={e => e.key === 'Enter' && setEditingTitle(false)}
              className="text-xs font-semibold border border-slate-300 outline-none rounded px-2 py-0.5 min-w-[160px] text-slate-700"
              autoFocus />
          ) : (
            <span className="text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900 transition-colors"
              onClick={() => { setEditingTitle(true); setTimeout(() => titleInputRef.current?.select(), 10); }}
              title="Clique para renomear">
              {docTitle}
            </span>
          )}
          <button onClick={() => buildPrintFrame(editorRef.current?.innerHTML || '', docTitle, marginLeft, marginRight)} title="Imprimir documento"
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors"
            style={{ borderColor: isDarkTheme ? '#334155' : '#cbd5e1', color: isDarkTheme ? '#94a3b8' : '#64748b', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = isDarkTheme ? '#1e293b' : '#f1f5f9')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Ico.Print />
          </button>
          <button onClick={saveDoc} disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors disabled:opacity-60">
            <Ico.Save />{saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* ── Ribbon toolbar ── */}
      <div className="flex items-center gap-0.5 px-2 py-1 shrink-0 overflow-x-auto min-h-[60px]"
        style={{ background: tc.ribbonArea, borderBottom: `1px solid ${tc.border}` }}>

        {activeRibbon === 'home' && <>
          {/* Novo + Undo/Redo */}
          <RGroup label="Arquivo">
            <RBtnLarge icon={<Ico.Plus />} label="Novo" title="Novo documento (verifica alterações)" onClick={newDocument} />
            <RCol>
              <RBtnSmall title="Desfazer (Ctrl+Z)" icon={<UndoIco />} onClick={() => applyCmd('undo')} />
              <RBtnSmall title="Refazer (Ctrl+Y)" icon={<RedoIco />} onClick={() => applyCmd('redo')} />
            </RCol>
          </RGroup>
          <RDiv />

          {/* Clipboard */}
          <RGroup label="Área de Transferência">
            <RBtnLarge icon={<Ico.Paste />} label="Colar" title="Colar (Ctrl+V)" onClick={() => applyCmd('paste')} />
            <RBtnLarge icon={<Ico.Cut />} label="Recortar" title="Recortar (Ctrl+X)" onClick={() => applyCmd('cut')} />
            <RBtnLarge icon={<Ico.Copy />} label="Copiar" title="Copiar (Ctrl+C)" onClick={() => applyCmd('copy')} />
          </RGroup>
          <RDiv />

          {/* Font */}
          <RGroup label="Fonte">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <select className="h-6 text-xs border border-slate-300 rounded px-1 bg-white text-slate-800 w-36"
                  value={fontFamily} onChange={e => applyFont(e.target.value)}>
                  {(() => {
                    const defaultFonts = ['Times New Roman', 'Arial', 'Calibri', 'Cambria', 'Georgia', 'Verdana', 'Courier New', 'Trebuchet MS', 'Garamond'];
                    const list = defaultFonts.includes(fontFamily) ? defaultFonts : [...defaultFonts, fontFamily];
                    return list.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ));
                  })()}
                </select>
                <select className="h-6 text-xs border border-slate-300 rounded px-1 bg-white text-slate-800 w-12"
                  value={fontSize} onChange={e => applySize(e.target.value)}>
                  {(() => {
                    const numSize = Number(fontSize) || 12;
                    const defaultSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 48, 72];
                    const list = defaultSizes.includes(numSize) ? defaultSizes : [...defaultSizes, numSize].sort((a, b) => a - b);
                    return list.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ));
                  })()}
                </select>
                <RBtnSmall title="Aumentar fonte" label="A↑" onClick={() => applySize(String(Math.min(72, (Number(fontSize) || 12) + 2)))} />
                <RBtnSmall title="Diminuir fonte" label="A↓" onClick={() => applySize(String(Math.max(6, (Number(fontSize) || 12) - 2)))} />
              </div>
              <div className="flex items-center gap-0.5">
                <RBtnSmall title="Negrito (Ctrl+B)" icon={<BoldIco />} onClick={() => applyCmd('bold')} />
                <RBtnSmall title="Itálico (Ctrl+I)" icon={<ItalicIco />} onClick={() => applyCmd('italic')} />
                <RBtnSmall title="Sublinhado (Ctrl+U)" icon={<UnderIco />} onClick={() => applyCmd('underline')} />
                <RBtnSmall title="Tachado" icon={<StrikeIco />} onClick={() => applyCmd('strikeThrough')} />
                <RBtnSmall title="Subscrito" label="x₂" onClick={() => applyCmd('subscript')} />
                <RBtnSmall title="Sobrescrito" label="x²" onClick={() => applyCmd('superscript')} />
                <ColorBtn title="Cor do texto" defaultColor="#ff0000" onApply={c => applyCmd('foreColor', c)} label="A" />
                <ColorBtn title="Realce / Fundo" defaultColor="#ffff00" onApply={c => applyCmd('hiliteColor', c)} label="A" highlight />
              </div>
            </div>
          </RGroup>
          <RDiv />

          {/* Paragraph */}
          <RGroup label="Parágrafo">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-0.5">
                <RBtnSmall title="Lista com marcadores" icon={<ListIco />} onClick={() => applyCmd('insertUnorderedList')} />
                <RBtnSmall title="Lista numerada" icon={<OListIco />} onClick={() => applyCmd('insertOrderedList')} />
                <RBtnSmall title="Diminuir recuo" icon={<IndLessIco />} onClick={() => applyCmd('outdent')} />
                <RBtnSmall title="Aumentar recuo" icon={<IndMoreIco />} onClick={() => applyCmd('indent')} />
                <RBtnSmall title="Linha horizontal" label="─" onClick={() => applyCmd('insertHorizontalRule')} />
              </div>
              <div className="flex items-center gap-0.5">
                <RBtnSmall title="Alinhar à esquerda" icon={<AlLIco />} onClick={() => applyCmd('justifyLeft')} />
                <RBtnSmall title="Centralizar" icon={<AlCIco />} onClick={() => applyCmd('justifyCenter')} />
                <RBtnSmall title="Alinhar à direita" icon={<AlRIco />} onClick={() => applyCmd('justifyRight')} />
                <RBtnSmall title="Justificar" icon={<AlJIco />} onClick={() => applyCmd('justifyFull')} />
                <select className="h-6 text-[10px] border border-slate-300 rounded px-0.5 bg-white text-slate-800 w-[90px]"
                  onChange={e => { focusEditor(); document.execCommand('formatBlock', false, e.target.value); }}>
                  <option value="p">Normal</option>
                  <option value="h1">Título 1</option>
                  <option value="h2">Título 2</option>
                  <option value="h3">Título 3</option>
                  <option value="h4">Título 4</option>
                  <option value="blockquote">Citação</option>
                </select>
              </div>
            </div>
          </RGroup>
          <RDiv />

          {/* Styles gallery */}
          <RGroup label="Estilos">
            {[
              { label: 'Normal', style: {} as React.CSSProperties },
              { label: 'Sem Espaç.', style: { lineHeight: '1.1' } as React.CSSProperties },
              { label: 'Título 1', style: { fontSize: 15, fontWeight: 'bold' } as React.CSSProperties },
              { label: 'Título 2', style: { fontSize: 13, fontWeight: 'bold' } as React.CSSProperties },
            ].map(s => (
              <button key={s.label} title={s.label} 
                onClick={() => applyStyleTemplate(s.label)}
                onMouseDown={e => e.preventDefault()}
                className="px-2 py-1 border border-slate-200 rounded hover:bg-slate-200 text-[11px] min-h-[52px] min-w-[56px] text-slate-700"
                style={{ fontFamily: 'Times New Roman', ...s.style }}>
                {s.label}
              </button>
            ))}
          </RGroup>
          <RDiv />

          {/* Edição */}
          <RGroup label="Edição">
            <RBtnLarge icon={<Ico.Print />} label="Imprimir" title="Imprimir" onClick={() => buildPrintFrame(editorRef.current?.innerHTML || '', docTitle)} />
            <RBtnLarge icon={<Ico.Download />} label="Exportar .doc" title="Exportar como .doc" onClick={() => exportDocx(editorRef.current?.innerHTML || '', docTitle)} />
            <RBtnLarge icon={<Ico.SelectAll />} label="Sel. Tudo" title="Selecionar tudo" onClick={() => applyCmd('selectAll')} />
          </RGroup>
        </>}

        {activeRibbon === 'insert' && <>
          <RGroup label="Modelos">
            <RBtnLarge icon={<Ico.FileText />} label="Modelos" title="Escolher modelo de documento"
              onClick={() => setShowTemplatePicker(o => !o)} />
          </RGroup>
          <RDiv />

          <RGroup label="Tabelas">
            <RBtnLarge
              ref={tablePickerBtnRef}
              icon={<Ico.Table />} label="Tabela" title="Inserir tabela"
              onClick={() => {
                if (tablePickerBtnRef.current) {
                  const r = tablePickerBtnRef.current.getBoundingClientRect();
                  setTablePickerPos({ x: r.left, y: r.bottom + 4 });
                }
                setShowTablePicker(o => !o);
              }} />
          </RGroup>
          <RDiv />

          <RGroup label="Texto">
            <RBtnSmall title="Inserir link" icon={<Ico.Link />} label="Hyperlink" onClick={() => {
              const sel = window.getSelection();
              const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
              setLinkDialog({ url: 'https://', savedRange: range });
            }} />
            <RBtnSmall title="Linha horizontal" label="─" onClick={() => applyCmd('insertHorizontalRule')} />
            <RBtnSmall title="Quebra de página" icon={<Ico.PageBreak />} label="Quebra" onClick={() => { focusEditor(); document.execCommand('insertHTML', false, '<div style="page-break-after:always;border-top:1px dashed #94a3b8;margin:12px 0;"></div>'); }} />
          </RGroup>
          <RDiv />

          <RGroup label="Dados">
            <RBtnLarge icon={<Ico.DB />} label="Dados" title="Abrir painel de dados do banco"
              active={dataPanelOpen}
              onClick={() => { setDataPanelOpen(o => !o); setActiveRibbon('data'); }} />
          </RGroup>
        </>}

        {activeRibbon === 'data' && <>
          <RGroup label="Fonte de Dados">
            {(['members', 'baptism', 'consecration', 'transfer'] as const).map(src => {
              const labels = { members: 'Membros', baptism: 'Batismo', consecration: 'Consagração', transfer: 'Transferência' };
              const srcIcons = { members: <Ico.Users />, baptism: <Ico.Droplet />, consecration: <Ico.Cross />, transfer: <Ico.ArrowLR /> };
              return (
                <RBtnLarge key={src} icon={srcIcons[src]} label={labels[src]} title={labels[src]}
                  active={dataSource === src}
                  onClick={() => { setDataSource(src); setDataPanelOpen(true); }} />
              );
            })}
          </RGroup>
          <RDiv />

          {/* Insert mode */}
          <RGroup label="Inserir como">
            <RBtnLarge icon={<Ico.Table />} label="Tabela" title="Inserir como Tabela" active={insertMode === 'table'} onClick={() => setInsertMode('table')} />
            <RBtnLarge icon={<ListIco />} label="Lista" title="Inserir como Lista" active={insertMode === 'list'} onClick={() => setInsertMode('list')} />
            <RBtnLarge icon={<span className="text-base font-bold">T</span>} label="Texto" title="Inserir como Texto" active={insertMode === 'text'} onClick={() => setInsertMode('text')} />
          </RGroup>
          <RDiv />

          <RGroup label="Ações">
            <RBtnSmall title="Abrir / fechar painel" icon={<Ico.DB />} label={dataPanelOpen ? 'Fechar' : 'Ver Painel'} active={dataPanelOpen}
              onClick={() => setDataPanelOpen(o => !o)} />
            <RBtnSmall title="Recarregar dados" icon={<Ico.Refresh />} label="Recarregar" onClick={loadData} />
            <RBtnSmall title="Inserir registros" icon={<Ico.InsertDown />} label={`Inserir${selectedRows.size > 0 ? ` (${selectedRows.size})` : ' Todos'}`}
              onClick={insertSelected} />
            {canMailMerge && (
              <RBtnSmall title="Mala direta — gerar um documento por membro e imprimir" icon={<Ico.Merge />} label="Mala Direta"
                onClick={() => setShowMailMerge(true)} disabled={!hasSearched || dataRows.length === 0} />
            )}
          </RGroup>
          {selectedRows.size === 1 && (
            <>
              <RDiv />
              <RGroup label="Membro Selecionado">
                <RBtnLarge icon={<Ico.FileText />} label="Histórico" title="Inserir histórico do membro" onClick={() => setShowHistoryModal(true)} />
                <RBtnLarge icon={<Ico.UserCard />} label="Ficha Cadastral" title="Inserir ficha cadastral do membro" onClick={() => setShowFichaModal(true)} />
              </RGroup>
            </>
          )}
        </>}

        {activeRibbon === 'view' && <>
          <RGroup label="Zoom">
            <RBtnLarge icon={<Ico.ZoomIn />} label={`${zoom}%`} title="Zoom atual" onClick={() => {}} />
            <RBtnSmall title="Diminuir zoom" label="− Zoom" onClick={() => setZoom(z => Math.max(50, z - 10))} />
            <RBtnSmall title="Zoom 100%" label="100%" onClick={() => setZoom(100)} />
            <RBtnSmall title="Aumentar zoom" label="+ Zoom" onClick={() => setZoom(z => Math.min(200, z + 10))} />
          </RGroup>
          <RDiv />
          <RGroup label="Layout">
            <RBtnLarge icon={<Ico.PageA4 />} label="A4" title="Página A4 (ativo)" active onClick={() => {}} />
          </RGroup>
        </>}

        {activeRibbon === 'table' && isInTable && <>
          <RGroup label="Inserir">
            <RBtnSmall title="Inserir linha acima" icon={<Ico.Plus />} label="Linha Acima" onClick={() => insertRow(true)} />
            <RBtnSmall title="Inserir linha abaixo" icon={<Ico.Plus />} label="Linha Abaixo" onClick={() => insertRow(false)} />
            <RBtnSmall title="Inserir coluna à esquerda" icon={<Ico.Plus />} label="Coluna Esquerda" onClick={() => insertColumn(true)} />
            <RBtnSmall title="Inserir coluna à direita" icon={<Ico.Plus />} label="Coluna Direita" onClick={() => insertColumn(false)} />
          </RGroup>
          <RDiv />
          <RGroup label="Excluir">
            <RBtnSmall title="Excluir linha" icon={<Ico.Trash />} label="Linha" onClick={deleteRow} />
            <RBtnSmall title="Excluir coluna" icon={<Ico.Trash />} label="Coluna" onClick={deleteColumn} />
            <RBtnLarge icon={<Ico.Trash />} label="Excluir Tabela" title="Excluir tabela completa" onClick={deleteTable} />
          </RGroup>
          <RDiv />
          <RGroup label="Layout">
            <RBtnLarge icon={<Ico.AlignWidth />} label="Auto-ajustar" title="Ajustar largura para 100%" onClick={autofitTable} />
            <RCol>
              <RBtnSmall title="Aumentar espaçamento" label="Padding +" onClick={() => adjustCellPadding(2)} />
              <RBtnSmall title="Diminuir espaçamento" label="Padding −" onClick={() => adjustCellPadding(-2)} />
            </RCol>
          </RGroup>
          <RDiv />
          <RGroup label="Mesclar">
            <RBtnLarge icon={<Ico.Merge />} label="Mesclar" title="Mesclar células selecionadas" onClick={mergeSelectedCells} />
          </RGroup>
          <RDiv />
          <RGroup label="Alinhamento">
            <RCol>
              <div className="flex gap-0.5">
                <RBtnSmall title="Alinhar ao topo" icon={<AlignTopIco />} onClick={() => applyCellAlign('top')} />
                <RBtnSmall title="Alinhar ao centro vertical" icon={<AlignMiddleIco />} onClick={() => applyCellAlign('middle')} />
                <RBtnSmall title="Alinhar à base" icon={<AlignBottomIco />} onClick={() => applyCellAlign('bottom')} />
              </div>
              <div className="flex gap-0.5">
                <RBtnSmall title="Alinhar à esquerda" icon={<AlLIco />} onClick={() => applyCellAlign('left')} />
                <RBtnSmall title="Centralizar horizontal" icon={<AlCIco />} onClick={() => applyCellAlign('center')} />
                <RBtnSmall title="Alinhar à direita" icon={<AlRIco />} onClick={() => applyCellAlign('right')} />
              </div>
            </RCol>
          </RGroup>
          <RDiv />
          <RGroup label="Estilos">
            <RCol>
              <RBtnSmall title="Borda Fina" label="Borda Fina" onClick={() => applyTableBorders('1px solid #94a3b8')} />
              <RBtnSmall title="Sem Borda" label="Sem Borda" onClick={() => applyTableBorders('none')} />
            </RCol>
            <ColorBtnLarge title="Fundo da célula" defaultColor="#cbd5e1" onApply={applyCellBg} label="Fundo" />
          </RGroup>
        </>}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden" style={{ background: tc.canvasBg }}>

        {/* ── Canvas ── */}
        <div className="flex-1 overflow-auto pt-3 pb-6 px-6 flex flex-col items-center" style={{ background: tc.canvasBg }}>
          {/* Horizontal ruler */}
          <HorizontalRuler zoom={zoom} isDark={isDarkTheme}
            marginLeft={marginLeft} marginRight={marginRight}
            onMarginLeftChange={setMarginLeft} onMarginRightChange={setMarginRight} />

          {/* Page wrapper — enables page-break overlay */}
          <div style={{ position: 'relative' }}>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onFocus={() => {}}
              data-placeholder="Clique aqui para começar a digitar..."
              style={{
                width: `${Math.round(210 * (zoom / 100) * 3.7795)}px`,
                minHeight: `${Math.round(297 * (zoom / 100) * 3.7795)}px`,
                paddingTop: `${Math.round(2.5 * zoom / 100)}cm`,
                paddingBottom: `${Math.round(2.5 * zoom / 100)}cm`,
                paddingLeft: `${(marginLeft * zoom / 100).toFixed(3)}cm`,
                paddingRight: `${(marginRight * zoom / 100).toFixed(3)}cm`,
                fontFamily: 'Times New Roman',
                fontSize: `${Math.round(12 * zoom / 100)}pt`,
                lineHeight: 1.6,
                background: '#fff',
                color: '#1a1a1a',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                outline: 'none',
                position: 'relative',
              }}
            />
            <PageBreakOverlay zoom={zoom} editorRef={editorRef} isDark={isDarkTheme} />
          </div>
          <style>{`
            [data-placeholder]:empty:before {
              content: attr(data-placeholder);
              color: #94a3b8;
              pointer-events: none;
            }
            [contenteditable] h1 { font-size: 2em; font-weight: bold; margin: 0.67em 0; }
            [contenteditable] h2 { font-size: 1.5em; font-weight: bold; margin: 0.75em 0; }
            [contenteditable] h3 { font-size: 1.17em; font-weight: bold; margin: 0.83em 0; }
            [contenteditable] h4 { font-size: 1em; font-weight: bold; margin: 1em 0; }
            [contenteditable] blockquote { border-left: 3px solid #94a3b8; padding-left: 1em; color: #475569; margin: 0.5em 0; }
            [contenteditable] pre { background: #f1f5f9; padding: 0.75em; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
            [contenteditable] table { width: 100%; border-collapse: collapse; }
            [contenteditable] th, [contenteditable] td { border: 1px solid #94a3b8; padding: 6px 8px; }
            [contenteditable] ul { list-style-type: disc; padding-left: 1.5em; }
            [contenteditable] ol { list-style-type: decimal; padding-left: 1.5em; }
            [contenteditable] hr { border: none; border-top: 1px solid #cbd5e1; margin: 1em 0; }
          `}</style>
        </div>

        {/* ── Data panel ── */}
        {dataPanelOpen && (
          <div className="w-96 bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-hidden shadow-xl">
            {/* Header */}
            <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Ico.DB /> Dados do Banco
                {isChurchLocked && <span className="ml-1 text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-normal">Sua Igreja</span>}
                {!isChurchLocked && isRegionalLocked && <span className="ml-1 text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-normal">Sua Regional</span>}
                {isMaster && <span className="ml-1 text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-normal">Master</span>}
              </span>
              <button onClick={() => setDataPanelOpen(false)} className="text-slate-400 hover:text-slate-600 w-5 h-5 flex items-center justify-center"><Ico.X /></button>
            </div>

            {/* Source tabs */}
            <div className="flex border-b border-slate-200 bg-white">
              {(['members', 'baptism', 'consecration', 'transfer'] as const).map(src => {
                const labels = { members: 'Membros', baptism: 'Batismo', consecration: 'Consagração', transfer: 'Transfer.' };
                return (
                  <button key={src} onClick={() => {
                    setDataSource(src);
                    const n = new Date();
                    const iso = (d: Date) => d.toISOString().slice(0, 10);
                    setDateFrom(iso(new Date(n.getFullYear(), n.getMonth(), 1)));
                    setDateTo(iso(new Date(n.getFullYear(), n.getMonth() + 1, 0)));
                  }}
                    className={`flex-1 py-1.5 text-[10px] font-medium border-b-2 transition-colors ${dataSource === src ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    {labels[src]}
                  </button>
                );
              })}
            </div>

            {/* Filters */}
            <div className="px-3 pt-2 space-y-1.5">
              {/* Search (top) */}
              <div className="flex gap-1">
                <input value={dataSearch} onChange={e => setDataSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { setHasSearched(true); loadData(); } }}
                  placeholder="ROL ou nome..."
                  className="flex-1 text-[11px] border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 outline-none focus:border-blue-400 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200" />
                <button onClick={() => { setHasSearched(true); loadData(); }}
                  className="px-2.5 flex items-center justify-center bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                  <Ico.Search />
                </button>
              </div>
              {/* Date range — shown for Batismo / Consagração / Transferência */}
              {showDateFilter && (
                <div className="flex gap-1 items-center">
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="flex-1 text-[11px] border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-400 text-slate-700" />
                  <span className="text-[10px] text-slate-400">até</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="flex-1 text-[11px] border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-400 text-slate-700" />
                </div>
              )}
              {/* Regional — hidden or locked for church/regional scope */}
              {!isRegionalLocked && (
                <select value={filterRegional} onChange={e => { setFilterRegional(e.target.value); setFilterChurch(''); }}
                  className="w-full text-[11px] border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 outline-none focus:border-blue-400">
                  <option value="">Todas as Regionais</option>
                  {regionals.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              )}
              {/* Church — hidden for church scope */}
              {!isChurchLocked && (
                <select value={filterChurch} onChange={e => setFilterChurch(e.target.value)}
                  className="w-full text-[11px] border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 outline-none focus:border-blue-400">
                  <option value="">Todas as Igrejas</option>
                  {filteredChurches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>

            {/* Insert mode + bulk insert */}
            <div className="px-2 pt-2 flex items-center gap-1">
              <span className="text-[10px] text-slate-500">Inserir:</span>
              {([['table', 'Tabela'], ['list', 'Lista'], ['text', 'Texto']] as [InsertMode, string][]).map(([m, lb]) => (
                <button key={m} onClick={() => setInsertMode(m)}
                  className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${insertMode === m ? 'bg-blue-600 text-white border-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {lb}
                </button>
              ))}
              <button onClick={insertSelected} disabled={filteredData.length === 0}
                className="ml-auto flex items-center gap-1 px-2 py-0.5 text-[10px] bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-40 font-medium">
                <Ico.InsertDown />{selectedRows.size > 0 ? selectedRows.size : 'Todos'}
              </button>
            </div>

            {/* Select all */}
            <div className="px-2 pt-1 flex items-center gap-2">
              <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer">
                <input type="checkbox"
                  checked={filteredData.length > 0 && selectedRows.size === filteredData.length}
                  onChange={toggleAll}
                  className="w-3 h-3" />
                Selecionar todos ({filteredData.length})
              </label>
              {selectedRows.size > 0 && (
                <button onClick={() => setSelectedRows(new Set())} className="text-[10px] text-red-500 hover:text-red-700 ml-auto">✕ Limpar</button>
              )}
            </div>

            {/* Data list */}
            <div className="flex-1 overflow-y-auto mt-1 border-t border-slate-100">
              {dataLoading ? (
                <div className="flex items-center justify-center h-20 gap-2 text-xs text-slate-400">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full" /> Carregando...
                </div>
              ) : !hasSearched ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-400 text-xs">
                  <Ico.Search />
                  <span className="font-medium">Clique em Buscar para carregar</span>
                  <span className="text-[10px] text-center px-4">Use os filtros acima e clique na lupa para buscar os registros</span>
                </div>
              ) : filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 gap-1 text-xs text-slate-400">
                  <Ico.Search />
                  <span>Nenhum registro encontrado</span>
                  <span className="text-[10px]">Ajuste os filtros e clique em buscar</span>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredData.map(row => {
                    const checked = selectedRows.has(row.id);
                    return (
                      <div key={row.id}
                        className={`px-2 py-1.5 flex items-start gap-2 cursor-pointer transition-colors group ${checked ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                        onClick={() => toggleRow(row.id)}>
                        <input type="checkbox" checked={checked} readOnly
                          className="w-3 h-3 mt-0.5 shrink-0 accent-blue-600" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-slate-700 truncate">{row.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {row.rol ? `ROL ${row.rol}` : ''}
                            {row.church_name ? ` · ${row.church_name}` : ''}
                            {row.baptism_date ? ` · ${new Date(row.baptism_date).toLocaleDateString('pt-BR')}` : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-2 py-1.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-1 flex-wrap">
              <span className="text-[10px] text-slate-400">{filteredData.length} reg. · {selectedRows.size} sel.</span>
              <div className="flex items-center gap-2">
                {canMailMerge && (
                  <button onClick={() => setShowMailMerge(true)}
                    disabled={!hasSearched || filteredData.length === 0}
                    className="flex items-center gap-0.5 text-[10px] font-semibold text-purple-600 hover:text-purple-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <Ico.Merge /> Mala Direta
                  </button>
                )}
                <span className="text-slate-300 text-[10px]">|</span>
                <button onClick={() => { setHasSearched(true); loadData(); }} className="text-[10px] text-blue-500 hover:text-blue-700">↺ Atualizar</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      <div className="flex items-center px-3 py-0.5 shrink-0 gap-4"
        style={{ borderTop: `1px solid ${tc.border}`, background: isDarkTheme ? '#1e293b' : '#f1f5f9', color: tc.textMuted }}>
        <span className="text-[10px]">Página A4</span>
        <span className="text-[10px]">·</span>
        <span className="text-[10px]">{fontFamily} · {fontSize}pt</span>
        <span className="text-[10px]">·</span>
        <span className="text-[10px]">Zoom {zoom}%</span>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={() => buildPrintFrame(editorRef.current?.innerHTML || '', docTitle, marginLeft, marginRight)}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors"><Ico.Print /> Imprimir</button>
          <button onClick={() => exportDocx(editorRef.current?.innerHTML || '', docTitle)}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors"><Ico.Download /> Exportar .doc</button>
        </div>
      </div>

      {/* ── File drawer overlay ── */}
      {fileDrawerOpen && (
        <div className="absolute inset-0 z-40 flex" onClick={() => setFileDrawerOpen(false)}>
          <div className="absolute left-0 top-0 h-full w-80 bg-white border-r border-slate-200 shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <span className="font-semibold text-sm text-slate-700 flex items-center gap-1.5"><Ico.Folder /> Documentos Salvos</span>
              <button onClick={() => setFileDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 w-5 h-5 flex items-center justify-center"><Ico.X /></button>
            </div>
            <div className="px-3 pt-3 flex gap-2">
              <input value={fileSearch} onChange={e => setFileSearch(e.target.value)} placeholder="Buscar documento..."
                className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-blue-400" />
              <button onClick={loadFiles} className="px-2 py-1 flex items-center text-slate-600 border border-slate-200 rounded hover:bg-slate-50"><Ico.Refresh /></button>
            </div>
            <div className="flex-1 overflow-y-auto mt-2">
              {loadingFiles ? (
                <div className="flex items-center justify-center h-20 text-xs text-slate-400 gap-2">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full" /> Carregando...
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-xs text-slate-400 gap-2">
                  <Ico.Folder />
                  <span>Nenhum documento salvo</span>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredFiles.map(file => (
                    <div key={file.name} className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 flex items-start gap-2" onClick={() => openFile(file)}>
                          <Ico.FileWord />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate">{file.displayName}</p>
                            <p className="text-[10px] text-slate-400">
                              {file.updated_at ? new Date(file.updated_at).toLocaleString('pt-BR') : '—'}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => setConfirmDelete(file)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity flex items-center"><Ico.Trash /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-3 pb-3 pt-2 border-t border-slate-200">
              <button onClick={newDocument}
                className="w-full py-2 text-xs border-2 border-dashed border-slate-300 rounded hover:bg-slate-50 text-slate-500 flex items-center justify-center gap-1">
                <Ico.Plus /> Novo Documento em Branco
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Template picker ── */}
      {showTemplatePicker && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowTemplatePicker(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-semibold text-slate-700 flex items-center gap-1.5"><Ico.FileText /> Modelos de Documento</h3>
                <p className="text-xs text-slate-400 mt-0.5">Escolha um modelo para iniciar o documento</p>
              </div>
              <button onClick={() => setShowTemplatePicker(false)} className="text-slate-400 hover:text-slate-600 w-6 h-6 flex items-center justify-center"><Ico.X /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-5 overflow-y-auto">
              {TEMPLATES.map(t => (
                <button key={t.id}
                  onClick={() => {
                    setDocTitle(t.id === 'blank' ? 'Documento1' : t.name);
                    if (editorRef.current) editorRef.current.innerHTML = t.html;
                    setShowTemplatePicker(false);
                    focusEditor();
                  }}
                  className="flex flex-col items-center gap-2 p-4 border-2 border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group">
                  <span className="text-slate-500 group-hover:text-blue-600"><Ico.FileText /></span>
                  <span className="text-xs font-medium text-slate-600 group-hover:text-blue-700 text-center">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm delete ── */}
      {confirmDelete && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full mx-4">
            <p className="font-semibold text-slate-800 mb-2">Excluir documento?</p>
            <p className="text-sm text-slate-500 mb-5">"{confirmDelete.displayName}" será removido permanentemente.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-1.5 text-sm border border-slate-200 rounded hover:bg-slate-50 text-slate-600">Cancelar</button>
              <button onClick={() => deleteFile(confirmDelete)} className="px-4 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded font-medium">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm new document ── */}
      {confirmNew && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full mx-4">
            <p className="font-semibold text-slate-800 mb-2">Criar novo documento?</p>
            <p className="text-sm text-slate-500 mb-5">O documento atual tem conteúdo não salvo. Ao continuar, o texto será perdido.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmNew(false)} className="px-4 py-1.5 text-sm border border-slate-200 rounded hover:bg-slate-50 text-slate-600">Cancelar</button>
              <button onClick={clearDocument} className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-medium">Novo Documento</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mail merge modal ── */}
      {showMailMerge && (() => {
        const mergeMembers = selectedRows.size > 0
          ? dataRows.filter(r => selectedRows.has(r.id))
          : dataRows;
        const template = editorRef.current?.innerHTML || '';
        const detected = Array.from(new Set(Array.from(template.matchAll(/\[[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÇ\s]+\]/gi), m => m[0])));
        return (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40"
            onClick={() => setShowMailMerge(false)}>
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full mx-4"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-purple-600"><Ico.Merge /></span>
                <h3 className="font-semibold text-slate-800">Mala Direta</h3>
              </div>
              <p className="text-sm text-slate-600 mb-3">
                Serão gerados <strong className="text-purple-700">{mergeMembers.length} documento{mergeMembers.length !== 1 ? 's' : ''}</strong>
                {selectedRows.size > 0 ? ` (${selectedRows.size} selecionado${selectedRows.size !== 1 ? 's' : ''})` : ' (todos da busca)'}, um por folha.
              </p>
              {detected.length > 0 && (
                <div className="mb-4 bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Campos detectados no documento</p>
                  <div className="flex flex-wrap gap-1">
                    {detected.map(f => (
                      <span key={f} className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-mono">{f}</span>
                    ))}
                  </div>
                </div>
              )}
              {mergeMembers.length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded p-2 mb-3">Nenhum membro na lista. Faça uma busca no painel de dados primeiro.</p>
              )}
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowMailMerge(false)}
                  className="px-4 py-1.5 text-sm border border-slate-200 rounded hover:bg-slate-50 text-slate-600">
                  Cancelar
                </button>
                <button onClick={doMailMerge} disabled={mergeMembers.length === 0}
                  className="px-4 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded font-medium disabled:opacity-40 flex items-center gap-1.5">
                  <Ico.Print /> Imprimir {mergeMembers.length} doc{mergeMembers.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Link dialog ── */}
      {linkDialog && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40"
          onClick={() => setLinkDialog(null)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-blue-600"><Ico.Link /></span>
              <h3 className="font-semibold text-slate-800">Inserir Hyperlink</h3>
            </div>
            <label className="block text-xs font-medium text-slate-600 mb-1">URL do link</label>
            <input
              autoFocus
              value={linkDialog.url}
              onChange={e => setLinkDialog(d => d ? { ...d, url: e.target.value } : null)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (linkDialog.savedRange) { const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(linkDialog.savedRange); }
                  if (linkDialog.url) applyCmd('createLink', linkDialog.url);
                  setLinkDialog(null);
                } else if (e.key === 'Escape') {
                  setLinkDialog(null);
                }
              }}
              placeholder="https://exemplo.com"
              className="w-full text-sm border border-slate-300 rounded px-3 py-2 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setLinkDialog(null)}
                className="px-4 py-1.5 text-sm border border-slate-200 rounded hover:bg-slate-50 text-slate-600">
                Cancelar
              </button>
              <button onClick={() => {
                if (linkDialog.savedRange) { const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(linkDialog.savedRange); }
                if (linkDialog.url) applyCmd('createLink', linkDialog.url);
                setLinkDialog(null);
              }}
                className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center gap-1.5">
                <Ico.Link /> Inserir Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table picker (fixed pos, not clipped by ribbon overflow) ── */}
      {showTablePicker && (
        <div
          style={{ position: 'fixed', left: tablePickerPos.x, top: tablePickerPos.y, zIndex: 1000 }}
          className="bg-white border border-slate-200 shadow-xl p-2 rounded"
          onMouseLeave={() => { setShowTablePicker(false); setTableHover({ r: 0, c: 0 }); }}>
          <p className="text-[10px] text-slate-500 mb-1.5 text-center font-medium">
            {tableHover.r > 0 ? `${tableHover.r} × ${tableHover.c} Tabela` : 'Tamanho da Tabela'}
          </p>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(10, 18px)' }}>
            {Array.from({ length: 8 }).flatMap((_, ri) =>
              Array.from({ length: 10 }).map((_, ci) => (
                <div key={`${ri}-${ci}`}
                  className={`w-[18px] h-[18px] border cursor-pointer rounded-sm transition-colors ${
                    ri < tableHover.r && ci < tableHover.c
                      ? 'bg-blue-400 border-blue-500'
                      : 'bg-slate-50 border-slate-200 hover:bg-blue-100 hover:border-blue-300'
                  }`}
                  onMouseEnter={() => setTableHover({ r: ri + 1, c: ci + 1 })}
                  onClick={() => { insertTable(tableHover.r, tableHover.c); setShowTablePicker(false); setTableHover({ r: 0, c: 0 }); }}
                />
              ))
            )}
          </div>
        </div>
      )}
      {/* ── Member History Selection Modal ── */}
      {showHistoryModal && selectedMemberDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowHistoryModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden flex flex-col mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Ico.FileText /> Inserir Histórico de Membro
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedMemberDetails.full_name}</p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600 w-6 h-6 flex items-center justify-center">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500">Selecione quais seções do histórico deseja incluir no documento como tabelas formatadas:</p>
              <div className="space-y-2.5">
                {[
                  { id: 'functions', label: 'Histórico de Cargos e Funções' },
                  { id: 'titles', label: 'Histórico de Títulos e Consagrações' },
                  { id: 'occurrences', label: 'Histórico de Ocorrências' }
                ].map(item => {
                  const checked = selectedHistoryTypes.includes(item.id);
                  return (
                    <label key={item.id} className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors">
                      <input 
                        type="checkbox" 
                        checked={checked} 
                        onChange={() => {
                          setSelectedHistoryTypes(prev => 
                            prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]
                          );
                        }} 
                        className="w-4.5 h-4.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                      />
                      {item.label}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-700 flex gap-3 justify-end bg-slate-50 dark:bg-slate-900">
              <button onClick={() => setShowHistoryModal(false)} className="px-4 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
                Cancelar
              </button>
              <button onClick={insertMemberHistory} disabled={selectedHistoryTypes.length === 0} className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50">
                Inserir Histórico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ficha Cadastral Selection Modal ── */}
      {showFichaModal && selectedMemberDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowFichaModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden flex flex-col mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Ico.UserCard /> Ficha Cadastral Personalizada
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedMemberDetails.full_name}</p>
              </div>
              <button onClick={() => setShowFichaModal(false)} className="text-slate-400 hover:text-slate-600 w-6 h-6 flex items-center justify-center">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">Selecione quais seções deseja incluir no formulário:</p>
                <div className="flex gap-2 text-[10px]">
                  <button onClick={() => setFichaCategories(['photo', 'personal', 'contact', 'address', 'church', 'family', 'emergency'])} className="text-blue-600 hover:underline">Todos</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={() => setFichaCategories([])} className="text-red-500 hover:underline">Nenhum</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                {[
                  { id: 'photo', label: 'Foto do Membro' },
                  { id: 'personal', label: 'Dados Pessoais' },
                  { id: 'contact', label: 'Contatos' },
                  { id: 'address', label: 'Endereço' },
                  { id: 'church', label: 'Dados Eclesiásticos' },
                  { id: 'family', label: 'Dados Familiares' },
                  { id: 'emergency', label: 'Contato Emergência' }
                ].map(item => {
                  const checked = fichaCategories.includes(item.id);
                  return (
                    <label key={item.id} className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors">
                      <input 
                        type="checkbox" 
                        checked={checked} 
                        onChange={() => {
                          setFichaCategories(prev => 
                            prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]
                          );
                        }} 
                        className="w-4.5 h-4.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                      />
                      {item.label}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-700 flex gap-3 justify-end bg-slate-50 dark:bg-slate-900">
              <button onClick={() => setShowFichaModal(false)} className="px-4 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
                Cancelar
              </button>
              <button onClick={insertMemberForm} disabled={fichaCategories.length === 0} className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50">
                Inserir Formulário
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Photo Resize Floating Slider ── */}
      {selectedImg && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl p-3.5 z-[1000] flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="text-[11px] text-slate-500 font-medium">Largura da Foto:</span>
          <input 
            type="range" 
            min="40" 
            max="600" 
            value={parseInt(selectedImg.style.width || String(selectedImg.width)) || 150} 
            onChange={e => {
              const val = e.target.value;
              selectedImg.style.width = `${val}px`;
              selectedImg.style.height = `${val}px`; // Keep square aspect ratio
            }}
            className="w-32 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <span className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">{parseInt(selectedImg.style.width || String(selectedImg.width)) || 150}px</span>
          <button onClick={() => setSelectedImg(null)} className="text-slate-400 hover:text-slate-600 text-xs px-1">✕</button>
        </div>
      )}
    </div>
  );
}
