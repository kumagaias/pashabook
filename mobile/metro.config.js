const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add font file extensions for web
config.resolver.assetExts.push('ttf', 'otf', 'woff', 'woff2');

module.exports = config;
