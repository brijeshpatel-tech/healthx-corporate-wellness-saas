"use client"

import { Check } from "lucide-react"
import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form"
import { FieldShell } from "@/components/common/form-fields"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export const COVER_SWATCHES = ["#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#64748b", "#a16207"]

export const EMOJI_SETS = {
  challenge: ["👟", "🏃", "🚶", "⚔️", "💧", "🧘", "🏋️", "🏁", "🍬", "🪔", "🚲", "🧱", "🌧️", "🤝", "🔥", "⛰️", "🏊", "🥗", "😴", "🎯"],
  reward: ["🎁", "🛍️", "☕", "🎬", "⌚", "🧘", "🧴", "🎽", "🎟️", "💚", "⭐", "🥗", "🎧", "📚", "🌱", "🍕", "✈️", "🏖️", "🎮", "💳"],
  badge: ["💪", "🔥", "👟", "💧", "🌅", "🏆", "⚡", "🏃", "🧘", "🌱", "🤝", "🌍", "🥇", "🎯", "🚀", "💎", "👑", "🌟", "🦾", "🧠"],
  workout: ["🪑", "🌅", "🧱", "🏋️", "🤸", "🧘", "🦵", "💪", "🏃", "🚴", "🥊", "🧗", "🏊", "⚡", "🔥", "🌿"],
  content: ["📰", "💧", "🥗", "😴", "🧘", "🏃", "🧠", "❤️", "🍎", "☀️", "🌿", "💬", "🏢", "📊", "🎧", "📖"],
  habit: ["👟", "💧", "😴", "🧘", "🍎", "🚫", "🤸", "⏸️", "📵", "🥦", "☀️", "📖", "🫁", "🪥", "🚰", "🛏️"],
} as const

const SIZE = {
  xs: "size-7 rounded-lg text-sm",
  sm: "size-9 rounded-xl text-lg",
  md: "size-12 rounded-xl text-2xl",
  lg: "size-16 rounded-2xl text-3xl",
  xl: "size-24 rounded-3xl text-5xl",
}

/** Emoji on a soft coloured tile — used as the "image" for templates, rewards, badges, workouts… */
export function CoverTile({ emoji, color, size = "sm", solid, className }: { emoji: string; color: string; size?: keyof typeof SIZE; solid?: boolean; className?: string }) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center leading-none select-none", SIZE[size], className)}
      style={{ backgroundColor: solid ? color : `${color}26`, boxShadow: solid ? undefined : `inset 0 0 0 1px ${color}33` }}
      aria-hidden
    >
      {emoji}
    </span>
  )
}

/** Emoji + colour chooser (controlled). */
export function CoverPicker({
  emoji,
  color,
  onEmojiChange,
  onColorChange,
  emojis = EMOJI_SETS.challenge,
  swatches = COVER_SWATCHES,
}: {
  emoji: string
  color: string
  onEmojiChange: (emoji: string) => void
  onColorChange: (color: string) => void
  emojis?: readonly string[]
  swatches?: readonly string[]
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <CoverTile emoji={emoji || "❔"} color={color} size="xl" className="self-center sm:self-start" />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Icon</p>
          <div className="flex flex-wrap gap-1.5">
            {emojis.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onEmojiChange(e)}
                className={cn("flex size-9 items-center justify-center rounded-lg border text-lg transition-colors hover:bg-muted", emoji === e && "border-primary bg-primary/10 ring-1 ring-primary/40")}
                aria-label={`Use ${e}`}
                aria-pressed={emoji === e}
              >
                {e}
              </button>
            ))}
            <Input value={emoji} onChange={(ev) => onEmojiChange(ev.target.value.slice(0, 4))} className="h-9 w-20 text-center text-lg" aria-label="Custom emoji" placeholder="🙂" />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Colour</p>
          <div className="flex flex-wrap gap-1.5">
            {swatches.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onColorChange(c)}
                className={cn("flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110", color === c && "ring-2 ring-foreground/60")}
                style={{ backgroundColor: c }}
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
              >
                {color === c ? <Check className="size-3.5 text-white" /> : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** React Hook Form wrapper around CoverPicker (two fields: emoji + colour). */
export function CoverPickerField<T extends FieldValues>({
  control,
  emojiName,
  colorName,
  label = "Cover",
  description,
  emojis,
  className,
}: {
  control: Control<T>
  emojiName: FieldPath<T>
  colorName: FieldPath<T>
  label?: React.ReactNode
  description?: React.ReactNode
  emojis?: readonly string[]
  className?: string
}) {
  const emoji = useController({ control, name: emojiName })
  const color = useController({ control, name: colorName })
  return (
    <FieldShell label={label} description={description} error={emoji.fieldState.error?.message ?? color.fieldState.error?.message} className={className}>
      <CoverPicker emoji={emoji.field.value ?? ""} color={color.field.value ?? COVER_SWATCHES[0]} onEmojiChange={emoji.field.onChange} onColorChange={color.field.onChange} emojis={emojis} />
    </FieldShell>
  )
}
