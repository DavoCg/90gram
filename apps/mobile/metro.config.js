// Metro config wrapped with Uniwind (build-time Tailwind v4 compile). There is NO
// tailwind.config.js; tokens and themes live in global.css. See the mobile skill.
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-env.d.ts',
});
