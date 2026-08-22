import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "app/progress/page.tsx",
      "app/settings/page.tsx",
      "app/today/page.tsx",
    ],
    rules: {
      // These pages intentionally fetch authenticated Supabase data on mount.
      // The React rule flags the synchronous loading-state transition inside
      // the fetch helper even though the actual data synchronization is async.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["app/tasks/TasksClient.tsx"],
    rules: {
      // The temporary optimistic id is created inside a submit event handler;
      // React's purity rule is overly broad for Date.now used in that handler.
      "react-hooks/purity": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
