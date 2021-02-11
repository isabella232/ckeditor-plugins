const babelConfig = require("./shared-babel.config.js");

module.exports = {
  testEnvironment: 'jsdom',
  moduleFileExtensions: ["js", "ts", "d.ts"],
  transform: {
    "^.+\\.[jt]sx?$": ["babel-jest", babelConfig],
  },
  transformIgnorePatterns: [
    "node_modules/(?!@ckeditor|lodash-es)"
  ],
};
