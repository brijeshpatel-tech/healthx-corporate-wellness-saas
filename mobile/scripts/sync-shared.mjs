#!/usr/bin/env node
/**
 * Copies the shared TypeScript code (types, formatters, sample data, employee
 * services) from the web app into the mobile app, so both apps behave the same.
 *
 *   npm run sync-shared
 *
 * - Source: ../web/src/lib  →  Target: ./src/lib (same relative paths, so the
 *   `@/lib/...` and relative imports keep working unchanged).
 * - Every copied file gets an "AUTO-SYNCED" header. Never edit those files in
 *   mobile/ — edit them in web/ and run this script again.
 * - Files that import something the mobile app doesn't have (DOM helpers,
 *   web-only packages, a web file we don't sync) are skipped and listed, unless a
 *   mobile shim with the same path exists (e.g. src/lib/auth/session.ts).
 * - Synced files that disappeared from web/ are removed here too.
 *
 * Mobile-specific twins (NOT synced, same exports as the web files):
 *   src/config/env.ts, src/lib/auth/session.ts, src/lib/mock/db.ts,
 *   src/lib/api/core.ts, src/lib/api/hooks.ts
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const MOBILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const WEB_LIB = path.resolve(MOBILE, "../web/src/lib")
const MOBILE_SRC = path.join(MOBILE, "src")
const MOBILE_LIB = path.join(MOBILE_SRC, "lib")

const HEADER = "// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared\n"

/** What to copy (paths relative to web/src/lib; "/**" = whole folder, recursive). */
const INCLUDE = [
  "types.ts",
  "format.ts",
  "mock/series.ts",
  "mock/defaults.ts",
  "mock/demo-accounts.ts",
  "mock/random.ts",
  "mock/seed/**",
  "api/auth.ts",
  "api/employee/**",
]

const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"]

if (!fs.existsSync(WEB_LIB)) {
  console.error(`✖ Web sources not found at ${WEB_LIB}`)
  process.exit(1)
}

// ─── 1. Collect source files ────────────────────────────────────────────

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return EXTENSIONS.includes(path.extname(entry.name)) ? [full] : []
  })
}

const sources = new Set()
for (const pattern of INCLUDE) {
  if (pattern.endsWith("/**")) {
    const dir = path.join(WEB_LIB, pattern.slice(0, -3))
    if (fs.existsSync(dir)) walk(dir).forEach((f) => sources.add(path.relative(WEB_LIB, f).replace(/\\/g, "/")))
  } else if (fs.existsSync(path.join(WEB_LIB, pattern))) {
    sources.add(pattern)
  } else {
    console.warn(`! ${pattern} does not exist in web/src/lib — skipped`)
  }
}

// ─── 2. Check that every import can be resolved in the mobile app ──────

const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|^\s*import\s*["']([^"']+)["']/gm

function importsOf(code) {
  const out = []
  for (const m of code.matchAll(IMPORT_RE)) out.push(m[1] ?? m[2] ?? m[3])
  return out.filter(Boolean)
}

/** Path (relative to src/lib) for an import inside the synced tree, or null if outside lib/. */
function libTarget(fromRel, spec) {
  let abs
  if (spec.startsWith("@/")) abs = path.join(MOBILE_SRC, spec.slice(2))
  else if (spec.startsWith(".")) abs = path.resolve(path.dirname(path.join(MOBILE_LIB, fromRel)), spec)
  else return undefined
  return abs
}

function existsAsModule(absNoExt, syncedAbs) {
  const candidates = [absNoExt, ...EXTENSIONS.map((e) => absNoExt + e), ...EXTENSIONS.map((e) => path.join(absNoExt, `index${e}`))]
  return candidates.some((c) => syncedAbs.has(path.normalize(c)) || (fs.existsSync(c) && fs.statSync(c).isFile() && !isSyncedFile(c)))
}

function isSyncedFile(abs) {
  try {
    return fs.readFileSync(abs, "utf8").startsWith(HEADER.trim())
  } catch {
    return false
  }
}

function packageExists(spec) {
  const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]
  return fs.existsSync(path.join(MOBILE, "node_modules", name))
}

const codeOf = new Map([...sources].map((rel) => [rel, fs.readFileSync(path.join(WEB_LIB, rel), "utf8")]))
const skipped = new Map()
let changed = true
while (changed) {
  changed = false
  const syncedAbs = new Set([...sources].filter((r) => !skipped.has(r)).map((r) => path.normalize(path.join(MOBILE_LIB, r))))
  for (const rel of sources) {
    if (skipped.has(rel)) continue
    for (const spec of importsOf(codeOf.get(rel))) {
      const abs = libTarget(rel, spec)
      const ok = abs === undefined ? packageExists(spec) : existsAsModule(abs, syncedAbs)
      if (!ok) {
        skipped.set(rel, spec)
        changed = true
        break
      }
    }
  }
}

// ─── 3. Write files ─────────────────────────────────────────────────────

let written = 0
let unchanged = 0
for (const rel of sources) {
  if (skipped.has(rel)) continue
  const target = path.join(MOBILE_LIB, rel)
  const content = HEADER + codeOf.get(rel)
  if (fs.existsSync(target) && !isSyncedFile(target)) {
    // A hand-written mobile twin with the same path wins (never overwrite it).
    console.warn(`! src/lib/${rel} is a mobile-specific file — not overwritten`)
    continue
  }
  fs.mkdirSync(path.dirname(target), { recursive: true })
  if (fs.existsSync(target) && fs.readFileSync(target, "utf8") === content) {
    unchanged++
    continue
  }
  fs.writeFileSync(target, content)
  written++
}

// ─── 4. Remove synced files that no longer exist (or are now skipped) ──

let removed = 0
for (const abs of walk(MOBILE_LIB)) {
  const rel = path.relative(MOBILE_LIB, abs).replace(/\\/g, "/")
  if (isSyncedFile(abs) && (!sources.has(rel) || skipped.has(rel))) {
    fs.rmSync(abs)
    removed++
  }
}

console.log(`✔ sync-shared: ${written} updated, ${unchanged} unchanged, ${removed} removed (from web/src/lib)`)
if (skipped.size) {
  console.log("  Skipped (import not available in the mobile app — add a mobile shim with the same path to include them):")
  for (const [rel, spec] of skipped) console.log(`   - ${rel}  ← imports "${spec}"`)
}
