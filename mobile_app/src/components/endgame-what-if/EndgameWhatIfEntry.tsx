import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { EndgameAppBinding } from '../../game/endgame-analysis-app-binding.ts'
import { createEndgameUiController } from '../../game/endgame-whatif-ui-controller.ts'
import type { SessionWatch } from '../../game/endgame-whatif-ui-controller.ts'
import { EndgameWhatIfPanel } from './EndgameWhatIfPanel'
import './endgame-what-if.css'

type Registration = {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => EndgameAppBinding | null
}

export function EndgameWhatIfEntry({ registration, watch }: { registration: Registration; watch: SessionWatch }) {
  const binding = useSyncExternalStore(registration.subscribe, registration.getSnapshot)
  return binding ? <BoundEntry binding={binding} watch={watch} /> : null
}

function BoundEntry({ binding, watch }: { binding: EndgameAppBinding; watch: SessionWatch }) {
  const { controller, sessionWatch } = useMemo(() => ({
    controller: createEndgameUiController(binding), sessionWatch: watch,
  }), [binding, watch])
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const trigger = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => controller.mount(sessionWatch), [controller, sessionWatch])
  useLayoutEffect(() => {
    if (view.kind === 'final-read') controller.readFinal()
  }, [controller, view.kind])

  if (view.kind === 'ineligible') return null
  const open = view.kind !== 'closed'
  return <>
    <button type="button" className="endgame-what-if-entry" ref={trigger} aria-haspopup="dialog"
      aria-expanded={open} onClick={() => { void controller.open() }}>
      Thử một lựa chọn khác
    </button>
    {open && <EndgameWhatIfPanel
      view={view}
      trigger={trigger}
      onClose={controller.close}
      onCreate={controller.create}
      onFollowUp={controller.followUp}
      onRecheck={controller.readFinal}
    />}
  </>
}
