import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { createMascotCoach, MascotSurface } from '../game/mascot-coach'
import type { GameState } from '../../../src/game/types'
import { explainMascot, explanationContext } from '../game/mascot-explanation'
import { projectLearningContext } from '../game/mascot-learning-context'
import { CloudFoxCoach } from './CloudFoxCoach'
import type { CloudFoxSource } from './CloudFoxCoach'
import { MascotLearningPanel } from './MascotLearningPanel'
import './mascot-coach.css'

type Coach = ReturnType<typeof createMascotCoach>
type Expression = 'neutral' | 'warning' | 'positive'
const sessionIds = new WeakMap<Coach, string>()

function Fox({ expression }: { expression: Expression }) {
  return <svg viewBox="0 0 52 48" width="38" height="36" fill="none" aria-hidden="true">
    <path d="M10 26 7 5Q7 2 11 4L22 14h8L41 4q4-2 4 1l-3 21-16 16Z" fill="#d77834" stroke="#592c23" strokeWidth="2" strokeLinejoin="round" />
    <path d="m12 9 2 13 7-6zm28 0-2 13-7-6z" fill="#793d39" />
    <path d="M7 27c7-5 14-2 19 6 5-8 12-11 19-6L26 43Z" fill="#ffecd2" stroke="#592c23" strokeWidth="2" strokeLinejoin="round" />
    <path d="m23 33 3-1 3 1-3 3Z" fill="#391f1c" stroke="#391f1c" strokeLinejoin="round" />
    {expression === 'positive'
      ? <path d="M14 26q3-5 6 0m12 0q3-5 6 0m-15 12q3 4 6 0" stroke="#391f1c" strokeWidth="2" strokeLinecap="round" />
      : <><circle cx="17" cy="26" r="1.8" fill="#391f1c" /><circle cx="35" cy="26" r="1.8" fill="#391f1c" />
          {expression === 'warning' && <path d="m14 21 6 2m12 0 6-2m-14 17h4" stroke="#391f1c" strokeWidth="1.8" strokeLinecap="round" />}
        </>}
    <path d="m19 42 7-3 7 3-7 4Z" fill="#497b61" stroke="#294d3a" strokeWidth="1.4" />
  </svg>
}

export function MascotCoach({ coach, surface, game, online }: {
  coach: Coach; surface: MascotSurface; game?: GameState; online?: CloudFoxSource
}) {
  const view = useSyncExternalStore(coach.subscribe, coach.getSnapshot, coach.getSnapshot)
  const { current } = view
  const latest = view.surface === surface ? view.latest : null
  const open = view.surface === surface && view.open
  const [expandedFor, setExpandedFor] = useState<typeof latest>(null)
  const learningContext = useMemo(() => open && game ? projectLearningContext(game) : null, [open, game])
  const revision = game ? [game.phase, game.lap, game.turn, game.log.at(-1)?.sequence].join(':') : ''
  const getSession = () => {
    let session = sessionIds.get(coach)
    if (!session) {
      session = crypto.randomUUID()
      sessionIds.set(coach, session)
    }
    return session
  }
  const panelId = useId()
  const reasonId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const container = useRef<HTMLElement>(null)
  const expanded = !!latest && latest === expandedFor
  const context = latest ? explanationContext(latest) : null
  const deep = expanded && context ? explainMascot(context, null, latest?.evidence) : null
  useEffect(() => {
    if (!open) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      setExpandedFor(null)
      coach.dismiss()
      if (container.current?.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true })
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [coach, open])
  return <aside className={surface === 'board' ? 'mascot-coach mascot-board' : 'mascot-coach mascot-summary'} aria-label="Cáo EXE, bạn đồng hành tài chính" ref={container}>
    <button ref={trigger} type="button" className="mascot-trigger" aria-label="Cáo EXE" aria-expanded={open} aria-controls={panelId}
      onClick={() => { setExpandedFor(null); coach.toggle() }}>
      <Fox expression={!latest || latest.severity === 'informational' ? 'neutral' : latest.severity} />
      <span>Cáo EXE</span>
    </button>
    <section id={panelId} className="mascot-bubble" aria-label="Cáo EXE" data-signal={latest?.signalId} data-severity={latest?.severity} hidden={!open}>
      {latest && <div className="mascot-insight">
        <div>
          {!current && <p className="mascot-explanation-source">Ghi nhận trước đó trong ván</p>}
          <p className={expanded ? undefined : 'mascot-insight-preview'} role="status">{open && latest.message}</p>
        </div>
        <button className="mascot-why" type="button" aria-expanded={expanded} aria-controls={reasonId}
          onClick={() => setExpandedFor(expanded ? null : latest)}>Vì sao?</button>
      </div>}
      {latest && <section id={reasonId} className="mascot-explanation" aria-label="Giải thích tín hiệu" hidden={!expanded}
        tabIndex={0}>
        <p className="mascot-explanation-source" role="status">
          {current ? 'Giải thích từ dữ kiện ván' : 'Dữ kiện tại thời điểm ghi nhận'}
        </p>
        <p className="mascot-reason">{deep?.narrative ?? 'Chưa đủ dữ kiện để giải thích thêm về quyết định này.'}</p>
        {deep && <dl>{deep.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
      </section>}
      {open && online && <CloudFoxCoach key={online.sessionId + ':' + online.stateVersion} {...online} />}
      {open && !online && <MascotLearningPanel
        key={revision}
        context={learningContext} getSession={getSession} />}
    </section>
  </aside>
}
