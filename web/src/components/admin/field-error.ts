/** First error message inside a React Hook Form error (works for arrays / nested objects). */
export function firstErrorMessage(error: unknown, depth = 0): string | undefined {
  if (!error || typeof error !== "object" || depth > 3) return undefined
  const e = error as { message?: unknown; root?: { message?: unknown } }
  if (typeof e.message === "string" && e.message) return e.message
  if (e.root && typeof e.root.message === "string") return e.root.message
  for (const [key, value] of Object.entries(error)) {
    if (key === "ref" || key === "type" || key === "types") continue
    const m = firstErrorMessage(value, depth + 1)
    if (m) return m
  }
  return undefined
}
