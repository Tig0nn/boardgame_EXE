import { useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createQuestionFeature } from '../../../src/ai/companion/question-feature.ts'
import { FinancialDraftContext } from '../../../src/components/financial-draft-context.ts'
import { createDraftStore } from '../game/draft-store.ts'
import { createCuratedBinding } from '../game/curated-ai.ts'
import { CURATED_CATEGORIES, CURATED_QUESTIONS, questionsForCategory, currentTileName } from '../game/curated-catalog.ts'
import type { GameplaySession } from '../game/universal-ai.ts'
import { CuratedAiResult } from './CuratedAiResult.tsx'
import './beta-companion.css'

/** Receives no dispatch, save, import or gameplay action capability. */
export function BetaCompanion({ session, busy, children }: { session: GameplaySession; busy: boolean; children: ReactNode }) {
  const { store, binding } = useMemo(() => {
    const store = createDraftStore()
    const binding = createCuratedBinding(
      { getSnapshot: session.getSnapshot, subscribe: session.subscribe },
      createQuestionFeature(true), store,
    )
    return { store, binding }
  }, [session])
  const view = useSyncExternalStore(binding.subscribe, binding.getSnapshot)
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const close = () => { binding.reset(); setOpen(false); requestAnimationFrame(() => trigger.current?.focus()) }
  const semantic = view.semantic
  const questions = questionsForCategory(view.input.categoryId)
  const canSend = !busy && CURATED_QUESTIONS.some(q => q.id === view.input.questionId && q.categoryId === view.input.categoryId) && semantic.status !== 'loading'
  return <FinancialDraftContext.Provider value={store}>
    {children}
    <div className="beta-companion" onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); close() } }}>
      {!open ? <button className="beta-trigger" ref={trigger} onClick={() => setOpen(true)} aria-expanded={false} aria-controls="ai-beta-panel">Hỏi AI <small>Beta</small></button> :
        <section id="ai-beta-panel" className="beta-panel" aria-label="Hỏi AI Beta">
          <header><h2>Hỏi AI <small>Beta</small></h2><button onClick={close} aria-label="Đóng Hỏi AI Beta">Đóng</button></header>
          <p className="beta-context curated-tile" role="status">Ô vừa đến: {currentTileName(game)}</p>
          <form className="curated-form" onSubmit={event => { event.preventDefault(); if (canSend) void binding.ask() }}>
            <div className="beta-scroll">
              <p className="beta-limit">Chọn chủ đề và câu hỏi. Chỉ giải thích dữ kiện đã công bố; không thao tác hộ, không dự báo giá hoặc tư vấn đầu tư thật.</p>
              <fieldset className="curated-fieldset"><legend>Loại ô / chủ đề</legend>
                <div className="curated-categories">{CURATED_CATEGORIES.map(item => <label key={item.id} className="curated-choice">
                  <input type="radio" name="ai-beta-category" value={item.id} required checked={view.input.categoryId === item.id} onChange={() => binding.selectCategory(item.id)} />
                  <span>{item.label}</span>
                </label>)}</div>
              </fieldset>
              {questions.length > 0 ? <fieldset className="curated-fieldset curated-questions"><legend>Câu hỏi</legend>
                {questions.map(question => <label key={question.id} className="curated-choice">
                  <input type="radio" name="ai-beta-question" value={question.id} required checked={view.input.questionId === question.id} onChange={() => binding.selectQuestion(question.id)} />
                  <span>{question.text}</span>
                </label>)}
              </fieldset> : <p className="beta-limit">Chưa chọn chủ đề hoặc câu hỏi.</p>}
              <CuratedAiResult view={view} active={open} />
            </div>
            <div className="curated-submit">{busy && <p role="status">Đang chuyển lượt — vui lòng chờ.</p>}<button type="submit" disabled={!canSend}>Gửi</button></div>
          </form>
        </section>}
    </div>
  </FinancialDraftContext.Provider>
}
