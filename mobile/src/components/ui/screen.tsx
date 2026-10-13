import { router } from "expo-router"
import { ChevronLeft } from "lucide-react-native"
import type { ReactNode } from "react"
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/theme/theme"
import { IconButton } from "./button"
import { Text } from "./text"

/** Max content width on tablets / web so lines stay readable. */
export const CONTENT_MAX_WIDTH = 640

export interface ScreenHeaderProps {
  title?: string
  subtitle?: string
  /** Show a back button. A function overrides the default (go back, or `backHref`). */
  back?: boolean | (() => void)
  /** Where "back" goes when there is no history (deep link / web reload). Default /home. */
  backHref?: string
  /** Large left-aligned title (tab roots) instead of the compact centered one. */
  large?: boolean
  right?: ReactNode
}

export function goBack(fallback = "/home") {
  if (router.canGoBack()) router.back()
  else router.replace(fallback as never)
}

/** Top bar: back button, title and actions. */
export function ScreenHeader({ title, subtitle, back, backHref, large, right }: ScreenHeaderProps) {
  const onBack = typeof back === "function" ? back : () => goBack(backHref)
  if (large) {
    return (
      <View style={styles.largeHeader}>
        <View style={styles.flex}>
          {subtitle ? (
            <Text variant="caption" tone="muted">
              {subtitle}
            </Text>
          ) : null}
          {title ? (
            <Text variant="title" accessibilityRole="header">
              {title}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.actions}>{right}</View> : null}
      </View>
    )
  }
  const inset = right ? 108 : 64
  return (
    <View style={styles.header}>
      <View style={[styles.titleWrap, { left: inset, right: inset }]} pointerEvents="none">
        {title ? (
          <Text variant="subtitle" numberOfLines={1} accessibilityRole="header" align="center">
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="small" tone="muted" numberOfLines={1} align="center">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View>{back ? <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={onBack} variant="ghost" testID="back" /> : null}</View>
      <View style={styles.actions}>{right}</View>
    </View>
  )
}

export interface ScreenProps extends ScreenHeaderProps {
  children: ReactNode
  /** Scrollable content (default). Set false for screens that manage their own list. */
  scroll?: boolean
  /** Pull-to-refresh. */
  refreshing?: boolean
  onRefresh?: () => void
  /** Sticky area under the content (e.g. a Save button). Moves up with the keyboard. */
  footer?: ReactNode
  /** Tab roots: the tab bar handles the bottom safe area. */
  inTabs?: boolean
  /** Hide the header entirely (custom hero screens). */
  noHeader?: boolean
  contentStyle?: StyleProp<ViewStyle>
  /** Background behind everything (e.g. a gradient element), rendered under the content. */
  background?: ReactNode
  testID?: string
}

/**
 * Standard screen: safe area, header, scroll view with pull-to-refresh, keyboard
 * avoidance and an optional sticky footer. Content is padded 16 dp and capped at 640 dp wide.
 */
export function Screen({ children, scroll = true, refreshing = false, onRefresh, footer, inTabs, noHeader, contentStyle, background, testID, ...header }: ScreenProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const showHeader = !noHeader && (header.title || header.back || header.right || header.large)
  const bottomPad = footer ? 16 : inTabs ? 24 : Math.max(insets.bottom, 16) + 16

  const body = (
    <View style={[styles.content, contentStyle, { paddingBottom: bottomPad }]}>{children}</View>
  )

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]} testID={testID}>
      {background}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={{ paddingTop: insets.top }}>
          {showHeader ? (
            <View style={styles.constrain}>
              <ScreenHeader {...header} />
            </View>
          ) : null}
        </View>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.card} /> : undefined}
          >
            {body}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.scrollContent]}>{body}</View>
        )}
        {footer ? (
          <View style={[styles.footer, { paddingBottom: inTabs ? 12 : Math.max(insets.bottom, 12), backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <View style={styles.constrainInner}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  constrain: { width: "100%", maxWidth: CONTENT_MAX_WIDTH + 16, alignSelf: "center" },
  constrainInner: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center", gap: 10 },
  scrollContent: { flexGrow: 1 },
  content: { flexGrow: 1, width: "100%", maxWidth: CONTENT_MAX_WIDTH + 32, alignSelf: "center", paddingHorizontal: 16, paddingTop: 8, gap: 16 },
  header: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  titleWrap: { position: "absolute", top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  largeHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, minHeight: 60 },
  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
})
