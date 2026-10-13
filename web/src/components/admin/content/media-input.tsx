"use client"

import { ImageIcon, Link2, PlayCircle, Trash2, Upload, Video } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form"
import { FieldShell } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useApiMutation } from "@/lib/api/hooks"
import { IMAGE_ERROR, IMAGE_MAX_MB, IMAGE_TYPES, VIDEO_ERROR, VIDEO_MAX_MB, exercisesApi, type MediaFile } from "@/lib/api/platform/exercises"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

const isUrl = (value: string) => {
  try {
    const u = new URL(value)
    return u.protocol === "https:" || u.protocol === "http:"
  } catch {
    return false
  }
}

const sizeLabel = (bytes?: number) => (bytes ? (bytes >= 1024 * 1024 ? `${formatNumber(bytes / 1024 / 1024, 1)} MB` : `${formatNumber(Math.max(1, bytes / 1024))} KB`) : "")

const hostOf = (url: string) => {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** Image with an emoji fallback (used for thumbnails in tables and previews). */
export function MediaThumb({ imageUrl, emoji, hasVideo, className }: { imageUrl?: string; emoji: string; hasVideo?: boolean; className?: string }) {
  const [broken, setBroken] = useState<string | null>(null)
  const showImage = !!imageUrl && broken !== imageUrl
  return (
    <span className={cn("relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-xl", className)} aria-hidden>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-provided media URL
        <img src={imageUrl} alt="" className="size-full object-cover" onError={() => setBroken(imageUrl)} />
      ) : (
        emoji
      )}
      {hasVideo ? (
        <span className="absolute right-0.5 bottom-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-white">
          <PlayCircle className="size-3" />
        </span>
      ) : null}
    </span>
  )
}

function VideoPreview({ src, poster, emoji, label }: { src: string; poster?: string; emoji: string; label: string }) {
  const [broken, setBroken] = useState(false)
  if (broken)
    return (
      <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-lg bg-muted text-center">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-provided media URL
          <img src={poster} alt="" className="absolute inset-0 size-full object-cover opacity-40" />
        ) : (
          <span className="text-5xl leading-none">{emoji}</span>
        )}
        <span className="relative flex size-11 items-center justify-center rounded-full bg-black/55 text-white">
          <PlayCircle className="size-6" />
        </span>
        <span className="relative max-w-[90%] truncate text-xs font-medium">{label}</span>
        <span className="relative text-[11px] text-muted-foreground">Playback preview isn&apos;t available for this file in demo mode.</span>
      </div>
    )
  return <video src={src} poster={poster} controls preload="metadata" playsInline className="aspect-video w-full rounded-lg bg-black" onError={() => setBroken(true)} />
}

function ImagePreview({ src, emoji }: { src: string; emoji: string }) {
  const [broken, setBroken] = useState(false)
  if (broken)
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-lg bg-muted text-center">
        <span className="text-5xl leading-none">{emoji}</span>
        <span className="text-[11px] text-muted-foreground">Image preview isn&apos;t available in demo mode.</span>
      </div>
    )
  // eslint-disable-next-line @next/next/no-img-element -- admin-provided media URL
  return <img src={src} alt="" className="aspect-video w-full rounded-lg bg-muted object-cover" onError={() => setBroken(true)} />
}

/**
 * Upload (POST /files) or link one media file — a short MP4 video or an image — with a live preview.
 * Uploads are checked here (type / size) and again by the API.
 */
