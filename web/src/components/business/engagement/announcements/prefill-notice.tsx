import { Info } from "lucide-react"

/** Blue info banner shown above a form (pre-filled values, locked fields, scheduling notes). */
export function PrefillNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/25 bg-sky-500/6 px-3.5 py-2.5 text-sm text-sky-900 dark:text-sky-200">
      <Info className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
      <div>{children}</div>
    </div>
  )
}
