import { useEffect, useState, type ReactNode } from "react"
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import Svg, { Circle } from "react-native-svg"
import { useTheme } from "@/theme/theme"

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** Animates 0 → value whenever the value changes. */
function useAnimatedValue(target: number, duration = 700) {
  const [anim] = useState(() => new Animated.Value(0))
  useEffect(() => {
    Animated.timing(anim, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }, [anim, target, duration])
  return anim
}

export interface ProgressRingProps {
  value: number
  max?: number
  size?: number
  stroke?: number
  color?: string
  trackColor?: string
  children?: ReactNode
  accessibilityLabel?: string
}

/** Circular progress (SVG) with content in the middle. Animates when the value changes. */
export function ProgressRing({ value, max = 100, size = 120, stroke = 10, color, trackColor, children, accessibilityLabel }: ProgressRingProps) {
  const { colors } = useTheme()
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const anim = useAnimatedValue(ratio)
  const dashOffset = anim.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] })

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
    >
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor ?? colors.muted} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color ?? colors.primary}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  )
}

export interface ProgressBarProps {
  value: number
  max?: number
  color?: string
  trackColor?: string
  height?: number
  style?: StyleProp<ViewStyle>
}

/** Horizontal progress bar. */
export function ProgressBar({ value, max = 100, color, trackColor, height = 8, style }: ProgressBarProps) {
  const { colors } = useTheme()
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const anim = useAnimatedValue(ratio, 600)
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })
  return (
    <View
      style={[{ height, borderRadius: height / 2, backgroundColor: trackColor ?? colors.muted, overflow: "hidden" }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
    >
      <Animated.View style={{ width, height: "100%", borderRadius: height / 2, backgroundColor: color ?? colors.primary }} />
    </View>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
})
