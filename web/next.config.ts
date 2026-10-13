import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  devIndicators: false,
  // Screens load their data in the browser (sample data or the HealthX API),
  // so Cache Components / partial prerendering are not used.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
