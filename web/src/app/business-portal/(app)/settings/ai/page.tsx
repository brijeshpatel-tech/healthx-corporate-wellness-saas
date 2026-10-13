"use client"

import { Bot, Lock, MessageSquare, Save, Sparkles, Users } from "lucide-react"
import { useState } from "react"
import { PrivacyNote, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { ErrorState, PageSkeleton } from "@/components/common/states"
import { PhaseBadge } from "@/components/common/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { settingsApi, type AiSettingsView } from "@/lib/api/business/settings"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format"

/** SCR-B-039 — AI configuration (Phase 2). */
export default function AiConfigurationPage() {
  const q = useApiQuery(["business", "ai-settings"], () => settingsApi.ai())
  return (
    <PageContainer>
      <PageHeader title="AI configuration" badge={<PhaseBadge phase={2} />} description="Turn AI features on or off for your company. Changes apply in the app immediately." />
      {q.isLoading ? <PageSkeleton kpis={3} /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <AiForm data={q.data!} />}
    </PageContainer>
  )
}

function AiForm({ data }: { data: AiSettingsView }) {
  const [coach, setCoach] = useState(data.aiCoachEnabled)
  const [insights, setInsights] = useState(data.aiInsightsEnabled)
  const [limit, setLimit] = useState(data.dailyMessageLimit)
  const [source, setSource] = useState(data)
  if (source !== data) {
    setSource(data)
    setCoach(data.aiCoachEnabled)
    setInsights(data.aiInsightsEnabled)
    setLimit(data.dailyMessageLimit)
  }
  const dirty = coach !== data.aiCoachEnabled || insights !== data.aiInsightsEnabled || limit !== data.dailyMessageLimit
  const save = useApiMutation(settingsApi.updateAi, { success: "AI settings saved." })
  const usage = data.usage
  const usedShare = usage.monthlyConversationLimit ? usage.conversationsThisMonth / usage.monthlyConversationLimit : 0

  const features = [
    {
      key: "coach",
      icon: Bot,
      title: "AI Wellness Coach",
      description: "Employees can chat with a coach for personalised tips on movement, sleep, hydration and habits. Not medical advice.",
      on: coach,
      set: setCoach,
      included: data.coachIncluded,
    },
    {
      key: "insights",
      icon: Sparkles,
      title: "Weekly AI insight",
      description: "A short personalised insight in each employee's weekly summary, based on their own data.",
      on: insights,
      set: setInsights,
      included: data.insightsIncluded,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Coach conversations this month" value={formatNumber(usage.conversationsThisMonth)} icon={MessageSquare} tone="violet" hint={`of ${formatNumber(usage.monthlyConversationLimit)} included`} />
        <StatCard label="Employees using the coach" value={formatNumber(usage.activeUsers)} icon={Users} tone="sky" hint="this month" />
        <StatCard label="Weekly insights delivered" value={formatNumber(usage.insightsDelivered)} icon={Sparkles} tone="emerald" hint="last 4 weeks" />
      </div>

      <SectionCard title="Plan usage" description={`Your ${data.planName} plan includes ${formatNumber(usage.monthlyConversationLimit)} coach conversations a month.`}>
        <div className="space-y-2">
          <Progress value={Math.min(100, usedShare * 100)} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatPercent(usedShare)} used</span>
            <span>Resets on the 1st</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Features">
        <ul className="divide-y rounded-xl border">
          {features.map((f) => (
            <li key={f.key} className="flex items-start gap-4 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-400">
                <f.icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{f.title}</p>
                  {f.included ? <Badge variant="secondary">In your plan</Badge> : <Badge variant="outline" className="gap-1"><Lock /> Not in your plan</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </div>
              <Switch checked={f.on} disabled={!f.included} onCheckedChange={f.set} aria-label={f.title} />
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Usage limit</p>
            <p className="text-xs text-muted-foreground">Maximum AI Coach messages per employee per day. Keeps usage within your plan.</p>
          </div>
          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))} disabled={!coach}>
            <SelectTrigger className="h-9 w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 50].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} messages a day
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{data.updatedAt ? `Last changed ${formatDateTime(data.updatedAt)}` : "Using the default set by HealthX."}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!dirty}
              onClick={() => {
                setCoach(data.aiCoachEnabled)
                setInsights(data.aiInsightsEnabled)
                setLimit(data.dailyMessageLimit)
              }}
            >
              Cancel
            </Button>
            <Button disabled={!dirty || save.isPending} onClick={() => save.mutate({ aiCoachEnabled: coach, aiInsightsEnabled: insights, dailyMessageLimit: limit })}>
              {save.isPending ? <Spinner /> : <Save data-icon="inline-start" />}
              Save
            </Button>
          </div>
        </div>
      </SectionCard>

      <PrivacyNote>Company administrators never see individual AI conversations or insights. Usage figures above are counts only. Employees can delete their own conversations at any time.</PrivacyNote>
    </div>
  )
}
