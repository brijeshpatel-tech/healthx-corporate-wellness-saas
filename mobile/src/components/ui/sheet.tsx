import type { ReactNode } from "react"
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"
import { Button } from "./button"
import { Text } from "./text"

export interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  /** Sticky buttons at the bottom of the sheet. */
  footer?: ReactNode
}

/** Bottom sheet (modal) for small forms and details. Tap outside or the system back button to close. */
export function BottomSheet({ open, onClose, title, description, children, footer }: BottomSheetProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <Pressable style={[styles.fill, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          {title ? (
            <View style={styles.header}>
              <Text variant="heading" accessibilityRole="header">
                {title}
              </Text>
              {description ? (
                <Text variant="caption" tone="muted">
                  {description}
                </Text>
              ) : null}
            </View>
          ) : null}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled" bounces={false}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Centered confirmation dialog for destructive or important actions (sign out, delete, reset). */
export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", destructive, loading, onConfirm, onCancel }: ConfirmDialogProps) {
  const { colors } = useTheme()
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={[styles.center, { backgroundColor: colors.overlay }]}>
        <View style={[styles.dialog, { backgroundColor: colors.card }]} accessibilityRole="alert">
          <Text variant="heading">{title}</Text>
          {message ? (
            <Text variant="body" tone="muted">
              {message}
            </Text>
          ) : null}
          <View style={styles.dialogActions}>
            <Button title={cancelLabel} variant="outline" size="md" onPress={onCancel} style={styles.flex} block />
            <Button title={confirmLabel} variant={destructive ? "destructive" : "primary"} size="md" loading={loading} onPress={onConfirm} style={styles.flex} block />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sheet: { borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, paddingTop: 8, maxHeight: "88%", width: "100%", maxWidth: 640, alignSelf: "center" },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 8 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, gap: 4 },
  body: { flexGrow: 0 },
  bodyContent: { padding: 20, gap: 16 },
  footer: { paddingHorizontal: 20, paddingTop: 4, gap: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  dialog: { width: "100%", maxWidth: 400, borderRadius: RADIUS.xl, padding: 22, gap: 10 },
  dialogActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  flex: { flex: 1 },
})
