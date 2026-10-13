/**
 * Small deterministic helpers for sample data.
 * All randomness flows through one seeded generator so data is stable between reloads.
 */
import { fakerEN_IN } from "@faker-js/faker"

export const faker = fakerEN_IN

export function seedRandom(seed: number) {
  faker.seed(seed)
}

export const int = (min: number, max: number) => faker.number.int({ min, max })
export const float = (min: number, max: number, fractionDigits = 2) => {
  const value = faker.number.float({ min, max })
  const f = 10 ** fractionDigits
  return Math.min(max, Math.max(min, Math.round(value * f) / f))
}
export const chance = (probability: number) => faker.number.float({ min: 0, max: 1 }) < probability
export const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)]
export const pickMany = <T>(items: readonly T[], count: number): T[] =>
  faker.helpers.arrayElements(items as T[], Math.min(count, items.length))
export const shuffle = <T>(items: readonly T[]): T[] => faker.helpers.shuffle([...items])

let idCounter = 0
/** Short unique ids such as "ord_k3f9a1c". Unique across reloads (time-based prefix + counter). */
export const makeId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36).slice(-5)}${(++idCounter).toString(36).padStart(3, "0")}`
export const resetIds = () => {
  idCounter = 0
}

export * from "./series"
import { DAY_MS } from "./series"

/** Random timestamp between `fromDaysAgo` and `toDaysAgo` days in the past. */
export const isoBetweenDaysAgo = (fromDaysAgo: number, toDaysAgo = 0) => {
  const start = Date.now() - fromDaysAgo * DAY_MS
  const end = Date.now() - toDaysAgo * DAY_MS
  return new Date(int(Math.min(start, end), Math.max(start, end))).toISOString()
}

