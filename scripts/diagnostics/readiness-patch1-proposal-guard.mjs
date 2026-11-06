// Test-data closure check, not an operating-system security boundary.
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const realRead = fs.readFileSync.bind(fs)
const qa = resolve('docs/qa') + sep
const allowed = new Set(realRead('docs/qa/release-readiness-patch1/commit-files.txt', 'utf8').trim().split(/\r?\n/).map(f => resolve(f)))
fs.readFileSync = (file, ...args) => {
  const name = file instanceof URL ? fileURLToPath(file) : typeof file === 'string' ? file : null
  if (name && resolve(name).startsWith(qa) && !allowed.has(resolve(name))) throw Error('Regression read an excluded QA artifact: ' + resolve(name).slice(qa.length))
  return realRead(file, ...args)
}
syncBuiltinESMExports()
