/** SCR-M-021 Customise Home (Phase 2) — choose which cards appear on Home and in what order. Applies next time Home loads. */
import { RotateCcw } from "lucide-react-native"
import { useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { HomeLayoutEditor, HomePreview, type LayoutRow } from "@/components/track/home-layout-editor"
import { HeaderPhase } from "@/components/track/track-ui"
import { Button, Card, ConfirmDialog, ErrorState, goBack, Screen, Skeleton, Text } from "@/components/ui"
import { homeApi, type HomeLayout } from "@/lib/api/employee/home"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { RADIUS } from "@/theme/tokens"

const signature = (rows: LayoutRow[]) => rows.map((r) => `${r.key}${r.visible ? 1 : 0}`).join()

function Editor({ layout }: { layout: HomeLayout }) {
  const [rows, setRows] = useState<LayoutRow[]>(layout.cards)
  const [dragging, setDragging] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const save = useApiMutation(homeApi.saveLayout, { success: "Home layout updated.", errorTitle: "Couldn't save your layout.", onSuccess: () => goBack("/home") })
  const reset = useApiMutation(homeApi.resetLayout, {
    success: "Home layout reset to default",
    onSuccess: (l) => {
      setConfirmReset(false)
      setRows(l.cards)
    },
  })
  const dirty = signature(rows) !== signature(layout.cards)

  return (
    <Screen
      title="Customise Home"
      back
      backHref="/home"
      right={<HeaderPhase />}
      scroll={false}
      footer={
        <View style={styles.footer}>
          <Button title="Reset" icon={RotateCcw} variant="outline" size="md" block style={styles.flex} disabled={!layout.customised && !dirty} onPress={() => setConfirmReset(true)} testID="reset-layout" />
          <Button title="Save" size="md" block style={styles.flex} disabled={!dirty} loading={save.isPending} onPress={() => save.mutate({ cards: rows.map((r) => ({ key: r.key, visible: r.visible })) })} testID="save-layout" />
        </View>
      }
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} scrollEnabled={!dragging} showsVerticalScrollIndicator={false}>
        <Text variant="caption" tone="muted">
          Drag the handle (or use the arrows) to reorder. Turn a card off to hide it.
        </Text>
        <HomeLayoutEditor rows={rows} onChange={setRows} onDragChange={setDragging} />
        <Card>
          <View style={styles.preview}>
            <Text variant="subtitle">Preview</Text>
            <HomePreview rows={rows} />
            <Text variant="small" tone="muted" align="center">
              Changes apply next time you open Home.
            </Text>
          </View>
        </Card>
      </ScrollView>

      <ConfirmDialog
        open={confirmReset}
        title="Reset Home to the default layout?"
        message="All cards will be shown again in the standard order."
        confirmLabel="Reset"
        loading={reset.isPending}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => reset.mutate()}
      />
    </Screen>
  )
}

export default function CustomiseHomeScreen() {
  const q = useApiQuery(["employee", "home-layout"], () => homeApi.layout())
  if (q.data) return <Editor key={signature(q.data.cards)} layout={q.data} />
  return (
    <Screen title="Customise Home" back backHref="/home" right={<HeaderPhase />}>
      {q.error ? (
        <ErrorState title="Couldn't load your Home layout" error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        Array.from({ length: 7 }, (_, i) => <Skeleton key={i} height={68} radius={RADIUS.lg} />)
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { flexDirection: "row", gap: 10 },
  scroll: { flex: 1, marginHorizontal: -16, marginTop: -8 },
  content: { gap: 14, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  preview: { gap: 12 },
})
