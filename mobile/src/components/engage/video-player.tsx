/**
 * Demo video player for wellness videos: cover art, play / pause, tap-to-seek progress and captions from the
 * video's script. Shows "Video can't play right now." when the item has no playable source.
 * (Swap for expo-video when real media URLs are available.)
 */
import { CirclePlay, Pause, Play, RotateCcw, Subtitles } from "lucide-react-native"
import { useEffect, useState } from "react"
import { Pressable, StyleSheet, View, type GestureResponderEvent } from "react-native"
import { Text } from "@/components/ui"
import { haptic } from "@/lib/haptics"
import { RADIUS } from "@/theme/tokens"
import { alpha, GradientCard } from "./shared"

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`

export function VideoPlayer({ title, emoji, color, durationSec, url, captions }: { title: string; emoji: string; color: string; durationSec: number; url?: string; captions: string[] }) {
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [cc, setCc] = useState(true)
  const [barWidth, setBarWidth] = useState(0)
  const playable = !!url
  const ended = time >= durationSec
  const isPlaying = playing && !ended && playable

  useEffect(() => {
    if (!isPlaying) return
    const t = setInterval(() => setTime((s) => Math.min(durationSec, s + 1)), 1000)
    return () => clearInterval(t)
  }, [isPlaying, durationSec])

  const toggle = () => {
    if (!playable) return
    haptic.tap()
    if (ended) {
      setTime(0)
      setPlaying(true)
      return
    }
    setPlaying((p) => !p)
  }
  const seek = (e: GestureResponderEvent) => {
    if (!playable || !barWidth) return
    const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / barWidth))
    setTime(Math.round(ratio * durationSec))
  }
  const caption = captions.length ? captions[Math.min(captions.length - 1, Math.floor((time / Math.max(1, durationSec)) * captions.length))] : null
  const Icon = ended ? RotateCcw : isPlaying ? Pause : Play

  return (
    <GradientCard colors={[color, alpha(color, 0.6), "#0f172a"]} padding={0}>
      <Pressable accessibilityRole="button" accessibilityLabel={playable ? (isPlaying ? `Pause ${title}` : `Play ${title}`) : "Video can't play right now."} onPress={toggle} style={styles.stage}>
        <Text style={styles.emoji}>{emoji}</Text>
        {!isPlaying ? (
          <View style={styles.bigPlay}>
            {playable ? <CirclePlay size={60} color="#ffffff" strokeWidth={1.6} /> : null}
            {!playable ? (
              <View style={styles.unavailable}>
                <Text variant="label" color="#ffffff">
                  Video can&apos;t play right now.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {cc && caption && time > 0 ? (
          <View style={styles.caption}>
            <Text variant="caption" color="#ffffff" align="center" numberOfLines={3}>
              {caption}
            </Text>
          </View>
        ) : null}
      </Pressable>
      <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel={isPlaying ? "Pause" : ended ? "Replay" : "Play"} disabled={!playable} onPress={toggle} hitSlop={8} style={styles.ctrlBtn}>
          <Icon size={20} color="#ffffff" fill={Icon === Play ? "#ffffff" : "transparent"} />
        </Pressable>
        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel="Seek"
          accessibilityValue={{ min: 0, max: durationSec, now: time }}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          onPress={seek}
          style={styles.barHit}
        >
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.min(100, (time / Math.max(1, durationSec)) * 100)}%` }]} />
          </View>
        </Pressable>
        <Text variant="small" color="#ffffff" style={styles.time}>
          {clock(time)} / {clock(durationSec)}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={cc ? "Hide captions" : "Show captions"} accessibilityState={{ selected: cc }} onPress={() => setCc((v) => !v)} hitSlop={8} style={[styles.ctrlBtn, cc && styles.ccOn]}>
          <Subtitles size={18} color="#ffffff" />
        </Pressable>
      </View>
    </GradientCard>
  )
}

const styles = StyleSheet.create({
  stage: { height: 210, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 84, lineHeight: 100, opacity: 0.9 },
  bigPlay: { position: "absolute", alignItems: "center", justifyContent: "center" },
  unavailable: { backgroundColor: "rgba(0,0,0,0.45)", borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8 },
  caption: { position: "absolute", left: 14, right: 14, bottom: 10, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6 },
  controls: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "rgba(0,0,0,0.28)" },
  ctrlBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  ccOn: { backgroundColor: "rgba(255,255,255,0.18)" },
  barHit: { flex: 1, height: 36, justifyContent: "center" },
  bar: { height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)", overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: "#ffffff" },
  time: { fontVariant: ["tabular-nums"] },
})