export function MediaField<T extends FieldValues>({
  control,
  name,
  kind,
  label,
  description,
  emoji,
  posterUrl,
  disabled,
  className,
}: {
  control: Control<T>
  name: FieldPath<T>
  kind: "video" | "image"
  label: React.ReactNode
  description?: React.ReactNode
  /** Fallback thumbnail. */
  emoji: string
  /** Image used as the video poster. */
  posterUrl?: string
  disabled?: boolean
  className?: string
}) {
  const { field, fieldState } = useController({ control, name })
  const value = (field.value as MediaFile | null | undefined) ?? null
  const [mode, setMode] = useState<"upload" | "link">("upload")
  const [link, setLink] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)
  const [local, setLocal] = useState<{ url: string; objectUrl: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useApiMutation(exercisesApi.upload, { invalidate: false, errorTitle: kind === "video" ? "Couldn't upload video" : "Couldn't upload image" })

  useEffect(() => () => (local ? URL.revokeObjectURL(local.objectUrl) : undefined), [local])

  const maxMb = kind === "video" ? VIDEO_MAX_MB : IMAGE_MAX_MB
  const typeError = kind === "video" ? VIDEO_ERROR : IMAGE_ERROR
  const accept = kind === "video" ? "video/mp4" : IMAGE_TYPES.join(",")

  const onFile = (file: File | undefined) => {
    if (!file) return
    const okType = kind === "video" ? file.type === "video/mp4" : IMAGE_TYPES.includes(file.type)
    if (!okType || file.size > maxMb * 1024 * 1024) {
      setLocalError(typeError)
      return
    }
    setLocalError(null)
    upload.mutate(
      { fileName: file.name, contentType: file.type, sizeBytes: file.size, purpose: kind === "video" ? "exercise_video" : "exercise_image" },
      {
        onSuccess: (media) => {
          setLocal({ url: media.url, objectUrl: URL.createObjectURL(file) })
          field.onChange(media)
        },
        onError: (err) => setLocalError(err.message),
      },
    )
  }

  const applyLink = () => {
    const v = link.trim()
    if (!isUrl(v)) {
      setLocalError("Enter a valid URL starting with https://")
      return
    }
    setLocalError(null)
    field.onChange({ url: v })
    setLink("")
  }

  const previewSrc = value ? (local && local.url === value.url ? local.objectUrl : value.url) : null
  const error = localError ?? fieldState.error?.message ?? (fieldState.error as { url?: { message?: string } } | undefined)?.url?.message
  const Icon = kind === "video" ? Video : ImageIcon

  return (
    <FieldShell label={label} description={description} error={error} className={className}>
      {value && previewSrc ? (
        <div className="space-y-2 rounded-xl border p-2">
          {kind === "video" ? (
            <VideoPreview key={previewSrc} src={previewSrc} poster={posterUrl} emoji={emoji} label={value.fileName ?? hostOf(value.url)} />
          ) : (
            <ImagePreview key={previewSrc} src={previewSrc} emoji={emoji} />
          )}
          <div className="flex items-center gap-2 px-1">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 text-xs">
              <div className="truncate font-medium">{value.fileName ?? hostOf(value.url)}</div>
              <div className="truncate text-muted-foreground">{value.fileName ? `Uploaded · ${sizeLabel(value.sizeBytes)}` : value.url}</div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled || upload.isPending}>
              {upload.isPending ? <Spinner /> : <Upload data-icon="inline-start" />} Replace
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => field.onChange(null)} disabled={disabled} aria-label={`Remove ${kind}`} className="text-muted-foreground hover:text-destructive">
              <Trash2 />
            </Button>
          </div>
        </div>
      ) : (
        <div className={cn("space-y-2 rounded-xl border border-dashed p-3", error && "border-destructive/60 bg-destructive/5")}>
          <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-xs font-medium">
            {(["upload", "link"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  setLocalError(null)
                }}
                className={cn("flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md transition-colors", mode === m ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                aria-pressed={mode === m}
              >
                {m === "upload" ? <Upload className="size-3.5" /> : <Link2 className="size-3.5" />}
                {m === "upload" ? "Upload file" : "Paste a link"}
              </button>
            ))}
          </div>
          {mode === "upload" ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || upload.isPending}
              className="flex w-full flex-col items-center gap-1 rounded-lg px-3 py-4 text-center transition-colors hover:bg-muted/60 disabled:opacity-60"
            >
              {upload.isPending ? <Spinner className="size-5" /> : <Icon className="size-5 text-muted-foreground" />}
              <span className="text-sm font-medium">{upload.isPending ? "Uploading…" : kind === "video" ? "Choose an MP4 video" : "Choose an image"}</span>
              <span className="text-xs text-muted-foreground">{kind === "video" ? `MP4 · up to ${VIDEO_MAX_MB} MB · keep it short (10–60 s)` : `JPG, PNG or WebP · up to ${IMAGE_MAX_MB} MB`}</span>
            </button>
          ) : (
            <div className="flex gap-2">
              <Input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    applyLink()
                  }
                }}
                placeholder={kind === "video" ? "https://…/squats.mp4" : "https://…/squats.jpg"}
                className="h-9"
                disabled={disabled}
                aria-label={kind === "video" ? "Video URL" : "Image URL"}
              />
              <Button type="button" variant="outline" className="h-9" onClick={applyLink} disabled={disabled || !link.trim()}>
                Use link
              </Button>
            </div>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ""
        }}
      />
    </FieldShell>
  )
}
