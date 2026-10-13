"use client"

/** Square photo crop dialog (drag to position, slider to zoom). Outputs a 320×320 JPEG data URL. */
import { ZoomIn, ZoomOut } from "lucide-react"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"

const V = 256
const OUT = 320

export function PhotoCropper({ src, onCancel, onDone }: { src: string | null; onCancel: () => void; onDone: (dataUrl: string) => void }) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement>(null)
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const base = natural ? V / Math.min(natural.w, natural.h) : 1
  const scale = base * zoom
  const dw = natural ? natural.w * scale : V
  const dh = natural ? natural.h * scale : V
  const clamp = (p: { x: number; y: number }, w = dw, h = dh) => ({ x: Math.min(0, Math.max(V - w, p.x)), y: Math.min(0, Math.max(V - h, p.y)) })

  const setZoomKeepCentre = (z: number) => {
    if (!natural) return
    const s1 = base * zoom
    const s2 = base * z
    const cx = (V / 2 - pos.x) / s1
    const cy = (V / 2 - pos.y) / s1
    setZoom(z)
    setPos(clamp({ x: V / 2 - cx * s2, y: V / 2 - cy * s2 }, natural.w * s2, natural.h * s2))
  }

  const crop = () => {
    const img = imgRef.current
    if (!img || !natural) return
    const canvas = document.createElement("canvas")
    canvas.width = OUT
    canvas.height = OUT
    const c = canvas.getContext("2d")
    if (!c) return
    c.drawImage(img, -pos.x / scale, -pos.y / scale, V / scale, V / scale, 0, 0, OUT, OUT)
    onDone(canvas.toDataURL("image/jpeg", 0.85))
  }

  return (
    <Dialog open={!!src} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Crop your photo</DialogTitle>
          <DialogDescription>Drag to position, then zoom to fit.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative cursor-grab touch-none overflow-hidden rounded-full bg-muted ring-4 ring-primary/30 active:cursor-grabbing"
            style={{ width: V, height: V }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              drag.current = { x: pos.x, y: pos.y, px: e.clientX, py: e.clientY }
            }}
            onPointerMove={(e) => {
              if (!drag.current) return
              setPos(clamp({ x: drag.current.x + e.clientX - drag.current.px, y: drag.current.y + e.clientY - drag.current.py }))
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={src}
                alt="Photo to crop"
                draggable={false}
                onLoad={(e) => {
                  const w = e.currentTarget.naturalWidth
                  const h = e.currentTarget.naturalHeight
                  const s = V / Math.min(w, h)
                  setNatural({ w, h })
                  setZoom(1)
                  setPos({ x: (V - w * s) / 2, y: (V - h * s) / 2 })
                }}
                className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left select-none"
                style={{ width: dw, height: dh, transform: `translate(${pos.x}px, ${pos.y}px)` }}
              />
            ) : null}
          </div>
          <div className="flex w-full items-center gap-3">
            <ZoomOut className="size-4 text-muted-foreground" />
            <Slider value={[zoom]} min={1} max={3} step={0.01} onValueChange={(v) => setZoomKeepCentre(v[0] ?? 1)} aria-label="Zoom" />
            <ZoomIn className="size-4 text-muted-foreground" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={crop} disabled={!natural}>
            Use photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
