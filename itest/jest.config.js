const jestConfig = require("@coremedia-internal/ckeditor5-jest-test-helpers/shared-jest.config.js");

module.exports = {
  ...jestConfig,
  // The default timeout is 5000. This may be not enough for Jest Playwright
  // tests. If the test fails due to test-timeout, we will only get unspecific
  // failures `Exceeded timeout`.
  testTimeout: 30000,
  preset: "jest-playwright-preset",
  testEnvironment: "./playwright.environment.js",
  setupFilesAfterEnv: ["expect-playwright"],
  // We still have to use Jest 27 in this module, affected by https://github.com/facebook/jest/issues/9771
  resolver: require.resolve("./jest-9771-workaround-resolve.js"),
};
