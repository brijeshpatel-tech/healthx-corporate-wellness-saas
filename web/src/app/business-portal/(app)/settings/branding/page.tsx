"use client"

import { AlertTriangle, Bell, CheckCircle2, Footprints, ImageUp, RotateCcw, Save, Trash2, Trophy } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { FieldShell } from "@/components/common/form-fields"
import { ConfirmDialog, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { ErrorState, PageSkeleton } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { contrastRatio, HEX_COLOR, MIN_BRAND_CONTRAST, settingsApi, type BrandingView } from "@/lib/api/business/settings"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDateTime } from "@/lib/format"
import type { Branding } from "@/lib/types"
import { cn } from "@/lib/utils"

const PRESETS = ["#0ea5e9", "#059669", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#0f766e", "#1d4ed8", "#334155"]
const MAX_LOGO_BYTES = 2 * 1024 * 1024

/** SCR-B-042 — Branding (logo, colours, app name) with live preview. */
export default function BrandingPage() {
  const q = useApiQuery(["business", "branding"], () => settingsApi.branding())
  return (
    <PageContainer>
      <PageHeader title="Branding" description="Co-brand the employee app and portal with your logo and colours. Applies to your company only." />
      {q.isLoading ? <PageSkeleton kpis={0} /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <BrandingEditor branding={q.data!} />}
    </PageContainer>
  )
}

const pick = (b: Branding): Branding => ({ primaryColor: b.primaryColor, accentColor: b.accentColor, logoInitials: b.logoInitials, logoUrl: b.logoUrl, appDisplayName: b.appDisplayName ?? "" })

/** Downscale raster logos so they stay small in storage; SVGs are kept as-is. */
async function readLogo(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Couldn't read the file"))
    reader.readAsDataURL(file)
  })
  if (file.type === "image/svg+xml") return dataUrl
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error("Couldn't read the image"))
    el.src = dataUrl
  })
  const scale = Math.min(1, 256 / Math.max(img.width, img.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/png")
}

function BrandingEditor({ branding }: { branding: BrandingView }) {
  const [draft, setDraft] = useState<Branding>(pick(branding))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [resetOpen, setResetOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState(branding)
  if (source !== branding) {
    setSource(branding)
    setDraft(pick(branding))
  }

  const saved = pick(branding)
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft)
  const primaryOk = HEX_COLOR.test(draft.primaryColor)
  const accentOk = HEX_COLOR.test(draft.accentColor)
  const ratio = primaryOk ? contrastRatio(draft.primaryColor, "#ffffff") : 0
  const contrastOk = ratio >= MIN_BRAND_CONTRAST
  const primary = primaryOk ? draft.primaryColor : saved.primaryColor
  const accent = accentOk ? draft.accentColor : saved.accentColor

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])

  const save = useApiMutation(settingsApi.updateBranding, {
    success: "Branding updated – employees will see it next time they open the app.",
    onSuccess: () => setErrors({}),
    onError: (e) => setErrors(e.fieldErrors ?? {}),
  })

  const onFile = async (file?: File) => {
    if (!file) return
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type) || file.size > MAX_LOGO_BYTES) {
      setErrors((e) => ({ ...e, logoUrl: "Logo must be PNG, SVG or JPG under 2 MB." }))
      return
    }
    try {
      const url = await readLogo(file)
      setDraft((d) => ({ ...d, logoUrl: url }))
      setErrors((e) => {
        const next = { ...e }
        delete next.logoUrl
        return next
      })
    } catch (err) {
      setErrors((e) => ({ ...e, logoUrl: (err as Error).message }))
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const set = (patch: Partial<Branding>) => setDraft((d) => ({ ...d, ...patch }))
  const appName = draft.appDisplayName?.trim() || branding.companyName

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="flex flex-col gap-6 lg:col-span-3">
        <SectionCard title="Logo" description="PNG, SVG or JPG under 2 MB. Square logos work best — we show it at up to 64 px.">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <LogoTile branding={{ ...draft, primaryColor: primary }} size="lg" />
            <div className="flex-1 space-y-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  void onFile(e.dataTransfer.files[0])
                }}
                className={cn("flex w-full items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-left text-sm transition-colors", dragging ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/40", errors.logoUrl && "border-destructive/50")}
              >
                <ImageUp className="size-5 shrink-0 text-primary" />
                <span>
                  <span className="block font-medium">{draft.logoUrl ? "Replace logo" : "Upload logo"}</span>
                  <span className="block text-xs text-muted-foreground">Drag and drop or click to browse</span>
                </span>
              </button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="sr-only" aria-label="Upload logo" onChange={(e) => void onFile(e.target.files?.[0])} />
              {errors.logoUrl ? <p className="text-xs font-medium text-destructive">{errors.logoUrl}</p> : null}
              <div className="flex flex-wrap items-end gap-3">
                <FieldShell id="initials" label="Fallback initials" error={errors.logoInitials} description="Shown when there's no logo" className="w-40">
                  <Input id="initials" value={draft.logoInitials} maxLength={3} onChange={(e) => set({ logoInitials: e.target.value.toUpperCase() })} className="h-9 font-semibold tracking-wider uppercase" />
                </FieldShell>
                {draft.logoUrl ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => set({ logoUrl: undefined })}>
                    <Trash2 data-icon="inline-start" /> Remove logo
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Colours" description="The primary colour is used for buttons, headers and progress. It needs enough contrast for white text.">
          <div className="grid gap-5 sm:grid-cols-2">
            <ColorField label="Primary colour" value={draft.primaryColor} onChange={(v) => set({ primaryColor: v })} error={errors.primaryColor ?? (!primaryOk ? "Enter a colour like #0EA5E9" : !contrastOk ? "This colour is too light for text." : undefined)} />
            <ColorField label="Accent colour" value={draft.accentColor} onChange={(v) => set({ accentColor: v })} error={errors.accentColor ?? (!accentOk ? "Enter a colour like #10B981" : undefined)} />
          </div>
          <div className={cn("mt-4 flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm", contrastOk ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-amber-500/40 bg-amber-500/[0.06]")}>
            <span className="flex h-8 items-center rounded-md px-3 text-xs font-semibold text-white" style={{ backgroundColor: primary }}>
              Aa
            </span>
            {contrastOk ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="size-4 shrink-0 text-amber-600" />}
            <span className="flex-1">
              Contrast with white text: <span className="font-semibold tabular-nums">{ratio.toFixed(1)}:1</span> — {contrastOk ? "passes" : `needs at least ${MIN_BRAND_CONTRAST}:1`}
            </span>
          </div>
        </SectionCard>

        <SectionCard title="App display name" description="Shown on the employee app's welcome screen and header. Leave blank to use your company name.">
          <FieldShell id="appname" error={errors.appDisplayName} description={`${(draft.appDisplayName ?? "").length}/30`}>
            <Input id="appname" value={draft.appDisplayName ?? ""} maxLength={30} placeholder={branding.companyName} onChange={(e) => set({ appDisplayName: e.target.value })} className="h-9" />
          </FieldShell>
        </SectionCard>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={() => setResetOpen(true)}>
            <RotateCcw data-icon="inline-start" /> Reset to HealthX default
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={!dirty} onClick={() => setDraft(saved)}>
              Cancel
            </Button>
            <Button type="button" disabled={!dirty || !primaryOk || !accentOk || !contrastOk || save.isPending} onClick={() => save.mutate({ ...draft, appDisplayName: draft.appDisplayName?.trim() || undefined })}>
              {save.isPending ? <Spinner /> : <Save data-icon="inline-start" />}
              Save branding
            </Button>
          </div>
        </div>
        {branding.updatedAt ? <p className="text-xs text-muted-foreground">Last updated {formatDateTime(branding.updatedAt)}</p> : null}
      </div>

      <div className="lg:col-span-2">
        <div className="space-y-4 lg:sticky lg:top-20">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Live preview</p>
          <PhonePreview branding={{ ...draft, primaryColor: primary, accentColor: accent }} appName={appName} />
          <PortalHeaderPreview branding={{ ...draft, primaryColor: primary }} companyName={branding.companyName} />
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset to HealthX default?"
        description="Your logo, colours and app name will be replaced with the standard HealthX look. Save to apply."
        confirmLabel="Reset"
        onConfirm={() => setDraft({ ...pick(branding.defaults), logoInitials: branding.logoInitials, logoUrl: undefined, appDisplayName: "" })}
      />
    </div>
  )
}

function ColorField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  const id = `color-${label.replace(/\s+/g, "-").toLowerCase()}`
  const valid = HEX_COLOR.test(value)
  return (
    <FieldShell id={id} label={label} error={error}>
      <div className="flex items-center gap-2">
        <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border shadow-xs" style={{ backgroundColor: valid ? value : "transparent" }}>
          <input type="color" value={valid ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={`${label} picker`} />
        </label>
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value.trim())} className="h-9 font-mono uppercase" maxLength={7} aria-invalid={!!error} />
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={cn("size-6 rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110", value.toLowerCase() === c && "ring-2 ring-foreground/60")}
            style={{ backgroundColor: c }}
            aria-label={`Use ${c}`}
          />
        ))}
      </div>
    </FieldShell>
  )
}

