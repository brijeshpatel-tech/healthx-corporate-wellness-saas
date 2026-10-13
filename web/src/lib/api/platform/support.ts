/**
 * Platform Admin — Support tickets (SCR-P-030). Tickets come from `db.supportTickets`
 * (companies create them from the Business Portal). Assignees are kept in extra storage.
 */
import { DAY_MS } from "@/lib/mock/series"
import type { PlatformAdmin, SupportTicket } from "@/lib/types"
import { PLATFORM_ROLE_LABEL } from "@/lib/types"
import { audit, badRequest, endpoint, matchesSearch, notFound, paginate } from "../core"
import { companyName, planOf, ratio, requireAdmin, round, type AdminCtx } from "./common"
import { companyAdmins } from "./directory"

export type TicketStatus = SupportTicket["status"]
export type TicketPriority = SupportTicket["priority"]

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = { open: "Open", pending: "Pending", resolved: "Resolved", closed: "Closed" }
export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" }
export type RequesterType = "company_admin" | "employee"
export const REQUESTER_TYPE_LABEL: Record<RequesterType, string> = { company_admin: "Company admin", employee: "Employee" }

export const TICKET_CATEGORY_LABEL: Record<SupportTicket["category"], string> = { account: "Account", billing: "Billing", technical: "Technical", rewards: "Rewards", other: "Other" }

export interface TicketQuery {
  status?: TicketStatus | "all"
  search?: string
  priority?: TicketPriority
  companyId?: string
  assigneeId?: string
  requesterType?: RequesterType
  page?: number
  pageSize?: number
}

export interface StaffRef {
  id: string
  name: string
  role: string
  avatarColor: string
}

