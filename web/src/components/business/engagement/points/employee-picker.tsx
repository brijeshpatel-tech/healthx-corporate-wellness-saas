"use client"

import { ChevronsUpDown } from "lucide-react"
import { useState } from "react"
import { UserAvatar } from "@/components/common/user-avatar"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { EligiblePerson } from "@/lib/api/business/points"
import { cn } from "@/lib/utils"

/** Searchable employee combobox (names and departments only — no points figures). */
export function EmployeePicker({
  id,
  value,
  onChange,
  employees,
  loading,
  invalid,
  disabled,
}: {
  id?: string
  value: string
  onChange: (id: string) => void
  employees: EligiblePerson[]
  loading?: boolean
  invalid?: boolean
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = employees.find((e) => e.id === value)
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          disabled={disabled}
          className={cn("h-10 w-full justify-between px-2.5 font-normal", invalid && "border-destructive ring-3 ring-destructive/20")}
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <UserAvatar name={selected.name} color={selected.avatarColor} size="xs" />
              <span className="truncate font-medium">{selected.name}</span>
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">· {selected.departmentName}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{loading ? "Loading employees…" : "Search for an employee…"}</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
        <Command>
          <CommandInput placeholder="Name or department…" />
          <CommandList className="max-h-72">
            <CommandEmpty>No employees found.</CommandEmpty>
            <CommandGroup>
              {employees.map((e) => (
                <CommandItem
                  key={e.id}
                  value={`${e.name} ${e.departmentName} ${e.id}`}
                  data-checked={value === e.id}
                  onSelect={() => {
                    onChange(e.id)
                    setOpen(false)
                  }}
                  className="gap-2.5"
                >
                  <UserAvatar name={e.name} color={e.avatarColor} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{e.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{e.departmentName}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
