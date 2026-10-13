"use client"

import { ChevronsUpDown, X } from "lucide-react"
import { useState } from "react"
import { UserAvatar } from "@/components/common/user-avatar"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { PersonRef } from "@/lib/api/business/organization"
import { cn } from "@/lib/utils"

export type PickablePerson = PersonRef & { hint?: string; disabled?: boolean }

function PersonOption({ p }: { p: PickablePerson }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5">
      <UserAvatar name={p.name} color={p.avatarColor} size="xs" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{p.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{p.hint ?? p.jobTitle}</span>
      </span>
    </span>
  )
}

/** Searchable single-person picker (popover). */
export function EmployeeCombobox({
  people,
  value,
  onChange,
  placeholder = "Choose a person…",
  disabled,
  invalid,
  allowClear = true,
  id,
}: {
  people: PickablePerson[]
  value?: string
  onChange: (id: string | undefined) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  allowClear?: boolean
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = people.find((p) => p.id === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid}
            disabled={disabled}
            className="h-9 w-full justify-between px-2.5 font-normal"
          >
            {selected ? (
              <span className="flex min-w-0 items-center gap-2">
                <UserAvatar name={selected.name} color={selected.avatarColor} size="xs" />
                <span className="truncate">{selected.name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className={cn("ml-2 size-4 shrink-0 opacity-50", selected && allowClear && "invisible")} />
          </Button>
        </PopoverTrigger>
        {selected && allowClear && !disabled ? (
          <button type="button" aria-label="Clear" onClick={() => onChange(undefined)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name or job title…" />
          <CommandList>
            <CommandEmpty>No one matches.</CommandEmpty>
            <CommandGroup>
              {people.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.email} ${p.jobTitle} ${p.id}`}
                  disabled={p.disabled}
                  data-checked={p.id === value}
                  onSelect={() => {
                    onChange(p.id)
                    setOpen(false)
                  }}
                >
                  <PersonOption p={p} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** Inline searchable checklist for picking several people. */
export function EmployeeMultiSelect({
  people,
  selected,
  onChange,
  emptyText = "No one matches.",
  className,
}: {
  people: PickablePerson[]
  selected: string[]
  onChange: (ids: string[]) => void
  emptyText?: string
  className?: string
}) {
  const set = new Set(selected)
  return (
    <Command className={cn("rounded-xl! border bg-card", className)}>
      <CommandInput placeholder="Search people…" />
      <CommandList className="max-h-64">
        <CommandEmpty>{emptyText}</CommandEmpty>
        <CommandGroup>
          {people.map((p) => (
            <CommandItem
              key={p.id}
              value={`${p.name} ${p.email} ${p.jobTitle} ${p.hint ?? ""} ${p.id}`}
              disabled={p.disabled}
              data-checked={set.has(p.id)}
              onSelect={() => onChange(set.has(p.id) ? selected.filter((x) => x !== p.id) : [...selected, p.id])}
            >
              <PersonOption p={p} />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
