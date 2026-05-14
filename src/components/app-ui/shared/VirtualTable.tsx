/**
 * Virtualised table — renders only visible rows using @tanstack/react-virtual.
 * Use for any list with 100+ rows to keep DOM small.
 */
import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface VirtualColumn<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T, index: number) => React.ReactNode;
}

interface VirtualTableProps<T> {
  rows: T[];
  columns: VirtualColumn<T>[];
  /** px height of each row */
  rowHeight?: number;
  /** max-height of the scroll container */
  maxHeight?: number;
  loading?: boolean;
  emptyMessage?: React.ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
}

export function VirtualTable<T>({
  rows,
  columns,
  rowHeight = 52,
  maxHeight = 600,
  loading,
  emptyMessage = 'Nenhum registro encontrado.',
  onRowClick,
  rowClassName,
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualiser = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  const totalHeight = virtualiser.getTotalSize();
  const items = virtualiser.getVirtualItems();

  if (!loading && rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-slate-400 text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {/* Sticky header */}
      <div className="flex border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
        {columns.map((col) => (
          <div
            key={col.key}
            className={`flex-1 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${col.width ? '' : ''} text-${col.align ?? 'left'}`}
            style={col.width ? { width: col.width, flexGrow: 0, flexShrink: 0 } : undefined}
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* Virtualised scroll area */}
      <div
        ref={parentRef}
        style={{ height: Math.min(totalHeight + 2, maxHeight), overflow: 'auto' }}
      >
        <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>
          {items.map((vItem) => {
            const row = rows[vItem.index];
            return (
              <div
                key={vItem.key}
                data-index={vItem.index}
                ref={virtualiser.measureElement}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vItem.start}px)` }}
                className={`flex items-center border-b border-slate-50 transition-colors last:border-0 dark:border-slate-800 ${onRowClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800' : ''} ${rowClassName ? rowClassName(row) : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className={`flex-1 overflow-hidden px-4 py-3 text-sm text-${col.align ?? 'left'}`}
                    style={col.width ? { width: col.width, flexGrow: 0, flexShrink: 0 } : undefined}
                  >
                    {col.render(row, vItem.index)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
