// Metro config wrapped with Uniwind (build-time Tailwind v4 compile). There is NO
// tailwind.config.js; tokens and themes live in global.css. See the mobile skill.
//
// This is a pnpm monorepo: Metro must watch the workspace root and resolve modules from
// both the app's and the hoisted root node_modules. Required for local dev AND EAS Build.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so changes in packages/* trigger reloads.
config.watchFolders = [workspaceRoot];
// Resolve from the app first, then the hoisted root node_modules (.npmrc node-linker=hoisted).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// The color system is split across CSS files imported by global.css; watch them so edits
// trigger a Uniwind recompile during dev.
const themeFiles = [
  path.resolve(projectRoot, 'base-colors.css'),
  path.resolve(projectRoot, 'semantic-colors.css'),
  path.resolve(projectRoot, 'alias-colors.css'),
];

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-env.d.ts',
  watchAdditionalFiles: themeFiles,
});
