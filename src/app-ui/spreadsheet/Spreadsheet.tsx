import React, {
  useState, useRef, useCallback, useEffect, useMemo, useLayoutEffect
} from 'react';
import * as XLSX from 'xlsx-js-style';

import { supabase } from '../../lib/supabaseClient';
import { apiBase } from '../../lib/apiBase';
import {
  buildFieldAnalysisReport,
  buildFieldAnalysisSheet,
  type FieldAnalysisFilters,
  type FieldAnalysisScopeChurch,
  type FieldAnalysisSheetMeta,
} from './fieldAnalysis';
import {
  buildDizimistasReport,
  buildDizimistasSheet,
  type DizimistasFilters,
  type DizimistasEntry,
  type DizimistasSheetMeta,
  type DizimistasScopeMember,
} from './dizimistasAnalysis';

// ─── Types ────────────────────────────────────────────────────────────────────
type Align = 'left' | 'center' | 'right';
type NumFmt = 'general' | 'number' | 'currency' | 'accounting' | 'shortdate' | 'fulldate' | 'time' | 'percent' | 'fraction' | 'scientific' | 'text';
interface BorderSide { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean; }

interface CellData {
  value: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  align?: Align;
  valign?: 'top' | 'middle' | 'bottom';
  bgColor?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  numberFormat?: NumFmt;
  borders?: BorderSide;
  wrapText?: boolean;
  mergeColSpan?: number;
  mergeRowSpan?: number;
  mergeHidden?: boolean;
}

interface Selection { r1: number; c1: number; r2: number; c2: number; }

interface SheetState {
  id: string;
  name: string;
  color: string;
  cells: Record<string, CellData>;
  colWidths: Record<number, number>;
  rowHeights: Record<number, number>;
  frozenRows: number;
  frozenCols: number;
  meta?: FieldAnalysisSheetMeta | DizimistasSheetMeta;
}

interface CtxMenu { x: number; y: number; row: number; col: number; }
type RibbonTab = 'home' | 'data' | 'fieldAnalysis' | 'dizimistas' | 'view';
type ScopeRegional = { id: string; name: string };
type ScopeChurch = { id: string; name: string; regionalId: string };
type StoredUser = { profileType?: string; campoId?: string; regionalId?: string; churchId?: string };

// ─── Constants ────────────────────────────────────────────────────────────────
const TOTAL_ROWS = 1000;
const TOTAL_COLS = 52;
const DEFAULT_COL_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 24;
const ROW_HEADER_WIDTH = 50;
const COL_HEADER_HEIGHT = 24;
const BUFFER = 8;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function colToLetter(col: number): string {
  let s = '', n = col + 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function cellKey(row: number, col: number) { return `${colToLetter(col)}${row + 1}`; }
function parseRef(ref: string) {
  const m = ref.match(/^\$?([A-Z]+)\$?(\d+)$/i);
  if (!m) return null;
  const colStr = m[1].toUpperCase();
  let col = 0;
  for (let i = 0; i < colStr.length; i++) col = col * 26 + (colStr.charCodeAt(i) - 64);
  return { row: parseInt(m[2]) - 1, col: col - 1 };
}
function expandRange(range: string): string[] {
  const p = range.split(':');
  if (p.length !== 2) return [range.toUpperCase()];
  const a = parseRef(p[0]), b = parseRef(p[1]);
  if (!a || !b) return [];
  const refs: string[] = [];
  for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++)
    for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++)
      refs.push(cellKey(r, c));
  return refs;
}
function asNum(v: string) { const n = parseFloat(v.replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; }
function fmtNum(n: number) { return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(10))); }

// ─── Formula Engine ───────────────────────────────────────────────────────────
function evalFormula(raw: string, cells: Record<string, CellData>, depth = 0): string {
  if (!raw.startsWith('=') || depth > 10) return raw;
  const expr = raw.slice(1).trim();
  try {
    if (/^TODAY\(\)$/i.test(expr)) return new Date().toLocaleDateString('pt-BR');
    if (/^NOW\(\)$/i.test(expr)) return new Date().toLocaleString('pt-BR');
    if (/^PI\(\)$/i.test(expr)) return String(Math.PI);

    // Resolve refs not inside range notation
    const resolved = expr.replace(/([A-Z]+\d+):([A-Z]+\d+)|([A-Z]+\d+)/gi, (m, r1, r2, single) => {
      if (r1 && r2) return m;
      if (single) {
        const v = cells[single.toUpperCase()]?.value ?? '0';
        return v.startsWith('=') ? (evalFormula(v, cells, depth + 1) || '0') : (isNaN(Number(v)) ? `"${v}"` : (v || '0'));
      }
      return m;
    });

    const getRange = (arg: string) => getRangeNums(arg, cells);

    const sum = resolved.match(/^SUM\((.+)\)$/i);
    if (sum) return fmtNum(getRange(sum[1]).reduce((a, b) => a + b, 0));
    const avg = resolved.match(/^AVERAGE\((.+)\)$/i);
    if (avg) { const n = getRange(avg[1]); return n.length ? fmtNum(n.reduce((a, b) => a + b, 0) / n.length) : '0'; }
    const cnt = resolved.match(/^COUNT\((.+)\)$/i);
    if (cnt) return String(getRange(cnt[1]).length);
    const cnta = resolved.match(/^COUNTA\((.+)\)$/i);
    if (cnta) return String(expandRange(cnta[1].trim()).filter(r => cells[r]?.value).length);
    const mx = resolved.match(/^MAX\((.+)\)$/i);
    if (mx) { const n = getRange(mx[1]); return n.length ? fmtNum(Math.max(...n)) : '0'; }
    const mn = resolved.match(/^MIN\((.+)\)$/i);
    if (mn) { const n = getRange(mn[1]); return n.length ? fmtNum(Math.min(...n)) : '0'; }
    const ifm = resolved.match(/^IF\((.+?),(.+?),(.+)\)$/i);
    if (ifm) { try { return safeEval(ifm[1].trim()) ? ifm[2].trim().replace(/^"|"$/g, '') : ifm[3].trim().replace(/^"|"$/g, ''); } catch { return '#ERRO!'; } }
    const cat = resolved.match(/^CONCATENATE\((.+)\)$/i);
    if (cat) return cat[1].split(',').map(s => s.trim().replace(/^"|"$/g, '')).join('');
    const len = resolved.match(/^LEN\((.+)\)$/i);
    if (len) return String((cells[len[1].toUpperCase()]?.value ?? '').length);
    const up = resolved.match(/^UPPER\((.+)\)$/i);
    if (up) return (cells[up[1].toUpperCase()]?.value ?? up[1]).toUpperCase();
    const lo = resolved.match(/^LOWER\((.+)\)$/i);
    if (lo) return (cells[lo[1].toUpperCase()]?.value ?? lo[1]).toLowerCase();
    const ab = resolved.match(/^ABS\((.+)\)$/i);
    if (ab) return fmtNum(Math.abs(asNum(ab[1])));
    const rnd = resolved.match(/^ROUND\((.+),(.+)\)$/i);
    if (rnd) return fmtNum(Math.round(parseFloat(rnd[1]) * Math.pow(10, parseInt(rnd[2]))) / Math.pow(10, parseInt(rnd[2])));
    const pw = resolved.match(/^POWER\((.+),(.+)\)$/i);
    if (pw) return fmtNum(Math.pow(parseFloat(pw[1]), parseFloat(pw[2])));
    const sq = resolved.match(/^SQRT\((.+)\)$/i);
    if (sq) return fmtNum(Math.sqrt(asNum(sq[1])));
    const r = safeEval(resolved);
    return String(r ?? '#VALOR!');
  } catch { return '#ERRO!'; }
}

function getRangeNums(args: string, cells: Record<string, CellData>): number[] {
  const nums: number[] = [];
  for (const part of args.split(',')) {
    const t = part.trim();
    if (t.includes(':')) expandRange(t).forEach(r => { const v = cells[r]?.value ?? ''; if (v) nums.push(asNum(v)); });
    else if (/^[A-Z]+\d+$/i.test(t)) { const v = cells[t.toUpperCase()]?.value ?? ''; if (v) nums.push(asNum(v)); }
    else { const n = parseFloat(t); if (!isNaN(n)) nums.push(n); }
  }
  return nums;
}

