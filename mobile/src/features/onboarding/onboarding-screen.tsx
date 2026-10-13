/** Frame for onboarding steps: "Step n of 4" indicator, title, description, sticky actions. */
import type { LucideIcon } from "lucide-react-native"
import type { ReactNode } from "react"
import { StepIndicator } from "@/components/ui"
import { AuthScreen } from "@/features/auth/auth-screen"

const LABELS = ["Profile", "Goals", "Permissions", "Health app"]

export interface OnboardingScreenProps {
  step: 1 | 2 | 3 | 4
  icon?: LucideIcon
  title: string
  description?: string
  children: ReactNode
  footer: ReactNode
  /** Back to the previous step (step 1 has none). */
  backHref?: string
}

export function OnboardingScreen({ step, icon, title, description, children, footer, backHref }: OnboardingScreenProps) {
  return (
    <AuthScreen
      back={!!backHref}
      backHref={backHref}
      icon={icon}
      title={title}
      description={description}
      footer={footer}
      top={<StepIndicator step={step} total={4} label={LABELS[step - 1]} />}
    >
      {children}
    </AuthScreen>
  )
}
