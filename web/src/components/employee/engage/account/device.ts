"use client"

import { useSyncExternalStore } from "react"

export const APP_VERSION = "1.0.0"
export const APP_BUILD = "Web · build 2026.10"

/** "Chrome 141 on Windows" from a user-agent string. */
export function summariseUserAgent(ua: string) {
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Linux/.test(ua)
              ? "Linux"
              : "Unknown OS"
  const match =
    ua.match(/(Edg)\/(\d+)/) ??
    ua.match(/(OPR)\/(\d+)/) ??
    ua.match(/(SamsungBrowser)\/(\d+)/) ??
    ua.match(/(Firefox|FxiOS)\/(\d+)/) ??
    ua.match(/(Chrome|CriOS)\/(\d+)/) ??
    ua.match(/Version\/(\d+).*(Safari)/)
  let browser = "Browser"
  if (match) {
    const names: Record<string, string> = { Edg: "Edge", OPR: "Opera", SamsungBrowser: "Samsung Internet", Firefox: "Firefox", FxiOS: "Firefox", Chrome: "Chrome", CriOS: "Chrome" }
    browser = match[2] === "Safari" ? `Safari ${match[1]}` : `${names[match[1]!] ?? match[1]} ${match[2]}`
  }
  const mobile = /Mobi|Android|iPhone/.test(ua)
  return `${browser} on ${os}${mobile ? " (mobile)" : ""}`
}

const noopSubscribe = () => () => {}

/** Device summary — `null` during server render, computed in the browser. */
export function useDeviceInfo() {
  return useSyncExternalStore(
    noopSubscribe,
    () => summariseUserAgent(navigator.userAgent),
    () => null,
  )
}
