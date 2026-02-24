const path = require('path');

// Path to root node_modules in monorepo
const rootNodeModules = path.resolve(__dirname, '../../node_modules');

module.exports = {
  project: {
    ios: {
      sourceDir: './ios',
    },
    android: {
      sourceDir: './android',
    },
  },
  dependencies: {
    'react-native-fs': {
      root: path.join(rootNodeModules, 'react-native-fs'),
    },
    'react-native-file-viewer': {
      root: path.join(rootNodeModules, 'react-native-file-viewer'),
    },
    '@react-native-async-storage/async-storage': {
      root: path.join(rootNodeModules, '@react-native-async-storage/async-storage'),
    },
    '@react-native-community/netinfo': {
      root: path.join(rootNodeModules, '@react-native-community/netinfo'),
    },
    'react-native-safe-area-context': {
      root: path.join(rootNodeModules, 'react-native-safe-area-context'),
    },
    'react-native-screens': {
      root: path.join(rootNodeModules, 'react-native-screens'),
    },
  },
};
