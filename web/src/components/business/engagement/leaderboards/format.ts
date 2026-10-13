import { formatMetricValue } from "@/components/business/engagement/challenges/challenge-meta"
import type { LeaderboardResult } from "@/lib/api/business/leaderboards"
import { formatNumber } from "@/lib/format"

/** Value formatter for a leaderboard result (steps, points, counts or a challenge metric). */
export function leaderboardFormatter(r: Pick<LeaderboardResult, "valueKind" | "challengeMetric" | "challengeCustomLabel" | "unit" | "kind">) {
  return (v: number) => {
    if (r.valueKind === "metric" && r.challengeMetric) return formatMetricValue(v, r.challengeMetric, r.challengeCustomLabel, true)
    if (r.valueKind === "steps") return formatNumber(Math.round(v))
    if (r.valueKind === "points") return `${formatNumber(Math.round(v))} pts`
    return `${formatNumber(v, r.kind === "groups" ? 1 : 0)} ${v === 1 ? r.unit.replace(/s$/, "") : r.unit}`
  }
}
