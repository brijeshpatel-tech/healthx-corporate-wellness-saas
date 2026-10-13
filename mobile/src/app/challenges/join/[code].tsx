/** #356 — join a challenge from a QR code, short code or shared link (healthx://challenges/join/CODE). */
import { router, useLocalSearchParams } from "expo-router"
import { ChartColumn, KeyRound, SearchX, Sparkles, UsersRound } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { ChallengeHero, JoinCodeSheet, PrizesCard, targetText } from "@/components/engage/challenge-ui"
import { go, TintPill } from "@/components/engage/shared"
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Screen, Skeleton, Text } from "@/components/ui"
import { challengesApi } from "@/lib/api/employee/challenges"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

export default function JoinByCodeScreen() {
  const { colors, tint } = useTheme()
  const { code: raw = "" } = useLocalSearchParams<{ code: string }>()
  const code = decodeURIComponent(raw).toUpperCase()
  const [retry, setRetry] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const lookup = useApiQuery(["employee", "challenge-code", code], () => challengesApi.resolveJoinCode({ code }), { retry: false, enabled: !!code })
  const challengeId = lookup.data?.challengeId
  const detail = useApiQuery(["employee", "challenge", challengeId], () => challengesApi.detail({ id: challengeId! }), { enabled: !!challengeId })
  const join = useApiMutation(challengesApi.join, {
    onSuccess: () => {
      setConfirm(false)
      haptic.success()
      toast.success("You've joined! Your progress starts counting now.")
      router.replace(`/challenges/${challengeId}` as never)
    },
    onError: () => setConfirm(false),
  })
  const c = detail.data
  const status = lookup.error?.status

  return (
    <Screen
      title="Join a challenge"
      back
      backHref="/challenges"
      footer={
        c ? (
          c.joined ? (
            <Button title="You've joined — view progress" icon={ChartColumn} onPress={() => go(`/challenges/${c.id}/progress`)} />
          ) : c.canJoin ? (
            <Button title="Join challenge" icon={Sparkles} loading={join.isPending} onPress={() => setConfirm(true)} testID="join-by-code" />
          ) : undefined
        ) : undefined
      }
    >
      {lookup.error ? (
        status === 404 || status === 422 || status === 403 ? (
          <EmptyState
            icon={SearchX}
            title={status === 403 ? "You're not eligible for this challenge." : "We couldn't find a challenge with that code."}
            description={status === 403 ? "It's open to a different department or team." : `Code “${code}” — check it and try again.`}
            action={{ label: "Enter another code", icon: KeyRound, onPress: () => setRetry(true) }}
          />
        ) : (
          <ErrorState title="Couldn't check this code." error={lookup.error} onRetry={() => lookup.refetch()} retrying={lookup.isFetching} />
        )
      ) : detail.error ? (
        <ErrorState title="Couldn't load this challenge." error={detail.error} onRetry={() => detail.refetch()} retrying={detail.isFetching} />
      ) : !c ? (
        <>
          <Skeleton height={200} radius={RADIUS.xxl} />
          <Skeleton height={160} radius={RADIUS.xl} />
        </>
      ) : (
        <>
          <View style={styles.found}>
            <KeyRound size={16} color={colors.primary} />
            <Text variant="caption" tone="muted">
              Code
            </Text>
            <TintPill label={code} color={tint("habits").fg} bg={tint("habits").bg} />
            <Text variant="caption" tone="muted">
              found
            </Text>
          </View>
          <ChallengeHero c={c} subtitle={`${formatDate(c.startDate, "d MMM")} – ${formatDate(c.endDate, "d MMM yyyy")}`} />
          <Card>
            <Text variant="body">{c.description}</Text>
            <View style={styles.meta}>
              <Text variant="label">{targetText(c)}</Text>
              <View style={styles.metaItem}>
                <UsersRound size={14} color={colors.mutedForeground} />
                <Text variant="caption" tone="muted">
                  {formatNumber(c.participantsCount)} joined
                </Text>
              </View>
              <Text variant="caption" tone="muted">
                +{c.points} points
              </Text>
            </View>
            {!c.joined && !c.canJoin ? (
              <View style={[styles.blocked, { backgroundColor: tint("points").bg }]}>
                <Text variant="caption" color={tint("points").fg}>
                  {c.joinBlockedReason}
                </Text>
              </View>
            ) : null}
            <Button title="See full details & rules" variant="ghost" size="md" onPress={() => go(`/challenges/${c.id}`)} style={styles.mt8} />
          </Card>
          {c.prizes ? <PrizesCard prizes={c.prizes} /> : null}
          <ConfirmDialog
            open={confirm}
            title={`Join ${c.name}?`}
            message="Your progress starts counting from today. Activity from before you join doesn't count."
            confirmLabel="Join challenge"
            loading={join.isPending}
            onCancel={() => setConfirm(false)}
            onConfirm={() => join.mutate({ id: c.id })}
          />
        </>
      )}
      <JoinCodeSheet open={retry} onClose={() => setRetry(false)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  found: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 14, rowGap: 6, marginTop: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  blocked: { borderRadius: RADIUS.md, padding: 10, marginTop: 12 },
  mt8: { marginTop: 8, alignSelf: "center" },
})
