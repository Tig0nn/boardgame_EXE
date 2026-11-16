const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')
const config = getDefaultConfig(__dirname)
config.watchFolders = [path.resolve(__dirname, '../..')]
config.resolver.assetExts.push('glb', 'PNG')
// Fiber patches Three loaders on native. Resolve both imports and requires to the same
// ESM instance, which also avoids the CommonJS entry point's Node-only process warning.
const three = path.join(__dirname, 'node_modules/three/build/three.module.js')
config.resolver.resolveRequest = (context, name, platform) =>
  context.resolveRequest(context, name === 'three' ? three : name, platform)
module.exports = config
