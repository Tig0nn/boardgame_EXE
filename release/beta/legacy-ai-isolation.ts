import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { normalizePath } from 'vite'
import type { Plugin } from 'vite'

const canonicalId = (value: string) => normalizePath(value).toLowerCase()
const target = canonicalId(fileURLToPath(new URL('../../mobile_app/src/components/GameResultModal.tsx', import.meta.url)))
const forbidden = ['../../src/ai/AICoachPanel.tsx', '../../src/ai/server/handler.ts', '../../api/ai-coach.ts']
  .map(file => canonicalId(fileURLToPath(new URL(file, import.meta.url))))

function refuseLegacyCoach(req: IncomingMessage, res: ServerResponse, next: () => void) {
  let pathname: string
  try { pathname = decodeURIComponent((req.url ?? '').split('?')[0]) } catch { next(); return }
  if (!/^\/api\/ai-coach(?:\/|$)/i.test(pathname)) { next(); return }
  res.statusCode = 404
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error: 'Legacy AI Coach is not available in this isolated Beta.' }))
}

/** Only installed by the isolated Beta config. Original UI/server files and ordinary builds are untouched. */
export function legacyAiIsolation(): Plugin {
  return {
    name: 'exe-beta-legacy-ai-isolation',
    enforce: 'pre',
    configureServer(server) { server.middlewares.use(refuseLegacyCoach) },
    configurePreviewServer(server) { server.middlewares.use(refuseLegacyCoach) },
    transform(code, id) {
      const filename = canonicalId(id.split('?')[0])
      if (forbidden.includes(filename)) this.error('Legacy AI module entered the isolated Beta graph: ' + filename)
      if (filename !== target) return null
      const source = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      const imports: ts.ImportDeclaration[] = [], accordions: ts.JsxElement[] = []
      let panels = 0
      const isPanel = (node: ts.Node) => ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'AICoachPanel'
      const containsPanel = (node: ts.Node): boolean => isPanel(node) || ts.forEachChild(node, child => containsPanel(child) || undefined) === true
      const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && /\/ai\/AICoachPanel(?:\.tsx)?$/.test(node.moduleSpecifier.text)) imports.push(node)
        if (isPanel(node)) panels++
        if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'details' && containsPanel(node)) accordions.push(node)
        ts.forEachChild(node, visit)
      }
      visit(source)
      if (imports.length !== 1 || panels !== 1 || accordions.length !== 1) {
        this.error('Beta legacy isolation refused: expected one Coach import/panel/accordion; review upstream UI structure.')
      }
      const removals = [imports[0], accordions[0]].map(node => ({ start: node.getStart(source), end: node.end })).sort((a, b) => b.start - a.start)
      let result = code
      for (const range of removals) result = result.slice(0, range.start) + result.slice(range.end)
      return { code: result, map: null }
    },
  }
}
