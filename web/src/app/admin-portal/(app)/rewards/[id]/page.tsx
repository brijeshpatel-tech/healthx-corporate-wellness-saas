"use client"

import { useParams } from "next/navigation"
import { ADMIN, REWARD_STATUS_LABEL } from "@/components/admin/engagement/meta"
import { RewardForm } from "@/components/admin/engagement/reward-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { PageSkeleton, QueryState } from "@/components/common/states"
import { useApiQuery } from "@/lib/api/hooks"
import { rewardsApi } from "@/lib/api/platform/rewards"
import { formatDate, formatNumber } from "@/lib/format"

export default function EditRewardPage() {
  const { id } = useParams<{ id: string }>()
  const q = useApiQuery(["admin", "reward", id], () => rewardsApi.get({ id }), { refetchOnWindowFocus: false })

  return (
    <PageContainer>
      <QueryState query={q} loading={<PageSkeleton kpis={0} />}>
        {(r) => (
          <>
            <PageHeader
              title={r.name}
              description={`${formatNumber(r.redemptionsCount)} redemptions · added ${formatDate(r.createdAt)}`}
              backHref={`${ADMIN}/rewards`}
              backLabel="Rewards catalogue"
              badge={<StatusBadge status={r.status} label={REWARD_STATUS_LABEL[r.status]} />}
            />
            <RewardForm key={r.id} reward={r} />
          </>
        )}
      </QueryState>
    </PageContainer>
  )
}
