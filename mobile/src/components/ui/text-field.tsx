import { Eye, EyeOff, type LucideIcon } from "lucide-react-native"
import { useState, type ReactNode, type Ref } from "react"
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native"
import { useTheme } from "@/theme/theme"
import { FONTS, RADIUS } from "@/theme/tokens"
import { Text } from "./text"

export interface TextFieldProps extends Omit<TextInputProps, "style"> {
  label?: string
  /** Inline validation message (shown in red under the field). */
  error?: string
  /** Helper text under the field when there is no error. */
  hint?: string
  /** Lucide icon inside the field, on the left. */
  icon?: LucideIcon
  /** Password field with a show / hide toggle. */
  secure?: boolean
  /** Text or element at the right edge (e.g. a unit "cm"). */
  right?: ReactNode
  containerStyle?: StyleProp<ViewStyle>
  ref?: Ref<TextInput>
}

/** Labelled text input with error, hint, icon and password visibility toggle. */
export function TextField({ label, error, hint, icon: Icon, secure, right, containerStyle, ref, editable = true, ...input }: TextFieldProps) {
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(true)
  const borderColor = error ? colors.destructive : focused ? colors.ring : colors.input

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text variant="label" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          { borderColor, backgroundColor: editable ? colors.card : colors.muted },
          focused && { borderWidth: 1.5 },
        ]}
      >
        {Icon ? <Icon size={18} color={colors.mutedForeground} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.mutedForeground}
          selectionColor={colors.primary}
          secureTextEntry={secure && hidden}
          editable={editable}
          accessibilityLabel={label}
          {...input}
          onFocus={(e) => {
            setFocused(true)
            input.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            input.onBlur?.(e)
          }}
          style={[styles.input, { color: colors.foreground }]}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            hitSlop={10}
            onPress={() => setHidden((h) => !h)}
          >
            {hidden ? <Eye size={18} color={colors.mutedForeground} /> : <EyeOff size={18} color={colors.mutedForeground} />}
          </Pressable>
        ) : null}
        {typeof right === "string" ? (
          <Text variant="caption" tone="muted">
            {right}
          </Text>
        ) : (
          right
        )}
      </View>
      {error ? (
        <Text variant="caption" tone="destructive" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { marginLeft: 2 },
  field: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, fontFamily: FONTS.regular, fontSize: 16, paddingVertical: 12, minHeight: 48, outlineWidth: 0 },
})
