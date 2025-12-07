module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // ONLY include reanimated — it handles worklets automatically
      'react-native-reanimated/plugin', // ← must be LAST
    ],
  };
};