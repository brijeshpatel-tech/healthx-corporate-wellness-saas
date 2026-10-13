"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { MapPin } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { SelectField, TextareaField, TextField } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { locationsApi, TIMEZONES, type LocationRow } from "@/lib/api/business/locations"
import { ApiError } from "@/lib/api/core"
import { useApiMutation } from "@/lib/api/hooks"

const schema = z.object({
  name: z.string().trim().min(2, "Enter a location name").max(60),
  address: z.string().trim().max(200),
  city: z.string().trim().min(1, "Enter a city").max(60),
  country: z.string().trim().min(1, "Enter a country").max(60),
  timezone: z.string().min(1, "Choose a timezone"),
})
type Values = z.infer<typeof schema>

const empty: Values = { name: "", address: "", city: "", country: "India", timezone: "Asia/Kolkata" }

/** Add / edit office location (SCR-B-046, FRM-67). */
export function LocationDialog({ open, onOpenChange, location }: { open: boolean; onOpenChange: (open: boolean) => void; location?: LocationRow | null }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty })
  useEffect(() => {
    if (open) form.reset(location ? { name: location.name, address: location.address, city: location.city, country: location.country, timezone: location.timezone } : empty)
  }, [open, location, form])

  const onError = (err: ApiError) => {
    if (err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
  }
  const create = useApiMutation(locationsApi.create, { success: "Location added.", onSuccess: () => onOpenChange(false), onError })
  const update = useApiMutation(locationsApi.update, { success: "Location updated.", onSuccess: () => onOpenChange(false), onError })
  const pending = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{location ? `Edit ${location.name}` : "Add location"}</DialogTitle>
          <DialogDescription>Locations let you compare participation between offices. Groups under 5 people stay hidden.</DialogDescription>
        </DialogHeader>
        <form id="location-form" noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((v) => (location ? update.mutate({ id: location.id, ...v }) : create.mutate(v)))}>
          <TextField control={form.control} name="name" label="Location name" placeholder="e.g. Pune Office" required className="sm:col-span-2" />
          <TextareaField control={form.control} name="address" label="Address" rows={2} placeholder="Building, street, area, PIN" className="sm:col-span-2" />
          <TextField control={form.control} name="city" label="City" required />
          <TextField control={form.control} name="country" label="Country" required />
          <SelectField control={form.control} name="timezone" label="Timezone" required className="sm:col-span-2" options={TIMEZONES.map((t) => ({ value: t.value, label: t.label }))} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="location-form" disabled={pending}>
            {pending ? <Spinner /> : <MapPin data-icon="inline-start" />}
            {location ? "Save changes" : "Add location"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
