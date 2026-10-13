"use client"

import { TriangleAlert } from "lucide-react"
import { LegalDocumentsSection } from "@/components/admin/platform/legal-documents"
import { SettingsGroupForm } from "@/components/admin/platform/settings-group-form"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { QueryState } from "@/components/common/states"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useApiQuery } from "@/lib/api/hooks"
import { settingsApi } from "@/lib/api/platform/settings"

/** SCR-P-023 System configuration. */
export default function SystemConfigurationPage() {
  const can = useAdminCan()
  const canEdit = can("settings.manage")
  const config = useApiQuery(["admin", "config"], () => settingsApi.get())

  return (
    <PageContainer>
      <PageHeader
        title="System configuration"
        description="Global defaults, app versions, security, privacy thresholds, feature flags and legal documents. Every change applies platform-wide and is audit-logged."
      />

      <QueryState
        query={config}
        loading={
          <div className="flex flex-col gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="grid gap-4 lg:grid-cols-[280px_1fr] lg:gap-8">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
                <Skeleton className="h-56 rounded-xl" />
              </div>
            ))}
          </div>
        }
      >
        {(data) => (
          <div className="flex flex-col gap-8">
            {data.maintenanceMode ? (
              <Alert className="border-amber-500/40 bg-amber-500/8 text-amber-900 dark:text-amber-200">
                <TriangleAlert />
                <AlertTitle>Maintenance mode is on</AlertTitle>
                <AlertDescription>All apps currently show a maintenance message. Turn it off under App &amp; defaults when you&apos;re done.</AlertDescription>
              </Alert>
            ) : null}

            <nav aria-label="Sections" className="-mt-2 flex flex-wrap gap-2">
              {data.groups.map((g) => (
                <Button key={g.id} asChild variant="outline" size="sm">
                  <a href={`#group-${g.id}`}>{g.title}</a>
                </Button>
              ))}
              <Button asChild variant="outline" size="sm">
                <a href="#group-legal">Legal documents</a>
              </Button>
            </nav>

            {data.groups.map((g) => (
              <div key={g.id} id={`group-${g.id}`} className="scroll-mt-24">
                <SettingsGroupForm group={g} canEdit={canEdit} />
              </div>
            ))}
            <div id="group-legal" className="scroll-mt-24">
              <LegalDocumentsSection legal={data.legal} canEdit={canEdit} />
            </div>
          </div>
        )}
      </QueryState>
    </PageContainer>
  )
}
