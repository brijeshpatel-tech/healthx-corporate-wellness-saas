/** Country calling codes for phone sign-in (E.164). Local number length is validated per country. */
export interface CountryCode {
  value: string
  label: string
  dial: string
  /** Allowed national number lengths. */
  lengths: number[]
  example: string
}

export const COUNTRY_CODES: CountryCode[] = [
  { value: "IN", label: "India (+91)", dial: "+91", lengths: [10], example: "98765 43210" },
  { value: "AE", label: "United Arab Emirates (+971)", dial: "+971", lengths: [9], example: "50 123 4567" },
  { value: "SG", label: "Singapore (+65)", dial: "+65", lengths: [8], example: "8123 4567" },
  { value: "GB", label: "United Kingdom (+44)", dial: "+44", lengths: [10], example: "7400 123456" },
  { value: "US", label: "United States (+1)", dial: "+1", lengths: [10], example: "201 555 0123" },
]

export const countryOf = (value: string) => COUNTRY_CODES.find((c) => c.value === value) ?? COUNTRY_CODES[0]!

/** Indian mobiles start with 6–9. */
export function isValidMobile(country: CountryCode, digits: string) {
  if (!country.lengths.includes(digits.length)) return false
  if (country.value === "IN" && !/^[6-9]/.test(digits)) return false
  return true
}
