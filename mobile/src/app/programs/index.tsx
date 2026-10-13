/** SCR-M-064 Wellness Programs (Phase 2) — Available / My programs / Completed. */
import { CalendarRange, CircleCheckBig, Compass } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { ProgramCardView } from "@/components/engage/grow"
import { EmptyState, ErrorState, PhaseBadge, Screen, SegmentedControl, SkeletonList, Text } from "@/components/ui"
import { programsApi, type ProgramTab } from "@/lib/api/employee/programs"
import { useApiQuery } from "@/lib/api/hooks"

export default function ProgramsScreen() {
  const q = useApiQuery(["employee", "programs", "list"], () => programsApi.list())
  const [picked, setPicked] = useState<ProgramTab | null>(null)
  // Default to "My programs" when the employee already follows one.
  const tab: ProgramTab = picked ?? (q.data && q.data.counts.mine > 0 ? "mine" : "available")
  const items = q.data?.items.filter((p) => p.tab === tab) ?? []
  const counts = q.data?.counts
  const label = (t: ProgramTab, text: string) => (counts?.[t] ? `${text} (${counts[t]})` : text)

  return (
    <Screen title="Wellness programs" back right={<PhaseBadge phase={2} />} refreshing={q.isRefetching} onRefresh={() => q.refetch()} testID="programs-screen">
      <Text variant="caption" tone="muted">
        Multi-week programs with a goal for every week. Join one and your steps, water, workouts and sleep count automatically.
      </Text>
      <SegmentedControl<ProgramTab>
        value={tab}
        onChange={setPicked}
        accessibilityLabel="Programs"
        options={[
          { value: "available", label: label("available", "Available") },
          { value: "mine", label: label("mine", "Mine") },
          { value: "completed", label: label("completed", "Done") },
        ]}
      />
      {q.error ? (
        <ErrorState title="Couldn't load programs." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : !q.data ? (
        <SkeletonList count={3} height={240} header={false} />
      ) : items.length === 0 ? (
        tab === "available" ? (
          <EmptyState icon={CalendarRange} title="No programs available right now." description="New programs from your company and HealthX will appear here." />
        ) : tab === "mine" ? (
          <EmptyState icon={Compass} title="You're not following a program yet." description="Pick a program to get a clear goal for every week." action={{ label: "Browse programs", onPress: () => setPicked("available") }} />
        ) : (
          <EmptyState icon={CircleCheckBig} title="No completed programs yet." description="Finish every weekly goal of a program to earn its completion points." />
        )
      ) : (
        <View style={styles.list}>
          {items.map((p) => (
            <ProgramCardView key={p.id} program={p} />
          ))}
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { gap: 14 },
})
