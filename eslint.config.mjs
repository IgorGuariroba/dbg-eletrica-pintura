import next from "eslint-config-next";

export default [
  ...next,
  {
    files: ["*.{js,mjs,cjs,ts}", "*.config.{js,mjs,cjs,ts}"],
    rules: {
      "import/no-anonymous-default-export": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      "drizzle/**",
    ],
  },
];
