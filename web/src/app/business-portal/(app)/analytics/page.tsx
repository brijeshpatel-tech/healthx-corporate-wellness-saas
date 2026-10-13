"use client"

import { Download, FileDown, Printer } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { PrintStyles } from "@/components/business/people/print-styles"
import { PrivacyNote } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge } from "@/components/common/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { analyticsApi, RANGE_LABEL, TAB_ROLES, type AnalyticsRange, type AnalyticsTab, type Granularity } from "@/lib/api/business/analytics"
import { organizationApi } from "@/lib/api/business/organization"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { useSession } from "@/lib/auth/session"
import { downloadText } from "@/lib/download"
import type { ChallengeType } from "@/lib/types"
import { AdoptionTab } from "./_components/adoption-tab"
import { ChallengesTab } from "./_components/challenges-tab"
import { DepartmentsTab } from "./_components/departments-tab"
import { EngagementTab } from "./_components/engagement-tab"
import { ParticipationTab } from "./_components/participation-tab"
import { TrendsTab } from "./_components/trends-tab"

const TABS: { key: AnalyticsTab; label: string; phase?: 2 }[] = [
  { key: "adoption", label: "Adoption" },
  { key: "departments", label: "Departments" },
  { key: "challenges", label: "Challenges" },
  { key: "engagement", label: "Engagement", phase: 2 },
  { key: "participation", label: "Wellness", phase: 2 },
  { key: "trends", label: "Trends", phase: 2 },
]

const RANGES: AnalyticsRange[] = ["7d", "30d", "90d", "180d", "365d"]
const RANGE_SHORT: Record<AnalyticsRange, string> = { "7d": "7D", "30d": "30D", "90d": "90D", "180d": "6M", "365d": "12M" }
const THRESHOLDS = [0.5, 0.6, 0.7, 0.8]
const ALL = "all"

