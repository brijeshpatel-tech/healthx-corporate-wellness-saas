/**
 * Tiny toast API (mobile stand-in for `sonner` used by the web app).
 *
 *   toast.success("Water goal updated")
 *   toast.error("Couldn't save", { description: error.message })
 *   toast.success("Activity deleted", { action: { label: "Undo", onPress: restore } })
 *
 * Works outside React (API hooks call it). Rendered by <ToastHost /> in the root layout.
 */
import { create } from "zustand"

export type ToastTone = "success" | "error" | "info"

export interface ToastOptions {
  description?: string
  /** One action button, e.g. Undo. */
  action?: { label: string; onPress: () => void }
  /** ms, default 3500 (5000 with an action). */
  duration?: number
}

export interface ToastItem extends ToastOptions {
  id: number
  tone: ToastTone
  title: string
}

interface ToastState {
  items: ToastItem[]
  show: (tone: ToastTone, title: string, options?: ToastOptions) => number
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  show: (tone, title, options) => {
    const id = nextId++
    // Keep at most 3 on screen; newest at the bottom.
    set((s) => ({ items: [...s.items.slice(-2), { id, tone, title, ...options }] }))
    return id
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}))

const show = (tone: ToastTone) => (title: string, options?: ToastOptions) => useToastStore.getState().show(tone, title, options)

export const toast = Object.assign(show("info"), {
  success: show("success"),
  error: show("error"),
  info: show("info"),
  dismiss: (id: number) => useToastStore.getState().dismiss(id),
})
