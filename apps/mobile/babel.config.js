// Uniwind needs NO babel preset. We keep babel only for Expo Router (babel-preset-expo)
// and the Reanimated worklets plugin (required by react-native-worklets / Reanimated 4).
// The worklets plugin MUST be last.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
