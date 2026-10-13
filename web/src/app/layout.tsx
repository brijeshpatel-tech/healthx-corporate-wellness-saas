import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter, Plus_Jakarta_Sans } from "next/font/google"
import { Providers } from "@/components/providers"
import "./globals.css"

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] })
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["500", "600", "700", "800"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: "HealthX Business", template: "%s · HealthX Business" },
  description: "Corporate wellness platform — employee app, business portal and platform admin.",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1117" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jakarta.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
