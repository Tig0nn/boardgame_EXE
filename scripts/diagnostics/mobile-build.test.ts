import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from '../../mobile_app/node_modules/vite/dist/node/index.js'

test('Mobile production bundle shares one React instance across root and Mobile components', async () => {
  let inspected = false
  await build({
    root: fileURLToPath(new URL('../../mobile_app', import.meta.url)),
    logLevel: 'silent',
    build: { write: false },
    plugins: [{
      name: 'verify-shared-react-instance',
      generateBundle() {
        const roots = new Set([...this.getModuleIds()]
          .map(id => id.replaceAll('\\', '/'))
          .filter(id => /\/node_modules\/react\/(?:index\.js|cjs\/react\.production\.js)$/.test(id))
          .map(id => id.slice(0, id.indexOf('/node_modules/react/') + '/node_modules/react'.length)))
        assert.equal(roots.size, 1, `Multiple React instances break shared hooks: ${[...roots].join(', ')}`)
        inspected = true
      },
    }],
  })
  assert.ok(inspected, 'Production bundle must be inspected')
})
