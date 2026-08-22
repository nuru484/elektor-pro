// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import perfectionist from "eslint-plugin-perfectionist";

export default tseslint.config(
  {
    ignores: ["**/*.js", "generated/**", "build/**", "dist/**"],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  perfectionist.configs["recommended-natural"],
  {
    rules: {
      // Underscore-prefixed names are an intentional "unused" marker.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // Interpolating numbers into strings is safe and idiomatic (ports,
      // counts, percentages); only genuinely lossy types stay forbidden.
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
    },
  },
  {
    // Test scaffolding may assert non-null on fixtures it just created.
    files: ["test/**", "*.config.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
);
