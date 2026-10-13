/**
 * Print rules for "Download PDF" (window.print): hide the portal chrome (sidebar, top bar)
 * and anything marked `print:hidden`, so only the page content is printed.
 */
export function PrintStyles() {
  return (
    <style>{`
@media print {
  @page { size: A4; margin: 14mm; }
  html, body { background: #fff !important; }
  :root, .dark { --background: #ffffff; --card: #ffffff; --popover: #ffffff; --foreground: #0f172a; --card-foreground: #0f172a; --muted: #f1f5f9; --muted-foreground: #64748b; --border: #e2e8f0; --chart-grid: #e2e8f0; color-scheme: light; }
  [data-slot="sidebar"], [data-slot="sidebar-gap"], [data-slot="sidebar-container"], [data-slot="sidebar-inset"] > header, [data-sonner-toaster], nextjs-portal { display: none !important; }
  [data-slot="sidebar-wrapper"], [data-slot="sidebar-inset"] { display: block !important; margin: 0 !important; padding: 0 !important; min-height: 0 !important; }
  .print-avoid-break { break-inside: avoid; page-break-inside: avoid; }
  .print-page-break { break-before: page; }
}
`}</style>
  )
}
