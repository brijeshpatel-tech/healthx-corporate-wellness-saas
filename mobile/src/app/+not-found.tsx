/** Any link to a screen that isn't built yet lands here. */
import { usePathname } from "expo-router"
import { Construction } from "lucide-react-native"
import { ComingSoon } from "@/components/coming-soon"

export default function NotFoundScreen() {
  const pathname = usePathname()
  return <ComingSoon title="Not built yet" icon={Construction} spec={pathname} description="This part of HealthX is on its way. Head back and keep moving in the meantime!" />
}
