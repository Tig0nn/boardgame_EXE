function unsignedRelease(contents, android) {
  if (android?.package !== 'vn.exe.boardgame.nativeapp' || !Number.isInteger(android.versionCode) || android.versionCode < 2) {
    throw new Error('Beta requires the EXE package and versionCode >= 2')
  }
  if (!contents.includes(`versionCode ${android.versionCode}`) || !contents.includes(`applicationId '${android.package}'`)) {
    throw new Error('Generated Android identity/version does not match app config')
  }
  const blocks = [...contents.matchAll(/^ {8}release \{[\s\S]*?^ {8}\}/gm)]
  if (blocks.length !== 1) throw new Error('Unrecognized release build type; refusing to change signing')
  const block = blocks[0][0]
  if (/^\s+signingConfig null\s*$/m.test(block)) return contents
  const references = [...block.matchAll(/^([ \t]+)signingConfig signingConfigs\.debug\s*$/gm)]
  if (references.length !== 1) throw new Error('Existing release signer is not the template debug signer')
  return contents.replace(block, block.replace(references[0][0], `${references[0][1]}signingConfig null`))
}

module.exports = function withBetaRelease(config) {
  if (process.env.EXE_ANDROID_BETA !== '1') return config
  const { withAppBuildGradle } = require('expo/config-plugins')
  return withAppBuildGradle(config, result => {
    if (result.modResults.language !== 'groovy') throw new Error('Unsupported Android Gradle format')
    result.modResults.contents = unsignedRelease(result.modResults.contents, config.android)
    return result
  })
}
module.exports.unsignedRelease = unsignedRelease