function AnalyticsPage() {
  const session = useSession("business")
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const role = session?.role
  const tabs = TABS.filter((t) => role && TAB_ROLES[t.key].includes(role))
  const requested = params.get("tab") as AnalyticsTab | null
  const tab = tabs.find((t) => t.key === requested)?.key ?? tabs[0]?.key ?? "challenges"

  const [range, setRange] = useState<AnalyticsRange>("30d")
  const [departmentId, setDepartmentId] = useState(ALL)
  const [teamId, setTeamId] = useState(ALL)
  const [threshold, setThreshold] = useState<number | null>(null)
  const [challengeType, setChallengeType] = useState<ChallengeType | typeof ALL>(ALL)
  const [granularity, setGranularity] = useState<Granularity>("week")

  const lookups = useApiQuery(["business", "lookups"], () => organizationApi.lookups())
  const teams = (lookups.data?.teams ?? []).filter((t) => t.departmentId === departmentId)
  const filters = { range, departmentId: departmentId === ALL ? undefined : departmentId, teamId: teamId === ALL ? undefined : teamId }
  const scopeLabel = teamId !== ALL ? teams.find((t) => t.id === teamId)?.name : departmentId !== ALL ? lookups.data?.departments.find((d) => d.id === departmentId)?.name : "Whole company"

  const exportCsv = useApiMutation(analyticsApi.exportCsv, { success: "Export ready.", invalidate: false, onSuccess: (r) => downloadText(r.fileName, r.csv) })

  const setTab = (t: string) => router.replace(`${pathname}?tab=${t}`, { scroll: false })
  const departmentFilterApplies = tab !== "departments"

  return (
    <PageContainer>
      <PrintStyles />
      <PageHeader
        title="Analytics"
        description="Aggregated participation and engagement across your company. No individual health data, ever."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={exportCsv.isPending}>
                <Download data-icon="inline-start" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() =>
                  exportCsv.mutate({
                    ...filters,
                    tab,
                    type: challengeType === ALL ? undefined : challengeType,
                    threshold: threshold ?? undefined,
                    granularity,
                  })
                }
              >
                <FileDown /> Download CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.print()}>
                <Printer /> Print or save as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="h-auto gap-1 border-b pb-px">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="h-9 flex-none px-3">
                {t.label}
                {t.phase ? <PhaseBadge phase={t.phase} className="ml-1" /> : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {/* One filter row for everything below */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <ToggleGroup type="single" variant="outline" value={range} onValueChange={(v) => v && setRange(v as AnalyticsRange)} className="hidden sm:flex">
          {RANGES.map((r) => (
            <ToggleGroupItem key={r} value={r} className="px-3" aria-label={RANGE_LABEL[r]} title={RANGE_LABEL[r]}>
              {RANGE_SHORT[r]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select value={range} onValueChange={(v) => setRange(v as AnalyticsRange)}>
          <SelectTrigger className="h-8 w-40 sm:hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r} value={r}>
                {RANGE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {departmentFilterApplies ? (
          <>
            <Select
              value={departmentId}
              onValueChange={(v) => {
                setDepartmentId(v)
                setTeamId(ALL)
              }}
            >
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All departments</SelectItem>
                {lookups.data?.departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {departmentId !== ALL && tab !== "participation" ? (
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="h-8 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All teams</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </>
        ) : null}
        {tab === "departments" ? (
          <Select value={threshold === null ? "default" : String(threshold)} onValueChange={(v) => setThreshold(v === "default" ? null : Number(v))}>
            <SelectTrigger className="h-8 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Company alert threshold</SelectItem>
              {THRESHOLDS.map((t) => (
                <SelectItem key={t} value={String(t)}>
                  Flag below {Math.round(t * 100)}% participation
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {tab === "challenges" ? (
          <Select value={challengeType} onValueChange={(v) => setChallengeType(v as ChallengeType | typeof ALL)}>
            <SelectTrigger className="h-8 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All challenge types</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="leaderboard">Leaderboard</SelectItem>
              <SelectItem value="team">Team</SelectItem>
              <SelectItem value="company">Company-wide</SelectItem>
              <SelectItem value="collaborative">Collaborative</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        {tab === "trends" ? (
          <ToggleGroup type="single" variant="outline" value={granularity} onValueChange={(v) => v && setGranularity(v as Granularity)}>
            <ToggleGroupItem value="week" className="px-3">
              Weekly
            </ToggleGroupItem>
            <ToggleGroupItem value="month" className="px-3">
              Monthly
            </ToggleGroupItem>
          </ToggleGroup>
        ) : null}
        <Badge variant="secondary" className="ml-auto">
          {departmentFilterApplies ? scopeLabel : "All departments"} · {RANGE_LABEL[range]}
        </Badge>
      </div>

      <p className="-mt-3 text-xs text-muted-foreground print:mt-0">
        <span className="font-medium text-foreground">Active employee</span> = logged a wellness activity or signed in during the selected period.{" "}
        <span className="font-medium text-foreground">Participation</span> = active ÷ eligible employees × 100 (eligible = employees who have joined HealthX).
      </p>

      {tab === "adoption" ? <AdoptionTab filters={filters} /> : null}
      {tab === "departments" ? <DepartmentsTab filters={filters} threshold={threshold ?? undefined} /> : null}
      {tab === "challenges" ? <ChallengesTab filters={filters} type={challengeType === ALL ? undefined : challengeType} /> : null}
      {tab === "engagement" ? <EngagementTab filters={filters} /> : null}
      {tab === "participation" ? <ParticipationTab filters={filters} /> : null}
      {tab === "trends" ? <TrendsTab filters={filters} granularity={granularity} onRangeChange={setRange} /> : null}

      <PrivacyNote />
    </PageContainer>
  )
}

/** SCR-B-023..028 — Analytics with tabs (?tab=adoption|departments|challenges|engagement|participation|trends). */
export default function Page() {
  return (
    <Suspense>
      <AnalyticsPage />
    </Suspense>
  )
}
