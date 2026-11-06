/** Deployment environment and build approval are separate from Vite optimization/mode. */
export function betaEnabled(development: boolean, _mode: string, vercelEnvironment: string | undefined, search: string, previewApproval?: string, hostname = 'localhost'): boolean {
  if (vercelEnvironment === 'production') return false
  const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)
  const local = development && loopback && (!vercelEnvironment || vercelEnvironment === 'development')
  const preview = vercelEnvironment === 'preview' && previewApproval === '1'
  return (local || preview) && new URLSearchParams(search).get('aiBeta') === '1'
}
