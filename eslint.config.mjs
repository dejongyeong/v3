import { FlatCompat } from "@eslint/eslintrc";
import jestDom from "eslint-plugin-jest-dom";
import jsxA11y from "eslint-plugin-jsx-a11y";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import testingLibrary from "eslint-plugin-testing-library";

const compat = new FlatCompat({
  // import.meta.dirname is available after node.js v20.11.0
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.config(
    {
      extends: ["next/core-web-vitals", "next/typescript"],
      plugins: ["unused-imports", "simple-import-sort"],
      rules: {
        semi: "error",
        quotes: ["error", "double"],
        "prettier/prettier": ["error", { endOfLine: "auto" }],
        "@typescript-eslint/no-unused-vars": "off",
        "unused-imports/no-unused-imports": "error",
        "unused-imports/no-unused-vars": [
          "warn",
          {
            vars: "all",
            args: "after-used",
            varsIgnorePattern: "^_",
            argsIgnorePattern: "^_",
          },
        ],
        "simple-import-sort/imports": "error",
        "simple-import-sort/exports": "error",
      },
    },
    jsxA11y.flatConfigs.recommended,
    reactHooks.configs["recommended-latest"],
    reactRefresh.configs.recommended,
    {
      files: ["*.test.ts", "*.test.tsx"],
      ...testingLibrary.configs["flat/react"],
      ...jestDom.configs["flat/recommended"],
    },
  ),

  {
    ignores: [
      "next.config.js",
      "node_modules",
      ".next",
      "out",
      "public",
      "build",
      "coverage",
    ],
  },
  eslintPluginPrettierRecommended,
];

export default eslintConfig;
