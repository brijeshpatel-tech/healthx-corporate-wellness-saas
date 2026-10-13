/**
 * React Hook Form helpers.
 *
 *   const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues })
 *   <FormTextField control={form.control} name="email" label="Work email" />
 *   catch (err) { applyApiErrors(form.setError, err) }
 */
import { Controller, type Control, type FieldValues, type Path, type UseFormSetError } from "react-hook-form"
import { TextField, type TextFieldProps } from "@/components/ui/text-field"
import { ApiError } from "@/lib/api/core"

type FormTextFieldProps<T extends FieldValues> = { control: Control<T>; name: Path<T> } & Omit<TextFieldProps, "value" | "onChangeText" | "error" | "ref">

/** TextField bound to a form field (value, onChange, onBlur, inline error). */
export function FormTextField<T extends FieldValues>({ control, name, ...props }: FormTextFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...props}
          ref={field.ref}
          value={field.value == null ? "" : String(field.value)}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
        />
      )}
    />
  )
}

/**
 * Maps API field errors (ApiError.fieldErrors) onto form fields.
 * Returns true when at least one field got an error (so a toast isn't needed).
 */
export function applyApiErrors<T extends FieldValues>(setError: UseFormSetError<T>, error: unknown, fields?: Path<T>[]) {
  if (!(error instanceof ApiError) || !error.fieldErrors) return false
  let applied = false
  for (const [key, message] of Object.entries(error.fieldErrors)) {
    if (fields && !fields.includes(key as Path<T>)) continue
    setError(key as Path<T>, { type: "server", message })
    applied = true
  }
  return applied
}
