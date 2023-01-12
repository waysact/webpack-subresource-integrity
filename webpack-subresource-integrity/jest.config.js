module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  coverageReporters: ["json"],
  automock: false,
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "test-utils",
    ".yarn/cache",
    ".pnp.cjs",
  ],
  rootDir: "src",
  testMatch: [
    "**/__tests__/**/*.[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)",
    "!**/__fixtures__/**",
    "!**/test-utils.[jt]s?(x)",
  ],
};
