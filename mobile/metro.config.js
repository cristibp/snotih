const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

try {
  require('./scripts/update-build-info');
} catch (e) {
  console.warn('Could not auto-update build info in metro.config.js:', e.message);
}

const config = getDefaultConfig(__dirname);

module.exports = config;
