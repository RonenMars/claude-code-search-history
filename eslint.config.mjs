import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tailwind from "eslint-plugin-tailwindcss";
import tailwindCanonical from "eslint-plugin-tailwind-canonical-classes";
import importX from "eslint-plugin-import-x";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "**/dist/",
      "**/out/",
      "**/node_modules/",
      "**/build/",
      "**/*.d.ts",
      "tailwind.config.js",
      "postcss.config.*",
      "electron.vite.config.ts",
      "vitest.config.ts",
      "playwright.config.ts",
    ],
  },

  // Base configs
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tailwind.configs["flat/recommended"],

  // Main config for all TS/TSX files
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "import-x": importX,
      unicorn,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.node,
      },
    },
    settings: {
      tailwindcss: {
        config: path.join(__dirname, "tailwind.config.js"),
        callees: ["cn", "clsx"],
      },
      "import-x/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: ["./tsconfig.json"],
        },
        node: true,
      },
    },
    rules: {
      // TypeScript
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/member-ordering": [
        "warn",
        {
          default: ["signature", "field", "constructor", "method"],
        },
      ],

      // React hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // React refresh (Vite HMR)
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // React best practices (without the plugin's recommended config to avoid JSX runtime issues)
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // Import ordering
      "import-x/order": [
        "warn",
        {
          groups: [
            ["builtin", "external"],
            ["internal", "parent", "sibling", "index"],
          ],
          "newlines-between": "never",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "import-x/no-duplicates": "error",
      "import-x/first": "error",

      // Unicorn
      "unicorn/filename-case": [
        "error",
        {
          cases: {
            camelCase: true,
            pascalCase: true,
            kebabCase: true,
          },
        },
      ],
      "unicorn/no-array-for-each": "warn",
      "unicorn/prefer-node-protocol": "error",
      "unicorn/no-useless-undefined": "warn",
      "unicorn/prefer-ternary": "off",

      // Tailwind
      "tailwindcss/no-custom-classname": "off",
      "tailwindcss/classnames-order": "warn",
      "tailwindcss/no-unnecessary-arbitrary-value": "error",

      // General
      "no-throw-literal": "warn",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "warn",
      "prefer-template": "warn",
    },
  },

  // Renderer-specific: browser globals + canonical Tailwind classes
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    plugins: {
      "tailwind-canonical-classes": tailwindCanonical,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      "tailwind-canonical-classes/tailwind-canonical-classes": [
        "warn",
        {
          cssPath: "./src/renderer/src/styles/globals.css",
          calleeFunctions: ["cn", "clsx"],
        },
      ],
    },
  },

  // Test files: relaxed rules
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
      "unicorn/filename-case": "off",
      "unicorn/no-useless-undefined": "off",
    },
  },
);
