"use client"

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { EmptyState } from "./states"

export interface Column<T> {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  /** Enables client-side sorting on this column. */
  sortValue?: (row: T) => string | number
  className?: string
  headerClassName?: string
  align?: "left" | "right" | "center"
  /** Hide on small screens. */
  hideOnMobile?: boolean
}

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

/**
 * Table with optional sorting, row selection and pagination.
 * - Client mode: pass all rows and `clientPageSize` — sorting/paging happens here.
 * - Server mode: pass the current page rows and `pagination`.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  onRowClick,
  selectable,
  selectedIds,
  onSelectedIdsChange,
  pagination,
  clientPageSize,
  toolbar,
  className,
  dense,
}: {
  columns: Column<T>[]
  rows: T[]
  getRowId: (row: T) => string
  loading?: boolean
  emptyTitle?: string
  emptyDescription?: React.ReactNode
  emptyAction?: React.ReactNode
  onRowClick?: (row: T) => void
  selectable?: boolean
  selectedIds?: string[]
  onSelectedIdsChange?: (ids: string[]) => void
  pagination?: PaginationProps
  clientPageSize?: number
  toolbar?: React.ReactNode
  className?: string
  dense?: boolean
}) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null)
  const [clientPage, setClientPage] = useState(1)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const get = col.sortValue
    return [...rows].sort((a, b) => {
      const va = get(a)
      const vb = get(b)
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb))
      return sort.dir === "asc" ? cmp : -cmp
    })
  }, [rows, sort, columns])

  const paging: PaginationProps | undefined =
    pagination ?? (clientPageSize ? { page: clientPage, pageSize: clientPageSize, total: sorted.length, onPageChange: setClientPage } : undefined)
  const visible = !pagination && clientPageSize ? sorted.slice((clientPage - 1) * clientPageSize, clientPage * clientPageSize) : sorted

  const selected = new Set(selectedIds ?? [])
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(getRowId(r)))
  const toggleAll = () => {
    const next = new Set(selected)
    if (allVisibleSelected) visible.forEach((r) => next.delete(getRowId(r)))
    else visible.forEach((r) => next.add(getRowId(r)))
    onSelectedIdsChange?.([...next])
  }
  const toggleOne = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedIdsChange?.([...next])
  }

  const alignClass = (a?: Column<T>["align"]) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "")

  return (
    <Card className={cn("gap-0 overflow-hidden py-0", className)}>
      {toolbar ? <div className="flex flex-wrap items-center gap-2 border-b p-3">{toolbar}</div> : null}
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            {selectable ? (
              <TableHead className="w-10 pl-4">
                <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label="Select all" />
              </TableHead>
            ) : null}
            {columns.map((col) => {
              const active = sort?.key === col.key
              return (
                <TableHead
                  key={col.key}
                  className={cn("h-10 text-xs font-semibold tracking-wide text-muted-foreground uppercase first:pl-4 last:pr-4", alignClass(col.align), col.hideOnMobile && "hidden md:table-cell", col.headerClassName)}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => setSort(active && sort?.dir === "desc" ? null : { key: col.key, dir: active ? "desc" : "asc" })}
                      className={cn("inline-flex items-center gap-1 uppercase hover:text-foreground", active && "text-foreground")}
                    >
                      {col.header}
                      {active ? sort?.dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" /> : <ArrowUpDown className="size-3.5 opacity-50" />}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {selectable ? <TableCell className="pl-4" /> : null}
                  {columns.map((c) => (
                    <TableCell key={c.key} className={cn("first:pl-4 last:pr-4", c.hideOnMobile && "hidden md:table-cell")}>
                      <Skeleton className="h-4 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : visible.map((row) => {
                const id = getRowId(row)
                return (
                  <TableRow
                    key={id}
                    data-state={selected.has(id) ? "selected" : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(onRowClick && "cursor-pointer")}
                  >
                    {selectable ? (
                      <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(id)} onCheckedChange={() => toggleOne(id)} aria-label="Select row" />
                      </TableCell>
                    ) : null}
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(dense ? "py-2" : "py-3", "first:pl-4 last:pr-4", alignClass(col.align), col.hideOnMobile && "hidden md:table-cell", col.className)}
                      >
                        {col.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
        </TableBody>
      </Table>
      {!loading && rows.length === 0 ? (
        <div className="p-4">
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} className="border-0 bg-transparent" />
        </div>
      ) : null}
      {paging && paging.total > paging.pageSize ? <Pagination {...paging} /> : null}
    </Card>
  )
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
      <span>
        {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <span className="px-2 tabular-nums">
          {page} / {pages}
        </span>
        <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
