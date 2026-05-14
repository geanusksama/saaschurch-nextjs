/**
 * Skeleton / shimmer loading components for Secretaria tables and cards.
 * Use these to avoid blank screens while data loads.
 */
import React from 'react';

// ─── Base shimmer block ───────────────────────────────────────────────────────

function Shimmer({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`}
      aria-hidden="true"
    />
  );
}

// ─── Table skeleton ───────────────────────────────────────────────────────────

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  /** Optional column width percentages (sum should be ~100) */
  colWidths?: string[];
}

export function TableSkeleton({ rows = 8, cols = 5, colWidths }: TableSkeletonProps) {
  const widths = colWidths ?? Array(cols).fill('auto');
  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        {widths.map((w, i) => (
          <Shimmer key={i} className={`h-3 ${w === 'auto' ? 'flex-1' : ''}`} style={w !== 'auto' ? { width: w } : undefined} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="flex items-center gap-4 border-b border-slate-50 px-4 py-3.5 last:border-0 dark:border-slate-800"
        >
          {widths.map((w, col) => (
            <Shimmer
              key={col}
              className={`h-3.5 ${w === 'auto' ? 'flex-1' : ''} ${col === 0 ? 'w-24' : ''}`}
              style={w !== 'auto' && col !== 0 ? { width: w } : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Stats card skeleton ──────────────────────────────────────────────────────

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid gap-4 grid-cols-2 sm:grid-cols-${count}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <Shimmer className="h-9 w-9 flex-shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-2.5 w-16" />
            <Shimmer className="h-5 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Filter bar skeleton ──────────────────────────────────────────────────────

export function FilterBarSkeleton({ inputs = 4 }: { inputs?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <Shimmer className="h-9 w-48 rounded-lg" />
      {Array.from({ length: inputs - 1 }).map((_, i) => (
        <Shimmer key={i} className="h-9 w-32 rounded-lg" />
      ))}
      <Shimmer className="ml-auto h-9 w-24 rounded-lg" />
    </div>
  );
}

// ─── Card skeleton (for kanban / pipeline) ───────────────────────────────────

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 space-y-3">
      <div className="flex items-center gap-2">
        <Shimmer className="h-5 w-14 rounded-full" />
        <Shimmer className="h-4 w-20" />
      </div>
      <Shimmer className="h-4 w-3/4" />
      <Shimmer className="h-3 w-1/2" />
      <div className="flex items-center justify-between pt-1">
        <Shimmer className="h-3 w-20" />
        <Shimmer className="h-3 w-16" />
      </div>
    </div>
  );
}

export function ColumnSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="flex w-72 flex-shrink-0 flex-col gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
      <div className="flex items-center gap-2 px-1">
        <Shimmer className="h-4 w-4 rounded" />
        <Shimmer className="h-4 w-24" />
        <Shimmer className="ml-auto h-5 w-6 rounded-full" />
      </div>
      {Array.from({ length: cards }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}

// ─── Full module skeleton ─────────────────────────────────────────────────────

export function ModuleSkeleton({ statsCount = 4, tableRows = 8, tableCols = 5 }: { statsCount?: number; tableRows?: number; tableCols?: number }) {
  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shimmer className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Shimmer className="h-6 w-40" />
            <Shimmer className="h-3.5 w-56" />
          </div>
        </div>
        <Shimmer className="h-9 w-32 rounded-lg" />
      </div>
      <StatsSkeleton count={statsCount} />
      <FilterBarSkeleton />
      <TableSkeleton rows={tableRows} cols={tableCols} />
    </div>
  );
}
