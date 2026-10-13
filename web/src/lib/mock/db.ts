/**
 * In-browser sample database. Generated on first use, then saved to
 * localStorage so anything created in the UI survives a reload.
 * Only used when env.useMock is true. Never imported by server code paths.
 */
import { buildSeed, SEED_VERSION, type MockDB } from "./seed"
import { createEmployeePrivate, type EmployeePrivate } from "./seed/private"

const STORAGE_KEY = "healthx.mockdb"

let db: MockDB | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined"

function load(): MockDB | null {
  if (!canUseStorage()) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MockDB
    return parsed.version === SEED_VERSION ? parsed : null
  } catch {
    return null
  }
}

function writeNow() {
  if (!db || !canUseStorage()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // Storage full or blocked — keep working in memory.
  }
}

export function getDb(): MockDB {
  if (db) return db
  db = load() ?? buildSeed()
  writeNow()
  return db
}

/** Persist changes (debounced). Call after every mutation. */
export function saveDb() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(writeNow, 120)
}

/** Throw away all changes and regenerate the sample data. */
export function resetDb() {
  if (canUseStorage()) window.localStorage.removeItem(STORAGE_KEY)
  db = buildSeed()
  writeNow()
  return db
}

/** Employee-only data (activity, water, wallet...). Created on first access. */
export function getPrivate(employeeId: string): EmployeePrivate {
  const d = getDb()
  let data = d.private[employeeId]
  if (!data) {
    const employee = d.employees.find((e) => e.id === employeeId)
    if (!employee) throw new Error(`Unknown employee ${employeeId}`)
    data = createEmployeePrivate(d, employee)
    d.private[employeeId] = data
    saveDb()
  }
  return data
}

/** Extra sample data owned by a single feature. `init` runs once. */
export function getExtra<T>(key: string, init: () => T): T {
  const d = getDb()
  if (!(key in d.extra)) {
    d.extra[key] = init()
    saveDb()
  }
  return d.extra[key] as T
}

export type { MockDB, EmployeePrivate }
