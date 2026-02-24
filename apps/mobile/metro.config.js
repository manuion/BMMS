const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// Root of the monorepo
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [monorepoRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
    // Block duplicate React copies from being bundled
    blockList: [
      /node_modules\/.*\/node_modules\/react\//,
    ],
    // Force resolution to single React instance
    extraNodeModules: {
      'react': path.resolve(monorepoRoot, 'node_modules/react'),
      'react-native': path.resolve(monorepoRoot, 'node_modules/react-native'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
