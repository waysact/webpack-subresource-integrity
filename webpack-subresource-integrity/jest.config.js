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
};
