/** SCR-M-003 Company Identification — company code or work email, then confirm the company. */
import { zodResolver } from "@hookform/resolvers/zod"
import { router } from "expo-router"
import { ArrowRight, Building2, CircleHelp, Mail, Ticket } from "lucide-react-native"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { StyleSheet, View } from "react-native"
import { z } from "zod"
import { BrandLogo } from "@/components/brand"
import { applyApiErrors, FormTextField } from "@/components/form"
import { BottomSheet, Button, Card, Notice, Text } from "@/components/ui"
import { env } from "@/config/env"
import { AuthScreen } from "@/features/auth/auth-screen"
import { CompanyBadge } from "@/features/auth/company-badge"
import { DemoHint, DemoRow, DemoValue } from "@/features/auth/demo-hint"
import { employeeAuthApi, type CompanyLookup } from "@/lib/api/auth"
import { errorMessage } from "@/lib/api/hooks"
import { useAuthStore } from "@/lib/auth/session"
import { haptic } from "@/lib/haptics"
import { DEMO_INVITE_TOKEN } from "@/lib/mock/demo-accounts"

const schema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Enter your company code or work email")
    .refine((v) => (v.includes("@") ? /^\S+@\S+\.\S+$/.test(v) : /^[A-Za-z0-9]{4,20}$/.test(v)), {
      message: "Use 4–20 letters or numbers, or a work email address",
    }),
})
type Values = z.infer<typeof schema>

export default function WelcomeScreen() {
  const setPendingCompany = useAuthStore((s) => s.setPendingCompany)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { query: "" } })
  const [company, setCompany] = useState<CompanyLookup | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const lookup = form.handleSubmit(async ({ query }) => {
    setError(null)
    try {
      const found = await employeeAuthApi.identifyCompany({ query })
      haptic.success()
      setCompany(found)
    } catch (err) {
      haptic.error()
      if (!applyApiErrors(form.setError, err)) setError(errorMessage(err))
    }
  })

  const continueToSignIn = () => {
    if (!company) return
    setPendingCompany({ id: company.id, name: company.name, code: company.code })
    const query = form.getValues("query").trim()
    router.push({ pathname: "/sign-in", params: query.includes("@") ? { email: query } : {} })
  }

  if (company) {
    return (
      <AuthScreen
        icon={Building2}
        title="Is this your company?"
        description="We'll load your company's HealthX workspace."
        back={() => setCompany(null)}
        footer={<Button title="Continue" iconRight={ArrowRight} onPress={continueToSignIn} testID="confirm-company" />}
      >
        <Card padding={18}>
          <CompanyBadge name={company.name} branding={company.branding} caption={`Company code ${company.code}`} />
        </Card>
        <Button title="Not my company" variant="ghost" onPress={() => setCompany(null)} />
      </AuthScreen>
    )
  }

  return (
    <AuthScreen
      back={false}
      icon={Building2}
      title="Find your company"
      description="Enter the company code from your invitation, or your work email address."
      top={<BrandLogo size={34} />}
      footer={<Button title="Continue" iconRight={ArrowRight} loading={form.formState.isSubmitting} onPress={lookup} testID="continue" />}
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      <FormTextField
        control={form.control}
        name="query"
        label="Company code or work email"
        placeholder="e.g. NIMBUS or you@company.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="go"
        onSubmitEditing={lookup}
        testID="company-input"
      />
      <View style={styles.links}>
        <Button
          title="I have an invitation"
          icon={Ticket}
          variant="outline"
          size="md"
          block
          onPress={() => router.push({ pathname: "/invite", params: env.useMock ? { token: DEMO_INVITE_TOKEN } : {} })}
        />
        <Button title="Where do I find my code?" icon={CircleHelp} variant="ghost" size="md" block onPress={() => setHelpOpen(true)} />
      </View>

      <DemoHint>
        <DemoRow label="Company code:">
          <DemoValue value="NIMBUS" onPress={() => form.setValue("query", "NIMBUS", { shouldValidate: true })} />
          <Text variant="caption" tone="muted">
            or any @nimbustech.in email
          </Text>
        </DemoRow>
      </DemoHint>

      <BottomSheet open={helpOpen} onClose={() => setHelpOpen(false)} title="Where do I find my code?">
        <Text variant="body">Your company code is in the HealthX invitation email or SMS from your HR team. It&apos;s 4–20 letters or numbers, like NIMBUS.</Text>
        <Text variant="body">You can also type your work email address — we&apos;ll find your company from its domain.</Text>
        <Notice tone="info" icon={Mail} title="Still stuck?">
          {`Ask your HR team to send you an invitation, or email ${env.supportEmail}.`}
        </Notice>
      </BottomSheet>
    </AuthScreen>
  )
}

const styles = StyleSheet.create({
  links: { gap: 4 },
})
