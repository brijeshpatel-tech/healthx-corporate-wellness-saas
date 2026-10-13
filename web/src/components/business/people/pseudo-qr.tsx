/**
 * Decorative QR-style code for the authenticator set-up step in sample-data mode
 * (no QR library is bundled). The manual set-up key next to it is what actually matters.
 */
export function PseudoQr({ value, size = 168 }: { value: string; size?: number }) {
  const n = 25
  let h = 2166136261
  const bits: boolean[] = []
  for (let i = 0; i < n * n; i++) {
    h ^= value.charCodeAt(i % value.length) + i
    h = Math.imul(h, 16777619) >>> 0
    bits.push((h & 7) > 3)
  }
  const finder = (x: number, y: number) => {
    for (const [fx, fy] of [
      [0, 0],
      [n - 7, 0],
      [0, n - 7],
    ] as const) {
      const dx = x - fx
      const dy = y - fy
      if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
        const edge = dx === 0 || dy === 0 || dx === 6 || dy === 6
        const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4
        return edge || core ? 1 : 0
      }
      if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) return 0
    }
    return -1
  }
  const cells: React.ReactNode[] = []
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const f = finder(x, y)
      const on = f === -1 ? bits[y * n + x] : f === 1
      if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} />)
    }
  }
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={size} height={size} className="rounded-lg bg-white" role="img" aria-label="QR code for your authenticator app">
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" />
      <g fill="#0f172a">{cells}</g>
    </svg>
  )
}
