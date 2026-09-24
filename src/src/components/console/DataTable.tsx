'use client'

import { type ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
  sortable?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField: keyof T
  emptyMessage?: string
  isLoading?: boolean
  onRowClick?: (row: T) => void
  rowActions?: (row: T) => ReactNode
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  emptyMessage = 'No data found.',
  isLoading = false,
  onRowClick,
  rowActions,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="text-center py-16 text-text-light">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
        Loading...
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center text-text-light">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-soft-beige/50 text-left">
            {columns.map((col) => (
              <th
                key={col.key}
                className={['px-4 py-3 font-semibold text-text-light', col.className || ''].join(' ')}
              >
                {col.header}
              </th>
            ))}
            {rowActions && (
              <th className="px-4 py-3 font-semibold text-text-light text-center">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={String(row[keyField])}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={[
                'border-b border-border/50 last:border-0 hover:bg-soft-beige/30 transition-colors',
                onRowClick ? 'cursor-pointer' : '',
              ].join(' ')}
            >
              {columns.map((col) => (
                <td key={col.key} className={['px-4 py-3', col.className || ''].join(' ')}>
                  {col.render(row)}
                </td>
              ))}
              {rowActions && (
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    {rowActions(row)}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface PaginationProps {
  page: number
  totalPages: number
  totalDocs: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, totalDocs, onPageChange }: PaginationProps) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-text-light">
      <span>
        {totalDocs} result{totalDocs !== 1 ? 's' : ''} found
        {totalPages > 1 ? ` — page ${page} of ${totalPages}` : ''}
      </span>
      {totalPages > 1 && (
        <div className="flex gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
