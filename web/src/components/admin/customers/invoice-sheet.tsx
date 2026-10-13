"use client"

import { Ban, CheckCircle2, Download, TriangleAlert } from "lucide-react"
import { KeyValueList } from "@/components/common/misc"
import { StatusBadge } from "@/components/common/status-badge"
import { ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useApiQuery } from "@/lib/api/hooks"
import { invoicesApi, type InvoiceRow } from "@/lib/api/platform/billing"
import { formatCurrency, formatDate, formatNumber } from "@/lib/format"

export interface InvoiceActions {
  canManage: boolean
  busy?: boolean
  onDownload: (inv: InvoiceRow) => void
  onMarkPaid: (inv: InvoiceRow) => void
  onVoid: (inv: InvoiceRow) => void
}

/** Invoice detail with line items and the "totals must match line items" check. */
export function InvoiceSheet({ invoiceId, onOpenChange, actions }: { invoiceId: string | null; onOpenChange: (open: boolean) => void; actions: InvoiceActions }) {
  const q = useApiQuery(["admin", "invoices", "detail", invoiceId], () => invoicesApi.get({ id: invoiceId! }), { enabled: !!invoiceId })
  const d = q.data
  const money = (v: number) => formatCurrency(v, d?.currency ?? "INR")
  const open = d && (d.status === "due" || d.status === "overdue")

  return (
    <Sheet open={!!invoiceId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b p-5 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="font-mono text-lg font-semibold">{d?.number ?? "Invoice"}</SheetTitle>
            {d ? <StatusBadge status={d.status} /> : null}
          </div>
          <SheetDescription>{d ? `${d.companyName} · ${formatDate(d.periodStart, "MMMM yyyy")}` : "Loading invoice…"}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 p-5">
          {q.error ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : !d ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <KeyValueList
                items={[
                  { label: "Bill to", value: d.companyLegalName },
                  { label: "Plan", value: d.planName },
                  { label: "Billing period", value: `${formatDate(d.periodStart)} – ${formatDate(d.periodEnd)}` },
                  { label: "Billable employees", value: formatNumber(d.seats) },
                  { label: "Issued", value: formatDate(d.issuedAt) },
                  { label: d.paidAt ? "Paid" : "Due", value: formatDate(d.paidAt ?? d.dueAt) },
                ]}
              />
              <Separator />
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Line items</h3>
                <div className="overflow-hidden rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Description</th>
                        <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">Qty × price</th>
                        <th className="px-3 py-2 text-right font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {d.lines.map((l, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2.5">
                            <div>{l.description}</div>
                            <div className="text-xs text-muted-foreground sm:hidden">
                              {formatNumber(l.quantity)} × {money(l.unitPrice)}
                            </div>
                          </td>
                          <td className="hidden px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">
                            {formatNumber(l.quantity)} × {money(l.unitPrice)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap tabular-nums">{money(l.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-muted/20 text-sm">
                      <tr>
                        <td className="px-3 py-2 text-right text-muted-foreground sm:hidden">Subtotal</td>
                        <td colSpan={2} className="hidden px-3 py-2 text-right text-muted-foreground sm:table-cell">
                          Subtotal
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(d.subtotal)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-right text-muted-foreground sm:hidden">GST {Math.round(d.taxRate * 100)}%</td>
                        <td colSpan={2} className="hidden px-3 py-2 text-right text-muted-foreground sm:table-cell">
                          GST {Math.round(d.taxRate * 100)}%
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(d.tax)}</td>
                      </tr>
                      <tr className="border-t font-semibold">
                        <td className="px-3 py-2.5 text-right sm:hidden">Total</td>
                        <td colSpan={2} className="hidden px-3 py-2.5 text-right sm:table-cell">
                          Total
                        </td>
                        <td className="px-3 py-2.5 text-right text-base tabular-nums">{money(d.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {d.totalsMatch ? (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" /> Totals match the line items.
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                    <TriangleAlert className="size-3.5" /> Invoice totals must match line items. Void this invoice and generate it again.
                  </p>
                )}
              </section>
              <p className="text-xs text-muted-foreground">Charges are based on billable active employees during the period × the plan&apos;s price per employee, plus GST.</p>
            </>
          )}
        </div>

        {d ? (
          <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-popover p-4">
            <Button variant="outline" onClick={() => actions.onDownload(d)} disabled={actions.busy}>
              <Download data-icon="inline-start" /> Download
            </Button>
            {actions.canManage && open ? (
              <>
                <Button onClick={() => actions.onMarkPaid(d)} disabled={actions.busy || !d.totalsMatch}>
                  <CheckCircle2 data-icon="inline-start" /> Mark paid
                </Button>
                <Button variant="destructive" onClick={() => actions.onVoid(d)} disabled={actions.busy} className="sm:ml-auto">
                  <Ban data-icon="inline-start" /> Void
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
