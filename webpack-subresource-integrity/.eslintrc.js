module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "prettier", "jest"],
  env: {
    node: true,
    "jest/globals": true,
  },
  extends: [
    "eslint:recommended",
    "prettier",
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    "no-var": "error",
    semi: "error",
    "no-multi-spaces": "error",
    "space-in-parens": "error",
    "no-multiple-empty-lines": "error",
    "prefer-const": "error",
    "no-use-before-define": "error",
    "no-undef": "warn",
    "no-param-reassign": "error",
    "no-console": "error",
    "prettier/prettier": [
      "error",
      {
        parser: "typescript",
      },
    ],
  },
};
