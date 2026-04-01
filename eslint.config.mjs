import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import requireJsdocPlugin from "./eslint/rules/require-jsdoc-plugin.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts"],
    rules: {
      "no-unused-vars": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSAnyKeyword",
          message: "Avoid `any`. Use a specific type instead.",
        },
        {
          selector: "TSUnknownKeyword",
          message: "Avoid `unknown`. Use a specific type instead.",
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["db/**/*.ts", "lib/**/*.ts"],
    plugins: {
      jsdoclocal: requireJsdocPlugin,
    },
    rules: {
      "jsdoclocal/require-jsdoc": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
