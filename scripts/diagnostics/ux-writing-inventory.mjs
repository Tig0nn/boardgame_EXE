import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, resolve, relative } from 'node:path'
import ts from 'typescript'

const out = 'docs/playtests/b18-mobile-ux-writing', base = 'f0bb612a2aa9514c4fc2fcbf8d878b7bece3947f'
const walk = path => readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${path}/${e.name}`) : [`${path}/${e.name}`])
const files = new Set(walk('mobile_app/src').filter(p => /\.tsx$/.test(p)))
// Follow Mobile's imports into shared UI; omit engine/data literals from the
// presentation inventory because their IDs and stored narratives stay frozen.
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    if (!match[1].startsWith('.')) continue
    const target = resolve(dirname(file), match[1])
    for (const extension of ['.tsx', '.ts']) {
      const path = relative(process.cwd(), target + extension).replaceAll('\\', '/')
      if (/^(src\/(components|ai)|mobile_app\/src\/(components|game))\//.test(path) && existsSync(path)) files.add(path)
    }
  }
}
function literals(file, text) {
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true), rows = []
  function visit(node) {
    const kind = ts.isJsxText(node) ? 'jsx-text' : ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? 'literal'
      : ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) ? 'template-fragment' : null
    if (kind) {
      const value = (ts.isJsxText(node) ? node.getText(tree) : node.text).trim()
      if (value.length > 1) rows.push({ kind, line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1, value })
    }
    ts.forEachChild(node, visit)
  }
  visit(tree); return rows
}
const inventory = [], changes = []
for (const file of [...files].sort()) {
  const rows = literals(file, readFileSync(file, 'utf8'))
  inventory.push({ file, literals: rows })
  let old
  try { old = literals(file, execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) } catch { old = [] }
  const before = new Set(old.map(r => r.value)), after = new Set(rows.map(r => r.value))
  const removed = old.filter(r => !after.has(r.value)), added = rows.filter(r => !before.has(r.value))
  if (removed.length || added.length) changes.push({ file, removed, added })
}
writeFileSync(`${out}/literal-inventory.json`, JSON.stringify({ files: inventory.length,
  note: 'JSX text and literal inventory for Mobile and its imported shared UI. Includes class names, technical props and examples; not every code literal is visible. Contextual financial review is in the audit/report.', inventory }, null, 2) + '\n')
writeFileSync(`${out}/changed-display-strings.json`, JSON.stringify({ base, changes }, null, 2) + '\n')
console.log(JSON.stringify({ uiFilesScanned: inventory.length, changedUiFiles: changes.length }))
