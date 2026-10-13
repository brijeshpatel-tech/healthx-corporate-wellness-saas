"use client"

import { Gift } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { RewardForm } from "@/components/business/engagement/rewards/reward-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { EmptyState, QueryState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { rewardsApi } from "@/lib/api/business/rewards"
import { useApiQuery } from "@/lib/api/hooks"

function FormSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="mx-auto h-[480px] w-full max-w-[300px] rounded-[2.2rem]" />
    </div>
  )
}

export default function EditRewardPage() {
  const { id } = useParams<{ id: string }>()
  const reward = useApiQuery(["business", "rewards", "detail", id], () => rewardsApi.get({ id }), { refetchOnWindowFocus: false })

  return (
    <PageContainer>
      <PageHeader
        backHref="/business-portal/rewards"
        backLabel="Rewards"
        title={reward.data ? `Edit ${reward.data.name}` : "Edit reward"}
        badge={reward.data ? <StatusBadge status={reward.data.status} label={reward.data.status === "archived" ? "Deactivated" : undefined} /> : null}
        description="Update what employees see and how the reward is delivered. Changes are recorded in the audit log."
      />
      <QueryState query={reward} loading={<FormSkeleton />}>
        {(r) =>
          r.isCompanyReward ? (
            <RewardForm key={r.id} reward={r} />
          ) : (
            <EmptyState
              icon={Gift}
              title="HealthX catalogue rewards can't be edited"
              description="You can only choose whether your employees see this reward. Use the switch in the HealthX catalogue tab."
              action={
                <Button asChild>
                  <Link href="/business-portal/rewards?tab=catalogue">Go to the catalogue</Link>
                </Button>
              }
            />
          )
        }
      </QueryState>
    </PageContainer>
  )
}
