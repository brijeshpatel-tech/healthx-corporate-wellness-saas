/**
 * Platform Admin — central gamification points rules (SCR-P-021). No hard-coded points:
 * the Employee App reads db.pointsRules when awarding points.
 * Every change bumps the rule version and writes a history entry (extra "admin-points-history").
 */
import type { PointsRule, PointsSource } from "@/lib/types"
import { audit, badRequest, endpoint, newId, notFound } from "../core"
import { requireAdmin, today, type AdminCtx } from "./common"

export interface PointsHistoryEntry {
  id: string
  ruleId: string
  ruleLabel: string
  version: number
  kind: "created" | "updated"
  old: { points: number; dailyCap: number | null; active: boolean } | null
  next: { points: number; dailyCap: number | null; active: boolean }
  effectiveFrom: string // YYYY-MM-DD
  by: string
  at: string
  note?: string
}

export interface PointsRuleRow extends PointsRule {
  effectiveFrom: string
  /** A saved change that starts in the future. */
  scheduled: boolean
}

export interface PointsRulesData {
  rules: PointsRuleRow[]
  recentChanges: PointsHistoryEntry[]
}

export interface RuleChange {
  id: string
  points: number
  dailyCap: number | null
  active: boolean
}

export interface SaveRulesInput {
  changes: RuleChange[]
  effectiveFrom: string
  note?: string
}

export interface CreateRuleInput {
  label: string
  eventType: PointsSource
  description: string
  points: number
  per: string
  dailyCap: number | null
  effectiveFrom: string
}

/** Events that can earn points (not wallet movements). */
export const EARNING_EVENTS: PointsSource[] = ["steps", "workout", "meditation", "water", "challenge", "streak", "badge", "habit"]

const HISTORY_KEY = "admin-points-history"
const LAUNCH_NOTE = "Launch configuration"

function history(ctx: AdminCtx) {
  return ctx.extra<PointsHistoryEntry[]>(HISTORY_KEY, () => {
    const entries: PointsHistoryEntry[] = []
    const rules = ctx.db.pointsRules
    const seed = (ruleId: string, version: number, old: PointsHistoryEntry["old"], next: PointsHistoryEntry["next"], date: string, note: string, by = "Arjun Nair") => {
      const r = rules.find((x) => x.id === ruleId)
      if (!r) return
      entries.push({ id: `pth_${ruleId}_${version}`, ruleId, ruleLabel: r.label, version, kind: old ? "updated" : "created", old, next, effectiveFrom: date, by, at: `${date}T09:30:00.000Z`, note })
    }
    // Version 1 of every rule = the launch configuration.
    rules.forEach((r) => {
      const v1 =
        r.id === "rule_steps" ? { points: 8, dailyCap: 120, active: true } : r.id === "rule_workout" ? { points: 40, dailyCap: 80, active: true } : { points: r.points, dailyCap: r.dailyCap, active: r.active }
      seed(r.id, 1, null, v1, r.id === "rule_habit" ? "2026-07-21" : "2026-06-01", LAUNCH_NOTE)
    })
    seed("rule_steps", 2, { points: 8, dailyCap: 120, active: true }, { points: 10, dailyCap: 120, active: true }, "2026-07-10", "Rounded to 10 points per 1,000 steps — easier for employees to understand.")
    seed("rule_workout", 2, { points: 40, dailyCap: 80, active: true }, { points: 50, dailyCap: 100, active: true }, "2026-08-15", "Workouts were under-rewarded compared with steps.")
    seed("rule_steps", 3, { points: 10, dailyCap: 120, active: true }, { points: 10, dailyCap: 150, active: true }, "2026-09-02", "Raised the daily cap for the festive step season.")
    return entries.sort((a, b) => b.at.localeCompare(a.at))
  })
}

function findRule(ctx: AdminCtx, id: string) {
  const r = ctx.db.pointsRules.find((x) => x.id === id)
  if (!r) throw notFound("Points rule")
  return r
}

function checkValues(points: unknown, dailyCap: unknown, key: string, errors: Record<string, string>) {
  if (typeof points !== "number" || !Number.isInteger(points) || points < 0 || points > 1000) errors[`${key}points`] = "Points must be a whole number from 0 to 1,000."
  if (dailyCap !== null) {
    if (typeof dailyCap !== "number" || !Number.isInteger(dailyCap) || dailyCap < 1 || dailyCap > 10000) errors[`${key}dailyCap`] = "Daily cap must be 1–10,000 (or empty for no cap)."
    else if (typeof points === "number" && points > 0 && dailyCap < points) errors[`${key}dailyCap`] = "Daily cap can't be lower than the points per event."
  }
}

function checkDate(effectiveFrom: string, errors: Record<string, string>) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom ?? "")) errors.effectiveFrom = "Choose the date the change applies from."
  else if (effectiveFrom < today()) errors.effectiveFrom = "Effective date can't be in the past."
}

