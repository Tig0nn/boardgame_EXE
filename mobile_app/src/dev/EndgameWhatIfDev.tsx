import { InGameAiEntry } from '../components/endgame-what-if/InGameAiEntry'
import { useState } from 'react'
import type { ComponentProps } from 'react'
import App from '../App'
import { EndgameWhatIfEntry } from '../components/endgame-what-if/EndgameWhatIfEntry'
import type { EndgameAppBinding } from '../game/endgame-analysis-app-binding.ts'
import { ENDGAME_ANALYSIS_BETA } from '../game/endgame-analysis-feature.ts'
import { isEndgameDevQuery } from '../game/endgame-whatif-ui-controller.ts'

type Driver = NonNullable<NonNullable<ComponentProps<typeof App>>['endgameBeta']>

function createResultDriver(): Driver {
  let binding: EndgameAppBinding | null = null
  const listeners = new Set<() => void>()
  const registration = {
    getSnapshot: () => binding,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
  function setBinding(next: EndgameAppBinding | null) {
    binding = next
    listeners.forEach(listener => listener())
  }

  return {
    transport: 'S',
    connect(next) {
      setBinding(next)
      return () => { if (binding === next) setBinding(null) }
    },
    renderEndgameResultAction(watch) {
      return import.meta.env.DEV && new URLSearchParams(location.search).get('whatIfAi') === '1'
        ? <InGameAiEntry watch={watch} registration={registration} />
        : <EndgameWhatIfEntry watch={watch} registration={registration} />
    },
  }
}

export default function EndgameWhatIfEntryPoint() {
  const [driver] = useState(() => {
    const ua = navigator.userAgent
    const chromium = /\b(?:Chrome|Chromium|HeadlessChrome)\//.test(ua)
    const chromiumDesktop = chromium && !/\b(?:Android|Mobile|CriOS)\b/.test(ua)
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
    const permittedBuild = import.meta.env.DEV ? loopback : ENDGAME_ANALYSIS_BETA
    const supportedBrowser = import.meta.env.DEV && new URLSearchParams(location.search).get('whatIfAi') === '1' ? chromium : chromiumDesktop
    return permittedBuild && supportedBrowser && isEndgameDevQuery(location.search)
      ? createResultDriver() : undefined
  })
  return import.meta.env.DEV ? <App endgameQa={driver} /> : <App endgameBeta={driver} />
}
