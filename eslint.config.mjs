import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig([
  {
    ignores: ["**/node_modules/**", "**/dist/**", ".wrangler/**"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.node },
  },
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        ...config.languageOptions?.parserOptions,
        tsconfigRootDir,
      },
    },
  })),
  {
    files: ["packages/frontend/**/*.{js,jsx,ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      globals: globals.browser,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ["packages/backend/**/*.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        ...globals.node,
      },
    },
  },
]);
