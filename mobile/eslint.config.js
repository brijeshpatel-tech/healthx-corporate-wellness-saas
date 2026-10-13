// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config")
const expoConfig = require("eslint-config-expo/flat")

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "android/*", "ios/*", ".expo/*", "scripts/*"],
  },
  {
    // AUTO-SYNCED from web/ — fixes belong in web/, so don't fail the mobile lint on style there.
    files: ["src/lib/types.ts", "src/lib/format.ts", "src/lib/mock/seed/**", "src/lib/mock/series.ts", "src/lib/mock/defaults.ts", "src/lib/mock/demo-accounts.ts", "src/lib/mock/random.ts", "src/lib/api/auth.ts", "src/lib/api/employee/**"],
    rules: { "import/no-unused-modules": "off", "@typescript-eslint/no-unused-vars": "off", "import/namespace": "off", "import/first": "off" },
  },
])
