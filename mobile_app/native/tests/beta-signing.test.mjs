import assert from 'node:assert/strict'
import test from 'node:test'
import plugin from '../plugins/with-beta-release.cjs'

const android = { package: 'vn.exe.boardgame.nativeapp', versionCode: 2 }
const template = `android {
    defaultConfig {
        applicationId 'vn.exe.boardgame.nativeapp'
        versionCode 2
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Template signing is intentionally replaced only for Beta.
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}`

test('Beta prebuild removes only release debug signing, preserving identity and debug builds', () => {
  const result = plugin.unsignedRelease(template, android)
  assert.equal(result, template.replace('release {\n            // Template signing is intentionally replaced only for Beta.\n            signingConfig signingConfigs.debug', 'release {\n            // Template signing is intentionally replaced only for Beta.\n            signingConfig null'))
  assert.equal(plugin.unsignedRelease(result, android), result)
})
test('unknown release signing and malformed Gradle fail closed', () => {
  assert.throws(() => plugin.unsignedRelease(template.replaceAll('signingConfigs.debug', 'signingConfigs.production'), android), /not the template/)
  assert.throws(() => plugin.unsignedRelease(template + '\n        release {\n        }', android), /Unrecognized/)
})
test('wrong package and stale generated version fail before touching signing', () => {
  assert.throws(() => plugin.unsignedRelease(template, { ...android, versionCode: 1 }), /versionCode/)
  assert.throws(() => plugin.unsignedRelease(template.replace('versionCode 2', 'versionCode 1'), android), /does not match/)
  assert.throws(() => plugin.unsignedRelease(template, { ...android, package: 'another.app' }), /EXE package/)
})
test('ordinary prebuild leaves the existing non-Beta signing path unchanged', () => {
  const previous = process.env.EXE_ANDROID_BETA
  try {
    delete process.env.EXE_ANDROID_BETA
    const config = { android }
    assert.equal(plugin(config), config)
  } finally {
    if (previous === undefined) delete process.env.EXE_ANDROID_BETA
    else process.env.EXE_ANDROID_BETA = previous
  }
})
