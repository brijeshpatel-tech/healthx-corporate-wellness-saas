"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

export type LegalDoc = "terms" | "privacy"

const DOCS: Record<LegalDoc, { title: string; version: string; sections: { heading: string; body: string }[] }> = {
  terms: {
    title: "Terms of Use",
    version: "Version 2026.1 · Effective 1 April 2026",
    sections: [
      { heading: "1. About HealthX", body: "HealthX is a workplace wellness app provided to you by your employer. By using it you agree to these terms and to your company's wellness programme rules." },
      { heading: "2. Your account", body: "Keep your sign-in details private and tell us straight away if you think someone else has used your account. Your company can deactivate your account, for example when you leave." },
      { heading: "3. Fair play", body: "Points, challenges and leaderboards only work if everyone plays fair. Don't fake activity, share accounts or use tools that generate steps. We may remove points earned unfairly." },
      { heading: "4. Rewards", body: "Rewards are funded by your company, subject to availability and your company's approval. Points have no cash value, can't be transferred and never expire." },
      { heading: "5. Health information", body: "HealthX gives general wellness information, not medical advice. Talk to a doctor before starting a new exercise or diet programme, especially if you have a health condition." },
      { heading: "6. Changes", body: "We may update these terms. We'll tell you in the app before important changes take effect." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    version: "Version 2026.1 · Effective 1 April 2026",
    sections: [
      { heading: "What we collect", body: "Your profile details, the wellness data you track or sync (steps, water, sleep, workouts, habits), your points and reward orders, and basic app usage." },
      { heading: "What your company sees", body: "Your participation — whether your account is active and which challenges you joined — plus your name on leaderboards as your company has set it and reward orders for delivery. Wellness figures only as combined totals for groups of 5 or more people. Never your individual health data." },
      { heading: "How we protect it", body: "Personal and health data is encrypted in transit and at rest, access is restricted and logged, and we never sell your data." },
      { heading: "Your choices", body: "You can change consents at any time in Privacy & consent, disconnect health apps, download a copy of your data and delete your account." },
      { heading: "How long we keep it", body: "While your account is active. After you delete your account or leave your company, personal data is deleted or anonymised within 30 days unless the law requires us to keep it longer." },
      { heading: "Contact", body: "Questions about privacy? Email privacy@healthx.life." },
    ],
  },
}

/** Short sample legal text (Terms of Use / Privacy Policy) shown in-app. */
export function LegalDialog({ doc, onOpenChange }: { doc: LegalDoc | null; onOpenChange: (open: boolean) => void }) {
  const d = doc ? DOCS[doc] : null
  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        {d ? (
          <>
            <DialogHeader className="border-b p-5 pb-4">
              <DialogTitle className="font-heading text-lg">{d.title}</DialogTitle>
              <DialogDescription>{d.version}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60svh]">
              <div className="space-y-4 p-5 text-sm leading-relaxed">
                {d.sections.map((s) => (
                  <section key={s.heading} className="space-y-1">
                    <h3 className="font-semibold">{s.heading}</h3>
                    <p className="text-muted-foreground">{s.body}</p>
                  </section>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter className="mx-0 mb-0 p-4">
              <Button className="h-11 w-full rounded-xl sm:w-auto" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
