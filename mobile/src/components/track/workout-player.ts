/**
 * Workout player state machine (SCR-M-032 / 033): ready → countdown → exercise ⇄ rest → done.
 * Pure reducer — the screen drives it with wall-clock "tick" actions.
 */
import type { WorkoutDetail } from "@/lib/api/employee/workouts"

export type Phase = "ready" | "countdown" | "exercise" | "rest" | "done"

export interface PlayerState {
  phase: Phase
  index: number
  /** Seconds left in the current phase. */
  remaining: number
  /** Length of the current phase (for the ring). */
  total: number
  paused: boolean
  /** Indexes of exercises completed (timer ran out, not skipped). */
  completed: number[]
  /** Active seconds (excludes the countdown and pauses). */
  elapsed: number
  endedEarly: boolean
}

export type PlayerAction =
  | { type: "begin" }
  | { type: "tick"; dt: number }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "skip" }
  | { type: "prev" }
  | { type: "addRest"; sec: number }
  | { type: "end" }

export const INITIAL_PLAYER: PlayerState = { phase: "ready", index: 0, remaining: 0, total: 1, paused: false, completed: [], elapsed: 0, endedEarly: false }

export function makePlayerReducer(w: WorkoutDetail) {
  const last = w.steps.length - 1
  const toExercise = (s: PlayerState, index: number): PlayerState => ({ ...s, phase: "exercise", index, remaining: w.steps[index]!.durationSec, total: w.steps[index]!.durationSec })
  const afterExercise = (s: PlayerState, completedIt: boolean): PlayerState => {
    const completed = completedIt && !s.completed.includes(s.index) ? [...s.completed, s.index] : s.completed
    if (s.index >= last) return { ...s, completed, phase: "done", remaining: 0 }
    const rest = w.steps[s.index]!.restSec
    if (rest > 0) return { ...s, completed, phase: "rest", remaining: rest, total: rest }
    return toExercise({ ...s, completed }, s.index + 1)
  }
  return (s: PlayerState, a: PlayerAction): PlayerState => {
    switch (a.type) {
      case "begin":
        return { ...s, phase: "countdown", remaining: 3, total: 3, paused: false }
      case "tick": {
        if (s.paused || s.phase === "ready" || s.phase === "done") return s
        const remaining = s.remaining - a.dt
        const elapsed = s.phase === "countdown" ? s.elapsed : s.elapsed + a.dt
        if (remaining > 0) return { ...s, remaining, elapsed }
        const next = { ...s, elapsed }
        if (s.phase === "countdown") return toExercise(next, 0)
        if (s.phase === "exercise") return afterExercise(next, true)
        return toExercise(next, s.index + 1)
      }
      case "pause":
        return s.phase === "done" || s.phase === "ready" ? s : { ...s, paused: true }
      case "resume":
        return { ...s, paused: false }
      case "skip":
        if (s.phase === "exercise") return afterExercise(s, false)
        if (s.phase === "rest") return toExercise(s, s.index + 1)
        if (s.phase === "countdown") return toExercise(s, 0)
        return s
      case "prev":
        if (s.phase === "rest") return toExercise(s, s.index)
        // Restart the current exercise, or go back one when it has only just started.
        if (s.phase === "exercise") return toExercise(s, Math.max(0, s.remaining < s.total - 3 ? s.index : s.index - 1))
        return s
      case "addRest":
        return s.phase === "rest" ? { ...s, remaining: s.remaining + a.sec, total: s.total + a.sec } : s
      case "end":
        return { ...s, phase: "done", endedEarly: true, paused: false }
    }
  }
}
