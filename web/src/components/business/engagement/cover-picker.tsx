"use client"

import { Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { COVER_COLORS } from "@/lib/mock/series"
import { cn } from "@/lib/utils"

export const DEFAULT_EMOJIS = ["🏆", "👟", "🏃", "🚶", "🚴", "🏋️", "🧘", "💧", "🥗", "😴", "🔥", "⚡", "🎯", "🌱", "🧠", "❤️", "🏁", "🌧️", "🪔", "🎉"]

/** Extra cover colours on top of the sample-data palette. */
export const EXTRA_COLORS = ["#ec4899", "#06b6d4", "#84cc16", "#64748b"] as const
export const PICKER_COLORS = [...COVER_COLORS, ...EXTRA_COLORS]

/** Rounded square showing an emoji over a tinted colour — used for challenge, reward, program and content covers. */
export function CoverTile({
  emoji,
  color,
  size = "md",
  solid,
  className,
}: {
  emoji: string
  color: string
  size?: "sm" | "md" | "lg" | "xl"
  /** Solid colour background instead of a soft tint. */
  solid?: boolean
  className?: string
}) {
  const sizes = { sm: "size-8 text-base rounded-lg", md: "size-10 text-lg rounded-xl", lg: "size-14 text-2xl rounded-2xl", xl: "size-20 text-4xl rounded-2xl" }
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center leading-none select-none", sizes[size], className)}
      style={{ backgroundColor: solid ? color : `${color}22` }}
      aria-hidden
    >
      {emoji}
    </span>
  )
}

/** Emoji + colour picker for covers ("image" for engagement items in the demo). */
export function CoverPicker({
  emoji,
  color,
  onEmojiChange,
  onColorChange,
  emojis = DEFAULT_EMOJIS,
  label = "Cover",
  disabled,
  className,
}: {
  emoji: string
  color: string
  onEmojiChange: (emoji: string) => void
  onColorChange: (color: string) => void
  emojis?: string[]
  label?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex flex-col gap-4 rounded-xl border p-3 sm:flex-row">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="flex h-20 w-28 items-center justify-center rounded-xl text-4xl" style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}>
            <span className="drop-shadow-sm">{emoji}</span>
          </div>
          <Input
            aria-label="Custom emoji"
            value={emoji}
            disabled={disabled}
            onChange={(e) => onEmojiChange(Array.from(e.target.value.trim()).slice(-2).join("") || emoji)}
            className="h-8 w-28 text-center"
          />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Cover emoji">
            {emojis.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={emoji === e}
                disabled={disabled}
                onClick={() => onEmojiChange(e)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg text-lg transition-colors hover:bg-muted disabled:opacity-50",
                  emoji === e && "bg-primary/10 ring-1 ring-primary/40",
                )}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cover colour">
            {PICKER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color.toLowerCase() === c.toLowerCase()}
                aria-label={`Colour ${c}`}
                disabled={disabled}
                onClick={() => onColorChange(c)}
                className="flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
                style={{ backgroundColor: c }}
              >
                {color.toLowerCase() === c.toLowerCase() ? <Check className="size-3.5 text-white" strokeWidth={3} /> : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
