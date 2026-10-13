"use client"

/** Lightweight confetti burst (CSS only, respects reduced motion). */
import { cn } from "@/lib/utils"

const COLORS = ["#10b981", "#0ea5e9", "#f59e0b", "#8b5cf6", "#f43f5e", "#14b8a6"]

// Deterministic pieces (no randomness during render).
const PIECES = Array.from({ length: 36 }, (_, i) => {
  const angle = (i / 36) * Math.PI * 2
  const dist = 90 + ((i * 37) % 70)
  return {
    x: Math.round(Math.cos(angle) * dist),
    y: Math.round(Math.sin(angle) * dist * 0.8 - 40),
    rot: (i * 47) % 360,
    color: COLORS[i % COLORS.length]!,
    delay: (i % 6) * 40,
    w: i % 3 === 0 ? 6 : 8,
    h: i % 3 === 0 ? 10 : 6,
  }
})

export function Confetti({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible motion-reduce:hidden", className)}>
      <style>{`@keyframes hx-confetti { 0% { transform: translate(0,0) rotate(0deg); opacity: 1 } 80% { opacity: 1 } 100% { transform: translate(var(--x), calc(var(--y) + 120px)) rotate(var(--r)); opacity: 0 } }`}</style>
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-[2px]"
          style={
            {
              width: p.w,
              height: p.h,
              backgroundColor: p.color,
              "--x": `${p.x}px`,
              "--y": `${p.y}px`,
              "--r": `${p.rot + 360}deg`,
              animation: `hx-confetti 1400ms cubic-bezier(.2,.7,.3,1) ${p.delay}ms both`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