export const pointsRulesApi = {
  list: endpoint<void, PointsRulesData, "admin">("admin", "GET", "/platform/points-rules", (_i, ctx) => {
    requireAdmin(ctx)
    const h = history(ctx)
    const t = today()
    const rules = ctx.db.pointsRules.map((r) => {
      const latest = h.find((e) => e.ruleId === r.id && e.version === r.version)
      const effectiveFrom = latest?.effectiveFrom ?? r.updatedAt.slice(0, 10)
      return { ...r, effectiveFrom, scheduled: effectiveFrom > t }
    })
    return { rules, recentChanges: h.filter((e) => e.kind === "updated" || e.note !== LAUNCH_NOTE).slice(0, 8) }
  }),

  history: endpoint<{ id: string }, PointsHistoryEntry[], "admin">("admin", "GET", "/platform/points-rules/:id/history", ({ id }, ctx) => {
    requireAdmin(ctx)
    findRule(ctx, id)
    return history(ctx).filter((e) => e.ruleId === id).sort((a, b) => b.version - a.version)
  }),

  /** Saves inline edits for one or more rules (each changed rule gets a new version). */
  save: endpoint<SaveRulesInput, { updated: number; effectiveFrom: string }, "admin">("admin", "PATCH", "/platform/points-rules", (input, ctx) => {
    const admin = requireAdmin(ctx, "points.manage")
    const errors: Record<string, string> = {}
    checkDate(input.effectiveFrom, errors)
    if ((input.note ?? "").length > 300) errors.note = "Keep the note under 300 characters."
    input.changes.forEach((c) => checkValues(c.points, c.dailyCap, `${c.id}.`, errors))
    if (Object.keys(errors).length) throw badRequest("Couldn't save rule. Please fix the highlighted fields.", errors)

    const h = history(ctx)
    const at = new Date().toISOString()
    let updated = 0
    for (const c of input.changes) {
      const r = findRule(ctx, c.id)
      const old = { points: r.points, dailyCap: r.dailyCap, active: r.active }
      if (old.points === c.points && old.dailyCap === c.dailyCap && old.active === c.active) continue
      r.points = c.points
      r.dailyCap = c.dailyCap
      r.active = c.active
      r.version += 1
      r.updatedAt = at
      h.unshift({
        id: newId("pth"),
        ruleId: r.id,
        ruleLabel: r.label,
        version: r.version,
        kind: "updated",
        old,
        next: { points: r.points, dailyCap: r.dailyCap, active: r.active },
        effectiveFrom: input.effectiveFrom,
        by: admin.user.name,
        at,
        note: input.note?.trim() || undefined,
      })
      const parts = [
        old.points !== r.points ? `points ${old.points} → ${r.points}` : "",
        old.dailyCap !== r.dailyCap ? `cap ${old.dailyCap ?? "none"} → ${r.dailyCap ?? "none"}` : "",
        old.active !== r.active ? (r.active ? "activated" : "deactivated") : "",
      ].filter(Boolean)
      audit(ctx, { action: `Updated points rule to v${r.version} (${parts.join(", ")}) from ${input.effectiveFrom}`, entityType: "Points rule", entityName: r.label, severity: "warning" })
      updated++
    }
    if (updated === 0) throw badRequest("Nothing to save — no rule values changed.")
    ctx.save()
    return { updated, effectiveFrom: input.effectiveFrom }
  }),

  create: endpoint<CreateRuleInput, PointsRule, "admin">("admin", "POST", "/platform/points-rules", (input, ctx) => {
    const admin = requireAdmin(ctx, "points.manage")
    const errors: Record<string, string> = {}
    const label = input.label?.trim() ?? ""
    if (label.length < 3) errors.label = "Enter a rule name."
    else if (label.length > 60) errors.label = "Keep the name under 60 characters."
    else if (ctx.db.pointsRules.some((r) => r.label.trim().toLowerCase() === label.toLowerCase())) errors.label = "A rule with this name already exists."
    if (!EARNING_EVENTS.includes(input.eventType)) errors.eventType = "Choose the event that earns points."
    if (!input.per?.trim()) errors.per = "Say what one award is for, e.g. “workout” or “1,000 steps”."
    checkValues(input.points, input.dailyCap, "", errors)
    checkDate(input.effectiveFrom, errors)
    if (Object.keys(errors).length) throw badRequest("Couldn't save rule. Please fix the highlighted fields.", errors)
    const at = new Date().toISOString()
    const r: PointsRule = {
      id: newId("rule"),
      eventType: input.eventType,
      label,
      description: input.description?.trim() ?? "",
      points: input.points,
      per: input.per.trim(),
      dailyCap: input.dailyCap,
      active: true,
      version: 1,
      updatedAt: at,
    }
    ctx.db.pointsRules.push(r)
    history(ctx).unshift({ id: newId("pth"), ruleId: r.id, ruleLabel: r.label, version: 1, kind: "created", old: null, next: { points: r.points, dailyCap: r.dailyCap, active: true }, effectiveFrom: input.effectiveFrom, by: admin.user.name, at, note: "New rule" })
    audit(ctx, { action: `Created points rule (${r.points} pts per ${r.per})`, entityType: "Points rule", entityName: r.label, severity: "warning" })
    ctx.save()
    return r
  }),
}