export interface TicketRow {
  id: string
  number: string
  subject: string
  companyId: string
  companyName: string
  requester: string
  requesterType: RequesterType
  category: SupportTicket["category"]
  priority: TicketPriority
  status: TicketStatus
  assignee: StaffRef | null
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface TicketList {
  items: TicketRow[]
  total: number
  page: number
  pageSize: number
  counts: Record<TicketStatus | "all", number>
  kpis: { open: number; pending: number; resolvedThisWeek: number; avgFirstResponseHours: number | null; unassigned: number }
}

export interface TicketMessage {
  index: number
  from: string
  body: string
  at: string
  internal: boolean
  /** "staff" = HealthX team member; "customer" = company admin / employee. */
  author: "staff" | "customer"
  avatarColor?: string
}

export interface TicketDetail extends TicketRow {
  messages: TicketMessage[]
  company: {
    id: string
    name: string
    status: string
    planName: string
    employeeCount: number
    ownerName: string
    ownerEmail: string
    city: string
    createdAt: string
  } | null
  assignable: StaffRef[]
  firstResponseHours: number | null
}

const assigneeStore = (ctx: AdminCtx) =>
  ctx.extra<Record<string, string | null>>("admin-support-assignees", () => {
    // Seed: whoever from HealthX already replied owns the ticket.
    const map: Record<string, string | null> = {}
    for (const t of ctx.db.supportTickets) {
      const staff = t.messages.map((m) => ctx.db.platformAdmins.find((a) => a.name === m.from)).find(Boolean)
      map[t.id] = staff?.id ?? null
    }
    return map
  })

/**
 * Who raised the ticket: a company admin (Business Portal) or an employee (employee app, #347).
 * Seed tickets are classified once; new tickets written by other apps are derived live by matching
 * the requester to the company owner / admins. Default = Employee.
 */
const requesterTypeStore = (ctx: AdminCtx) =>
  ctx.extra<Record<string, RequesterType>>("admin-support-requester-types", () => {
    const map: Record<string, RequesterType> = {}
    for (const t of ctx.db.supportTickets) {
      if (isCompanyAdmin(ctx, t)) map[t.id] = "company_admin"
      else map[t.id] = t.category === "billing" || t.category === "account" || t.category === "other" ? "company_admin" : "employee"
    }
    return map
  })

function isCompanyAdmin(ctx: AdminCtx, t: SupportTicket) {
  const name = t.requester.trim().toLowerCase()
  const c = ctx.db.companies.find((x) => x.id === t.companyId)
  if (c && c.ownerName.trim().toLowerCase() === name) return true
  if (ctx.db.employees.some((e) => e.companyId === t.companyId && !!e.adminRole && `${e.firstName} ${e.lastName}`.toLowerCase() === name)) return true
  return companyAdmins(ctx, t.companyId).some((u) => `${u.firstName} ${u.lastName}`.toLowerCase() === name)
}

function requesterTypeOf(ctx: AdminCtx, t: SupportTicket): RequesterType {
  return requesterTypeStore(ctx)[t.id] ?? (isCompanyAdmin(ctx, t) ? "company_admin" : "employee")
}

const staffRef = (a: PlatformAdmin): StaffRef => ({ id: a.id, name: a.name, role: PLATFORM_ROLE_LABEL[a.role], avatarColor: a.avatarColor })

const assignable = (ctx: AdminCtx) =>
  ctx.db.platformAdmins.filter((a) => a.status === "active" && (a.role === "support_admin" || a.role === "super_admin")).map(staffRef)

function assigneeOf(ctx: AdminCtx, ticketId: string): StaffRef | null {
  const id = assigneeStore(ctx)[ticketId]
  const a = id ? ctx.db.platformAdmins.find((x) => x.id === id) : undefined
  return a ? staffRef(a) : null
}

const isStaff = (ctx: AdminCtx, name: string) => ctx.db.platformAdmins.some((a) => a.name === name) || /healthx/i.test(name)

function firstResponseHours(ctx: AdminCtx, t: SupportTicket): number | null {
  const first = t.messages.find((m) => !m.internal && isStaff(ctx, m.from))
  if (!first) return null
  return Math.max(0, (new Date(first.at).getTime() - new Date(t.createdAt).getTime()) / 3_600_000)
}

const toRow = (ctx: AdminCtx, t: SupportTicket): TicketRow => ({
  id: t.id,
  number: t.number,
  subject: t.subject,
  companyId: t.companyId,
  companyName: companyName(ctx, t.companyId),
  requester: t.requester,
  requesterType: requesterTypeOf(ctx, t),
  category: t.category,
  priority: t.priority,
  status: t.status,
  assignee: assigneeOf(ctx, t.id),
  messageCount: t.messages.filter((m) => !m.internal).length,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
})

const PRIORITY_ORDER: Record<TicketPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

function findTicket(ctx: AdminCtx, id: string) {
  const t = ctx.db.supportTickets.find((x) => x.id === id)
  if (!t) throw notFound("Ticket")
  return t
}

function detail(ctx: AdminCtx, t: SupportTicket): TicketDetail {
  const c = ctx.db.companies.find((x) => x.id === t.companyId)
  return {
    ...toRow(ctx, t),
    messages: t.messages.map((m, index) => {
      const admin = ctx.db.platformAdmins.find((a) => a.name === m.from)
      return { index, from: m.from, body: m.body, at: m.at, internal: !!m.internal, author: isStaff(ctx, m.from) ? "staff" : "customer", avatarColor: admin?.avatarColor }
    }),
    company: c
      ? { id: c.id, name: c.name, status: c.status, planName: planOf(ctx, c.planId)?.name ?? "—", employeeCount: c.employeeCount, ownerName: c.ownerName, ownerEmail: c.ownerEmail, city: c.city, createdAt: c.createdAt }
      : null,
    assignable: assignable(ctx),
    firstResponseHours: firstResponseHours(ctx, t),
  }
}

const label = (t: SupportTicket) => `${t.number} · ${t.subject}`

export const supportApi = {
  list: endpoint<TicketQuery, TicketList, "admin">("admin", "GET", "/platform/support/tickets", (q, ctx) => {
    requireAdmin(ctx)
    const all = ctx.db.supportTickets
    const scoped = all.filter(
      (t) =>
        (!q.priority || t.priority === q.priority) &&
        (!q.companyId || t.companyId === q.companyId) &&
        (!q.requesterType || requesterTypeOf(ctx, t) === q.requesterType) &&
        (!q.assigneeId || (q.assigneeId === "unassigned" ? !assigneeStore(ctx)[t.id] : assigneeStore(ctx)[t.id] === q.assigneeId)) &&
        matchesSearch(q.search, t.number, t.subject, t.requester, companyName(ctx, t.companyId)),
    )
    const counts = { all: scoped.length, open: 0, pending: 0, resolved: 0, closed: 0 }
    scoped.forEach((t) => counts[t.status]++)
    const rows = scoped
      .filter((t) => !q.status || q.status === "all" || t.status === q.status)
      .sort((a, b) => {
        const active = (s: TicketStatus) => (s === "open" || s === "pending" ? 0 : 1)
        return active(a.status) - active(b.status) || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.updatedAt.localeCompare(a.updatedAt)
      })
    const responses = all.map((t) => firstResponseHours(ctx, t)).filter((h): h is number => h !== null)
    const page = paginate(rows, q.page ?? 1, q.pageSize ?? 15)
    return {
      ...page,
      items: page.items.map((t) => toRow(ctx, t)),
      counts,
      kpis: {
        open: all.filter((t) => t.status === "open").length,
        pending: all.filter((t) => t.status === "pending").length,
        resolvedThisWeek: all.filter((t) => (t.status === "resolved" || t.status === "closed") && Date.now() - new Date(t.updatedAt).getTime() <= 7 * DAY_MS).length,
        avgFirstResponseHours: responses.length ? round(ratio(responses.reduce((a, h) => a + h, 0), responses.length), 1) : null,
        unassigned: all.filter((t) => (t.status === "open" || t.status === "pending") && !assigneeStore(ctx)[t.id]).length,
      },
    }
  }),

  get: endpoint<{ id: string }, TicketDetail, "admin">("admin", "GET", "/platform/support/tickets/:id", ({ id }, ctx) => {
    requireAdmin(ctx)
    return detail(ctx, findTicket(ctx, id))
  }),

  update: endpoint<{ id: string; status?: TicketStatus; priority?: TicketPriority; assigneeId?: string | null }, TicketDetail, "admin">(
    "admin",
    "PATCH",
    "/platform/support/tickets/:id",
    ({ id, status, priority, assigneeId }, ctx) => {
      requireAdmin(ctx, "support.manage")
      const t = findTicket(ctx, id)
      const now = new Date().toISOString()
      if (status && status !== t.status) {
        if (!TICKET_STATUS_LABEL[status]) throw badRequest("Choose a valid status.", { status: "Choose a status" })
        const before = t.status
        t.status = status
        audit(ctx, { action: `Changed ticket status to ${TICKET_STATUS_LABEL[status]}`, entityType: "Support ticket", entityName: label(t) })
        ctx.db.auditLogs[0]!.details = `${TICKET_STATUS_LABEL[before]} → ${TICKET_STATUS_LABEL[status]}`
      }
      if (priority && priority !== t.priority) {
        if (!TICKET_PRIORITY_LABEL[priority]) throw badRequest("Choose a valid priority.", { priority: "Choose a priority" })
        const before = t.priority
        t.priority = priority
        audit(ctx, { action: `Changed ticket priority to ${TICKET_PRIORITY_LABEL[priority]}`, entityType: "Support ticket", entityName: label(t) })
        ctx.db.auditLogs[0]!.details = `${TICKET_PRIORITY_LABEL[before]} → ${TICKET_PRIORITY_LABEL[priority]}`
      }
      if (assigneeId !== undefined) {
        const store = assigneeStore(ctx)
        if (assigneeId && !assignable(ctx).some((a) => a.id === assigneeId)) throw badRequest("This person can't be assigned tickets.", { assigneeId: "Choose an active support or super admin" })
        if ((store[t.id] ?? null) !== (assigneeId || null)) {
          store[t.id] = assigneeId || null
          const who = assigneeId ? ctx.db.platformAdmins.find((a) => a.id === assigneeId)?.name : null
          audit(ctx, { action: who ? `Assigned ticket to ${who}` : "Unassigned ticket", entityType: "Support ticket", entityName: label(t) })
        }
      }
      t.updatedAt = now
      ctx.save()
      return detail(ctx, t)
    },
  ),

  reply: endpoint<{ id: string; body: string; internal: boolean }, TicketDetail, "admin">(
    "admin",
    "POST",
    "/platform/support/tickets/:id/messages",
    ({ id, body, internal }, ctx) => {
      const session = requireAdmin(ctx, "support.manage")
      const t = findTicket(ctx, id)
      const text = body.trim()
      if (text.length < 2) throw badRequest(internal ? "Write a note first." : "Write a reply first.", { body: internal ? "Write a note first" : "Write a reply first" })
      if (text.length > 4000) throw badRequest("Keep messages under 4,000 characters.", { body: "Keep it under 4,000 characters" })
      if (t.status === "closed" && !internal) throw badRequest("This ticket is closed. Reopen it before replying.")
      const now = new Date().toISOString()
      t.messages.push({ from: session.user.name, body: text, at: now, ...(internal ? { internal: true } : {}) })
      t.updatedAt = now
      // A public reply on a new ticket means we're now waiting on the customer.
      if (!internal && t.status === "open") t.status = "pending"
      const store = assigneeStore(ctx)
      if (!store[t.id] && assignable(ctx).some((a) => a.id === session.user.id)) store[t.id] = session.user.id
      audit(ctx, { action: internal ? "Added internal note to ticket" : "Replied to support ticket", entityType: "Support ticket", entityName: label(t) })
      ctx.save()
      return detail(ctx, t)
    },
  ),

  lookups: endpoint<void, { companies: { id: string; name: string }[]; staff: StaffRef[] }, "admin">("admin", "GET", "/platform/support/lookups", (_, ctx) => {
    requireAdmin(ctx)
    const ids = new Set(ctx.db.supportTickets.map((t) => t.companyId))
    return {
      companies: ctx.db.companies.filter((c) => ids.has(c.id)).map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)),
      staff: assignable(ctx),
    }
  }),
}
