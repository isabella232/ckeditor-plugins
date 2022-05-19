/*
 * This is a workaround for https://github.com/facebook/jest/issues/9771.
 *
 * The workaround is required for Jest up to version 27. Unfortunately,
 * Jest Playwright does not support Jest 28 yet:
 * https://github.com/playwright-community/jest-playwright/issues/796
 *
 * The workaround is a copy of
 * https://www.npmjs.com/package/enhanced-resolve-jest.
 * Instead of using the raw JS, we used TypeScript Playground to get some
 * better readable alternative. And: We also applied a minor adaption for
 * better error-reporting.
 *
 * Note, that the suggested "dependency" driven solution as proposed by
 * `enhanced-resolve-jest` did not work, so that we had to copy the sources.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const enhanced_resolve = require("enhanced-resolve");
const { ResolverFactory, CachedInputFileSystem } = enhanced_resolve;
const EMPTY_FILE = require.resolve("./empty");
const cachedInputFileSystem = new CachedInputFileSystem(fs, 60000);
let queuedPurge = false;
exports.default = module.exports = exports = create(getDefaultConfig);

const ignoredModuleFailures = [
  // For some reason this is tried to be resolved and fails. Ignoring
  // for now. We may get rid of the failure as soon as we can use
  // Jest 28 (which would also make this workaround file
  // obsolete).
  "jest-runner-jest-playwright-preset/runner.js",
];
const ignoredModulePatterns = [
  // For some reason cannot be resolved. Ignoring for now, unless we
  // feel there is an issue with that.
  "jest-sequencer",
];

function create(getConfig /* (opts: getConfigOpts) => ResolverOpts */) {
  const resolverCache /* { [x: string]: Resolver } */ = Object.create(null);
  return (modulePath /* string */, jestOpts /* JestResolveOpts */) => {
    if (!queuedPurge) {
      queuedPurge = true;
      setImmediate(() => {
        cachedInputFileSystem.purge();
        queuedPurge = false;
      });
    }
    const configOpts = {
      browser: jestOpts.browser,
      extensions: jestOpts.extensions,
      moduleDirectory: jestOpts.moduleDirectory,
    };
    const userConfig = getConfig(configOpts);
    const cacheKey = `${configOpts.browser}\0${jestOpts.extensions}\0${configOpts.moduleDirectory}`;
    const resolver =
      resolverCache[cacheKey] ||
      (resolverCache[cacheKey] = ResolverFactory.createResolver(
        Object.assign(Object.assign({ fileSystem: cachedInputFileSystem }, userConfig), {
          useSyncFileSystemCalls: true,
        })
      ));

    let resolved;
    try {
      resolved = resolver.resolveSync({}, jestOpts.basedir, modulePath);
    } catch (e) {
      const doReport = !(
        ignoredModuleFailures.includes(modulePath) || ignoredModulePatterns.some((p) => modulePath.includes(p))
      );
      if (doReport) {
        console.warn(`Failed to resolve with error: '${modulePath}'`, e);
      }
      // Patch customization: Provide more details on failure.
      throw e;
    }
    if (resolved === false) {
      return EMPTY_FILE;
    }
    return resolved;
  };
}
exports.create = create;

function getDefaultConfig(opts) {
  return Object.assign(
    { symlinks: true, extensions: opts.extensions, modules: opts.moduleDirectory, fileSystem: fs },
    opts.browser
      ? {
          aliasFields: ["browser"],
          mainFields: ["browser", "main"],
        }
      : {}
  );
}
exports.getDefaultConfig = getDefaultConfig;
