/** SCR-M-042 Challenges — Available / Active / Completed, type filter and "Join with code" (#356). */
import { useLocalSearchParams } from "expo-router"
import { Award, CalendarRange, KeyRound, Medal, Trophy, type LucideIcon } from "lucide-react-native"
import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { ChallengeCard, JoinCodeSheet } from "@/components/engage/challenge-ui"
import { ChipScroller, go } from "@/components/engage/shared"
import { EmptyState, ErrorState, IconButton, IconTile, PhaseBadge, Screen, SegmentedControl, SkeletonList, Text } from "@/components/ui"
import { challengesApi, CHALLENGE_TYPE_LABEL, type ChallengeTab } from "@/lib/api/employee/challenges"
import { useApiQuery } from "@/lib/api/hooks"
import { haptic } from "@/lib/haptics"
import type { ChallengeType } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import { RADIUS, type TintName } from "@/theme/tokens"

const TABS: ChallengeTab[] = ["available", "active", "completed"]
const TYPES = ["all", "individual", "leaderboard", "team", "company", "collaborative"] as const
type TypeFilter = (typeof TYPES)[number]

function QuickLink({ icon, tint, label, onPress, badge }: { icon: LucideIcon; tint: TintName; label: string; onPress: () => void; badge?: boolean }) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic.tap()
        onPress()
      }}
      style={({ pressed }) => [styles.quick, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
    >
      <IconTile icon={icon} tint={tint} size={34} />
      <Text variant="label" numberOfLines={1}>
        {label}
      </Text>
      {badge ? <PhaseBadge phase={2} style={styles.quickBadge} /> : null}
    </Pressable>
  )
}

export default function ChallengesTab() {
  const params = useLocalSearchParams<{ tab?: string }>()
  const fromLink = TABS.includes(params.tab as ChallengeTab) ? (params.tab as ChallengeTab) : null
  const [tab, setTab] = useState<ChallengeTab>(fromLink ?? "active")
  const [type, setType] = useState<TypeFilter>("all")
  const [codeOpen, setCodeOpen] = useState(false)

  // Deep links such as /challenges?tab=available switch the tab even when the screen is already mounted.
  const [linkSeen, setLinkSeen] = useState(fromLink)
  if (fromLink !== linkSeen) {
    setLinkSeen(fromLink)
    if (fromLink) setTab(fromLink)
  }

  const q = useApiQuery(["employee", "challenges", tab, type], () => challengesApi.list({ status: tab, type }), { placeholderData: (prev) => prev })
  const counts = q.data?.counts
  const label = (t: ChallengeTab, text: string) => (counts && counts[t] ? `${text} (${counts[t]})` : text)

  return (
    <Screen
      inTabs
      large
      title="Challenges"
      subtitle="Compete, climb and earn bonus points"
      right={<IconButton icon={KeyRound} variant="soft" accessibilityLabel="Join with code" onPress={() => setCodeOpen(true)} testID="join-with-code" />}
      refreshing={q.isRefetching && !q.isPlaceholderData}
      onRefresh={() => q.refetch()}
      testID="challenges-screen"
    >
      <View style={styles.quickRow}>
        <QuickLink icon={Medal} tint="points" label="Leaderboards" onPress={() => go("/leaderboards")} />
        <QuickLink icon={Award} tint="insight" label="Badges" onPress={() => go("/badges")} />
        <QuickLink icon={CalendarRange} tint="sleep" label="Programs" badge onPress={() => go("/programs")} />
      </View>

      <SegmentedControl<ChallengeTab>
        options={[
          { value: "available", label: label("available", "Available") },
          { value: "active", label: label("active", "Active") },
          { value: "completed", label: label("completed", "Done") },
        ]}
        value={tab}
        onChange={setTab}
        accessibilityLabel="Challenge status"
      />
      <ChipScroller<TypeFilter>
        accessibilityLabel="Challenge type"
        value={type}
        onChange={setType}
        options={TYPES.map((t) => ({ value: t, label: t === "all" ? "All types" : CHALLENGE_TYPE_LABEL[t as ChallengeType] }))}
      />

      {q.error && !q.data ? (
        <ErrorState title="Couldn't load challenges." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : !q.data ? (
        <SkeletonList count={3} height={210} header={false} />
      ) : q.data.items.length === 0 ? (
        type !== "all" ? (
          <EmptyState icon={Trophy} title="No challenges of this type" description="Try another type or show all challenges." action={{ label: "Show all types", onPress: () => setType("all") }} />
        ) : tab === "available" ? (
          <EmptyState icon={Trophy} title="No challenges open right now – check back soon." description="New challenges from your company will appear here." action={{ label: "Join with a code", icon: KeyRound, onPress: () => setCodeOpen(true) }} />
        ) : tab === "active" ? (
          <EmptyState icon={Trophy} title="You haven't joined a challenge yet" description="Join one to compete with colleagues and earn bonus points." action={{ label: "See available challenges", onPress: () => setTab("available") }} />
        ) : (
          <EmptyState icon={Trophy} title="Your finished challenges will appear here." description="Complete a challenge to see your results and rewards." />
        )
      ) : (
        <View style={[styles.list, q.isFetching && q.isPlaceholderData && styles.dim]}>
          {q.data.items.map((c) => (
            <ChallengeCard key={c.id} c={c} href={tab === "completed" ? `/challenges/${c.id}/results` : `/challenges/${c.id}`} />
          ))}
        </View>
      )}

      <JoinCodeSheet open={codeOpen} onClose={() => setCodeOpen(false)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  quickRow: { flexDirection: "row", gap: 10 },
  quick: { flex: 1, alignItems: "flex-start", gap: 8, padding: 12, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, minHeight: 84 },
  quickBadge: { position: "absolute", top: 8, right: 8 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  list: { gap: 14 },
  dim: { opacity: 0.6 },
})
