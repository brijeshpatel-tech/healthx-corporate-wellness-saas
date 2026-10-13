/**
 * Sample database for sample-data mode (mobile twin of web/src/lib/mock/db.ts — same exports).
 *
 * The services read it synchronously (getDb()), so the saved copy is loaded from
 * AsyncStorage once at startup: the root layout awaits `initDb()` before any screen renders.
 * Changes are saved in the background (debounced). Only used when env.useMock is true.
 *
 * The JSON is stored in ~500 KB chunks because Android's AsyncStorage can't read
 * single values larger than ~2 MB.
 */
import AsyncStorage from "@react-native-async-storage/async-storage"
import { buildSeed, SEED_VERSION, type MockDB } from "./seed"
import { createEmployeePrivate, type EmployeePrivate } from "./seed/private"

const STORAGE_KEY = "healthx.mockdb"
const CHUNK_SIZE = 500_000
const SAVE_DELAY_MS = 400

let db: MockDB | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let chunkCount = 0
let initPromise: Promise<void> | null = null

async function load(): Promise<MockDB | null> {
  try {
    const meta = await AsyncStorage.getItem(STORAGE_KEY)
    if (!meta) return null
    const { version, chunks } = JSON.parse(meta) as { version: number; chunks: number }
    if (version !== SEED_VERSION) return null
    const keys = Array.from({ length: chunks }, (_, i) => `${STORAGE_KEY}.${i}`)
    const parts = await AsyncStorage.multiGet(keys)
    if (parts.some(([, value]) => value == null)) return null
    chunkCount = chunks
    return JSON.parse(parts.map(([, value]) => value).join("")) as MockDB
  } catch {
    return null
  }
}

async function writeNow() {
  if (!db) return
  try {
    const json = JSON.stringify(db)
    const chunks: [string, string][] = []
    for (let i = 0; i * CHUNK_SIZE < json.length; i++) chunks.push([`${STORAGE_KEY}.${i}`, json.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)])
    await AsyncStorage.multiSet([...chunks, [STORAGE_KEY, JSON.stringify({ version: db.version, chunks: chunks.length })]])
    // Remove chunks left over from a bigger earlier save.
    if (chunkCount > chunks.length) {
      await AsyncStorage.multiRemove(Array.from({ length: chunkCount - chunks.length }, (_, i) => `${STORAGE_KEY}.${chunks.length + i}`))
    }
    chunkCount = chunks.length
  } catch {
    // Storage full or blocked — keep working in memory.
  }
}

/**
 * Loads the saved sample data (or generates it on first launch).
 * Call once at app start and await it before rendering screens. Safe to call again.
 */
export function initDb(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const saved = await load()
      if (saved) db = saved
      else {
        db = buildSeed()
        await writeNow()
      }
    })()
  }
  return initPromise
}

export function getDb(): MockDB {
  if (db) return db
  // initDb() wasn't awaited (shouldn't happen) — start fresh rather than crash.
  db = buildSeed()
  saveDb()
  return db
}

/** Persist changes (debounced). Call after every mutation. */
export function saveDb() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void writeNow(), SAVE_DELAY_MS)
}

/** Throw away all changes and regenerate the sample data. */
export function resetDb() {
  db = buildSeed()
  void writeNow()
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
