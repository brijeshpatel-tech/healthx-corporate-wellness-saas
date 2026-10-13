"use client"

/**
 * React Query helpers used by every screen.
 *
 *   const { data, isLoading } = useApiQuery(["business", "employees", params], () => employeesApi.list(params))
 *   const invite = useApiMutation(employeesApi.invite, { success: "Invitation sent" })
 *   invite.mutate({ email, ... })
 */
import { useMutation, useQuery, useQueryClient, type QueryKey, type UseQueryOptions } from "@tanstack/react-query"
import { toast } from "sonner"
import { ApiError } from "./core"

export function useApiQuery<T>(
  key: QueryKey,
  fn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T, ApiError, T, QueryKey>, "queryKey" | "queryFn">,
) {
  return useQuery<T, ApiError, T, QueryKey>({ queryKey: key, queryFn: fn, ...options })
}

interface MutationOptions<I, O> {
  /** Toast shown on success. */
  success?: string | ((output: O, input: I) => string)
  /** Toast title on error (the API message is shown as description). */
  errorTitle?: string
  /** Query keys to refresh. Default: refresh everything (cheap in demo mode). */
  invalidate?: QueryKey[] | false
  onSuccess?: (output: O, input: I) => void
  onError?: (error: ApiError, input: I) => void
}

export function useApiMutation<I, O>(fn: (input: I) => Promise<O>, options: MutationOptions<I, O> = {}) {
  const qc = useQueryClient()
  return useMutation<O, ApiError, I>({
    mutationFn: fn,
    onSuccess: async (output, input) => {
      if (options.invalidate !== false) {
        if (options.invalidate) await Promise.all(options.invalidate.map((k) => qc.invalidateQueries({ queryKey: k })))
        else await qc.invalidateQueries()
      }
      if (options.success) toast.success(typeof options.success === "function" ? options.success(output, input) : options.success)
      options.onSuccess?.(output, input)
    },
    onError: (error, input) => {
      toast.error(options.errorTitle ?? "Something went wrong", { description: error.message })
      options.onError?.(error, input)
    },
  })
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return "Something went wrong. Please try again."
}
