/**
 * The synced services return web links ("/employee-app/water", "/employee-app/workouts?category=…").
 * The mobile routes use the same paths without the "/employee-app" prefix.
 */
import { router } from "expo-router"
import { Linking } from "react-native"

export function toAppHref(href?: string | null): string {
  if (!href) return "/home"
  if (/^https?:\/\//.test(href)) return href
  const path = href.replace(/^\/employee-app(?=\/|$)/, "")
  return path || "/home"
}

/** Opens a service link: external URLs in the browser, app paths with the router. */
export function openHref(href?: string | null) {
  const target = toAppHref(href)
  if (/^https?:\/\//.test(target)) Linking.openURL(target).catch(() => undefined)
  else router.push(target as never)
}
