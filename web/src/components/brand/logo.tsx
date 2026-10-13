import { cn } from "@/lib/utils"

/** HealthX mark: a rounded tile with a heartbeat line forming an X. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-8 shrink-0", className)} aria-hidden="true">
      <defs>
        <linearGradient id="hx-g" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#hx-g)" />
      <path d="M8 21h6l3-7 5 13 3-6h7" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({
  className,
  label,
  size = "md",
}: {
  className?: string
  /** Product label shown next to the wordmark, e.g. "Business". */
  label?: string
  size?: "sm" | "md" | "lg"
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={size === "sm" ? "size-7" : size === "lg" ? "size-10" : "size-8"} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-heading font-extrabold tracking-tight", size === "lg" ? "text-xl" : size === "sm" ? "text-sm" : "text-base")}>
          Health<span className="text-primary">X</span>
        </span>
        {label ? <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">{label}</span> : null}
      </span>
    </span>
  )
}