function safeEval(expr: string): number | string {
  if (!/^[0-9+\-*/.()\s%<>=!&|"'a-zA-Z_]+$/.test(expr)) return '#VALOR!';
  try { return new Function(`"use strict";return(${expr})`)(); } catch { return '#ERRO!'; }
}

function applyNumFmt(raw: string, fmt: NumFmt | undefined): string {
  if (!raw || !fmt || fmt === 'general' || fmt === 'text') return raw;
  const n = parseFloat(raw);
  if (isNaN(n)) return raw;
  if (fmt === 'currency' || fmt === 'accounting') return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (fmt === 'percent') return `${(n * 100).toFixed(2)}%`;
  if (fmt === 'number') return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (fmt === 'date' || fmt === 'shortdate') { const d = new Date(raw); return isNaN(d.getTime()) ? raw : d.toLocaleDateString('pt-BR'); }
  if (fmt === 'fulldate') { const d = new Date(raw); return isNaN(d.getTime()) ? raw : d.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
  if (fmt === 'time') { const d = new Date(raw); return isNaN(d.getTime()) ? raw : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  if (fmt === 'scientific') return n.toExponential(2).toUpperCase();
  if (fmt === 'fraction') {
    const sign = n < 0 ? '-' : ''; const abs = Math.abs(n); const whole = Math.floor(abs); const frac = abs - whole;
    if (frac < 0.001) return String(Math.round(n));
    let bestNum = 1, bestDen = 2, bestDiff = 1;
    for (let d = 2; d <= 16; d++) { const num = Math.round(frac * d); const diff = Math.abs(frac - num / d); if (diff < bestDiff) { bestDiff = diff; bestNum = num; bestDen = d; } }
    return whole > 0 ? `${sign}${whole} ${bestNum}/${bestDen}` : `${sign}${bestNum}/${bestDen}`;
  }
  return raw;
}

function getCellDisplay(key: string, cells: Record<string, CellData>): string {
  const cell = cells[key];
  if (!cell) return '';
  const v = cell.value;
  if (v.startsWith('=')) return String(evalFormula(v, cells));
  return applyNumFmt(v, cell.numberFormat);
}

function readStoredUser(): StoredUser {
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}');
  } catch {
    return {};
  }
}

function toInputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toMonthBoundaryStart(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toMonthBoundaryEnd(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  return date.getDate() === 1
    ? new Date(date.getFullYear(), date.getMonth(), 1)
    : new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function buildPrintFrame(html: string) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  setTimeout(() => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }, 2000);
}

// ─── Flat SVG Icons ───────────────────────────────────────────────────────────
const Ico = {
  Copy: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  Cut: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="6" cy="20" r="2"/><circle cx="6" cy="4" r="2"/><line x1="6" y1="6" x2="6" y2="18"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/></svg>,
  Paste: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 2h6a1 1 0 0 1 1 1v1H8V3a1 1 0 0 1 1-1z"/><rect x="4" y="4" width="16" height="18" rx="2"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="14" y2="14"/></svg>,
  Undo: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M3 7v6h6"/><path d="M3 13A9 9 0 1 0 5.4 6.4"/></svg>,
  Redo: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 7v6h-6"/><path d="M21 13A9 9 0 1 1 18.6 6.4"/></svg>,
  Search: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Trash: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  RowUp: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="11" width="18" height="10" rx="1"/><path d="M12 7V3"/><path d="M9 6l3-3 3 3"/></svg>,
  RowDown: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="3" width="18" height="10" rx="1"/><path d="M12 17v4"/><path d="M9 18l3 3 3-3"/></svg>,
  DelRow: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="6" width="18" height="14" rx="1"/><line x1="8" y1="12" x2="16" y2="12"/><path d="M3 3h6m6 0h6"/></svg>,
  ColLeft: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="13" y="3" width="8" height="18" rx="1"/><path d="M7 12H3"/><path d="M6 9l-3 3 3 3"/></svg>,
  ColRight: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="3" width="8" height="18" rx="1"/><path d="M17 12h4"/><path d="M18 9l3 3-3 3"/></svg>,
  DelCol: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="6" y="3" width="12" height="18" rx="1"/><line x1="12" y1="8" x2="12" y2="16"/><path d="M3 3v6m0 6v6"/></svg>,
  Plus: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Upload: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Download: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  FileCSV: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></svg>,
  Cloud: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>,
  CloudUp: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
  DB: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  Border: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="3" x2="12" y2="21"/></svg>,
  BgColor: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M3 21h4l10.5-10.5a1.5 1.5 0 0 0-2.12-2.12L5 18.88V21z"/><path d="M14.5 5.5l2.12 2.12"/><path d="M20 18c0 1.1-.9 2-2 2s-2-.9-2-2c0-1.1 2-4 2-4s2 2.9 2 4z" fill="currentColor" stroke="none"/></svg>,
  FontColor: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M4 20h16"/><path d="M6 16l6-12 6 12"/><path d="M8.5 11h7"/></svg>,
  AlignLeft: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>,
  AlignCenter: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>,
  AlignRight: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>,
  WrapText: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="3" y1="6" x2="21" y2="6"/><path d="M3 12h15a3 3 0 0 1 0 6h-4"/><polyline points="10 15 7 18 10 21"/></svg>,
  ZoomIn: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  Save: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Merge: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 12h4m14 0h-4"/><path d="M10 8l-3 4 3 4"/><path d="M14 8l3 4-3 4"/></svg>,
  SortAZ: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="3" y1="6" x2="11" y2="6"/><line x1="3" y1="12" x2="9" y2="12"/><line x1="3" y1="18" x2="7" y2="18"/><path d="M16 3v18"/><path d="M13 18l3 3 3-3"/></svg>,
  SortZA: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="3" y1="6" x2="7" y2="6"/><line x1="3" y1="12" x2="9" y2="12"/><line x1="3" y1="18" x2="11" y2="18"/><path d="M16 21V3"/><path d="M13 6l3-3 3 3"/></svg>,
  Filter: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M22 3H2l8 9.46V19l4 2V12.46L22 3z"/></svg>,
  Sigma: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M18 4H6l6 8-6 8h12"/></svg>,
  ChevDown: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5"><polyline points="6 9 12 15 18 9"/></svg>,
  Print: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  Analyze: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M4 19h16"/><path d="M7 15V9"/><path d="M12 15V5"/><path d="M17 15v-3"/><circle cx="7" cy="8" r="1"/><circle cx="12" cy="4" r="1"/><circle cx="17" cy="11" r="1"/></svg>,
  CalendarRange: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 14h3"/><path d="M13 14h3"/></svg>,
};

const mkSheet = (name = 'Planilha1', overrides: Partial<SheetState> = {}): SheetState => ({
  id: crypto.randomUUID(),
  name,
  color: '#2563eb',
  cells: {},
  colWidths: {},
  rowHeights: {},
  frozenRows: 0,
  frozenCols: 0,
  ...overrides,
});

const PALETTE = [
  '#ffffff','#f8fafc','#f1f5f9','#e2e8f0','#94a3b8','#64748b','#475569','#334155','#1e293b','#0f172a',
  '#fef2f2','#fee2e2','#fca5a5','#f87171','#ef4444','#dc2626','#b91c1c','#991b1b','#7f1d1d','#450a0a',
  '#fff7ed','#ffedd5','#fed7aa','#fdba74','#fb923c','#f97316','#ea580c','#c2410c','#9a3412','#431407',
  '#fefce8','#fef9c3','#fef08a','#fde047','#facc15','#eab308','#ca8a04','#a16207','#854d0e','#422006',
  '#f0fdf4','#dcfce7','#bbf7d0','#86efac','#4ade80','#22c55e','#16a34a','#15803d','#166534','#052e16',
  '#eff6ff','#dbeafe','#bfdbfe','#93c5fd','#60a5fa','#3b82f6','#2563eb','#1d4ed8','#1e40af','#172554',
  '#f5f3ff','#ede9fe','#ddd6fe','#c4b5fd','#a78bfa','#8b5cf6','#7c3aed','#6d28d9','#5b21b6','#2e1065',
  '#fdf4ff','#fae8ff','#f5d0fe','#e879f9','#d946ef','#c026d3','#a21caf','#86198f','#701a75','#4a044e',
];

const TAB_COLORS = ['#4f46e5','#0891b2','#16a34a','#dc2626','#d97706','#7c3aed','#db2777'];

// ─── Function autocomplete catalogue ─────────────────────────────────────────
interface FnDef { name: string; hint: string; args: string; }
const FUNCTIONS: FnDef[] = [
  { name: 'SUM',         hint: 'SUM(número1; [número2]; ...)',               args: '(' },
  { name: 'AVERAGE',     hint: 'AVERAGE(número1; [número2]; ...)',           args: '(' },
  { name: 'COUNT',       hint: 'COUNT(valor1; [valor2]; ...)',               args: '(' },
  { name: 'COUNTA',      hint: 'COUNTA(valor1; [valor2]; ...)',              args: '(' },
  { name: 'MAX',         hint: 'MAX(número1; [número2]; ...)',               args: '(' },
  { name: 'MIN',         hint: 'MIN(número1; [número2]; ...)',               args: '(' },
  { name: 'IF',          hint: 'IF(teste; valor_verdadeiro; valor_falso)',   args: '(' },
  { name: 'TODAY',       hint: 'TODAY()  — retorna a data de hoje',         args: '()' },
  { name: 'NOW',         hint: 'NOW()  — retorna data e hora atuais',       args: '()' },
  { name: 'ROUND',       hint: 'ROUND(número; casas_decimais)',             args: '(' },
  { name: 'SQRT',        hint: 'SQRT(número)',                              args: '(' },
  { name: 'ABS',         hint: 'ABS(número)',                               args: '(' },
  { name: 'POWER',       hint: 'POWER(número; potência)',                   args: '(' },
  { name: 'LEN',         hint: 'LEN(texto)',                                args: '(' },
  { name: 'UPPER',       hint: 'UPPER(texto)',                              args: '(' },
  { name: 'LOWER',       hint: 'LOWER(texto)',                              args: '(' },
  { name: 'CONCATENATE', hint: 'CONCATENATE(texto1; [texto2]; ...)',        args: '(' },
  { name: 'PI',          hint: 'PI()  — retorna π (3.14159...)',            args: '()' },
];

// Extract which function is currently open (after the last '=')
function getOpenFn(formula: string): FnDef | null {
  const m = formula.match(/=([A-Z]+)\s*\(/i);
  if (!m) return null;
  return FUNCTIONS.find(f => f.name === m[1].toUpperCase()) ?? null;
}

// ─── Number Format options ────────────────────────────────────────────────────
const NUM_FMT_OPTIONS: { value: NumFmt; label: string; desc: string; icon: string }[] = [
  { value: 'general',    label: 'Geral',          desc: 'Sem formato específico', icon: '123' },
  { value: 'number',     label: 'Número',         desc: '',                       icon: '12' },
  { value: 'currency',   label: 'Moeda',          desc: '',                       icon: 'R$' },
  { value: 'accounting', label: 'Contábil',       desc: '',                       icon: '₫' },
  { value: 'shortdate',  label: 'Data Abreviada', desc: '',                       icon: '▪' },
  { value: 'fulldate',   label: 'Data Completa',  desc: '',                       icon: '▪▪' },
  { value: 'time',       label: 'Hora',           desc: '',                       icon: '⌚' },
  { value: 'percent',    label: 'Porcentagem',    desc: '',                       icon: '%' },
  { value: 'fraction',   label: 'Fração',         desc: '',                       icon: '½' },
  { value: 'scientific', label: 'Científico',     desc: '',                       icon: '10²' },
  { value: 'text',       label: 'Texto',          desc: '',                       icon: 'ab' },
];
const NUM_FMT_LABELS: Record<string, string> = Object.fromEntries(NUM_FMT_OPTIONS.map(o => [o.value, o.label]));

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Spreadsheet() {
  const [sheets, setSheets] = useState<SheetState[]>([mkSheet()]);
  const [activeIdx, setActiveIdx] = useState(0);
  const activeSheet = sheets[activeIdx];
  const defaultFieldAnalysisFilters = useMemo<FieldAnalysisFilters>(() => {
    const today = new Date();
    return {
      startDate: toInputDate(new Date(today.getFullYear(), today.getMonth() - 2, 1)),
      endDate: toInputDate(new Date(today.getFullYear(), today.getMonth() + 1, 1)),
      regionalId: '',
      regionalIds: [],
      regionalLabel: 'Todas as Regionais',
    };
  }, []);

  const [sel, setSel] = useState<Selection>({ r1: 0, c1: 0, r2: 0, c2: 0 });
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [formulaBar, setFormulaBar] = useState('');
  const [formulaMode, setFormulaMode] = useState(false);
  // formula-click tracking: position in formula where we inserted the last ref
  const formulaRefInsertPos = useRef<number>(0);
  const formulaClickAnchor = useRef<{ row: number; col: number } | null>(null);
  // autocomplete
  const [acMatches, setAcMatches] = useState<FnDef[]>([]);
  const [acSelIdx, setAcSelIdx] = useState(0);
  // visual formula range selection (dashed blue like Excel)
  const [formulaRangeSel, setFormulaRangeSel] = useState<{ r1: number; c1: number; r2: number; c2: number } | null>(null);

  const [zoom, setZoom] = useState(100);
  const [activeRibbon, setActiveRibbon] = useState<RibbonTab>('home');
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [showFindBar, setShowFindBar] = useState(false);
  const [findVal, setFindVal] = useState('');
  const [showBorderPicker, setShowBorderPicker] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showAutoSumMenu, setShowAutoSumMenu] = useState(false);
  const [showFxMenu, setShowFxMenu] = useState(false);
  const [showNumFmtMenu, setShowNumFmtMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showMergeMenu, setShowMergeMenu] = useState(false);
  const [fieldAnalysisFilters, setFieldAnalysisFilters] = useState<FieldAnalysisFilters>(defaultFieldAnalysisFilters);
  const [fieldAnalysisRegionals, setFieldAnalysisRegionals] = useState<ScopeRegional[]>([]);
  const [arquivoFiles, setArquivoFiles] = useState<Array<{ name: string; updated_at: string; url: string }>>([]);
  const [arquivoSearch, setArquivoSearch] = useState('');
  const [arquivoLoading, setArquivoLoading] = useState(false);
  const [arquivoDrawerOpen, setArquivoDrawerOpen] = useState(false);
  const [arquivoConfirm, setArquivoConfirm] = useState<{ type: 'open' | 'delete'; file: { name: string; url: string } } | null>(null);
  const [fieldAnalysisScopeLoaded, setFieldAnalysisScopeLoaded] = useState(false);
  const [fieldAnalysisLoading, setFieldAnalysisLoading] = useState(false);
  const [fieldAnalysisError, setFieldAnalysisError] = useState('');
  const [fieldAnalysisNotice, setFieldAnalysisNotice] = useState('');

  // ── Dizimistas state
  const defaultDizimistasFilters = useMemo<DizimistasFilters>(() => {
    const today = new Date();
    return {
      startDate: toInputDate(new Date(today.getFullYear(), today.getMonth() - 2, 1)),
      endDate: toInputDate(new Date(today.getFullYear(), today.getMonth() + 1, 1)),
      regionalIds: [],
      regionalLabels: [],
      churchIds: [],
      churchLabels: [],
      titleIds: [],
      titleLabels: [],
    };
  }, []);
  const [dizimistasFilters, setDizimistasFilters] = useState<DizimistasFilters>(defaultDizimistasFilters);
  const [dizimistasChurches, setDizimistasChurches] = useState<ScopeChurch[]>([]);
  const [dizimistasRegionals, setDizimistasRegionals] = useState<ScopeRegional[]>([]);
  const [dizimistasChurchesLoaded, setDizimistasChurchesLoaded] = useState(false);
  const [dizizimistasTitles, setDizzimistasTitles] = useState<Array<{ id: string; name: string }>>([]);
  const [dizimistasChurchSearch, setDizimistasChurchSearch] = useState('');
  const [dizimistasLoading, setDizimistasLoading] = useState(false);
  const [dizimistasError, setDizimistasError] = useState('');
  const [dizimistasNotice, setDizimistasNotice] = useState('');
  const [dizimistasISituacao, setDizimistasISituacao] = useState<'todos' | 'todos_os_meses' | 'inconstante' | 'dizimistas' | 'nao_dizimistas'>('todos');  const [isDarkTheme, setIsDarkTheme] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const syncTheme = () => setIsDarkTheme(root.classList.contains('dark'));
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const pushGeneratedSheet = useCallback((sheet: SheetState) => {
    setSheets(prev => [...prev, sheet]);
    setActiveIdx(sheets.length);
  }, [sheets.length]);

  const loadFieldAnalysisRegionals = useCallback(async () => {
    const storedUser = readStoredUser();
    const profileType = storedUser.profileType || '';
    let regionalsQuery = supabase
      .from('regionais')
      .select('id, name, campo_id')
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (profileType === 'regional' && storedUser.regionalId) {
      regionalsQuery = regionalsQuery.eq('id', storedUser.regionalId);
    } else if (profileType === 'church' && storedUser.churchId) {
      const { data: churchRow, error: churchError } = await supabase
        .from('churches')
        .select('regional_id')
        .eq('id', storedUser.churchId)
        .maybeSingle();
      if (churchError) throw churchError;
      if (churchRow?.regional_id) regionalsQuery = regionalsQuery.eq('id', churchRow.regional_id);
    } else if (storedUser.campoId) {
      regionalsQuery = regionalsQuery.eq('campo_id', storedUser.campoId);
    }

    const { data, error } = await regionalsQuery;
    if (error) throw error;
    const options = (data || []).map(item => ({ id: item.id as string, name: item.name as string }));
    setFieldAnalysisRegionals(options);
    setFieldAnalysisFilters(current => {
      const matched = options.find(option => option.id === current.regionalId);
      if (matched) return { ...current, regionalLabel: matched.name };
      if (options.length === 1) return { ...current, regionalId: options[0].id, regionalLabel: options[0].name };
      return { ...current, regionalId: '', regionalIds: [], regionalLabel: 'Todas as Regionais' };
    });
    setFieldAnalysisScopeLoaded(true);
  }, []);

  const fetchFieldAnalysisChurchScope = useCallback(async () => {
    const storedUser = readStoredUser();
    const profileType = storedUser.profileType || '';
    let churchQuery = supabase
      .from('churches')
      .select('id, name, regional_id')
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (profileType === 'church' && storedUser.churchId) {
      churchQuery = churchQuery.eq('id', storedUser.churchId);
    } else if (fieldAnalysisFilters.regionalIds && fieldAnalysisFilters.regionalIds.length) {
      churchQuery = churchQuery.in('regional_id', fieldAnalysisFilters.regionalIds.filter(id => id !== '__none__'));
    } else if (fieldAnalysisFilters.regionalId) {
      churchQuery = churchQuery.eq('regional_id', fieldAnalysisFilters.regionalId);
    } else if (profileType === 'regional' && storedUser.regionalId) {
      churchQuery = churchQuery.eq('regional_id', storedUser.regionalId);
    } else if (fieldAnalysisRegionals.length) {
      churchQuery = churchQuery.in('regional_id', fieldAnalysisRegionals.map(item => item.id));
    }

    const { data, error } = await churchQuery;
    if (error) throw error;
    const regionalMap = new Map(fieldAnalysisRegionals.map(item => [item.id, item.name]));
    return (data || []).map((church): FieldAnalysisScopeChurch => ({
      churchId: church.id as string,
      churchName: church.name as string,
      regionalId: church.regional_id as string,
      regionalName: regionalMap.get(church.regional_id as string) || 'Sem Regional',
    }));
  }, [fieldAnalysisFilters.regionalId, fieldAnalysisFilters.regionalIds, fieldAnalysisRegionals]);

  const fetchFieldAnalysisEntries = useCallback(async (scopeChurches: FieldAnalysisScopeChurch[]) => {
    if (!scopeChurches.length) return [];
    const churchIds = scopeChurches.map(item => item.churchId);
    const churchMap = new Map(scopeChurches.map(item => [item.churchId, item]));
    const queryStart = toInputDate(new Date(toMonthBoundaryStart(fieldAnalysisFilters.startDate).getFullYear(), toMonthBoundaryStart(fieldAnalysisFilters.startDate).getMonth() - 1, 1));
    const queryEndExclusive = toInputDate(toMonthBoundaryEnd(fieldAnalysisFilters.endDate));
    const token = localStorage.getItem('mrm_token') || '';
    const response = await fetch(`${apiBase}/reports/field-analysis/entries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        startDate: queryStart,
        endDate: queryEndExclusive,
        regionalId: fieldAnalysisFilters.regionalId || null,
        churchIds,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || 'Erro ao buscar dados do livro caixa para a analise.');
    }

    const payload = await response.json() as {
      entries?: Array<{
        churchId: string;
        churchName: string;
        regionalId: string;
        regionalName: string;
        dataLancamento: string;
        tipo: string | null;
        valor: number | string;
      }>;
    };

    const rows = payload.entries || [];

    return rows
      .map(row => {
        const church = churchMap.get(row.churchId);
        if (!church) return null;
        return {
          churchId: church.churchId,
          churchName: church.churchName,
          regionalId: church.regionalId,
          regionalName: church.regionalName,
          dataLancamento: row.dataLancamento,
          tipo: row.tipo,
          valor: Number(row.valor || 0),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);
  }, [fieldAnalysisFilters.endDate, fieldAnalysisFilters.startDate]);

  const handleGenerateFieldAnalysis = useCallback(async () => {
    if (fieldAnalysisLoading) return;
    if (!fieldAnalysisFilters.startDate || !fieldAnalysisFilters.endDate) {
      setFieldAnalysisError('Informe a data inicial e a data final da analise.');
      return;
    }
    if (fieldAnalysisFilters.endDate < fieldAnalysisFilters.startDate) {
      setFieldAnalysisError('A data final deve ser maior ou igual a data inicial.');
      return;
    }

    setFieldAnalysisLoading(true);
    setFieldAnalysisError('');
    setFieldAnalysisNotice('');
    try {
      if (!fieldAnalysisScopeLoaded) await loadFieldAnalysisRegionals();
      const scopeChurches = await fetchFieldAnalysisChurchScope();
      if (!scopeChurches.length) {
        setFieldAnalysisError('Nenhuma igreja foi encontrada para o escopo selecionado.');
        setFieldAnalysisLoading(false);
        return;
      }
      const entries = await fetchFieldAnalysisEntries(scopeChurches);
      const regionalLabel = (() => {
        const ids = fieldAnalysisFilters.regionalIds?.length ? fieldAnalysisFilters.regionalIds : (fieldAnalysisFilters.regionalId ? [fieldAnalysisFilters.regionalId] : []);
        if (!ids.length) return 'Todas as Regionais';
        if (ids.length === 1) return fieldAnalysisRegionals.find(item => item.id === ids[0])?.name || 'Todas as Regionais';
        return `${ids.length} Regionais`;
      })();
      const report = buildFieldAnalysisReport(entries, { ...fieldAnalysisFilters, regionalLabel }, scopeChurches);
      const generated = buildFieldAnalysisSheet(report);
      pushGeneratedSheet(mkSheet(generated.name, {
        color: generated.color,
        cells: generated.cells as Record<string, CellData>,
        colWidths: generated.colWidths,
        rowHeights: generated.rowHeights,
        frozenRows: generated.frozenRows,
        frozenCols: generated.frozenCols,
        meta: generated.meta,
      }));
      setFieldAnalysisNotice(`Analise gerada em nova aba com ${report.months.length} mes(es) e ${scopeChurches.length} igreja(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao gerar a analise do campo.';
      setFieldAnalysisError(message);
    } finally {
      setFieldAnalysisLoading(false);
    }
  }, [fetchFieldAnalysisChurchScope, fetchFieldAnalysisEntries, fieldAnalysisFilters, fieldAnalysisLoading, fieldAnalysisRegionals, fieldAnalysisScopeLoaded, loadFieldAnalysisRegionals, pushGeneratedSheet]);

  useEffect(() => {
    if (activeRibbon !== 'fieldAnalysis' || fieldAnalysisScopeLoaded) return;
    loadFieldAnalysisRegionals().catch((error) => {
      const message = error instanceof Error ? error.message : 'Erro ao carregar regionais para a analise.';
      setFieldAnalysisError(message);
    });
  }, [activeRibbon, fieldAnalysisScopeLoaded, loadFieldAnalysisRegionals]);

  // ── Dizimistas: load scope (churches + titles)
  const loadDizimistasScope = useCallback(async () => {
    const storedUser = readStoredUser();
    const profileType = storedUser.profileType || '';

    // Load churches
    let churchQuery = supabase
      .from('churches')
      .select('id, name, regional_id')
      .is('deleted_at', null)
      .order('name', { ascending: true });
    if (profileType === 'church' && storedUser.churchId) {
      churchQuery = churchQuery.eq('id', storedUser.churchId);
    } else if (profileType === 'regional' && storedUser.regionalId) {
      churchQuery = churchQuery.eq('regional_id', storedUser.regionalId);
    } else if (storedUser.campoId) {
      const { data: regionalsInCampo, error: regionalsError } = await supabase
        .from('regionais')
        .select('id')
        .is('deleted_at', null)
        .eq('campo_id', storedUser.campoId);
      if (regionalsError) throw regionalsError;
      const regionalIdsInCampo = (regionalsInCampo || []).map((item) => item.id as string);
      if (regionalIdsInCampo.length) {
        churchQuery = churchQuery.in('regional_id', regionalIdsInCampo);
      } else {
        setDizimistasChurches([]);
        setDizimistasRegionals([]);
        setDizimistasChurchesLoaded(true);
        return;
      }
    }
    const { data: churchData, error: churchError } = await churchQuery;
    if (churchError) throw churchError;
    const churches = (churchData || []).map((c): ScopeChurch => ({
      id: c.id as string,
      name: c.name as string,
      regionalId: c.regional_id as string,
    }));
    setDizimistasChurches(churches);

    // Load regionals
    const regionalIds = [...new Set(churches.map(c => c.regionalId))];
    let regionalsQuery = supabase
      .from('regionais')
      .select('id, name')
      .is('deleted_at', null)
      .order('name', { ascending: true });
    if (regionalIds.length) regionalsQuery = regionalsQuery.in('id', regionalIds);
    const { data: regionalsData } = await regionalsQuery;
    setDizimistasRegionals((regionalsData || []).map(r => ({ id: r.id as string, name: r.name as string })));

    // Load ecclesiastical titles
    const token = localStorage.getItem('mrm_token') || '';
    const titlesRes = await fetch(`${apiBase}/ecclesiastical-titles`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (titlesRes.ok) {
      const titlesPayload = await titlesRes.json() as Array<{ id?: string; name?: string }>;
      setDizzimistasTitles((titlesPayload || []).map(t => ({ id: String(t.id ?? t.name ?? ''), name: String(t.name ?? '') })));
    }

    setDizimistasChurchesLoaded(true);
  }, []);

  const handleGenerateDizimistas = useCallback(async () => {
    if (dizimistasLoading) return;
    if (!dizimistasFilters.startDate || !dizimistasFilters.endDate) {
      setDizimistasError('Informe a data inicial e a data final.');
      return;
    }
    if (dizimistasFilters.endDate < dizimistasFilters.startDate) {
      setDizimistasError('A data final deve ser maior ou igual a data inicial.');
      return;
    }
    setDizimistasLoading(true);
    setDizimistasError('');
    setDizimistasNotice('');
    try {
      if (!dizimistasChurchesLoaded) await loadDizimistasScope();
      const token = localStorage.getItem('mrm_token') || '';
      const selectedRegionalIds = dizimistasFilters.regionalIds.filter(id => id !== '__none__');
      const rawChurchIds = dizimistasFilters.churchIds.filter(id => id !== '__none__');
      const rawTitleIds = dizimistasFilters.titleIds.filter(id => id !== '__none__');
      // If user explicitly deselected all churches, abort
      if (dizimistasFilters.churchIds.length === 1 && dizimistasFilters.churchIds[0] === '__none__') {
        setDizimistasError('Selecione pelo menos uma igreja.');
        setDizimistasLoading(false);
        return;
      }
      const scopedChurches = dizimistasChurches.filter((church) => selectedRegionalIds.length === 0 || selectedRegionalIds.includes(church.regionalId));
      const churchIds = rawChurchIds.length ? rawChurchIds : scopedChurches.map(c => c.id);
      if (!churchIds.length) {
        setDizimistasError('Nenhuma igreja foi encontrada para o filtro selecionado.');
        setDizimistasLoading(false);
        return;
      }
      const response = await fetch(`${apiBase}/reports/dizimistas/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          startDate: dizimistasFilters.startDate,
          endDate: dizimistasFilters.endDate,
          churchIds,
          regionalIds: selectedRegionalIds.length ? selectedRegionalIds : undefined,
          titleIds: rawTitleIds.length ? rawTitleIds : undefined,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload?.error || 'Erro ao buscar dados de dizimistas.');
      }
      const payload = await response.json() as { entries?: DizimistasEntry[] };
      const rawEntries = (payload.entries || []).map(row => ({
        ...row,
        valor: Number(row.valor || 0),
      }));

      // Filter by situação (post-processing per member)
      let entries = rawEntries;
      if (dizimistasISituacao !== 'todos') {
        // Compute total months in period
        const periodStart = new Date(`${dizimistasFilters.startDate}T00:00:00`);
        const periodEnd = new Date(`${dizimistasFilters.endDate}T00:00:00`);
        const monthKeys = new Set<string>();
        for (let d = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1); d <= periodEnd; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
          monthKeys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        const totalMonths = monthKeys.size;
        // Per-member month set
        const memberMonths = new Map<string, Set<string>>();
        for (const e of rawEntries) {
          const mk = e.dataLancamento.slice(0, 7);
          if (!memberMonths.has(e.memberId)) memberMonths.set(e.memberId, new Set());
          memberMonths.get(e.memberId)!.add(mk);
        }
        if (dizimistasISituacao === 'nao_dizimistas') {
          // Fetch all members in scope to find non-tithers
          const titherIds = new Set(rawEntries.map(e => e.memberId));
          const scopeChurchIds = churchIds.join(',');
          const token = localStorage.getItem('mrm_token') || '';
          let nonTithers: DizimistasScopeMember[] = [];
          try {
            const resp = await fetch(`${apiBase}/members?churchIds=${encodeURIComponent(scopeChurchIds)}`, {
              headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            });
            if (resp.ok) {
              const data = await resp.json() as Array<{
                id: string; fullName: string; ecclesiasticalTitle?: string;
                ecclesiasticalTitleRef?: { name: string }; rol?: number | null;
                church?: { id: string; name: string; regional?: { id: string; name: string } };
              }>;
              const churchMap = new Map(scopedChurches.map((c: { id: string; name: string; regionalId?: string }) => [c.id, c]));
              // Build set of selected title names for filtering
              const selectedTitleNames = rawTitleIds.length
                ? new Set(rawTitleIds.map(id => dizizimistasTitles.find(t => t.id === id)?.name?.toUpperCase()).filter(Boolean) as string[])
                : null;
              for (const m of data) {
                if (!titherIds.has(m.id)) {
                  const memberTitle = (m.ecclesiasticalTitleRef?.name ?? m.ecclesiasticalTitle ?? '').toUpperCase();
                  // Apply title filter if active
                  if (selectedTitleNames && selectedTitleNames.size > 0 && !selectedTitleNames.has(memberTitle)) continue;
                  const ch = churchMap.get(m.church?.id ?? '');
                  nonTithers.push({
                    memberId: m.id,
                    memberName: m.fullName,
                    ecclesiasticalTitle: m.ecclesiasticalTitleRef?.name ?? m.ecclesiasticalTitle ?? '',
                    rol: m.rol ?? null,
                    churchId: m.church?.id ?? '',
                    churchName: m.church?.name ?? '',
                    regionalId: m.church?.regional?.id ?? (ch as { regionalId?: string } | undefined)?.regionalId ?? '',
                    regionalName: m.church?.regional?.name ?? '',
                  });
                }
              }
            }
          } catch { /* ignore */ }
          entries = []; // Non-tithers have no entries
          const report = buildDizimistasReport(entries, dizimistasFilters, nonTithers);
          const generated = buildDizimistasSheet(report, dizimistasISituacao);
          pushGeneratedSheet(mkSheet(generated.name, {
            color: generated.color,
            cells: generated.cells as Record<string, CellData>,
            colWidths: generated.colWidths,
            rowHeights: generated.rowHeights,
            frozenRows: generated.frozenRows,
            frozenCols: generated.frozenCols,
            meta: generated.meta,
          }));
          const memberCount = nonTithers.length;
          setDizimistasNotice(`Relatório gerado com ${memberCount} não dizimista(s) em ${report.months.length} mes(es).`);
          return;
        }
        const okMembers = new Set<string>();
        for (const [memberId, months] of memberMonths) {
          const n = months.size;
          if (dizimistasISituacao === 'todos_os_meses' && n >= totalMonths) okMembers.add(memberId);
          if (dizimistasISituacao === 'inconstante' && n > 0 && n < totalMonths) okMembers.add(memberId);
          if (dizimistasISituacao === 'dizimistas' && n >= 1) okMembers.add(memberId);
        }
        entries = rawEntries.filter(e => okMembers.has(e.memberId));
      }

      const report = buildDizimistasReport(entries, dizimistasFilters);
      const generated = buildDizimistasSheet(report, dizimistasISituacao);
      pushGeneratedSheet(mkSheet(generated.name, {
        color: generated.color,
        cells: generated.cells as Record<string, CellData>,
        colWidths: generated.colWidths,
        rowHeights: generated.rowHeights,
        frozenRows: generated.frozenRows,
        frozenCols: generated.frozenCols,
        meta: generated.meta,
      }));
      const memberCount = report.sections.reduce((s, sec) => s + sec.churches.reduce((cs, c) => cs + c.members.length, 0), 0);
      setDizimistasNotice(`Relatorio gerado com ${memberCount} dizimista(s) em ${report.months.length} mes(es).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao gerar relatorio de dizimistas.';
      setDizimistasError(message);
    } finally {
      setDizimistasLoading(false);
    }
  }, [dizimistasChurches, dizimistasChurchesLoaded, dizimistasFilters, dizimistasISituacao, dizimistasLoading, loadDizimistasScope, pushGeneratedSheet]);

  useEffect(() => {
    if (activeRibbon !== 'dizimistas' || dizimistasChurchesLoaded) return;
    loadDizimistasScope().catch((error) => {
      const message = error instanceof Error ? error.message : 'Erro ao carregar escopo para dizimistas.';
      setDizimistasError(message);
    });
  }, [activeRibbon, dizimistasChurchesLoaded, loadDizimistasScope]);

  const loadArquivoFiles = useCallback(async () => {
    setArquivoLoading(true);
    try {
      const { data, error } = await supabase.storage.from('dados').list('planilhas', {
        limit: 200, offset: 0, sortBy: { column: 'updated_at', order: 'desc' },
      });
      if (error) return;
      const files = (data || [])
        .filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))
        .map(f => {
          const { data: urlData } = supabase.storage.from('dados').getPublicUrl(`planilhas/${f.name}`);
          return { name: f.name, updated_at: f.updated_at ?? '', url: urlData.publicUrl };
        });
      setArquivoFiles(files);
    } finally {
      setArquivoLoading(false);
    }
  }, []);

  const openArquivoFile = useCallback(async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const newSheets: SheetState[] = wb.SheetNames.map(shName => {
        const ws = wb.Sheets[shName];
        const aoa: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];
        const cells: Record<string, CellData> = {};
        aoa.forEach((row, r) => row.forEach((val, c) => {
          if (val !== '' && val !== undefined) cells[cellKey(r, c)] = { value: String(val) };
        }));
        return mkSheet(shName, { cells });
      });
      if (newSheets.length) {
        setSheets(newSheets);
        setActiveIdx(0);
        setActiveRibbon('home');
      }
    } catch {
      // ignore open error
    }
  }, []);

  const deleteArquivoFile = useCallback(async (name: string) => {
    await supabase.storage.from('dados').remove([`planilhas/${name}`]);
    setArquivoFiles(prev => prev.filter(f => f.name !== name));
  }, []);

  useEffect(() => {
    loadArquivoFiles();
  }, [arquivoDrawerOpen, loadArquivoFiles]);

  // ── Print
  const handlePrint = useCallback(() => {
    if (activeSheet.meta?.kind === 'field-analysis') {
      buildPrintFrame(activeSheet.meta.printHtml);
      return;
    }
    if (activeSheet.meta?.kind === 'dizimistas') {
      buildPrintFrame(activeSheet.meta.printHtml);
      return;
    }
    const cells = activeSheet.cells;
    // find used bounds
    let maxR = 0; let maxC = 0;
    Object.keys(cells).forEach(k => {
      const m = k.match(/(\d+):(\d+)/);
      if (m) { const r = parseInt(m[1]); const c = parseInt(m[2]); if (r > maxR) maxR = r; if (c > maxC) maxC = c; }
    });
    maxR = Math.max(maxR, 20); maxC = Math.max(maxC, 8);
    // build table rows
    let tbody = '';
    for (let r = 0; r <= maxR; r++) {
      let row = '<tr>';
      for (let c = 0; c <= maxC; c++) {
        const key = `${r}:${c}`;
        const cell = cells[key];
        if (cell?.mergeHidden) { row += ''; continue; }
        const display = cell ? getCellDisplay(key, cells) : '';
        const cs = cell?.mergeColSpan ?? 1;
        const rs = cell?.mergeRowSpan ?? 1;
        const w = (activeSheet.colWidths[c] ?? DEFAULT_COL_WIDTH);
        const h = (activeSheet.rowHeights[r] ?? DEFAULT_ROW_HEIGHT);
        const styles: string[] = [
          `min-width:${w}px`, `height:${h}px`,
          cell?.bold ? 'font-weight:700' : '',
          cell?.italic ? 'font-style:italic' : '',
          cell?.underline ? 'text-decoration:underline' : '',
          cell?.bgColor ? `background:${cell.bgColor}` : '',
          cell?.textColor ? `color:${cell.textColor}` : '',
          cell?.fontSize ? `font-size:${cell.fontSize}px` : '',
          cell?.align === 'center' ? 'text-align:center' : cell?.align === 'right' ? 'text-align:right' : 'text-align:left',
        ].filter(Boolean);
        row += `<td${cs > 1 ? ` colspan="${cs}"` : ''}${rs > 1 ? ` rowspan="${rs}"` : ''} style="${styles.join(';')}">${display.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>`;
      }
      row += '</tr>'; tbody += row;
    }
    // column headers (A B C ...)
    let thead = '<tr><th></th>';
    for (let c = 0; c <= maxC; c++) thead += `<th>${colToLetter(c)}</th>`;
    thead += '</tr>';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${activeSheet.name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Calibri,Arial,sans-serif;font-size:11px;background:#fff;color:#000}
@page{size:A4 landscape;margin:1.5cm}
h1{font-size:13px;font-weight:600;margin-bottom:8px;color:#333}
table{border-collapse:collapse;width:max-content}
th,td{border:1px solid #bbb;padding:2px 4px;white-space:pre-wrap;vertical-align:middle}
th{background:#f0f0f0;font-size:10px;font-weight:600;text-align:center;min-width:30px}
</style></head><body>
<h1>${activeSheet.name}</h1>
<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
</body></html>`;
    // Use a hidden iframe so no new tab opens
    buildPrintFrame(html);
  }, [activeSheet]);

  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewSize, setViewSize] = useState({ w: 1000, h: 500 });

  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const isMouseDown = useRef(false);
  const undoStack = useRef<SheetState[][]>([]);
  const redoStack = useRef<SheetState[][]>([]);
  const clipboard = useRef<{ cells: Record<string, CellData>; sel: Selection } | null>(null);
  const resizingCol = useRef<{ idx: number; startX: number; startW: number } | null>(null);
  const resizingRow = useRef<{ idx: number; startY: number; startH: number } | null>(null);

  // ── Layout observer
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(e => {
      const { width, height } = e[0].contentRect;
      setViewSize({ w: width, h: height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const scale = zoom / 100;
  const getColW = useCallback((c: number) => (activeSheet.colWidths[c] ?? DEFAULT_COL_WIDTH) * scale, [activeSheet.colWidths, scale]);
  const getRowH = useCallback((r: number) => (activeSheet.rowHeights[r] ?? DEFAULT_ROW_HEIGHT) * scale, [activeSheet.rowHeights, scale]);

  const colOffsets = useMemo(() => {
    const o = [0];
    for (let c = 0; c < TOTAL_COLS; c++) o.push(o[c] + getColW(c));
    return o;
  }, [getColW]);

  const rowOffsets = useMemo(() => {
    const o = [0];
    for (let r = 0; r < TOTAL_ROWS; r++) o.push(o[r] + getRowH(r));
    return o;
  }, [getRowH]);

  const totalW = colOffsets[TOTAL_COLS];
  const totalH = rowOffsets[TOTAL_ROWS];

  const visRows = useMemo(() => {
    let s = 0;
    for (let r = 0; r < TOTAL_ROWS; r++) { if (rowOffsets[r + 1] > scrollTop) { s = Math.max(0, r - BUFFER); break; } }
    let e = s;
    for (let r = s; r < TOTAL_ROWS; r++) { e = r; if (rowOffsets[r] > scrollTop + viewSize.h + BUFFER * DEFAULT_ROW_HEIGHT * scale) break; }
    return { s, e: Math.min(e + BUFFER, TOTAL_ROWS - 1) };
  }, [scrollTop, viewSize.h, rowOffsets, scale]);

  const visCols = useMemo(() => {
    let s = 0;
    for (let c = 0; c < TOTAL_COLS; c++) { if (colOffsets[c + 1] > scrollLeft) { s = Math.max(0, c - BUFFER); break; } }
    let e = s;
    for (let c = s; c < TOTAL_COLS; c++) { e = c; if (colOffsets[c] > scrollLeft + viewSize.w + BUFFER * DEFAULT_COL_WIDTH * scale) break; }
    return { s, e: Math.min(e + BUFFER, TOTAL_COLS - 1) };
  }, [scrollLeft, viewSize.w, colOffsets, scale]);

  const selKeys = useMemo(() => {
    const keys: string[] = [];
    for (let r = Math.min(sel.r1, sel.r2); r <= Math.max(sel.r1, sel.r2); r++)
      for (let c = Math.min(sel.c1, sel.c2); c <= Math.max(sel.c1, sel.c2); c++)
        keys.push(cellKey(r, c));
    return keys;
  }, [sel]);

  const anchorCell = activeSheet.cells[cellKey(sel.r1, sel.c1)];
  const nameBox = selKeys.length > 1
    ? `${cellKey(Math.min(sel.r1, sel.r2), Math.min(sel.c1, sel.c2))}:${cellKey(Math.max(sel.r1, sel.r2), Math.max(sel.c1, sel.c2))}`
    : cellKey(sel.r1, sel.c1);

  useEffect(() => {
    if (!editing) setFormulaBar(activeSheet.cells[cellKey(sel.r1, sel.c1)]?.value ?? '');
  }, [sel, activeSheet.cells, editing]);

  const pushUndo = useCallback(() => {
    undoStack.current.push(sheets.map(s => ({ ...s, cells: { ...s.cells } })));
    redoStack.current = [];
  }, [sheets]);

  const setCellValue = useCallback((row: number, col: number, value: string) => {
    const key = cellKey(row, col);
    setSheets(prev => {
      const next = [...prev];
      const sh = { ...next[activeIdx], cells: { ...next[activeIdx].cells } };
      if (!value && !sh.cells[key]) return prev;
      sh.cells = { ...sh.cells, [key]: { ...(sh.cells[key] ?? {}), value } };
      next[activeIdx] = sh;
      return next;
    });
  }, [activeIdx]);

  const applyFmt = useCallback((fmt: Partial<CellData>) => {
    pushUndo();
    setSheets(prev => {
      const next = [...prev];
      const sh = { ...next[activeIdx], cells: { ...next[activeIdx].cells } };
      selKeys.forEach(k => { sh.cells = { ...sh.cells, [k]: { ...(sh.cells[k] ?? { value: '' }), ...fmt } }; });
      next[activeIdx] = sh;
      return next;
    });
  }, [activeIdx, selKeys, pushUndo]);

  const commitEdit = useCallback(() => {
    if (!editing) return;
    pushUndo();
    setCellValue(sel.r1, sel.c1, editValue);
    setEditing(false);
    setFormulaMode(false);
    setAcMatches([]);
    setFormulaRangeSel(null);
    formulaClickAnchor.current = null;
    formulaRefInsertPos.current = 0;
  }, [editing, editValue, sel, setCellValue, pushUndo]);

  const startEdit = useCallback((initial?: string) => {
    const cur = activeSheet.cells[cellKey(sel.r1, sel.c1)]?.value ?? '';
    const val = initial !== undefined ? initial : cur;
    setEditValue(val);
    setFormulaBar(val);
    setFormulaMode(val.startsWith('='));
    setEditing(true);
    setTimeout(() => editRef.current?.focus(), 0);
  }, [sel, activeSheet.cells]);

  const scrollTo = useCallback((row: number, col: number) => {
    const cellT = rowOffsets[row], cellB = rowOffsets[row + 1];
    const cellL = colOffsets[col], cellR = colOffsets[col + 1];
    const hdr = COL_HEADER_HEIGHT * scale;
    const rhw = ROW_HEADER_WIDTH * scale;
    setScrollTop(t => {
      if (cellB > t + viewSize.h - 20) return cellB - viewSize.h + 20;
      if (cellT < t + hdr) return Math.max(0, cellT - hdr);
      return t;
    });
    setScrollLeft(l => {
      if (cellR > l + viewSize.w - 20) return cellR - viewSize.w + 20;
      if (cellL < l + rhw) return Math.max(0, cellL - rhw);
      return l;
    });
  }, [rowOffsets, colOffsets, viewSize, scale]);

  const move = useCallback((dr: number, dc: number, extend = false) => {
    setSel(s => {
      const nr = Math.max(0, Math.min(TOTAL_ROWS - 1, (extend ? s.r2 : s.r1) + dr));
      const nc = Math.max(0, Math.min(TOTAL_COLS - 1, (extend ? s.c2 : s.c1) + dc));
      scrollTo(nr, nc);
      return extend ? { ...s, r2: nr, c2: nc } : { r1: nr, c1: nc, r2: nr, c2: nc };
    });
  }, [scrollTo]);

  const pasteFromClipboard = useCallback(() => {
    if (!clipboard.current) return;
    pushUndo();
    const { cells: cb, sel: cs } = clipboard.current;
    const dr = sel.r1 - cs.r1, dc = sel.c1 - cs.c1;
    setSheets(prev => {
      const next = [...prev];
      const sh = { ...next[activeIdx], cells: { ...next[activeIdx].cells } };
      for (let r = cs.r1; r <= cs.r2; r++)
        for (let c = cs.c1; c <= cs.c2; c++) {
          const sk = cellKey(r, c), dk = cellKey(r + dr, c + dc);
          if (cb[sk]) sh.cells = { ...sh.cells, [dk]: { ...cb[sk] } };
        }
      next[activeIdx] = sh;
      return next;
    });
  }, [sel, clipboard, activeIdx, pushUndo]);

  const clearSelection = useCallback(() => {
    pushUndo();
    setSheets(prev => {
      const next = [...prev];
      const sh = { ...next[activeIdx], cells: { ...next[activeIdx].cells } };
      selKeys.forEach(k => { if (sh.cells[k]) sh.cells = { ...sh.cells, [k]: { ...sh.cells[k], value: '' } }; });
      next[activeIdx] = sh;
      return next;
    });
  }, [selKeys, activeIdx, pushUndo]);

  const onGridKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (editing) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    if (ctrl && e.key === 'c') { clipboard.current = { cells: { ...activeSheet.cells }, sel: { ...sel } }; e.preventDefault(); return; }
    if (ctrl && e.key === 'x') { clipboard.current = { cells: { ...activeSheet.cells }, sel: { ...sel } }; clearSelection(); e.preventDefault(); return; }
    if (ctrl && e.key === 'v') { pasteFromClipboard(); e.preventDefault(); return; }
    if (ctrl && e.key === 'z') { if (undoStack.current.length) { redoStack.current.push(sheets.map(s => ({ ...s, cells: { ...s.cells } }))); setSheets(undoStack.current.pop()!); } e.preventDefault(); return; }
    if (ctrl && e.key === 'y') { if (redoStack.current.length) { undoStack.current.push(sheets.map(s => ({ ...s, cells: { ...s.cells } }))); setSheets(redoStack.current.pop()!); } e.preventDefault(); return; }
    if (ctrl && e.key === 'b') { applyFmt({ bold: !anchorCell?.bold }); e.preventDefault(); return; }
    if (ctrl && e.key === 'i') { applyFmt({ italic: !anchorCell?.italic }); e.preventDefault(); return; }
    if (ctrl && e.key === 'u') { applyFmt({ underline: !anchorCell?.underline }); e.preventDefault(); return; }
    if (ctrl && e.key === 'f') { setShowFindBar(f => !f); e.preventDefault(); return; }
    if (ctrl && e.key === 'p') { handlePrint(); e.preventDefault(); return; }
    if (ctrl && e.key === 'a') { setSel({ r1: 0, c1: 0, r2: TOTAL_ROWS - 1, c2: TOTAL_COLS - 1 }); e.preventDefault(); return; }
    if (ctrl && e.key === 'Home') { setSel({ r1: 0, c1: 0, r2: 0, c2: 0 }); scrollTo(0, 0); e.preventDefault(); return; }
    if (ctrl && (e.key === '+' || e.key === '=')) { setZoom(z => Math.min(200, z + 10)); e.preventDefault(); return; }
    if (ctrl && e.key === '-') { setZoom(z => Math.max(50, z - 10)); e.preventDefault(); return; }

    if (e.key === 'Delete' || e.key === 'Backspace') { clearSelection(); return; }
    if (e.key === 'F2') { startEdit(); e.preventDefault(); return; }
    if (e.key === 'Escape') { setEditing(false); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); move(-1, 0, shift); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1, 0, shift); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); move(0, -1, shift); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); move(0, 1, shift); return; }
    if (e.key === 'Tab') { e.preventDefault(); move(0, shift ? -1 : 1); return; }
    if (e.key === 'Enter') { e.preventDefault(); move(shift ? -1 : 1, 0); return; }
    if (e.key === 'PageDown') { e.preventDefault(); move(Math.floor(viewSize.h / (DEFAULT_ROW_HEIGHT * scale)), 0, shift); return; }
    if (e.key === 'PageUp') { e.preventDefault(); move(-Math.floor(viewSize.h / (DEFAULT_ROW_HEIGHT * scale)), 0, shift); return; }
    if (e.key.length === 1 && !ctrl) { startEdit(e.key); }
  }, [editing, sel, activeSheet.cells, sheets, anchorCell, move, applyFmt, startEdit, scrollTo, clearSelection, pasteFromClipboard]);

  const onEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // ── Autocomplete navigation
    if (acMatches.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAcSelIdx(i => Math.min(i + 1, acMatches.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setAcSelIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const fn = acMatches[acSelIdx];
        // replace the partial name at end of editValue with full fn name + args opener
        const newVal = editValue.replace(/([A-Z]+)$/i, fn.name + fn.args);
        setEditValue(newVal); setFormulaBar(newVal);
        setAcMatches([]);
        return;
      }
      if (e.key === 'Escape') { setAcMatches([]); e.preventDefault(); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { commitEdit(); move(1, 0); gridRef.current?.focus(); e.preventDefault(); }
    if (e.key === 'Escape') {
      setEditing(false); setFormulaMode(false);
      formulaClickAnchor.current = null;
      gridRef.current?.focus();
      e.preventDefault();
    }
    if (e.key === 'Tab' && !acMatches.length) { commitEdit(); move(0, e.shiftKey ? -1 : 1); gridRef.current?.focus(); e.preventDefault(); }
    if (e.key === 'ArrowUp'    && !formulaMode && !acMatches.length) { commitEdit(); move(-1, 0); gridRef.current?.focus(); e.preventDefault(); }
    if (e.key === 'ArrowDown'  && !formulaMode && !acMatches.length) { commitEdit(); move(1, 0); gridRef.current?.focus(); e.preventDefault(); }
    if (e.key === 'ArrowLeft'  && !formulaMode && !acMatches.length) { commitEdit(); move(0, -1); gridRef.current?.focus(); e.preventDefault(); }
    if (e.key === 'ArrowRight' && !formulaMode && !acMatches.length) { commitEdit(); move(0, 1); gridRef.current?.focus(); e.preventDefault(); }
  }, [commitEdit, move, formulaMode, acMatches, acSelIdx, editValue]);

  const onEditChange = useCallback((v: string) => {
    setEditValue(v); setFormulaBar(v); setFormulaMode(v.startsWith('='));
    // autocomplete: detect partial function name after = or operator
    const acMatch = v.match(/(?:^=|[+\-*/,(;:^])([A-Z]+)$/i);
    if (acMatch && acMatch[1].length >= 1) {
      const prefix = acMatch[1].toUpperCase();
      const matches = FUNCTIONS.filter(f => f.name.startsWith(prefix));
      setAcMatches(matches);
      setAcSelIdx(0);
    } else {
      setAcMatches([]);
    }
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    // Ctrl + scroll = zoom
    if (e.ctrlKey) {
      setZoom(z => Math.max(50, Math.min(200, z - Math.sign(e.deltaY) * 10)));
      return;
    }
    // Horizontal trackpad scroll moves viewport left/right
    if (e.deltaX !== 0 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      setScrollLeft(l => Math.max(0, Math.min(Math.max(0, totalW - viewSize.w + ROW_HEADER_WIDTH * scale), l + e.deltaX)));
      return;
    }
    // Vertical scroll moves viewport up/down
    setScrollTop(t => Math.max(0, Math.min(Math.max(0, totalH - viewSize.h + COL_HEADER_HEIGHT * scale), t + e.deltaY)));
  }, [totalH, totalW, viewSize, scale]);

  const inSel = useCallback((row: number, col: number) =>
    row >= Math.min(sel.r1, sel.r2) && row <= Math.max(sel.r1, sel.r2) &&
    col >= Math.min(sel.c1, sel.c2) && col <= Math.max(sel.c1, sel.c2),
    [sel]);

  const onCellMouseDown = useCallback((e: React.MouseEvent, row: number, col: number) => {
    if (e.button !== 0) return;
    if (editing && formulaMode) {
      // Prevent the input from losing focus (blur → commit)
      e.preventDefault();
      // Track where in the formula string we insert the ref
      formulaRefInsertPos.current = editValue.length;
      formulaClickAnchor.current = { row, col };
      isMouseDown.current = true;
      const ref = cellKey(row, col);
      const newVal = editValue + ref;
      setEditValue(newVal); setFormulaBar(newVal);
      setAcMatches([]);
      // Keep the cell in formula-ref visual (no commit)
      return;
    }
    if (editing) commitEdit();
    isMouseDown.current = true;
    if (e.shiftKey) setSel(s => ({ ...s, r2: row, c2: col }));
    else setSel({ r1: row, c1: col, r2: row, c2: col });
    gridRef.current?.focus();
  }, [editing, formulaMode, editValue, commitEdit]);

  const onCellMouseEnter = useCallback((row: number, col: number) => {
    if (!isMouseDown.current) return;
    if (editing && formulaMode && formulaClickAnchor.current) {
      // Update the ref in the formula to be a range
      const { row: ar, col: ac } = formulaClickAnchor.current;
      const startRef = cellKey(ar, ac);
      const endRef   = cellKey(row, col);
      const rangeRef = (ar === row && ac === col) ? startRef : `${startRef}:${endRef}`;
      const base = editValue.slice(0, formulaRefInsertPos.current);
      const newVal = base + rangeRef;
      setEditValue(newVal); setFormulaBar(newVal);
      setFormulaRangeSel({ r1: Math.min(ar, row), c1: Math.min(ac, col), r2: Math.max(ar, row), c2: Math.max(ac, col) });
      return;
    }
    setSel(s => ({ ...s, r2: row, c2: col }));
  }, [editing, formulaMode, editValue]);

  const onCellDblClick = useCallback((row: number, col: number) => {
    setSel({ r1: row, c1: col, r2: row, c2: col });
    startEdit();
  }, [startEdit]);

  const onContextMenu = useCallback((e: React.MouseEvent, row: number, col: number) => {
    e.preventDefault(); e.stopPropagation();
    if (!inSel(row, col)) setSel({ r1: row, c1: col, r2: row, c2: col });
    setCtxMenu({ x: e.clientX, y: e.clientY, row, col });
  }, [inSel]);

  useEffect(() => {
    const up = () => { isMouseDown.current = false; };
    const click = () => { setCtxMenu(null); setShowBorderPicker(false); setShowAutoSumMenu(false); setShowNumFmtMenu(false); setShowSortMenu(false); setShowMergeMenu(false); setShowFxMenu(false); };
    window.addEventListener('mouseup', up);
    window.addEventListener('click', click);
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('click', click); };
  }, []);

  const insertRow = useCallback((above: boolean) => {
    pushUndo();
    const targetRow = above ? Math.min(sel.r1, sel.r2) : Math.max(sel.r1, sel.r2) + 1;
    setSheets(prev => {
      const next = [...prev];
      const sh = { ...next[activeIdx], cells: {} as Record<string, CellData>, rowHeights: { ...next[activeIdx].rowHeights } };
      Object.entries(next[activeIdx].cells).forEach(([k, cell]) => {
        const p = parseRef(k);
        if (!p) return;
        sh.cells[p.row >= targetRow ? cellKey(p.row + 1, p.col) : k] = cell;
      });
      next[activeIdx] = sh; return next;
    });
  }, [pushUndo, sel, activeIdx]);

  const deleteRow = useCallback(() => {
    pushUndo();
    const r1 = Math.min(sel.r1, sel.r2), r2 = Math.max(sel.r1, sel.r2), count = r2 - r1 + 1;
    setSheets(prev => {
      const next = [...prev];
      const sh = { ...next[activeIdx], cells: {} as Record<string, CellData> };
      Object.entries(next[activeIdx].cells).forEach(([k, cell]) => {
        const p = parseRef(k);
        if (!p || (p.row >= r1 && p.row <= r2)) return;
        sh.cells[p.row > r2 ? cellKey(p.row - count, p.col) : k] = cell;
      });
      next[activeIdx] = sh; return next;
    });
  }, [pushUndo, sel, activeIdx]);

  const insertCol = useCallback((left: boolean) => {
    pushUndo();
    const targetCol = left ? Math.min(sel.c1, sel.c2) : Math.max(sel.c1, sel.c2) + 1;
    setSheets(prev => {
      const next = [...prev];
      const sh = { ...next[activeIdx], cells: {} as Record<string, CellData> };
      Object.entries(next[activeIdx].cells).forEach(([k, cell]) => {
        const p = parseRef(k);
        if (!p) return;
        sh.cells[p.col >= targetCol ? cellKey(p.row, p.col + 1) : k] = cell;
      });
      next[activeIdx] = sh; return next;
    });
  }, [pushUndo, sel, activeIdx]);

  const deleteCol = useCallback(() => {
    pushUndo();
    const c1 = Math.min(sel.c1, sel.c2), c2 = Math.max(sel.c1, sel.c2), count = c2 - c1 + 1;
    setSheets(prev => {
      const next = [...prev];
      const sh = { ...next[activeIdx], cells: {} as Record<string, CellData> };
      Object.entries(next[activeIdx].cells).forEach(([k, cell]) => {
        const p = parseRef(k);
        if (!p || (p.col >= c1 && p.col <= c2)) return;
        sh.cells[p.col > c2 ? cellKey(p.row, p.col - count) : k] = cell;
      });
      next[activeIdx] = sh; return next;
    });
  }, [pushUndo, sel, activeIdx]);

  const applyBorder = useCallback((type: 'all' | 'outer' | 'top' | 'bottom' | 'left' | 'right' | 'none') => {
    const r1 = Math.min(sel.r1, sel.r2), r2 = Math.max(sel.r1, sel.r2);
    const c1 = Math.min(sel.c1, sel.c2), c2 = Math.max(sel.c1, sel.c2);
    pushUndo();
    setSheets(prev => {
      const next = [...prev];
      const sh = { ...next[activeIdx], cells: { ...next[activeIdx].cells } };
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const k = cellKey(r, c);
          let borders: BorderSide = {};
          if (type === 'all') borders = { top: true, right: true, bottom: true, left: true };
          else if (type === 'outer') borders = { top: r === r1, bottom: r === r2, left: c === c1, right: c === c2 };
          else if (type === 'top') borders = { ...(sh.cells[k]?.borders ?? {}), top: true };
          else if (type === 'bottom') borders = { ...(sh.cells[k]?.borders ?? {}), bottom: true };
          else if (type === 'left') borders = { ...(sh.cells[k]?.borders ?? {}), left: true };
          else if (type === 'right') borders = { ...(sh.cells[k]?.borders ?? {}), right: true };
          sh.cells = { ...sh.cells, [k]: { ...(sh.cells[k] ?? { value: '' }), borders } };
        }
      }
      next[activeIdx] = sh; return next;
    });
    setShowBorderPicker(false);
  }, [pushUndo, sel, activeIdx]);

  const mergeSelection = useCallback(() => {
    const r1 = Math.min(sel.r1, sel.r2), r2 = Math.max(sel.r1, sel.r2);
    const c1 = Math.min(sel.c1, sel.c2), c2 = Math.max(sel.c1, sel.c2);
    if (r1 === r2 && c1 === c2) return;
    pushUndo();
    setSheets(prev => {
      const next = [...prev];
      const sh = { ...next[activeIdx], cells: { ...next[activeIdx].cells } };
      const anchorKey = cellKey(r1, c1);
      const anchorData = sh.cells[anchorKey] ?? { value: '' };
      sh.cells = { ...sh.cells, [anchorKey]: { ...anchorData, mergeColSpan: c2 - c1 + 1, mergeRowSpan: r2 - r1 + 1, align: 'center', mergeHidden: false } };
      for (let r = r1; r <= r2; r++)
        for (let c = c1; c <= c2; c++) {
          if (r === r1 && c === c1) continue;
          const k = cellKey(r, c);
          sh.cells = { ...sh.cells, [k]: { ...(sh.cells[k] ?? { value: '' }), value: '', mergeHidden: true } };
        }
      next[activeIdx] = sh; return next;
    });
  }, [pushUndo, sel, activeIdx]);

  const unmergeSelection = useCallback(() => {
    pushUndo();
    setSheets(prev => {
      const next = [...prev];
      const sh = { ...next[activeIdx], cells: { ...next[activeIdx].cells } };
      selKeys.forEach(k => {
        if (!sh.cells[k]) return;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { mergeColSpan: _cs, mergeRowSpan: _rs, mergeHidden: _mh, ...rest } = sh.cells[k];
        sh.cells = { ...sh.cells, [k]: rest };
      });
      next[activeIdx] = sh; return next;
    });
  }, [pushUndo, selKeys, activeIdx]);

  const sortData = useCallback((dir: 'asc' | 'desc') => {
    const sortCol = Math.min(sel.c1, sel.c2);
    pushUndo();
    setSheets(prev => {
      const next = [...prev];
      const sh = next[activeIdx];
      let minR = TOTAL_ROWS, maxR = -1;
      Object.keys(sh.cells).forEach(k => { const p = parseRef(k); if (!p) return; if (p.row < minR) minR = p.row; if (p.row > maxR) maxR = p.row; });
      if (maxR < 0) return prev;
      type RowMap = Map<number, CellData>;
      const rowMaps: RowMap[] = [];
      for (let r = minR; r <= maxR; r++) {
        const m: RowMap = new Map();
        for (let c = 0; c < TOTAL_COLS; c++) { const cell = sh.cells[cellKey(r, c)]; if (cell) m.set(c, cell); }
        rowMaps.push(m);
      }
      rowMaps.sort((a, b) => {
        const av = a.get(sortCol)?.value ?? '', bv = b.get(sortCol)?.value ?? '';
        const an = parseFloat(av.replace(/[^0-9.\-]/g, '')), bn = parseFloat(bv.replace(/[^0-9.\-]/g, ''));
        if (!isNaN(an) && !isNaN(bn)) return dir === 'asc' ? an - bn : bn - an;
        return dir === 'asc' ? av.localeCompare(bv, 'pt-BR') : bv.localeCompare(av, 'pt-BR');
      });
      const newCells: Record<string, CellData> = {};
      Object.entries(sh.cells).forEach(([k, cell]) => { const p = parseRef(k); if (!p || p.row < minR || p.row > maxR) newCells[k] = cell; });
      rowMaps.forEach((m, i) => { m.forEach((cell, c) => { newCells[cellKey(minR + i, c)] = cell; }); });
      next[activeIdx] = { ...sh, cells: newCells };
      return next;
    });
  }, [pushUndo, sel, activeIdx]);

  const buildStyledWorkbook = useCallback(() => {
    const wb = XLSX.utils.book_new();
    sheets.forEach(sh => {
      const ws: Record<string, unknown> = {};
      let maxR = 0, maxC = 0;

      Object.entries(sh.cells).forEach(([key, cell]) => {
        const p = parseRef(key);
        if (!p || cell.mergeHidden) return;
        if (p.row > maxR) maxR = p.row;
        if (p.col > maxC) maxC = p.col;

        const displayVal = cell.value?.startsWith('=')
          ? getCellDisplay(key, sh.cells)
          : (cell.value ?? '');

        // Try to parse as number
        const num = displayVal !== '' ? parseFloat(displayVal.replace(/[^0-9.\-]/g, '')) : NaN;
        const cellObj: Record<string, unknown> = isNaN(num) || displayVal.trim() === ''
          ? { t: 's', v: displayVal }
          : { t: 'n', v: num };

        // Build style
        const style: Record<string, unknown> = {};

        // Font
        const font: Record<string, unknown> = {};
        if (cell.bold) font.bold = true;
        if (cell.italic) font.italic = true;
        if (cell.underline) font.underline = true;
        if (cell.strikethrough) font.strike = true;
        if (cell.fontSize) font.sz = cell.fontSize;
        if (cell.fontFamily) font.name = cell.fontFamily;
        if (cell.textColor) font.color = { rgb: cell.textColor.replace('#', '') };
        if (Object.keys(font).length > 0) style.font = font;

        // Fill
        if (cell.bgColor) {
          style.fill = { fgColor: { rgb: cell.bgColor.replace('#', '') } };
        }

        // Alignment
        const align: Record<string, unknown> = {};
        if (cell.align === 'center') align.horizontal = 'center';
        else if (cell.align === 'right') align.horizontal = 'right';
        else if (cell.align === 'left') align.horizontal = 'left';
        if (cell.wrapText) align.wrapText = true;
        if (Object.keys(align).length > 0) style.alignment = align;

        // Borders
        if (cell.borders) {
          const bStyle = { style: 'thin', color: { rgb: '000000' } };
          const border: Record<string, unknown> = {};
          if (cell.borders.top) border.top = bStyle;
          if (cell.borders.bottom) border.bottom = bStyle;
          if (cell.borders.left) border.left = bStyle;
          if (cell.borders.right) border.right = bStyle;
          if (Object.keys(border).length > 0) style.border = border;
        }

        if (Object.keys(style).length > 0) cellObj.s = style;
        ws[key.toUpperCase()] = cellObj;
      });

      // Sheet range
      ws['!ref'] = `A1:${colToLetter(maxC)}${maxR + 1}`;

      // Column widths
      const colWidths: { wch: number }[] = [];
      for (let c = 0; c <= maxC; c++) {
        const w = sh.colWidths[c] ?? DEFAULT_COL_WIDTH;
        colWidths.push({ wch: Math.round(w / 7) }); // px to chars approx
      }
      ws['!cols'] = colWidths;

      // Merges
      const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
      Object.entries(sh.cells).forEach(([key, cell]) => {
        if (!cell.mergeColSpan && !cell.mergeRowSpan) return;
        const p = parseRef(key);
        if (!p) return;
        merges.push({
          s: { r: p.row, c: p.col },
          e: { r: p.row + (cell.mergeRowSpan ?? 1) - 1, c: p.col + (cell.mergeColSpan ?? 1) - 1 },
        });
      });
      if (merges.length > 0) ws['!merges'] = merges;

      XLSX.utils.book_append_sheet(wb, ws as XLSX.WorkSheet, sh.name);
    });
    return wb;
  }, [sheets]);

  const exportXLSX = useCallback(() => {
    const wb = buildStyledWorkbook();
    const name = (sheets[activeIdx]?.name || 'planilha').replace(/[^a-zA-Z0-9_\-\u00C0-\u024F ]/g, '').trim();
    XLSX.writeFile(wb, `${name}.xlsx`);
  }, [buildStyledWorkbook, sheets, activeIdx]);


  const exportCSV = useCallback(() => {
    const sh = activeSheet;
    const rows: string[] = [];
    for (let r = 0; r < TOTAL_ROWS; r++) {
      let has = false; const row: string[] = [];
      for (let c = 0; c < TOTAL_COLS; c++) {
        const k = cellKey(r, c); const v = sh.cells[k]?.value ?? '';
        if (v) has = true;
        row.push(`"${getCellDisplay(k, sh.cells).replace(/"/g, '""')}"`);
      }
      if (has) rows.push(row.join(',')); else if (rows.length) break;
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${sh.name}.csv`; a.click();
  }, [activeSheet]);

  // ── Save to Supabase Storage ──────────────────────────────────────────────
  const saveToCloud = useCallback(async (filename: string): Promise<{ ok: boolean; url?: string; error?: string }> => {
    const wb = buildStyledWorkbook();
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const safeName = filename.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F ]/g, '').trim() || 'planilha';
    const path = `planilhas/${safeName}.xlsx`;
    const { error } = await supabase.storage.from('dados').upload(path, blob, { upsert: true, contentType: blob.type });
    if (error) return { ok: false, error: error.message };
    const { data: urlData } = supabase.storage.from('dados').getPublicUrl(path);
    return { ok: true, url: urlData.publicUrl };
  }, [buildStyledWorkbook]);

  const statusStats = useMemo(() => {
    const nums = selKeys.map(k => parseFloat(activeSheet.cells[k]?.value?.replace(/[^0-9.\-]/g, '') || '')).filter(n => !isNaN(n));
    if (nums.length < 2) return null;
    const sum = nums.reduce((a, b) => a + b, 0);
    return { count: nums.length, sum, avg: sum / nums.length };
  }, [selKeys, activeSheet.cells]);

  const onColResizeStart = useCallback((e: React.MouseEvent, colIdx: number) => {
    e.preventDefault(); e.stopPropagation();

    // Determine which columns are part of the resize
    const selC1 = Math.min(sel.c1, sel.c2);
    const selC2 = Math.max(sel.c1, sel.c2);
    const isColSelected = sel.r1 === 0 && sel.r2 === TOTAL_ROWS - 1 && colIdx >= selC1 && colIdx <= selC2;
    const colsToResize = isColSelected
      ? Array.from({ length: selC2 - selC1 + 1 }, (_, i) => selC1 + i)
      : [colIdx];

    // Capture start widths for ALL columns to resize at drag start
    const startWidths: Record<number, number> = {};
    for (const c of colsToResize) {
      startWidths[c] = activeSheet.colWidths[c] ?? DEFAULT_COL_WIDTH;
    }

    resizingCol.current = { idx: colIdx, startX: e.clientX, startW: startWidths[colIdx] };
    const onMove = (ev: MouseEvent) => {
      if (!resizingCol.current) return;
      const delta = (ev.clientX - resizingCol.current.startX) / scale;
      setSheets(prev => {
        const next = [...prev];
        const newWidths = { ...next[activeIdx].colWidths };
        for (const c of colsToResize) {
          newWidths[c] = Math.max(20, startWidths[c] + delta);
        }
        next[activeIdx] = { ...next[activeIdx], colWidths: newWidths };
        return next;
      });
    };
    const onUp = () => { resizingCol.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  }, [activeSheet.colWidths, scale, activeIdx, sel]);

  const onColResizeDblClick = useCallback((e: React.MouseEvent, colIdx: number) => {
    e.preventDefault(); e.stopPropagation();
    // Auto-fit: measure widest content in this column
    const CHAR_W = 7.5; const PADDING = 16;
    let maxLen = (colToLetter(colIdx)).length;
    for (let r = 0; r < TOTAL_ROWS; r++) {
      const cell = activeSheet.cells[cellKey(r, colIdx)];
      if (!cell || cell.mergeHidden) continue;
      const text = getCellDisplay(cellKey(r, colIdx), activeSheet.cells);
      if (text.length > maxLen) maxLen = text.length;
    }
    const autoW = Math.max(40, Math.min(400, maxLen * CHAR_W + PADDING));

    // Determine which cols to auto-fit
    const selC1 = Math.min(sel.c1, sel.c2);
    const selC2 = Math.max(sel.c1, sel.c2);
    const isColSelected = sel.r1 === 0 && sel.r2 === TOTAL_ROWS - 1 && colIdx >= selC1 && colIdx <= selC2;
    const colsToFit = isColSelected
      ? Array.from({ length: selC2 - selC1 + 1 }, (_, i) => selC1 + i)
      : [colIdx];

    setSheets(prev => {
      const next = [...prev];
      const newWidths = { ...next[activeIdx].colWidths };
      for (const c of colsToFit) {
        let maxL = (colToLetter(c)).length;
        for (let r = 0; r < TOTAL_ROWS; r++) {
          const cell = next[activeIdx].cells[cellKey(r, c)];
          if (!cell || cell.mergeHidden) continue;
          const t = getCellDisplay(cellKey(r, c), next[activeIdx].cells);
          if (t.length > maxL) maxL = t.length;
        }
        newWidths[c] = Math.max(40, Math.min(400, maxL * CHAR_W + PADDING));
      }
      // if whole sheet selected (corner click), auto-fit all cols
      if (sel.r1 === 0 && sel.r2 === TOTAL_ROWS - 1 && sel.c1 === 0 && sel.c2 === TOTAL_COLS - 1) {
        for (let c = 0; c < TOTAL_COLS; c++) {
          let maxL = (colToLetter(c)).length;
          for (let r = 0; r < TOTAL_ROWS; r++) {
            const cell = next[activeIdx].cells[cellKey(r, c)];
            if (!cell || cell.mergeHidden) continue;
            const t = getCellDisplay(cellKey(r, c), next[activeIdx].cells);
            if (t.length > maxL) maxL = t.length;
          }
          newWidths[c] = Math.max(40, Math.min(400, maxL * CHAR_W + PADDING));
        }
      }
      next[activeIdx] = { ...next[activeIdx], colWidths: newWidths, autoW };
      return next;
    });
  }, [activeSheet.cells, activeSheet.colWidths, activeIdx, sel]);

  const onRowResizeStart = useCallback((e: React.MouseEvent, rowIdx: number) => {
    e.preventDefault(); e.stopPropagation();

    // If rowIdx is inside the row selection, resize all selected rows
    const selR1 = Math.min(sel.r1, sel.r2);
    const selR2 = Math.max(sel.r1, sel.r2);
    const isRowSelected = sel.c1 === 0 && sel.c2 === TOTAL_COLS - 1 && rowIdx >= selR1 && rowIdx <= selR2;
    const rowsToResize = isRowSelected
      ? Array.from({ length: selR2 - selR1 + 1 }, (_, i) => selR1 + i)
      : [rowIdx];

    // Capture start heights for ALL rows to resize at drag start
    const startHeights: Record<number, number> = {};
    for (const r of rowsToResize) {
      startHeights[r] = activeSheet.rowHeights[r] ?? DEFAULT_ROW_HEIGHT;
    }

    resizingRow.current = { idx: rowIdx, startY: e.clientY, startH: startHeights[rowIdx] };
    const onMove = (ev: MouseEvent) => {
      if (!resizingRow.current) return;
      const delta = (ev.clientY - resizingRow.current.startY) / scale;
      setSheets(prev => {
        const next = [...prev];
        const newHeights = { ...next[activeIdx].rowHeights };
        for (const r of rowsToResize) {
          newHeights[r] = Math.max(12, startHeights[r] + delta);
        }
        next[activeIdx] = { ...next[activeIdx], rowHeights: newHeights };
        return next;
      });
    };
    const onUp = () => { resizingRow.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  }, [activeSheet.rowHeights, scale, activeIdx, sel]);

  const onFBarKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      pushUndo(); setCellValue(sel.r1, sel.c1, formulaBar);
      setEditing(false); setFormulaMode(false); gridRef.current?.focus(); e.preventDefault();
    }
    if (e.key === 'Escape') {
      setEditing(false); setFormulaMode(false);
      setFormulaBar(activeSheet.cells[cellKey(sel.r1, sel.c1)]?.value ?? '');
      gridRef.current?.focus();
    }
  }, [formulaBar, sel, activeSheet.cells, setCellValue, pushUndo]);

  const rhw = ROW_HEADER_WIDTH * scale;
  const chh = COL_HEADER_HEIGHT * scale;
  const themeColors = useMemo(() => ({
    ribbonBg: isDarkTheme ? '#0f172a' : '#ffffff',
    ribbonTabHoverBg: isDarkTheme ? 'rgba(30,41,59,0.8)' : 'rgba(255,255,255,0.6)',
    gridBorder: isDarkTheme ? '#334155' : '#e2e8f0',
    gridStrongBorder: isDarkTheme ? '#64748b' : '#475569',
    editorBg: isDarkTheme ? '#0f172a' : '#ffffff',
    editorText: isDarkTheme ? '#f8fafc' : '#1e293b',
    formulaRangeBg: isDarkTheme ? 'rgba(37,99,235,0.22)' : 'rgba(219,234,254,0.55)',
    selectionBg: isDarkTheme ? 'rgba(37,99,235,0.16)' : 'rgba(238,242,255,0.8)',
    selectionText: isDarkTheme ? '#c7d2fe' : '#3730a3',
  }), [isDarkTheme]);

  return (
    <div
      className="flex flex-col h-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden select-none"
      style={{ fontFamily: 'Calibri, Segoe UI, Arial, sans-serif', fontSize: 13 }}
      onContextMenu={e => e.preventDefault()}
    >
      {/* ── Ribbon tabs ── */}
      <div className="flex items-end shrink-0 px-1 gap-0.5" style={{ height: 32, backgroundColor: themeColors.ribbonBg }}>
        {(['home', 'data', 'fieldAnalysis', 'dizimistas', 'view', 'arquivo'] as const).map(t => (
          <button key={t} onClick={() => t === 'arquivo' ? setArquivoDrawerOpen(o => !o) : setActiveRibbon(t)}
            className={`px-3 py-1 text-xs rounded-t-sm transition-colors ${
              t === 'arquivo'
                ? arquivoDrawerOpen ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold shadow-sm' : 'text-slate-500 dark:text-slate-400'
                : activeRibbon === t ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold shadow-sm' : 'text-slate-500 dark:text-slate-400'
            }`}
            style={!((t === 'arquivo' && arquivoDrawerOpen) || (t !== 'arquivo' && activeRibbon === t)) ? { backgroundColor: 'transparent' } : undefined}
            onMouseEnter={e => {
              if ((t === 'arquivo' && arquivoDrawerOpen) || (t !== 'arquivo' && activeRibbon === t)) return;
              e.currentTarget.style.backgroundColor = themeColors.ribbonTabHoverBg;
            }}
            onMouseLeave={e => {
              if ((t === 'arquivo' && arquivoDrawerOpen) || (t !== 'arquivo' && activeRibbon === t)) return;
              e.currentTarget.style.backgroundColor = 'transparent';
            }}>
            {t === 'home' ? 'Página Inicial' : t === 'insert' ? 'Inserir' : t === 'formulas' ? 'Fórmulas' : t === 'data' ? 'Dados' : t === 'fieldAnalysis' ? 'Análise do Campo' : t === 'dizimistas' ? 'Dizimistas' : t === 'arquivo' ? 'Arquivo' : 'Exibir'}
          </button>
        ))}
        <div className="ml-auto flex items-center pb-1 pr-2">
          <span className="text-xs text-slate-400 opacity-70">Planilhas</span>
        </div>
      </div>

      {/* ── Ribbon toolbar ── */}
      <div className="flex items-center gap-0.5 px-2 py-1 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0 flex-wrap min-h-[44px]">
        {activeRibbon === 'home' && <>
          <RGroup label="Área de Transferência">
            <RBtn size="lg" title="Copiar (Ctrl+C)" icon={<Ico.Copy />} label="Copiar" onClick={() => { clipboard.current = { cells: { ...activeSheet.cells }, sel: { ...sel } }; }} />
            <RBtn size="lg" title="Recortar (Ctrl+X)" icon={<Ico.Cut />} label="Recortar" onClick={() => { clipboard.current = { cells: { ...activeSheet.cells }, sel: { ...sel } }; clearSelection(); }} />
            <RBtn size="lg" title="Colar (Ctrl+V)" icon={<Ico.Paste />} label="Colar" onClick={pasteFromClipboard} />
          </RGroup>
          <RDiv />
          <RGroup label="Fonte">
            <select className="h-6 text-xs border border-slate-300 dark:border-slate-600 rounded px-1 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 w-28"
              value={anchorCell?.fontFamily ?? 'Calibri'}
              onChange={e => applyFmt({ fontFamily: e.target.value })}>
              {['Calibri', 'Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia'].map(f => <option key={f}>{f}</option>)}
            </select>
            <select className="h-6 text-xs border border-slate-300 dark:border-slate-600 rounded px-1 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 w-12"
              value={anchorCell?.fontSize ?? 11}
              onChange={e => applyFmt({ fontSize: Number(e.target.value) })}>
              {[8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 36, 48, 72].map(s => <option key={s}>{s}</option>)}
            </select>
            <RBtn title="Negrito (Ctrl+B)" active={!!anchorCell?.bold} style={{ fontWeight: 700 }} icon="B" onClick={() => applyFmt({ bold: !anchorCell?.bold })} />
            <RBtn title="Itálico (Ctrl+I)" active={!!anchorCell?.italic} style={{ fontStyle: 'italic' }} icon="I" onClick={() => applyFmt({ italic: !anchorCell?.italic })} />
            <RBtn title="Sublinhado (Ctrl+U)" active={!!anchorCell?.underline} style={{ textDecoration: 'underline' }} icon="U" onClick={() => applyFmt({ underline: !anchorCell?.underline })} />
            <RBtn title="Tachado" active={!!anchorCell?.strikethrough} style={{ textDecoration: 'line-through' }} icon="S" onClick={() => applyFmt({ strikethrough: !anchorCell?.strikethrough })} />
          </RGroup>
          <RDiv />
          <RGroup label="Alinhamento">
            <RBtn title="Esquerda" active={!anchorCell?.align || anchorCell.align === 'left'} icon={<Ico.AlignLeft />} onClick={() => applyFmt({ align: 'left' })} />
            <RBtn title="Centro" active={anchorCell?.align === 'center'} icon={<Ico.AlignCenter />} onClick={() => applyFmt({ align: 'center' })} />
            <RBtn title="Direita" active={anchorCell?.align === 'right'} icon={<Ico.AlignRight />} onClick={() => applyFmt({ align: 'right' })} />
            <RBtn title="Quebrar texto" active={!!anchorCell?.wrapText} icon={<Ico.WrapText />} onClick={() => applyFmt({ wrapText: !anchorCell?.wrapText })} />
            <div className="relative">
              <div className="flex">
                <button title="Mesclar e Centralizar" onClick={mergeSelection}
                  className="flex items-center gap-0.5 px-1.5 h-7 text-xs rounded-l border border-transparent hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
                  <Ico.Merge /><span className="whitespace-nowrap ml-0.5">Mesclar</span>
                </button>
                <button onClick={e => { e.stopPropagation(); setShowMergeMenu(m => !m); }}
                  className="flex items-center px-0.5 h-7 rounded-r border-l border-slate-200 dark:border-slate-600 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500">
                  <Ico.ChevDown />
                </button>
              </div>
              {showMergeMenu && (
                <div className="absolute top-8 left-0 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-2xl py-1 min-w-[190px]" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { mergeSelection(); setShowMergeMenu(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30">Mesclar e Centralizar</button>
                  <button onClick={() => { unmergeSelection(); setShowMergeMenu(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30">Desfazer Mesclagem</button>
                </div>
              )}
            </div>
          </RGroup>
          <RDiv />
          <RGroup label="Número">
            <div className="relative">
              <button onClick={e => { e.stopPropagation(); setShowNumFmtMenu(m => !m); }}
                className="flex items-center gap-1 h-6 px-2 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-400 w-36 justify-between">
                <span>{NUM_FMT_LABELS[anchorCell?.numberFormat ?? 'general']}</span>
                <Ico.ChevDown />
              </button>
              {showNumFmtMenu && (
                <div className="absolute top-7 left-0 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-2xl py-1 min-w-[230px]" onClick={e => e.stopPropagation()}>
                  {NUM_FMT_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => { applyFmt({ numberFormat: opt.value }); setShowNumFmtMenu(false); }}
                      className={`flex items-center gap-3 w-full px-3 py-1.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/30 ${anchorCell?.numberFormat === opt.value || (!anchorCell?.numberFormat && opt.value === 'general') ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                      <span className="text-slate-500 dark:text-slate-400 w-8 text-right shrink-0 font-mono text-sm leading-none">{opt.icon}</span>
                      <div>
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-200">{opt.label}</div>
                        {opt.desc && <div className="text-[10px] text-slate-400">{opt.desc}</div>}
                      </div>
                    </button>
                  ))}
                  <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                    <button onClick={() => setShowNumFmtMenu(false)} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                      Mais Formatos de Número...
                    </button>
                  </div>
                </div>
              )}
            </div>
          </RGroup>
          <RDiv />
          <RGroup label="Estilos">
            <div className="relative">
              <RBtn title="Bordas" icon={<Ico.Border />} onClick={e => { e.stopPropagation(); setShowBorderPicker(b => !b); }} />
              {showBorderPicker && (
                <div className="absolute top-8 left-0 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-2xl p-2 w-48"
                  onClick={e => e.stopPropagation()}>
                  <div className="text-[10px] font-semibold text-slate-400 mb-1 px-1 uppercase tracking-wide">Bordas</div>
                  {([['all', 'Todas as Bordas'], ['outer', 'Borda Externa'], ['top', 'Borda Superior'], ['bottom', 'Borda Inferior'], ['left', 'Borda Esquerda'], ['right', 'Borda Direita'], ['none', 'Sem Bordas']] as const).map(([type, label]) => (
                    <button key={type} onClick={() => applyBorder(type)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors">
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ColorPick title="Cor de Fundo" icon={<Ico.BgColor />} value={anchorCell?.bgColor ?? ''} onChange={v => applyFmt({ bgColor: v || undefined })} />
            <ColorPick title="Cor de Fonte" icon={<Ico.FontColor />} value={anchorCell?.textColor ?? ''} onChange={v => applyFmt({ textColor: v || undefined })} />
          </RGroup>
          <RDiv />
          <RGroup label="Edição">
            <div className="relative">
              <div className="flex">
                <button title="AutoSoma" onClick={() => { startEdit('=SUM('); setShowAutoSumMenu(false); }}
                  className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 min-h-[52px] min-w-[36px] text-xs rounded-l border border-transparent hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
                  <Ico.Sigma /><span className="text-[10px] whitespace-nowrap">AutoSoma</span>
                </button>
                <button onClick={e => { e.stopPropagation(); setShowAutoSumMenu(m => !m); }}
                  className="flex items-start pt-2 px-0.5 min-h-[52px] rounded-r border-l border-slate-200 dark:border-slate-600 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500">
                  <Ico.ChevDown />
                </button>
              </div>
              {showAutoSumMenu && (
                <div className="absolute top-14 left-0 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-2xl py-1 min-w-[190px]" onClick={e => e.stopPropagation()}>
                  {([['=SUM(', 'Σ  Soma'], ['=AVERAGE(', '⌀  Média'], ['=COUNT(', '#  Contar Números'], ['=MAX(', '▲  Máx'], ['=MIN(', '▼  Mín']] as [string, string][]).map(([f, l]) => (
                    <button key={f} onClick={() => { startEdit(f); setShowAutoSumMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-mono">
                      {l}
                    </button>
                  ))}
                  <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                    <button onClick={() => { setActiveRibbon('formulas'); setShowAutoSumMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                      Mais Funções...
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button title="Classificar e Filtrar" onClick={e => { e.stopPropagation(); setShowSortMenu(m => !m); }}
                className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 min-h-[52px] min-w-[44px] text-xs rounded border border-transparent hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
                <Ico.SortAZ /><span className="text-[10px] whitespace-nowrap text-center leading-tight">Classificar<br />e Filtrar</span>
              </button>
              {showSortMenu && (
                <div className="absolute top-14 left-0 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-2xl py-1 min-w-[215px]" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { sortData('asc'); setShowSortMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                    <Ico.SortAZ /><span>Classificar de A a Z</span>
                  </button>
                  <button onClick={() => { sortData('desc'); setShowSortMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                    <Ico.SortZA /><span>Classificar de Z a A</span>
                  </button>
                  <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                  <button onClick={() => setShowSortMenu(false)}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500 cursor-not-allowed">
                    <Ico.Filter /><span>Filtro automático (em breve)</span>
                  </button>
                </div>
              )}
            </div>
            <RBtn size="lg" title="Desfazer (Ctrl+Z)" icon={<Ico.Undo />} label="Desfazer" onClick={() => { if (undoStack.current.length) setSheets(undoStack.current.pop()!); }} />
            <RBtn size="lg" title="Refazer (Ctrl+Y)" icon={<Ico.Redo />} label="Refazer" onClick={() => { if (redoStack.current.length) setSheets(redoStack.current.pop()!); }} />
            <RBtn title="Localizar (Ctrl+F)" icon={<Ico.Search />} onClick={() => setShowFindBar(f => !f)} />
            <RBtn title="Limpar Seleção" icon={<Ico.Trash />} onClick={clearSelection} />
          </RGroup>
          <RDiv />
          <RGroup label="Imprimir">
            <RBtn size="lg" title="Imprimir planilha (Ctrl+P)" icon={<Ico.Print />} label="Imprimir" onClick={handlePrint} />
          </RGroup>
        </>}

        {activeRibbon === 'insert' && <>
          <RGroup label="Linhas">
            <RBtn title="Inserir Linha Acima" icon={<Ico.RowUp />} label="Linha ↑" onClick={() => insertRow(true)} />
            <RBtn title="Inserir Linha Abaixo" icon={<Ico.RowDown />} label="Linha ↓" onClick={() => insertRow(false)} />
            <RBtn title="Excluir Linha(s)" icon={<Ico.DelRow />} label="Del Linha" onClick={deleteRow} />
          </RGroup>
          <RDiv />
          <RGroup label="Colunas">
            <RBtn title="Inserir Coluna à Esquerda" icon={<Ico.ColLeft />} label="Col ←" onClick={() => insertCol(true)} />
            <RBtn title="Inserir Coluna à Direita" icon={<Ico.ColRight />} label="Col →" onClick={() => insertCol(false)} />
            <RBtn title="Excluir Coluna(s)" icon={<Ico.DelCol />} label="Del Col" onClick={deleteCol} />
          </RGroup>
          <RDiv />
          <RGroup label="Planilha">
            <RBtn title="Nova Planilha" icon={<Ico.Plus />} label="Nova" onClick={() => { setSheets(p => [...p, mkSheet(`Planilha${p.length + 1}`)]); setActiveIdx(sheets.length); }} />
          </RGroup>
        </>}

        {activeRibbon === 'formulas' && <>
          <RGroup label="Fórmulas">
            {([['=SUM(', 'Σ Soma'], ['=AVERAGE(', '⌀ Média'], ['=COUNT(', '# Contagem'], ['=COUNTA(', '# ContarA'], ['=MAX(', '▲ Máx'], ['=MIN(', '▼ Mín'], ['=IF(', '❓ SE'], ['=TODAY()', '📅 Hoje'], ['=NOW()', '🕐 Agora'], ['=ROUND(', '↻ Arred'], ['=SQRT(', '√ Raiz'], ['=ABS(', '|x| Abs'], ['=LEN(', '# Len'], ['=UPPER(', 'AA Maiusc'], ['=LOWER(', 'aa Minusc'], ['=CONCATENATE(', '&& Concat']] as [string, string][]).map(([f, l]) => (
              <RBtn key={f} title={`Inserir ${f}`} label={l} onClick={() => startEdit(f)} />
            ))}
          </RGroup>
          <RDiv />
          <RGroup label="Dica">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 px-2 max-w-[200px] leading-relaxed">
              💡 Digite <strong className="text-indigo-600 dark:text-indigo-400">=</strong> e clique em células para inserir referências
            </div>
          </RGroup>
        </>}

        {activeRibbon === 'data' && <>
          <RGroup label="Importar / Exportar">
            <RBtn size="lg" title="Importar CSV ou Excel" icon={<Ico.Upload />} label="Importar" onClick={() => {
              const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.csv,.xlsx,.xls';
              inp.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
                const ab = await file.arrayBuffer();
                const wb = XLSX.read(ab, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
                pushUndo();
                setSheets(prev => {
                  const next = [...prev];
                  const sh = { ...next[activeIdx], cells: {} as Record<string, CellData> };
                  data.forEach((row, r) => row.forEach((val, c) => { if (val != null && String(val) !== '') sh.cells[cellKey(r, c)] = { value: String(val) }; }));
                  next[activeIdx] = sh; return next;
                });
              };
              inp.click();
            }} />
            <RBtn size="lg" title="Exportar Excel (.xlsx)" icon={<Ico.Download />} label="Exportar XLSX" onClick={exportXLSX} />
            <RBtn size="lg" title="Exportar CSV" icon={<Ico.FileCSV />} label="Exportar CSV" onClick={exportCSV} />
            <RBtn size="lg" title="Salvar na Nuvem" icon={<Ico.CloudUp />} label="Salvar Nuvem" onClick={() => setShowSaveModal(true)} />
          </RGroup>
          <RDiv />
          <RGroup label="Banco de Dados">
            <RBtn size="lg" title="Importar dados do banco de dados" icon={<Ico.DB />} label="Conectar BD" onClick={() => setShowConnectModal(true)} />
          </RGroup>
          <RDiv />
          <RGroup label="Limpar">
            <RBtn title="Limpar planilha inteira" icon={<Ico.Trash />} label="Limpar Tudo" onClick={() => { pushUndo(); setSheets(prev => { const next = [...prev]; next[activeIdx] = { ...next[activeIdx], cells: {} }; return next; }); }} />
            <RBtn title="Limpar formatação da seleção" icon={<Ico.BgColor />} label="Limpar Formato" onClick={() => applyFmt({ bold: false, italic: false, underline: false, strikethrough: false, bgColor: undefined, textColor: undefined, borders: undefined, fontSize: undefined, fontFamily: undefined })} />
          </RGroup>
        </>}

        {activeRibbon === 'fieldAnalysis' && <>
          <RGroup label="Periodo da Analise">
            <RibbonFieldInput
              label="Data Início"
              icon={<Ico.CalendarRange />}
              control={(
                <input
                  type="date"
                  value={fieldAnalysisFilters.startDate}
                  onChange={e => setFieldAnalysisFilters(current => ({ ...current, startDate: e.target.value }))}
                  className="h-8 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-blue-400 w-36"
                />
              )}
            />
            <RibbonFieldInput
              label="Data Fim"
              icon={<Ico.CalendarRange />}
              control={(
                <input
                  type="date"
                  value={fieldAnalysisFilters.endDate}
                  onChange={e => setFieldAnalysisFilters(current => ({ ...current, endDate: e.target.value }))}
                  className="h-8 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-blue-400 w-36"
                />
              )}
            />
            <RibbonFieldInput
              label="Regional"
              control={(() => {
                const selectedIds = (fieldAnalysisFilters as unknown as { regionalIds?: string[] }).regionalIds ?? [];
                const allIds = fieldAnalysisRegionals.map(r => r.id);
                const noneSelected = selectedIds.length === 1 && selectedIds[0] === '__none__';
                const allSelected = !noneSelected && allIds.length > 0 && allIds.every(id => selectedIds.includes(id));
                const label = noneSelected
                  ? 'Nenhuma Regional'
                  : selectedIds.length === 0 || allSelected
                  ? 'Todas as Regionais'
                  : selectedIds.length === 1
                    ? (fieldAnalysisRegionals.find(r => r.id === selectedIds[0])?.name ?? 'Todas as Regionais')
                    : `${selectedIds.length} Regionais`;
                return (
                  <div className="relative" style={{ width: 192 }}>
                    <button
                      type="button"
                      onClick={() => setFieldAnalysisFilters(current => ({ ...current, _dropdownOpen: !(current as unknown as { _dropdownOpen?: boolean })._dropdownOpen } as unknown as FieldAnalysisFilters))}
                      className="h-8 w-full flex items-center justify-between gap-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-blue-400"
                    >
                      <span className="truncate flex-1 text-left">{label}</span>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 shrink-0 text-slate-400"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
                    </button>
                    {(fieldAnalysisFilters as unknown as { _dropdownOpen?: boolean })._dropdownOpen && (
                      <div
                        className="absolute left-0 top-full z-50 mt-1 w-full max-h-64 overflow-y-auto rounded border border-slate-200 bg-white dark:bg-slate-800 shadow-lg"
                        onMouseDown={e => e.stopPropagation()}
                      >
                        {/* Marcar / Desmarcar todos */}
                        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-3 py-1.5 flex gap-2">
                          <button type="button" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setFieldAnalysisFilters(current => ({ ...current, regionalIds: [], _dropdownOpen: true } as unknown as FieldAnalysisFilters)); }} className="text-[10px] text-blue-600 hover:underline">Marcar todos</button>
                          <button type="button" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setFieldAnalysisFilters(current => ({ ...current, regionalIds: ['__none__'], _dropdownOpen: true } as unknown as FieldAnalysisFilters)); }} className="text-[10px] text-slate-500 hover:underline">Desmarcar todos</button>
                        </div>
                        {/* Todas */}
                        <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700">
                          <input
                            type="checkbox"
                            checked={allSelected || selectedIds.length === 0}
                            onChange={e => setFieldAnalysisFilters(current => ({
                              ...current,
                              regionalIds: e.target.checked ? [] : ['__none__'],
                              _dropdownOpen: true,
                            } as unknown as FieldAnalysisFilters))}
                            className="accent-blue-500"
                          />
                          <span className="text-xs text-slate-700 dark:text-slate-200 font-medium">Todas as Regionais</span>
                        </label>
                        {fieldAnalysisRegionals.map(item => (
                          <label key={item.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!noneSelected && (allSelected || selectedIds.length === 0 || selectedIds.includes(item.id))}
                              onChange={e => {
                                setFieldAnalysisFilters(current => {
                                  const prev = (current as unknown as { regionalIds?: string[] }).regionalIds ?? [];
                                  const wasNone = prev.length === 1 && prev[0] === '__none__';
                                  const wasAll = !wasNone && (allSelected || prev.length === 0);
                                  const base = wasNone ? [] : wasAll ? allIds : prev;
                                  const next = e.target.checked
                                    ? [...base.filter(id => id !== item.id), item.id]
                                    : base.filter(id => id !== item.id);
                                  const finalIds = next.length === 0 ? ['__none__'] : next.length === allIds.length ? [] : next;
                                  return { ...current, regionalIds: finalIds, _dropdownOpen: true } as unknown as FieldAnalysisFilters;
                                });
                              }}
                              className="accent-blue-500"
                            />
                            <span className="text-xs text-slate-700 dark:text-slate-200">{item.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {/* Overlay to close dropdown */}
                    {(fieldAnalysisFilters as unknown as { _dropdownOpen?: boolean })._dropdownOpen && (
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setFieldAnalysisFilters(current => ({ ...current, _dropdownOpen: false } as unknown as FieldAnalysisFilters))}
                      />
                    )}
                  </div>
                );
              })()}
            />
          </RGroup>
          <RDiv />
          <RGroup label="Ações">
            <RBtn
              size="lg"
              title="Gerar análise do campo"
              icon={<Ico.Analyze />}
              label={fieldAnalysisLoading ? 'Gerando...' : 'Analisar'}
              onClick={() => { void handleGenerateFieldAnalysis(); }}
            />
            <RBtn
              size="lg"
              title="Imprimir relatório da análise"
              icon={<Ico.Print />}
              label="Imprimir"
              onClick={handlePrint}
            />
          </RGroup>
          <RDiv />
          <RGroup label="Status">
            <div className="flex flex-col gap-1 px-2 py-1 min-w-[260px] max-w-[360px]">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Gera uma nova aba editável com bruto, líquido e diferença mês a mês por regional e igreja.
              </div>
              {fieldAnalysisError && <div className="text-[10px] text-red-600 dark:text-red-400">{fieldAnalysisError}</div>}
              {!fieldAnalysisError && fieldAnalysisNotice && <div className="text-[10px] text-emerald-600 dark:text-emerald-400">{fieldAnalysisNotice}</div>}
            </div>
          </RGroup>
        </>}

        {activeRibbon === 'dizimistas' && <>
          <RGroup label="Período">
            <RibbonFieldInput
              label="Data Início"
              icon={<Ico.CalendarRange />}
              control={(
                <input
                  type="date"
                  value={dizimistasFilters.startDate}
                  onChange={e => setDizimistasFilters(f => ({ ...f, startDate: e.target.value }))}
                  className="h-8 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-blue-400 w-36"
                />
              )}
            />
            <RibbonFieldInput
              label="Data Fim"
              icon={<Ico.CalendarRange />}
              control={(
                <input
                  type="date"
                  value={dizimistasFilters.endDate}
                  onChange={e => setDizimistasFilters(f => ({ ...f, endDate: e.target.value }))}
                  className="h-8 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-blue-400 w-36"
                />
              )}
            />
          </RGroup>
          <RDiv />
          <RGroup label="Regional">
            <RibbonFieldInput
              label="Regional"
              control={(() => {
                const allRegIds = dizimistasRegionals.map(r => r.id);
                const selectedRegIds = dizimistasFilters.regionalIds;
                const regNoneSelected = selectedRegIds.length === 1 && selectedRegIds[0] === '__none__';
                const allRegSelected = !regNoneSelected && allRegIds.length > 0 && (selectedRegIds.length === 0 || allRegIds.every(id => selectedRegIds.includes(id)));
                const regLabel = regNoneSelected
                  ? 'Nenhuma Regional'
                  : selectedRegIds.length === 0 || allRegSelected
                    ? 'Todas as Regionais'
                    : selectedRegIds.length === 1
                      ? (dizimistasRegionals.find(r => r.id === selectedRegIds[0])?.name ?? 'Todas as Regionais')
                      : `${selectedRegIds.length} Regionais`;
                type DizFiltersWithRegDrop = DizimistasFilters & { _regDropdownOpen?: boolean };
                const isOpen = (dizimistasFilters as DizFiltersWithRegDrop)._regDropdownOpen;
                return (
                  <div className="relative" style={{ width: 192 }}>
                    <button
                      type="button"
                      onClick={() => setDizimistasFilters(f => ({ ...f, _regDropdownOpen: !(f as DizFiltersWithRegDrop)._regDropdownOpen } as DizimistasFilters))}
                      className="h-8 w-full flex items-center justify-between gap-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-blue-400"
                    >
                      <span className="truncate flex-1 text-left">{regLabel}</span>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 shrink-0 text-slate-400"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
                    </button>
                    {isOpen && (
                      <div
                        className="absolute left-0 top-full z-50 mt-1 w-full max-h-64 overflow-y-auto rounded border border-slate-200 bg-white dark:bg-slate-800 shadow-lg"
                        onMouseDown={e => e.stopPropagation()}
                      >
                        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-3 py-1.5 flex gap-2">
                          <button type="button" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setDizimistasFilters(f => ({ ...f, regionalIds: [], regionalLabels: [], _regDropdownOpen: true } as DizimistasFilters)); }} className="text-[10px] text-blue-600 hover:underline">Marcar todos</button>
                          <button type="button" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setDizimistasFilters(f => ({ ...f, regionalIds: ['__none__'], regionalLabels: [], _regDropdownOpen: true } as DizimistasFilters)); }} className="text-[10px] text-slate-500 hover:underline">Desmarcar todos</button>
                        </div>
                        <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700">
                          <input
                            type="checkbox"
                            checked={allRegSelected || selectedRegIds.length === 0}
                            onChange={e => setDizimistasFilters(f => ({
                              ...f,
                              regionalIds: e.target.checked ? [] : ['__none__'],
                              regionalLabels: [],
                              _regDropdownOpen: true,
                            } as DizimistasFilters))}
                            className="accent-blue-500"
                          />
                          <span className="text-xs text-slate-700 dark:text-slate-200 font-medium">Todas as Regionais</span>
                        </label>
                        {dizimistasRegionals.map(regional => (
                          <label key={regional.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!regNoneSelected && (allRegSelected || selectedRegIds.length === 0 || selectedRegIds.includes(regional.id))}
                              onChange={e => {
                                setDizimistasFilters(f => {
                                  const prev = f.regionalIds;
                                  const wasNone = prev.length === 1 && prev[0] === '__none__';
                                  const wasAll = !wasNone && (allRegSelected || prev.length === 0);
                                  const base = wasNone ? [] : wasAll ? allRegIds : prev;
                                  const next = e.target.checked
                                    ? [...base.filter(id => id !== regional.id), regional.id]
                                    : base.filter(id => id !== regional.id);
                                  const finalIds = next.length === 0 ? ['__none__'] : next.length === allRegIds.length ? [] : next;
                                  return {
                                    ...f,
                                    regionalIds: finalIds,
                                    regionalLabels: finalIds.filter(id => id !== '__none__').map(id => dizimistasRegionals.find(r => r.id === id)?.name ?? ''),
                                    _regDropdownOpen: true,
                                  } as DizimistasFilters;
                                });
                              }}
                              className="accent-blue-500"
                            />
                            <span className="text-xs text-slate-700 dark:text-slate-200">{regional.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {isOpen && (
                      <div className="fixed inset-0 z-40" onClick={() => setDizimistasFilters(f => ({ ...f, _regDropdownOpen: false } as DizimistasFilters))} />
                    )}
                  </div>
                );
              })()}
            />
          </RGroup>
          <RGroup label="Igrejas">
            <RibbonFieldInput
              label="Igrejas"
              control={(() => {
                const allIds = dizimistasChurches
                  .filter(c => dizimistasFilters.regionalIds.length === 0 || dizimistasFilters.regionalIds.includes(c.regionalId))
                  .map(c => c.id);
                const visibleChurches = dizimistasChurches
                  .filter(c => dizimistasFilters.regionalIds.length === 0 || dizimistasFilters.regionalIds.includes(c.regionalId))
                  .filter(c => !dizimistasChurchSearch || c.name.toLowerCase().includes(dizimistasChurchSearch.toLowerCase()));
                const selectedIds = dizimistasFilters.churchIds;
                const noneSelected = selectedIds.length === 1 && selectedIds[0] === '__none__';
                const allSelected = !noneSelected && allIds.length > 0 && (selectedIds.length === 0 || allIds.every(id => selectedIds.includes(id)));
                const label = noneSelected
                  ? 'Nenhuma Igreja'
                  : selectedIds.length === 0 || allSelected
                    ? 'Todas as Igrejas'
                    : selectedIds.length === 1
                      ? (dizimistasChurches.find(c => c.id === selectedIds[0])?.name ?? 'Todas as Igrejas')
                      : `${selectedIds.length} Igrejas`;
                type DizFiltersWithDropdown = DizimistasFilters & { _churchDropdownOpen?: boolean };
                const isOpen = (dizimistasFilters as DizFiltersWithDropdown)._churchDropdownOpen;
                return (
                  <div className="relative" style={{ width: 192 }}>
                    <button
                      type="button"
                      onClick={() => setDizimistasFilters(f => ({ ...f, _churchDropdownOpen: !(f as DizFiltersWithDropdown)._churchDropdownOpen } as DizimistasFilters))}
                      className="h-8 w-full flex items-center justify-between gap-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-blue-400"
                    >
                      <span className="truncate flex-1 text-left">{label}</span>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 shrink-0 text-slate-400"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
                    </button>
                    {isOpen && (
                      <div
                        className="absolute left-0 top-full z-50 mt-1 w-full max-h-72 overflow-y-auto rounded border border-slate-200 bg-white dark:bg-slate-800 shadow-lg"
                        onMouseDown={e => e.stopPropagation()}
                      >
                        {/* Search + Select/Deselect all */}
                        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-2 py-1.5 flex flex-col gap-1">
                          <input
                            type="text"
                            value={dizimistasChurchSearch}
                            onChange={e => setDizimistasChurchSearch(e.target.value)}
                            placeholder="Pesquisar igreja..."
                            className="w-full h-6 px-2 text-xs rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-400"
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => e.stopPropagation()}
                          />
                          <div className="flex gap-2">
                            <button type="button" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setDizimistasFilters(f => ({ ...f, churchIds: [], churchLabels: [], _churchDropdownOpen: true } as DizimistasFilters)); }} className="text-[10px] text-blue-600 hover:underline">Marcar todos</button>
                            <button type="button" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setDizimistasFilters(f => ({ ...f, churchIds: ['__none__'], churchLabels: [], _churchDropdownOpen: true } as DizimistasFilters)); }} className="text-[10px] text-slate-500 hover:underline">Desmarcar todos</button>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700">
                          <input
                            type="checkbox"
                            checked={!noneSelected && (allSelected || selectedIds.length === 0)}
                            onChange={e => setDizimistasFilters(f => ({
                              ...f,
                              churchIds: e.target.checked ? [] : ['__none__'],
                              churchLabels: [],
                              _churchDropdownOpen: true,
                            } as DizimistasFilters))}
                            className="accent-blue-500"
                          />
                          <span className="text-xs text-slate-700 dark:text-slate-200 font-medium">Todas as Igrejas{dizimistasChurchSearch ? ` (filtradas)` : ''}</span>
                        </label>
                        {visibleChurches.map(church => (
                          <label key={church.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!noneSelected && (allSelected || selectedIds.length === 0 || selectedIds.includes(church.id))}
                              onChange={e => {
                                setDizimistasFilters(f => {
                                  const prev = f.churchIds;
                                  const wasNone = prev.length === 1 && prev[0] === '__none__';
                                  const wasAll = !wasNone && (allSelected || prev.length === 0);
                                  const base = wasNone ? [] : wasAll ? allIds : prev;
                                  const next = e.target.checked
                                    ? [...base.filter(id => id !== church.id), church.id]
                                    : base.filter(id => id !== church.id);
                                  const finalIds = next.length === 0 ? ['__none__'] : next.length === allIds.length ? [] : next;
                                  return {
                                    ...f,
                                    churchIds: finalIds,
                                    churchLabels: finalIds.filter(id => id !== '__none__').map(id => dizimistasChurches.find(c => c.id === id)?.name ?? ''),
                                    _churchDropdownOpen: true,
                                  } as DizimistasFilters;
                                });
                              }}
                              className="accent-blue-500"
                            />
                            <span className="text-xs text-slate-700 dark:text-slate-200">{church.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {isOpen && (
                      <div className="fixed inset-0 z-40" onClick={() => setDizimistasFilters(f => ({ ...f, _churchDropdownOpen: false } as DizimistasFilters))} />
                    )}
                  </div>
                );
              })()}
            />
          </RGroup>
          <RGroup label="Título Eclesiástico">
            <RibbonFieldInput
              label="Títulos"
              control={(() => {
                const allTitleIds = dizizimistasTitles.map(t => t.id);
                const selectedTitleIds = dizimistasFilters.titleIds;
                const titleNoneSelected = selectedTitleIds.length === 1 && selectedTitleIds[0] === '__none__';
                const allSelected = !titleNoneSelected && allTitleIds.length > 0 && (selectedTitleIds.length === 0 || allTitleIds.every(id => selectedTitleIds.includes(id)));
                const titleLabel = titleNoneSelected
                  ? 'Nenhum Título'
                  : selectedTitleIds.length === 0 || allSelected
                    ? 'Todos os Títulos'
                    : selectedTitleIds.length === 1
                      ? (dizizimistasTitles.find(t => t.id === selectedTitleIds[0])?.name ?? 'Todos os Títulos')
                      : `${selectedTitleIds.length} Títulos`;
                type DizFiltersWithTitleDrop = DizimistasFilters & { _titleDropdownOpen?: boolean };
                const isOpen = (dizimistasFilters as DizFiltersWithTitleDrop)._titleDropdownOpen;
                return (
                  <div className="relative" style={{ width: 192 }}>
                    <button
                      type="button"
                      onClick={() => setDizimistasFilters(f => ({ ...f, _titleDropdownOpen: !(f as DizFiltersWithTitleDrop)._titleDropdownOpen } as DizimistasFilters))}
                      className="h-8 w-full flex items-center justify-between gap-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-blue-400"
                    >
                      <span className="truncate flex-1 text-left">{titleLabel}</span>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 shrink-0 text-slate-400"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
                    </button>
                    {isOpen && (
                      <div
                        className="absolute left-0 top-full z-50 mt-1 w-full max-h-64 overflow-y-auto rounded border border-slate-200 bg-white dark:bg-slate-800 shadow-lg"
                        onMouseDown={e => e.stopPropagation()}
                      >
                        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-3 py-1.5 flex gap-2">
                          <button type="button" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setDizimistasFilters(f => ({ ...f, titleIds: [], titleLabels: [], _titleDropdownOpen: true } as DizimistasFilters)); }} className="text-[10px] text-blue-600 hover:underline">Marcar todos</button>
                          <button type="button" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setDizimistasFilters(f => ({ ...f, titleIds: ['__none__'], titleLabels: [], _titleDropdownOpen: true } as DizimistasFilters)); }} className="text-[10px] text-slate-500 hover:underline">Desmarcar todos</button>
                        </div>
                        <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700">
                          <input
                            type="checkbox"
                            checked={!titleNoneSelected && (allSelected || selectedTitleIds.length === 0)}
                            onChange={e => setDizimistasFilters(f => ({
                              ...f,
                              titleIds: e.target.checked ? [] : ['__none__'],
                              titleLabels: [],
                              _titleDropdownOpen: true,
                            } as DizimistasFilters))}
                            className="accent-blue-500"
                          />
                          <span className="text-xs text-slate-700 dark:text-slate-200 font-medium">Todos os Títulos</span>
                        </label>
                        {dizizimistasTitles.map(title => (
                          <label key={title.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!titleNoneSelected && (allSelected || selectedTitleIds.length === 0 || selectedTitleIds.includes(title.id))}
                              onChange={e => {
                                setDizimistasFilters(f => {
                                  const prev = f.titleIds;
                                  const wasNone = prev.length === 1 && prev[0] === '__none__';
                                  const wasAll = !wasNone && (allSelected || prev.length === 0);
                                  const base = wasNone ? [] : wasAll ? allTitleIds : prev;
                                  const next = e.target.checked
                                    ? [...base.filter(id => id !== title.id), title.id]
                                    : base.filter(id => id !== title.id);
                                  const finalIds = next.length === 0 ? ['__none__'] : next.length === allTitleIds.length ? [] : next;
                                  return {
                                    ...f,
                                    titleIds: finalIds,
                                    titleLabels: finalIds.filter(id => id !== '__none__').map(id => dizizimistasTitles.find(t => t.id === id)?.name ?? ''),
                                    _titleDropdownOpen: true,
                                  } as DizimistasFilters;
                                });
                              }}
                              className="accent-blue-500"
                            />
                            <span className="text-xs text-slate-700 dark:text-slate-200">{title.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {isOpen && (
                      <div className="fixed inset-0 z-40" onClick={() => setDizimistasFilters(f => ({ ...f, _titleDropdownOpen: false } as DizimistasFilters))} />
                    )}
                  </div>
                );
              })()}
            />
          </RGroup>
          <RGroup label="Situação">
            <RibbonFieldInput
              label="Situação"
              control={(
                <div className="relative" style={{ width: 160 }}>
                  <select
                    value={dizimistasISituacao}
                    onChange={e => setDizimistasISituacao(e.target.value as typeof dizimistasISituacao)}
                    className="h-8 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-blue-400"
                  >
                    <option value="todos">Todos</option>
                    <option value="dizimistas">Dizimistas</option>
                    <option value="nao_dizimistas">Não dizimistas</option>
                    <option value="todos_os_meses">Todos os meses</option>
                    <option value="inconstante">Está inconstante</option>
                  </select>
                </div>
              )}
            />
          </RGroup>
          <RDiv />
          <RGroup label="Ações">
            <RBtn
              size="lg"
              title="Gerar relatório de dizimistas"
              icon={<Ico.Analyze />}
              label={dizimistasLoading ? 'Gerando...' : 'Gerar'}
              onClick={() => { void handleGenerateDizimistas(); }}
            />
            <RBtn
              size="lg"
              title="Imprimir relatório de dizimistas"
              icon={<Ico.Print />}
              label="Imprimir"
              onClick={handlePrint}
            />
            {dizimistasError && <div className="text-[10px] text-red-600 dark:text-red-400 max-w-[160px] self-center">{dizimistasError}</div>}
            {!dizimistasError && dizimistasNotice && <div className="text-[10px] text-emerald-600 dark:text-emerald-400 max-w-[160px] self-center">{dizimistasNotice}</div>}
          </RGroup>
        </>}

        {activeRibbon === 'view' && <>
          <RGroup label="Zoom">
            <RBtn title="Diminuir Zoom" icon={<Ico.ZoomIn />} onClick={() => setZoom(z => Math.max(50, z - 10))} />
            <span className="text-xs font-mono text-slate-600 dark:text-slate-300 w-10 text-center">{zoom}%</span>
            <RBtn title="Aumentar Zoom" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>} onClick={() => setZoom(z => Math.min(200, z + 10))} />
            <input type="range" min={50} max={200} step={5} value={zoom} onChange={e => setZoom(Number(e.target.value))}
              className="w-24 accent-blue-600" />
            <RBtn title="Zoom 100%" label="100%" onClick={() => setZoom(100)} />
          </RGroup>
          <RDiv />
          <RGroup label="Congelar Painéis">
            <RBtn title="Congelar até a célula selecionada" label="❄ Congelar" onClick={() => {
              setSheets(prev => { const next = [...prev]; next[activeIdx] = { ...next[activeIdx], frozenRows: sel.r1, frozenCols: sel.c1 }; return next; });
            }} />
            <RBtn title="Remover congelamento" label="✕ Descongelar" onClick={() => {
              setSheets(prev => { const next = [...prev]; next[activeIdx] = { ...next[activeIdx], frozenRows: 0, frozenCols: 0 }; return next; });
            }} />
          </RGroup>
        </>}

        <div className="ml-auto flex items-center gap-1 pr-1">
          <RBtn size="lg" title="Baixar como Excel" icon={<Ico.Download />} label="Baixar XLSX" onClick={exportXLSX} />
          <RBtn size="lg" title="Salvar na Nuvem" icon={<Ico.CloudUp />} label="Salvar" onClick={() => setShowSaveModal(true)} />
        </div>
      </div>

      {/* ── Arquivo drawer ── */}
      {arquivoDrawerOpen && (
        <div className="absolute right-0 top-0 bottom-0 z-50 flex" style={{ top: 32 }}>
          {/* backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setArquivoDrawerOpen(false)} />
          {/* drawer panel */}
          <div className="relative z-50 w-80 flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl">
            {/* header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Arquivos Salvos</span>
              <div className="flex items-center gap-2">
                <button onClick={loadArquivoFiles} disabled={arquivoLoading} title="Atualizar"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors text-base leading-none">
                  ↻
                </button>
                <button onClick={() => setArquivoDrawerOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            {/* search */}
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <div className="relative">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input type="text" value={arquivoSearch} onChange={e => setArquivoSearch(e.target.value)}
                  placeholder="Pesquisar..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
            {/* list */}
            <div className="flex-1 overflow-y-auto">
              {arquivoLoading && (
                <div className="flex items-center justify-center py-10 text-slate-400 text-xs">Carregando...</div>
              )}
              {!arquivoLoading && arquivoFiles.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 px-4 text-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 mb-2 opacity-30"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <p className="text-xs">Nenhum arquivo salvo ainda.</p>
                </div>
              )}
              {!arquivoLoading && (() => {
                const filtered = arquivoFiles.filter(f =>
                  f.name.toLowerCase().includes(arquivoSearch.toLowerCase())
                );
                if (arquivoFiles.length > 0 && filtered.length === 0) return (
                  <div className="text-xs text-slate-400 py-6 text-center px-3">Nenhum resultado para "{arquivoSearch}".</div>
                );
                return filtered.map(f => (
                  <div key={f.name} className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group">
                    {/* icon */}
                    <div className="shrink-0 w-8 h-9 bg-emerald-50 dark:bg-emerald-900/30 rounded flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-emerald-600 dark:text-emerald-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    {/* name + date */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{f.name.replace(/\.xlsx?$/i, '')}</p>
                      {f.updated_at && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(f.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                    {/* actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setArquivoConfirm({ type: 'open', file: f })}
                        title="Abrir planilha"
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors font-medium"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                        Abrir
                      </button>
                      <button
                        onClick={() => setArquivoConfirm({ type: 'delete', file: f })}
                        title="Excluir arquivo"
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* ── Confirmation modal inside drawer ── */}
            {arquivoConfirm && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 rounded-none">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl mx-4 p-5 w-full max-w-xs">
                  {arquivoConfirm.type === 'open' ? (
                    <>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-blue-600">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Abrir arquivo?</p>
                          <p className="text-xs text-slate-500 mt-0.5 break-all">{arquivoConfirm.file.name.replace(/\.xlsx?$/i, '')}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">A planilha atual será substituída. Alterações não salvas serão perdidas.</p>
                      <div className="flex gap-2">
                        <button onClick={() => setArquivoConfirm(null)}
                          className="flex-1 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                          Cancelar
                        </button>
                        <button onClick={() => { void openArquivoFile(arquivoConfirm.file.url, arquivoConfirm.file.name); setArquivoConfirm(null); setArquivoDrawerOpen(false); }}
                          className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors">
                          Abrir
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-red-500">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Excluir arquivo?</p>
                          <p className="text-xs text-slate-500 mt-0.5 break-all">{arquivoConfirm.file.name.replace(/\.xlsx?$/i, '')}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Esta ação não pode ser desfeita. O arquivo será removido permanentemente da nuvem.</p>
                      <div className="flex gap-2">
                        <button onClick={() => setArquivoConfirm(null)}
                          className="flex-1 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                          Cancelar
                        </button>
                        <button onClick={() => { void deleteArquivoFile(arquivoConfirm.file.name); setArquivoConfirm(null); }}
                          className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors">
                          Excluir
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Find bar ── */}
      {showFindBar && (
        <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 shrink-0">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Localizar:</span>
          <input autoFocus value={findVal} onChange={e => setFindVal(e.target.value)}
            className="h-6 text-xs border border-amber-300 dark:border-amber-600 rounded px-2 bg-white dark:bg-slate-800 outline-none min-w-[200px]"
            placeholder="Digite para localizar..." />
          <button onClick={() => {
            const v = findVal.toLowerCase();
            for (const [k, cell] of Object.entries(activeSheet.cells)) {
              if (cell.value.toLowerCase().includes(v)) {
                const p = parseRef(k); if (p) { setSel({ r1: p.row, c1: p.col, r2: p.row, c2: p.col }); scrollTo(p.row, p.col); break; }
              }
            }
          }} className="px-3 h-6 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
            Localizar
          </button>
          <button onClick={() => setShowFindBar(false)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-1">✕</button>
        </div>
      )}

      {/* ── Formula bar ── */}
      <div className="flex items-center h-7 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-1 gap-1 shrink-0">
        <input readOnly value={nameBox}
          className="w-20 h-5 text-xs text-center border border-slate-300 dark:border-slate-600 rounded px-1 bg-slate-50 dark:bg-slate-700 font-mono text-slate-700 dark:text-slate-200" />
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-600 mx-0.5" />
        <div className="relative">
          <button
            title="Inserir função"
            onClick={e => { e.stopPropagation(); setShowFxMenu(v => !v); }}
            className="text-sm italic text-slate-500 hover:text-blue-600 select-none px-1.5 h-5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >fx</button>
          {showFxMenu && (
            <div className="absolute left-0 top-6 z-50 w-64 rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
              <div className="border-b border-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:text-slate-500">Inserir Função</div>
              <div className="max-h-72 overflow-y-auto py-1">
                {([
                  { fn: '=SOMA(', label: 'SOMA', desc: 'Soma os valores de um intervalo' },
                  { fn: '=MÉDIA(', label: 'MÉDIA', desc: 'Calcula a média dos valores' },
                  { fn: '=CONT.NÚM(', label: 'CONT.NÚM', desc: 'Conta células com números' },
                  { fn: '=CONT.VALORES(', label: 'CONT.VALORES', desc: 'Conta células não vazias' },
                  { fn: '=MÁXIMO(', label: 'MÁXIMO', desc: 'Retorna o maior valor' },
                  { fn: '=MÍNIMO(', label: 'MÍNIMO', desc: 'Retorna o menor valor' },
                  { fn: '=SE(', label: 'SE', desc: 'Teste condicional' },
                  { fn: '=CONCATENAR(', label: 'CONCATENAR', desc: 'Une textos' },
                  { fn: '=NÚM.CARACT(', label: 'NÚM.CARACT', desc: 'Número de caracteres' },
                  { fn: '=MAIÚSCULA(', label: 'MAIÚSCULA', desc: 'Converte para maiúsculas' },
                  { fn: '=MINÚSCULA(', label: 'MINÚSCULA', desc: 'Converte para minúsculas' },
                  { fn: '=ABS(', label: 'ABS', desc: 'Valor absoluto' },
                  { fn: '=ARRED(', label: 'ARRED', desc: 'Arredonda um número' },
                  { fn: '=POTÊNCIA(', label: 'POTÊNCIA', desc: 'Eleva à potência' },
                  { fn: '=RAIZ(', label: 'RAIZ', desc: 'Raiz quadrada' },
                  { fn: '=HOJE()', label: 'HOJE', desc: 'Data de hoje' },
                  { fn: '=AGORA()', label: 'AGORA', desc: 'Data e hora atuais' },
                ] as const).map(({ fn, label, desc }) => (
                  <button
                    key={label}
                    className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => {
                      setShowFxMenu(false);
                      const ptToEn: Record<string, string> = {
                        'SOMA': 'SUM', 'MÉDIA': 'AVERAGE', 'CONT.NÚM': 'COUNT',
                        'CONT.VALORES': 'COUNTA', 'MÁXIMO': 'MAX', 'MÍNIMO': 'MIN',
                        'SE': 'IF', 'CONCATENAR': 'CONCATENATE', 'NÚM.CARACT': 'LEN',
                        'MAIÚSCULA': 'UPPER', 'MINÚSCULA': 'LOWER', 'ABS': 'ABS',
                        'ARRED': 'ROUND', 'POTÊNCIA': 'POWER', 'RAIZ': 'SQRT',
                        'HOJE': 'TODAY', 'AGORA': 'NOW',
                      };
                      const enFn = fn.replace(/^=([A-ZÁÉÍÓÚÂÊÔÃÕÇÜÑ.]+)\(/, (_, pt) => `=${ptToEn[pt] ?? pt}(`);
                      startEdit(enFn);
                    }}
                  >
                    <span className="w-28 shrink-0 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{label}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-600 mx-0.5" />
        <input
          type="text"
          value={editing ? editValue : formulaBar}
          onChange={e => {
            const v = e.target.value;
            setFormulaBar(v);
            if (!editing) { setEditing(true); setEditValue(v); setFormulaMode(v.startsWith('=')); setTimeout(() => editRef.current?.focus(), 0); }
            else { setEditValue(v); setFormulaMode(v.startsWith('=')); }
          }}
          onKeyDown={onFBarKeyDown}
          onFocus={() => { if (!editing) { setEditing(true); const v = activeSheet.cells[cellKey(sel.r1, sel.c1)]?.value ?? ''; setEditValue(v); setFormulaMode(v.startsWith('=')); } }}
          className={`flex-1 h-5 text-xs px-1 outline-none bg-transparent font-mono ${formulaMode ? 'text-green-700 dark:text-green-400' : 'text-slate-800 dark:text-slate-200'}`}
          placeholder="Valor ou fórmula (=SUM, =AVERAGE, ...)"
        />
        {formulaMode && (
          <span className="text-[10px] text-blue-500 dark:text-blue-400 font-medium px-2 whitespace-nowrap shrink-0">
            💡 Clique em células para inserir referências
          </span>
        )}
      </div>

      {/* ── Grid area ── */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative" onWheel={onWheel}>
        <div
          ref={gridRef}
          tabIndex={0}
          className="absolute inset-0 overflow-hidden outline-none"
          style={{ cursor: formulaMode ? 'crosshair' : editing ? 'text' : 'cell' }}
          onKeyDown={onGridKeyDown}
        >
          {/* Column headers row */}
          <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none" style={{ height: chh }}>
            {/* Corner cell */}
            <div
              className="absolute top-0 left-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-r border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 pointer-events-auto"
              style={{ width: rhw, height: chh }}
              onClick={() => setSel({ r1: 0, c1: 0, r2: TOTAL_ROWS - 1, c2: TOTAL_COLS - 1 })}
            >
              <div className="w-3 h-3 border border-slate-400 dark:border-slate-500 rounded-sm opacity-50" />
            </div>
            {/* Col header cells */}
            {Array.from({ length: visCols.e - visCols.s + 1 }, (_, i) => {
              const col = visCols.s + i;
              const isSel = col >= Math.min(sel.c1, sel.c2) && col <= Math.max(sel.c1, sel.c2);
              const w = getColW(col);
              return (
                <div key={col}
                  className={`absolute top-0 flex items-center justify-center text-xs border-r border-b pointer-events-auto cursor-pointer select-none group ${isSel
                    ? 'bg-blue-500 dark:bg-blue-600 text-white font-semibold border-blue-400 dark:border-blue-500'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  style={{ left: rhw + colOffsets[col] - scrollLeft, width: w, height: chh }}
                  onClick={e => {
                    if (e.ctrlKey || e.metaKey) {
                      // extend column range while keeping full rows
                      const c1 = Math.min(sel.c1, sel.c2, col);
                      const c2 = Math.max(sel.c1, sel.c2, col);
                      setSel({ r1: 0, c1, r2: TOTAL_ROWS - 1, c2 });
                    } else if (e.shiftKey) {
                      setSel(s => ({ r1: 0, c1: s.c1, r2: TOTAL_ROWS - 1, c2: col }));
                    } else {
                      setSel({ r1: 0, c1: col, r2: TOTAL_ROWS - 1, c2: col });
                    }
                  }}
                  onContextMenu={e => { e.preventDefault(); setSel({ r1: 0, c1: Math.min(sel.c1, col), r2: TOTAL_ROWS - 1, c2: Math.max(sel.c2, col) }); setCtxMenu({ x: e.clientX, y: e.clientY, row: 0, col }); }}
                >
                  {colToLetter(col)}
                  <div
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize z-10 hover:bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={e => onColResizeStart(e, col)}
                    onDoubleClick={e => onColResizeDblClick(e, col)}
                  />
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {Array.from({ length: visRows.e - visRows.s + 1 }, (_, i) => {
            const row = visRows.s + i;
            const rh = getRowH(row);
            const top = rowOffsets[row] - scrollTop + chh;
            const isRowSel = row >= Math.min(sel.r1, sel.r2) && row <= Math.max(sel.r1, sel.r2);

            return (
              <div key={row} className="absolute left-0 flex" style={{ top, height: rh }}>
                {/* Row header */}
                <div
                  className={`flex items-center justify-end pr-2 text-xs border-b border-r cursor-pointer select-none shrink-0 group relative pointer-events-auto ${isRowSel
                    ? 'bg-blue-500 dark:bg-blue-600 text-white font-semibold border-blue-400 dark:border-blue-500'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  style={{ width: rhw, height: rh }}
                  onClick={e => {
                    if (e.ctrlKey || e.metaKey) {
                      const r1 = Math.min(sel.r1, sel.r2, row);
                      const r2 = Math.max(sel.r1, sel.r2, row);
                      setSel({ r1, c1: 0, r2, c2: TOTAL_COLS - 1 });
                    } else if (e.shiftKey) {
                      setSel(s => ({ r1: s.r1, c1: 0, r2: row, c2: TOTAL_COLS - 1 }));
                    } else {
                      setSel({ r1: row, c1: 0, r2: row, c2: TOTAL_COLS - 1 });
                    }
                  }}
                  onContextMenu={e => { e.preventDefault(); setSel({ r1: Math.min(sel.r1, row), c1: 0, r2: Math.max(sel.r2, row), c2: TOTAL_COLS - 1 }); setCtxMenu({ x: e.clientX, y: e.clientY, row, col: 0 }); }}
                >
                  {row + 1}
                  <div
                    className="absolute bottom-0 left-0 w-full h-1 cursor-row-resize opacity-0 group-hover:opacity-100 hover:bg-blue-400"
                    onMouseDown={e => onRowResizeStart(e, row)}
                  />
                </div>

                {/* Data cells */}
                {Array.from({ length: visCols.e - visCols.s + 1 }, (_, j) => {
                  const col = visCols.s + j;
                  const key = cellKey(row, col);
                  const cell = activeSheet.cells[key];
                  // Merged hidden cells: render as empty placeholder only
                  if (cell?.mergeHidden) {
                    return (
                      <div key={col} className="absolute pointer-events-auto"
                        style={{ left: rhw + colOffsets[col] - scrollLeft, width: getColW(col), height: rh, borderBottom: `1px solid ${themeColors.gridBorder}`, borderRight: `1px solid ${themeColors.gridBorder}` }}
                        onMouseDown={e => onCellMouseDown(e, row, col)}
                      />
                    );
                  }
                  const disp = getCellDisplay(key, activeSheet.cells);
                  const selected = inSel(row, col);
                  const anchor = row === sel.r1 && col === sel.c1;
                  // Merge spanning dimensions
                  const colSpan = cell?.mergeColSpan ?? 1;
                  const rowSpan = cell?.mergeRowSpan ?? 1;
                  const w = colSpan > 1 ? (colOffsets[Math.min(col + colSpan, TOTAL_COLS)] - colOffsets[col]) : getColW(col);
                  const cellH = rowSpan > 1 ? (rowOffsets[Math.min(row + rowSpan, TOTAL_ROWS)] - rowOffsets[row]) : rh;
                  const brd = cell?.borders;
                  // formula range visual selection (dashed blue)
                  const inFormulaSel = formulaRangeSel != null
                    && row >= formulaRangeSel.r1 && row <= formulaRangeSel.r2
                    && col >= formulaRangeSel.c1 && col <= formulaRangeSel.c2;

                  return (
                    <div
                      key={col}
                      className={`absolute overflow-hidden pointer-events-auto ${anchor ? 'z-10' : (colSpan > 1 || rowSpan > 1) ? 'z-[3]' : ''}`}
                      style={{
                        left: rhw + colOffsets[col] - scrollLeft,
                        width: w,
                        height: cellH,
                        background: cell?.bgColor
                          ? cell.bgColor
                          : inFormulaSel
                            ? themeColors.formulaRangeBg
                            : selected && !anchor
                              ? themeColors.selectionBg
                              : 'transparent',
                        boxShadow: anchor
                          ? 'inset 0 0 0 2px #2563eb'
                          : selected
                            ? 'inset 0 0 0 1px #93c5fd'
                            : undefined,
                        outline: inFormulaSel ? '2px dashed #2563eb' : undefined,
                        outlineOffset: inFormulaSel ? '-1px' : undefined,
                        borderBottom: brd?.bottom ? `1.5px solid ${themeColors.gridStrongBorder}` : `1px solid ${themeColors.gridBorder}`,
                        borderRight: brd?.right ? `1.5px solid ${themeColors.gridStrongBorder}` : `1px solid ${themeColors.gridBorder}`,
                        borderTop: brd?.top ? `1.5px solid ${themeColors.gridStrongBorder}` : undefined,
                        borderLeft: brd?.left ? `1.5px solid ${themeColors.gridStrongBorder}` : undefined,
                      }}
                      onMouseDown={e => onCellMouseDown(e, row, col)}
                      onMouseEnter={() => onCellMouseEnter(row, col)}
                      onDoubleClick={() => onCellDblClick(row, col)}
                      onContextMenu={e => onContextMenu(e, row, col)}
                    >
                      {anchor && editing ? (
                        <>
                          <input
                            ref={editRef}
                            type="text"
                            value={editValue}
                            onChange={e => onEditChange(e.target.value)}
                            onKeyDown={onEditKeyDown}
                            onBlur={e => {
                              // Don't commit when clicking on a cell in formula mode
                              // (we call e.preventDefault() on cell mousedown so this shouldn't fire,
                              // but guard just in case)
                              if (formulaMode && isMouseDown.current) return;
                              commitEdit();
                            }}
                            className="absolute inset-0 w-full h-full px-1 border-none outline-none z-20"
                            style={{
                              fontWeight: cell?.bold ? 700 : 400,
                              fontStyle: cell?.italic ? 'italic' : 'normal',
                              textDecoration: [cell?.underline && 'underline', cell?.strikethrough && 'line-through'].filter(Boolean).join(' ') || 'none',
                              fontSize: ((cell?.fontSize ?? 11) * scale) + 'px',
                              fontFamily: cell?.fontFamily ?? 'Calibri, Arial, sans-serif',
                              color: cell?.textColor ?? themeColors.editorText,
                              backgroundColor: themeColors.editorBg,
                              textAlign: cell?.align ?? 'left',
                            }}
                          />
                          {/* ── Autocomplete list ── */}
                          {acMatches.length > 0 && (
                            <div
                              className="absolute left-0 z-50 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-600 shadow-2xl rounded-b-lg overflow-hidden"
                              style={{ top: cellH, minWidth: 220, maxHeight: 200, overflowY: 'auto' }}
                              onMouseDown={e => e.preventDefault()}
                            >
                              {acMatches.map((fn, i) => (
                                <div
                                  key={fn.name}
                                  className={`flex items-center justify-between px-2 py-1.5 cursor-pointer text-xs border-b border-slate-100 dark:border-slate-700 last:border-0 ${i === acSelIdx ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-800 dark:text-slate-200'}`}
                                  onClick={e => {
                                    e.preventDefault(); e.stopPropagation();
                                    const newVal = editValue.replace(/([A-Z]+)$/i, fn.name + fn.args);
                                    setEditValue(newVal); setFormulaBar(newVal); setAcMatches([]);
                                    editRef.current?.focus();
                                  }}
                                >
                                  <span className="font-mono font-bold">{fn.name}</span>
                                  <span className={`text-[10px] ml-3 ${i === acSelIdx ? 'text-blue-200' : 'text-slate-400'}`}>
                                    {fn.hint}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* ── Function hint tooltip (after opening paren) ── */}
                          {acMatches.length === 0 && formulaMode && (() => { const fn = getOpenFn(editValue); return fn ? (
                            <div
                              className="absolute left-0 z-50 bg-amber-50 dark:bg-slate-700 border border-amber-300 dark:border-blue-500 text-xs text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-b-lg shadow-xl whitespace-nowrap pointer-events-none"
                              style={{ top: cellH }}
                            >
                              <span className="font-mono font-semibold text-blue-700 dark:text-blue-300">{fn.hint}</span>
                            </div>
                          ) : null; })()}
                        </>
                      ) : (
                        <div
                          className="absolute inset-0 px-1 overflow-hidden flex items-center"
                          style={{
                            fontWeight: cell?.bold ? 700 : 400,
                            fontStyle: cell?.italic ? 'italic' : 'normal',
                            textDecoration: [cell?.underline && 'underline', cell?.strikethrough && 'line-through'].filter(Boolean).join(' ') || 'none',
                            fontSize: ((cell?.fontSize ?? 11) * scale) + 'px',
                            fontFamily: cell?.fontFamily ?? 'Calibri, Arial, sans-serif',
                            color: cell?.textColor ?? (selected ? themeColors.selectionText : undefined),
                            justifyContent: cell?.align === 'center' ? 'center' : cell?.align === 'right' ? 'flex-end' : 'flex-start',
                            whiteSpace: cell?.wrapText ? 'normal' : 'nowrap',
                            alignItems: cell?.valign === 'top' ? 'flex-start' : cell?.valign === 'bottom' ? 'flex-end' : 'center',
                          }}
                        >
                          {disp}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Horizontal scrollbar */}
          <div className="absolute bottom-0 left-0 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 pointer-events-auto"
            style={{ right: 12, height: 12 }}>
            <div style={{ marginLeft: rhw, position: 'relative', height: '100%' }}>
              <div
                className="absolute top-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full hover:bg-blue-400 dark:hover:bg-blue-500 cursor-pointer transition-colors"
                style={{
                  left: `${Math.max(0, Math.min(95, (scrollLeft / Math.max(1, totalW)) * 100))}%`,
                  width: `${Math.max(5, Math.min(95, (viewSize.w / Math.max(1, totalW + rhw)) * 100))}%`
                }}
                onMouseDown={e => {
                  const sx = e.clientX, sl = scrollLeft;
                  const onMove = (ev: MouseEvent) => setScrollLeft(Math.max(0, Math.min(Math.max(0, totalW - viewSize.w + rhw), sl + (ev.clientX - sx) * (totalW / viewSize.w))));
                  const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                  e.stopPropagation(); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
                }}
              />
            </div>
          </div>
          {/* Vertical scrollbar */}
          <div className="absolute top-0 right-0 bg-slate-100 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 pointer-events-auto"
            style={{ bottom: 12, width: 12 }}>
            <div style={{ marginTop: chh, position: 'relative', height: `calc(100% - ${chh}px)` }}>
              <div
                className="absolute left-1.5 w-1.5 bg-slate-400 dark:bg-slate-500 rounded-full hover:bg-blue-400 dark:hover:bg-blue-500 cursor-pointer transition-colors"
                style={{
                  top: `${Math.max(0, Math.min(95, (scrollTop / Math.max(1, totalH)) * 100))}%`,
                  height: `${Math.max(5, Math.min(95, (viewSize.h / Math.max(1, totalH + chh)) * 100))}%`
                }}
                onMouseDown={e => {
                  const sy = e.clientY, st = scrollTop;
                  const onMove = (ev: MouseEvent) => setScrollTop(Math.max(0, Math.min(Math.max(0, totalH - viewSize.h + chh), st + (ev.clientY - sy) * (totalH / viewSize.h))));
                  const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                  e.stopPropagation(); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Context Menu ── */}
        {ctxMenu && (
          <div
            className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-2xl py-1 min-w-[200px]"
            style={{ top: Math.min(ctxMenu.y, window.innerHeight - 380), left: Math.min(ctxMenu.x, window.innerWidth - 210) }}
            onClick={e => e.stopPropagation()}
            onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
          >
            <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              {nameBox}
            </div>
            <div className="border-t border-slate-100 dark:border-slate-700 my-0.5" />
            <CtxItem label="Recortar" kbd="Ctrl+X" onClick={() => { clipboard.current = { cells: { ...activeSheet.cells }, sel: { ...sel } }; clearSelection(); setCtxMenu(null); }} />
            <CtxItem label="Copiar" kbd="Ctrl+C" onClick={() => { clipboard.current = { cells: { ...activeSheet.cells }, sel: { ...sel } }; setCtxMenu(null); }} />
            <CtxItem label="Colar" kbd="Ctrl+V" onClick={() => { pasteFromClipboard(); setCtxMenu(null); }} />
            <div className="border-t border-slate-100 dark:border-slate-700 my-0.5" />
            <CtxItem label="Inserir Linha Acima" onClick={() => { insertRow(true); setCtxMenu(null); }} />
            <CtxItem label="Inserir Linha Abaixo" onClick={() => { insertRow(false); setCtxMenu(null); }} />
            <CtxItem label="Excluir Linha(s)" onClick={() => { deleteRow(); setCtxMenu(null); }} />
            <div className="border-t border-slate-100 dark:border-slate-700 my-0.5" />
            <CtxItem label="Inserir Coluna à Esquerda" onClick={() => { insertCol(true); setCtxMenu(null); }} />
            <CtxItem label="Inserir Coluna à Direita" onClick={() => { insertCol(false); setCtxMenu(null); }} />
            <CtxItem label="Excluir Coluna(s)" onClick={() => { deleteCol(); setCtxMenu(null); }} />
            <div className="border-t border-slate-100 dark:border-slate-700 my-0.5" />
            <CtxItem label="Negrito" kbd="Ctrl+B" onClick={() => { applyFmt({ bold: !anchorCell?.bold }); setCtxMenu(null); }} />
            <CtxItem label="Itálico" kbd="Ctrl+I" onClick={() => { applyFmt({ italic: !anchorCell?.italic }); setCtxMenu(null); }} />
            <CtxItem label="Sublinhado" kbd="Ctrl+U" onClick={() => { applyFmt({ underline: !anchorCell?.underline }); setCtxMenu(null); }} />
            <div className="border-t border-slate-100 dark:border-slate-700 my-0.5" />
            <CtxItem label="Bordas — Todas" onClick={() => { applyBorder('all'); setCtxMenu(null); }} />
            <CtxItem label="Bordas — Externas" onClick={() => { applyBorder('outer'); setCtxMenu(null); }} />
            <CtxItem label="Remover Bordas" onClick={() => { applyBorder('none'); setCtxMenu(null); }} />
            <div className="border-t border-slate-100 dark:border-slate-700 my-0.5" />
            <CtxItem label="Limpar Formatação" onClick={() => { applyFmt({ bold: false, italic: false, underline: false, strikethrough: false, bgColor: undefined, textColor: undefined, borders: undefined }); setCtxMenu(null); }} />
            <CtxItem label="Excluir Conteúdo" kbd="Delete" danger onClick={() => { clearSelection(); setCtxMenu(null); }} />
          </div>
        )}
      </div>

      {/* ── Sheet tabs + Status bar ── */}
      <div className="flex items-center h-8 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shrink-0 overflow-hidden">
        <div className="flex items-end gap-0 overflow-x-auto shrink-0 max-w-[60%]">
          <button
            onClick={() => { const n = mkSheet(`Planilha${sheets.length + 1}`); setSheets(p => [...p, n]); setActiveIdx(sheets.length); }}
            className="ml-1 w-6 h-6 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded font-bold text-base self-center"
            title="Nova Planilha">+
          </button>
          {sheets.map((sh, idx) => (
            <div
              key={sh.id}
              className={`relative flex items-center gap-1 px-3 h-7 text-xs cursor-pointer select-none shrink-0 group border-x ${
                idx === activeIdx
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 font-semibold border-slate-200 dark:border-slate-600 z-10'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
              style={{ borderTop: `3px solid ${idx === activeIdx ? sh.color : 'transparent'}` }}
              onClick={() => setActiveIdx(idx)}
              onDoubleClick={() => { setRenamingIdx(idx); setRenameVal(sh.name); }}
            >
              {renamingIdx === idx ? (
                <input
                  autoFocus value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  onBlur={() => { setSheets(p => { const n = [...p]; n[idx] = { ...n[idx], name: renameVal || n[idx].name }; return n; }); setRenamingIdx(null); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { setSheets(p => { const n = [...p]; n[idx] = { ...n[idx], name: renameVal || n[idx].name }; return n; }); setRenamingIdx(null); } e.stopPropagation(); }}
                  className="w-20 text-xs outline-none border-b border-blue-500 bg-transparent"
                  onClick={e => e.stopPropagation()}
                />
              ) : sh.name}
              {idx === activeIdx && sheets.length > 1 && (
                <button
                  onClick={e => { e.stopPropagation(); setSheets(p => p.filter((_, i) => i !== idx)); setActiveIdx(Math.max(0, idx - 1)); }}
                  className="ml-0.5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 text-xs leading-none"
                >×</button>
              )}
            </div>
          ))}
        </div>
        {/* Sheet color picker */}
        <div className="flex items-center gap-0.5 pl-2 border-l border-slate-200 dark:border-slate-700 ml-1">
          {TAB_COLORS.map(c => (
            <button key={c}
              onClick={() => setSheets(p => { const n = [...p]; n[activeIdx] = { ...n[activeIdx], color: c }; return n; })}
              className="w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800 hover:scale-125 transition-transform shadow-sm"
              style={{ backgroundColor: c }} title="Cor da aba" />
          ))}
        </div>
        {/* Status bar */}
        <div className="ml-auto flex items-center gap-4 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {statusStats && <>
            <span>Contagem: <strong className="text-slate-700 dark:text-slate-200">{statusStats.count}</strong></span>
            <span>Soma: <strong className="text-slate-700 dark:text-slate-200">{statusStats.sum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
            <span>Média: <strong className="text-slate-700 dark:text-slate-200">{statusStats.avg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
          </>}
          <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-600 pl-3">
            <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded font-bold text-sm leading-none">−</button>
            <div className="relative w-20 flex items-center">
              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all" style={{ width: `${((zoom - 50) / 150) * 100}%` }} />
              </div>
              <input type="range" min={50} max={200} step={5} value={zoom} onChange={e => setZoom(Number(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
            </div>
            <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded font-bold text-sm leading-none">+</button>
            <span className="text-xs font-mono text-slate-500 w-10 text-center cursor-pointer" onClick={() => setZoom(100)} title="Clique para 100%">{zoom}%</span>
          </div>
        </div>
      </div>

      {/* ── Save to Cloud Modal ── */}
      {showSaveModal && (
        <SaveToCloudModal
          defaultName={activeSheet.name}
          onSave={async (name) => { const r = await saveToCloud(name); return r; }}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      {/* ── Connect DB Modal ── */}
      {showConnectModal && (
        <ConnectDBModal
          onImport={(rows, headers) => {
            pushUndo();
            setSheets(prev => {
              const next = [...prev];
              const sh = { ...next[activeIdx], cells: { ...next[activeIdx].cells } };
              // Header row with violet background
              headers.forEach((h, c) => {
                sh.cells[cellKey(0, c)] = { value: h, bold: true, bgColor: '#7c3aed', textColor: '#ffffff', align: 'center' };
              });
              // Data rows
              rows.forEach((row, r) => {
                headers.forEach((_, c) => {
                  const v = String(row[c] ?? '');
                  if (v) sh.cells[cellKey(r + 1, c)] = { value: v, bgColor: r % 2 === 0 ? '#f5f3ff' : '#ffffff' };
                });
              });
              next[activeIdx] = sh;
              return next;
            });
            setShowConnectModal(false);
          }}
          onClose={() => setShowConnectModal(false)}
        />
      )}
    </div>
  );
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
function RGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="flex items-center gap-0.5 px-0.5">{children}</div>
      <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 whitespace-nowrap">{label}</div>
    </div>
  );
}
function RDiv() {
  return <div className="w-px self-stretch bg-slate-200 dark:bg-slate-600 mx-1" />;
}
function RibbonFieldInput({
  label,
  control,
  icon,
}: {
  label: string;
  control: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 px-1 py-1 min-w-[120px]">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {icon && <span className="text-slate-400 dark:text-slate-500">{icon}</span>}
        <span>{label}</span>
      </div>
      {control}
    </div>
  );
}
function RBtn({
  icon, label, title, onClick, active, style, size = 'sm',
}: {
  icon?: React.ReactNode; label?: string; title: string; onClick: (e: React.MouseEvent) => void;
  active?: boolean; style?: React.CSSProperties; size?: 'sm' | 'lg';
}) {
  if (size === 'lg') {
    return (
      <button
        title={title}
        onClick={onClick}
        className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 min-h-[52px] min-w-[44px] text-xs rounded transition-all border shrink-0 ${
          active
            ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
            : 'text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
        style={style}
      >
        {icon && <span className="flex items-center justify-center">{icon}</span>}
        {label && <span className="whitespace-nowrap text-[10px] leading-tight text-center max-w-[60px] mt-0.5">{label}</span>}
      </button>
    );
  }
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex items-center justify-center gap-0.5 px-1.5 h-7 text-xs rounded transition-all border shrink-0 ${
        active
          ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
          : 'text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
      }`}
      style={style}
    >
      {icon && <span className="flex items-center justify-center">{icon}</span>}
      {label && <span className="whitespace-nowrap">{label}</span>}
    </button>
  );
}

function ColorPick({ title, icon, value, onChange }: { title: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button title={title}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="flex flex-col items-center justify-center h-7 w-7 rounded text-xs hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent gap-0">
        <span className="flex items-center justify-center text-slate-600 dark:text-slate-300">{icon}</span>
        <div className="w-4 h-1 rounded-sm mt-0.5" style={{ backgroundColor: value || '#334155' }} />
      </button>
      {open && (
        <div
          className="absolute top-8 left-0 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-2xl p-2"
          onClick={e => e.stopPropagation()}
        >
          <div className="grid grid-cols-10 gap-0.5" style={{ width: 210 }}>
            {PALETTE.map(c => (
              <button key={c}
                className="w-4 h-4 rounded border border-slate-200 dark:border-slate-600 hover:scale-125 transition-transform"
                style={{ backgroundColor: c }}
                onClick={() => { onChange(c); setOpen(false); }}
                title={c}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700 pt-2">
            <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)}
              className="w-8 h-6 border border-slate-300 dark:border-slate-600 rounded cursor-pointer" />
            <span className="text-xs text-slate-500 dark:text-slate-400 flex-1">Personalizado</span>
            <button onClick={() => { onChange(''); setOpen(false); }}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors">Limpar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CtxItem({ label, kbd, onClick, danger }: { label: string; kbd?: string; onClick: () => void; danger?: boolean; }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between w-full px-3 py-1.5 text-xs transition-colors ${
        danger
          ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300'
      }`}
    >
      <span>{label}</span>
      {kbd && <span className="text-slate-400 dark:text-slate-500 text-[10px] ml-4">{kbd}</span>}
    </button>
  );
}

// ─── Save to Cloud Modal ──────────────────────────────────────────────────────
function SaveToCloudModal({ defaultName, onSave, onClose }: {
  defaultName: string;
  onSave: (name: string) => Promise<{ ok: boolean; url?: string; error?: string }>;
  onClose: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; url?: string; error?: string } | null>(null);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const r = await onSave(name.trim());
    setSaving(false);
    setResult(r);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <span className="text-3xl">☁️</span>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Salvar na Nuvem</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Salva o arquivo XLSX no Supabase Storage</p>
          </div>
        </div>

        {result ? (
          result.ok ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-1">Arquivo salvo com sucesso!</p>
              <p className="text-xs text-slate-400 break-all">{name}.xlsx</p>
              <button onClick={onClose} className="mt-4 px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition-colors">Fechar</button>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">❌</div>
              <p className="text-sm font-semibold text-red-600 mb-1">Erro ao salvar</p>
              <p className="text-xs text-slate-500">{result.error}</p>
              <button onClick={() => setResult(null)} className="mt-4 px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm rounded-lg transition-colors">Tentar novamente</button>
            </div>
          )
        ) : (
          <>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Nome do arquivo</label>
            <div className="flex items-center gap-2 mb-5">
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className="flex-1 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Nome da planilha"
              />
              <span className="text-xs text-slate-400">.xlsx</span>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 border border-slate-200 dark:border-slate-600 rounded-lg py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !name.trim()}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                {saving ? <><span className="animate-spin">⏳</span> Salvando...</> : '☁️ Salvar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── DB Column definitions ────────────────────────────────────────────────────
const DB_TABLES = [
  {
    id: 'livro_caixa',
    label: '📊 Movimentação de Caixa',
    supabaseTable: 'livro_caixa',
    columns: [
      { key: 'data_lancamento', label: 'Data' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'valor', label: 'Valor (R$)' },
      { key: 'favorecido', label: 'Favorecido' },
      { key: 'plano_de_conta', label: 'Plano de Conta' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'forma_pg', label: 'Forma de Pgto' },
      { key: 'referencia', label: 'Referência' },
      { key: 'num_doc', label: 'Nº Doc' },
      { key: 'operador', label: 'Lançado por' },
      { key: 'obs', label: 'Observação' },
    ],
    filters: ['dateRange'],
  },
  {
    id: 'members',
    label: '👥 Lista de Membros',
    supabaseTable: 'members',
    columns: [
      { key: 'full_name', label: 'Nome Completo' },
      { key: 'preferred_name', label: 'Nome Preferido' },
      { key: 'member_type', label: 'Tipo' },
      { key: 'ecclesiastical_title', label: 'Cargo' },
      { key: 'membership_status', label: 'Status' },
      { key: 'email', label: 'E-mail' },
      { key: 'phone', label: 'Telefone' },
      { key: 'mobile', label: 'Celular' },
      { key: 'birth_date', label: 'Data Nascimento' },
      { key: 'gender', label: 'Gênero' },
      { key: 'address_city', label: 'Cidade' },
      { key: 'address_state', label: 'Estado' },
      { key: 'membership_date', label: 'Data Filiação' },
      { key: 'baptism_date', label: 'Data Batismo' },
    ],
    filters: [],
  },
] as const;

type TableId = typeof DB_TABLES[number]['id'];

// ─── Connect DB Modal ─────────────────────────────────────────────────────────
function ConnectDBModal({ onImport, onClose }: {
  onImport: (rows: Record<string, unknown>[], headers: string[]) => void;
  onClose: () => void;
}) {
  const [tableId, setTableId] = useState<TableId>('livro_caixa');
  const [selectedCols, setSelectedCols] = useState<string[]>(['data_lancamento', 'tipo', 'valor', 'favorecido', 'plano_de_conta', 'forma_pg']);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);

  const tableDef = DB_TABLES.find(t => t.id === tableId)!;

  const toggleCol = (key: string) => {
    setSelectedCols(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]);
    setPreview(null);
  };

  const orderedCols = tableDef.columns.filter(c => selectedCols.includes(c.key));

  const fetchData = async () => {
    if (selectedCols.length === 0) { setError('Selecione pelo menos uma coluna.'); return; }
    setLoading(true); setError(''); setPreview(null);
    try {
      const userRaw = localStorage.getItem('mrm_user');
      const user = userRaw ? JSON.parse(userRaw) : {};
      let q = supabase.from(tableDef.supabaseTable).select(selectedCols.join(',')).is('deleted_at', null);
      if (user.churchId) q = (q as ReturnType<typeof q.eq>).eq('church_id', user.churchId);
      if (tableId === 'livro_caixa' && dateFrom) q = (q as ReturnType<typeof q.gte>).gte('data_lancamento', dateFrom);
      if (tableId === 'livro_caixa' && dateTo) q = (q as ReturnType<typeof q.lte>).lte('data_lancamento', dateTo);
      q = (q as ReturnType<typeof q.order>).order(tableId === 'livro_caixa' ? 'data_lancamento' : 'full_name', { ascending: true }).limit(2000);
      const { data, error: err } = await q;
      if (err) throw err;
      setPreview((data ?? []) as Record<string, unknown>[]);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Erro ao buscar dados.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    if (!preview) return;
    const headers = orderedCols.map(c => c.label);
    const rows = preview.map(row => {
      const r: Record<string, unknown> = {};
      orderedCols.forEach((col, i) => { r[i] = row[col.key]; });
      return r;
    });
    onImport(rows, headers);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🗄️</span>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Importar do Banco de Dados</h2>
              <p className="text-xs text-slate-500">Selecione a tabela e as colunas que deseja importar</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* Table selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-wide">Tabela</label>
            <div className="flex gap-2">
              {DB_TABLES.map(t => (
                <button key={t.id} onClick={() => { setTableId(t.id as TableId); setSelectedCols([]); setPreview(null); setError(''); }}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium border-2 transition-all ${tableId === t.id
                    ? 'border-violet-600 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                    : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-violet-300'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Column checkboxes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Colunas</label>
              <div className="flex gap-2">
                <button onClick={() => { setSelectedCols(tableDef.columns.map(c => c.key)); setPreview(null); }}
                  className="text-xs text-violet-600 hover:text-violet-800 dark:text-violet-400">Todas</button>
                <span className="text-slate-300">|</span>
                <button onClick={() => { setSelectedCols([]); setPreview(null); }}
                  className="text-xs text-slate-400 hover:text-slate-600">Nenhuma</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {tableDef.columns.map(col => (
                <label key={col.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                  selectedCols.includes(col.key)
                    ? 'border-violet-300 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-600'
                    : 'border-slate-200 dark:border-slate-600 hover:border-violet-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}>
                  <input type="checkbox" checked={selectedCols.includes(col.key)} onChange={() => toggleCol(col.key)}
                    className="accent-violet-600 w-3.5 h-3.5" />
                  <span className="text-xs text-slate-700 dark:text-slate-300">{col.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date range (livro_caixa only) */}
          {tableId === 'livro_caixa' && (
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-wide">Período (opcional)</label>
              <div className="flex items-center gap-3">
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreview(null); }}
                  className="flex-1 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-400" />
                <span className="text-xs text-slate-400">até</span>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPreview(null); }}
                  className="flex-1 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
            </div>
          )}

          {/* Error */}
          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

          {/* Preview */}
          {preview && (
            <div>
              <p className="text-xs text-slate-500 mb-2">{preview.length} registros encontrados</p>
              <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-auto max-h-52">
                <table className="text-[11px] w-full">
                  <thead>
                    <tr className="bg-violet-700 text-white">
                      {orderedCols.map(c => <th key={c.key} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 8).map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-violet-50 dark:bg-violet-900/10' : 'bg-white dark:bg-slate-800'}>
                        {orderedCols.map(c => <td key={c.key} className="px-2 py-1 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[120px] truncate">{String(row[c.key] ?? '')}</td>)}
                      </tr>
                    ))}
                    {preview.length > 8 && (
                      <tr><td colSpan={orderedCols.length} className="px-2 py-1.5 text-center text-slate-400 italic">... e mais {preview.length - 8} registros</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 shrink-0">
          <button onClick={onClose} className="flex-1 border border-slate-200 dark:border-slate-600 rounded-xl py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
          {!preview ? (
            <button onClick={fetchData} disabled={loading || selectedCols.length === 0}
              className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              {loading ? <><span className="animate-spin inline-block">⏳</span> Buscando...</> : '🔍 Buscar Dados'}
            </button>
          ) : (
            <button onClick={handleImport}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              ✅ Importar para Planilha
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
