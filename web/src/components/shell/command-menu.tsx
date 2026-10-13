"use client"

import { Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import type { NavGroup } from "@/config/nav"
import { cn } from "@/lib/utils"

/** Ctrl/⌘ + K quick navigation across every page the user can open. */
export function CommandMenu({ groups, className }: { groups: NavGroup[]; className?: string }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-8 w-full max-w-64 items-center gap-2 rounded-lg border bg-muted/40 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted",
          className,
        )}
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search pages…</span>
        <Kbd className="hidden sm:inline-flex">Ctrl K</Kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Go to page" description="Search for a page">
        <CommandInput placeholder="Type a page name…" />
        <CommandList>
          <CommandEmpty>No pages found.</CommandEmpty>
          {groups.map((g) => (
            <CommandGroup key={g.label} heading={g.label}>
              {g.items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`${g.label} ${item.title}`}
                  onSelect={() => {
                    setOpen(false)
                    router.push(item.href)
                  }}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  )
}