function LogoTile({ branding, size = "md" }: { branding: Branding; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "size-16 rounded-2xl text-xl" : size === "sm" ? "size-7 rounded-lg text-[10px]" : "size-10 rounded-xl text-sm"
  return branding.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- data URL preview
    <img src={branding.logoUrl} alt="Company logo" className={cn("shrink-0 border bg-white object-contain p-1", cls)} />
  ) : (
    <span className={cn("flex shrink-0 items-center justify-center font-heading font-bold text-white", cls)} style={{ backgroundColor: branding.primaryColor }}>
      {branding.logoInitials || "?"}
    </span>
  )
}

function PhonePreview({ branding, appName }: { branding: Branding; appName: string }) {
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[2.2rem] border-[6px] border-slate-900 bg-slate-900 shadow-xl dark:border-slate-700">
      <div className="overflow-hidden rounded-[1.8rem] bg-slate-50 text-slate-900">
        <div className="px-4 pt-3 pb-5 text-white" style={{ background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.accentColor})` }}>
          <div className="flex items-center justify-between text-[10px] opacity-90">
            <span>9:41</span>
            <span>●●● 5G</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <LogoTile branding={branding} size="sm" />
            <span className="truncate text-sm font-semibold">{appName}</span>
            <Bell className="ml-auto size-4 opacity-90" />
          </div>
          <p className="mt-3 text-xs opacity-90">Good morning, Priya</p>
          <p className="text-lg font-bold">Let&apos;s keep moving!</p>
        </div>
        <div className="-mt-3 space-y-2.5 px-3 pb-4">
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Footprints className="size-3.5" style={{ color: branding.primaryColor }} /> Steps today
            </div>
            <p className="mt-1 text-xl font-bold">6,482</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-[72%] rounded-full" style={{ backgroundColor: branding.primaryColor }} />
            </div>
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl text-white" style={{ backgroundColor: branding.accentColor }}>
                <Trophy className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">October Step Up</p>
                <p className="text-[10px] text-slate-500">You&apos;re #4 in Engineering</p>
              </div>
            </div>
            <button type="button" className="mt-2.5 w-full rounded-xl py-2 text-xs font-semibold text-white" style={{ backgroundColor: branding.primaryColor }}>
              View challenge
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PortalHeaderPreview({ branding, companyName }: { branding: Branding; companyName: string }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2.5 border-b px-3 py-2.5">
        <LogoTile branding={branding} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{companyName}</p>
          <p className="text-[11px] text-muted-foreground">Business Portal</p>
        </div>
        <span className="ml-auto rounded-md px-2 py-1 text-[11px] font-semibold text-white" style={{ backgroundColor: branding.primaryColor }}>
          Create challenge
        </span>
      </div>
      <p className="px-3 py-2 text-[11px] text-muted-foreground">Portal header preview</p>
    </div>
  )
}
